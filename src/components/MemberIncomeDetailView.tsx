import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Filter,
  DollarSign,
  Sparkles,
  Wallet,
  ListFilter,
  TrendingUp,
  Star,
  RotateCcw,
  ArrowLeft,
  History,
  Briefcase,
  Utensils,
  ArrowDownLeft,
} from 'lucide-react';
import { FamilyMember, IncomeStream, IncomeNature, Transaction, IncomeHistoryEntry } from '../types';
import { formatIncomeDueDate } from './CoupleSplitView';
import { getStreamAmount, formatMemberName } from '../utils/incomeUtils';

interface MemberIncomeDetailViewProps {
  member: FamilyMember;
  avatarEmoji?: string;
  streams: IncomeStream[];
  initialDate?: Date;
  onClose: () => void;
  onAddStream: (targetMonthKey?: string) => void;
  onEditStream: (stream: IncomeStream, targetMonthKey?: string) => void;
  onDeleteStream: (stream: IncomeStream, targetMonthKey?: string) => void;
  onToggleReceived: (streamId: string, customReceivedDate?: string, forceReceived?: boolean, targetMonthKey?: string) => void;
  onUpdateStreamAmount: (
    streamId: string,
    newAmount: number,
    notes?: string,
    history?: IncomeHistoryEntry[],
    lastEntryAmount?: number,
    targetMonthKey?: string
  ) => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
  initialSelectedStream?: IncomeStream | null;
}

