import React, { useState, useMemo } from 'react';
import { FamilyMember, Transaction, CategoryType } from '../types';
import { formatMemberName } from '../utils/incomeUtils';
import { 
  Search, Trash2, ShoppingCart, ArrowUpRight, ArrowDownRight, 
  History, ChevronLeft, ChevronRight, Calendar, Edit3, X,
  AlertTriangle, Check, Lock, Utensils, Home, Car, Tv,
  HeartPulse, ShoppingBag, Receipt, GraduationCap, Sparkles,
  Layers, TrendingUp, TrendingDown, SlidersHorizontal, FilterX,
  ChevronDown, User, Tag, Eye
} from 'lucide-react';

interface TransactionsViewProps {
  members: FamilyMember[];
  currentMember: FamilyMember;
  transactions: Transaction[];
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction?: (updatedTx: Transaction) => void;
  onOpenExpenseModal?: () => void;
}

const CATEGORIES: CategoryType[] = [
  'Alimentação',
  'Moradia',
  'Transporte',
  'Lazer',
  'Saúde',
  'Compras',
  'Serviços',
  'Educação',
  'Outros',
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Alimentação': <Utensils className="w-3.5 h-3.5" />,
  'Moradia': <Home className="w-3.5 h-3.5" />,
  'Transporte': <Car className="w-3.5 h-3.5" />,
  'Lazer': <Tv className="w-3.5 h-3.5" />,
  'Saúde': <HeartPulse className="w-3.5 h-3.5" />,
  'Compras': <ShoppingBag className="w-3.5 h-3.5" />,
  'Serviços': <Receipt className="w-3.5 h-3.5" />,
  'Educação': <GraduationCap className="w-3.5 h-3.5" />,
  'Outros': <Sparkles className="w-3.5 h-3.5" />,
};

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  members,
  currentMember,
  transactions,
  onDeleteTransaction,
  onUpdateTransaction,
  onOpenExpenseModal,
}) => {
  // Current selected date for month navigation
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'expense' | 'income'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState<boolean>(false);

  // Modal states
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null);
  const [editFormData, setEditFormData] = useState<{
    description: string;
    amount: string;
    category: CategoryType;
    type: 'expense' | 'income';
    paidByMemberId: string;
    date: string;
    notes: string;
  } | null>(null);

  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

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

  // Filter transactions by selected month
  const monthTransactions = useMemo(() => {
    const monthTx = transactions.filter((t) => {
      if (!t.date) return true;
      return t.date.startsWith(selectedMonthKey);
    });
    return monthTx;
  }, [transactions, selectedMonthKey]);

  // Filter transactions by user criteria
  const filtered = monthTransactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchesMember = selectedMember === 'all' || t.paidByMemberId === selectedMember;
    const matchesType = selectedType === 'all' || t.type === selectedType;

    return matchesSearch && matchesCategory && matchesMember && matchesType;
  });

  const displayedTransactions = filtered.filter((t) => t.status !== 'reverted' && t.status !== 'deleted');

  // Count active filter criteria
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedType !== 'all') count++;
    if (selectedCategory !== 'all') count++;
    if (selectedMember !== 'all') count++;
    return count;
  }, [selectedType, selectedCategory, selectedMember]);

  const hasActiveFilters = Boolean(searchTerm.trim() !== '' || activeFiltersCount > 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedMember('all');
  };

  // Stats
  const totalExpense = displayedTransactions
    .filter((t) => t.type === 'expense' && t.status !== 'deleted' && t.status !== 'reverted')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalIncome = displayedTransactions
    .filter((t) => t.type === 'income' && t.status !== 'deleted' && t.status !== 'reverted')
    .reduce((acc, t) => acc + t.amount, 0);

  // Check if a transaction is a fixed expense
  const isFixedExpense = (tx?: Transaction | null) => {
    if (!tx) return false;
    return Boolean(
      tx.fixedExpenseId || 
      tx.isRecurrent || 
      tx.description.toLowerCase().includes('[gasto fixo]')
    );
  };

  // Open item detail / edit modal
  const handleOpenDetailModal = (tx: Transaction) => {
    setSelectedTxForDetail(tx);
    const dateFormatted = tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0];
    setEditFormData({
      description: tx.description,
      amount: String(tx.amount),
      category: tx.category as CategoryType,
      type: tx.type,
      paidByMemberId: tx.paidByMemberId || currentMember.id,
      date: dateFormatted,
      notes: tx.notes || '',
    });
  };

  // Save changes from detail modal (only for regular non-fixed expenses)
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTxForDetail || !editFormData) return;

    if (isFixedExpense(selectedTxForDetail)) {
      return;
    }

    const parsedAmount = parseFloat(editFormData.amount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }

    const updatedTx: Transaction = {
      ...selectedTxForDetail,
      description: editFormData.description.trim() || selectedTxForDetail.description,
      amount: parsedAmount,
      category: editFormData.category,
      type: editFormData.type,
      paidByMemberId: editFormData.paidByMemberId,
      date: editFormData.date ? new Date(`${editFormData.date}T12:00:00`).toISOString() : selectedTxForDetail.date,
      notes: editFormData.notes.trim() || undefined,
    };

    if (onUpdateTransaction) {
      onUpdateTransaction(updatedTx);
    }
    setSelectedTxForDetail(null);
    setEditFormData(null);
  };

  // Confirm delete handler
  const handleConfirmDelete = () => {
    if (!txToDelete) return;
    onDeleteTransaction(txToDelete.id);
    setTxToDelete(null);
    if (selectedTxForDetail?.id === txToDelete.id) {
      setSelectedTxForDetail(null);
      setEditFormData(null);
    }
  };

  const isCurrentTxFixed = isFixedExpense(selectedTxForDetail);
  const selectedTxMember = selectedTxForDetail 
    ? members.find((m) => m.id === selectedTxForDetail.paidByMemberId)
    : null;

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
              Histórico de lançamento
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

      {/* Summary Metrics - Single Unified Card with 2 Discreet Vertical Lines */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl">
        <div className="grid grid-cols-3 divide-x divide-slate-800/80">
          {/* 1. Lançamentos */}
          <div className="pr-2 sm:pr-4 space-y-1 sm:space-y-1.5 flex flex-col justify-center text-left">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-semibold truncate">
                Lançamentos
              </span>
              <History className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            </div>
            <div className="flex items-baseline gap-1 font-mono overflow-hidden">
              <span className="text-base sm:text-xl lg:text-2xl font-black text-white tracking-tight truncate leading-tight">
                {displayedTransactions.length}
              </span>
              <span className="text-[9.5px] sm:text-[11px] font-medium text-slate-500 shrink-0">
                {displayedTransactions.length === 1 ? 'item' : 'itens'}
              </span>
            </div>
          </div>

          {/* 2. Saídas */}
          <div className="px-2 sm:px-4 space-y-1 sm:space-y-1.5 flex flex-col justify-center text-left">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-semibold truncate">
                Saídas
              </span>
              <ShoppingCart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1 font-mono overflow-hidden">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 shrink-0">
                R$
              </span>
              <span className="text-base sm:text-xl lg:text-2xl font-black text-rose-400 tracking-tight truncate leading-tight">
                {totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* 3. Entradas */}
          <div className="pl-2 sm:pl-4 space-y-1 sm:space-y-1.5 flex flex-col justify-center text-left">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] sm:text-[11px] font-semibold truncate">
                Entradas
              </span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1 font-mono overflow-hidden">
              <span className="text-[10px] sm:text-xs font-bold text-slate-400 shrink-0">
                R$
              </span>
              <span className="text-base sm:text-xl lg:text-2xl font-black text-emerald-400 tracking-tight truncate leading-tight">
                {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Transactions Frame & List */}
      <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden">
        
        {/* ================= BARRA DE BUSCA + BOTÃO FILTROS ================= */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-[#0b0e1e]/95 space-y-2.5">
          {/* Search Bar + Filtros Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por descrição, categoria..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botão Filtros */}
            <button
              type="button"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer shrink-0 ${
                isFilterOpen || activeFiltersCount > 0
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-950/50'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800 hover:border-slate-700'
              }`}
              title="Abrir filtros"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>Filtros</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-white text-purple-900 text-[10px] font-black flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Active Filter Tags as individual cards in the same style of the old filter button with X */}
          {activeFiltersCount > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {selectedType !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedType('all')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
                  title="Remover filtro de tipo"
                >
                  <span>{selectedType === 'expense' ? 'Saídas' : 'Entradas'}</span>
                  <X className="w-3 h-3 text-slate-400 group-hover:text-rose-400 transition-colors" />
                </button>
              )}
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
                  title="Remover filtro de categoria"
                >
                  <span>{selectedCategory}</span>
                  <X className="w-3 h-3 text-slate-400 group-hover:text-rose-400 transition-colors" />
                </button>
              )}
              {selectedMember !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedMember('all')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
                  title="Remover filtro de membro"
                >
                  <span>{formatMemberName(members.find(m => m.id === selectedMember)?.name) || 'Membro'}</span>
                  <X className="w-3 h-3 text-slate-400 group-hover:text-rose-400 transition-colors" />
                </button>
              )}

              {/* Card Limpar ao lado dos filtros selecionados */}
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 hover:border-rose-500/60 text-rose-300 hover:text-white text-xs font-semibold shadow-xs transition-all cursor-pointer group"
                title="Limpar todos os filtros"
              >
                <FilterX className="w-3 h-3 text-rose-400 group-hover:rotate-12 transition-transform" />
                <span>Limpar</span>
              </button>
            </div>
          )}
        </div>

        {/* ================= PAINEL DE FILTROS SIMPLIFICADOS (DIRETO ACIMA DA LISTA) ================= */}
        {isFilterOpen && (
          <div className="p-3 sm:p-4 border-b border-purple-500/20 bg-gradient-to-b from-[#0b0e20] to-[#080a18] animate-fadeIn shadow-inner">
            {/* 3 Caixas Lado a Lado: Tipo, Categoria, Quem Pagou na mesma linha */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
              {/* 1. Tipo de Lançamento */}
              <div className="space-y-1 min-w-0">
                <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                  Tipo
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as 'all' | 'expense' | 'income')}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none cursor-pointer transition-colors shadow-inner font-medium truncate"
                >
                  <option value="all">Todos</option>
                  <option value="expense">Saídas</option>
                  <option value="income">Entradas</option>
                </select>
              </div>

              {/* 2. Categoria */}
              <div className="space-y-1 min-w-0">
                <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                  Categoria
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none cursor-pointer transition-colors shadow-inner font-medium truncate"
                >
                  <option value="all">Todos</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Quem Pagou */}
              <div className="space-y-1 min-w-0">
                <label className="text-[9.5px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                  Quem Pagou
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white focus:outline-none cursor-pointer transition-colors shadow-inner font-medium capitalize truncate"
                >
                  <option value="all">Todos</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="capitalize">
                      {formatMemberName(m.name)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. CARTÕES DE LANÇAMENTO MAIS LIMPOS E ESPAÇOSOS ================= */}
        <div className="divide-y divide-slate-800/60">
          {displayedTransactions.length === 0 ? (
            <div className="text-center py-14 px-4 text-slate-500 text-xs space-y-2.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto text-purple-400">
                <History className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-300">Nenhum lançamento encontrado</h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Tente ajustar os filtros, pesquisar por outro termo ou limpar a seleção.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Limpar todos os filtros
                </button>
              )}
            </div>
          ) : (
            displayedTransactions.map((tx) => {
              const paidByMember = members.find((m) => m.id === tx.paidByMemberId);
              const isIncome = tx.type === 'income';
              const isDeleted = tx.status === 'deleted' || tx.status === 'reverted';
              const isFixed = isFixedExpense(tx);

              return (
                <div
                  key={tx.id}
                  onClick={() => handleOpenDetailModal(tx)}
                  className={`group relative p-3 sm:p-4 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isDeleted
                      ? 'bg-red-950/10 opacity-50'
                      : 'hover:bg-[#131733]/90'
                  }`}
                >
                  {/* Left Column: Category Icon + Title and Clean Subtitle */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shrink-0 flex items-center justify-center text-base sm:text-lg shadow-inner group-hover:scale-105 transition-transform ${
                        isIncome
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-pink-500/15 text-pink-400 border border-pink-500/30'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        CATEGORY_ICONS[tx.category] || <ShoppingCart className="w-5 h-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-md group-hover:text-purple-200 transition-colors">
                          {tx.description}
                        </h4>
                        {isDeleted && (
                          <span className="text-[9px] font-black uppercase text-red-400 bg-red-500/20 px-1.5 py-0.2 rounded border border-red-500/30">
                            Cancelado
                          </span>
                        )}
                        {isFixed && (
                          <span className="text-[9px] font-bold text-blue-300 bg-blue-500/20 px-1.5 py-0.2 rounded border border-blue-500/30">
                            Fixa
                          </span>
                        )}
                      </div>

                      {/* Subtitle: Membro + Categoria + Data */}
                      <div className="flex items-center gap-1.5 sm:gap-2 text-[10.5px] sm:text-xs text-slate-400 mt-1 truncate">
                        <span 
                          style={{ color: paidByMember?.color || '#a855f7' }} 
                          className="font-semibold truncate capitalize"
                        >
                          {formatMemberName(paidByMember?.name) || 'Membro'}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="truncate">{tx.category}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400 font-mono shrink-0">
                          {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Amount with full focus & clarity */}
                  <div className="shrink-0 text-right">
                    <span
                      className={`text-sm sm:text-base font-black font-mono block ${
                        isIncome ? 'text-emerald-400' : 'text-pink-400'
                      }`}
                    >
                      {isIncome ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] text-slate-500 group-hover:text-purple-300 font-medium transition-colors hidden sm:block mt-0.5">
                      Toque para detalhes
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= MODAL: DETALHES / EDITAR LANÇAMENTO (Z-[100] ABOVE DOCK) ================= */}
      {selectedTxForDetail && editFormData && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => {
            setSelectedTxForDetail(null);
            setEditFormData(null);
          }}
        >
          <div 
            className="bg-[#0e1224] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 w-full max-w-md shadow-2xl space-y-3 sm:space-y-4 max-h-[92vh] flex flex-col justify-between overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center ${
                  isCurrentTxFixed
                    ? 'bg-blue-500/20 border border-blue-500/40 text-blue-400'
                    : 'bg-purple-500/15 border border-purple-500/30 text-purple-400'
                }`}>
                  {isCurrentTxFixed ? <Lock className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-tight">
                    {isCurrentTxFixed ? 'Despesa Fixa (Histórico)' : 'Editar Lançamento'}
                  </h3>
                  {isCurrentTxFixed && (
                    <span className="text-[10px] text-blue-300 font-semibold block leading-tight">
                      📌 Vinculada às Despesas Fixas
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedTxForDetail(null);
                  setEditFormData(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* IF FIXED EXPENSE: Optimized compact view without scrolling on mobile */}
            {isCurrentTxFixed ? (
              <div className="space-y-2.5 sm:space-y-3 text-left">
                {/* Compact Info Card */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Descrição
                    </span>
                    <span className="text-xs sm:text-sm font-black text-white text-right truncate max-w-[200px]">
                      {selectedTxForDetail.description}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Valor Pago
                    </span>
                    <span className="text-sm sm:text-base font-black font-mono text-pink-400">
                      R$ {selectedTxForDetail.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Quem Pagou
                      </span>
                      <span 
                        style={{ color: selectedTxMember?.color || '#a855f7' }} 
                        className="text-xs font-bold capitalize truncate block"
                      >
                        {formatMemberName(selectedTxMember?.name) || 'Membro'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Categoria
                      </span>
                      <span className="text-xs font-bold text-slate-200 truncate block">
                        {selectedTxForDetail.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">
                      Data
                    </span>
                    <span className="text-slate-300 font-mono">
                      {new Date(selectedTxForDetail.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Notice: Como Editar Despesa Fixa */}
                <div className="bg-gradient-to-r from-blue-950/70 via-indigo-950/60 to-purple-950/60 border border-blue-500/40 rounded-xl p-2.5 sm:p-3 space-y-1.5 shadow-md">
                  <div className="flex items-center gap-1.5 text-blue-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-white">
                      Edição Bloqueada no Histórico
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 leading-relaxed">
                    Esta despesa fixa não pode ser editada aqui. Para alterá-la, <strong>apague este histórico</strong> e edite a conta diretamente na aba <strong>Despesas Fixas</strong>.
                  </p>
                </div>

                {/* Footer Buttons for Fixed Expense */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTxForDetail(null);
                      setEditFormData(null);
                    }}
                    className="px-3 sm:px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const tx = selectedTxForDetail;
                      setSelectedTxForDetail(null);
                      setEditFormData(null);
                      setTxToDelete(tx);
                    }}
                    className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-rose-950/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Apagar do Histórico</span>
                  </button>
                </div>
              </div>
            ) : (
              /* REGULAR TRANSACTION FORM (Compact & Optimized) */
              <form onSubmit={handleSaveEdit} className="space-y-2.5 sm:space-y-3 text-left">
                {/* Descrição */}
                <div className="space-y-0.5">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Descrição
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    placeholder="Ex: Supermercado"
                  />
                </div>

                {/* Grid: Valor & Tipo */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Valor (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Tipo
                    </label>
                    <select
                      value={editFormData.type}
                      onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value as 'expense' | 'income' })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer h-[34px] sm:h-[38px]"
                    >
                      <option value="expense">Gasto / Saída</option>
                      <option value="income">Entrada / Receita</option>
                    </select>
                  </div>
                </div>

                {/* Grid: Categoria & Quem Pagou */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Categoria
                    </label>
                    <select
                      value={editFormData.category}
                      onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value as CategoryType })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer h-[34px] sm:h-[38px]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Quem Pagou
                    </label>
                    <select
                      value={editFormData.paidByMemberId}
                      onChange={(e) => setEditFormData({ ...editFormData, paidByMemberId: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs sm:text-sm text-white focus:outline-none focus:border-purple-500 cursor-pointer capitalize h-[34px] sm:h-[38px]"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id} className="capitalize">
                          {formatMemberName(m.name)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-0.5">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Data
                  </label>
                  <input
                    type="date"
                    value={editFormData.date}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  />
                </div>

                {/* Footer Actions: Excluir, Fechar, Salvar */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      const tx = selectedTxForDetail;
                      setSelectedTxForDetail(null);
                      setEditFormData(null);
                      setTxToDelete(tx);
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>Excluir</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTxForDetail(null);
                        setEditFormData(null);
                      }}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                    >
                      Fechar
                    </button>

                    <button
                      type="submit"
                      className="px-3 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-purple-900/40 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span>Salvar</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIRMAÇÃO DE EXCLUSÃO (Z-[110] ABOVE EVERYTHING) ================= */}
      {txToDelete && (
        <div 
          className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setTxToDelete(null)}
        >
          <div 
            className="bg-[#0e1224] border border-rose-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-3.5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Confirmar Exclusão
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pergunta Principal */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm font-bold text-slate-200">
                Deseja excluir esse lançamento do histórico?
              </p>

              {/* Item Preview Card */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 sm:p-3 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <p className="text-xs font-bold text-white truncate">
                    {txToDelete.description}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {new Date(txToDelete.date).toLocaleDateString('pt-BR')} • {txToDelete.category}
                  </p>
                </div>
                <span className={`text-xs sm:text-sm font-mono font-black shrink-0 ${
                  txToDelete.type === 'income' ? 'text-emerald-400' : 'text-pink-400'
                }`}>
                  {txToDelete.type === 'income' ? '+' : '-'} R$ {txToDelete.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Atenção Despesa Fixa */}
            {isFixedExpense(txToDelete) && (
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2.5 sm:p-3 flex items-start gap-2 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium leading-snug">
                  <strong className="text-amber-300 font-bold block mb-0.5">Atenção:</strong>
                  Essa é uma despesa fixa, ao apagar o histórico ela volta ao estado de conta não paga na página de despesas fixas.
                </p>
              </div>
            )}

            {/* Confirmation Buttons: Sim / Não */}
            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Não
              </button>

              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-black shadow-lg shadow-rose-950/50 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Sim, Excluir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
