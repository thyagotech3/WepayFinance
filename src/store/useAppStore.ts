import { create } from 'zustand';
import { Transaction, FixedExpenseItem, PiggyBankItem, FamilyGroup } from '../types';
import { INITIAL_GROUP, INITIAL_TRANSACTIONS, INITIAL_FIXED_EXPENSES, INITIAL_PIGGY_BANKS } from '../data/mockInitialData';
import { auth, FirebaseUser } from '../lib/firebase';

interface AppState {
  authUser: FirebaseUser | null;
  isDemo: boolean;
  group: FamilyGroup | null;
  currentMemberId: string;
  transactions: Transaction[];
  fixedExpenses: FixedExpenseItem[];
  piggyBanks: PiggyBankItem[];
  
  setAuthUser: (user: FirebaseUser | null) => void;
  setIsDemo: (isDemo: boolean) => void;
  setGroup: (group: FamilyGroup | null | ((prev: FamilyGroup | null) => FamilyGroup | null)) => void;
  setCurrentMemberId: (id: string) => void;
  setTransactions: (txs: Transaction[] | ((prev: Transaction[]) => Transaction[])) => void;
  setFixedExpenses: (expenses: FixedExpenseItem[] | ((prev: FixedExpenseItem[]) => FixedExpenseItem[])) => void;
  setPiggyBanks: (banks: PiggyBankItem[] | ((prev: PiggyBankItem[]) => PiggyBankItem[])) => void;
}

export const useAppStore = create<AppState>((set) => ({
  authUser: auth.currentUser,
  isDemo: typeof window !== 'undefined' ? localStorage.getItem('wepay_is_demo') === 'true' : false,
  
  group: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_group');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  })(),

  currentMemberId: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_current_member');
      if (saved) return saved;
      
      const groupStr = localStorage.getItem('wepay_group');
      if (groupStr) {
        try {
          const group = JSON.parse(groupStr);
          return group?.members?.[0]?.id || '';
        } catch (e) {}
      }
    }
    return '';
  })(),

  transactions: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_transactions');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
      return localStorage.getItem('wepay_is_demo') === 'true' ? INITIAL_TRANSACTIONS : [];
    }
    return [];
  })(),

  fixedExpenses: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_fixed_expenses');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
      return localStorage.getItem('wepay_is_demo') === 'true' ? INITIAL_FIXED_EXPENSES : [];
    }
    return [];
  })(),

  piggyBanks: (() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('wepay_cofrinhos');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
      return localStorage.getItem('wepay_is_demo') === 'true' ? INITIAL_PIGGY_BANKS : [];
    }
    return [];
  })(),

  setAuthUser: (authUser) => set({ authUser }),
  setIsDemo: (isDemo) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_is_demo', String(isDemo));
    }
    set({ isDemo });
  },
  setGroup: (updater) => set((state) => {
    const nextGroup = typeof updater === 'function' ? updater(state.group) : updater;
    if (typeof window !== 'undefined') {
      if (nextGroup) {
        localStorage.setItem('wepay_group', JSON.stringify(nextGroup));
      } else {
        localStorage.removeItem('wepay_group');
      }
    }
    return {
      group: nextGroup,
      currentMemberId: state.currentMemberId || (nextGroup?.members[0]?.id) || ''
    };
  }),
  setCurrentMemberId: (currentMemberId) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_current_member', currentMemberId);
    }
    set({ currentMemberId });
  },
  setTransactions: (updater) => set((state) => {
    const nextTransactions = typeof updater === 'function' ? updater(state.transactions) : updater;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_transactions', JSON.stringify(nextTransactions));
    }
    return { transactions: nextTransactions };
  }),
  setFixedExpenses: (updater) => set((state) => {
    const nextFixedExpenses = typeof updater === 'function' ? updater(state.fixedExpenses) : updater;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_fixed_expenses', JSON.stringify(nextFixedExpenses));
    }
    return { fixedExpenses: nextFixedExpenses };
  }),
  setPiggyBanks: (updater) => set((state) => {
    const nextPiggyBanks = typeof updater === 'function' ? updater(state.piggyBanks) : updater;
    if (typeof window !== 'undefined') {
      localStorage.setItem('wepay_cofrinhos', JSON.stringify(nextPiggyBanks));
    }
    return { piggyBanks: nextPiggyBanks };
  }),
}));
