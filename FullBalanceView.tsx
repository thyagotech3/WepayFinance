import React, { useState, useMemo, useEffect } from 'react';
import { FamilyGroup, FamilyMember, Transaction, FixedExpenseItem, PiggyBankItem } from '../types';
import { INITIAL_FIXED_EXPENSES } from '../data/mockInitialData';
import { getMonthlyIncomeData } from '../utils/incomeUtils';
import { 
  ChevronLeft, ChevronRight, Calendar, ShoppingCart, TrendingUp,
  CheckCircle2, Clock, HelpCircle, X
} from 'lucide-react';

interface FullBalanceViewProps {
  group: FamilyGroup;
  currentMember?: FamilyMember;
  members: FamilyMember[];
  transactions: Transaction[];
  fixedExpenses?: FixedExpenseItem[];
  cofrinhos?: PiggyBankItem[];
  onBack?: () => void;
  onOpenExpenseModal?: () => void;
  onOpenIncomeModal?: () => void;
  onOpenFixedExpenses?: () => void;
  onOpenCofrinhos?: () => void;
}

export const FullBalanceView: React.FC<FullBalanceViewProps> = ({
  members,
  transactions,
  fixedExpenses: propFixedExpenses,
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

  // Active valid transactions filtered for the selected month
  const activeTransactions = useMemo(() => {
    const valid = transactions.filter((t) => t.status !== 'reverted' && t.status !== 'deleted');
    const filtered = valid.filter((t) => {
      if (!t.date) return true;
      return t.date.startsWith(selectedMonthKey);
    });
    return filtered.length > 0 ? filtered : valid;
  }, [transactions, selectedMonthKey]);

  // Incomes for the selected month
  const incomeData = useMemo(
    () => getMonthlyIncomeData(selectedMonthKey, members),
    [selectedMonthKey, members, incomesVersion]
  );

  const totalFamilyIncome = incomeData.totalFamilyIncome;

  // Fixed expenses
  const fixedExpensesList: FixedExpenseItem[] = useMemo(() => {
    if (propFixedExpenses && propFixedExpenses.length > 0) return propFixedExpenses;
    const saved = localStorage.getItem('wepay_fixed_expenses');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_FIXED_EXPENSES;
  }, [propFixedExpenses, incomesVersion]);

  const totalFixedPaid = useMemo(() => {
    return fixedExpensesList
      .filter((e) => e.isPaid)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [fixedExpensesList]);

  const totalFixedPending = useMemo(() => {
    return fixedExpensesList
      .filter((e) => !e.isPaid)
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [fixedExpensesList]);

  // Expenses for the month
  const totalExpenses = activeTransactions
    .filter((t) => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  // Saldo Atual = Renda total - Gastos
  const currentBalance = totalFamilyIncome - totalExpenses;

  // Saldo Após quitação das dívidas = Renda total - Gastos - Contas pendentes
  const balanceAfterBills = totalFamilyIncome - totalExpenses - totalFixedPending;

  // Reusable card renderer matching HomeDashboard style exactly
  const renderCard = ({
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
    
    // Scale font size according to length and full-width status
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
        {/* Uniform Header across ALL cards */}
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[10px] sm:text-[11px] font-semibold truncate">
            {title}
          </span>
          {icon}
        </div>

        {/* Uniform Value Line */}
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

  return (
    <div className="space-y-3.5 sm:space-y-5 max-w-xl lg:max-w-5xl xl:max-w-6xl mx-auto pb-28 px-1 sm:px-3 text-left">
      
      {/* ================= CONTROLE DE MÊS NO TOPO ================= */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl p-2.5 sm:p-3.5 shadow-lg flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
          title="Mês anterior"
        >
          <ChevronLeft className="w-4 h-4 text-purple-400 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline text-xs font-bold">Mês Anterior</span>
        </button>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider leading-tight">
              Balanço Geral
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-lg font-black text-white uppercase tracking-tight leading-tight">
                {formattedMonthYear}
              </span>
              {isCurrentRealMonth && (
                <span className="hidden xs:inline px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                  Atual
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          className="p-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center gap-1.5 cursor-pointer group shrink-0"
          title="Próximo mês"
        >
          <span className="hidden sm:inline text-xs font-bold">Próximo Mês</span>
          <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* ================= PAINEL DOS CARDS DE BALANÇO (PADRONIZADO) ================= */}
      <div className="bg-gradient-to-br from-[#0c0f24] via-[#090c1b] to-[#070914] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-pink-600/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          
          {/* 1. TOPO: SALDO ATUAL (LINHA INTEIRA) */}
          <div className="col-span-2 lg:col-span-4">
            {renderCard({
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
          </div>

          {/* CARD DE EXPLICAÇÃO DO SALDO ATUAL (ABERTO AO CLICAR NO ?) */}
          {activeExplanation === 'saldo_atual' && (
            <div className="col-span-2 lg:col-span-4 bg-[#171536]/95 border border-purple-500/50 rounded-2xl p-3 sm:p-4 text-xs text-purple-100 flex items-start justify-between gap-3 shadow-xl transition-all">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0 mt-0.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-purple-300 block uppercase tracking-wider">
                    O que é o Saldo Atual?
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    O saldo atual é o que você recebeu, menos o que você gastou e pagou até o momento no mês selecionado.
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

          {/* 2. MEIO: CARDS EM 2 COLUNAS NO MOBILE / 4 COLUNAS NO DESKTOP */}
          {/* Renda Familiar */}
          <div className="col-span-1">
            {renderCard({
              title: 'Renda Familiar',
              value: totalFamilyIncome,
              icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
              colorClass: 'text-emerald-400',
              borderAccent: 'border-slate-800',
            })}
          </div>

          {/* Gastos do Mês */}
          <div className="col-span-1">
            {renderCard({
              title: 'Gastos do Mês',
              value: totalExpenses,
              icon: <ShoppingCart className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
              colorClass: 'text-rose-400',
              borderAccent: 'border-slate-800',
            })}
          </div>

          {/* Contas Pagas */}
          <div className="col-span-1">
            {renderCard({
              title: 'Contas Pagas',
              value: totalFixedPaid,
              icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />,
              colorClass: 'text-teal-400',
              borderAccent: 'border-slate-800',
            })}
          </div>

          {/* Contas Pendentes */}
          <div className="col-span-1">
            {renderCard({
              title: 'Contas Pendentes',
              value: totalFixedPending,
              icon: <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
              colorClass: 'text-amber-400',
              borderAccent: 'border-slate-800',
            })}
          </div>

          {/* 3. FUNDO: SALDO APÓS QUITAÇÃO DAS DÍVIDAS (LINHA INTEIRA) */}
          <div className="col-span-2 lg:col-span-4">
            {renderCard({
              title: 'Saldo Após Quitação das Dívidas',
              value: balanceAfterBills,
              icon: (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveExplanation((prev) => (prev === 'saldo_apos_quitacao' ? null : 'saldo_apos_quitacao'));
                  }}
                  className="p-1 -mr-1 -my-1 rounded-full text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/15 active:scale-90 transition-all cursor-pointer"
                  title="Ver explicação sobre o Saldo Após Quitação"
                  aria-label="Explicação Saldo Após Quitação"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              ),
              colorClass: 'text-cyan-300',
              isFullWidth: true,
              borderAccent: 'border-cyan-500/40',
              isNegativeAllowed: true,
            })}
          </div>

          {/* CARD DE EXPLICAÇÃO DO SALDO APÓS QUITAÇÃO (ABERTO AO CLICAR NO ?) */}
          {activeExplanation === 'saldo_apos_quitacao' && (
            <div className="col-span-2 lg:col-span-4 bg-[#0c1f29]/95 border border-cyan-500/50 rounded-2xl p-3 sm:p-4 text-xs text-cyan-100 flex items-start justify-between gap-3 shadow-xl transition-all">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0 mt-0.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                </div>
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-cyan-300 block uppercase tracking-wider">
                    O que é o Saldo Após Quitação?
                  </span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                    É quanto vai sobrar no final do mês quando você receber toda sua renda e pagar todas as contas, incluindo gastos do dia-a-dia.
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

        </div>
      </div>

    </div>
  );
};
