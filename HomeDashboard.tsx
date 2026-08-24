import React, { useState, useMemo, useEffect } from 'react';
import { FamilyGroup, FamilyMember, Transaction, FixedExpenseItem, PiggyBankItem } from '../types';
import { INITIAL_FIXED_EXPENSES, INITIAL_PIGGY_BANKS } from '../data/mockInitialData';
import { getMonthlyIncomeData, formatMemberName } from '../utils/incomeUtils';
import { 
  Plus, Wallet, Calendar, Users, ChevronRight, ChevronLeft, Play,
  ExternalLink, Scale, Clock, TrendingUp, Palmtree, ShieldCheck,
  Tv, Home as HomeIcon, Wifi, Dumbbell, Heart, Target, ShoppingCart, PieChart,
  PiggyBank, Shield, FileText, ArrowUpRight, Gift, Plane, GraduationCap, Maximize2, Car,
  HelpCircle, CheckCircle2, Sparkles, X
} from 'lucide-react';
import { ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Tooltip } from 'recharts';
import { BalanceAIInsightCard } from './BalanceAIInsightCard';

interface HomeDashboardProps {
  group: FamilyGroup;
  currentMember: FamilyMember;
  members: FamilyMember[];
  transactions: Transaction[];
  fixedExpenses?: FixedExpenseItem[];
  cofrinhos?: PiggyBankItem[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  onDeleteTransaction: (id: string) => void;
  onOpenExpenseModal: () => void;
  onOpenIncomeModal: () => void;
  onOpenFixedExpenses: () => void;
  onOpenFullBalance: () => void;
  onOpenCofrinhos?: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  group,
  currentMember,
  members,
  transactions,
  fixedExpenses: propFixedExpenses,
  cofrinhos: propCofrinhos,
  onAddTransaction,
  onDeleteTransaction,
  onOpenExpenseModal,
  onOpenIncomeModal,
  onOpenFixedExpenses,
  onOpenFullBalance,
  onOpenCofrinhos,
}) => {
  // Current selected date for month navigation
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [incomesVersion, setIncomesVersion] = useState<number>(0);
  const [activeExplanation, setActiveExplanation] = useState<'saldo_atual' | 'saldo_apos_quitacao' | null>(null);

  useEffect(() => {
    const handleUpdate = () => setIncomesVersion((v) => v + 1);
    window.addEventListener('wepay_incomes_updated', handleUpdate);
    window.addEventListener('wepay_fixed_expenses_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('wepay_incomes_updated', handleUpdate);
      window.removeEventListener('wepay_fixed_expenses_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handlePrevMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formattedMonthYear = useMemo(() => {
    const monthName = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
    const year = selectedDate.getFullYear();
    return `${monthName.toUpperCase()} ${year}`;
  }, [selectedDate]);

  const selectedMonthKey = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedDate]);

  const isCurrentRealMonth = useMemo(() => {
    const now = new Date();
    return selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth();
  }, [selectedDate]);

  // Load cofrinhos dynamically
  const cofrinhos: PiggyBankItem[] = useMemo(() => {
    if (propCofrinhos) return propCofrinhos;
    const saved = localStorage.getItem('wepay_cofrinhos');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }, [propCofrinhos]);

  // Active valid transactions filtered for the selected month if dates are assigned
  const activeTransactions = useMemo(() => {
    const valid = transactions.filter((t) => t.status !== 'reverted' && t.status !== 'deleted');
    const filtered = valid.filter((t) => {
      if (!t.date) return true;
      return t.date.startsWith(selectedMonthKey);
    });
    // If no transactions exist specifically for this month but valid exist, fallback or show filtered
    return filtered.length > 0 ? filtered : valid;
  }, [transactions, selectedMonthKey]);

  // Financial calculations
  const totalExpenses = activeTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  // Incomes & Remuneração do mês selecionado (soma real dos membros)
  const incomeData = useMemo(
    () => getMonthlyIncomeData(selectedMonthKey, members),
    [selectedMonthKey, members, incomesVersion]
  );

  const fixedIncome = incomeData.totalFixedIncome;
  const extraIncome = incomeData.totalExtraIncome;
  const totalWalletIncome = incomeData.totalFamilyIncome;

  // Teto e Saldo Livre calculados sobre a Renda Total Familiar
  const ceilingTarget = totalWalletIncome;
  const ceilingUsagePercent = ceilingTarget > 0
    ? Math.min(Math.round((totalExpenses / ceilingTarget) * 100), 100)
    : 0;
  const remainingBalance = ceilingTarget - totalExpenses;

  // Fixed Expenses
  const fixedExpensesList: FixedExpenseItem[] = useMemo(() => {
    if (propFixedExpenses) return propFixedExpenses;
    const saved = localStorage.getItem('wepay_fixed_expenses');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  }, [propFixedExpenses, transactions]);

  const totalFixedPaid = fixedExpensesList
    .filter((e) => e.isPaid)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalFixedToPay = fixedExpensesList
    .filter((e) => !e.isPaid)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalFixedProgrammed = totalFixedPaid + totalFixedToPay;

  // Saldo Atual = Renda total - Gastos
  const currentBalance = totalWalletIncome - totalExpenses;

  // Saldo Após quitação das dívidas = Renda total - Gastos - Contas pendentes
  const balanceAfterBills = totalWalletIncome - totalExpenses - totalFixedToPay;

  // Reusable card renderer matching Balanço Geral panel style
  const renderBalanceCard = ({
    title,
    value,
    icon,
    colorClass,
    isFullWidth = false,
    borderAccent = 'border-slate-800',
    isNegativeAllowed = false,
  }: {
    title: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    isFullWidth?: boolean;
    borderAccent?: string;
    isNegativeAllowed?: boolean;
  }) => {
    const isNeg = isNegativeAllowed && value < 0;
    const formatted = Math.abs(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const len = formatted.length;
    
    const numSize = isFullWidth
      ? len > 12
        ? 'text-xl sm:text-2xl lg:text-3xl'
        : 'text-2xl sm:text-3xl lg:text-4xl'
      : len > 12
      ? 'text-base sm:text-lg'
      : len > 9
      ? 'text-lg sm:text-xl'
      : 'text-xl sm:text-2xl';

    return (
      <div
        className={`${
          isFullWidth ? 'col-span-2 p-3 sm:p-3.5' : 'col-span-1 p-2.5 sm:p-3.5'
        } bg-[#121630]/90 border ${borderAccent} rounded-2xl space-y-1 sm:space-y-1.5 flex flex-col justify-center shadow-md transition-all`}
      >
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] sm:text-[11px] font-semibold truncate">
            {title}
          </span>
          {icon}
        </div>
        <div className="flex items-baseline gap-0.5 sm:gap-1 font-mono overflow-hidden">
          {isNeg && <span className="text-[11px] sm:text-sm font-bold text-rose-400 shrink-0">-</span>}
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 shrink-0">
            R$
          </span>
          <span
            className={`${numSize} font-black ${
              isNeg ? 'text-rose-400' : colorClass
            } tracking-tight truncate leading-tight`}
          >
            {formatted}
          </span>
        </div>
      </div>
    );
  };

  // Couple split calculations
  const member1 = members[0] || { id: 'm1', name: 'Membro 1', color: '#3b82f6' };
  const member2 = members[1] || { id: 'm2', name: 'Membro 2', color: '#ec4899' };

  const m1PaidExpenses = activeTransactions
    .filter((t) => t.type === 'expense' && t.paidByMemberId === member1.id)
    .reduce((acc, t) => acc + t.amount, 0);
  const m2PaidExpenses = activeTransactions
    .filter((t) => t.type === 'expense' && t.paidByMemberId === member2.id)
    .reduce((acc, t) => acc + t.amount, 0);

  const spentDifference = m1PaidExpenses - m2PaidExpenses;

  // RESUMO FINANCEIRO DATA CALCULATIONS
  const totalCalculatedIncome = totalWalletIncome;

  // Member 1 & Member 2 incomes
  const m1IncomeObj = incomeData.memberTotals[member1.id] || { fixed: member1.income || 0, extra: 0, total: member1.income || 0 };
  const m2IncomeObj = incomeData.memberTotals[member2.id] || { fixed: member2.income || 0, extra: 0, total: member2.income || 0 };

  const m1Fixed = m1IncomeObj.fixed;
  const m1Extra = m1IncomeObj.extra;
  const m2Fixed = m2IncomeObj.fixed;
  const m2Extra = m2IncomeObj.extra;

  // Percentages for Donut Chart
  const p1 = totalCalculatedIncome > 0 ? Number(((m2Fixed / totalCalculatedIncome) * 100).toFixed(1)) : 0;
  const p2 = totalCalculatedIncome > 0 ? Number(((m2Extra / totalCalculatedIncome) * 100).toFixed(1)) : 0;
  const p3 = totalCalculatedIncome > 0 ? Number(((m1Fixed / totalCalculatedIncome) * 100).toFixed(1)) : 0;

  // Conic gradient string for Donut chart
  const stop1 = p1;
  const stop2 = stop1 + p2;
  const stop3 = stop2 + p3;
  const donutGradient = totalCalculatedIncome > 0 
    ? `conic-gradient(#8b5cf6 0% ${stop1}%, #f97316 ${stop1}% ${stop2}%, #3b82f6 ${stop2}% ${stop3}%, #ec4899 ${stop3}% 100%)`
    : `conic-gradient(#334155 0% 100%)`;

  // Expense Categories for Resumo Financeiro
  const fixedExpensesAmount = totalFixedProgrammed;
  
  const plannedExpensesAmount = activeTransactions
    .filter((t) => t.type === 'expense' && (t.category === 'Alimentação' || t.category === 'Moradia' || t.category === 'Transporte' || t.category === 'Mercado' || t.category === 'Saúde'))
    .reduce((acc, t) => acc + t.amount, 0);

  const otherExpensesAmount = activeTransactions
    .filter((t) => t.type === 'expense' && t.category !== 'Alimentação' && t.category !== 'Moradia' && t.category !== 'Transporte' && t.category !== 'Mercado' && t.category !== 'Saúde')
    .reduce((acc, t) => acc + t.amount, 0);

  const realTotalExpenses = totalExpenses > 0 ? totalExpenses : (fixedExpensesAmount + plannedExpensesAmount + otherExpensesAmount);

  const fixedPct = totalCalculatedIncome > 0 ? Math.round((fixedExpensesAmount / totalCalculatedIncome) * 100) : 0;
  const plannedPct = totalCalculatedIncome > 0 ? Math.round((plannedExpensesAmount / totalCalculatedIncome) * 100) : 0;
  const otherPct = totalCalculatedIncome > 0 ? Math.round((otherExpensesAmount / totalCalculatedIncome) * 100) : 0;
  const expensesPctOfIncome = totalCalculatedIncome > 0 ? Math.round((realTotalExpenses / totalCalculatedIncome) * 100) : 0;

  // Savings
  const caixinhaAmount = Math.round(totalCalculatedIncome * 0.05);
  const reservaAmount = Math.round(totalCalculatedIncome * 0.05);

  // Category Expenses Data for Painel Geral Donut Chart
  const categoryExpensesData = useMemo(() => {
    const catMap: Record<string, number> = {};
    const activeExpenses = activeTransactions.filter((t) => t.type === 'expense');

    activeExpenses.forEach((t) => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });

    if (Object.keys(catMap).length === 0) {
      const isDemo = localStorage.getItem('wepay_is_demo') === 'true';
      if (isDemo) {
        return [
          { name: 'Moradia/Contas', value: 1200, color: '#8b5cf6' },
          { name: 'Alimentação', value: 850, color: '#3b82f6' },
          { name: 'Mercado', value: 650, color: '#10b981' },
          { name: 'Transporte', value: 300, color: '#f59e0b' },
          { name: 'Outros', value: 200, color: '#ec4899' },
        ];
      }
      return [];
    }

    const categoryColors: Record<string, string> = {
      'Alimentação': '#3b82f6',
      'Moradia': '#8b5cf6',
      'Transporte': '#f59e0b',
      'Lazer': '#ec4899',
      'Saúde': '#10b981',
      'Educação': '#06b6d4',
      'Mercado': '#10b981',
      'Outros': '#64748b',
    };

    return Object.keys(catMap).map((catName) => ({
      name: catName,
      value: catMap[catName],
      color: categoryColors[catName] || '#a855f7',
    }));
  }, [activeTransactions]);

  // Couple Income Details for Painel Geral
  const coupleIncomeDetails = useMemo(() => {
    const isDemo = localStorage.getItem('wepay_is_demo') === 'true';
    const list = members.map((m) => {
      const amount = incomeData.memberTotals[m.id]?.total || (m.income && m.income > 0 ? m.income : (isDemo ? 1500 : 0));
      return {
        id: m.id,
        name: m.name,
        amount,
        color: m.color || (m.id.includes('1') ? '#3b82f6' : '#ec4899'),
      };
    });

    const sum = list.reduce((acc, curr) => acc + curr.amount, 0);

    return list.map((m) => ({
      ...m,
      pct: sum > 0 ? Math.round((m.amount / sum) * 100) : 0,
    }));
  }, [members, incomeData]);

  return (
    <div className="space-y-2.5 sm:space-y-4 max-w-xl lg:max-w-7xl mx-auto pb-24">
      {/* ================= TOP MONTH SELECTOR CARD (< Agosto de 2026 >) ================= */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl p-2 sm:p-3 shadow-lg flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
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
              Visão Geral
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
          onClick={handleNextMonth}
          className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
          title="Próximo mês"
        >
          <span className="hidden sm:inline text-xs font-bold">Próximo</span>
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ================= MAIN DASHBOARD CONTENT GRID ================= */}
      <div className="space-y-2.5 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5">
        {/* ================= LEFT / MAIN COLUMN (DESKTOP: col-span-8) ================= */}
        <div className="lg:col-span-8 space-y-2.5 sm:space-y-4">
          
          {/* TOP KPI HERO: Visão Geral Familiar & Balanço Geral */}
          <div className="bg-gradient-to-br from-[#0c0f24] via-[#090c1b] to-[#070914] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-2xl relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            <div className="relative z-10 space-y-2.5 sm:space-y-3">
              {/* Header row - Standardized to match other section headers */}
              <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-purple-500/20 px-0.5">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3 h-3 text-purple-400 shrink-0" />
                  <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider leading-none">
                    Balanço Geral
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={onOpenFullBalance}
                  className="flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[10px] sm:text-xs font-extrabold font-mono transition-all cursor-pointer shadow-xs group"
                  title="Ver balanço completo"
                >
                  <span>Ver completo</span>
                  <Play className="w-2.5 h-2.5 fill-purple-400 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              {/* Grid de Cards de Balanço */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                {/* 1. TOPO: SALDO ATUAL (LINHA INTEIRA) */}
                {renderBalanceCard({
                  title: 'Saldo Atual',
                  value: currentBalance,
                  icon: (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveExplanation((prev) => (prev === 'saldo_atual' ? null : 'saldo_atual'));
                      }}
                      className="p-1 -mr-1 -my-1 rounded-full text-purple-400 hover:text-purple-300 hover:bg-purple-500/15 active:scale-90 transition-all cursor-pointer"
                      title="Ver explicação sobre o Saldo Atual"
                      aria-label="Explicação Saldo Atual"
                    >
                      <HelpCircle className="w-4 h-4" />
                    </button>
                  ),
                  colorClass: 'text-white',
                  isFullWidth: true,
                  borderAccent: 'border-purple-500/40',
                  isNegativeAllowed: true,
                })}

                {/* CARD DE EXPLICAÇÃO DO SALDO ATUAL (ABERTO AO CLICAR NO ?) */}
                {activeExplanation === 'saldo_atual' && (
                  <div className="col-span-2 bg-[#171536]/95 border border-purple-500/50 rounded-2xl p-3 sm:p-3.5 text-xs text-purple-100 flex items-start justify-between gap-3 shadow-xl transition-all">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                      </div>
                      <div className="space-y-0.5 text-left">
                        <span className="text-[11px] font-bold text-purple-300 block uppercase tracking-wider">
                          O que é o Saldo Atual?
                        </span>
                        <p className="text-xs text-slate-200 leading-relaxed font-medium">
                          O saldo atual é o que você recebeu, menos o que você gastou e pagou.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveExplanation(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                      title="Fechar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 2. LINHA INFERIOR: CARDS EM 2 COLUNAS */}
                {/* Renda Familiar */}
                {renderBalanceCard({
                  title: 'Renda Familiar',
                  value: totalWalletIncome,
                  icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
                  colorClass: 'text-emerald-400',
                  borderAccent: 'border-slate-800',
                })}

                {/* Gastos do Mês */}
                {renderBalanceCard({
                  title: 'Gastos do Mês',
                  value: totalExpenses,
                  icon: <ShoppingCart className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
                  colorClass: 'text-rose-400',
                  borderAccent: 'border-slate-800',
                })}
              </div>
            </div>
          </div>

          {/* ================= CARD DE ANÁLISE IA DO BALANÇO (EXPANSÍVEL) ================= */}
          <BalanceAIInsightCard
            currentBalance={currentBalance}
            totalIncome={totalWalletIncome}
            totalExpenses={totalExpenses}
            totalFixedPaid={totalFixedPaid}
            totalFixedToPay={totalFixedToPay}
            monthName={formattedMonthYear}
            memberNames={members.map((m) => m.name)}
            onOpenFullBalance={onOpenFullBalance}
          />

          {/* ================= 3 ACTION BUTTON CARDS (Mobile only - Desktop has them in the top navbar) ================= */}
          <div className="md:hidden grid grid-cols-3 gap-2 sm:gap-3.5">
            {/* Button 1: NOVA DESPESA */}
            <button
              type="button"
              onClick={onOpenExpenseModal}
              className="bg-gradient-to-b from-[#1c122e] to-[#0e1220] border border-purple-500/30 hover:border-purple-400 rounded-2xl p-2 sm:p-4 aspect-auto py-2.5 sm:py-5 transition-all duration-200 hover:scale-[1.02] flex flex-col items-center justify-center text-center cursor-pointer shadow-lg group relative overflow-hidden"
            >
              <div className="p-1.5 sm:p-2.5 bg-pink-500/15 text-pink-400 rounded-xl border border-pink-500/30 group-hover:scale-110 transition-transform mb-1 shrink-0">
                <Wallet className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight block group-hover:text-pink-300 transition-colors leading-tight">
                Nova Despesa
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-medium line-clamp-1">
                Gasto rápido
              </span>
            </button>

            {/* Button 2: GASTOS FIXOS */}
            <button
              type="button"
              onClick={onOpenFixedExpenses}
              className="bg-gradient-to-b from-[#241a12] to-[#0e1220] border border-amber-500/30 hover:border-amber-400 rounded-2xl p-2 sm:p-4 aspect-auto py-2.5 sm:py-5 transition-all duration-200 hover:scale-[1.02] flex flex-col items-center justify-center text-center cursor-pointer shadow-lg group relative overflow-hidden"
            >
              <div className="p-1.5 sm:p-2.5 bg-amber-500/15 text-amber-400 rounded-xl border border-amber-500/30 group-hover:scale-110 transition-transform mb-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight block group-hover:text-amber-300 transition-colors leading-tight">
                Despesas Fixas
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-medium line-clamp-1">
                Recorrentes
              </span>
            </button>

            {/* Button 3: ARRECADAÇÃO */}
            <button
              type="button"
              onClick={onOpenIncomeModal}
              className="bg-gradient-to-b from-[#10241b] to-[#0e1220] border border-emerald-500/30 hover:border-emerald-400 rounded-2xl p-2 sm:p-4 aspect-auto py-2.5 sm:py-5 transition-all duration-200 hover:scale-[1.02] flex flex-col items-center justify-center text-center cursor-pointer shadow-lg group relative overflow-hidden"
            >
              <div className="p-1.5 sm:p-2.5 bg-emerald-500/15 text-emerald-400 rounded-xl border border-emerald-500/30 group-hover:scale-110 transition-transform mb-1 shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight block group-hover:text-emerald-300 transition-colors leading-tight">
                Arrecadação
              </span>
              <span className="text-[9px] text-slate-400 block mt-0.5 font-medium line-clamp-1">
                Entradas/Extras
              </span>
            </button>
          </div>

          {/* ================= SEÇÃO GASTOS POR CATEGORIA ================= */}
          <div className="bg-[#080a17] border border-blue-500/40 rounded-2xl p-2.5 sm:p-5 shadow-xl space-y-2.5 sm:space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-blue-500/20 px-0.5">
              <div className="flex items-center gap-1.5">
                <PieChart className="w-3 h-3 text-blue-400 shrink-0" />
                <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider leading-none">
                  Gastos por Categoria
                </h3>
              </div>
              <button
                type="button"
                onClick={onOpenFullBalance}
                className="flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-blue-950/80 hover:bg-blue-900 border border-blue-500/40 text-blue-300 text-[10px] sm:text-xs font-extrabold font-mono transition-all cursor-pointer shadow-xs group"
                title="Ver balanço e relatórios completos"
              >
                <span>Ver completo</span>
                <Play className="w-2.5 h-2.5 fill-blue-400 text-blue-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Content Layout: Donut on left, Legend on right */}
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 pt-0.5">
              {/* Donut Chart with Centered Total */}
              <div className="w-32 h-32 sm:w-44 sm:h-44 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={categoryExpensesData.length > 0 ? categoryExpensesData : [{ name: 'Sem gastos', value: 1, color: '#1e293b' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={categoryExpensesData.length > 0 ? 3 : 0}
                      dataKey="value"
                    >
                      {(categoryExpensesData.length > 0 ? categoryExpensesData : [{ name: 'Sem gastos', value: 1, color: '#1e293b' }]).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#080a17" strokeWidth={2} />
                      ))}
                    </Pie>
                    {categoryExpensesData.length > 0 && (
                      <Tooltip
                        formatter={(value: number) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Gasto']}
                        contentStyle={{
                          backgroundColor: '#090d1a',
                          borderColor: '#334155',
                          borderRadius: '10px',
                          fontSize: '11px',
                          color: '#fff',
                        }}
                      />
                    )}
                  </RePieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Total</span>
                  <span className="text-xs sm:text-sm font-black text-white font-mono">
                    R$ {totalExpenses >= 1000 ? `${(totalExpenses / 1000).toFixed(1)}k` : totalExpenses.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Category Indices List (Grid on desktop) */}
              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
                {categoryExpensesData.length === 0 ? (
                  <div className="col-span-2 py-4 text-center">
                    <span className="text-xs text-slate-400 font-medium block">
                      Nenhum gasto registrado neste mês.
                    </span>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Utilize <strong className="text-pink-400 font-semibold">Nova Despesa</strong> para adicionar seus gastos.
                    </p>
                  </div>
                ) : (
                  categoryExpensesData.map((cat) => {
                    const catPct = totalExpenses > 0 ? Math.round((cat.value / totalExpenses) * 100) : 0;
                    return (
                      <div key={cat.name} className="flex items-center justify-between p-2 rounded-xl bg-[#11162e] border border-slate-800/80 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          <span className="text-slate-300 font-medium truncate">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 font-mono">
                          <span className="text-slate-400 text-[11px]">
                            R$ {cat.value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-xs font-black text-purple-300 min-w-[28px] text-right">
                            {catPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ================= RIGHT / SIDEBAR COLUMN (DESKTOP: col-span-4) ================= */}
        <div className="lg:col-span-4 space-y-2.5 sm:space-y-4">
          
          {/* ================= SEÇÃO COFRINHOS ================= */}
          <div className="bg-[#080a17] border border-purple-500/40 rounded-2xl p-2.5 sm:p-4 shadow-xl space-y-2.5 sm:space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-purple-500/20 px-0.5">
              <div className="flex items-center gap-1.5">
                <PiggyBank className="w-3 h-3 text-purple-400 shrink-0" />
                <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider leading-none">
                  Cofrinhos & Sonhos
                </h3>
              </div>

              <button
                type="button"
                onClick={onOpenCofrinhos}
                className="flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 text-purple-300 text-[10px] sm:text-xs font-extrabold font-mono transition-all cursor-pointer shadow-xs group"
                title="Gerenciar todos os cofrinhos"
              >
                <span>Ver todos ({cofrinhos.length})</span>
                <Play className="w-2.5 h-2.5 fill-purple-400 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* Cofrinhos items */}
            {cofrinhos.length > 0 ? (
              <div className="space-y-2">
                {cofrinhos.slice(0, 3).map((item) => {
                  const pct = item.targetAmount > 0
                    ? Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100))
                    : 0;

                  const strokeColor = (() => {
                    switch (item.colorTheme) {
                      case 'purple': return '#a855f7';
                      case 'blue': return '#3b82f6';
                      case 'emerald': return '#10b981';
                      case 'amber': return '#f59e0b';
                      case 'rose': return '#f43f5e';
                      default: return '#6366f1';
                    }
                  })();

                  return (
                    <div
                      key={item.id}
                      onClick={onOpenCofrinhos}
                      className="p-2 sm:p-2.5 rounded-xl bg-[#11152a] border border-slate-800/80 hover:border-purple-500/40 transition-all cursor-pointer group space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white group-hover:text-purple-300 transition-colors">
                          {item.title}
                        </span>
                        <span className="font-mono text-purple-400 font-extrabold text-[11px]">
                          {pct}%
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, pct)}%`, backgroundColor: strokeColor }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <span>R$ {item.currentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        <span className="text-slate-500">Meta: R$ {item.targetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2 flex justify-center w-full">
                <button
                  type="button"
                  onClick={onOpenCofrinhos}
                  className="w-full px-3 py-2 bg-slate-900/90 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 rounded-xl text-xs font-bold text-slate-300 hover:text-purple-300 transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-sm"
                >
                  <div className="w-5 h-5 rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center text-purple-400">
                    <Plus className="w-3 h-3" />
                  </div>
                  <span>Criar Primeiro Cofrinho</span>
                </button>
              </div>
            )}
          </div>

          {/* ================= STATUS DE DESPESAS FIXAS ================= */}
          <div className="bg-[#080a17] border border-amber-500/40 rounded-2xl p-2.5 sm:p-4 shadow-xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-amber-500/20 px-0.5">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-amber-400 shrink-0" />
                <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider leading-none">
                  Contas Fixas do Mês
                </h3>
              </div>

              <button
                type="button"
                onClick={onOpenFixedExpenses}
                className="flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-950/80 hover:bg-amber-900 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-extrabold font-mono transition-all cursor-pointer shadow-xs group"
              >
                <span>Gerenciar</span>
                <Play className="w-2.5 h-2.5 fill-amber-400 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-2 sm:p-2.5 rounded-xl bg-[#13192e] border border-slate-800">
                <span className="text-[10px] font-sans font-medium text-slate-400 block">Pagas</span>
                <span className="text-xs sm:text-sm font-black text-emerald-400">
                  R$ {totalFixedPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-2 sm:p-2.5 rounded-xl bg-[#13192e] border border-slate-800">
                <span className="text-[10px] font-sans font-medium text-slate-400 block">A Vencer</span>
                <span className="text-xs sm:text-sm font-black text-amber-400">
                  R$ {totalFixedToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* ================= GASTOS POR MEMBRO SUMMARY ================= */}
          <div className="bg-[#080a17] border border-pink-500/40 rounded-2xl p-2.5 sm:p-4 shadow-xl space-y-2.5 sm:space-y-3">
            <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-pink-500/20 px-0.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-pink-400 shrink-0" />
                <h3 className="text-[11px] sm:text-xs font-black text-white uppercase tracking-wider leading-none">
                  Gastos por membro
                </h3>
              </div>
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              {members.slice(0, 2).map((m, idx) => {
                const paid = activeTransactions
                  .filter((t) => t.type === 'expense' && t.paidByMemberId === m.id)
                  .reduce((acc, t) => acc + t.amount, 0);
                const formatted = formatMemberName(m.name);

                return (
                  <div key={m.id} className="flex items-center justify-between text-xs p-1.5 sm:p-2 rounded-xl bg-[#12162e] border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white uppercase"
                        style={{ backgroundColor: m.color || (idx === 0 ? '#3b82f6' : '#ec4899') }}
                      >
                        {formatted.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-200 capitalize">{formatted}</span>
                    </div>
                    <span className="font-mono font-bold text-slate-300">
                      R$ {paid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                );
              })}

              {Math.abs(spentDifference) > 0.01 && (
                <div className="p-2 sm:p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-center">
                  <span className="text-[11px] text-purple-200 block font-medium">
                    {spentDifference > 0 ? (
                      <>
                        <strong className="capitalize">{formatMemberName(member1.name)}</strong> gastou <strong>R$ {Math.abs(spentDifference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> a mais que <strong className="capitalize">{formatMemberName(member2.name)}</strong>
                      </>
                    ) : (
                      <>
                        <strong className="capitalize">{formatMemberName(member2.name)}</strong> gastou <strong>R$ {Math.abs(spentDifference).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> a mais que <strong className="capitalize">{formatMemberName(member1.name)}</strong>
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
