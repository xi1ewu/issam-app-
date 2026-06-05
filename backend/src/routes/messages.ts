import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { uploadFile } from '../config/cloudinary';
import { AuthRequest } from '../types';

const router = Router();

const sendMessageSchema = z.object({
  content: z.string().min(1),
  type: z.enum(['TEXT', 'FILE', 'IMAGE']).default('TEXT'),
});

// GET /api/conversations
router.get('/conversations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: req.user!.userId } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, avatar: true, role: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations  (start or get existing)
router.post('/conversations', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { participantId } = req.body;
    if (!participantId) return next(createError('participantId required', 400));

    const userId = req.user!.userId;

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: participantId } } },
        ],
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });

    if (existing) return res.json(existing);

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [{ userId }, { userId: participantId }],
        },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
        },
      },
    });
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages
router.get('/conversations/:id/messages', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '50' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: req.user!.userId },
    });
    if (!isMember) return next(createError('Forbidden', 403));

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
      orderBy: { createdAt: 'asc' },
      skip,
      take: parseInt(limit),
    });

    await prisma.message.updateMany({
      where: { conversationId: req.params.id, senderId: { not: req.user!.userId }, isRead: false },
      data: { isRead: true },
    });

    res.json(messages);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages
router.post('/conversations/:id/messages', authenticate, validate(sendMessageSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: req.user!.userId },
    });
    if (!isMember) return next(createError('Forbidden', 403));

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user!.userId,
        content: req.body.content,
        type: req.body.type || 'TEXT',
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { lastMessage: req.body.content, lastMessageAt: new Date() },
    });

    const io = (req as any).app.locals.io;
    if (io) io.to(`conv:${req.params.id}`).emit('new_message', message);

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/upload  (send a file in chat)
router.post('/conversations/:id/upload', authenticate, uploadFile.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(createError('No file', 400));
    const isMember = await prisma.conversationParticipant.findFirst({
      where: { conversationId: req.params.id, userId: req.user!.userId },
    });
    if (!isMember) return next(createError('Forbidden', 403));

    const fileUrl = (req.file as Express.Multer.File & { path: string }).path;
    const isImage = req.file.mimetype.startsWith('image/');

    const message = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: req.user!.userId,
        content: req.file.originalname,
        type: isImage ? 'IMAGE' : 'FILE',
        fileUrl,
      },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });

    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { lastMessage: isImage ? '📷 Image' : `📎 ${req.file.originalname}`, lastMessageAt: new Date() },
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

export default router;
