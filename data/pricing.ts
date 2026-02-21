import { PricingPlan } from '@/types';

export const pricingPlans: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    rdmAmount: 0,
    features: [
      '100 RDM on signup',
      'Earn RDM through correct answers',
      'Basic question access',
      'Revision Bank (limited)',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '₹199/mo',
    rdmAmount: 500,
    features: [
      '500 RDM monthly top-up',
      'Past Papers access',
      'Full Revision Bank',
      'Subject-wise filtering',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '₹499/mo',
    rdmAmount: 2000,
    features: [
      'Unlimited RDM',
      'Mock Tests',
      'Adaptive Tests',
      'All Basic features',
      'Performance analytics',
    ],
    recommended: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹999/mo',
    rdmAmount: 5000,
    features: [
      'Everything in Pro',
      'FITRICE Framework',
      'Priority support',
      'Personalized learning path',
      'Offline access',
    ],
  },
];
