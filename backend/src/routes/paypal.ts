import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/database';

const router = Router();

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

async function getPayPalToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret   = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !secret) throw new Error('PayPal credentials not configured in server environment.');

  const credentials = Buffer.from(`${clientId}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    let detail = '';
    try { detail = JSON.stringify(await res.json()); } catch { detail = await res.text(); }
    throw new Error(`PayPal auth failed (${res.status}): ${detail}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

// POST /api/payments/paypal/create-order
router.post('/create-order', authenticate, async (req: Request, res: Response) => {
  try {
    const { consultationId } = z.object({ consultationId: z.string() }).parse(req.body);

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
    });

    if (!consultation) return res.status(404).json({ error: 'Consultation not found' });

    const amount = Math.max(consultation.price, 0.01).toFixed(2);
    const token  = await getPayPalToken();

    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `${consultationId}-${Date.now()}`,
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: consultationId,
          amount: {
            currency_code: 'USD',
            value: amount,
          },
          description: 'Consultation booking via DA Consulting',
        }],
        payment_source: {
          paypal: {
            experience_context: {
              return_url: 'da-consulting://checkout/paypal-success',
              cancel_url:  'da-consulting://checkout/paypal-cancel',
              brand_name:  'DA Consulting',
              user_action: 'PAY_NOW',
              shipping_preference: 'NO_SHIPPING',
            },
          },
        },
      }),
    });

    if (!orderRes.ok) {
      let detail = '';
      try { detail = JSON.stringify(await orderRes.json()); } catch { detail = await orderRes.text(); }
      return res.status(500).json({ error: 'Failed to create PayPal order', detail });
    }

    const order = await orderRes.json() as {
      id: string;
      links: { rel: string; href: string }[];
    };

    const approvalUrl = order.links.find(l => l.rel === 'approve' || l.rel === 'payer-action')?.href ?? '';
    return res.json({ orderId: order.id, approvalUrl });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/payments/paypal/capture-order
router.post('/capture-order', authenticate, async (req: Request, res: Response) => {
  try {
    const { orderId, consultationId } = z
      .object({ orderId: z.string(), consultationId: z.string().optional() })
      .parse(req.body);

    const token = await getPayPalToken();

    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureRes.ok) {
      let detail = '';
      try { detail = JSON.stringify(await captureRes.json()); } catch { detail = await captureRes.text(); }
      return res.status(500).json({ error: 'Failed to capture PayPal order', detail });
    }

    const capture = await captureRes.json() as {
      status: string;
      purchase_units: { payments: { captures: { id: string; amount: { value: string } }[] } }[];
    };

    if (capture.status !== 'COMPLETED') {
      return res.status(400).json({ error: 'Payment not completed', status: capture.status });
    }

    const captureId = capture.purchase_units[0]?.payments?.captures[0]?.id ?? '';

    // Mark consultation as AWAITING_CONFIRMATION — expert must accept before it becomes UPCOMING
    if (consultationId) {
      await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: 'AWAITING_CONFIRMATION' },
      }).catch(() => {});

      // Record / update the payment
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
          },
          update: {
            status: 'COMPLETED',
          },
        }).catch(() => {});
      }
    }

    return res.json({ status: capture.status, captureId });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
