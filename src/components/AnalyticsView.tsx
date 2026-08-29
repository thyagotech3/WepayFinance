import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { CATEGORIES_META } from '../data/suggestions';
import { PieChart as PieChartIcon, BarChart3, TrendingUp, DollarSign, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, Legend } from 'recharts';

export const AnalyticsView: React.FC = () => {
  const { group, transactions } = useAppStore();
  const members = group?.members || [];

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewScope, setViewScope] = useState<'month' | 'all'>('month');

  const monthKey = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1
  ).padStart(2, '0')}`;

  const formattedMonthYear = useMemo(() => {
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();
    return `${monthName.toUpperCase()} ${year}`;
  }, [currentDate]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const expenses = useMemo(() => {
    const valid = transactions.filter(
      (t) => t.type === 'expense' && t.status !== 'reverted' && t.status !== 'deleted'
    );
    if (viewScope === 'all') return valid;
    return valid.filter((t) => t.date && t.date.startsWith(monthKey));
  }, [transactions, viewScope, monthKey]);

  const totalExpenseAmount = useMemo(
    () => expenses.reduce((acc, t) => acc + t.amount, 0),
    [expenses]
  );

  // Category Aggregation
  const categoryTotals: Record<string, number> = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((t) => {
      totals[t.category] = (totals[t.category] || 0) + t.amount;
    });
    return totals;
  }, [expenses]);

  const pieData = useMemo(() => {
    return Object.keys(categoryTotals)
      .map((catName) => ({
        name: catName,
        value: categoryTotals[catName],
        color: CATEGORIES_META[catName as keyof typeof CATEGORIES_META]?.color || '#64748b',
      }))
      .sort((a, b) => b.value - a.value);
  }, [categoryTotals]);

  // Member Comparison Data
  const memberBarData = useMemo(() => {
    return members.map((m) => {
      const memberSpent = expenses
        .filter((t) => t.paidByMemberId === m.id)
        .reduce((acc, t) => acc + t.amount, 0);

      return {
        name: m.name,
        Gastos: memberSpent,
        fill: m.color,
      };
    });
  }, [members, expenses]);

  return (
    <div className="space-y-3 sm:space-y-4 max-w-xl lg:max-w-7xl mx-auto pb-6">
      {/* Top Header Card with Month Selector */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl p-2.5 sm:p-3.5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-xs sm:text-base font-black text-white uppercase tracking-wider leading-tight">
              Análise & Métricas
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-400">
              Distribuição dos gastos da família e comparativo entre membros
            </p>
          </div>
        </div>

        {/* Month Selector and Scope Toggle */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {viewScope === 'month' && (
            <div className="flex items-center gap-1.5 bg-[#090d1f] border border-slate-800 rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white px-2 uppercase font-mono">
                {formattedMonthYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center bg-[#090d1f] border border-slate-800 rounded-xl p-0.5 text-xs font-bold shrink-0">
            <button
              type="button"
              onClick={() => setViewScope('month')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewScope === 'month'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Mês
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Geral
            </button>
          </div>
        </div>
      </div>

      {/* Summary Total Card */}
      <div className="bg-[#121630]/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 shadow-md flex items-center justify-between">
        <div>
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block">
            {viewScope === 'month' ? `Total de Despesas em ${formattedMonthYear}` : 'Total de Despesas (Todo o Período)'}
          </span>
          <span className="text-xl sm:text-2xl font-black text-white font-mono">
            R$ {totalExpenseAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
          {expenses.length} {expenses.length === 1 ? 'lançamento' : 'lançamentos'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-6">
        {/* Chart 1: Expenses by Category */}
        <div className="bg-[#0c0f24] border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/70">
            <PieChartIcon className="w-4 h-4 text-purple-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-none">
              Distribuição por Categoria
            </h3>
          </div>

          <div className="h-60 sm:h-72 w-full">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Nenhuma despesa registrada para exibir no gráfico.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Gasto']}
                    contentStyle={{ backgroundColor: '#090d1f', borderRadius: '12px', border: '1px solid #334155', color: '#fff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
            {pieData.map((p) => {
              const pct = totalExpenseAmount > 0 ? Math.round((p.value / totalExpenseAmount) * 100) : 0;
              return (
                <div key={p.name} className="flex items-center justify-between text-[11px] p-2 bg-[#121630]/80 border border-slate-800/70 rounded-xl">
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-slate-300 font-bold truncate">{p.name}</span>
                  </div>
                  <span className="font-mono font-bold text-white shrink-0">
                    R$ {p.value.toFixed(0)} <span className="text-[10px] text-slate-400">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Member Comparison Bar Chart */}
        <div className="bg-[#0c0f24] border border-slate-800/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800/70">
            <BarChart3 className="w-4 h-4 text-pink-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-none">
              Comparativo de Membros
            </h3>
          </div>

          <div className="h-60 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberBarData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Total Lançado']}
                  contentStyle={{ backgroundColor: '#090d1f', borderRadius: '12px', border: '1px solid #334155', color: '#fff' }}
                />
                <Bar dataKey="Gastos" radius={[8, 8, 0, 0]}>
                  {memberBarData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
