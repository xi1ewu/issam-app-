import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Subscription plans
  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { id: 'plan-basic' },
      update: {},
      create: {
        id: 'plan-basic',
        name: 'Basic',
        price: 0,
        period: 'monthly',
        features: ['5 expert consultations/month', 'Access to free reports', 'Community forum'],
        isPopular: false,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: 'plan-pro' },
      update: {},
      create: {
        id: 'plan-pro',
        name: 'Professional',
        price: 29,
        period: 'monthly',
        features: ['Unlimited consultations', 'All premium reports', 'Priority support', 'Video & audio calls', 'Document sharing'],
        isPopular: true,
      },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: 'plan-enterprise' },
      update: {},
      create: {
        id: 'plan-enterprise',
        name: 'Enterprise',
        price: 99,
        period: 'monthly',
        features: ['Everything in Pro', 'Dedicated account manager', 'Custom reports', 'Team access (up to 5)', 'API access', 'White-label option'],
        isPopular: false,
      },
    }),
  ]);
  console.log(`Created ${plans.length} subscription plans`);

  // Demo admin user
  const adminPw = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@da-consulting.dz' },
    update: {},
    create: {
      email: 'admin@da-consulting.dz',
      password: adminPw,
      name: 'Admin DA',
      role: 'ADMIN',
    },
  });

  // Demo client user
  const clientPw = await bcrypt.hash('client123', 12);
  const client = await prisma.user.upsert({
    where: { email: 'client@demo.dz' },
    update: {},
    create: {
      email: 'client@demo.dz',
      password: clientPw,
      name: 'Youcef Benali',
      role: 'USER',
      location: 'Algiers, Algeria',
      company: 'Startup DZ',
      avatar: 'https://i.pravatar.cc/150?img=8',
    },
  });

  // Expert users + profiles
  const expertsData = [
    {
      email: 'sarah.mansouri@da-consulting.dz',
      name: 'Sarah Mansouri',
      avatar: 'https://i.pravatar.cc/150?img=1',
      title: 'Senior Strategy Consultant',
      bio: 'Over 12 years helping Algerian companies scale from startup to enterprise. Former McKinsey consultant.',
      category: 'Strategy',
      expertise: ['Business Strategy', 'Market Entry', 'Growth Hacking', 'M&A'],
      hourlyRate: 150,
      rating: 4.9,
      reviewCount: 127,
      isVerified: true,
      yearsExp: 12,
    },
    {
      email: 'karim.berrada@da-consulting.dz',
      name: 'Karim Berrada',
      avatar: 'https://i.pravatar.cc/150?img=2',
      title: 'Financial Planning Expert',
      bio: 'Certified CFA with deep expertise in Algerian financial markets and cross-border transactions.',
      category: 'Finance',
      expertise: ['Financial Modeling', 'Investment Analysis', 'Risk Management', 'Fundraising'],
      hourlyRate: 120,
      rating: 4.8,
      reviewCount: 89,
      isVerified: true,
      yearsExp: 9,
    },
    {
      email: 'amina.hadj@da-consulting.dz',
      name: 'Amina Hadj-Ali',
      avatar: 'https://i.pravatar.cc/150?img=3',
      title: 'Corporate Legal Advisor',
      bio: 'Specializing in Algerian commercial law, intellectual property, and international business contracts.',
      category: 'Legal',
      expertise: ['Corporate Law', 'IP Protection', 'Contract Negotiation', 'Compliance'],
      hourlyRate: 180,
      rating: 4.7,
      reviewCount: 64,
      isVerified: true,
      yearsExp: 15,
    },
    {
      email: 'sofiane.ziani@da-consulting.dz',
      name: 'Sofiane Ziani',
      avatar: 'https://i.pravatar.cc/150?img=4',
      title: 'Digital Marketing Strategist',
      bio: 'Expert in MENA digital marketing. Grew brands from 0 to 1M followers across social platforms.',
      category: 'Marketing',
      expertise: ['Digital Marketing', 'SEO/SEM', 'Social Media', 'Brand Strategy', 'Content Marketing'],
      hourlyRate: 100,
      rating: 4.9,
      reviewCount: 203,
      isVerified: true,
      yearsExp: 8,
    },
    {
      email: 'meriem.bouzid@da-consulting.dz',
      name: 'Meriem Bouzid',
      avatar: 'https://i.pravatar.cc/150?img=5',
      title: 'CTO & Tech Architect',
      bio: 'Ex-Google engineer. Helps startups build scalable tech stacks and navigate cloud infrastructure.',
      category: 'Technology',
      expertise: ['Cloud Architecture', 'System Design', 'DevOps', 'AI/ML', 'Mobile Development'],
      hourlyRate: 200,
      rating: 4.8,
      reviewCount: 56,
      isVerified: true,
      yearsExp: 11,
    },
    {
      email: 'hamid.cherif@da-consulting.dz',
      name: 'Hamid Cherif',
      avatar: 'https://i.pravatar.cc/150?img=6',
      title: 'HR & Talent Acquisition Lead',
      bio: 'Built HR departments for 20+ Algerian companies. Expert in talent retention and organizational design.',
      category: 'HR',
      expertise: ['Talent Acquisition', 'Organizational Design', 'Performance Management', 'Culture Building'],
      hourlyRate: 90,
      rating: 4.6,
      reviewCount: 41,
      isVerified: false,
      yearsExp: 7,
    },
  ];

  const expertUsers = await Promise.all(
    expertsData.map(async (e) => {
      const pw = await bcrypt.hash('expert123', 12);
      const user = await prisma.user.upsert({
        where: { email: e.email },
        update: {},
        create: {
          email: e.email,
          password: pw,
          name: e.name,
          role: 'EXPERT',
          avatar: e.avatar,
          location: 'Algiers, Algeria',
        },
      });
      await prisma.expert.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          title: e.title,
          bio: e.bio,
          category: e.category,
          expertise: e.expertise,
          hourlyRate: e.hourlyRate,
          rating: e.rating,
          reviewCount: e.reviewCount,
          isVerified: e.isVerified,
          yearsExp: e.yearsExp,
        },
      });
      return user;
    })
  );
  console.log(`Created ${expertUsers.length} expert users`);

  // Sample reports
  const reportsData = [
    {
      title: 'Algeria Economic Outlook 2026',
      description: 'Comprehensive analysis of Algeria\'s economic trajectory, hydrocarbon revenues, and diversification opportunities.',
      content: 'Algeria\'s economy is projected to grow 3.8% in 2026, driven by sustained oil prices and government infrastructure spending...',
      category: 'Economy',
      author: 'DA Consulting Research Team',
      isPremium: false,
      readTime: 8,
      publishedAt: 'May 20, 2026',
    },
    {
      title: 'Digital Transformation in Algerian SMEs',
      description: 'Survey of 500 SMEs reveals adoption rates, barriers, and opportunities in digital tools.',
      content: 'The digital transformation wave is reaching Algerian small and medium enterprises, with 67% now using cloud solutions...',
      category: 'Technology',
      author: 'Sarah Mansouri',
      isPremium: false,
      readTime: 6,
      publishedAt: 'May 15, 2026',
    },
    {
      title: 'Investment Climate in North Africa 2026',
      description: 'Premium analysis of FDI flows, regulatory changes, and sector opportunities across North Africa.',
      content: 'Foreign direct investment into North Africa reached $18.4 billion in 2025, with Algeria attracting record inflows...',
      category: 'Finance',
      author: 'Karim Berrada',
      isPremium: true,
      readTime: 12,
      publishedAt: 'May 10, 2026',
    },
    {
      title: 'New Commercial Law Reforms 2026',
      description: 'Guide to the latest Algerian commercial code amendments and their impact on businesses.',
      content: 'The 2026 commercial law amendments introduce significant changes to company formation, foreign ownership rules...',
      category: 'Legal',
      author: 'Amina Hadj-Ali',
      isPremium: true,
      readTime: 10,
      publishedAt: 'May 5, 2026',
    },
    {
      title: 'E-commerce in Algeria: Market Report',
      description: 'State of the Algerian e-commerce market, top platforms, consumer behavior and growth forecasts.',
      content: 'Algeria\'s e-commerce market surpassed $2.1 billion in GMV in 2025, growing 45% year-over-year...',
      category: 'Marketing',
      author: 'Sofiane Ziani',
      isPremium: false,
      readTime: 7,
      publishedAt: 'Apr 28, 2026',
    },
  ];

  await Promise.all(
    reportsData.map(r =>
      prisma.report.create({ data: r })
    )
  );
  console.log(`Created ${reportsData.length} reports`);

  // Sample consultation
  const firstExpert = await prisma.expert.findFirst({ where: { category: 'Strategy' } });
  if (firstExpert) {
    await prisma.consultation.create({
      data: {
        clientId: client.id,
        expertId: firstExpert.id,
        date: '2026-05-28',
        time: '10:00',
        duration: 60,
        type: 'VIDEO',
        status: 'UPCOMING',
        topic: 'Market Entry Strategy for FinTech Startup',
        price: 150,
        meetingUrl: 'https://meet.jit.si/da-demo-session',
      },
    });
    console.log('Created sample consultation');
  }

  // Seed availability for all experts
  const allExperts = await prisma.expert.findMany();
  const today = new Date();
  for (const expert of allExperts) {
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const slots = [
        { id: '1', time: '09:00', isAvailable: Math.random() > 0.3 },
        { id: '2', time: '10:00', isAvailable: Math.random() > 0.3 },
        { id: '3', time: '11:00', isAvailable: Math.random() > 0.3 },
        { id: '4', time: '14:00', isAvailable: Math.random() > 0.3 },
        { id: '5', time: '15:00', isAvailable: Math.random() > 0.3 },
        { id: '6', time: '16:00', isAvailable: Math.random() > 0.3 },
        { id: '7', time: '17:00', isAvailable: Math.random() > 0.5 },
      ];
      await prisma.availability.upsert({
        where: { expertId_date: { expertId: expert.id, date: dateStr } },
        create: { expertId: expert.id, date: dateStr, slots },
        update: {},
      });
    }
  }
  console.log('Created availability slots');

  console.log('\nSeed complete! Demo credentials:');
  console.log('  Client:  client@demo.dz / client123');
  console.log('  Expert:  sarah.mansouri@da-consulting.dz / expert123');
  console.log('  Admin:   admin@da-consulting.dz / admin123');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
