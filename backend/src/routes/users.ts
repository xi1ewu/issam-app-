import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { uploadAvatar } from '../config/cloudinary';
import { AuthRequest } from '../types';

const router = Router();

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  company: z.string().optional(),
  bio: z.string().optional(),
});

// GET /api/users/profile
router.get('/profile', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        location: true,
        company: true,
        bio: true,
        createdAt: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!user) return next(createError('User not found', 404));
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile
router.put('/profile', authenticate, validate(updateProfileSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: req.body,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        phone: true,
        location: true,
        company: true,
        bio: true,
      },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/avatar
router.post('/avatar', authenticate, uploadAvatar.single('avatar'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(createError('No file uploaded', 400));
    const avatarUrl = (req.file as Express.Multer.File & { path: string }).path;
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/users/push-token  — register Expo push token
router.post('/push-token', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return next(createError('Invalid push token', 400));
    }
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { expoPushToken: token },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/push-token  — deregister on logout
router.delete('/push-token', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { expoPushToken: null },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
