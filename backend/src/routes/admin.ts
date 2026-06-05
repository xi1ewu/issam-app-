import { Router, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate, requireRole } from '../middleware/auth';
import { getPaymentConfig, setConfig } from '../config/platformConfig';
import { AuthRequest } from '../types';

const router = Router();

// All admin routes require AUTH + ADMIN role
router.use(authenticate, requireRole('ADMIN'));

// ─── GET /api/admin/analytics ─────────────────────────────────────────────
// Full platform analytics: GMV, revenue, active experts, churn, completion rate,
// disputes, subscription conversions, and monthly trend data.
router.get('/analytics', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const now         = new Date();
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo    = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo     = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersThisMonth,
      newUsersLastMonth,
      totalExperts,
      activeExpertsThisMonth,
      totalConsultations,
      completedConsultations,
      cancelledConsultations,
      allPayments,
      thisMonthPayments,
      lastMonthPayments,
      activeSubscriptions,
      thisMonthSubs,
      lastMonthSubs,
      usersWithSub,
      // Monthly trend (last 6 months) - compute via raw queries
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.expert.count(),
      prisma.consultation.groupBy({
        by: ['expertId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.consultation.count(),
      prisma.consultation.count({ where: { status: 'COMPLETED' } }),
      prisma.consultation.count({ where: { status: 'CANCELLED' } }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED' },
        select: { amount: true, platformFee: true, createdAt: true },
      }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        select: { amount: true, platformFee: true },
      }),
      prisma.payment.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        select: { amount: true, platformFee: true },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', createdAt: { gte: startOfMonth } } }),
      prisma.subscription.count({ where: { status: 'ACTIVE', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.subscription.groupBy({ by: ['userId'], where: { status: 'ACTIVE' } }),
    ]);

    // GMV = total transaction volume (consultation payments)
    const totalGMV         = allPayments.reduce((s, p) => s + p.amount, 0);
    const thisMonthGMV     = thisMonthPayments.reduce((s, p) => s + p.amount, 0);
    const lastMonthGMV     = lastMonthPayments.reduce((s, p) => s + p.amount, 0);

    // Platform revenue = sum of platformFee
    const totalRevenue     = allPayments.reduce((s, p) => s + p.platformFee, 0);
    const thisMonthRevenue = thisMonthPayments.reduce((s, p) => s + p.platformFee, 0);
    const lastMonthRevenue = lastMonthPayments.reduce((s, p) => s + p.platformFee, 0);

    const gmvGrowth     = lastMonthGMV > 0     ? Math.round(((thisMonthGMV - lastMonthGMV) / lastMonthGMV) * 1000) / 10         : thisMonthGMV > 0 ? 100 : 0;
    const revenueGrowth = lastMonthRevenue > 0 ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10 : thisMonthRevenue > 0 ? 100 : 0;
    const userGrowth    = newUsersLastMonth > 0 ? Math.round(((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 1000) / 10 : newUsersThisMonth > 0 ? 100 : 0;
    const subGrowth     = lastMonthSubs > 0    ? Math.round(((thisMonthSubs - lastMonthSubs) / lastMonthSubs) * 1000) / 10             : thisMonthSubs > 0 ? 100 : 0;

    // Consultation completion rate
    const completionRate  = totalConsultations > 0 ? Math.round((completedConsultations / totalConsultations) * 1000) / 10 : 0;

    // Churn rate: users with no consultations in last 30 days out of all users
    const activeUserIds = await prisma.consultation.groupBy({
      by: ['clientId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    const activeUserCount = activeUserIds.length;
    const churnRate = totalUsers > 0 ? Math.round(((totalUsers - activeUserCount) / totalUsers) * 1000) / 10 : 0;

    // Subscription conversion rate (users with active sub / total users)
    const subConversionRate = totalUsers > 0 ? Math.round((usersWithSub.length / totalUsers) * 1000) / 10 : 0;

    // Disputes: cancelled consultations that had a completed payment (proxy for dispute)
    const disputes = await prisma.consultation.count({
      where: {
        status: 'CANCELLED',
        payment: { status: 'COMPLETED' },
      },
    });

    // Monthly GMV trend (last 6 months)
    const monthlyTrend = await buildMonthlyTrend();

    // Top experts by revenue
    const topExperts = await prisma.expert.findMany({
      take: 5,
      select: {
        id: true,
        user: { select: { name: true, avatar: true } },
        rating: true,
        reviewCount: true,
        consultations: {
          where: { payment: { status: 'COMPLETED' } },
          select: { payment: { select: { amount: true } } },
        },
      },
      orderBy: { rating: 'desc' },
    });

    const topExpertsFormatted = topExperts.map(e => ({
      id: e.id,
      name: e.user?.name ?? 'Unknown',
      avatar: e.user?.avatar,
      rating: e.rating,
      reviewCount: e.reviewCount,
      revenue: e.consultations.reduce((s, c) => s + (c.payment?.amount ?? 0), 0),
    }));

    res.json({
      gmv: { total: totalGMV, thisMonth: thisMonthGMV, lastMonth: lastMonthGMV, growth: gmvGrowth },
      revenue: { total: totalRevenue, thisMonth: thisMonthRevenue, lastMonth: lastMonthRevenue, growth: revenueGrowth },
      users: { total: totalUsers, newThisMonth: newUsersThisMonth, growth: userGrowth },
      experts: { total: totalExperts, activeThisMonth: activeExpertsThisMonth.length },
      consultations: { total: totalConsultations, completed: completedConsultations, cancelled: cancelledConsultations },
      completionRate,
      churnRate,
      disputes,
      subscriptions: { active: activeSubscriptions, newThisMonth: thisMonthSubs, growth: subGrowth },
      subConversionRate,
      monthlyTrend,
      topExperts: topExpertsFormatted,
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────
router.get('/users', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search, role } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: any = {
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
      ...(role ? { role: role.toUpperCase() } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, role: true, avatar: true, isBanned: true, bannedReason: true, createdAt: true, expert: { select: { rating: true, isVerified: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.user.count({ where }),
    ]);
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/admin/consultations ─────────────────────────────────────────
router.get('/consultations', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const consultations = await prisma.consultation.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, date: true, time: true, status: true, type: true, price: true, topic: true,
        client: { select: { name: true } },
        expert: { select: { user: { select: { name: true } } } },
        payment: { select: { status: true, amount: true } },
      },
    });
    res.json(consultations);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/users/:id/ban ────────────────────────────────────────
router.put('/users/:id/ban', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body as { reason?: string };
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        isBanned: true,
        bannedReason: reason ?? 'Violated platform terms of service',
        bannedAt: new Date(),
      },
      select: { id: true, name: true, email: true, isBanned: true, bannedReason: true },
    });

    // Invalidate all refresh tokens so they're kicked out immediately
    await prisma.refreshToken.deleteMany({ where: { userId: req.params.id } });

    // Create in-app notification
    await prisma.notification.create({
      data: {
        userId: req.params.id,
        title: 'Account Suspended',
        message: reason ?? 'Your account has been suspended for violating our terms of service. Contact support to appeal.',
        type: 'BAN',
      },
    }).catch(() => {});

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/users/:id/unban ──────────────────────────────────────
router.put('/users/:id/unban', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBanned: false, bannedReason: null, bannedAt: null },
      select: { id: true, name: true, email: true, isBanned: true },
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/experts/:id/verify ───────────────────────────────────
router.put('/experts/:id/verify', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const expert = await prisma.expert.update({
      where: { id: req.params.id },
      data: { isVerified: req.body.verified ?? true },
    });
    res.json(expert);
  } catch (err) {
    next(err);
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function buildMonthlyTrend() {
  const months: { label: string; gmv: number; revenue: number; users: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const [payments, newUsers] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: start, lte: end } },
        select: { amount: true, platformFee: true },
      }),
      prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
    ]);

    months.push({
      label: start.toLocaleDateString('en', { month: 'short', year: '2-digit' }),
      gmv: payments.reduce((s, p) => s + p.amount, 0),
      revenue: payments.reduce((s, p) => s + p.platformFee, 0),
      users: newUsers,
    });
  }
  return months;
}

// ─── GET /api/admin/payment-config ───────────────────────────────────────────
router.get('/payment-config', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cfg = await getPaymentConfig();

    // Mask secrets — send only prefix + suffix so the UI can show "configured"
    function mask(v: string) {
      if (!v) return '';
      if (v.length <= 8) return '••••••••';
      return v.slice(0, 6) + '••••••••' + v.slice(-4);
    }

    res.json({
      paypal: {
        clientId:     mask(cfg.PAYPAL_CLIENT_ID),
        clientSecret: mask(cfg.PAYPAL_CLIENT_SECRET),
        mode:         cfg.PAYPAL_ENV || 'sandbox',
        isConfigured: !!(cfg.PAYPAL_CLIENT_ID && cfg.PAYPAL_CLIENT_SECRET),
      },
      chargily: {
        apiKey:       mask(cfg.CHARGILY_API_KEY),
        publicKey:    mask(cfg.CHARGILY_PUBLIC_KEY),
        mode:         cfg.CHARGILY_MODE || 'test',
        isConfigured: !!(cfg.CHARGILY_API_KEY),
      },
      dzdRate: cfg.USD_TO_DZD_RATE || '135',
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/admin/payment-config ───────────────────────────────────────────
// Only non-empty fields are written so partial updates don't clear existing keys.
router.put('/payment-config', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      paypal_client_id, paypal_client_secret, paypal_mode,
      chargily_api_key, chargily_public_key, chargily_mode,
      dzd_rate,
    } = req.body as Record<string, string>;

    const writes: [string, string][] = [
      ['PAYPAL_CLIENT_ID',     paypal_client_id],
      ['PAYPAL_CLIENT_SECRET', paypal_client_secret],
      ['PAYPAL_ENV',           paypal_mode],
      ['CHARGILY_API_KEY',     chargily_api_key],
      ['CHARGILY_PUBLIC_KEY',  chargily_public_key],
      ['CHARGILY_MODE',        chargily_mode],
      ['USD_TO_DZD_RATE',      dzd_rate],
    ];

    for (const [key, value] of writes) {
      if (value !== undefined && value !== null && value !== '') {
        await setConfig(key, value.trim());
      }
    }

    res.json({ saved: true });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/admin/payment-config/test ─────────────────────────────────────
// Ping PayPal and Chargily APIs to confirm credentials work.
router.post('/payment-config/test', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cfg = await getPaymentConfig();
    const results: Record<string, any> = {};

    // ── Test PayPal ──────────────────────────────────────────────────────────
    if (cfg.PAYPAL_CLIENT_ID && cfg.PAYPAL_CLIENT_SECRET) {
      try {
        const base = cfg.PAYPAL_ENV === 'live'
          ? 'https://api-m.paypal.com'
          : 'https://api-m.sandbox.paypal.com';
        const credentials = Buffer.from(`${cfg.PAYPAL_CLIENT_ID}:${cfg.PAYPAL_CLIENT_SECRET}`).toString('base64');
        const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
          method:  'POST',
          headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    'grant_type=client_credentials',
        });
        results.paypal = {
          ok:      tokenRes.ok,
          status:  tokenRes.status,
          message: tokenRes.ok ? 'Connected successfully' : `HTTP ${tokenRes.status}`,
        };
      } catch (e: any) {
        results.paypal = { ok: false, message: e.message };
      }
    } else {
      results.paypal = { ok: false, message: 'Credentials not configured' };
    }

    // ── Test Chargily ────────────────────────────────────────────────────────
    if (cfg.CHARGILY_API_KEY) {
      try {
        const base = cfg.CHARGILY_MODE === 'live'
          ? 'https://pay.chargily.net/api/v2'
          : 'https://pay.chargily.net/test/api/v2';
        const balanceRes = await fetch(`${base}/balance`, {
          headers: {
            Authorization: `Bearer ${cfg.CHARGILY_API_KEY}`,
            Accept: 'application/json',
          },
        });
        const body = await balanceRes.json().catch(() => ({})) as any;
        results.chargily = {
          ok:      balanceRes.ok,
          status:  balanceRes.status,
          message: balanceRes.ok
            ? `Connected — balance: ${body?.balance ?? '—'} DZD`
            : body?.message || `HTTP ${balanceRes.status}`,
        };
      } catch (e: any) {
        results.chargily = { ok: false, message: e.message };
      }
    } else {
      results.chargily = { ok: false, message: 'API key not configured' };
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

export default router;
