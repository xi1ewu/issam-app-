import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { notify } from '../config/notify';
import { AuthRequest } from '../types';

const router = Router();

const bookSchema = z.object({
  expertId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
  duration: z.number().int().positive(),
  type: z.enum(['VIDEO', 'AUDIO', 'CHAT']),
  topic: z.string().min(3),
  notes: z.string().optional(),
});

const rescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string(),
});

const consultationSelect = {
  id: true,
  date: true,
  time: true,
  duration: true,
  type: true,
  status: true,
  topic: true,
  price: true,
  notes: true,
  meetingUrl: true,
  createdAt: true,
  expert: {
    select: {
      id: true,
      title: true,
      hourlyRate: true,
      userId: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
  },
  client: { select: { id: true, name: true, avatar: true } },
  payment: { select: { status: true, amount: true } },
};

// GET /api/consultations
router.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, role } = req.query as { status?: string; role?: string };
    const userId = req.user!.userId;

    // Experts see AWAITING_CONFIRMATION and UPCOMING (not PENDING_PAYMENT)
    // Clients see everything except PENDING_PAYMENT (which is shown separately in checkout)
    const statusFilter = status
      ? { status: status.toUpperCase() as any }
      : role === 'expert'
        ? { status: { in: ['AWAITING_CONFIRMATION', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as any[] } }
        : { status: { in: ['AWAITING_CONFIRMATION', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as any[] } };

    const where: object = {
      ...(role === 'expert'
        ? { expert: { userId } }
        : { clientId: userId }),
      ...statusFilter,
    };

    const consultations = await prisma.consultation.findMany({
      where,
      select: consultationSelect,
      orderBy: { date: 'desc' },
    });

    res.json(consultations);
  } catch (err) {
    next(err);
  }
});

// POST /api/consultations — creates as PENDING_PAYMENT, not visible to expert yet
router.post('/', authenticate, validate(bookSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { expertId, date, time, duration, type, topic, notes } = req.body;

    const expert = await prisma.expert.findUnique({ where: { id: expertId } });
    if (!expert) return next(createError('Expert not found', 404));
    if (!expert.isAvailable) return next(createError('Expert is not available', 400));

    const price = (expert.hourlyRate * duration) / 60;

    const consultation = await prisma.consultation.create({
      data: {
        clientId: req.user!.userId,
        expertId,
        date,
        time,
        duration,
        type,
        topic,
        notes,
        price,
        status: 'PENDING_PAYMENT',
        meetingUrl: `https://meet.jit.si/da-${Date.now()}`,
      },
      select: consultationSelect,
    });

    res.status(201).json(consultation);
  } catch (err) {
    next(err);
  }
});

// GET /api/consultations/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
      select: { ...consultationSelect, review: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));

    const userId = req.user!.userId;
    const isClient = consultation.client.id === userId;
    const isExpert = consultation.expert.user?.id === userId;
    if (!isClient && !isExpert) return next(createError('Forbidden', 403));

    res.json(consultation);
  } catch (err) {
    next(err);
  }
});

// PUT /api/consultations/:id/cancel
router.put('/:id/cancel', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
      include: { expert: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.clientId !== req.user!.userId && consultation.expert.userId !== req.user!.userId) {
      return next(createError('Forbidden', 403));
    }

    const cancellableStatuses = ['UPCOMING', 'AWAITING_CONFIRMATION'];
    if (!cancellableStatuses.includes(consultation.status)) {
      return next(createError('Only upcoming or awaiting consultations can be cancelled', 400));
    }

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      select: consultationSelect,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/consultations/:id/confirm  — expert accepts the consultation
router.put('/:id/confirm', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
      include: { expert: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.expert.userId !== req.user!.userId) {
      return next(createError('Only the expert can confirm this consultation', 403));
    }
    if (consultation.status !== 'AWAITING_CONFIRMATION') {
      return next(createError('Consultation is not awaiting confirmation', 400));
    }

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'UPCOMING' },
      select: consultationSelect,
    });

    // Socket + in-app + push notification to client
    const io = (req as any).app?.locals?.io;
    if (io) {
      io.to(`user:${consultation.clientId}`).emit('consultation_confirmed', {
        consultationId: consultation.id,
      });
    }
    const expertUser = await prisma.user.findUnique({
      where: { id: consultation.expert.userId },
      select: { name: true, avatar: true },
    });
    notify({
      userId:      consultation.clientId,
      type:        'BOOKING_CONFIRMED',
      title:       'Booking Confirmed ✅',
      message:     `Your session on ${consultation.date} at ${consultation.time} has been confirmed by ${expertUser?.name ?? 'your expert'}.`,
      data:        { consultationId: consultation.id },
      senderName:  expertUser?.name   ?? undefined,
      senderAvatar: expertUser?.avatar ?? undefined,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/consultations/:id/decline  — expert declines the consultation
router.put('/:id/decline', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
      include: { expert: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.expert.userId !== req.user!.userId) {
      return next(createError('Only the expert can decline this consultation', 403));
    }
    if (consultation.status !== 'AWAITING_CONFIRMATION') {
      return next(createError('Consultation is not awaiting confirmation', 400));
    }

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      select: consultationSelect,
    });

    // In-app + push: notify client of decline
    const decliningExpert = await prisma.user.findUnique({
      where: { id: consultation.expert.userId },
      select: { name: true, avatar: true },
    });
    notify({
      userId:       consultation.clientId,
      type:         'BOOKING_DECLINED',
      title:        'Booking Declined',
      message:      `Your session request for ${consultation.date} was declined by ${decliningExpert?.name ?? 'the expert'}. Please book with another expert.`,
      data:         { consultationId: consultation.id },
      senderName:   decliningExpert?.name   ?? undefined,
      senderAvatar: decliningExpert?.avatar ?? undefined,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/consultations/:id/reschedule
router.put('/:id/reschedule', authenticate, validate(rescheduleSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.clientId !== req.user!.userId) return next(createError('Forbidden', 403));
    if (consultation.status !== 'UPCOMING') return next(createError('Cannot reschedule', 400));

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { date: req.body.date, time: req.body.time },
      select: consultationSelect,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/consultations/:id/complete (expert marks as done)
router.put('/:id/complete', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: req.params.id },
      include: { expert: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.expert.userId !== req.user!.userId) return next(createError('Forbidden', 403));

    const updated = await prisma.consultation.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED' },
      select: consultationSelect,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
