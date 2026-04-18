// ─── Auth ──────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  primaryRole: 'admin' | 'member' | 'both';
  defaultCountry: string;
  has_pin?: boolean;
  address?: string | null;
  bio?: string | null;
  photo?: string | null;   // base64 data-url
}

// ─── Announcement ──────────────────────────────────────────
export type AnnType = 'general' | 'holiday' | 'schedule_change' | 'urgent';
export interface Announcement {
  _id: string;
  inviteCode: string;
  instName: string;
  type: AnnType;
  title: string;
  body: string;
  date: string;
  createdAt: string;
}

// ─── Feedback ─────────────────────────────────────────────
export type Reaction = 'none' | 'thumbs_up' | 'heart' | 'noted';
export interface Feedback {
  _id: string;
  inviteCode: string;
  instName: string;
  memberId: string;
  memberName: string;
  memberPhone: string | null;
  text: string;
  reply: string | null;
  repliedAt: string | null;
  reaction: Reaction;
  createdAt: string;
}

// ─── Institution Types ─────────────────────────────────────
export interface InstTypeConfig {
  icon: string;
  label: string;
  color: string;
  cat: string;
  member: string;
  members: string;
  plan: string;
  plans: string[];
  fees: number[];
  rTitle: string;
}

// ─── Institution ───────────────────────────────────────────
export interface ReceiptTemplate {
  header?: string;
  footer?: string;
  showFields?: {
    period?: boolean;
    nextDue?: boolean;
    payMode?: boolean;
    receiptNo?: boolean;
  };
}

export interface PayQR {
  id: string;
  name: string;
  upi: string;
  app: 'PhonePe' | 'Google Pay' | 'Paytm' | 'UPI';
}

export interface Institution {
  id: string;
  name: string;
  type: string;
  inviteCode: string;
  country: string;
  currency: string;
  logo?: string;        // base64 data-url
  accentColor?: string;
  template?: ReceiptTemplate;
  payQRs?: PayQR[];
  createdAt: string;
}

// ─── Member ────────────────────────────────────────────────
export type PayFreq = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'one-time';
export type FeeStatus = 'paid' | 'partial' | 'due' | 'overdue';

export interface Member {
  id: string;
  instId: string;
  name: string;
  phone?: string;
  address?: string;
  plan: string;
  fee: number;
  joinDate: string;
  nextDue?: string;
  freq: PayFreq;
  status: FeeStatus;
  tags?: string[];
  avatar?: string;
  note?: string;
}

// ─── Transaction ───────────────────────────────────────────
export type PayMode = 'cash' | 'upi' | 'card' | 'cheque' | 'bank_transfer' | 'other';

export interface Transaction {
  id: string;
  instId: string;
  memberId: string;
  amount: number;
  mode: PayMode;
  date: string;
  period?: string;
  note?: string;
  receiptNo?: string;
}

// ─── Membership (joined as member) ────────────────────────
export interface LastPayment {
  date: string;
  amount: number;
  mode: string;
}

export interface Membership {
  id: string;
  instName: string;
  instType: string;
  instAddress?: string;
  inviteCode: string;
  myPlan: string;
  myFee: number;
  freq: PayFreq;
  joinDate: string;
  nextDue?: string;
  lastPayment?: LastPayment;
  status: FeeStatus;
  adminName?: string;
  adminPhone?: string;
}

// ─── App State ─────────────────────────────────────────────
export interface AppSettings {
  vpsSyncEnabled: boolean;
  vpsSyncStartDate: string | null;
}

export interface AppState {
  user: User | null;
  institutions: Institution[];
  members: Record<string, Member[]>;          // keyed by instId
  transactions: Record<string, Transaction[]>; // keyed by instId
  memberships: Membership[];
  activeInstId: string | null;
  activeRole: 'admin' | 'member';
  defaultCountry: string;
  settings: AppSettings;
}

// ─── Country ───────────────────────────────────────────────
export interface Country {
  code: string;
  name: string;
  dial: string;
  currency: string;
  flag: string;
  digits: number;
}
