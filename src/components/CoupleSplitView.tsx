import React, { useState, useEffect, useMemo } from 'react';
import { FamilyGroup, FamilyMember, Transaction, IncomeStream, IncomeHistoryEntry } from '../types';
import { AddIncomeModal } from './AddIncomeModal';
import { MemberIncomeDetailView } from './MemberIncomeDetailView';
import { FamilyIncomeOverviewModal } from './FamilyIncomeOverviewModal';
import {
  getStreamAmount,
  formatMemberName,
  deleteIncomeStreamFromStorage,
  saveIncomeStreamToStorage,
  syncIncomesMapToFirestore,
  recoverIncomesFromTransactions,
} from '../utils/incomeUtils';
import {
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Wallet,
  Calendar,
  X,
  Plus,
  Trash2,
  Briefcase,
  TrendingUp,
  Utensils,
  Sparkles,
  CheckCircle2,
  Clock
} from 'lucide-react';

export type MemberIncomesMap = {
  [memberId: string]: IncomeStream[];
};

interface CoupleSplitViewProps {
  group: FamilyGroup;
  members: FamilyMember[];
  transactions: Transaction[];
  onSettleUp?: (settlementAmount: number, paidByMemberId: string, receivedByMemberId: string) => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'date'> & { date?: string; incomeStreamId?: string; incomeMonthKey?: string }) => void;
  onDeleteTransaction?: (id: string) => void;
  onToggleIncomeReceived?: (
    memberId: string,
    streamId: string,
    nextReceived: boolean,
    targetMonthKey?: string,
    customDate?: string
  ) => void;
  onDeleteIncomeStream?: (
    memberId: string,
    streamId: string,
    monthKey?: string,
    applyToAllMonths?: boolean
  ) => void;
  onAddIncomeStream?: (
    memberId: string,
    stream: Omit<IncomeStream, 'id'> & { id?: string; received?: boolean },
    monthKey?: string,
    applyToAllMonths?: boolean
  ) => void;
  onSyncIncomes?: (updatedMap?: Record<string, any>) => void;
  onSelectMemberForDetail?: (memberId: string) => void;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function CircularProgress({
  percentage,
  size = 48,
  strokeWidth = 4.5,
  strokeColor = "stroke-purple-400",
  trackColor = "stroke-slate-800",
  textColor = "text-purple-300"
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  strokeColor?: string;
  trackColor?: string;
  textColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cappedPercent = Math.min(100, Math.max(0, percentage));
  const strokeDashoffset = circumference - (cappedPercent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${trackColor} fill-none`}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`${strokeColor} fill-none transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span className={`absolute text-[10px] sm:text-xs font-black font-mono leading-none ${textColor}`}>
        {percentage}%
      </span>
    </div>
  );
}

function DynamicMetricValue({
  value,
  colorClass = 'text-emerald-400',
  prefixClass = 'text-emerald-400/70',
  alignRight = false,
}: {
  value: number;
  colorClass?: string;
  prefixClass?: string;
  alignRight?: boolean;
}) {
  const str = value.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  
  // Highly legible, scalable sizing that adapts gracefully if numbers have many digits
  let numSizeClass = 'text-2xl xs:text-3xl sm:text-4xl md:text-5xl';
  let prefixSizeClass = 'text-[11px] sm:text-sm md:text-base';
  
  if (str.length >= 10) {
    numSizeClass = 'text-base sm:text-xl md:text-2xl';
    prefixSizeClass = 'text-[9px] sm:text-xs';
  } else if (str.length >= 8) {
    numSizeClass = 'text-lg sm:text-2xl md:text-3xl';
    prefixSizeClass = 'text-[10px] sm:text-xs';
  } else if (str.length >= 6) {
    numSizeClass = 'text-xl xs:text-2xl sm:text-3xl md:text-4xl';
    prefixSizeClass = 'text-[10px] sm:text-xs';
  }

  return (
    <div className={`flex items-baseline gap-1 mt-0.5 min-w-0 ${alignRight ? 'justify-end text-right' : 'justify-start text-left'}`}>
      <span className={`${prefixSizeClass} font-bold ${prefixClass} shrink-0 select-none`}>
        R$
      </span>
      <span className={`${numSizeClass} font-black ${colorClass} font-mono tracking-tight tabular-nums leading-none truncate`}>
        {str}
      </span>
    </div>
  );
}

// Default initial data matching the reference screenshot exactly
const DEFAULT_THIAGO_INCOMES: IncomeStream[] = [
  { id: 'thiago-1', name: 'Salário Thiago', amount: 2750, nature: 'fixed', received: true, dueDate: 'Dia 05', icon: '💼' },
  { id: 'thiago-2', name: 'Freelance Tech', amount: 0, nature: 'extra', received: false, targetGoal: 2000, dueDate: 'Dia 15', icon: '💻' },
  { id: 'thiago-3', name: 'VR / VT Benefícios', amount: 990, nature: 'vales', calculationType: 'auto', dailyRate: 45, workDays: ['mon', 'tue', 'wed', 'thu', 'fri'], received: true, dueDate: 'Dia 01', icon: '🍱' },
];

const DEFAULT_MARIANA_INCOMES: IncomeStream[] = [
  { id: 'mariana-1', name: 'Salário Mariana', amount: 3000, nature: 'fixed', received: true, dueDate: 'Dia 28', icon: '💼' },
  { id: 'mariana-2', name: 'Bônus / Comissão', amount: 1100, nature: 'extra', received: true, targetGoal: 1100, dueDate: 's/ previsão', icon: '🎁' },
];

export function formatIncomeDueDate(dueDateStr?: string): string {
  if (!dueDateStr) return 's/ previsão';
  const trimmed = dueDateStr.trim();
  if (
    !trimmed ||
    trimmed.toLowerCase() === 's/ previsão' ||
    trimmed.toLowerCase() === 'sem previsão'
  ) {
    return 's/ previsão';
  }

  if (trimmed.toLowerCase().startsWith('recebe ')) {
    const rest = trimmed.substring(7).trim();
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  }

  const match = trimmed.match(/\d+/);
  if (match) {
    const dayNum = parseInt(match[0], 10);
    if (dayNum >= 1 && dayNum <= 31) {
      return `Dia ${String(dayNum).padStart(2, '0')}`;
    }
  }

  return trimmed;
}

export function parseDueDateInfo(dueDateStr?: string) {
  const formattedDay = formatIncomeDueDate(dueDateStr);
  if (formattedDay === 's/ previsão') {
    return { daysAway: null, formattedDay: 's/ previsão', label: 's/ previsão' };
  }

  const match = formattedDay.match(/\d+/);
  if (!match) {
    return { daysAway: null, formattedDay, label: formattedDay };
  }

  const dayNum = parseInt(match[0], 10);
  const today = new Date();
  const todayDay = today.getDate();

  let daysAway = 0;
  if (dayNum === todayDay) {
    daysAway = 0;
  } else if (dayNum > todayDay) {
    daysAway = dayNum - todayDay;
  } else {
    // Due next month
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    daysAway = (daysInCurrentMonth - todayDay) + dayNum;
  }

  let relativeText = '';
  if (daysAway === 0) {
    relativeText = 'Hoje';
  } else if (daysAway === 1) {
    relativeText = 'Amanhã';
  } else {
    relativeText = `Em ${daysAway} dias`;
  }

  return {
    daysAway,
    formattedDay,
    label: `${formattedDay} • ${relativeText}`,
  };
}

function getPredictedFontSize(amount: number) {
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
  return 'text-[27px] sm:text-[34px] md:text-[40px]';
}

export const CoupleSplitView: React.FC<CoupleSplitViewProps> = ({
  group,
  members,
  transactions,
  onSettleUp,
  onAddTransaction,
  onDeleteTransaction,
  onToggleIncomeReceived,
  onDeleteIncomeStream,
  onAddIncomeStream: onAddIncomeStreamProp,
  onSyncIncomes,
  onSelectMemberForDetail,
}) => {
  // Current selected date for month navigation (matching HomeDashboard standard)
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

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
    const today = new Date();
    return selectedDate.getFullYear() === today.getFullYear() && selectedDate.getMonth() === today.getMonth();
  }, [selectedDate]);

  // Incomes Map saved in localStorage
  const [incomesMap, setIncomesMap] = useState<MemberIncomesMap>(() => {
    const saved = localStorage.getItem('wepay_couple_incomes_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return {};
  });

  // Modal states
  const [memberIncomesModalId, setMemberIncomesModalId] = useState<string | null>(null);
  const [showFamilyIncomeOverview, setShowFamilyIncomeOverview] = useState(false);
  const [initialStreamForModal, setInitialStreamForModal] = useState<IncomeStream | null>(null);
  const [editingStream, setEditingStream] = useState<IncomeStream | null>(null);
  const [streamToDelete, setStreamToDelete] = useState<{ memberId: string; stream: IncomeStream; targetMonthKey?: string } | null>(null);
  const [isNextUpcomingExpanded, setIsNextUpcomingExpanded] = useState(false);

  // Add Stream Modal State
  const [activeAddMemberId, setActiveAddMemberId] = useState<string | null>(null);
  const [activeAddMonthKey, setActiveAddMonthKey] = useState<string | null>(null);

  const lastSavedIncomesRef = React.useRef<string>('');

  useEffect(() => {
    const serialized = JSON.stringify(incomesMap);
    if (serialized !== lastSavedIncomesRef.current && Object.keys(incomesMap).length > 0) {
      lastSavedIncomesRef.current = serialized;
      localStorage.setItem('wepay_couple_incomes_v3', serialized);
      localStorage.setItem('wepay_monthly_incomes', serialized);
      window.dispatchEvent(new Event('wepay_incomes_updated'));
      if (group?.id) {
        syncIncomesMapToFirestore(group.id, incomesMap);
      }
    }
  }, [incomesMap, group?.id]);

  useEffect(() => {
    const handleReloadIncomes = () => {
      try {
        const saved = localStorage.getItem('wepay_couple_incomes_v3') || localStorage.getItem('wepay_monthly_incomes');
        if (saved && saved !== lastSavedIncomesRef.current) {
          lastSavedIncomesRef.current = saved;
          setIncomesMap(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Error reloading incomes map:', e);
      }
    };

    window.addEventListener('wepay_incomes_updated', handleReloadIncomes);
    window.addEventListener('storage', handleReloadIncomes);
    return () => {
      window.removeEventListener('wepay_incomes_updated', handleReloadIncomes);
      window.removeEventListener('storage', handleReloadIncomes);
    };
  }, []);

  const getMemberIncomes = (memberId: string, index: number, targetMonthKey?: string): IncomeStream[] => {
    const month = targetMonthKey || selectedMonthKey;

    // Merge transactions into effective map if available
    let effectiveMap = incomesMap;
    if (transactions && transactions.length > 0) {
      effectiveMap = recoverIncomesFromTransactions(incomesMap, transactions, members);
    }

    let rawList: IncomeStream[] = [];
    if (effectiveMap?.[month]?.[memberId] && Array.isArray(effectiveMap[month][memberId]) && effectiveMap[month][memberId].length > 0) {
      rawList = effectiveMap[month][memberId];
    } else if (effectiveMap?.[memberId] && Array.isArray(effectiveMap[memberId]) && effectiveMap[memberId].length > 0) {
      rawList = effectiveMap[memberId];
    } else {
      // Flexible match by name if ID was dynamically generated
      const monthObj = (effectiveMap && effectiveMap[month]) || {};
      const candidateKeys = Array.from(new Set([...Object.keys(monthObj), ...Object.keys(effectiveMap || {})])).filter(
        (k) => !k.match(/^\d{4}-\d{2}$/)
      );
      const memberName = members[index]?.name || '';
      for (const k of candidateKeys) {
        const kLow = k.toLowerCase().trim();
        const memLow = memberName.toLowerCase().trim();
        if (
          (memLow && kLow.includes(memLow)) ||
          (memLow.includes('josy') && kLow.includes('josy')) ||
          (memLow.includes('josefa') && (kLow.includes('josefa') || kLow.includes('josy'))) ||
          (memLow.includes('thiago') && (kLow.includes('thiago') || kLow.includes('thyago'))) ||
          (memLow.includes('thyago') && (kLow.includes('thiago') || kLow.includes('thyago'))) ||
          (index === 1 && (kLow.includes('m2') || kLow.includes('mariana') || kLow.includes('mulher') || kLow.includes('josy'))) ||
          (index === 0 && (kLow.includes('m1') || kLow.includes('thiago') || kLow.includes('homem')))
        ) {
          rawList = monthObj[k] || (effectiveMap && effectiveMap[k]) || [];
          if (rawList.length > 0) break;
        }
      }

      if (rawList.length === 0) {
        const isDemo = localStorage.getItem('wepay_is_demo') === 'true';
        if (isDemo) {
          rawList = index === 0 ? DEFAULT_THIAGO_INCOMES : DEFAULT_MARIANA_INCOMES;
        } else if (members[index]?.income && (members[index]?.income || 0) > 0) {
          rawList = [
            {
              id: `main-${memberId}`,
              name: 'Salário / Renda Principal',
              amount: members[index].income || 0,
              nature: 'fixed',
              isMain: true,
            },
          ];
        }
      }
    }

    // Deduplicate streams by ID to ensure unique keys and data integrity
    const seen = new Set<string>();
    return rawList.filter((s) => {
      const key = s.id || `${s.name}-${s.dueDate}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const getStreamIcon = (name: string, customIcon?: string): string => {
    if (customIcon) return customIcon;
    const lower = name.toLowerCase();
    if (lower.includes('salário') || lower.includes('salario')) return '💼';
    if (lower.includes('comissão') || lower.includes('comissao') || lower.includes('bônus') || lower.includes('bonus')) return '🎁';
    if (lower.includes('freelance') || lower.includes('freelancer') || lower.includes('tech') || lower.includes('dev')) return '💻';
    if (lower.includes('invest') || lower.includes('dividendo')) return '💰';
    return '💵';
  };

  // Calculations for all members
  const membersData = members.map((member, index) => {
    const streams = getMemberIncomes(member.id, index);
    const fixedCount = streams.filter((s) => s.nature === 'fixed').length;
    const valesCount = streams.filter((s) => s.nature === 'vales').length;
    const extraCount = streams.filter((s) => s.nature === 'extra').length;

    const memberFixed = streams.filter((s) => s.nature === 'fixed').reduce((acc, s) => acc + getStreamAmount(s, selectedMonthKey), 0);
    const memberVales = streams.filter((s) => s.nature === 'vales').reduce((acc, s) => acc + getStreamAmount(s, selectedMonthKey), 0);
    const memberExtra = streams.filter((s) => s.nature === 'extra').reduce((acc, s) => acc + Math.max(s.targetGoal || 0, s.amount || 0), 0);

    const totalExpected = streams.reduce((acc, s) => {
      if (s.nature === 'extra') {
        return acc + Math.max(s.targetGoal || 0, s.amount || 0);
      }
      return acc + getStreamAmount(s, selectedMonthKey);
    }, 0);

    const totalReceived = streams.reduce((acc, s) => {
      if (s.nature === 'extra') {
        return acc + (s.amount || 0);
      }
      return s.received ? acc + getStreamAmount(s, selectedMonthKey) : acc;
    }, 0);

    const totalPending = Math.max(0, totalExpected - totalReceived);
    const percentageReceived = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

    return {
      member,
      index,
      streams,
      fixedCount,
      valesCount,
      extraCount,
      memberFixed,
      memberVales,
      memberExtra,
      totalExpected,
      totalReceived,
      totalPending,
      percentageReceived,
    };
  });

  // Overall Couple Totals
  const totalCoupleReceived = membersData.reduce((acc, m) => acc + m.totalReceived, 0);
  const totalCoupleExpected = membersData.reduce((acc, m) => acc + m.totalExpected, 0);
  const totalCouplePending = Math.max(0, totalCoupleExpected - totalCoupleReceived);
  const couplePercentage = totalCoupleExpected > 0 ? Math.round((totalCoupleReceived / totalCoupleExpected) * 100) : 0;

  const totalCoupleFixed = membersData.reduce((acc, m) => {
    return acc + m.streams.filter((s) => s.nature === 'fixed').reduce((sAcc, s) => sAcc + getStreamAmount(s, selectedMonthKey), 0);
  }, 0);

  const totalCoupleVales = membersData.reduce((acc, m) => {
    return acc + m.streams.filter((s) => s.nature === 'vales').reduce((sAcc, s) => sAcc + getStreamAmount(s, selectedMonthKey), 0);
  }, 0);

  const totalCoupleExtra = membersData.reduce((acc, m) => {
    return acc + m.streams.filter((s) => s.nature === 'extra').reduce((sAcc, s) => sAcc + Math.max(s.targetGoal || 0, s.amount || 0), 0);
  }, 0);

  // Toggle Stream Received status
  const handleToggleReceived = (
    memberId: string,
    streamId: string,
    memberIndex: number,
    customReceivedDate?: string,
    forceReceived?: boolean,
    targetMonthKey?: string
  ) => {
    const month = targetMonthKey || selectedMonthKey;
    const currentStreams = getMemberIncomes(memberId, memberIndex, month);
    const currentStream = currentStreams.find((s) => s.id === streamId);
    const nextReceived = forceReceived !== undefined ? forceReceived : (currentStream ? !currentStream.received : true);

    if (onToggleIncomeReceived) {
      onToggleIncomeReceived(memberId, streamId, nextReceived, month, customReceivedDate);
    }

    setIncomesMap((prevMap) => {
      const updated = currentStreams.map((s) => {
        if (s.id === streamId) {
          return {
            ...s,
            received: nextReceived,
            receivedDate: customReceivedDate !== undefined ? customReceivedDate : (nextReceived ? new Date().toISOString().split('T')[0] : s.receivedDate),
          };
        }
        return s;
      });
      const monthData = prevMap[month] || {};
      const newMap = { ...prevMap };
      if (!newMap[memberId] || !Array.isArray(newMap[memberId]) || newMap[memberId].length === 0) {
        newMap[memberId] = currentStreams;
      }
      const finalMap = {
        ...newMap,
        [month]: {
          ...monthData,
          [memberId]: updated,
        },
      };

      if (group?.id) {
        syncIncomesMapToFirestore(group.id, finalMap);
      }
      return finalMap;
    });

    if (!onToggleIncomeReceived && onAddTransaction && currentStream) {
      const streamAmt = getStreamAmount(currentStream, month);
      const memberObj = members.find((m) => m.id === memberId);
      if (nextReceived && streamAmt > 0) {
        onAddTransaction({
          incomeStreamId: currentStream.id,
          incomeMonthKey: month,
          description: `Renda (${currentStream.name}): ${memberObj?.name || 'Membro'}`,
          amount: streamAmt,
          category: 'Serviços',
          categoryIcon: currentStream.icon || 'TrendingUp',
          type: 'income',
          paidByMemberId: memberId,
          splitType: 'individual',
          notes: currentStream.notes || 'Renda recebida',
        });
      }
    }
  };

  // Remove Stream
  const handleRemoveStream = (
    memberId: string,
    streamId: string,
    memberIndex: number,
    targetMonthKey?: string,
    applyToAllMonths: boolean = false
  ) => {
    const month = targetMonthKey || selectedMonthKey;
    if (onDeleteIncomeStream) {
      onDeleteIncomeStream(memberId, streamId, month, applyToAllMonths);
    } else {
      deleteIncomeStreamFromStorage(memberId, streamId, month, applyToAllMonths, group?.id);
    }

    setIncomesMap((prevMap) => {
      const currentStreams = getMemberIncomes(memberId, memberIndex, month);
      const updated = currentStreams.filter((s) => s.id !== streamId);
      const monthData = prevMap[month] || {};
      const newMap = { ...prevMap };

      let finalMap = newMap;
      if (applyToAllMonths) {
        const baseList = newMap[memberId] && Array.isArray(newMap[memberId]) ? newMap[memberId] : currentStreams;
        newMap[memberId] = baseList.filter((s: IncomeStream) => s.id !== streamId);
        newMap[month] = {
          ...monthData,
          [memberId]: updated,
        };
        Object.keys(newMap).forEach((k) => {
          if (k.match(/^\d{4}-\d{2}$/) && k > month && newMap[k]?.[memberId] && Array.isArray(newMap[k][memberId])) {
            newMap[k][memberId] = newMap[k][memberId].filter((s: IncomeStream) => s.id !== streamId);
          }
        });
        finalMap = newMap;
      } else {
        if (!newMap[memberId] || !Array.isArray(newMap[memberId])) {
          newMap[memberId] = currentStreams;
        }
        finalMap = {
          ...newMap,
          [month]: {
            ...monthData,
            [memberId]: updated,
          },
        };
      }

      if (group?.id) {
        syncIncomesMapToFirestore(group.id, finalMap);
      }
      return finalMap;
    });
  };

  // Update Stream Amount (e.g. Variable / Extra income registration)
  const handleUpdateStreamAmount = (
    memberId: string,
    streamId: string,
    newAmount: number,
    notes?: string,
    customReceivedDate?: string,
    history?: IncomeHistoryEntry[],
    lastEntryAmount?: number,
    targetMonthKey?: string
  ) => {
    const memberIndex = members.findIndex((m) => m.id === memberId);
    const month = targetMonthKey || selectedMonthKey;
    setIncomesMap((prevMap) => {
      const currentStreams = getMemberIncomes(memberId, memberIndex >= 0 ? memberIndex : 0, month);
      const updated = currentStreams.map((s) =>
        s.id === streamId
          ? {
              ...s,
              amount: newAmount,
              received: newAmount > 0,
              receivedDate: newAmount > 0 ? (customReceivedDate || s.receivedDate || new Date().toISOString().split('T')[0]) : undefined,
              notes: notes !== undefined ? notes : s.notes,
              history: history !== undefined ? history : s.history,
              lastEntryAmount: lastEntryAmount !== undefined ? lastEntryAmount : s.lastEntryAmount,
            }
          : s
      );
      const monthData = prevMap[month] || {};
      const newMap = { ...prevMap };
      if (!newMap[memberId] || !Array.isArray(newMap[memberId]) || newMap[memberId].length === 0) {
        newMap[memberId] = currentStreams;
      }
      const finalMap = {
        ...newMap,
        [month]: {
          ...monthData,
          [memberId]: updated,
        },
      };

      if (group?.id) {
        syncIncomesMapToFirestore(group.id, finalMap);
      }
      return finalMap;
    });
  };

  // Find next upcoming/pending stream for middle card
  const pendingStreamsWithMember = membersData.flatMap((m) =>
    m.streams
      .filter((s) => !s.received)
      .map((s) => {
        const amount = getStreamAmount(s) || s.targetGoal || 0;
        const info = parseDueDateInfo(s.dueDate);
        return {
          stream: s,
          member: m.member,
          amount,
          daysAway: info.daysAway,
          info,
        };
      })
  );

  const sortedPending = [...pendingStreamsWithMember].sort((a, b) => {
    if (a.daysAway !== null && b.daysAway !== null) {
      return a.daysAway - b.daysAway;
    }
    if (a.daysAway !== null) return -1;
    if (b.daysAway !== null) return 1;
    return 0;
  });

  const nextUpcomingItem = sortedPending[0] || null;

  const sortedAllStreamsForForecast = membersData
    .flatMap(({ member, streams }) =>
      streams
        .filter((s) => !s.received)
        .map((s) => {
          const amount = getStreamAmount(s) || s.targetGoal || 0;
          const formattedDay = formatIncomeDueDate(s.dueDate);
          const dayMatch = formattedDay.match(/\d+/);
          const dayNum = dayMatch ? parseInt(dayMatch[0], 10) : null;
          const info = parseDueDateInfo(s.dueDate);

          return {
            stream: s,
            member,
            amount,
            formattedDay,
            dayNum,
            info,
          };
        })
    )
    .sort((a, b) => {
      if (a.dayNum !== null && b.dayNum !== null) {
        return a.dayNum - b.dayNum;
      }
      if (a.dayNum !== null) return -1;
      if (b.dayNum !== null) return 1;
      return a.stream.name.localeCompare(b.stream.name);
    });

  return (
    <div className="space-y-2.5 sm:space-y-4 pb-28 max-w-lg lg:max-w-7xl mx-auto sm:px-0">
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
              Rendas
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

      {/* ========================================== */}
      {/* 1. HERO CARD: "Renda do Casal"              */}
      {/* ========================================== */}
      <div className="bg-[#0e1220] border border-purple-900/50 rounded-2xl p-2.5 sm:p-4 shadow-2xl relative space-y-2 sm:space-y-3">
        {/* Ambient Glow background */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none overflow-hidden rounded-2xl" />

        {/* Header Row with Title & Ver completo Button */}
        <div className="flex items-center justify-between gap-2 relative z-30 pb-1.5 border-b border-purple-500/20">
          <div className="flex items-center gap-1.5 min-w-0">
            <Wallet className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <h2 className="text-[11px] sm:text-xs font-black text-white tracking-wider leading-none truncate">
              RENDA FAMILIAR TOTAL
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setShowFamilyIncomeOverview(true)}
            className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-2 sm:px-2.5 py-1 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm"
            title="Ver visão geral completa da renda familiar"
          >
            <span>Ver completo</span>
            <ChevronRight className="w-3 h-3 text-purple-400" />
          </button>
        </div>

        {/* Renda Total Prevista no mesmo padrão da página do membro */}
        <div className="space-y-0.5 relative z-10">
          <div className="flex items-center gap-1 text-slate-400">
            <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
            <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
              Renda Total Prevista
            </span>
          </div>
          <div className={`font-black text-white font-mono tracking-tight leading-tight transition-all duration-200 flex items-baseline gap-1.5 ${getPredictedFontSize(totalCoupleExpected)}`}>
            <span className="text-xs sm:text-sm md:text-base font-bold text-slate-400 select-none">R$</span>
            <span>{totalCoupleExpected.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Abaixo: Total Recebido e Falta Receber lado a lado */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/70 relative z-10">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1 text-slate-400">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
                Total Recebido
              </span>
            </div>
            <div className="font-black text-emerald-400 font-mono text-base sm:text-xl md:text-2xl tracking-tight truncate leading-tight flex items-baseline gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-emerald-400/70 select-none">R$</span>
              <span>{totalCoupleReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="space-y-0.5 pl-2 border-l border-slate-800/70 min-w-0">
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-semibold block truncate uppercase">
                Falta Receber
              </span>
            </div>
            <div className="font-black text-amber-400 font-mono text-base sm:text-xl md:text-2xl tracking-tight truncate leading-tight flex items-baseline gap-1">
              <span className="text-[10px] sm:text-xs font-bold text-amber-400/70 select-none">R$</span>
              <span>{totalCouplePending.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

        {/* ========================================== */}
        {/* 2. MEMBER CARDS GRID (1 col mobile, 2 cols desktop) */}
        {/* ========================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-3.5">
          {membersData.map(({ member, index, streams, fixedCount, valesCount, extraCount, memberFixed, memberVales, memberExtra, totalReceived, totalExpected, totalPending, percentageReceived }) => {
            const isFirstMember = index === 0;

            const cardBorderClass = 'border-purple-900/50 hover:border-purple-500/40';

            const activeTypes = [
              fixedCount > 0 ? `${fixedCount} ${fixedCount === 1 ? 'fixa' : 'fixas'}` : null,
              valesCount > 0 ? `${valesCount} ${valesCount === 1 ? 'vale' : 'vales'}` : null,
              extraCount > 0 ? `${extraCount} ${extraCount === 1 ? 'extra' : 'extras'}` : null,
            ].filter(Boolean);

            const formattedName = formatMemberName(member.name);

            return (
              <div
                key={member.id}
                onClick={() => {
                  setInitialStreamForModal(null);
                  setMemberIncomesModalId(member.id);
                  if (onSelectMemberForDetail) onSelectMemberForDetail(member);
                }}
                className={`bg-[#0e1220] border ${cardBorderClass} rounded-2xl p-2.5 sm:p-3.5 shadow-2xl transition-all w-full cursor-pointer group active:scale-[0.99] select-none hover:shadow-lg hover:bg-slate-900/30`}
              >
                {/* Header Row: Compact Avatar, Formatted Name + Active Subtitle */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Smaller compact member avatar */}
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 p-0.5 shrink-0 flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
                      style={{ borderColor: member.color || (isFirstMember ? '#f59e0b' : '#10b981') }}
                    >
                      <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                        {member.avatar ? (
                          <img
                            src={member.avatar}
                            alt={formattedName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-white font-black text-xs sm:text-sm uppercase"
                            style={{ backgroundColor: member.color || (isFirstMember ? '#f59e0b' : '#10b981') }}
                          >
                            {formattedName ? formattedName.charAt(0) : (isFirstMember ? 'M' : 'F')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-black text-sm sm:text-base text-white truncate leading-tight capitalize group-hover:text-purple-300 transition-colors">
                        {formattedName}
                      </h3>
                      <span className="text-[11px] sm:text-xs text-slate-400 truncate block leading-tight mt-0.5">
                        {activeTypes.length > 0 ? activeTypes.join(' • ') : 'Nenhuma fonte ativa'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-purple-300 group-hover:text-white bg-purple-500/15 group-hover:bg-purple-500/25 border border-purple-500/30 px-2 sm:px-2.5 py-1 rounded-lg transition-all shrink-0 shadow-sm">
                    <span>Ver completo</span>
                    <ChevronRight className="w-3 h-3 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>

                {/* Metrics Section: Recebido | Dynamic Circular Ring | Falta receber */}
                <div className="mt-2.5 sm:mt-3 grid grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 items-center bg-slate-950/50 p-2 sm:p-3 rounded-xl border border-slate-800/60">
                  {/* 1. Recebido */}
                  <div className="min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-1 text-slate-400">
                      <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] sm:text-[11px] font-semibold block leading-tight truncate uppercase">
                        RECEBIDO
                      </span>
                    </div>
                    <DynamicMetricValue
                      value={totalReceived}
                      colorClass="text-emerald-400"
                      prefixClass="text-emerald-400/70"
                    />
                  </div>

                  {/* 2. Dynamic Circular Progress Ring in Center */}
                  <div className="flex items-center justify-center px-1">
                    <CircularProgress
                      percentage={percentageReceived}
                      size={44}
                      strokeWidth={4.5}
                      strokeColor={isFirstMember ? "stroke-amber-400" : "stroke-emerald-400"}
                      trackColor="stroke-slate-800"
                      textColor={isFirstMember ? "text-amber-300" : "text-emerald-300"}
                    />
                  </div>

                  {/* 3. Falta receber */}
                  <div className="min-w-0 flex flex-col justify-center text-right items-end">
                    <div className="flex items-center justify-end gap-1 text-slate-400">
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[10px] sm:text-[11px] font-semibold block leading-tight truncate uppercase">
                        FALTA RECEBER
                      </span>
                    </div>
                    <DynamicMetricValue
                      value={totalPending}
                      colorClass="text-white"
                      prefixClass="text-slate-400"
                      alignRight
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      {/* ========================================== */}
      {/* 3. CARD: "Próximo recebimento" BELOW MARIANA */}
      {/* ========================================== */}
      <div className="bg-[#0e1220] border border-blue-900/40 hover:border-blue-800/70 rounded-2xl p-3 sm:p-4 shadow-lg transition-all w-full relative">
        {/* Main Header Container optimized for mobile */}
        <div
          onClick={() => setIsNextUpcomingExpanded(!isNextUpcomingExpanded)}
          className="flex items-center justify-between gap-2 sm:gap-3.5 cursor-pointer select-none group"
        >
          {/* Left: Prominent Icon scaled to match card content height */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-950/70 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
            <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
          </div>

          {/* Center: Information Column */}
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <span className="text-[9.5px] sm:text-[11px] font-bold text-blue-300 uppercase tracking-wider block leading-tight whitespace-nowrap">
              PRÓXIMO RECEBIMENTO
            </span>
            <h3 className={`font-extrabold text-white leading-tight mt-0.5 ${
              nextUpcomingItem
                ? 'text-xs sm:text-sm truncate'
                : 'text-[11px] sm:text-xs'
            }`}>
              {nextUpcomingItem ? nextUpcomingItem.stream.name : 'Tudo recebido esse mês! 🎉'}
            </h3>
            <span className={`text-slate-400 font-medium block leading-tight mt-0.5 ${
              nextUpcomingItem
                ? 'text-[10px] sm:text-xs truncate'
                : 'text-[9.5px] sm:text-[11px]'
            }`}>
              {nextUpcomingItem ? nextUpcomingItem.info.label : 'Todas as rendas foram confirmadas'}
            </span>
          </div>

          {/* Right Column: 'Ver todos' button in Blue at top, Value at bottom aligned with date line */}
          <div className="flex flex-col items-end justify-between self-stretch shrink-0 min-w-[66px] sm:min-w-[85px] py-0.5">
            {/* 'Ver todos' button in blue in top right */}
            <div
              className="flex items-center gap-1 text-[9px] sm:text-xs font-bold text-blue-400 group-hover:text-blue-300 bg-blue-500/15 group-hover:bg-blue-500/25 border border-blue-500/30 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg transition-all shadow-sm"
              title={isNextUpcomingExpanded ? 'Recolher previsões' : 'Ver todas as previsões'}
            >
              <span>Ver todos</span>
              {isNextUpcomingExpanded ? (
                <ChevronUp className="w-3 h-3 text-blue-400" />
              ) : (
                <ChevronDown className="w-3 h-3 text-blue-400" />
              )}
            </div>

            {/* Value on bottom right - enlarged and aligned with the bottom line */}
            <div className="flex items-end justify-end mt-auto pt-0.5">
              <div className="flex items-baseline gap-1 text-right leading-none">
                <span className="text-[9.5px] sm:text-xs font-bold text-slate-400 select-none">R$</span>
                <span className="text-sm sm:text-base font-black text-white font-mono tracking-tight whitespace-nowrap">
                  {nextUpcomingItem
                    ? nextUpcomingItem.amount.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : '0'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Expanded forecast list */}
        {isNextUpcomingExpanded && (
          <div className="border-t border-blue-900/40 pt-3.5 mt-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">
                A Receber ({sortedAllStreamsForForecast.length})
              </span>
            </div>

            {sortedAllStreamsForForecast.length === 0 ? (
              <div className="bg-[#0b0e19] border border-slate-800/80 rounded-xl p-4 text-center">
                <span className="text-xs text-slate-400 font-medium block">
                  🎉 Todas as rendas deste mês já foram recebidas!
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedAllStreamsForForecast.map(({ stream, member, amount, formattedDay, info }) => {
                  const isFirstMember =
                    member.name.toLowerCase().includes('thiago') ||
                    member.id.includes('thiago') ||
                    member.id === members[0]?.id;
                  const avatarEmoji = isFirstMember ? '👨' : '👩';
                  const isNoForecast = formattedDay === 's/ previsão';

                  return (
                    <div
                      key={`${member.id}-${stream.id}`}
                      className="bg-[#0b0e19] border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2.5 hover:border-blue-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Icon */}
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-sm shrink-0">
                          {getStreamIcon(stream.name, stream.icon)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-white truncate">{stream.name}</h4>
                            <span className="text-[10px] text-slate-400 font-medium bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded-md flex items-center gap-1.5">
                              <div className="w-3.5 h-3.5 rounded-full overflow-hidden shrink-0 flex items-center justify-center">
                                {member.avatar ? (
                                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center font-black text-white text-[8px]"
                                    style={{ backgroundColor: member.color || (isFirstMember ? '#f59e0b' : '#10b981') }}
                                  >
                                    {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                                  </div>
                                )}
                              </div>
                              <span>{(member?.name || 'Membro').split(' ')[0]}</span>
                            </span>
                          </div>

                          <span className="text-xs text-slate-400 font-medium block mt-0.5 truncate">
                            {isNoForecast ? 's/ previsão' : info.label}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-right">
                        <div className="flex items-baseline gap-1 font-mono text-xs font-extrabold text-white">
                          <span className="text-[10px] font-bold text-slate-400 select-none">R$</span>
                          <span>{amount.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================== */}
      {/* 4. FULL PAGE / VIEW: MEMBER INCOMES ("Rendas de [Nome]") */}
      {/* ========================================== */}
      {memberIncomesModalId && (() => {
        const modalMemberIndex = members.findIndex((m) => m.id === memberIncomesModalId);
        const modalMember = members[modalMemberIndex >= 0 ? modalMemberIndex : 0] || members[0];
        const modalMemberStreams = getMemberIncomes(modalMember.id, modalMemberIndex >= 0 ? modalMemberIndex : 0);
        const avatarEmoji = modalMemberIndex === 0 ? '👨' : '👩';

        return (
          <MemberIncomeDetailView
            member={modalMember}
            avatarEmoji={avatarEmoji}
            streams={modalMemberStreams}
            initialDate={selectedDate}
            initialSelectedStream={initialStreamForModal}
            onClose={() => {
              setMemberIncomesModalId(null);
              setInitialStreamForModal(null);
            }}
            onAddStream={(targetMonthKey) => {
              setEditingStream(null);
              setActiveAddMonthKey(targetMonthKey || selectedMonthKey);
              setActiveAddMemberId(modalMember.id);
            }}
            onEditStream={(stream, targetMonthKey) => {
              setEditingStream(stream);
              setActiveAddMonthKey(targetMonthKey || selectedMonthKey);
              setActiveAddMemberId(modalMember.id);
            }}
            onDeleteStream={(stream, targetMonthKey) =>
              setStreamToDelete({
                memberId: modalMember.id,
                stream,
                targetMonthKey: targetMonthKey || selectedMonthKey,
              })
            }
            onToggleReceived={(streamId, customReceivedDate, forceReceived, targetMonthKey) =>
              handleToggleReceived(modalMember.id, streamId, modalMemberIndex, customReceivedDate, forceReceived, targetMonthKey)
            }
            onUpdateStreamAmount={(streamId, newAmount, notes, history, lastEntryAmount, targetMonthKey) =>
              handleUpdateStreamAmount(modalMember.id, streamId, newAmount, notes, undefined, history, lastEntryAmount, targetMonthKey)
            }
            onAddTransaction={onAddTransaction}
          />
        );
      })()}

      {/* ========================================== */}
      {/* 5. MODAL: DELETION CONFIRMATION              */}
      {/* ========================================== */}
      {streamToDelete && (() => {
        const targetMonth = streamToDelete.targetMonthKey || selectedMonthKey;
        const [targetYearStr, targetMonthStr] = targetMonth.split('-');
        const targetDate = new Date(parseInt(targetYearStr, 10), parseInt(targetMonthStr, 10) - 1, 1);
        const formattedMonthName = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const capitalizedMonth = formattedMonthName.charAt(0).toUpperCase() + formattedMonthName.slice(1);
        const mIndex = members.findIndex((m) => m.id === streamToDelete.memberId);

        return (
          <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-[#0e1220] border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800/80 flex items-center justify-center mx-auto text-red-400 shadow-inner">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Excluir Renda</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Tem certeza que deseja excluir a renda <strong className="text-white">"{streamToDelete.stream.name}"</strong>?
                </p>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Como você deseja aplicar a exclusão desta renda?
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    handleRemoveStream(
                      streamToDelete.memberId,
                      streamToDelete.stream.id,
                      mIndex >= 0 ? mIndex : 0,
                      targetMonth,
                      false
                    );
                    setStreamToDelete(null);
                  }}
                  className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-300 font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer text-center active:scale-[0.98]"
                >
                  Excluir apenas deste mês ({capitalizedMonth})
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleRemoveStream(
                      streamToDelete.memberId,
                      streamToDelete.stream.id,
                      mIndex >= 0 ? mIndex : 0,
                      targetMonth,
                      true
                    );
                    setStreamToDelete(null);
                  }}
                  className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer text-center active:scale-[0.98]"
                >
                  Excluir de todos os meses
                </button>

                <button
                  type="button"
                  onClick={() => setStreamToDelete(null)}
                  className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================== */}
      {/* 6. MODAL: ADD / EDIT INCOME STREAM           */}
      {/* ========================================== */}
      {activeAddMemberId && (
        <AddIncomeModal
          currentMember={members.find((m) => m.id === activeAddMemberId) || members[0]}
          initialStream={editingStream || undefined}
          monthKey={activeAddMonthKey || selectedMonthKey}
          onClose={() => {
            setActiveAddMemberId(null);
            setEditingStream(null);
            setActiveAddMonthKey(null);
          }}
          onAddIncomeStream={(memberId, stream, monthKeyParam, applyToAllMonths = true) => {
            const currentMonthTarget = monthKeyParam || activeAddMonthKey || selectedMonthKey;
            const memberIndex = members.findIndex((m) => m.id === memberId);
            const currentStreams = getMemberIncomes(memberId, memberIndex >= 0 ? memberIndex : 0, currentMonthTarget);

            let updatedList: IncomeStream[];
            if (stream.id) {
              updatedList = currentStreams.map((s) =>
                s.id === stream.id
                  ? {
                      ...s,
                      name: stream.name,
                      amount: stream.amount,
                      targetGoal: stream.targetGoal,
                      nature: stream.nature,
                      dueDate: stream.dueDate,
                      isRecurrent: stream.isRecurrent,
                      icon: getStreamIcon(stream.name, stream.icon),
                      calculationType: stream.calculationType,
                      dailyRate: stream.dailyRate,
                      workDays: stream.workDays,
                      workOnHolidays: stream.workOnHolidays,
                    }
                  : s
              );
            } else {
              const newItem: IncomeStream = {
                id: `stream-${Date.now()}`,
                name: stream.name,
                amount: stream.amount,
                targetGoal: stream.targetGoal,
                nature: stream.nature,
                received: false,
                dueDate: stream.dueDate,
                isRecurrent: stream.isRecurrent,
                icon: getStreamIcon(stream.name, stream.icon),
                calculationType: stream.calculationType,
                dailyRate: stream.dailyRate,
                workDays: stream.workDays,
                workOnHolidays: stream.workOnHolidays,
              };
              updatedList = [...currentStreams, newItem];
            }

            const dedupe = (list: IncomeStream[]) => {
              const seen = new Set<string>();
              return list.filter((item) => {
                const key = item.id || `${item.name}-${item.dueDate}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
            };

            const cleanUpdatedList = dedupe(updatedList);

            setIncomesMap((prev) => {
              const monthData = prev[currentMonthTarget] || {};
              const newMap = { ...prev };
              let finalMap = newMap;
              if (applyToAllMonths) {
                // 1. Update root member default (inherited by future non-overridden months)
                newMap[memberId] = cleanUpdatedList;
                // 2. Update current month
                newMap[currentMonthTarget] = {
                  ...monthData,
                  [memberId]: cleanUpdatedList,
                };
                // 3. Update any future stored month keys (strictly future months, k > currentMonthTarget)
                Object.keys(newMap).forEach((k) => {
                  if (k.match(/^\d{4}-\d{2}$/) && k > currentMonthTarget && newMap[k]?.[memberId]) {
                    const existingFuture = newMap[k][memberId] as IncomeStream[];
                    if (stream.id) {
                      newMap[k][memberId] = dedupe(
                        existingFuture.map((s) =>
                          s.id === stream.id
                            ? {
                                ...s,
                                name: stream.name,
                                amount: stream.amount,
                                targetGoal: stream.targetGoal,
                                nature: stream.nature,
                                dueDate: stream.dueDate,
                                isRecurrent: stream.isRecurrent,
                                icon: getStreamIcon(stream.name, stream.icon),
                                calculationType: stream.calculationType,
                                dailyRate: stream.dailyRate,
                                workDays: stream.workDays,
                                workOnHolidays: stream.workOnHolidays,
                              }
                            : s
                        )
                      );
                    } else {
                      const latestItem = cleanUpdatedList[cleanUpdatedList.length - 1];
                      const alreadyHas = existingFuture.some(
                        (s) => s.id === latestItem.id || s.name.trim().toLowerCase() === latestItem.name.trim().toLowerCase()
                      );
                      if (!alreadyHas) {
                        newMap[k][memberId] = dedupe([...existingFuture, latestItem]);
                      }
                    }
                  }
                });
                finalMap = newMap;
              } else {
                // Only update this specific selected month.
                // Preserve unedited baseline in root member default if not yet set
                if (!newMap[memberId] || !Array.isArray(newMap[memberId]) || newMap[memberId].length === 0) {
                  newMap[memberId] = currentStreams;
                }
                finalMap = {
                  ...newMap,
                  [currentMonthTarget]: {
                    ...monthData,
                    [memberId]: cleanUpdatedList,
                  },
                };
              }

              if (group?.id) {
                syncIncomesMapToFirestore(group.id, finalMap);
              }
              return finalMap;
            });

            if (onAddIncomeStreamProp) {
              onAddIncomeStreamProp(memberId, stream, currentMonthTarget, applyToAllMonths);
            } else {
              saveIncomeStreamToStorage(memberId, stream, currentMonthTarget, group?.id, applyToAllMonths);
            }

            setActiveAddMemberId(null);
            setEditingStream(null);
            setActiveAddMonthKey(null);
          }}
        />
      )}

      {/* ========================================== */}
      {/* 7. MODAL: FAMILY INCOME OVERVIEW           */}
      {/* ========================================== */}
      {showFamilyIncomeOverview && (
        <FamilyIncomeOverviewModal
          members={members}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          getMemberIncomes={getMemberIncomes}
          onClose={() => setShowFamilyIncomeOverview(false)}
          onOpenMemberDetail={(memberId) => {
            setShowFamilyIncomeOverview(false);
            setInitialStreamForModal(null);
            setMemberIncomesModalId(memberId);
          }}
        />
      )}
    </div>
  );
};
