import React, { useState } from 'react';
import { FamilyMember, CategoryType, FixedExpenseItem, RecurrenceType } from '../types';
import { CATEGORIES_META } from '../data/suggestions';
import { CategoriesManagerModal } from './CategoriesManagerModal';
import {
  CategoryItem,
  getStoredCategories,
  saveStoredCategories,
  getStoredShortcutNames,
  saveStoredShortcutNames,
  renderCategoryIcon,
} from '../utils/categoryUtils';
import {
  X,
  Edit3,
  Trash2,
  Calendar,
  Check,
  HelpCircle,
  Clock,
  Sparkles,
  Zap,
  Tag,
  AlertTriangle,
  User,
  FileText,
  DollarSign,
  CheckCircle2,
  LayoutGrid,
} from 'lucide-react';

interface FixedExpenseModalProps {
  expense?: FixedExpenseItem | null;
  members: FamilyMember[];
  currentMember: FamilyMember;
  monthKey?: string;
  onClose: () => void;
  onSave: (expense: Omit<FixedExpenseItem, 'id'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

// Helper for Smart Due Date Colors
export function getDueDateStatus(dueDateStr: string | number, isPaid: boolean, monthKey?: string) {
  if (isPaid) {
    return {
      label: `Dia ${dueDateStr} (Pago)`,
      colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      badgeText: 'Pago',
    };
  }

  // Parse numeric day
  const match = String(dueDateStr || '').match(/\d+/);
  const dayNum = match ? parseInt(match[0], 10) : 10;

  const validMonthKey =
    typeof monthKey === 'string' && monthKey.includes('-')
      ? monthKey
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [yearStr, monthStr] = validMonthKey.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = (parseInt(monthStr, 10) || (new Date().getMonth() + 1)) - 1;

  const dueDateObj = new Date(year, month, dayNum);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = dueDateObj.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Dia ${dayNum} (Atrasado)`,
      colorClass: 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-extrabold animate-pulse',
      badgeText: 'Atrasado',
    };
  } else if (diffDays <= 5) {
    return {
      label: `Dia ${dayNum} (${diffDays === 0 ? 'Vence Hoje' : `Vence em ${diffDays}d`})`,
      colorClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40 font-bold',
      badgeText: 'Próximo',
    };
  } else {
    return {
      label: `Dia ${dayNum}`,
      colorClass: 'bg-slate-800 text-slate-100 border-slate-700',
      badgeText: 'Em Aberto',
    };
  }
}

// Calculate installment details given an expense item and current monthKey
export function getInstallmentInfo(item?: FixedExpenseItem | null, currentMonthKey?: string) {
  if (!item || item.recurrenceType !== 'installment') return null;
  const start = item.startMonthKey || item.monthKey;
  if (!start || typeof start !== 'string' || !start.includes('-')) return null;

  const validCurrentKey =
    typeof currentMonthKey === 'string' && currentMonthKey.includes('-')
      ? currentMonthKey
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [sy, sm] = start.split('-').map(Number);
  const [cy, cm] = validCurrentKey.split('-').map(Number);

  const currentNum = (cy - sy) * 12 + (cm - sm) + 1;

  let total = item.totalInstallments;
  if (!total && item.endMonthKey && typeof item.endMonthKey === 'string' && item.endMonthKey.includes('-')) {
    const [ey, em] = item.endMonthKey.split('-').map(Number);
    total = (ey - sy) * 12 + (em - sm) + 1;
  }
  total = Math.max(total || 1, 1);

  const isActiveInMonth = currentNum >= 1 && currentNum <= total;
  return {
    currentInstallment: currentNum,
    totalInstallments: total,
    isActiveInMonth,
    label: `Parcela ${currentNum}/${total}`,
    isLast: currentNum === total,
    startMonthKey: start,
    endMonthKey: item.endMonthKey,
  };
}

// Calculate endMonthKey from startMonthKey and total installments
export function calculateEndMonthKey(startMonthKey?: string, totalCount: number = 1): string {
  const validStart =
    typeof startMonthKey === 'string' && startMonthKey.includes('-')
      ? startMonthKey
      : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [y, m] = validStart.split('-').map(Number);
  const d = new Date(y, m - 1 + (Math.max(totalCount, 1) - 1), 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Calculate total installments from startMonthKey and endMonthKey
export function calculateTotalInstallmentsCount(startMonthKey?: string, endMonthKey?: string): number {
  if (!startMonthKey || !endMonthKey || !startMonthKey.includes('-') || !endMonthKey.includes('-')) return 1;
  const [sy, sm] = startMonthKey.split('-').map(Number);
  const [ey, em] = endMonthKey.split('-').map(Number);
  const diff = (ey - sy) * 12 + (em - sm) + 1;
  return Math.max(diff, 1);
}

// Format month key for friendly display (e.g. "2026-08" -> "Agosto/2026")
export function formatMonthLabel(key?: string): string {
  if (!key || typeof key !== 'string' || !key.includes('-')) return key || '';
  const [yearStr, monthStr] = key.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  if (isNaN(year) || isNaN(month)) return key;
  const d = new Date(year, month, 1);
  const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year}`;
}

// Compact & Elegant Interactive Payment Status Switch
export const StatusSwitch: React.FC<{
  isPaid: boolean;
  onToggle: (e?: React.MouseEvent) => void;
  size?: 'sm' | 'md';
}> = ({ isPaid, onToggle, size = 'sm' }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      className={`relative inline-flex items-center rounded-full p-1 transition-all duration-300 cursor-pointer border select-none ${
        size === 'sm' ? 'w-[124px] h-8 text-[10px]' : 'w-[146px] h-10 text-xs'
      } ${
        isPaid
          ? 'bg-slate-950 border-emerald-500/40 shadow-emerald-950/40'
          : 'bg-slate-950 border-rose-500/40 shadow-rose-950/40'
      }`}
      title="Clique para alternar PAGO / À PAGAR"
    >
      {/* Sliding Highlight Button */}
      <div
        className={`absolute top-1 bottom-1 rounded-full transition-all duration-300 shadow-md font-black flex items-center justify-center ${
          size === 'sm' ? 'w-[58px]' : 'w-[68px]'
        } ${
          isPaid
            ? 'right-1 bg-emerald-500 text-slate-950 shadow-emerald-500/40'
            : 'left-1 bg-rose-600 text-white shadow-rose-600/40'
        }`}
      >
        {isPaid ? 'PAGO' : 'À PAGAR'}
      </div>

      {/* Background Labels */}
      <div className="w-full flex justify-between px-2 font-black uppercase tracking-wider text-slate-500 pointer-events-none">
        <span className={!isPaid ? 'opacity-0' : 'opacity-60'}>À PAGAR</span>
        <span className={isPaid ? 'opacity-0' : 'opacity-60'}>PAGO</span>
      </div>
    </button>
  );
};

export const FixedExpenseModal: React.FC<FixedExpenseModalProps> = ({
  expense,
  members,
  currentMember,
  monthKey: propMonthKey,
  onClose,
  onSave,
  onDelete,
}) => {
  const currentMonthDefault = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1
  ).padStart(2, '0')}`;
  const monthKey = propMonthKey || currentMonthDefault;

  // Mode: if editing existing, default to view mode (!isEditing); if new, default to edit mode
  const [isEditing, setIsEditing] = useState<boolean>(!expense);
  const [showConfirmDelete, setShowConfirmDelete] = useState<boolean>(false);
  const [showPayerPrompt, setShowPayerPrompt] = useState<boolean>(false);
  const [tempPayerId, setTempPayerId] = useState<string>(expense?.paidByMemberId || currentMember.id || 'both');

  const [title, setTitle] = useState<string>(expense?.title || '');
  const [amount, setAmount] = useState<string>(
    expense?.amount ? expense.amount.toString() : ''
  );
  const [category, setCategory] = useState<CategoryType>(
    expense?.category || 'Moradia'
  );
  const [paidByMemberId, setPaidByMemberId] = useState<string>(
    expense?.paidByMemberId || currentMember.id
  );
  const [dueDate, setDueDate] = useState<string>(expense?.dueDate || '10');
  const [isPaid, setIsPaid] = useState<boolean>(() => {
    if (!expense) return false;
    return expense.paidMonths?.includes(monthKey) || false;
  });
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    expense?.recurrenceType || 'fixed_amount'
  );
  const [notes, setNotes] = useState<string>(expense?.notes || '');
  const [showInfoPopover, setShowInfoPopover] = useState<boolean>(false);

  // Stored categories and shortcuts state
  const [categories, setCategories] = useState<CategoryItem[]>(() => getStoredCategories());
  const [shortcutNames, setShortcutNames] = useState<string[]>(() => getStoredShortcutNames());
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  const handleUpdateCategories = (newCats: CategoryItem[]) => {
    setCategories(newCats);
    saveStoredCategories(newCats);
  };

  const handleUpdateShortcuts = (newShortcuts: string[]) => {
    setShortcutNames(newShortcuts);
    saveStoredShortcutNames(newShortcuts);
  };

  // Map shortcuts to category items (first 5)
  const shortcutCategoryItems = shortcutNames.slice(0, 5).map((name) => {
    return (
      categories.find((c) => c.name === name) || {
        id: name,
        name,
        label: name,
        iconName: 'MoreHorizontal',
        color: '#94a3b8',
      }
    );
  });

  // Installment specific states
  const initialStartMonth = expense?.startMonthKey || expense?.monthKey || monthKey;
  const initialInstallments = expense?.totalInstallments || (
    expense?.endMonthKey 
      ? calculateTotalInstallmentsCount(initialStartMonth, expense.endMonthKey)
      : 10
  );
  const initialEndMonth = expense?.endMonthKey || calculateEndMonthKey(initialStartMonth, initialInstallments);

  const [startMonthKey, setStartMonthKey] = useState<string>(initialStartMonth);
  const [endMonthKey, setEndMonthKey] = useState<string>(initialEndMonth);
  const [totalInstallments, setTotalInstallments] = useState<number>(initialInstallments);

  const handleTotalInstallmentsChange = (count: number) => {
    const validCount = Math.max(1, count || 1);
    setTotalInstallments(validCount);
    const newEndMonth = calculateEndMonthKey(startMonthKey, validCount);
    setEndMonthKey(newEndMonth);
  };

  const handleEndMonthChange = (newEndMonth: string) => {
    if (!newEndMonth) return;
    setEndMonthKey(newEndMonth);
    const calculatedCount = calculateTotalInstallmentsCount(startMonthKey, newEndMonth);
    setTotalInstallments(calculatedCount);
  };

  const handleStartMonthChange = (newStartMonth: string) => {
    if (!newStartMonth) return;
    setStartMonthKey(newStartMonth);
    const newEndMonth = calculateEndMonthKey(newStartMonth, totalInstallments);
    setEndMonthKey(newEndMonth);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    const currentPaidMonths = expense?.paidMonths || [];
    let updatedPaidMonths = [...currentPaidMonths];
    
    if (isPaid && !updatedPaidMonths.includes(monthKey)) {
      updatedPaidMonths.push(monthKey);
    } else if (!isPaid && updatedPaidMonths.includes(monthKey)) {
      updatedPaidMonths = updatedPaidMonths.filter(m => m !== monthKey);
    }

    onSave({
      id: expense?.id,
      title: title.trim(),
      amount: parseFloat(amount) || 0,
      category,
      paidByMemberId,
      dueDate: dueDate.trim() || '10',
      paidMonths: updatedPaidMonths,
      recurrenceType,
      monthKey: expense?.monthKey || monthKey,
      notes: notes.trim() || undefined,
      startMonthKey: expense?.startMonthKey || (recurrenceType === 'installment' ? startMonthKey : monthKey),
      endMonthKey: recurrenceType === 'installment' ? endMonthKey : undefined,
      totalInstallments: recurrenceType === 'installment' ? totalInstallments : undefined,
    });

    onClose();
  };

  const handleTogglePaidInView = () => {
    if (!isPaid) {
      setTempPayerId(paidByMemberId || currentMember.id || 'both');
      setShowPayerPrompt(true);
    } else {
      setIsPaid(false);
      // If expense exists, auto save status update
      if (expense) {
        const currentPaidMonths = expense.paidMonths || [];
        const updatedPaidMonths = currentPaidMonths.filter(m => m !== monthKey);
        
        onSave({
          ...expense,
          paidMonths: updatedPaidMonths,
        });
      }
    }
  };

  const handleConfirmPayerInModal = (selectedPayer: string) => {
    setIsPaid(true);
    setPaidByMemberId(selectedPayer);
    if (expense) {
      const currentPaidMonths = expense.paidMonths || [];
      const updatedPaidMonths = [...currentPaidMonths];
      if (!updatedPaidMonths.includes(monthKey)) {
        updatedPaidMonths.push(monthKey);
      }

      onSave({
        ...expense,
        paidByMemberId: selectedPayer,
        paidMonths: updatedPaidMonths,
      });
    }
    setShowPayerPrompt(false);
  };

  const payerMember = members.find((m) => m.id === paidByMemberId);
  const dueDateStatus = getDueDateStatus(dueDate, isPaid, monthKey);
  const installmentInfo = expense ? getInstallmentInfo(expense, monthKey) : null;

  const getRecurrenceLabel = (type: RecurrenceType) => {
    switch (type) {
      case 'fixed_amount':
        return '📌 Fixo & Valor Fixo';
      case 'variable_amount':
        return '⚡ Fixo & Valor Variável';
      case 'installment':
        return installmentInfo ? `💳 ${installmentInfo.label}` : '💳 Parcelado';
      case 'single_month':
        return '🗓️ Gasto Único (Apenas este mês)';
      default:
        return 'Fixo';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] h-[100dvh] w-full bg-[#0c0f1d] sm:bg-black/80 sm:backdrop-blur-md flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-[#0c0f1d] border-0 sm:border sm:border-slate-800/90 rounded-none sm:rounded-3xl max-w-lg w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] shadow-2xl flex flex-col relative overflow-hidden">
        {/* Header - Displays Expense Name */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 bg-[#0c0f1d] shrink-0 z-10">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-extrabold text-amber-400 tracking-wider block">
                {expense ? (isEditing ? 'Editar Gasto Fixo' : 'Detalhamento do Gasto') : 'Novo Gasto Fixo'}
              </span>
              <h3 className="text-base sm:text-lg font-black text-white truncate max-w-[200px] sm:max-w-[280px]">
                {title.trim() ? title : 'Novo Gasto Fixo'}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900 sm:bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800 sm:border-transparent active:scale-95"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* VIEW MODE - CLEAN SUMMARY DISPLAY PANEL */}
        {!isEditing ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4 sm:space-y-5">
              {/* Prominent Amount & Interactive Status Switch Bar */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Valor da Conta
                  </span>
                  <span className="text-2xl font-black text-white font-mono">
                    R$ {(parseFloat(amount) || 0).toFixed(2)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    Status de Pagamento
                  </span>
                  <StatusSwitch isPaid={isPaid} onToggle={handleTogglePaidInView} size="md" />
                </div>
              </div>

              {/* Structured Details Cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Recurrence Type */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Recorrência
                  </span>
                  <span className="text-xs font-bold text-slate-200 block">
                    {getRecurrenceLabel(recurrenceType)}
                  </span>
                  {recurrenceType === 'installment' && (
                    <div className="text-[10px] text-amber-400/90 font-medium">
                      {expense?.startMonthKey && `Início: ${formatMonthLabel(expense.startMonthKey)} • `}
                      {expense?.endMonthKey && `Término: ${formatMonthLabel(expense.endMonthKey)}`}
                    </div>
                  )}
                </div>

                {/* Due Date with Smart Color */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Vencimento
                  </span>
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-lg border text-xs font-bold ${dueDateStatus.colorClass}`}
                  >
                    {dueDateStatus.label}
                  </span>
                </div>

                {/* Category */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Categoria
                  </span>
                  <span className="text-xs font-bold text-slate-200 block">
                    {category}
                  </span>
                </div>

                {/* Titular / Quem Paga */}
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Quem Paga
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    {paidByMemberId === 'both' || paidByMemberId === 'casal' ? (
                      <>
                        <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                        <span>Ambos / Casal 👥</span>
                      </>
                    ) : payerMember ? (
                      <>
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: payerMember.color }}
                        />
                        <span>{payerMember.name}</span>
                      </>
                    ) : (
                      <span>Ambos / Casal 👥</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes if any */}
              {notes && (
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Observações / Detalhes
                  </span>
                  <p className="text-xs text-slate-300 italic">{notes}</p>
                </div>
              )}
            </div>

            {/* Footer Buttons in View Mode */}
            <div className="p-4 sm:p-5 bg-[#0e1224] border-t border-slate-800 shrink-0 z-20 flex items-center justify-between gap-3 pb-8 sm:pb-5 shadow-[0_-10px_25px_rgba(0,0,0,0.6)]">
              <div className="flex items-center gap-2">
                {onDelete && expense && (
                  <button
                    type="button"
                    onClick={() => setShowConfirmDelete(true)}
                    className="p-3 bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer active:scale-95"
                    title="Excluir despesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Edit3 className="w-4 h-4" /> Editar
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold rounded-xl cursor-pointer active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          /* EDIT MODE - FULL FORM FIELDS */
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4 sm:space-y-5">
              {/* Recurrence Selector */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Tipo de Recorrência
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowInfoPopover(!showInfoPopover)}
                    className="text-amber-400 hover:text-amber-300 text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Entender</span>
                  </button>
                </div>

                {showInfoPopover && (
                  <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-200 space-y-1 animate-in fade-in duration-150">
                    {recurrenceType === 'fixed_amount' && (
                      <p>
                        <strong>📌 Fixo & Valor Fixo:</strong> Aluguel, Faculdade, Internet, etc.
                      </p>
                    )}
                    {recurrenceType === 'variable_amount' && (
                      <p>
                        <strong>⚡ Fixo & Valor Variável:</strong> Energia, Água, Gás (a conta permanece todo mês para atualizar o valor consumido).
                      </p>
                    )}
                    {recurrenceType === 'installment' && (
                      <p>
                        <strong>💳 Parcelado:</strong> Compras no cartão ou parcelamentos com prazo determinado. Você escolhe qual mês termina e o sistema exibe automaticamente a parcela correspondente (ex: Parcela 1 de 10) a cada mês.
                      </p>
                    )}
                    {recurrenceType === 'single_month' && (
                      <p>
                        <strong>🗓️ Gasto Único:</strong> Apenas para este mês.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('fixed_amount')}
                    className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      recurrenceType === 'fixed_amount'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>📌</span>
                    <span>Fixo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('variable_amount')}
                    className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      recurrenceType === 'variable_amount'
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>⚡</span>
                    <span>Variável</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('installment')}
                    className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      recurrenceType === 'installment'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>💳</span>
                    <span>Parcelado</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecurrenceType('single_month')}
                    className={`p-2.5 rounded-xl text-[11px] font-bold border transition-all text-center flex items-center justify-center gap-1 cursor-pointer ${
                      recurrenceType === 'single_month'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <span>🗓️</span>
                    <span>Único</span>
                  </button>
                </div>

                {/* Bloco de Configuração de Parcelamento */}
                {recurrenceType === 'installment' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl space-y-3 mt-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                        <span>💳</span> Configurar Parcelamento
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30">
                        Termina: {formatMonthLabel(endMonthKey)}
                      </span>
                    </div>

                    {/* Quantas parcelas faltam */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-200">
                          Quantas parcelas faltam?
                        </label>
                        <span className="text-xs font-black text-amber-400 font-mono">
                          {totalInstallments}x de R$ {(parseFloat(amount) || 0) > 0 ? (parseFloat(amount) || 0).toFixed(2) : '0,00'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTotalInstallmentsChange(Math.max(1, totalInstallments - 1))}
                          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                        >
                          -
                        </button>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="1"
                            max="120"
                            value={totalInstallments}
                            onChange={(e) => handleTotalInstallmentsChange(parseInt(e.target.value, 10))}
                            className="w-full bg-slate-950 border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-sm text-center text-white font-mono font-black focus:outline-none"
                            placeholder="Ex: 10"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTotalInstallmentsChange(totalInstallments + 1)}
                          className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-white font-black text-base flex items-center justify-center cursor-pointer active:scale-95 transition-all shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Atalhos Rápidos de Parcelas */}
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">
                        Atalhos rápidos:
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[2, 3, 4, 5, 6, 10, 12, 18, 24, 36, 48].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleTotalInstallmentsChange(num)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                              totalInstallments === num
                                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            {num}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Status de Término */}
                    <div className="bg-slate-950/90 p-2.5 rounded-xl border border-slate-800 text-[11px] flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Previsão de quitação:</span>
                      <span className="font-mono font-black text-amber-400">
                        Termina: {formatMonthLabel(endMonthKey)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Nome do Gasto */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nome do Gasto
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Aluguel, Conta de Luz, Internet, Faculdade"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Valor */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:outline-none font-bold"
                  />
                </div>

                {/* Vencimento */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Dia do Vencimento
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 10 ou 15"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Titular */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quem Paga / Titular
                </label>
                <select
                  value={paidByMemberId}
                  onChange={(e) => setPaidByMemberId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none font-bold"
                >
                  <option value="both">👥 Ambos / Casal (Compartilhado)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* CATEGORIA - SEÇÃO DE ATALHOS UNIFICADA */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      Categoria
                    </label>
                    {category && (
                      <span className="text-[10px] font-extrabold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
                        {category}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCategoriesModal(true)}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Personalizar</span>
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {shortcutCategoryItems.map((catItem) => {
                    const isSelected = category === catItem.name;
                    return (
                      <button
                        key={catItem.name}
                        type="button"
                        onClick={() => setCategory(catItem.name as CategoryType)}
                        className="flex flex-col items-center gap-1 cursor-pointer group"
                      >
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'ring-1 ring-amber-400/90 scale-105 shadow-md'
                              : 'bg-slate-950 border-slate-800 text-slate-400 group-hover:border-slate-700'
                          }`}
                          style={{
                            backgroundColor: isSelected ? `${catItem.color}25` : undefined,
                            borderColor: isSelected ? catItem.color : undefined,
                            color: isSelected ? catItem.color : undefined,
                          }}
                        >
                          {renderCategoryIcon(catItem.iconName, 'w-4 h-4')}
                        </div>
                        <span
                          className={`text-[9px] sm:text-[10px] text-center truncate max-w-full ${
                            isSelected ? 'text-white font-black' : 'text-slate-400'
                          }`}
                        >
                          {catItem.label || catItem.name}
                        </span>
                      </button>
                    );
                  })}

                  {/* 6th Slot: "Ver Todas" */}
                  <button
                    type="button"
                    onClick={() => setShowCategoriesModal(true)}
                    className="flex flex-col items-center gap-1 cursor-pointer group"
                    title="Ver todas as categorias"
                  >
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 group-hover:text-amber-200 group-hover:border-amber-400 flex items-center justify-center transition-all group-hover:scale-105 shadow-xs">
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                    <span className="text-[9px] sm:text-[10px] text-center truncate max-w-full text-amber-300 font-bold">
                      Ver Todas
                    </span>
                  </button>
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observações (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Chave Pix, código de barras ou detalhes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Edit Action Footer - Sticky at bottom */}
            <div className="p-4 sm:p-5 bg-[#0e1224] border-t border-slate-800 shrink-0 z-20 flex items-center justify-between gap-3 pb-8 sm:pb-5 shadow-[0_-10px_25px_rgba(0,0,0,0.6)]">
              {expense ? (
                <div className="flex items-center gap-2">
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => setShowConfirmDelete(true)}
                      className="p-3 bg-red-950/50 hover:bg-red-900/60 border border-red-500/30 text-red-400 rounded-xl transition-all cursor-pointer active:scale-95"
                      title="Excluir despesa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold rounded-xl cursor-pointer active:scale-95"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-bold rounded-xl cursor-pointer active:scale-95"
                >
                  Cancelar
                </button>
              )}

              <button
                type="submit"
                className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" /> Salvar Gasto Fixo
              </button>
            </div>
          </form>
        )}

        {/* CUSTOM CONFIRM DELETE MODAL OVERLAY */}
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-950 border border-red-500/40 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-extrabold text-white">Excluir Gasto Fixo?</h4>
                <p className="text-xs text-slate-300">
                  Como deseja excluir <strong>"{title}"</strong>?
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (expense) {
                      const currentExcluded = expense.excludedMonths || [];
                      onSave({
                        ...expense,
                        excludedMonths: [...currentExcluded, monthKey]
                      });
                      onClose();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-800 cursor-pointer"
                >
                  Excluir apenas este mês ({formatMonthLabel(monthKey)})
                </button>
                
                {(recurrenceType === 'fixed_amount' || recurrenceType === 'variable_amount') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (expense) {
                        // Calculate previous month for endMonthKey
                        const [y, m] = monthKey.split('-').map(Number);
                        const prevDate = new Date(y, m - 2, 1);
                        const prevMonthKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
                        
                        onSave({
                          ...expense,
                          endMonthKey: prevMonthKey,
                          totalInstallments: undefined
                        });
                        onClose();
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-800 cursor-pointer"
                  >
                    Excluir deste mês em diante (Incluindo este)
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (onDelete && expense) {
                      onDelete(expense.id);
                      onClose();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer"
                >
                  Excluir TUDO (Remover permanentemente)
                </button>

                <button
                  type="button"
                  onClick={() => setShowConfirmDelete(false)}
                  className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer mt-2"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CENTRALIZADO: Quem Pagou a Conta Este Mês? */}
        {showPayerPrompt && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-[#0c0f1d] border border-amber-500/40 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-extrabold text-emerald-400 tracking-wider block">
                      Confirmar Pagamento
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      Quem pagou esta conta?
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPayerPrompt(false)}
                  className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-slate-700"
                  title="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informações do Gasto */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Conta</span>
                  <span className="text-sm font-black text-white truncate block">
                    {title || 'Gasto Fixo'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Valor</span>
                  <span className="text-base font-black text-amber-400 font-mono">
                    R$ {(parseFloat(amount) || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Opções de Quem Pagou */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 block">
                  Selecione quem realizou o pagamento este mês:
                </label>

                <div className="space-y-2">
                  {members.map((member) => {
                    const isSelected = tempPayerId === member.id;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setTempPayerId(member.id)}
                        className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg'
                            : 'bg-slate-950 hover:bg-slate-900 border-slate-800/90 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0"
                            style={{ backgroundColor: member.color || '#3b82f6' }}
                          >
                            {member.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <div className="text-xs sm:text-sm font-black text-white">{member.name}</div>
                            <span className="text-[10px] text-slate-400 block">
                              Pago integralmente por {member.name}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'border-amber-400 bg-amber-500 text-slate-950'
                              : 'border-slate-700'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}

                  {/* Opção Ambos / Compartilhado */}
                  <button
                    type="button"
                    onClick={() => setTempPayerId('both')}
                    className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer active:scale-[0.98] ${
                      tempPayerId === 'both' || tempPayerId === 'casal'
                        ? 'bg-pink-500/15 border-pink-500 text-white shadow-lg'
                        : 'bg-slate-950 hover:bg-slate-900 border-slate-800/90 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-xs font-black text-white shadow-xs shrink-0">
                        👥
                      </div>
                      <div className="text-left">
                        <div className="text-xs sm:text-sm font-black text-white">Ambos / Casal (50% cada)</div>
                        <span className="text-[10px] text-slate-400 block">
                          Dividido igualmente entre o casal
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                        tempPayerId === 'both' || tempPayerId === 'casal'
                          ? 'border-pink-400 bg-pink-500 text-white'
                          : 'border-slate-700'
                      }`}
                    >
                      {(tempPayerId === 'both' || tempPayerId === 'casal') && (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Rodapé de Ação */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPayerPrompt(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmPayerInModal(tempPayerId)}
                  className="flex-1 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs sm:text-sm font-black rounded-xl shadow-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" /> Confirmar Pagamento
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE GERENCIAMENTO DE CATEGORIAS E ATALHOS */}
        <CategoriesManagerModal
          isOpen={showCategoriesModal}
          onClose={() => setShowCategoriesModal(false)}
          categories={categories}
          selectedCategoryName={category}
          onSelectCategory={(catName) => setCategory(catName as CategoryType)}
          onUpdateCategories={handleUpdateCategories}
          shortcutNames={shortcutNames}
          onUpdateShortcuts={handleUpdateShortcuts}
        />
      </div>
    </div>
  );
};
