import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { notify } from '../config/notify';
import { AuthRequest } from '../types';

const router = Router();

const updateExpertSchema = z.object({
  title: z.string().optional(),
  bio: z.string().optional(),
  category: z.string().optional(),
  expertise: z.array(z.string()).optional(),
  hourlyRate: z.number().positive().optional(),
  isAvailable: z.boolean().optional(),
  yearsExp: z.number().int().min(0).optional(),
  languages: z.array(z.string()).optional(),
});

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slots: z.array(z.object({
    id: z.string(),
    time: z.string(),
    isAvailable: z.boolean(),
  })),
});

const expertSelect = {
  id: true,
  title: true,
  bio: true,
  category: true,
  expertise: true,
  hourlyRate: true,
  rating: true,
  reviewCount: true,
  isVerified: true,
  isAvailable: true,
  yearsExp: true,
  languages: true,
  user: {
    select: { id: true, name: true, avatar: true, location: true },
  },
  _count: { select: { consultations: true } },
};

// GET /api/experts/saved  — must be before /:id
router.get('/saved', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const saved = await prisma.savedExpert.findMany({
      where: { userId: req.user!.userId },
      include: { expert: { select: expertSelect } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(saved.map(s => s.expert));
  } catch (err) {
    next(err);
  }
});

// GET /api/experts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, sort = 'rating', page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: object = {
      ...(category && category !== 'All' ? { category } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { expertise: { has: search } },
        ],
      } : {}),
    };

    const [experts, total] = await Promise.all([
      prisma.expert.findMany({
        where,
        select: expertSelect,
        orderBy: sort === 'price' ? { hourlyRate: 'asc' } : { rating: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.expert.count({ where }),
    ]);

    res.json({ experts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({
      where: { id: req.params.id },
      select: {
        ...expertSelect,
        receivedReviews: {
          include: { author: { select: { name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!expert) return next(createError('Expert not found', 404));
    res.json(expert);
  } catch (err) {
    next(err);
  }
});

// PUT /api/experts/profile  (expert updates own profile)
router.put('/profile', authenticate, requireRole('EXPERT'), validate(updateExpertSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.update({
      where: { userId: req.user!.userId },
      data: req.body,
      select: expertSelect,
    });
    res.json(expert);
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/:id/saved-status
router.get('/:id/saved-status', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const saved = await prisma.savedExpert.findUnique({
      where: { userId_expertId: { userId: req.user!.userId, expertId: req.params.id } },
    });
    res.json({ saved: !!saved });
  } catch (err) {
    next(err);
  }
});

// POST /api/experts/:id/save  — toggle bookmark
router.post('/:id/save', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.savedExpert.findUnique({
      where: { userId_expertId: { userId: req.user!.userId, expertId: req.params.id } },
    });

    if (existing) {
      await prisma.savedExpert.delete({ where: { id: existing.id } });
      return res.json({ saved: false });
    }

    await prisma.savedExpert.create({
      data: { userId: req.user!.userId, expertId: req.params.id },
    });

    // Notify the expert that someone saved their profile
    const [saver, expert] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true, avatar: true } }),
      prisma.expert.findUnique({ where: { id: req.params.id }, select: { userId: true } }),
    ]);
    if (expert?.userId) {
      notify({
        userId: expert.userId,
        type: 'EXPERT_SAVED',
        title: '⭐ Someone saved your profile',
        message: `${saver?.name ?? 'A user'} bookmarked you as a favourite expert.`,
        data: { expertId: req.params.id },
        senderName:   saver?.name  ?? undefined,
        senderAvatar: saver?.avatar ?? undefined,
      });
    }

    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/experts/:id/view  — record a profile view (no auth required)
router.post('/:id/view', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.profileView.create({
      data: { expertId: req.params.id },
    });
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/:id/availability/:date
// Normalize stored slots into the public { id, time, isAvailable } format.
// Handles both old format (array) and new format ({ dayAvailable, slots:[{start,...}] }).
function normalizeSlots(raw: any): { id: string; time: string; isAvailable: boolean }[] {
  if (Array.isArray(raw)) return raw; // old format
  if (raw && typeof raw === 'object' && 'slots' in raw) {
    // new format saved by AvailabilityCalendarScreen
    if (!raw.dayAvailable) return [];
    return (raw.slots as any[]).map((s: any) => ({
      id: s.id,
      time: s.start,
      isAvailable: s.isAvailable,
    }));
  }
  return [];
}

router.get('/:id/availability/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, date } = req.params;
    const avail = await prisma.availability.findUnique({
      where: { expertId_date: { expertId: id, date } },
    });

    if (!avail) return res.json({ slots: [] });

    res.json({ slots: normalizeSlots(avail.slots) });
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/:id/available-dates?year=2025&month=10
// Returns which dates in a month have at least one available slot (for calendar dots).
router.get('/:id/available-dates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { year, month } = req.query as Record<string, string>;
    if (!year || !month) return res.json({ dates: [] });

    const prefix = `${year}-${month.padStart(2, '0')}`;
    const records = await prisma.availability.findMany({
      where: {
        expertId: id,
        date: { startsWith: prefix },
      },
      select: { date: true, slots: true },
    });

    const dates = records
      .filter(r => r.date !== 'weekly-recurring' && normalizeSlots(r.slots).some(s => s.isAvailable))
      .map(r => r.date);

    res.json({ dates });
  } catch (err) {
    next(err);
  }
});

// POST /api/experts/:id/availability  (expert sets availability)
router.post('/:id/availability', authenticate, requireRole('EXPERT'), validate(availabilitySchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert || expert.id !== req.params.id) return next(createError('Forbidden', 403));

    const { date, slots } = req.body;
    const avail = await prisma.availability.upsert({
      where: { expertId_date: { expertId: expert.id, date } },
      create: { expertId: expert.id, date, slots },
      update: { slots },
    });
    res.json(avail);
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/my-schedule  — load the logged-in expert's weekly recurring grid
router.get('/my-schedule', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const record = await prisma.availability.findUnique({
      where: { expertId_date: { expertId: expert.id, date: 'weekly-recurring' } },
    });
    res.json({ grid: (record?.slots as any)?.grid ?? {} });
  } catch (err) {
    next(err);
  }
});

// PUT /api/experts/my-schedule  — save the logged-in expert's weekly recurring grid
router.put('/my-schedule', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const { grid } = req.body;
    await prisma.availability.upsert({
      where: { expertId_date: { expertId: expert.id, date: 'weekly-recurring' } },
      create: { expertId: expert.id, date: 'weekly-recurring', slots: { grid } },
      update: { slots: { grid } },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /api/experts/my-availability/:date  — get own per-date time slots
router.get('/my-availability/:date', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const record = await prisma.availability.findUnique({
      where: { expertId_date: { expertId: expert.id, date: req.params.date } },
    });
    res.json(record?.slots ?? null);
  } catch (err) {
    next(err);
  }
});

// PUT /api/experts/my-availability/:date  — save own per-date time slots
router.put('/my-availability/:date', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const data = req.body; // { dayAvailable, slots }
    await prisma.availability.upsert({
      where: { expertId_date: { expertId: expert.id, date: req.params.date } },
      create: { expertId: expert.id, date: req.params.date, slots: data },
      update: { slots: data },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
