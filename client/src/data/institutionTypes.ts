import type { InstTypeConfig } from '@/core/types';

export const TYPES: Record<string, InstTypeConfig> = {
  // ── EDUCATION ──────────────────────────────────────────────
  school: { icon:'🏫', label:'School', color:'#4f8eff', cat:'education',
    member:'Student', members:'Students', plan:'Class',
    plans:['Nursery / KG','Class 1-5','Class 6-8','Class 9-10','Class 11-12'],
    fees:[500,800,1000,1200,1500],
    rTitle:'School Fee Receipt' },

  coaching: { icon:'📚', label:'Coaching / Tuition', color:'#7c5cfc', cat:'education',
    member:'Student', members:'Students', plan:'Batch',
    plans:['Morning Batch','Evening Batch','Weekend Batch','Online Batch'],
    fees:[1000,1000,800,600],
    rTitle:'Coaching Fee Receipt' },

  college: { icon:'🎓', label:'College / University', color:'#2dd4a0', cat:'education',
    member:'Student', members:'Students', plan:'Semester',
    plans:['Semester 1','Semester 2','Annual','Course Fee'],
    fees:[15000,15000,25000,50000],
    rTitle:'College Fee Receipt' },

  skilllearn: { icon:'💡', label:'Skill / Vocational', color:'#ffc542', cat:'education',
    member:'Learner', members:'Learners', plan:'Course',
    plans:['Short Course','Diploma','Certificate','Advanced'],
    fees:[2000,5000,3500,8000],
    rTitle:'Course Fee Receipt' },

  // ── SPORTS & FITNESS ───────────────────────────────────────
  gym: { icon:'🏋️', label:'Gym / Fitness', color:'#ff7043', cat:'sports',
    member:'Member', members:'Members', plan:'Plan',
    plans:['Monthly','Quarterly','Half-Yearly','Yearly'],
    fees:[700,1800,3200,5500],
    rTitle:'Gym Membership Receipt' },

  swimming: { icon:'🏊', label:'Swimming', color:'#00bcd4', cat:'sports',
    member:'Member', members:'Members', plan:'Plan',
    plans:['Monthly','Quarterly','Half-Yearly','Yearly'],
    fees:[600,1600,2800,4800],
    rTitle:'Swimming Fee Receipt' },

  sportsacademy: { icon:'⚽', label:'Sports Academy', color:'#43a047', cat:'sports',
    member:'Player', members:'Players', plan:'Plan',
    plans:['Monthly','Quarterly','Seasonal','Annual'],
    fees:[800,2000,4000,6000],
    rTitle:'Sports Academy Fee Receipt' },

  yoga: { icon:'🧘', label:'Yoga / Meditation', color:'#9c27b0', cat:'sports',
    member:'Student', members:'Students', plan:'Plan',
    plans:['Monthly','Quarterly','Half-Yearly','Annual'],
    fees:[500,1300,2400,4000],
    rTitle:'Yoga Fee Receipt' },

  martialarts: { icon:'🥋', label:'Martial Arts', color:'#e91e63', cat:'sports',
    member:'Student', members:'Students', plan:'Belt Level',
    plans:['White Belt','Yellow Belt','Green Belt','Black Belt'],
    fees:[600,700,800,1000],
    rTitle:'Martial Arts Fee Receipt' },

  dance: { icon:'💃', label:'Dance Academy', color:'#ff4081', cat:'sports',
    member:'Student', members:'Students', plan:'Style',
    plans:['Classical','Western','Folk','Freestyle'],
    fees:[700,800,600,750],
    rTitle:'Dance Academy Fee Receipt' },

  // ── COMMUNITY & LIVING ─────────────────────────────────────
  hostel: { icon:'🏠', label:'Hostel / PG', color:'#ff9800', cat:'community',
    member:'Resident', members:'Residents', plan:'Room Type',
    plans:['Single Room','Double Sharing','Triple Sharing','Dormitory'],
    fees:[5000,3500,2500,1800],
    rTitle:'Hostel Fee Receipt' },

  club: { icon:'🤝', label:'Club / Association', color:'#607d8b', cat:'community',
    member:'Member', members:'Members', plan:'Membership',
    plans:['Basic','Silver','Gold','Platinum'],
    fees:[500,1000,2500,5000],
    rTitle:'Club Membership Receipt' },

  library: { icon:'📖', label:'Library', color:'#795548', cat:'community',
    member:'Member', members:'Members', plan:'Plan',
    plans:['Monthly','Quarterly','Half-Yearly','Annual'],
    fees:[150,400,700,1200],
    rTitle:'Library Membership Receipt' },

  society: { icon:'🏘️', label:'Housing Society', color:'#546e7a', cat:'community',
    member:'Resident', members:'Residents', plan:'Unit Type',
    plans:['1 BHK','2 BHK','3 BHK','Bungalow'],
    fees:[1000,1500,2000,3000],
    rTitle:'Society Maintenance Receipt' },

  // ── OTHER ──────────────────────────────────────────────────
  music: { icon:'🎵', label:'Music Academy', color:'#fbbf24', cat:'other',
    member:'Student', members:'Students', plan:'Course',
    plans:['Guitar','Piano','Vocals','Tabla / Drums','Violin','Flute'],
    fees:[1500,2000,1500,1500,2000,1800],
    rTitle:'Music Academy Fee Receipt' },

  salon: { icon:'💈', label:'Salon / Spa', color:'#f43f5e', cat:'other',
    member:'Client', members:'Clients', plan:'Package',
    plans:['Basic Membership','Premium','Gold','Platinum'],
    fees:[999,1999,3999,7999],
    rTitle:'Salon Membership Receipt' },

  other: { icon:'🏢', label:'Other / Custom', color:'#64748b', cat:'other',
    member:'Member', members:'Members', plan:'Plan',
    plans:['Basic','Standard','Premium','Enterprise'],
    fees:[500,1000,2000,5000],
    rTitle:'Fee Receipt' },
};

export const TYPE_CATS = [
  { id:'education', label:'Education',          icon:'🎓', types:['school','coaching','college','skilllearn'] },
  { id:'sports',    label:'Sports & Fitness',   icon:'🏅', types:['gym','swimming','sportsacademy','yoga','martialarts','dance'] },
  { id:'community', label:'Community & Living', icon:'🏘️', types:['hostel','club','library','society'] },
  { id:'other',     label:'Other',              icon:'🏢', types:['salon','music','other'] },
];

export function th(typeKey: string): InstTypeConfig {
  return TYPES[typeKey] ?? TYPES.other;
}
