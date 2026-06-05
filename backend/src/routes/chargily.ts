/**
 * Chargily Pay integration
 * Docs: https://dev.chargily.com/pay-v2/introduction
 *
 * Flow:
 *  1. POST /create-checkout  → creates a hosted checkout, returns { checkoutUrl, checkoutId }
 *  2. App opens checkoutUrl in WebBrowser
 *  3. User pays on Chargily's hosted page (CIB / Dahabia / eDahabia)
 *  4. Chargily redirects to success_url / failure_url deep-link
 *  5. POST /verify-checkout  → confirms status & marks consultation UPCOMING
 *  6. POST /webhook          → Chargily server-to-server notification (backup)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

// ─── Config ───────────────────────────────────────────────────────────────────

const MODE       = process.env.CHARGILY_MODE === 'live' ? 'live' : 'test';
const BASE_URL   = MODE === 'live'
  ? 'https://pay.chargily.net/api/v2'
  : 'https://pay.chargily.net/test/api/v2';
const API_KEY    = process.env.CHARGILY_API_KEY ?? '';
const DZD_RATE   = parseFloat(process.env.USD_TO_DZD_RATE ?? '135');

function chargilyHeaders() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function usdToDzd(usd: number): number {
  // Chargily amounts are in centimes (1 DZD = 100 centimes)
  return Math.round(usd * DZD_RATE * 100);
}

// ─── POST /create-checkout ────────────────────────────────────────────────────

router.post('/create-checkout', authenticate, async (req: Request, res: Response) => {
  try {
    if (!API_KEY || API_KEY === 'test_sk_xxxxxxxxxxxxxxxxxxxxxxxx') {
      return res.status(503).json({
        error: 'Chargily not configured',
        detail: 'Set CHARGILY_API_KEY in your backend .env file. Get your key at https://dashboard.chargily.com',
      });
    }

    const { consultationId } = z.object({ consultationId: z.string() }).parse(req.body);

    const consultation = await prisma.consultation.findUnique({
      where:   { id: consultationId },
      include: { expert: { include: { user: true } } },
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    const amountCentimes = usdToDzd(consultation.price);
    const amountDzd      = Math.round(amountCentimes / 100);

    // Build the webhook and proxy URLs
    const backendUrl  = process.env.BACKEND_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const webhookUrl  = backendUrl && !backendUrl.includes('localhost')
      ? `${backendUrl}/api/payments/chargily/webhook`
      : undefined;

    const payload: Record<string, any> = {
      amount:   amountCentimes,          // integer centimes (1 DZD = 100 centimes)
      currency: 'dzd',
      description: `Consultation with ${consultation.expert.user?.name ?? 'Expert'} — ${consultationId.slice(0, 8).toUpperCase()}`,
      locale: 'ar',                       // 'ar' | 'fr' | 'en'
      success_url: `${backendUrl}/api/payments/chargily/success?consultation=${consultationId}`,
      failure_url: `${backendUrl}/api/payments/chargily/failure?consultation=${consultationId}`,
      metadata: {
        consultationId,
        userId: (req as any).user?.userId ?? '',
        amountUsd: consultation.price,
      },
    };

    // Only include webhook when it's a reachable URL
    if (webhookUrl) payload.webhook_endpoint = webhookUrl;

    const response = await fetch(`${BASE_URL}/checkouts`, {
      method:  'POST',
      headers: chargilyHeaders(),
      body:    JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = '';
      try { detail = JSON.stringify(await response.json()); } catch { detail = await response.text(); }
      return res.status(response.status).json({
        error: `Chargily error (${response.status})`,
        detail,
      });
    }

    const data = await response.json() as {
      id: string;
      checkout_url: string;
      status: string;
    };

    return res.json({
      checkoutId:  data.id,
      checkoutUrl: data.checkout_url,
      status:      data.status,
      amountDzd,
      amountCentimes,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /verify-checkout ────────────────────────────────────────────────────

router.post('/verify-checkout', authenticate, async (req: Request, res: Response) => {
  try {
    const { checkoutId, consultationId } = z.object({
      checkoutId:     z.string(),
      consultationId: z.string(),
    }).parse(req.body);

    const response = await fetch(`${BASE_URL}/checkouts/${checkoutId}`, {
      headers: chargilyHeaders(),
    });

    if (!response.ok) {
      let detail = '';
      try { detail = JSON.stringify(await response.json()); } catch { detail = await response.text(); }
      return res.status(response.status).json({ error: `Chargily verification failed (${response.status})`, detail });
    }

    const data = await response.json() as {
      id: string;
      status: 'pending' | 'paid' | 'failed';
      amount: number;
      currency: string;
    };

    if (data.status === 'paid') {
      // Confirm the consultation (needs expert acceptance)
      await prisma.consultation.update({
        where: { id: consultationId },
        data:  { status: 'AWAITING_CONFIRMATION' },
      }).catch(() => {});

      const consultation = await prisma.consultation.findUnique({
        where: { id: consultationId },
        select: { price: true, clientId: true },
      }).catch(() => null);

      if (consultation) {
        const platformFee = parseFloat((consultation.price * 0.05).toFixed(2));
        await prisma.payment.upsert({
          where: { consultationId },
          create: {
            consultationId,
            userId: consultation.clientId,
            amount: consultation.price,
            platformFee,
            status: 'COMPLETED',
            chargilyCheckoutId: checkoutId,
          },
          update: {
            status: 'COMPLETED',
            chargilyCheckoutId: checkoutId,
          },
        }).catch(() => {});
      }
    }

    return res.json({
      status:      data.status,
      paid:        data.status === 'paid',
      checkoutId:  data.id,
      amount:      data.amount,
      currency:    data.currency,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /success & /failure (Redirect Proxies) ──────────────────────────────

router.get('/success', (req: Request, res: Response) => {
  const consultation = req.query.consultation as string;
  res.redirect(`da-consulting://checkout/chargily-success?consultation=${consultation}`);
});

router.get('/failure', (req: Request, res: Response) => {
  const consultation = req.query.consultation as string;
  res.redirect(`da-consulting://checkout/chargily-failure?consultation=${consultation}`);
});

// ─── GET /checkout-status/:checkoutId ─────────────────────────────────────────

router.get('/checkout-status/:checkoutId', authenticate, async (req: Request, res: Response) => {
  try {
    const { checkoutId } = req.params;

    const response = await fetch(`${BASE_URL}/checkouts/${checkoutId}`, {
      headers: chargilyHeaders(),
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Could not fetch checkout status' });
    }

    const data = await response.json() as { id: string; status: string; amount: number };
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /webhook  (Chargily server → backend) ───────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body as {
      type:   string;
      data:   { id: string; status: string; metadata?: { consultationId?: string } };
    };

    if (event.type === 'checkout.paid' && event.data.metadata?.consultationId) {
      await prisma.consultation.update({
        where: { id: event.data.metadata.consultationId },
        data:  { status: 'AWAITING_CONFIRMATION' },
      }).catch(() => {});

      const consultation = await prisma.consultation.findUnique({
        where: { id: event.data.metadata.consultationId },
        select: { price: true, clientId: true },
      }).catch(() => null);

      if (consultation) {
        const platformFee = parseFloat((consultation.price * 0.05).toFixed(2));
        await prisma.payment.upsert({
          where: { consultationId: event.data.metadata.consultationId },
          create: {
            consultationId: event.data.metadata.consultationId,
            userId: consultation.clientId,
            amount: consultation.price,
            platformFee,
            status: 'COMPLETED',
            chargilyCheckoutId: event.data.id,
          },
          update: {
            status: 'COMPLETED',
            chargilyCheckoutId: event.data.id,
          },
        }).catch(() => {});
      }
    }

    return res.json({ received: true });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

export default router;
