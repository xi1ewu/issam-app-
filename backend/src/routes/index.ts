import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import expertRoutes from './experts';
import consultationRoutes from './consultations';
import messageRoutes from './messages';
import reportRoutes from './reports';
import reviewRoutes from './reviews';
import paymentRoutes from './payments';
import paypalRoutes from './paypal';
import chargilyRoutes from './chargily';
import subscriptionRoutes from './subscriptions';
import dashboardRoutes from './dashboard';
import notificationRoutes from './notifications';
import adminRoutes from './admin';
import phoneRoutes from './phone';
import invoiceRoutes from './invoices';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date() }));

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/experts', expertRoutes);
router.use('/consultations', consultationRoutes);
router.use('/', messageRoutes);
router.use('/reports', reportRoutes);
router.use('/reviews', reviewRoutes);
router.use('/payments', paymentRoutes);
router.use('/payments/paypal', paypalRoutes);
router.use('/payments/chargily', chargilyRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/phone', phoneRoutes);
router.use('/invoices', invoiceRoutes);

export default router;
