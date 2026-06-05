import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

const serviceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().min(0),
  rate: z.number().min(0),
  amount: z.number().min(0),
});

const createInvoiceSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional().or(z.literal('')),
  services: z.array(serviceLineSchema).min(1),
  tax: z.number().min(0).default(0),
  currency: z.string().default('USD'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `INV-${year}${month}-${rand}`;
}

// GET /api/invoices
router.get('/', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const invoices = await prisma.invoice.findMany({
      where: { expertId: expert.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});

// POST /api/invoices
router.post('/', authenticate, requireRole('EXPERT'), validate(createInvoiceSchema), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const { clientName, clientEmail, services, tax, currency, dueDate, notes } = req.body;
    const subtotal: number = (services as any[]).reduce((sum: number, s: any) => sum + s.amount, 0);
    const total = subtotal + (tax ?? 0);

    let invoiceNumber = generateInvoiceNumber();
    // ensure uniqueness
    let exists = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    while (exists) {
      invoiceNumber = generateInvoiceNumber();
      exists = await prisma.invoice.findUnique({ where: { invoiceNumber } });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        expertId: expert.id,
        clientName,
        clientEmail: clientEmail || null,
        services,
        subtotal,
        tax: tax ?? 0,
        total,
        currency: currency ?? 'USD',
        dueDate: dueDate || null,
        notes: notes || null,
      },
    });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/invoices/:id/status
router.patch('/:id/status', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const { status } = req.body;
    if (!['DRAFT', 'SENT', 'PAID', 'OVERDUE'].includes(status)) {
      return next(createError('Invalid status', 400));
    }

    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, expertId: expert.id } });
    if (!invoice) return next(createError('Invoice not found', 404));

    const updated = await prisma.invoice.update({ where: { id: req.params.id }, data: { status } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', authenticate, requireRole('EXPERT'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.findUnique({ where: { userId: req.user!.userId } });
    if (!expert) return next(createError('Expert profile not found', 404));

    const invoice = await prisma.invoice.findFirst({ where: { id: req.params.id, expertId: expert.id } });
    if (!invoice) return next(createError('Invoice not found', 404));

    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