export const MemberIncomeDetailView: React.FC<MemberIncomeDetailViewProps> = ({
  member,
  avatarEmoji,
  streams,
  initialDate,
  onClose,
  onAddStream,
  onEditStream,
  onDeleteStream,
  onToggleReceived,
  onUpdateStreamAmount,
  onAddTransaction,
  initialSelectedStream,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || new Date());
  const [filterNature, setFilterNature] = useState<'all' | 'fixed' | 'vales' | 'extra' | 'received' | 'pending'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [incomesVersion, setIncomesVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setIncomesVersion((v) => v + 1);
    window.addEventListener('wepay_incomes_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('wepay_incomes_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handlePrevMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const detailMonthKey = useMemo(() => {
    return `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedDate]);

  const formattedMonthYear = useMemo(() => {
    const monthName = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
    const year = selectedDate.getFullYear();
    return `${monthName.toUpperCase()} ${year}`;
  }, [selectedDate]);

  const isCurrentRealMonth = useMemo(() => {
    const now = new Date();
    return selectedDate.getFullYear() === now.getFullYear() && selectedDate.getMonth() === now.getMonth();
  }, [selectedDate]);

  // Income Stream Action Modal (Confirm receipt / Change date / Edit / Delete)
  const [actionModalStream, setActionModalStream] = useState<IncomeStream | null>(null);
  const [receivedDateInput, setReceivedDateInput] = useState<string>('');
  const [registerAmountInput, setRegisterAmountInput] = useState<string>('');
  const [registerNoteInput, setRegisterNoteInput] = useState<string>('');
  const [showAddGanhoForm, setShowAddGanhoForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAllEntriesView, setShowAllEntriesView] = useState(false);

  // Dynamic streams for currently viewed month
  const activeStreamsForMonth = useMemo(() => {
    try {
      const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
      if (saved) {
        const map = JSON.parse(saved);
        if (map?.[detailMonthKey]?.[member.id] && Array.isArray(map[detailMonthKey][member.id])) {
          return map[detailMonthKey][member.id];
        }
        if (map?.[member.id] && Array.isArray(map[member.id])) {
          return map[member.id];
        }
      }
    } catch (e) {
      console.error(e);
    }
    return streams;
  }, [detailMonthKey, member.id, streams, incomesVersion]);

  // Ensure unique streams to prevent duplicate keys and duplicate metrics
  const uniqueStreams = useMemo(() => {
    const seen = new Set<string>();
    return activeStreamsForMonth.filter((s) => {
      const key = s.id || `${s.name}-${s.dueDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [activeStreamsForMonth]);

  // Calculate Totals
  const totalPredicted = uniqueStreams.reduce((acc, s) => {
    if (s.nature === 'extra') {
      return acc + Math.max(s.targetGoal || 0, s.amount || 0);
    }
    return acc + getStreamAmount(s);
  }, 0);
  const totalReceived = uniqueStreams.reduce((acc, s) => {
    if (s.nature === 'extra') {
      return acc + (s.amount || 0);
    }
    return s.received ? acc + getStreamAmount(s) : acc;
  }, 0);
  const totalPending = Math.max(0, totalPredicted - totalReceived);
  const receivedCount = uniqueStreams.filter((s) => (s.nature === 'extra' ? (s.amount || 0) > 0 : s.received)).length;
  const progressPct = totalPredicted > 0 ? Math.round((totalReceived / totalPredicted) * 100) : 0;

  const memberFixed = uniqueStreams.filter(s => s.nature === 'fixed').reduce((a, s) => a + getStreamAmount(s), 0);
  const memberVales = uniqueStreams.filter(s => s.nature === 'vales').reduce((a, s) => a + getStreamAmount(s), 0);
  const memberExtra = uniqueStreams.filter(s => s.nature === 'extra').reduce((a, s) => a + Math.max(s.targetGoal || 0, s.amount || 0), 0);

  // Filter Streams
  const filteredStreams = uniqueStreams.filter((stream) => {
    if (filterNature === 'fixed') return stream.nature === 'fixed';
    if (filterNature === 'vales') return stream.nature === 'vales';
    if (filterNature === 'extra') return stream.nature === 'extra';
    if (filterNature === 'received') return stream.nature === 'extra' ? (stream.amount || 0) > 0 : stream.received;
    if (filterNature === 'pending') return stream.nature === 'extra' ? (stream.amount || 0) === 0 : !stream.received;
    return true;
  });

  const getNatureBadge = (nature: IncomeNature) => {
    switch (nature) {
      case 'fixed':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/50">Fixa</span>;
      case 'vales':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-950/80 text-amber-300 border border-amber-800/50">Vales</span>;
      case 'extra':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-950/80 text-blue-300 border border-blue-800/50">Extra</span>;
    }
  };

  const getDisplayDate = (stream: IncomeStream) => {
    if (stream.receivedDate) {
      if (stream.receivedDate.includes('-')) {
        const parts = stream.receivedDate.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}`;
        }
      }
      return stream.receivedDate;
    }
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    return `${d}/${m}`;
  };

  const getShortMonthName = (monthKeyOrName: string) => {
    const monthsMap: Record<string, string> = {
      '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr', '05': 'Mai', '06': 'Jun',
      '07': 'Jul', '08': 'Ago', '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
      'janeiro': 'Jan', 'fevereiro': 'Fev', 'março': 'Mar', 'marco': 'Mar', 'abril': 'Abr',
      'maio': 'Mai', 'junho': 'Jun', 'julho': 'Jul', 'agosto': 'Ago', 'setembro': 'Set',
      'outubro': 'Out', 'novembro': 'Nov', 'dezembro': 'Dez'
    };
    if (monthKeyOrName && monthKeyOrName.includes('-')) {
      const monthNum = monthKeyOrName.split('-')[1];
      if (monthsMap[monthNum]) return monthsMap[monthNum];
    }
    if (monthKeyOrName) {
      const lower = monthKeyOrName.toLowerCase();
      for (const [k, v] of Object.entries(monthsMap)) {
        if (lower.includes(k)) return v;
      }
    }
    return 'Ago';
  };

  const getPredictedFontSize = (amount: number) => {
    const formatted = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const len = formatted.length;
    if (len > 13) {
      return 'text-lg sm:text-2xl md:text-3xl';
    }
    if (len > 10) {
      return 'text-xl sm:text-[26px] md:text-[32px]';
    }
    if (len > 8) {
      return 'text-2xl sm:text-[30px] md:text-[36px]';
    }
    // +70% expansion: 16px -> 27px on mobile, 20px -> 34px on tablet, 24px -> 40px on desktop
    return 'text-[27px] sm:text-[34px] md:text-[40px]';
  };

  const openActionModal = (stream: IncomeStream) => {
    const freshStream = activeStreamsForMonth.find((s) => s.id === stream.id) || stream;
    setActionModalStream(freshStream);
    setShowAddGanhoForm(false);
    setShowDeleteConfirm(false);
    setShowAllEntriesView(false);
    setRegisterNoteInput('');
    // Default date input format YYYY-MM-DD
    if (freshStream.receivedDate && freshStream.receivedDate.includes('-')) {
      setReceivedDateInput(freshStream.receivedDate);
    } else {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const dueVal = Number(freshStream.dueDate);
      const dayNum = !isNaN(dueVal) && dueVal > 0 ? Math.min(31, Math.max(1, dueVal)) : 7;
      const dayStr = String(dayNum).padStart(2, '0');
      setReceivedDateInput(`${year}-${month}-${dayStr}`);
    }
    if (freshStream.nature === 'extra') {
      setRegisterAmountInput('');
    } else {
      setRegisterAmountInput(String(getStreamAmount(freshStream) || ''));
    }
  };

  const handleCloseActionModal = () => {
    setActionModalStream(null);
    if (initialSelectedStream) {
      onClose();
    }
  };

  React.useEffect(() => {
    if (initialSelectedStream) {
      openActionModal(initialSelectedStream);
    }
  }, [initialSelectedStream]);

  const monthsList = ['Julho 2025', 'Agosto 2025', 'Setembro 2025', 'Outubro 2025'];

  return (
    <div className="fixed top-0 left-0 right-0 bottom-[64px] md:bottom-0 z-40 bg-black/90 backdrop-blur-md flex justify-center p-0 sm:p-3 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#080b14] border-x sm:border border-slate-800/80 w-full max-w-2xl min-h-full sm:min-h-0 sm:my-auto sm:rounded-2xl p-2.5 sm:p-5 pb-6 shadow-2xl space-y-2.5 sm:space-y-4 text-white relative">
        
        {/* ========================================== */}
        {/* 1. TOP MONTH SELECTOR CARD (< Mês >)       */}
        {/* ========================================== */}
        <div className="bg-[#0e1224] border border-slate-800/80 rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-lg flex items-center justify-between gap-1.5 sm:gap-2">
          {/* Left: Previous Month button */}
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center justify-center cursor-pointer group shrink-0"
            title="Mês anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          {/* Center: Member Avatar / Icon + Label (RENDAS THYAGO) + Month Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border p-0.5 shrink-0 flex items-center justify-center shadow-md shadow-purple-950/40"
              style={{ borderColor: member.color || '#8b5cf6' }}
            >
              <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-white font-extrabold text-xs sm:text-sm"
                    style={{ backgroundColor: member.color || '#8b5cf6' }}
                  >
                    {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col text-left min-w-0">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-tight truncate">
                RENDAS {formatMemberName(member.name).toUpperCase()}
              </span>
              <span className="text-xs sm:text-base font-black text-white uppercase tracking-tight leading-tight truncate">
                {formattedMonthYear}
              </span>
            </div>
          </div>

          {/* Right: Next Month button + Close (X) button */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all flex items-center justify-center cursor-pointer group shrink-0"
              title="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 sm:w-8 sm:h-8 text-slate-400 hover:text-white bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-lg sm:rounded-xl transition-colors cursor-pointer active:scale-90 flex items-center justify-center shrink-0"
              title="Fechar"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* ========================================== */}
        {/* 2. TOP SUMMARY CARD (TOTAIS)               */}
        {/* ========================================== */}
        <div className="bg-[#0d1121] border border-slate-800/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 space-y-2 sm:space-y-2.5 shadow-lg">
          {/* Renda Total Prevista no mesmo padrão de Total Recebido e Falta Receber */}
          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-slate-400">
              <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
                Renda Total Prevista
              </span>
            </div>
            <div className={`font-black text-white font-mono tracking-tight leading-tight transition-all duration-200 flex items-baseline gap-1.5 ${getPredictedFontSize(totalPredicted)}`}>
              <span className="text-xs sm:text-sm md:text-base font-bold text-slate-400 select-none">R$</span>
              <span>{totalPredicted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Abaixo: Total Recebido e Falta Receber lado a lado com números destacados e ícones na cor do texto */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/70">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1 text-slate-400">
                <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
                  Total Recebido
                </span>
              </div>
              <div className="font-black text-emerald-400 font-mono text-base sm:text-xl md:text-2xl tracking-tight truncate leading-tight flex items-baseline gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-emerald-400/70 select-none">R$</span>
                <span>{totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-0.5 pl-2 border-l border-slate-800/70">
              <div className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
                  Falta Receber
                </span>
              </div>
              <div className="font-black text-amber-400 font-mono text-base sm:text-xl md:text-2xl tracking-tight truncate leading-tight flex items-baseline gap-1">
                <span className="text-[10px] sm:text-xs font-bold text-amber-400/70 select-none">R$</span>
                <span>{totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 3. THREE INCOME NATURES IN SINGLE CARD     */}
        {/* ========================================== */}
        <div className="bg-[#0e1224] border border-slate-800/80 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-sm">
          <div className="grid grid-cols-3 divide-x divide-slate-800/80 text-left">
            {/* Col 1: Renda Fixa */}
            <div className="pr-2 sm:pr-3 flex flex-col justify-center space-y-1 min-w-0">
              <div className="flex items-center gap-1 text-slate-400">
                <Briefcase className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400 shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold block truncate">
                  Renda Fixa
                </span>
              </div>
              <div className="text-xs sm:text-base font-black text-white font-mono tracking-tight truncate">
                R$ {memberFixed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>

            {/* Col 2: Vales */}
            <div className="px-2 sm:px-3 flex flex-col justify-center space-y-1 min-w-0">
              <div className="flex items-center gap-1 text-slate-400">
                <Utensils className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400 shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold block truncate">
                  Vales
                </span>
              </div>
              <div className="text-xs sm:text-base font-black text-white font-mono tracking-tight truncate">
                R$ {memberVales.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>

            {/* Col 3: Renda Extra */}
            <div className="pl-2 sm:pl-3 flex flex-col justify-center space-y-1 min-w-0">
              <div className="flex items-center gap-1 text-slate-400">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-purple-400 shrink-0" />
                <span className="text-[10px] sm:text-xs font-semibold block truncate">
                  Renda Extra
                </span>
              </div>
              <div className="text-xs sm:text-base font-black text-white font-mono tracking-tight truncate">
                R$ {memberExtra.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* 4. SECTION: RENDAS                         */}
        {/* ========================================== */}
        <div className="space-y-2 sm:space-y-2.5">
          <div className="flex items-center justify-between gap-1.5">
            {/* Left side: "Rendas" Title + Filter dropdown directly on its right */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight shrink-0">
                Rendas
              </h3>

              {/* Filter Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Filter className="w-3 h-3 text-purple-400" />
                  <span className="capitalize truncate max-w-[70px] sm:max-w-none">
                    {filterNature === 'all' ? 'Todos' : filterNature === 'fixed' ? 'Fixas' : filterNature === 'vales' ? 'Vales' : filterNature === 'extra' ? 'Extras' : filterNature === 'received' ? 'Recebidas' : 'Pendentes'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showFilterDropdown && (
                  <div className="absolute left-0 mt-1.5 w-36 sm:w-40 bg-[#0f1426] border border-slate-800 rounded-xl shadow-2xl py-1 z-30 space-y-0.5">
                    {[
                      { key: 'all', label: 'Todos' },
                      { key: 'fixed', label: 'Renda Fixa' },
                      { key: 'vales', label: 'Vales' },
                      { key: 'extra', label: 'Renda Extra' },
                      { key: 'received', label: 'Recebidas' },
                      { key: 'pending', label: 'Pendentes' },
                    ].map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => {
                          setFilterNature(f.key as any);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-800 transition-colors ${
                          f.key === filterNature ? 'text-purple-400 font-bold bg-purple-950/30' : 'text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Nova Renda Button */}
            <button
              type="button"
              onClick={() => onAddStream(detailMonthKey)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-[11px] sm:text-xs rounded-lg sm:rounded-xl shadow-md shadow-purple-950/60 flex items-center gap-1 transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nova renda</span>
            </button>
          </div>

          {/* Income Items List */}
          {filteredStreams.length === 0 ? (
            <div className="bg-[#0d1121] border border-slate-800/90 rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center space-y-2 sm:space-y-3">
              <p className="text-xs text-slate-400">Nenhuma renda encontrada com este filtro.</p>
              <button
                type="button"
                onClick={() => onAddStream(detailMonthKey)}
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg sm:rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Adicionar Renda
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {filteredStreams.map((stream, idx) => {
                const isExtra = stream.nature === 'extra';
                const receivedAmt = isExtra ? (stream.amount || 0) : (stream.received ? getStreamAmount(stream) : 0);
                const expectedAmt = isExtra ? Math.max(stream.targetGoal || 0, stream.amount || 0) : getStreamAmount(stream);
                const formattedDay = formatIncomeDueDate(stream.dueDate);
                const isReceived = isExtra ? ((stream.amount || 0) > 0) : !!stream.received;
                const extraPct = expectedAmt > 0 ? Math.min(100, Math.round(((stream.amount || 0) / expectedAmt) * 100)) : 0;

                return (
                  <div
                    key={stream.id ? `${stream.id}-${idx}` : `stream-${idx}`}
                    onClick={() => openActionModal(stream)}
                    className="bg-[#0d1121] border border-slate-800/90 hover:border-slate-700/90 rounded-xl sm:rounded-2xl p-2.5 sm:p-3.5 shadow-md transition-all cursor-pointer active:scale-[0.99] group relative"
                  >
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Left Column: Icon + Uppercase Name, Badge + Forecast Date below, Status text below that */}
                      <div className="min-w-0 space-y-0.5 sm:space-y-1">
                        {/* Line 1: Icon + Uppercase Name */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs sm:text-sm shrink-0">
                            {stream.icon || (stream.nature === 'fixed' ? '💼' : stream.nature === 'vales' ? '🎁' : '🚗')}
                          </span>
                          <h4 className="text-xs sm:text-sm font-extrabold text-white truncate uppercase tracking-tight">
                            {stream.name}
                          </h4>
                        </div>

                        {/* Line 2: Badge (Extra / Fixa / Vales) to the left of Forecast Date */}
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                          {getNatureBadge(stream.nature)}
                          <span>
                            {(() => {
                              const digits = String(stream.dueDate || '').replace(/\D/g, '');
                              if (digits && parseInt(digits, 10) > 0) {
                                return `Previsto ${parseInt(digits, 10)}/${getShortMonthName(detailMonthKey)}`;
                              }
                              return 'S/ Previsão';
                            })()}
                          </span>
                        </div>

                        {/* Line 3: Status text */}
                        {isExtra ? (
                          (stream.amount || 0) > 0 ? (
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 pt-0.5">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span>Atualizado {getDisplayDate(stream)}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-slate-400 pt-0.5">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>S/ registro</span>
                            </div>
                          )
                        ) : isReceived ? (
                          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-emerald-400 pt-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Recebido {getDisplayDate(stream)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-amber-400 pt-0.5">
                            <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>Aguardando</span>
                          </div>
                        )}
                      </div>

                      {/* Right Column: Amounts + Check Circle / Percentage */}
                      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        <div className="text-right">
                          <span className="text-[9px] font-semibold text-slate-400 block uppercase">
                            Recebido
                          </span>
                          <div className="flex items-baseline justify-end gap-0.5 font-mono text-emerald-400">
                            <span className="text-base sm:text-lg font-black leading-tight">
                              R$ {receivedAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-end gap-1 font-mono text-white mt-0.5">
                            <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase">DE</span>
                            <span className="text-base sm:text-lg font-black text-white leading-tight">
                              R$ {expectedAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Circle with checkmark for fixed / % for extra */}
                        {isExtra ? (
                          (stream.amount || 0) >= expectedAmt && expectedAmt > 0 ? (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-950/90 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 shadow-md group-hover:scale-105 transition-transform">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-950/90 border-2 border-blue-500 flex items-center justify-center text-blue-400 text-[9.5px] sm:text-[10px] font-black shrink-0 shadow-md group-hover:scale-105 transition-transform">
                              {extraPct}%
                            </div>
                          )
                        ) : isReceived ? (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-950/90 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0 shadow-md group-hover:scale-105 transition-transform">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border-2 border-amber-500/80 flex items-center justify-center text-amber-400 text-[9.5px] sm:text-[10px] font-black shrink-0 shadow-md group-hover:scale-105 transition-transform">
                            0%
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ========================================== */}
      {/* 5. MODAL: DETALHES DA RENDA (FX / EXTRA)   */}
      {/* ========================================== */}
      {actionModalStream && typeof document !== 'undefined' && createPortal(
        (() => {
          const isExtra = actionModalStream.nature === 'extra';
          const streamAmt = isExtra ? (actionModalStream.amount || 0) : getStreamAmount(actionModalStream);
          const targetGoal = isExtra ? (actionModalStream.targetGoal || 0) : streamAmt;
          const formattedDay = formatIncomeDueDate(actionModalStream.dueDate);
          const isReceived = isExtra ? ((actionModalStream.amount || 0) > 0) : !!actionModalStream.received;

          let displayDate = '07/08/2026';
          if (receivedDateInput) {
            const parts = receivedDateInput.split('-');
            if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
          } else if (actionModalStream.receivedDate) {
            if (actionModalStream.receivedDate.includes('-')) {
              const parts = actionModalStream.receivedDate.split('-');
              if (parts.length === 3) displayDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
              else displayDate = actionModalStream.receivedDate;
            } else {
              displayDate = actionModalStream.receivedDate;
            }
          }

          const isExceeded = streamAmt > targetGoal;
          const diffAmt = isExceeded ? (streamAmt - targetGoal) : (targetGoal - streamAmt);
          const missingAmt = Math.max(0, targetGoal - streamAmt);
          const goalPct = targetGoal > 0 ? Math.round((streamAmt / targetGoal) * 100) : 100;

          return (
            <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
              <div className="bg-[#0b0f1d] border border-slate-800/90 rounded-xl sm:rounded-2xl max-w-md w-full p-3.5 sm:p-5 shadow-2xl space-y-2.5 sm:space-y-3.5 text-white my-auto max-h-[92vh] overflow-y-auto scrollbar-thin">
              
              {/* Header Row */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                  <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-md ${
                    isExtra
                      ? 'bg-blue-950/80 border-blue-800/60 text-blue-400'
                      : 'bg-purple-950/80 border-purple-800/60 text-purple-300'
                  }`}>
                    {actionModalStream.icon || (actionModalStream.nature === 'fixed' ? '💼' : actionModalStream.nature === 'vales' ? '🎁' : '🚗')}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-black text-white truncate">{actionModalStream.name}</h3>
                      {getNatureBadge(actionModalStream.nature)}
                    </div>
                    {isExtra ? (
                      <span className="text-[10.5px] sm:text-[11px] text-slate-400 font-medium block mt-0.5">
                        Meta mensal: R$ {targetGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-[10.5px] sm:text-[11px] text-slate-400 font-medium block mt-0.5">
                        Todo dia {formattedDay !== 's/ previsão' ? formattedDay : '07'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCloseActionModal}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform shrink-0"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* ==================================== */}
              {/* IF RENDA FIXA / VALES (COMPACT MOBILE) */}
              {/* ==================================== */}
              {!isExtra ? (
                <>
                  {/* Resumo deste mês sem moldura (com 2 linhas verticais divisórias) */}
                  <div className="py-1 space-y-1">
                    <h4 className="text-xs font-bold text-slate-300 px-0.5">Resumo deste mês</h4>
                    <div className="grid grid-cols-3 divide-x divide-slate-800/80 text-center py-1">
                      <div className="px-1">
                        <span className="text-[10px] text-slate-400 block font-semibold">Valor previsto</span>
                        <span className="text-xs sm:text-sm font-black text-purple-400 font-mono block mt-0.5">
                          R$ {streamAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                          {formattedDay !== 's/ previsão' ? `${formattedDay}/08` : '07/08'}
                        </span>
                      </div>

                      <div className="px-1">
                        <span className="text-[10px] text-slate-400 block font-semibold">Valor recebido</span>
                        <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono block mt-0.5">
                          R$ {(isReceived ? streamAmt : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-emerald-400/90 font-mono font-medium block mt-0.5 min-h-[15px]">
                          {isReceived ? (displayDate.includes('/') ? displayDate.split('/').slice(0, 2).join('/') : displayDate) : ''}
                        </span>
                      </div>

                      <div className="px-1 flex flex-col items-center justify-center">
                        <span className="text-[10px] text-slate-400 block font-semibold mb-1">Status</span>
                        {isReceived ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Recebido
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-950/80 border border-amber-500/50 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Pendente
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recebido em + Ação Confirmar/Desfazer side-by-side */}
                  <div className="bg-[#0d1121] border border-slate-800/90 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-2">
                    <div className="relative flex items-center gap-2 min-w-0 bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 rounded-lg sm:rounded-xl px-2 sm:px-2.5 py-1.5 transition-colors cursor-pointer group">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-950/90 border border-purple-800/60 flex items-center justify-center text-purple-400 group-hover:text-purple-300 shrink-0 shadow-sm">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                      <div className="min-w-0 pr-1">
                        <span className="text-[9.5px] sm:text-[10px] font-semibold text-slate-400 block leading-tight">Recebido em</span>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono font-bold text-white truncate group-hover:text-purple-300 transition-colors">
                            {displayDate}
                          </span>
                          <Calendar className="w-3 h-3 text-purple-400 shrink-0 opacity-80 group-hover:opacity-100" />
                        </div>
                      </div>
                      <input
                        type="date"
                        value={receivedDateInput}
                        onChange={(e) => setReceivedDateInput(e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        title="Clique para abrir o calendário e alterar a data"
                      />
                    </div>

                    <div className="shrink-0">
                      {isReceived ? (
                        <button
                          type="button"
                          onClick={() => {
                            onToggleReceived(actionModalStream.id, undefined, false, detailMonthKey);
                            handleCloseActionModal();
                          }}
                          className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-lg sm:rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                          <span>Desfazer</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            let formattedDate = receivedDateInput;
                            if (receivedDateInput.includes('-')) {
                              const [y, m, d] = receivedDateInput.split('-');
                              formattedDate = `${d}/${m}`;
                            }
                            onToggleReceived(actionModalStream.id, formattedDate, true, detailMonthKey);
                            handleCloseActionModal();
                          }}
                          className="px-3 sm:px-3.5 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg sm:rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-950/60 transition-all cursor-pointer active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                          <span>Confirmar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* ==================================== */
                /* IF RENDA EXTRA                       */
                /* ==================================== */
                <>
                  {/* Goal & Metrics Progress Card */}
                  <div className="bg-[#0d1121] border border-slate-800/90 rounded-xl p-3 sm:p-3.5 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <span className="text-[10.5px] font-semibold text-slate-400 block">Recebido</span>
                        <span className="text-sm sm:text-base font-black text-blue-400 font-mono block mt-0.5">
                          R$ {streamAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10.5px] font-semibold text-slate-400 block">Meta mensal</span>
                        <span className="text-xs sm:text-sm font-black text-white font-mono block mt-0.5">
                          R$ {targetGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10.5px] font-semibold text-slate-400 block">
                          {isExceeded ? 'Ultrapassou' : 'Faltam'}
                        </span>
                        <span className={`text-xs sm:text-sm font-black font-mono block mt-0.5 ${isExceeded ? 'text-emerald-400' : 'text-amber-500'}`}>
                          R$ {diffAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800/80">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-emerald-500' : 'bg-blue-600'}`}
                          style={{ width: `${Math.min(100, goalPct)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 block">
                        {goalPct}% da meta
                      </span>
                    </div>
                  </div>

                  {/* Content Switch: Show All Entries History View OR Add Gain & Last Entry */}
                  {showAllEntriesView ? (
                    <div className="space-y-3 animate-in fade-in">
                      {/* Header for History View */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <button
                          type="button"
                          onClick={() => setShowAllEntriesView(false)}
                          className="flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4 text-blue-400" />
                          <span>Voltar</span>
                        </button>
                        <div className="text-center">
                          <h4 className="text-xs font-bold text-white flex items-center gap-1.5 justify-center">
                            <History className="w-3.5 h-3.5 text-blue-400" />
                            <span>Todos os Lançamentos</span>
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium">{actionModalStream.name}</p>
                        </div>
                        <div className="w-12"></div>
                      </div>

                      {/* Summary Banner */}
                      <div className="bg-[#090d1c] border border-blue-900/50 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Total Acumulado</span>
                          <span className="text-sm font-black font-mono text-emerald-400">
                            R$ {(actionModalStream.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Registros</span>
                          <span className="text-xs font-bold font-mono text-blue-300">
                            {(actionModalStream.history || []).length} { (actionModalStream.history || []).length === 1 ? 'item' : 'itens' }
                          </span>
                        </div>
                      </div>

                      {/* Entries History List */}
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {(actionModalStream.history && actionModalStream.history.length > 0) ? (
                          actionModalStream.history.map((item) => (
                            <div key={item.id} className="bg-[#0d1121] border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 text-xs shrink-0 font-mono font-bold">
                                  +
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[11px] font-bold text-white block truncate">
                                    {item.date} • {actionModalStream.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block truncate">
                                    {item.notes ? item.notes : 'Ganho registrado'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-mono font-bold text-emerald-400">
                                  + R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const currentHistory = actionModalStream.history || [];
                                    const updatedHistory = currentHistory.filter((h) => h.id !== item.id);
                                    const newTotal = Math.max(0, (actionModalStream.amount || 0) - item.amount);
                                    const newLast = updatedHistory.length > 0 ? updatedHistory[0].amount : 0;
                                    onUpdateStreamAmount(actionModalStream.id, newTotal, updatedHistory[0]?.notes || '', updatedHistory, newLast, detailMonthKey);
                                    setActionModalStream((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            amount: newTotal,
                                            received: newTotal > 0,
                                            notes: updatedHistory[0]?.notes || '',
                                            history: updatedHistory,
                                            lastEntryAmount: newLast,
                                          }
                                        : null
                                    );
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Excluir este lançamento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="bg-[#0d1121] border border-slate-800/80 rounded-xl p-4 text-center text-slate-400 text-xs font-medium">
                            Nenhum registro individual encontrado.
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowAllEntriesView(false);
                          setShowAddGanhoForm(true);
                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-950/60 transition-all cursor-pointer active:scale-95"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Registrar novo ganho</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Primary Action Button / Inline Form */}
                      {!showAddGanhoForm ? (
                        <button
                          type="button"
                          onClick={() => setShowAddGanhoForm(true)}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-950/60 transition-all cursor-pointer active:scale-95"
                        >
                          <Plus className="w-4 h-4 stroke-[3]" />
                          <span>Registrar ganho</span>
                        </button>
                      ) : (
                        <div className="space-y-2 bg-[#090d1c] border border-blue-900/60 p-3.5 rounded-2xl animate-in fade-in space-y-2.5">
                          <label className="text-xs font-semibold text-slate-300 block">Adicionar valor do ganho:</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs font-bold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={registerAmountInput}
                              onChange={(e) => setRegisterAmountInput(e.target.value)}
                              placeholder="0,00"
                              autoFocus
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          {/* Small Description Box (optional) */}
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-slate-300 block">
                              Descrição <span className="text-[10px] text-slate-500 font-normal">(opcional)</span>
                            </label>
                            <input
                              type="text"
                              maxLength={25}
                              value={registerNoteInput}
                              onChange={(e) => setRegisterNoteInput(e.target.value)}
                              placeholder="Ex: Serviço p/ Maria"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const inputVal = registerAmountInput.replace(',', '.');
                                const added = parseFloat(inputVal) || 0;
                                const noteText = registerNoteInput.trim();
                                if (added > 0) {
                                  const latestStream = activeStreamsForMonth.find((s) => s.id === actionModalStream.id) || actionModalStream;
                                  const currentAmt = latestStream.amount || 0;
                                  const newTotal = currentAmt + added;

                                  const now = new Date();
                                  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
                                  
                                  const newEntry: IncomeHistoryEntry = {
                                    id: 'entry_' + Date.now(),
                                    amount: added,
                                    date: dateStr,
                                    notes: noteText || undefined,
                                  };

                                  const currentHistory = latestStream.history || [];
                                  const updatedHistory = [newEntry, ...currentHistory];

                                  onUpdateStreamAmount(actionModalStream.id, newTotal, noteText || latestStream.notes, updatedHistory, added, detailMonthKey);
                                  
                                  setActionModalStream({
                                    ...latestStream,
                                    amount: newTotal,
                                    received: true,
                                    notes: noteText || latestStream.notes,
                                    history: updatedHistory,
                                    lastEntryAmount: added,
                                  });

                                  if (onAddTransaction) {
                                    onAddTransaction({
                                      description: noteText ? `${actionModalStream.name} - ${noteText}` : actionModalStream.name,
                                      amount: added,
                                      category: 'Serviços',
                                      type: 'income',
                                      paidByMemberId: member.id,
                                      splitType: 'individual',
                                      categoryIcon: actionModalStream.icon || 'TrendingUp',
                                    });
                                  }
                                } else if (inputVal === '0' || inputVal === '0.00' || inputVal === '0,00') {
                                  onUpdateStreamAmount(actionModalStream.id, 0, '', [], 0, detailMonthKey);
                                  setActionModalStream((prev) => (prev ? { ...prev, amount: 0, received: false, notes: '', history: [], lastEntryAmount: 0 } : null));
                                }
                                setRegisterAmountInput('');
                                setRegisterNoteInput('');
                                setShowAddGanhoForm(false);
                              }}
                              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                            >
                              Adicionar Ganho
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRegisterNoteInput('');
                                setShowAddGanhoForm(false);
                              }}
                              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Último lançamento */}
                      {(() => {
                        const historyList = actionModalStream.history || [];
                        const lastEntry = historyList.length > 0
                          ? historyList[0]
                          : (actionModalStream.lastEntryAmount && actionModalStream.lastEntryAmount > 0
                              ? {
                                  id: 'last_legacy',
                                  amount: actionModalStream.lastEntryAmount,
                                  date: actionModalStream.receivedDate || displayDate,
                                  notes: actionModalStream.notes,
                                }
                              : (actionModalStream.amount > 0
                                  ? {
                                      id: 'amount_legacy',
                                      amount: actionModalStream.amount,
                                      date: actionModalStream.receivedDate || displayDate,
                                      notes: actionModalStream.notes,
                                    }
                                  : null));

                        return (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-white">Último lançamento</h4>
                              <button
                                type="button"
                                onClick={() => setShowAllEntriesView(true)}
                                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                              >
                                <span>Ver todos</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {lastEntry ? (
                              <div className="bg-[#0d1121] border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-7 h-7 rounded-full bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 text-xs shrink-0 font-mono font-bold">
                                    +
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[11px] font-bold text-white block truncate">
                                      {lastEntry.date} • {actionModalStream.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {lastEntry.notes ? lastEntry.notes : 'Lançamento mais recente'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-xs font-mono font-bold text-emerald-400">
                                    R$ {lastEntry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-[#0d1121] border border-slate-800/80 rounded-xl p-3.5 text-center text-slate-400 text-xs font-semibold">
                                Nenhum lançamento
                              </div>
                            )}

                            {/* Caixa de confirmação de exclusão */}
                            {showDeleteConfirm && lastEntry && (
                              <div className="bg-red-950/90 border border-red-800/80 rounded-xl p-3 space-y-2 animate-in fade-in">
                                <div className="flex items-center gap-2 text-red-300 font-bold text-xs">
                                  <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                                  <span>Excluir último lançamento?</span>
                                </div>
                                <p className="text-[11px] text-slate-300">
                                  Deseja remover este lançamento de R$ {lastEntry.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?
                                </p>
                                <div className="flex items-center justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (historyList.length > 0) {
                                        const updatedHistory = historyList.slice(1);
                                        const newTotal = Math.max(0, (actionModalStream.amount || 0) - lastEntry.amount);
                                        const newLast = updatedHistory.length > 0 ? updatedHistory[0].amount : 0;
                                        onUpdateStreamAmount(actionModalStream.id, newTotal, updatedHistory[0]?.notes || '', updatedHistory, newLast, detailMonthKey);
                                        setActionModalStream((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                amount: newTotal,
                                                received: newTotal > 0,
                                                notes: updatedHistory[0]?.notes || '',
                                                history: updatedHistory,
                                                lastEntryAmount: newLast,
                                              }
                                            : null
                                        );
                                      } else {
                                        onUpdateStreamAmount(actionModalStream.id, 0, '', [], 0, detailMonthKey);
                                        setActionModalStream((prev) => (prev ? { ...prev, amount: 0, received: false, notes: '', history: [], lastEntryAmount: 0 } : null));
                                      }
                                      setShowDeleteConfirm(false);
                                    }}
                                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg shadow-md transition-colors cursor-pointer"
                                  >
                                    Sim, excluir
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </>
              )}

              {/* Footer Actions (Editar Renda / Excluir Renda) */}
              <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    const s = actionModalStream;
                    setActionModalStream(null);
                    onEditStream(s, detailMonthKey);
                  }}
                  className="py-2.5 bg-[#121629] border border-purple-900/50 hover:bg-purple-950/60 text-purple-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                >
                  <Pencil className="w-3.5 h-3.5 text-purple-400" />
                  <span>Editar renda</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const s = actionModalStream;
                    setActionModalStream(null);
                    onDeleteStream(s, detailMonthKey);
                  }}
                  className="py-2.5 bg-[#1a0f18] border border-red-900/50 hover:bg-red-950/60 text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span>Excluir renda</span>
                </button>
              </div>

            </div>
          </div>
        );
      })(),
      document.body
    )}
    </div>
  );
};
