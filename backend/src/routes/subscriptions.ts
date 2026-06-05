import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAYPAL_BASE =
  process.env.PAYPAL_ENV === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

const CHARGILY_BASE =
  process.env.CHARGILY_MODE === 'live'
    ? 'https://pay.chargily.net/api/v2'
    : 'https://pay.chargily.net/test/api/v2';

async function getPayPalToken(): Promise<string> {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PayPal credentials not configured');
  const credentials = Buffer.from(`${id}:${secret}`).toString('base64');
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error('Failed to get PayPal token');
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

function chargilyHeaders() {
  return {
    Authorization: `Bearer ${process.env.CHARGILY_API_KEY ?? ''}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

function activateDays(period: string, billing: string): number {
  if (billing === 'yearly') return 365;
  const map: Record<string, number> = { monthly: 30, yearly: 365, weekly: 7 };
  return map[period] ?? 30;
}

async function activateSubscription(userId: string, planId: string, billing: string, ref: {
  chargilyCheckoutId?: string;
  paypalOrderId?: string;
}) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Plan not found');

  const days = activateDays(plan.period, billing);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  await prisma.subscription.updateMany({
    where: { userId, status: 'ACTIVE' },
    data: { status: 'CANCELLED' },
  });

  return prisma.subscription.create({
    data: {
      userId,
      planId,
      status: 'ACTIVE',
      billingPeriod: billing,
      expiresAt,
      chargilyCheckoutId: ref.chargilyCheckoutId,
      paypalOrderId: ref.paypalOrderId,
    },
    include: { plan: true },
  });
}

// ─── GET /api/subscriptions/plans ────────────────────────────────────────────

router.get('/plans', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/subscriptions/current ──────────────────────────────────────────

router.get('/current', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    // Auto-expire if past expiry date
    if (sub && sub.expiresAt < new Date()) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
      return res.json(null);
    }

    res.json(sub ?? null);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/subscriptions/cancel ──────────────────────────────────────────

router.post('/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.subscription.updateMany({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
      data: { status: 'CANCELLED' },
    });
    res.json({ message: 'Subscription cancelled' });
  } catch (err) {
    next(err);
  }
});

// ─── Chargily (DZD) ───────────────────────────────────────────────────────────

const chargilyCheckoutSchema = z.object({
  planId:  z.string(),
  billing: z.enum(['monthly', 'yearly']),
});

// POST /api/subscriptions/chargily-checkout
router.post('/chargily-checkout', authenticate, validate(chargilyCheckoutSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, billing } = req.body;
    const apiKey = process.env.CHARGILY_API_KEY ?? '';

    if (!apiKey) return next(createError('Chargily not configured', 503));

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return next(createError('Plan not found', 404));
    if (plan.price === 0) return next(createError('Free plan needs no payment', 400));

    // Pick the right DZD amount in centimes
    const dzdAmount = billing === 'yearly' ? (plan.priceYearly ?? plan.price * 12) : plan.price;
    const amountCentimes = Math.round(dzdAmount * 100);

    const backendUrl = process.env.BACKEND_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:3000';
    const webhookUrl = !backendUrl.includes('localhost')
      ? `${backendUrl}/api/subscriptions/chargily-webhook`
      : undefined;

    const payload: Record<string, any> = {
      amount:      amountCentimes,
      currency:    'dzd',
      description: `${plan.name} Plan (${billing}) — DA Consulting`,
      locale:      'ar',
      success_url: `${backendUrl}/api/subscriptions/chargily-success?planId=${planId}&billing=${billing}`,
      failure_url: `${backendUrl}/api/subscriptions/chargily-failure?planId=${planId}`,
      metadata:    { userId: req.user!.userId, planId, billing },
    };
    if (webhookUrl) payload.webhook_endpoint = webhookUrl;

    const chargilyRes = await fetch(`${CHARGILY_BASE}/checkouts`, {
      method: 'POST',
      headers: chargilyHeaders(),
      body: JSON.stringify(payload),
    });

    if (!chargilyRes.ok) {
      const detail = await chargilyRes.text();
      return next(createError(`Chargily error: ${detail}`, 500));
    }

    const data = await chargilyRes.json() as { id: string; checkout_url: string; status: string };
    res.json({ checkoutId: data.id, checkoutUrl: data.checkout_url, amountDzd: Math.round(amountCentimes / 100) });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/chargily-verify
router.post('/chargily-verify', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { checkoutId, planId, billing } = req.body as { checkoutId: string; planId: string; billing: string };
    if (!checkoutId || !planId) return next(createError('checkoutId and planId required', 400));

    const chargilyRes = await fetch(`${CHARGILY_BASE}/checkouts/${checkoutId}`, {
      headers: chargilyHeaders(),
    });

    if (!chargilyRes.ok) return next(createError('Failed to verify Chargily checkout', 400));

    const data = await chargilyRes.json() as { id: string; status: string };

    if (data.status !== 'paid') {
      return res.json({ paid: false, status: data.status });
    }

    const sub = await activateSubscription(req.user!.userId, planId, billing ?? 'monthly', {
      chargilyCheckoutId: checkoutId,
    });

    res.json({ paid: true, subscription: sub });
  } catch (err) {
    next(err);
  }
});

// GET /api/subscriptions/chargily-success  — redirect proxy back to app
router.get('/chargily-success', (req: Request, res: Response) => {
  const { planId, billing } = req.query as { planId?: string; billing?: string };
  res.redirect(`da-consulting://subscription/success?planId=${planId ?? ''}&billing=${billing ?? 'monthly'}`);
});

// GET /api/subscriptions/chargily-failure
router.get('/chargily-failure', (req: Request, res: Response) => {
  res.redirect('da-consulting://subscription/failure');
});

// POST /api/subscriptions/chargily-webhook  — server-to-server confirmation
router.post('/chargily-webhook', async (req: Request, res: Response) => {
  try {
    const event = req.body as {
      type: string;
      data: { id: string; status: string; metadata?: { userId?: string; planId?: string; billing?: string } };
    };

    if (event.type === 'checkout.paid' && event.data.metadata?.userId && event.data.metadata?.planId) {
      const { userId, planId, billing = 'monthly' } = event.data.metadata;
      await activateSubscription(userId, planId, billing, { chargilyCheckoutId: event.data.id }).catch(() => {});
    }

    res.json({ received: true });
  } catch {
    res.json({ received: true });
  }
});

// ─── PayPal (USD) ─────────────────────────────────────────────────────────────

const paypalOrderSchema = z.object({
  planId:  z.string(),
  billing: z.enum(['monthly', 'yearly']),
});

// POST /api/subscriptions/paypal-order
router.post('/paypal-order', authenticate, validate(paypalOrderSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planId, billing } = req.body;
    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) return next(createError('Plan not found', 404));
    if (plan.price === 0) return next(createError('Free plan needs no payment', 400));

    // Convert DZD → USD (rough 1 USD ≈ 135 DZD)
    const rate = parseFloat(process.env.USD_TO_DZD_RATE ?? '135');
    const dzdPrice = billing === 'yearly' ? (plan.priceYearly ?? plan.price * 12) : plan.price;
    const usdPrice = (dzdPrice / rate).toFixed(2);

    const token = await getPayPalToken();
    const orderRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: planId,
          amount: { currency_code: 'USD', value: usdPrice },
          description: `${plan.name} (${billing}) — DA Consulting`,
        }],
        application_context: {
          return_url: `da-consulting://subscription/success?planId=${planId}&billing=${billing}`,
          cancel_url: 'da-consulting://subscription/failure',
          brand_name: 'DA Consulting',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      return next(createError(`PayPal error: ${err}`, 500));
    }

    const order = await orderRes.json() as { id: string; links: { rel: string; href: string }[] };
    const approvalUrl = order.links.find(l => l.rel === 'approve')?.href ?? '';
    res.json({ orderId: order.id, approvalUrl });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/paypal-capture
router.post('/paypal-capture', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId, planId, billing = 'monthly' } = req.body as { orderId: string; planId: string; billing?: string };
    if (!orderId || !planId) return next(createError('orderId and planId required', 400));

    const token = await getPayPalToken();
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!captureRes.ok) {
      const err = await captureRes.text();
      return next(createError(`PayPal capture failed: ${err}`, 500));
    }

    const capture = await captureRes.json() as { status: string };
    if (capture.status !== 'COMPLETED') return next(createError('Payment not completed', 400));

    const sub = await activateSubscription(req.user!.userId, planId, billing, { paypalOrderId: orderId });
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

// ─── Free plan activation ─────────────────────────────────────────────────────

router.post('/activate-free', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const freePlan = await prisma.subscriptionPlan.findFirst({ where: { slug: 'free' } });
    if (!freePlan) return next(createError('Free plan not found', 404));

    const existing = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'ACTIVE' },
    });
    if (existing) return res.json(existing);

    const sub = await activateSubscription(req.user!.userId, freePlan.id, 'monthly', {});
    res.status(201).json(sub);
  } catch (err) {
    next(err);
  }
});

export default router;
