import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

const createReportSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  content: z.string().min(50),
  category: z.string(),
  isPremium: z.boolean().default(false),
  readTime: z.number().int().min(1).default(5),
  thumbnail: z.string().url().optional(),
});

// GET /api/reports
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, page = '1', limit = '20', premium } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: object = {
      ...(category && category !== 'All' ? { category } : {}),
      ...(premium === 'false' ? { isPremium: false } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          author: true,
          isPremium: true,
          readTime: true,
          thumbnail: true,
          publishedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.report.count({ where }),
    ]);

    res.json({ reports, total });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return next(createError('Report not found', 404));
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// POST /api/reports  (expert or admin only)
router.post('/', authenticate, requireRole('EXPERT', 'ADMIN'), validate(createReportSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { name: true } });
    const report = await prisma.report.create({
      data: {
        ...req.body,
        author: user!.name,
        authorId: req.user!.userId,
        publishedAt: new Date().toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }),
      },
    });
    res.status(201).json(report);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id
router.delete('/:id', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.report.delete({ where: { id: _req.params.id } });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
