import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  Utensils,
  Sparkles,
  CheckCircle2,
  Clock,
  TrendingUp,
  PieChart,
  Users,
  Layers,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { FamilyMember, IncomeStream, IncomeNature } from '../types';
import { formatIncomeDueDate } from './CoupleSplitView';
import { getStreamAmount, formatMemberName } from '../utils/incomeUtils';

interface FamilyIncomeOverviewModalProps {
  members: FamilyMember[];
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  getMemberIncomes: (memberId: string, index: number, monthKey?: string) => IncomeStream[];
  onClose: () => void;
  onOpenMemberDetail?: (memberId: string) => void;
}

export const FamilyIncomeOverviewModal: React.FC<FamilyIncomeOverviewModalProps> = ({
  members,
  selectedDate,
  onDateChange,
  getMemberIncomes,
  onClose,
  onOpenMemberDetail,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(selectedDate || new Date(2026, 7, 1));
  const [filterType, setFilterType] = useState<'all' | 'fixed' | 'vales' | 'extra' | 'pending' | 'received'>('all');

  const monthKey = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, [currentDate]);

  const monthFormatted = useMemo(() => {
    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });
    const year = currentDate.getFullYear();
    return `${monthName.toUpperCase()} ${year}`;
  }, [currentDate]);

  const handlePrevMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(next);
    if (onDateChange) onDateChange(next);
  };

  const handleNextMonth = () => {
    const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(next);
    if (onDateChange) onDateChange(next);
  };

  // Compile full family streams
  const membersDetailedData = useMemo(() => {
    return members.map((member, index) => {
      const streams = getMemberIncomes(member.id, index, monthKey);

      let fixedTotal = 0;
      let valesTotal = 0;
      let extraTotal = 0;
      let receivedTotal = 0;
      let expectedTotal = 0;

      streams.forEach((s) => {
        const amt = getStreamAmount(s) || s.targetGoal || 0;
        expectedTotal += amt;
        if (s.received) {
          receivedTotal += amt;
        }

        if (s.nature === 'fixed') {
          fixedTotal += amt;
        } else if (s.nature === 'vales') {
          valesTotal += amt;
        } else {
          extraTotal += amt;
        }
      });

      const pendingTotal = Math.max(0, expectedTotal - receivedTotal);
      const percentageReceived = expectedTotal > 0 ? Math.round((receivedTotal / expectedTotal) * 100) : 0;

      return {
        member,
        index,
        streams,
        fixedTotal,
        valesTotal,
        extraTotal,
        receivedTotal,
        expectedTotal,
        pendingTotal,
        percentageReceived,
      };
    });
  }, [members, getMemberIncomes, monthKey]);

  // Totals across family
  const familySummary = useMemo(() => {
    let totalFixed = 0;
    let totalVales = 0;
    let totalExtra = 0;
    let totalExpected = 0;
    let totalReceived = 0;

    let fixedReceived = 0;
    let valesReceived = 0;
    let extraReceived = 0;

    const allStreams: { stream: IncomeStream; member: FamilyMember; memberIndex: number }[] = [];

    membersDetailedData.forEach(({ member, index, streams }) => {
      streams.forEach((s) => {
        const amt = getStreamAmount(s) || s.targetGoal || 0;
        totalExpected += amt;
        if (s.received) totalReceived += amt;

        if (s.nature === 'fixed') {
          totalFixed += amt;
          if (s.received) fixedReceived += amt;
        } else if (s.nature === 'vales') {
          totalVales += amt;
          if (s.received) valesReceived += amt;
        } else {
          totalExtra += amt;
          if (s.received) extraReceived += amt;
        }

        allStreams.push({ stream: s, member, memberIndex: index });
      });
    });

    const totalPending = Math.max(0, totalExpected - totalReceived);
    const overallPercentage = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

    const fixedPct = totalExpected > 0 ? Math.round((totalFixed / totalExpected) * 100) : 0;
    const valesPct = totalExpected > 0 ? Math.round((totalVales / totalExpected) * 100) : 0;
    const extraPct = totalExpected > 0 ? Math.max(0, 100 - fixedPct - valesPct) : 0;

    return {
      totalFixed,
      totalVales,
      totalExtra,
      totalExpected,
      totalReceived,
      totalPending,
      overallPercentage,
      fixedReceived,
      valesReceived,
      extraReceived,
      fixedPct,
      valesPct,
      extraPct,
      allStreams,
    };
  }, [membersDetailedData]);

  // Filtered streams list
  const filteredStreams = useMemo(() => {
    return familySummary.allStreams.filter(({ stream }) => {
      if (filterType === 'all') return true;
      if (filterType === 'fixed') return stream.nature === 'fixed';
      if (filterType === 'vales') return stream.nature === 'vales';
      if (filterType === 'extra') return stream.nature === 'extra';
      if (filterType === 'pending') return !stream.received;
      if (filterType === 'received') return !!stream.received;
      return true;
    });
  }, [familySummary.allStreams, filterType]);

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#090b15] border border-purple-900/40 rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[88dvh] overflow-hidden flex flex-col shadow-2xl pb-safe">
        
        {/* Mobile Grab Bar */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto mt-2 mb-1 sm:hidden shrink-0" />

        {/* 1. TOP HEADER */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-purple-950/60 flex items-center justify-between gap-3 bg-[#0c0f1d]/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
              <Wallet className="w-5 h-5 text-purple-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider truncate">
                Renda Familiar Total
              </h2>
              <p className="text-[11px] sm:text-xs text-purple-300/80 font-medium truncate">
                Visão geral e distribuição de rendas da família
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 2. MONTH SELECTOR */}
        <div className="px-4 sm:px-6 py-2.5 bg-[#0e1222] border-b border-slate-800/60 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-purple-800 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex items-center gap-1.5 text-center">
            <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
              {monthFormatted}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-purple-800 transition-colors flex items-center gap-1 text-xs font-semibold"
          >
            <span className="hidden sm:inline">Próximo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 3. SCROLLABLE CONTENT */}
        <div className="overflow-y-auto px-4 sm:px-6 py-4 space-y-4 text-left flex-1 custom-scrollbar">

          {/* HERO SUMMARY CARD */}
          <div className="bg-[#0e1220] border border-purple-900/50 rounded-2xl p-3.5 sm:p-4 shadow-xl relative overflow-hidden space-y-3">
            <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2 relative z-10">
              <span className="text-[11px] sm:text-xs font-black text-purple-300 uppercase tracking-wider">
                Resumo Familiar do Mês
              </span>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full">
                {familySummary.overallPercentage}% Recebido
              </span>
            </div>

            {/* Metrics 3 Columns */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-2.5 sm:p-3 rounded-xl border border-slate-800/70 relative z-10">
              {/* Previsto */}
              <div className="min-w-0">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium block truncate">
                  Total Previsto
                </span>
                <div className="text-sm sm:text-base font-black text-white font-mono mt-0.5 truncate">
                  R$ {familySummary.totalExpected.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Recebido */}
              <div className="min-w-0 text-center border-x border-slate-800/80 px-1">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium block truncate">
                  Recebido
                </span>
                <div className="text-sm sm:text-base font-black text-emerald-400 font-mono mt-0.5 truncate">
                  R$ {familySummary.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>

              {/* Falta Receber */}
              <div className="min-w-0 text-right">
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium block truncate">
                  Falta Receber
                </span>
                <div className="text-sm sm:text-base font-black text-slate-200 font-mono mt-0.5 truncate">
                  R$ {familySummary.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="space-y-1 relative z-10">
              <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, familySummary.overallPercentage))}%` }}
                />
              </div>
            </div>
          </div>

          {/* DISTRIBUTION BY NATURE */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Distribuição por Categoria de Renda
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Renda Fixa */}
              <div className="bg-[#0e1220] border border-blue-900/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <Briefcase className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Renda Fixa</span>
                  </div>
                  <span className="text-[10px] font-bold text-blue-300/80 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/40">
                    {familySummary.fixedPct}%
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-white font-mono">
                  R$ {familySummary.totalFixed.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Recebido:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    R$ {familySummary.fixedReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Vales */}
              <div className="bg-[#0e1220] border border-amber-900/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <Utensils className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Vales</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-300/80 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                    {familySummary.valesPct}%
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-white font-mono">
                  R$ {familySummary.totalVales.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Recebido:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    R$ {familySummary.valesReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Renda Extra */}
              <div className="bg-[#0e1220] border border-purple-900/30 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Renda Extra</span>
                  </div>
                  <span className="text-[10px] font-bold text-purple-300/80 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/40">
                    {familySummary.extraPct}%
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-white font-mono">
                  R$ {familySummary.totalExtra.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span>Recebido:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    R$ {familySummary.extraReceived.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CONTRIBUTION PER MEMBER */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Participação por Integrante
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {membersDetailedData.map(({ member, index, expectedTotal, receivedTotal, pendingTotal, fixedTotal, valesTotal, extraTotal, percentageReceived }) => {
                const isFirst = index === 0;
                const formattedName = formatMemberName(member.name);
                const shareOfTotal = familySummary.totalExpected > 0 ? Math.round((expectedTotal / familySummary.totalExpected) * 100) : 0;
                const borderColor = isFirst ? 'border-amber-500/30' : 'border-emerald-500/30';
                const textColor = isFirst ? 'text-amber-300' : 'text-emerald-300';

                return (
                  <div
                    key={member.id}
                    className={`bg-[#0e1220] border ${borderColor} rounded-xl p-3.5 space-y-2.5 shadow-md`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                          style={{ backgroundColor: member.color || (isFirst ? '#f59e0b' : '#10b981') }}
                        >
                          {member.avatar ? (
                            <img src={member.avatar} alt={formattedName} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            formattedName.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                            {formattedName}
                          </h4>
                          <span className={`text-[10px] font-semibold ${textColor}`}>
                            {shareOfTotal}% da renda familiar
                          </span>
                        </div>
                      </div>

                      {onOpenMemberDetail && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMemberDetail(member.id);
                          }}
                          className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-0.5 bg-purple-950/50 hover:bg-purple-900/60 border border-purple-800/40 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                        >
                          <span>Ver rendas</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Member Amount Details */}
                    <div className="grid grid-cols-3 gap-1.5 bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 text-center">
                      <div>
                        <span className="text-[9px] text-slate-400 block">Previsto</span>
                        <span className="text-xs font-bold text-white font-mono">
                          R$ {expectedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="border-x border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block">Recebido</span>
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          R$ {receivedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block">Pendente</span>
                        <span className="text-xs font-bold text-slate-300 font-mono">
                          R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown by type pills */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                      <span>Fixa: <strong className="text-white">R$ {fixedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong></span>
                      <span>Vales: <strong className="text-white">R$ {valesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong></span>
                      <span>Extra: <strong className="text-white">R$ {extraTotal.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ALL STREAMS LIST */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-purple-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Todas as Fontes de Renda ({filteredStreams.length})
                </h3>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
              {[
                { key: 'all', label: 'Todas' },
                { key: 'fixed', label: 'Renda Fixa' },
                { key: 'vales', label: 'Vales' },
                { key: 'extra', label: 'Renda Extra' },
                { key: 'pending', label: 'Aguardando' },
                { key: 'received', label: 'Recebidas' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setFilterType(pill.key as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                    filterType === pill.key
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* List */}
            {filteredStreams.length === 0 ? (
              <div className="bg-[#0b0e19] border border-slate-800/80 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-400 font-medium">
                  Nenhuma renda encontrada para este filtro.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredStreams.map(({ stream, member }) => {
                  const amt = getStreamAmount(stream) || stream.targetGoal || 0;
                  const formattedDue = formatIncomeDueDate(stream.dueDate);
                  const natureBadge =
                    stream.nature === 'fixed' ? 'Fixa' : stream.nature === 'vales' ? 'Vales' : 'Extra';
                  const natureColor =
                    stream.nature === 'fixed'
                      ? 'bg-blue-950/60 border-blue-800/40 text-blue-300'
                      : stream.nature === 'vales'
                      ? 'bg-amber-950/60 border-amber-800/40 text-amber-300'
                      : 'bg-purple-950/60 border-purple-800/40 text-purple-300';

                  return (
                    <div
                      key={`${member.id}-${stream.id}`}
                      className="bg-[#0e1220] border border-slate-800/80 hover:border-purple-800/50 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Member Avatar Mini Badge */}
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 border border-white/20"
                          style={{ backgroundColor: member.color || '#8b5cf6' }}
                          title={member.name}
                        >
                          {member.avatar ? (
                            <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-black text-white uppercase truncate">
                              {stream.name}
                            </h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${natureColor}`}>
                              {natureBadge}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{formattedDue}</span>
                            <span>•</span>
                            <span className="text-slate-300">{formatMemberName(member.name)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs sm:text-sm font-black text-white font-mono">
                          R$ {amt.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                        <span
                          className={`text-[10px] font-bold flex items-center gap-1 mt-0.5 ${
                            stream.received ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {stream.received ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>Recebido</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Aguardando</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* 4. FOOTER */}
        <div className="p-3 sm:p-4 bg-[#0c0f1d] border-t border-slate-800/80 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer text-center"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};
