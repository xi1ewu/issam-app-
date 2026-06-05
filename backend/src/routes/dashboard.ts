import { Router, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const [totalConsultations, reportsTotal, expertsConnected, activeSubscription, experts, clientReviews] = await Promise.all([
      prisma.consultation.count({ where: { clientId: userId } }),
      prisma.report.count(),
      prisma.consultation.groupBy({
        by: ['expertId'],
        where: { clientId: userId },
        _count: true,
      }),
      prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
        include: { plan: true },
      }),
      prisma.expert.findMany({
        take: 6,
        orderBy: { rating: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          expertise: true,
          hourlyRate: true,
          rating: true,
          reviewCount: true,
          isVerified: true,
          isAvailable: true,
          yearsExp: true,
          user: { select: { id: true, name: true, avatar: true } },
        },
      }),
      prisma.review.findMany({
        where: { authorId: userId },
        select: { rating: true },
      }),
    ]);

    const completedConsultations = await prisma.consultation.findMany({
      where: { clientId: userId, status: 'COMPLETED' },
      select: { duration: true },
    });
    const hoursConsulted = Math.round(completedConsultations.reduce((acc, c) => acc + c.duration, 0) / 60);
    const avgRating = clientReviews.length > 0
      ? Math.round(clientReviews.reduce((sum, r) => sum + r.rating, 0) / clientReviews.length * 10) / 10
      : 0;

    res.json({
      totalConsultations,
      hoursConsulted,
      reportsRead: reportsTotal,
      expertsConnected: expertsConnected.length,
      avgRating,
      progressPercent: Math.min(Math.round((totalConsultations / 10) * 100), 100),
      weeklyGoal: '10 consultations / month',
      activeSubscription,
      featuredExperts: experts,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/featured-experts
router.get('/featured-experts', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const experts = await prisma.expert.findMany({
      take: 6,
      where: { isAvailable: true },
      orderBy: { rating: 'desc' },
      select: {
        id: true,
        title: true,
        category: true,
        expertise: true,
        hourlyRate: true,
        rating: true,
        reviewCount: true,
        isVerified: true,
        isAvailable: true,
        yearsExp: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    });
    res.json(experts);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/expert-stats
router.get('/expert-stats', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const expert = await prisma.expert.findUnique({ where: { userId } });

    if (!expert) {
      return res.status(404).json({ error: 'Expert profile not found' });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [
      allPayments,
      thisMonthPayments,
      lastMonthPayments,
      clients,
      newClientsThisMonth,
      newClientsLastMonth,
      nextSessionData,
      reviews,
      recentConsultations,
    ] = await Promise.all([
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED' },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        select: { amount: true },
      }),
      prisma.consultation.groupBy({
        by: ['clientId'],
        where: { expertId: expert.id },
      }),
      prisma.consultation.groupBy({
        by: ['clientId'],
        where: { expertId: expert.id, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.consultation.groupBy({
        by: ['clientId'],
        where: { expertId: expert.id, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      prisma.consultation.findFirst({
        where: { expertId: expert.id, status: { in: ['UPCOMING', 'AWAITING_CONFIRMATION'] }, date: { gte: now.toISOString().split('T')[0] } },
        orderBy: { date: 'asc' },
        select: { date: true, time: true, client: { select: { name: true } } },
      }),
      prisma.review.findMany({
        where: { expertId: expert.id },
        orderBy: { createdAt: 'desc' },
        take: 3,
        include: { author: true },
      }),
      prisma.consultation.findMany({
        where: { expertId: expert.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { client: true },
      }),
    ]);

    const totalEarnings = allPayments.reduce((sum, p) => sum + p.amount, 0);
    const thisMonthEarnings = thisMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const lastMonthEarnings = lastMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const earningsGrowth = lastMonthEarnings > 0
      ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 1000) / 10
      : thisMonthEarnings > 0 ? 100 : 0;

    const newClientsCount = newClientsThisMonth.length;
    const prevNewClientsCount = newClientsLastMonth.length;
    const clientsGrowth = prevNewClientsCount > 0
      ? Math.round(((newClientsCount - prevNewClientsCount) / prevNewClientsCount) * 1000) / 10
      : newClientsCount;

    const activities = [
      ...recentConsultations.map(c => ({
        id: `c_${c.id}`,
        type: c.status === 'COMPLETED' ? 'COMPLETED' : 'INQUIRY',
        title: c.status === 'COMPLETED' ? 'Session Completed:' : 'New Client Inquiry',
        subtitle: c.client?.name || 'Client',
        desc: c.status === 'COMPLETED' ? `${c.type} • ${c.duration}m duration` : 'Requested a consultation.',
        date: c.updatedAt,
      })),
      ...reviews.map(r => ({
        id: `r_${r.id}`,
        type: 'REVIEW',
        title: 'New 5-Star Review',
        subtitle: `"${r.comment.slice(0, 40)}..."`,
        desc: `From ${r.author?.name || 'Client'}`,
        date: r.createdAt,
      })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

    res.json({
      totalEarnings,
      thisMonthEarnings,
      earningsGrowth,
      activeClients: clients.length,
      newClientsCount,
      clientsGrowth,
      nextSession: nextSessionData
        ? { time: nextSessionData.time, date: nextSessionData.date, clientName: nextSessionData.client?.name }
        : null,
      avgRating: expert.rating,
      reviewCount: expert.reviewCount,
      activities,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/expert-analytics
router.get('/expert-analytics', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const expert = await prisma.expert.findUnique({ where: { userId } });
    if (!expert) return res.status(404).json({ error: 'Expert profile not found' });

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo  = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startOfMonth     = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const [
      totalViews,
      recentViews,
      prevViews,
      allConsultations,
      recentBookings,
      prevBookings,
      thisMonthPayments,
      lastMonthPayments,
      prevMonthPayments,
    ] = await Promise.all([
      prisma.profileView.count({ where: { expertId: expert.id } }),
      prisma.profileView.count({ where: { expertId: expert.id, viewedAt: { gte: thirtyDaysAgo } } }),
      prisma.profileView.count({ where: { expertId: expert.id, viewedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.consultation.findMany({
        where: { expertId: expert.id },
        select: { topic: true, type: true, clientId: true, status: true, createdAt: true },
      }),
      prisma.consultation.count({ where: { expertId: expert.id, createdAt: { gte: thirtyDaysAgo } } }),
      prisma.consultation.count({ where: { expertId: expert.id, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED', createdAt: { gte: startOfMonth } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: { consultation: { expertId: expert.id }, status: 'COMPLETED', createdAt: { gte: startOfPrevMonth, lt: startOfLastMonth } },
        select: { amount: true },
      }),
    ]);

    // Booking conversion rate (bookings in last 30 days / views in last 30 days)
    const bookingConversionRate = recentViews > 0
      ? Math.round((recentBookings / recentViews) * 1000) / 10
      : 0;

    // Repeat clients (clients with more than 1 consultation)
    const clientCounts: Record<string, number> = {};
    allConsultations.forEach(c => {
      clientCounts[c.clientId] = (clientCounts[c.clientId] ?? 0) + 1;
    });
    const totalClients  = Object.keys(clientCounts).length;
    const repeatClients = Object.values(clientCounts).filter(n => n > 1).length;

    // Top consultation categories by topic keyword
    const topicCounts: Record<string, number> = {};
    allConsultations.forEach(c => {
      const key = c.topic.split(' ').slice(0, 3).join(' ');
      topicCounts[key] = (topicCounts[key] ?? 0) + 1;
    });
    const topCategories = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic, count]) => ({ topic, count }));

    // Earnings
    const thisMonthEarnings = thisMonthPayments.reduce((s, p) => s + p.amount, 0);
    const lastMonthEarnings = lastMonthPayments.reduce((s, p) => s + p.amount, 0);
    const prevMonthEarnings = prevMonthPayments.reduce((s, p) => s + p.amount, 0);

    const earningsGrowth = lastMonthEarnings > 0
      ? Math.round(((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings) * 1000) / 10
      : thisMonthEarnings > 0 ? 100 : 0;

    const lastMonthGrowth = prevMonthEarnings > 0
      ? Math.round(((lastMonthEarnings - prevMonthEarnings) / prevMonthEarnings) * 1000) / 10
      : lastMonthEarnings > 0 ? 100 : 0;

    // Views trend (last 30d vs previous 30d)
    const viewsTrend = prevViews > 0
      ? Math.round(((recentViews - prevViews) / prevViews) * 1000) / 10
      : recentViews > 0 ? 100 : 0;

    // Bookings trend
    const bookingsTrend = prevBookings > 0
      ? Math.round(((recentBookings - prevBookings) / prevBookings) * 1000) / 10
      : recentBookings > 0 ? 100 : 0;

    res.json({
      profileViews: { total: totalViews, last30Days: recentViews, trend: viewsTrend },
      bookingConversionRate,
      bookings: { last30Days: recentBookings, trend: bookingsTrend },
      repeatClients,
      totalClients,
      topCategories,
      earnings: {
        thisMonth: thisMonthEarnings,
        lastMonth: lastMonthEarnings,
        growth: earningsGrowth,
        lastMonthGrowth,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
