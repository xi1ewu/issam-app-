import { prisma } from './database';

const PLANS = [
  {
    slug: 'free',
    name: 'Free',
    price: 0,
    priceYearly: 0,
    period: 'monthly',
    isPopular: false,
    features: [
      '5 market reports / month',
      'Basic expert directory',
      'Community forum access',
      'Email support',
    ],
  },
  {
    slug: 'pro',
    name: 'Professional',
    price: 4500,      // DZD / month
    priceYearly: 43200, // DZD / year (≈ 20% saving vs 12×4500=54000)
    period: 'monthly',
    isPopular: true,
    features: [
      'Unlimited market reports',
      'Full expert directory + booking',
      '1 free expert session / month',
      'PDF & Excel export',
      'Priority support (24 h)',
      'Advanced data visualisation',
      'Early access to new features',
    ],
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    price: 0,         // custom pricing — handled offline
    priceYearly: 0,
    period: 'monthly',
    isPopular: false,
    features: [
      'Everything in Professional',
      'Up to 20 team members',
      'Custom API integration',
      'Dedicated account manager',
      'Custom report generation',
      'SLA guarantee',
      'On-site training available',
    ],
  },
];

/**
 * Upsert canonical plans into the database.
 * Safe to run on every startup — only writes when the data is missing or stale.
 */
export async function seedSubscriptionPlans(): Promise<void> {
  for (const plan of PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { id: await getOrFallbackId(plan.slug) },
      update: {
        name:         plan.name,
        slug:         plan.slug,
        price:        plan.price,
        priceYearly:  plan.priceYearly,
        period:       plan.period,
        isPopular:    plan.isPopular,
        features:     plan.features,
      },
      create: {
        name:         plan.name,
        slug:         plan.slug,
        price:        plan.price,
        priceYearly:  plan.priceYearly,
        period:       plan.period,
        isPopular:    plan.isPopular,
        features:     plan.features,
      },
    });
  }
}

// Return the existing DB id for a slug, or a stub id that forces create
async function getOrFallbackId(slug: string): Promise<string> {
  const existing = await prisma.subscriptionPlan.findFirst({ where: { slug } });
  return existing?.id ?? `__nonexistent_${slug}__`;
}
