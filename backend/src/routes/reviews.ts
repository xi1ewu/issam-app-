import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { notify } from '../config/notify';
import { AuthRequest } from '../types';

const router = Router();

const createReviewSchema = z.object({
  consultationId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10),
});

// GET /api/reviews/expert/:expertId
router.get('/expert/:expertId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { expertId: req.params.expertId },
      include: {
        author: { select: { name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

// POST /api/reviews
router.post('/', authenticate, validate(createReviewSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { consultationId, rating, comment } = req.body;

    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: { expert: true },
    });
    if (!consultation) return next(createError('Consultation not found', 404));
    if (consultation.clientId !== req.user!.userId) return next(createError('Forbidden', 403));
    if (consultation.status !== 'COMPLETED') return next(createError('Can only review completed consultations', 400));

    const existing = await prisma.review.findUnique({ where: { consultationId } });
    if (existing) return next(createError('Already reviewed', 409));

    const review = await prisma.review.create({
      data: {
        consultationId,
        authorId: req.user!.userId,
        expertId: consultation.expertId,
        rating,
        comment,
      },
      include: { author: { select: { name: true, avatar: true } } },
    });

    const allReviews = await prisma.review.aggregate({
      where: { expertId: consultation.expertId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.expert.update({
      where: { id: consultation.expertId },
      data: {
        rating: Math.round((allReviews._avg.rating ?? 0) * 10) / 10,
        reviewCount: allReviews._count.id,
      },
    });

    // Notify expert about their new review
    notify({
      userId:       consultation.expert.userId,
      type:         'REVIEW_NEW',
      title:        `New ${rating}★ Review`,
      message:      `${review.author.name} left you a review: "${comment.slice(0, 80)}${comment.length > 80 ? '…' : ''}"`,
      data:         { expertId: consultation.expertId, reviewId: review.id },
      senderName:   review.author.name   ?? undefined,
      senderAvatar: review.author.avatar ?? undefined,
    });

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
});

export default router;
