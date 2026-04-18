import type { Country } from '@/core/types';

export const COUNTRIES: Country[] = [
  { code:'IN', name:'India',          dial:'+91', currency:'INR', flag:'🇮🇳', digits:10 },
  { code:'US', name:'United States',  dial:'+1',  currency:'USD', flag:'🇺🇸', digits:10 },
  { code:'GB', name:'United Kingdom', dial:'+44', currency:'GBP', flag:'🇬🇧', digits:10 },
  { code:'AE', name:'UAE',            dial:'+971',currency:'AED', flag:'🇦🇪', digits:9  },
  { code:'SA', name:'Saudi Arabia',   dial:'+966',currency:'SAR', flag:'🇸🇦', digits:9  },
  { code:'SG', name:'Singapore',      dial:'+65', currency:'SGD', flag:'🇸🇬', digits:8  },
  { code:'AU', name:'Australia',      dial:'+61', currency:'AUD', flag:'🇦🇺', digits:9  },
  { code:'CA', name:'Canada',         dial:'+1',  currency:'CAD', flag:'🇨🇦', digits:10 },
  { code:'NP', name:'Nepal',          dial:'+977',currency:'NPR', flag:'🇳🇵', digits:10 },
  { code:'BD', name:'Bangladesh',     dial:'+880',currency:'BDT', flag:'🇧🇩', digits:10 },
  { code:'PK', name:'Pakistan',       dial:'+92', currency:'PKR', flag:'🇵🇰', digits:10 },
  { code:'LK', name:'Sri Lanka',      dial:'+94', currency:'LKR', flag:'🇱🇰', digits:9  },
];

export function getCountry(code: string): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES[0];
}

export function formatCurrency(amount: number, countryCode: string): string {
  const c = getCountry(countryCode);
  return new Intl.NumberFormat('en-IN', { style:'currency', currency: c.currency, maximumFractionDigits:0 }).format(amount);
}
