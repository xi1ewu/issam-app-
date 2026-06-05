import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { notify } from '../config/notify';
import { AuthRequest } from '../types';

const router = Router();

let stripeInstance: import('stripe').default | null = null;
function getStripe() {
  if (!stripeInstance) {
    const Stripe = require('stripe');
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2024-04-10' });
  }
  return stripeInstance!;
}

const createIntentSchema = z.object({
  consultationId: z.string(),
});

const confirmSchema = z.object({
  consultationId: z.string(),
  paymentIntentId: z.string(),
});

// POST /api/payments/create-intent
router.post('/create-intent', authenticate, validate(createIntentSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.body.consultationId },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.clientId !== req.user!.userId) return next(createError('Forbidden', 403));

    const platformFee = consultation.price * 0.05;
    const total = consultation.price + platformFee;
    const amountInCents = Math.round(total * 100);

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: {
        consultationId: consultation.id,
        userId: req.user!.userId,
      },
    });

    await prisma.payment.upsert({
      where: { consultationId: consultation.id },
      create: {
        consultationId: consultation.id,
        userId: req.user!.userId,
        amount: consultation.price,
        platformFee,
        status: 'PENDING',
        stripePaymentIntentId: paymentIntent.id,
      },
      update: {
        stripePaymentIntentId: paymentIntent.id,
        status: 'PENDING',
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: total,
      currency: 'usd',
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/confirm  (manual confirm for testing without Stripe SDK)
router.post('/confirm', authenticate, validate(confirmSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consultationId, paymentIntentId } = req.body;

    const payment = await prisma.payment.update({
      where: { consultationId },
      data: { status: 'COMPLETED', stripeChargeId: paymentIntentId },
    });

    // Notify client of payment success + expert of new booking
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { expert: { include: { user: true } } },
    });
    if (consultation) {
      const expertUser = consultation.expert?.user;
      notify({
        userId:  consultation.clientId,
        type:    'PAYMENT_SUCCESS',
        title:   'Payment Successful 💳',
        message: `Your $${consultation.price.toFixed(0)} payment was processed. Awaiting ${expertUser?.name ?? 'expert'} confirmation.`,
        data:    { consultationId },
        senderName:   expertUser?.name   ?? undefined,
        senderAvatar: expertUser?.avatar ?? undefined,
      });
      if (consultation.expert?.userId) {
        const clientUser = await prisma.user.findUnique({
          where: { id: consultation.clientId },
          select: { name: true, avatar: true },
        });
        notify({
          userId:       consultation.expert.userId,
          type:         'BOOKING_NEW',
          title:        'New Booking Request 📅',
          message:      `${clientUser?.name ?? 'A client'} requested a session on ${consultation.date} at ${consultation.time}.`,
          data:         { consultationId },
          senderName:   clientUser?.name   ?? undefined,
          senderAvatar: clientUser?.avatar ?? undefined,
        });
      }
    }

    res.json({ payment, message: 'Payment confirmed' });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/webhook  (Stripe webhook — raw body)
export async function stripeWebhookHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    res.status(400).json({ error: 'Missing webhook config' });
    return;
  }

  let event: import('stripe').Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch {
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as import('stripe').Stripe.PaymentIntent;
      const consultationId = intent.metadata.consultationId;

      await prisma.payment.update({
        where: { stripePaymentIntentId: intent.id },
        data: { status: 'COMPLETED' },
      });

      await prisma.consultation.update({
        where: { id: consultationId },
        data: { status: 'UPCOMING' },
      });
    }

    if (event.type === 'payment_intent.payment_failed') {
      const intent = event.data.object as import('stripe').Stripe.PaymentIntent;
      await prisma.payment.update({
        where: { stripePaymentIntentId: intent.id },
        data: { status: 'FAILED' },
      });
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

export default router;
