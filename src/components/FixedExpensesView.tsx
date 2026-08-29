import React, { useState, useMemo, useEffect } from 'react';
import { FamilyMember, FixedExpenseItem, Transaction } from '../types';
import { useAppStore } from '../store/useAppStore';
import {
  FixedExpenseModal,
  getDueDateStatus,
  getInstallmentInfo,
} from './FixedExpenseModal';
import { isFixedExpensePaidInMonth, isFixedExpenseActiveInMonth } from '../utils/incomeUtils';
import { CATEGORIES_META } from '../data/suggestions';
import {
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Check,
  Search,
  SlidersHorizontal,
  Clock,
  PieChart,
  Users,
  Wallet,
  ArrowUpRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface FixedExpensesViewProps {
  expenses?: FixedExpenseItem[];
  onUpdateExpenses?: (expenses: FixedExpenseItem[]) => void;
  onBack: () => void;
  onClose?: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  onRevertFixedExpenseTransaction?: (fixedExpenseId: string, monthKey?: string) => void;
}

export const FixedExpensesView: React.FC<FixedExpensesViewProps> = ({
  expenses: propExpenses,
  onUpdateExpenses,
  onBack,
  onClose,
  onAddTransaction,
  onRevertFixedExpenseTransaction,
}) => {
  const { group, currentMemberId } = useAppStore();
  const members = group?.members || [];
  const currentMember = members.find((m) => m.id === currentMemberId) || members[0];
  // Current month calculation
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Search and Filter states for Mobile & Desktop
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'overdue' | 'paid'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCategoryDrawer, setShowCategoryDrawer] = useState<boolean>(false);

  const monthKey = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const formattedMonthYear = useMemo(() => {
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();
    return `${monthName.toUpperCase()} ${year}`;
  }, [currentDate]);

  const isCurrentRealMonth = useMemo(() => {
    const now = new Date();
    return (
      currentDate.getFullYear() === now.getFullYear() &&
      currentDate.getMonth() === now.getMonth()
    );
  }, [currentDate]);

  // Storage key
  const STORAGE_KEY = 'wepay_fixed_expenses';

  const [localExpenses, setLocalExpenses] = useState<FixedExpenseItem[]>(() => {
    if (propExpenses && propExpenses.length > 0) return propExpenses;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  useEffect(() => {
    if (propExpenses) {
      setLocalExpenses(propExpenses);
    }
  }, [propExpenses]);

  useEffect(() => {
    const handleReload = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setLocalExpenses(parsed);
          }
        } catch (e) {}
      }
    };
    window.addEventListener('wepay_fixed_expenses_updated', handleReload);
    window.addEventListener('storage', handleReload);
    return () => {
      window.removeEventListener('wepay_fixed_expenses_updated', handleReload);
      window.removeEventListener('storage', handleReload);
    };
  }, []);

  const expenses = propExpenses && propExpenses.length > 0 ? propExpenses : localExpenses;

  const updateExpensesList = (newItems: FixedExpenseItem[]) => {
    setLocalExpenses(newItems);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newItems));
    window.dispatchEvent(new Event('wepay_fixed_expenses_updated'));
    if (onUpdateExpenses) {
      onUpdateExpenses(newItems);
    }
  };

  const setExpenses = (action: React.SetStateAction<FixedExpenseItem[]>) => {
    const updated = typeof action === 'function' ? action(expenses) : action;
    updateExpensesList(updated);
  };

  // Active modal state
  const [selectedExpense, setSelectedExpense] = useState<FixedExpenseItem | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [payerPromptExpense, setPayerPromptExpense] = useState<FixedExpenseItem | null>(null);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('both');

  // Filter expenses by current month key (or fixed/variable/installment items)
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((item) => isFixedExpenseActiveInMonth(item, monthKey));
  }, [expenses, monthKey]);

  // Helper to check if item is paid in current month
  const isItemPaidInMonth = (item: FixedExpenseItem) => {
    return isFixedExpensePaidInMonth(item, monthKey);
  };

  // Calculate totals
  const totalAmount = useMemo(
    () => currentMonthExpenses.reduce((acc, curr) => acc + curr.amount, 0),
    [currentMonthExpenses]
  );
  const totalPaid = useMemo(
    () =>
      currentMonthExpenses
        .filter((e) => isItemPaidInMonth(e))
        .reduce((acc, curr) => acc + curr.amount, 0),
    [currentMonthExpenses, monthKey]
  );
  const totalPending = useMemo(
    () =>
      currentMonthExpenses
        .filter((e) => !isItemPaidInMonth(e))
        .reduce((acc, curr) => acc + curr.amount, 0),
    [currentMonthExpenses, monthKey]
  );

  const paidCount = useMemo(
    () => currentMonthExpenses.filter((e) => isItemPaidInMonth(e)).length,
    [currentMonthExpenses, monthKey]
  );
  const pendingCount = useMemo(
    () => currentMonthExpenses.filter((e) => !isItemPaidInMonth(e)).length,
    [currentMonthExpenses, monthKey]
  );

  // Helper to calculate days diff for an item in current month
  const getItemDueDiffDays = (item: FixedExpenseItem) => {
    const match = String(item.dueDate || '').match(/\d+/);
    const dayNum = match ? parseInt(match[0], 10) : 10;
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10) || new Date().getFullYear();
    const month = (parseInt(monthStr, 10) || (new Date().getMonth() + 1)) - 1;

    const dueDateObj = new Date(year, month, dayNum);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = dueDateObj.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Smart due date categorization for unpaid items
  const unpaidAnalysis = useMemo(() => {
    const unpaid = currentMonthExpenses.filter((e) => !isItemPaidInMonth(e));
    const overdueList: FixedExpenseItem[] = [];
    const dueTodayList: FixedExpenseItem[] = [];
    const dueWithin10DaysList: { item: FixedExpenseItem; diff: number }[] = [];
    const dueAfter10DaysList: { item: FixedExpenseItem; diff: number }[] = [];

    unpaid.forEach((item) => {
      const isPaid = isItemPaidInMonth(item);
      if (isPaid) return;
      
      const diff = getItemDueDiffDays(item);
      if (diff < 0) {
        overdueList.push(item);
      } else if (diff === 0) {
        dueTodayList.push(item);
      } else if (diff <= 10) {
        dueWithin10DaysList.push({ item, diff });
      } else {
        dueAfter10DaysList.push({ item, diff });
      }
    });

    // Sort by nearest due day
    dueWithin10DaysList.sort((a, b) => a.diff - b.diff);
    dueAfter10DaysList.sort((a, b) => a.diff - b.diff);

    const nearestDaysWithin10 = dueWithin10DaysList.length > 0 ? dueWithin10DaysList[0].diff : null;
    const nearestDaysAfter10 = dueAfter10DaysList.length > 0 ? dueAfter10DaysList[0].diff : null;

    return {
      overdue: overdueList,
      dueToday: dueTodayList,
      dueWithin10Days: dueWithin10DaysList.map((d) => d.item),
      nearestDaysWithin10,
      dueAfter10Days: dueAfter10DaysList.map((d) => d.item),
      nearestDaysAfter10,
      totalUnpaid: unpaid.length,
    };
  }, [currentMonthExpenses, monthKey]);

  const overdueCount = unpaidAnalysis.overdue.length;

  const progressPercent =
    totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 0;

  // Month name display in Portuguese (e.g. Agosto)
  const currentMonthPT = useMemo(() => {
    return currentDate.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());
  }, [currentDate]);

  // Calculate expense responsibility per member (direct + 50% shared)
  const getMemberExpenseTotal = (memberId: string) => {
    return currentMonthExpenses.reduce((acc, curr) => {
      if (curr.paidByMemberId === memberId) {
        return acc + curr.amount;
      }
      if (
        curr.paidByMemberId === 'both' ||
        curr.paidByMemberId === 'casal' ||
        !curr.paidByMemberId
      ) {
        const memberCount = Math.max(members.length, 1);
        return acc + curr.amount / memberCount;
      }
      return acc;
    }, 0);
  };

  // Filtered expenses list based on search and filters
  const filteredExpenses = useMemo(() => {
    return currentMonthExpenses.filter((item) => {
      const isPaid = isItemPaidInMonth(item);
      
      // Status filter
      if (statusFilter === 'pending' && isPaid) return false;
      if (statusFilter === 'paid' && !isPaid) return false;
      if (statusFilter === 'overdue') {
        if (isPaid) return false;
        const diff = getItemDueDiffDays(item);
        if (diff >= 0) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesCategory = item.category.toLowerCase().includes(query);
        const matchesNotes = item.notes ? item.notes.toLowerCase().includes(query) : false;
        return matchesTitle || matchesCategory || matchesNotes;
      }

      return true;
    });
  }, [currentMonthExpenses, statusFilter, selectedCategory, searchQuery, monthKey]);

  // Unique categories in this month with amounts
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    currentMonthExpenses.forEach((item) => {
      map[item.category] = (map[item.category] || 0) + item.amount;
    });
    return Object.entries(map).map(([category, amount]) => ({
      category,
      amount,
      pct: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
    }));
  }, [currentMonthExpenses, totalAmount]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    currentMonthExpenses.forEach((item) => set.add(item.category));
    return Array.from(set);
  }, [currentMonthExpenses]);

  const handleSaveExpense = (
    expenseData: Omit<FixedExpenseItem, 'id'> & { id?: string }
  ) => {
    let savedId = expenseData.id;
    const isPaidInCurrentMonth = isFixedExpensePaidInMonth(expenseData as FixedExpenseItem, monthKey);

    if (expenseData.id) {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === expenseData.id ? ({ ...e, ...expenseData } as FixedExpenseItem) : e
        )
      );
    } else {
      const newId = `fe_${Date.now()}`;
      savedId = newId;
      const newExpense: FixedExpenseItem = {
        ...expenseData,
        id: newId,
        monthKey: expenseData.monthKey || monthKey,
      } as FixedExpenseItem;
      setExpenses((prev) => [newExpense, ...prev]);
    }

    if (isPaidInCurrentMonth && savedId) {
      const payerId = expenseData.paidByMemberId || currentMember.id || 'both';
      const meta = CATEGORIES_META[expenseData.category];
      const instInfo =
        expenseData.recurrenceType === 'installment'
          ? getInstallmentInfo(expenseData as FixedExpenseItem, monthKey)
          : null;

      const recText =
        expenseData.recurrenceType === 'fixed_amount'
          ? '📌 Valor Fixo'
          : expenseData.recurrenceType === 'variable_amount'
          ? '⚡ Valor Variável'
          : expenseData.recurrenceType === 'installment'
          ? `💳 ${instInfo ? instInfo.label : 'Parcelado'}`
          : '🗓️ Gasto Único';

      onAddTransaction({
        description: `[Gasto Fixo] ${expenseData.title}${
          instInfo ? ` (${instInfo.label})` : ''
        }`,
        amount: expenseData.amount,
        category: expenseData.category,
        categoryIcon: meta?.icon || 'Receipt',
        type: 'expense',
        paidByMemberId: payerId,
        splitType: payerId === 'both' || payerId === 'casal' ? 'equal' : 'custom',
        isRecurrent: true,
        notes: `Gasto Fixo | Recorrência: ${recText} | Vencimento: Dia ${
          expenseData.dueDate
        } | Status: PAGO${expenseData.notes ? ` | Obs: ${expenseData.notes}` : ''}`,
        aiCategorized: false,
        fixedExpenseId: savedId,
      });
    } else if (onRevertFixedExpenseTransaction && savedId) {
      onRevertFixedExpenseTransaction(savedId, monthKey);
    }
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (onRevertFixedExpenseTransaction) {
      onRevertFixedExpenseTransaction(id, monthKey);
    }
  };

  const handleTogglePaidQuick = (
    e: React.MouseEvent | undefined,
    item: FixedExpenseItem
  ) => {
    if (e) e.stopPropagation();

    const isPaid = isItemPaidInMonth(item);

    // If item is currently unpaid, open modal asking who paid this month
    if (!isPaid) {
      setPayerPromptExpense(item);
      setSelectedPayerId(item.paidByMemberId || currentMember.id || 'both');
      return;
    }

    // If item was already paid, unmark as paid and revert transaction
    setExpenses((prev) =>
      prev.map((ex) => {
        if (ex.id === item.id) {
          const paidMonths = ex.paidMonths || [];
          return { 
            ...ex, 
            paidMonths: paidMonths.filter(m => m !== monthKey)
          };
        }
        return ex;
      })
    );
    if (onRevertFixedExpenseTransaction) {
      onRevertFixedExpenseTransaction(item.id, monthKey);
    }
  };

  const handleConfirmPayment = (expense: FixedExpenseItem, payerId: string) => {
    setExpenses((prev) =>
      prev.map((ex) => {
        if (ex.id === expense.id) {
          const paidMonths = ex.paidMonths || [];
          if (!paidMonths.includes(monthKey)) {
            return { 
              ...ex, 
              paidMonths: [...paidMonths, monthKey],
              paidByMemberId: payerId 
            };
          }
        }
        return ex;
      })
    );

    const meta = CATEGORIES_META[expense.category];
    const instInfo =
      expense.recurrenceType === 'installment'
        ? getInstallmentInfo(expense, monthKey)
        : null;

    const recText =
      expense.recurrenceType === 'fixed_amount'
        ? '📌 Valor Fixo'
        : expense.recurrenceType === 'variable_amount'
        ? '⚡ Valor Variável'
        : expense.recurrenceType === 'installment'
        ? `💳 ${instInfo ? instInfo.label : 'Parcelado'}`
        : '🗓️ Gasto Único';

    onAddTransaction({
      description: `[Gasto Fixo] ${expense.title}${
        instInfo ? ` (${instInfo.label})` : ''
      }`,
      amount: expense.amount,
      category: expense.category,
      categoryIcon: meta?.icon || 'Receipt',
      type: 'expense',
      paidByMemberId: payerId,
      splitType: payerId === 'both' || payerId === 'casal' ? 'equal' : 'custom',
      isRecurrent: true,
      notes: `Gasto Fixo | Recorrência: ${recText} | Vencimento: Dia ${
        expense.dueDate
      } | Status: PAGO${expense.notes ? ` | Obs: ${expense.notes}` : ''}`,
      aiCategorized: false,
      fixedExpenseId: expense.id,
    });

    setPayerPromptExpense(null);
  };

  const navigateMonth = (direction: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + direction);
      return d;
    });
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 max-w-xl lg:max-w-7xl mx-auto pb-4">
      {/* ================= 1. TOP MONTH SELECTOR CARD (MATCHING INÍCIO) ================= */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl p-2 sm:p-3 shadow-lg flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigateMonth(-1)}
          className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
          title="Mês anterior"
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline text-xs font-bold">Anterior</span>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[9px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-tight">
              Despesas Fixas
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-base font-black text-white uppercase tracking-tight leading-tight">
                {formattedMonthYear}
              </span>
              {isCurrentRealMonth && (
                <span className="hidden xs:inline px-1.5 py-0.2 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[9px] font-extrabold uppercase tracking-wider">
                  Atual
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateMonth(1)}
          className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
          title="Próximo mês"
        >
          <span className="hidden sm:inline text-xs font-bold">Próximo</span>
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ================= 2. MAIN CONTENT (RESPONSIVE DESKTOP LAYOUT) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-6 items-start">
        {/* LEFT COLUMN ON DESKTOP: EXECUTIVE SUMMARY HERO CARD + FILTERS (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-3 lg:space-y-4 lg:sticky lg:top-20">
          {/* EXECUTIVE HERO CARD (MATCHING INÍCIO TOP HERO) */}
          <div className="bg-gradient-to-br from-[#0c0f24] via-[#090c1b] to-[#070914] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-2xl relative overflow-hidden space-y-3 sm:space-y-4">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            <div className="relative z-10 space-y-3 sm:space-y-4">
              {/* KPI Cards Grid (Matching Início) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-3 pt-0.5">
                {/* Total Despesas fixas do mês */}
                <div className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1 bg-[#121630]/90 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] sm:text-[11px] font-semibold">Total Fixas</span>
                    <Wallet className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-black text-white font-mono tracking-tight">
                    R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* Já Pago */}
                <div className="bg-[#121630]/90 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] sm:text-[11px] font-semibold">Já Pago</span>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-sm sm:text-xl font-black text-emerald-400 font-mono">
                    R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 block">
                    {paidCount} {paidCount === 1 ? 'paga' : 'pagas'}
                  </span>
                </div>

                {/* A Pagar */}
                <div className="bg-[#121630]/90 border border-slate-800 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-0.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] sm:text-[11px] font-semibold">A Pagar</span>
                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                  </div>
                  <div className="text-sm sm:text-xl font-black text-rose-400 font-mono">
                    R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-slate-500 block">
                    {pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}
                  </span>
                </div>
              </div>

              {/* Progress Bar (Matching Início) */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400">
                  <span>Quitação das Contas Fixas</span>
                  <span className="font-mono text-emerald-300 font-bold">{progressPercent}% quitado</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-purple-500 via-emerald-500 to-emerald-400"
                    style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
                  />
                </div>
              </div>

              {/* SMART DUE DATE NOTIFICATION BANNER (Unified height, padding, centered alignment, and font) */}
              {(() => {
                // Priority 1: Contas Vencidas (Vermelho)
                if (unpaidAnalysis.overdue.length > 0) {
                  const count = unpaidAnalysis.overdue.length;
                  return (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('overdue')}
                      className="w-full py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-200 flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" />
                      <span className="truncate">
                        Você tem <span className="underline underline-offset-2 font-black text-white font-mono">({count})</span> {count === 1 ? 'conta vencida' : 'contas vencidas'} em {currentMonthPT}
                      </span>
                    </button>
                  );
                }

                // Priority 2: Vence Hoje (Laranja)
                if (unpaidAnalysis.dueToday.length > 0) {
                  const count = unpaidAnalysis.dueToday.length;
                  return (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('pending')}
                      className="w-full py-2 px-3 rounded-xl bg-orange-950/60 hover:bg-orange-900/80 border border-orange-500/40 text-orange-200 flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0 animate-bounce" />
                      <span className="truncate">
                        Você tem <span className="underline underline-offset-2 font-black text-white font-mono">({count})</span> {count === 1 ? 'conta à vencer hoje' : 'contas à vencer hoje'}
                      </span>
                    </button>
                  );
                }

                // Priority 3: A Pagar em 10 dias ou menos (Laranja / Âmbar)
                if (unpaidAnalysis.dueWithin10Days.length > 0) {
                  const days = unpaidAnalysis.nearestDaysWithin10 || 1;
                  return (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('pending')}
                      className="w-full py-2 px-3 rounded-xl bg-orange-950/60 hover:bg-orange-900/80 border border-orange-500/40 text-orange-200 flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      <span className="truncate">
                        Você tem contas à vencer em <span className="underline underline-offset-2 font-black text-white font-mono">{days} {days === 1 ? 'dia' : 'dias'}</span>
                      </span>
                    </button>
                  );
                }

                // Priority 4: A Pagar depois de 10 dias no mês vigente (Azul)
                if (unpaidAnalysis.dueAfter10Days.length > 0) {
                  const count = unpaidAnalysis.dueAfter10Days.length;
                  return (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('pending')}
                      className="w-full py-2 px-3 rounded-xl bg-sky-950/60 hover:bg-sky-900/80 border border-sky-500/40 text-sky-200 flex items-center justify-center gap-2 text-xs font-bold transition-all active:scale-[0.98] cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="truncate">
                        Você tem <span className="underline underline-offset-2 font-black text-white font-mono">({count})</span> {count === 1 ? 'conta a pagar ainda esse mês' : 'contas a pagar ainda esse mês'}
                      </span>
                    </button>
                  );
                }

                // All paid state (Verde discreto)
                if (currentMonthExpenses.length > 0) {
                  return (
                    <div className="w-full py-2 px-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 flex items-center justify-center gap-2 text-xs font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Todas as contas deste mês estão quitadas!</span>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          </div>

          {/* Left column now cleanly holds the Month KPIs and Progress Bar */}
        </div>

        {/* RIGHT COLUMN ON DESKTOP: UNIFIED SECTION (lg:col-span-7) */}
        <div className="lg:col-span-7">
          {/* UNIFIED MOLDURA / CARD CONTAINER: TITLE, BUTTON, SEARCH, FILTERS & CONTAS LIST */}
          <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 shadow-xl space-y-3.5">
            
            {/* 1. TOP HEADER: TITLE + NOVA DESPESA BUTTON */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-none truncate">
                    Contas Fixas ({filteredExpenses.length})
                  </h3>
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium block mt-0.5 truncate">
                    {overdueCount > 0 ? `${overdueCount} vencidas • ` : ''}{pendingCount > 0 ? `${pendingCount} a pagar neste mês` : 'Todas as contas quitadas'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-md border border-purple-400/40 cursor-pointer transition-all group shrink-0"
              >
                <Plus className="w-3.5 h-3.5 text-white stroke-[3] group-hover:rotate-90 transition-transform" />
                <span>Nova Despesa</span>
              </button>
            </div>

            {/* 2. SEARCH BOX & STATUS FILTER TABS */}
            <div className="space-y-2">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar conta fixa..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8.5 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Switcher Buttons */}
              <div className={`grid ${overdueCount > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-center`}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate ${
                    statusFilter === 'all'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({currentMonthExpenses.length})
                </button>
                {overdueCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('overdue')}
                    className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate flex items-center justify-center gap-1 ${
                      statusFilter === 'overdue'
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-rose-400 hover:text-rose-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping shrink-0" />
                    <span>Vencidas ({overdueCount})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate ${
                    statusFilter === 'pending'
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  A Pagar ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`py-1.5 px-1 sm:px-2 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer truncate ${
                    statusFilter === 'paid'
                      ? 'bg-emerald-600 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pagas ({paidCount})
                </button>
              </div>
            </div>

            {/* 3. LIST OF EXPENSES CARDS */}
            <div className="space-y-2.5 pt-1">
              {/* Empty State */}
              {filteredExpenses.length === 0 && (
                <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl sm:rounded-2xl p-6 text-center space-y-2.5">
                  <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      Nenhuma conta encontrada
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      {searchQuery || statusFilter !== 'all' || selectedCategory !== 'all'
                        ? 'Nenhum item corresponde aos filtros selecionados.'
                        : 'Nenhuma despesa fixa cadastrada para este mês.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Existing Expense Cards */}
              {filteredExpenses.map((item) => {
                const isPaid = isItemPaidInMonth(item);
                const dueStatus = getDueDateStatus(item.dueDate, isPaid, monthKey);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedExpense(item)}
                    className="bg-[#0a0d1c] border border-slate-800/80 hover:border-purple-500/40 hover:bg-[#121630]/90 rounded-xl sm:rounded-2xl p-3 sm:p-3.5 shadow-md transition-all duration-200 cursor-pointer space-y-2 relative group"
                  >
                    {/* Top Row: Category Pill (Purple) + Two-Position Segmented Toggle [A PAGAR | PAGO] */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] sm:text-[11px] font-bold text-purple-300 bg-purple-950/60 border border-purple-500/30 px-2 py-0.5 rounded-lg shrink-0">
                        {item.category}
                      </span>

                      {/* Switch Segmentado A PAGAR | PAGO */}
                      <div
                        onClick={(e) => handleTogglePaidQuick(e, item)}
                        className="bg-[#080a18] border border-slate-800/90 rounded-full p-0.5 flex items-center gap-0.5 cursor-pointer shadow-inner shrink-0"
                      >
                        <button
                          type="button"
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                            !isPaid
                              ? 'bg-rose-500 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          A PAGAR
                        </button>
                        <button
                          type="button"
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all ${
                            isPaid
                              ? 'bg-emerald-500 text-slate-950 shadow-xs'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          PAGO
                        </button>
                      </div>
                    </div>

                    {/* Title of Expense */}
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-black text-white tracking-tight truncate group-hover:text-purple-200 transition-colors">
                        {item.title}
                      </h3>
                    </div>

                    {/* Bottom Row: Due Date Status Badge + Amount + Right Arrow */}
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                      {/* Due Date Status badge (e.g. 🗓️ Dia 10 (Pago)) */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold border ${
                          isPaid
                            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                            : dueStatus.colorClass
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        <span>
                          Dia {item.dueDate} {isPaid ? '(Pago)' : ''}
                        </span>
                      </div>

                      {/* Amount and Chevron */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm sm:text-base font-black text-white font-mono">
                          R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-purple-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      {showAddModal && (
        <FixedExpenseModal
          members={members}
          currentMember={currentMember}
          monthKey={monthKey}
          onSave={handleSaveExpense}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {selectedExpense && (
        <FixedExpenseModal
          expense={selectedExpense}
          members={members}
          currentMember={currentMember}
          monthKey={monthKey}
          onSave={handleSaveExpense}
          onDelete={handleDeleteExpense}
          onClose={() => setSelectedExpense(null)}
        />
      )}

      {/* Payer Selection Modal upon checking unpaid item */}
      {payerPromptExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0e1224] border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-sm space-y-4 shadow-2xl text-slate-100 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Confirmar Pagamento</h3>
              </div>
              <button
                type="button"
                onClick={() => setPayerPromptExpense(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Despesa</span>
              <div className="text-sm font-black text-white">{payerPromptExpense.title}</div>
              <div className="text-lg font-black text-emerald-400 font-mono">
                R$ {payerPromptExpense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Quem pagou esta conta neste mês?
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* Both members option */}
                <button
                  type="button"
                  onClick={() => setSelectedPayerId('both')}
                  className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    selectedPayerId === 'both'
                      ? 'bg-purple-950/60 border-purple-500 text-white'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full bg-pink-500" />
                    <div>
                      <div className="text-xs font-bold">Ambos / Casal (50% cada)</div>
                      <div className="text-[10px] text-slate-400">Dividido igualmente</div>
                    </div>
                  </div>
                  {selectedPayerId === 'both' && <Check className="w-4 h-4 text-purple-400" />}
                </button>

                {/* Individual member options */}
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedPayerId(member.id)}
                    className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      selectedPayerId === member.id
                        ? 'bg-purple-950/60 border-purple-500 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: member.color || '#3b82f6' }}
                      />
                      <div>
                        <div className="text-xs font-bold">{member.name}</div>
                        <div className="text-[10px] text-slate-400">Pagou integralmente</div>
                      </div>
                    </div>
                    {selectedPayerId === member.id && <Check className="w-4 h-4 text-purple-400" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPayerPromptExpense(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmPayment(payerPromptExpense, selectedPayerId)}
                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

