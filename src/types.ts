export type IncomeNature = 'fixed' | 'extra' | 'vales';

export interface IncomeHistoryEntry {
  id: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface IncomeStream {
  id: string;
  name: string;
  amount: number;
  nature: IncomeNature;
  isMain?: boolean;
  notes?: string;
  dueDate?: string;
  received?: boolean;
  receivedDate?: string;
  isRecurrent?: boolean;
  startDate?: string; // YYYY-MM
  endDate?: string;   // YYYY-MM
  excludedMonths?: string[]; // Array of YYYY-MM where this recurrent income should NOT appear
  targetGoal?: number;
  icon?: string;
  calculationType?: 'manual' | 'auto';
  dailyRate?: number;
  workDays?: string[];
  workOnHolidays?: boolean;
  lastEntryAmount?: number;
  history?: IncomeHistoryEntry[];
}

export interface MemberMonthlyIncome {
  memberId: string;
  monthKey: string; // 'YYYY-MM'
  streams: IncomeStream[];
}

export type RecurrenceType = 'fixed_amount' | 'variable_amount' | 'single_month' | 'installment';

export interface FixedExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: CategoryType;
  paidByMemberId: string;
  dueDate: string; // e.g., '10' or '2026-08-10'
  isPaid?: boolean; // Legacy
  paidMonths?: string[]; // Array of YYYY-MM where this expense was paid
  recurrenceType: RecurrenceType;
  monthKey: string; // YYYY-MM
  notes?: string;
  startMonthKey?: string; // YYYY-MM
  endMonthKey?: string; // YYYY-MM
  totalInstallments?: number; 
  excludedMonths?: string[]; // Array of YYYY-MM where this recurrent expense should NOT appear
}

export type SplitType = 'equal' | 'individual' | 'proportional';

export type CategoryType = 
  | 'Alimentação'
  | 'Moradia'
  | 'Transporte'
  | 'Lazer'
  | 'Saúde'
  | 'Compras'
  | 'Serviços'
  | 'Educação'
  | 'Outros'
  | (string & {});

export interface FamilyMember {
  id: string;
  name: string;
  avatar: string;
  color: string;
  email?: string;
  role: 'admin' | 'member';
  income?: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  code: string; // Joint login / group code for second device
  members: FamilyMember[];
  monthlyBudget: number;
  currency: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: CategoryType;
  categoryIcon?: string;
  type: 'expense' | 'income';
  paidByMemberId: string;
  splitType: SplitType;
  date: string;
  notes?: string;
  isRecurrent?: boolean;
  aiCategorized?: boolean;
  fixedExpenseId?: string;
  incomeStreamId?: string;
  incomeMonthKey?: string;
  status?: 'active' | 'reverted' | 'deleted';
  revertedAt?: string;
}

export interface RecurrentPreset {
  id: string;
  title: string;
  amount: number;
  category: CategoryType;
  categoryIcon: string;
  defaultPaidByMemberId?: string;
  splitType: SplitType;
}

export interface ExpenseSuggestion {
  id: string;
  title: string;
  defaultAmount: number;
  category: CategoryType;
  iconName: string;
  popularTime?: string;
}

export interface AIAdviceResult {
  headline: string;
  insights: string[];
  healthScore: number;
  splitAdvice: string;
}

export interface PiggyBankItem {
  id: string;
  title: string;
  currentAmount: number;
  targetAmount: number;
  icon: string;
  colorTheme: 'purple' | 'blue' | 'emerald' | 'amber' | 'rose' | 'indigo';
  targetDate?: string;
  notes?: string;
}

