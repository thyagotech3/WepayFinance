import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { FamilyMember, CategoryType, SplitType, Transaction, IncomeStream, IncomeHistoryEntry } from '../types';
import { CATEGORIES_META } from '../data/suggestions';
import { 
  getMemberIncomeOptions, 
  saveIncomeStreamToStorage, 
  getFullMemberIncomeStreams, 
  deleteIncomeStreamFromStorage, 
  formatMemberName 
} from '../utils/incomeUtils';
import { AddIncomeModal } from './AddIncomeModal';
import { CategoriesManagerModal } from './CategoriesManagerModal';
import { IncomeCategoriesManagerModal } from './IncomeCategoriesManagerModal';
import { DatePickerModal } from './DatePickerModal';
import {
  CategoryItem,
  getStoredCategories,
  saveStoredCategories,
  getStoredShortcutNames,
  saveStoredShortcutNames,
  renderCategoryIcon,
} from '../utils/categoryUtils';
import { 
  X, HelpCircle, Users, User, Home as HomeIcon, ShoppingCart, Car, Gamepad2, 
  Heart, MoreHorizontal, Calendar, CheckCircle2, Wallet, Plus, TrendingUp,
  LayoutGrid, Sparkles, ChevronDown, Trash2, ArrowLeft, History, ChevronRight, Pencil
} from 'lucide-react';

interface NewTransactionViewProps {
  members: FamilyMember[];
  currentMember: FamilyMember;
  initialType?: 'expense' | 'income' | 'fixed';
  onBack: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'date'> & { date?: string }) => void;
  onAddIncomeStream?: (memberId: string, streamData: any, monthKey: string) => void;
  onOpenFixedExpenses?: () => void;
}

export const NewTransactionView: React.FC<NewTransactionViewProps> = ({
  members,
  currentMember,
  initialType = 'expense',
  onBack,
  onAddTransaction,
  onAddIncomeStream,
  onOpenFixedExpenses,
}) => {
  const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'fixed'>(initialType);

  useEffect(() => {
    if (initialType) {
      setTransactionType(initialType);
    }
  }, [initialType]);

  // Form states
  const [amount, setAmount] = useState('');
  const [whoOption, setWhoOption] = useState<'casal' | 'homem' | 'mulher'>('casal');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidByMemberId, setPaidByMemberId] = useState<string>(currentMember.id);
  const [category, setCategory] = useState<CategoryType>('Alimentação');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);

  const formattedDateLabel = useMemo(() => {
    const today = new Date();
    const isToday = 
      selectedDate.getDate() === today.getDate() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getFullYear() === today.getFullYear();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = 
      selectedDate.getDate() === yesterday.getDate() &&
      selectedDate.getMonth() === yesterday.getMonth() &&
      selectedDate.getFullYear() === yesterday.getFullYear();

    const months = [
      'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
      'jul', 'ago', 'set', 'out', 'nov', 'dez'
    ];

    if (isToday) return `Hoje, ${selectedDate.getDate()} ${months[selectedDate.getMonth()]}`;
    if (isYesterday) return `Ontem, ${selectedDate.getDate()} ${months[selectedDate.getMonth()]}`;
    return `${selectedDate.getDate()} ${months[selectedDate.getMonth()]}, ${selectedDate.getFullYear()}`;
  }, [selectedDate]);

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

  // Helper member references for members
  const maleMember = members[0] || { id: 'm1', name: 'Membro 1', color: '#3b82f6' };
  const femaleMember = members[1] || members[0] || { id: 'm2', name: 'Membro 2', color: '#ec4899' };

  // Income gain modal state (full Renda Extra modal identical to Rendas page)
  const [activeExtraStream, setActiveExtraStream] = useState<IncomeStream | null>(null);
  const [showAllEntriesView, setShowAllEntriesView] = useState(false);
  const [showAddGanhoForm, setShowAddGanhoForm] = useState(false);
  const [registerAmountInput, setRegisterAmountInput] = useState('');
  const [registerNoteInput, setRegisterNoteInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingStream, setEditingStream] = useState<IncomeStream | null>(null);
  const [streamToDelete, setStreamToDelete] = useState<IncomeStream | null>(null);
  const [showIncomeCategoriesModal, setShowIncomeCategoriesModal] = useState(false);

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

  // Dynamic income options from Renda page
  const incomeOptions = getMemberIncomeOptions(whoOption, members);

  useEffect(() => {
    if (transactionType === 'income') {
      if (whoOption === 'casal') {
        setWhoOption('homem');
        setSplitType('individual');
        if (maleMember) setPaidByMemberId(maleMember.id);
      }
      const isCurrentValid = incomeOptions.some((opt) => opt.name === category);
      if (!isCurrentValid && incomeOptions.length > 0) {
        setCategory(incomeOptions[0].name as CategoryType);
      }
    }
  }, [transactionType, whoOption, members]);

  const activeTargetMember = whoOption === 'homem' ? maleMember : whoOption === 'mulher' ? femaleMember : currentMember;

  const handleOpenStreamModal = (streamItem: { id: string; name: string; icon: string; nature?: string }) => {
    const targetMemberId = activeTargetMember.id;
    const allStreams = getFullMemberIncomeStreams(targetMemberId);
    const found = allStreams.find(
      (s) => s.id === streamItem.id || s.name.trim().toLowerCase() === streamItem.name.trim().toLowerCase()
    );

    const fullStream: IncomeStream = found || {
      id: streamItem.id || `stream-${Date.now()}`,
      name: streamItem.name,
      amount: 0,
      targetGoal: 0,
      nature: 'extra',
      icon: streamItem.icon || '💻',
      history: [],
      received: false,
    };

    setActiveExtraStream(fullStream);
    setShowAllEntriesView(false);
    setShowAddGanhoForm(true);
    setRegisterAmountInput('');
    setRegisterNoteInput('');
    setShowDeleteConfirm(false);
  };

  const handleAddGainToActiveStream = () => {
    if (!activeExtraStream) return;
    const inputVal = registerAmountInput.replace(',', '.');
    const added = parseFloat(inputVal) || 0;
    const noteText = registerNoteInput.trim();
    if (added <= 0) return;

    const targetMemberId = activeTargetMember.id;
    const currentAmt = activeExtraStream.amount || 0;
    const newTotal = currentAmt + added;

    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;

    const newEntry: IncomeHistoryEntry = {
      id: 'entry_' + Date.now(),
      amount: added,
      date: dateStr,
      notes: noteText || undefined,
    };

    const currentHistory = activeExtraStream.history || [];
    const updatedHistory = [newEntry, ...currentHistory];

    const streamPayload: IncomeStream = {
      ...activeExtraStream,
      amount: newTotal,
      received: true,
      notes: noteText || activeExtraStream.notes,
      history: updatedHistory,
      lastEntryAmount: added,
      receivedDate: now.toISOString().split('T')[0],
    };

    if (onAddIncomeStream) {
      onAddIncomeStream(targetMemberId, streamPayload, monthKey);
    } else {
      try {
        saveIncomeStreamToStorage(targetMemberId, streamPayload, monthKey, undefined, false);
      } catch (e) {
        console.error('Error updating income stream:', e);
      }
    }

    setActiveExtraStream(streamPayload);

    onAddTransaction({
      description: noteText ? `${activeExtraStream.name} - ${noteText}` : activeExtraStream.name,
      amount: added,
      category: 'Serviços',
      categoryIcon: activeExtraStream.icon || 'TrendingUp',
      type: 'income',
      paidByMemberId: targetMemberId,
      splitType: 'individual',
      isRecurrent: false,
      aiCategorized: false,
    });

    setShowSuccessToast(true);
    setRegisterAmountInput('');
    setRegisterNoteInput('');
    setShowAddGanhoForm(false);
  };

  const handleDeleteHistoryEntry = (entryId: string) => {
    if (!activeExtraStream) return;
    const currentHistory = activeExtraStream.history || [];
    const entryToDelete = currentHistory.find((h) => h.id === entryId);
    if (!entryToDelete) return;

    const updatedHistory = currentHistory.filter((h) => h.id !== entryId);
    const newTotal = Math.max(0, (activeExtraStream.amount || 0) - entryToDelete.amount);
    const newLast = updatedHistory.length > 0 ? updatedHistory[0].amount : 0;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMemberId = activeTargetMember.id;

    const updatedStream: IncomeStream = {
      ...activeExtraStream,
      amount: newTotal,
      received: newTotal > 0,
      notes: updatedHistory[0]?.notes || '',
      history: updatedHistory,
      lastEntryAmount: newLast,
    };

    if (onAddIncomeStream) {
      onAddIncomeStream(targetMemberId, updatedStream, monthKey);
    } else {
      saveIncomeStreamToStorage(targetMemberId, updatedStream, monthKey, undefined, false);
    }

    setActiveExtraStream(updatedStream);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (transactionType === 'income') return;

    const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
    if (numericAmount <= 0) return;

    const finalDescription = description.trim() || (
      transactionType === 'fixed' ? 'Despesa fixa sem nome' : 'Gasto sem nome'
    );

    const foundCategory = categories.find((c) => c.name === category);
    const categoryIcon = foundCategory?.iconName || CATEGORIES_META[category]?.icon || 'ShoppingCart';

    const txDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      12, 0, 0
    ).toISOString();

    onAddTransaction({
      description: finalDescription,
      amount: numericAmount,
      category,
      categoryIcon,
      type: 'expense',
      paidByMemberId,
      splitType,
      isRecurrent: transactionType === 'fixed',
      aiCategorized: false,
      date: txDate,
    });

    setShowSuccessToast(true);
    setTimeout(() => {
      onBack();
    }, 700);
  };

  const selectedMemberObj = members.find(m => m.id === paidByMemberId) || (whoOption === 'homem' ? maleMember : femaleMember);

  return (
    <div className="w-full max-w-md md:max-w-2xl lg:max-w-3xl mx-auto flex flex-col justify-start animate-in fade-in duration-200 px-0.5 sm:px-1 md:px-0 py-0.5 md:py-2">
      {/* Toast Overlay */}
      {showSuccessToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce text-xs sm:text-sm">
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>Lançamento salvo com sucesso!</span>
        </div>
      )}

      {/* CARD WRAPPER */}
      <div className="w-full bg-[#0c0f1f]/80 md:bg-[#0c0f1f]/85 border border-slate-800/70 md:border-slate-800/80 rounded-2xl md:rounded-3xl p-2.5 sm:p-4 md:p-6 shadow-xl md:shadow-2xl md:backdrop-blur-xl flex flex-col justify-start space-y-2 sm:space-y-2.5 md:space-y-3.5">
        {/* TOP HEADER & SWITCHER SECTION */}
        <div className="space-y-1.5 sm:space-y-2 shrink-0">
          {/* 1. TOP HEADER BAR */}
          <div className="text-center pt-0 pb-0">
            <h1 className="text-sm sm:text-base md:text-xl font-black text-white tracking-tight leading-none">
              Novo lançamento
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-medium">
              Registre um gasto, entrada ou visualize despesas fixas
            </p>
          </div>

          {/* 2. TRANSACTION TYPE SWITCHER: Gasto / Entrada / Despesas Fixas */}
          <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-1 sm:gap-2 w-full max-w-md mx-auto pt-0.5">
            {/* Gasto */}
            <button
              type="button"
              onClick={() => setTransactionType('expense')}
              className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                transactionType === 'expense'
                  ? 'bg-gradient-to-b from-[#1c122e] to-[#0e1220] border-2 border-purple-500 text-white shadow-md shadow-purple-950/50 scale-[1.01]'
                  : 'bg-gradient-to-b from-[#161324]/60 to-[#0e1220]/60 border border-purple-500/20 text-slate-400 hover:border-purple-500/40 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
                transactionType === 'expense'
                  ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800'
              }`}>
                <Wallet className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Gasto</span>
            </button>

            {/* Entrada */}
            <button
              type="button"
              onClick={() => setTransactionType('income')}
              className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                transactionType === 'income'
                  ? 'bg-gradient-to-b from-[#10241b] to-[#0e1220] border-2 border-emerald-500 text-white shadow-md shadow-emerald-950/50 scale-[1.01]'
                  : 'bg-gradient-to-b from-[#10241b]/40 to-[#0e1220]/60 border border-emerald-500/20 text-slate-400 hover:border-emerald-500/40 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
                transactionType === 'income'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800'
              }`}>
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Entrada</span>
            </button>

            {/* Despesas Fixas */}
            <button
              type="button"
              onClick={() => {
                if (onOpenFixedExpenses) {
                  onOpenFixedExpenses();
                } else {
                  setTransactionType('fixed');
                }
              }}
              className={`py-1.5 sm:py-2 px-1 sm:px-2 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
                transactionType === 'fixed'
                  ? 'bg-gradient-to-b from-[#241a12] to-[#0e1220] border-2 border-amber-500 text-white shadow-md shadow-amber-950/50 scale-[1.01]'
                  : 'bg-gradient-to-b from-[#241a12]/40 to-[#0e1220]/60 border border-amber-500/20 text-slate-400 hover:border-amber-500/40 hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
                transactionType === 'fixed'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800'
              }`}>
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Despesas Fixas</span>
            </button>
          </div>
        </div>

        {/* ENTRADA (INCOME) STREAMLINED VIEW */}
        {transactionType === 'income' ? (
          <div className="flex-1 flex flex-col justify-start space-y-3 sm:space-y-4 pt-1">
            {/* 1. QUEM RECEBEU? */}
            <div className="space-y-1 max-w-sm">
              <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Quem recebeu?
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#080914] border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setWhoOption('homem');
                    setSplitType('individual');
                    if (maleMember) setPaidByMemberId(maleMember.id);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    whoOption === 'homem'
                      ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                      : 'text-slate-400 hover:text-white bg-slate-900/30'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                  <span className="truncate">{maleMember?.name || 'Homem'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setWhoOption('mulher');
                    setSplitType('individual');
                    if (femaleMember) setPaidByMemberId(femaleMember.id);
                  }}
                  className={`py-1.5 px-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    whoOption === 'mulher'
                      ? 'bg-pink-600 text-white shadow-md ring-1 ring-pink-400'
                      : 'text-slate-400 hover:text-white bg-slate-900/30'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                  <span className="truncate">{femaleMember?.name || 'Mulher'}</span>
                </button>
              </div>
            </div>

            {/* 2. RENDA / CATEGORIA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  RENDAS EXTRAS
                </label>
                <button
                  type="button"
                  onClick={() => setShowIncomeCategoriesModal(true)}
                  className="text-[10px] sm:text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Editar categorias da renda</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {/* Botão Nova Renda */}
                <button
                  type="button"
                  onClick={() => setShowAddIncomeModal(true)}
                  className="p-2.5 sm:p-3 bg-[#080914] hover:bg-emerald-950/40 border border-emerald-500/50 hover:border-emerald-400 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group text-left shadow-xs active:scale-98"
                >
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-extrabold text-white block truncate group-hover:text-emerald-300">
                      Nova Renda
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-slate-400 block truncate">
                      Criar renda
                    </span>
                  </div>
                </button>

                {incomeOptions.map((item) => (
                  <button
                    key={item.id + item.name}
                    type="button"
                    onClick={() => handleOpenStreamModal(item)}
                    className="p-2.5 sm:p-3 bg-[#080914] hover:bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 rounded-xl flex items-center gap-2.5 transition-all cursor-pointer group text-left shadow-xs active:scale-98"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform text-blue-400">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-extrabold text-white block truncate group-hover:text-blue-300">
                        {item.name}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-blue-400/90 font-medium block truncate">
                        + Registrar ganho
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* GASTO / DESPESAS FIXAS FORM FIELDS */
          <form onSubmit={handleSubmit} className="w-full space-y-2 sm:space-y-2.5">
            {/* 1. DESCRIÇÃO NO TOPO */}
            <div className="space-y-1">
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Descrição <span className="text-slate-500 font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Almoço no restaurante, compras..."
                className="w-full bg-[#080914] border border-slate-800 focus:border-purple-500/60 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
              />
            </div>

            {/* 2. LINHA LADO A LADO: VALOR (ESQUERDA - MAIOR LARGURA) + QUEM PAGOU (DIREITA - MENOR LARGURA) */}
            <div className="grid grid-cols-[1.35fr_0.95fr] sm:grid-cols-[1.4fr_1fr] gap-2 sm:gap-2.5 items-stretch">
              {/* VALOR (ESQUERDA) */}
              <div className="flex flex-col space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Valor
                </label>
                <div className="flex flex-col gap-1.5 flex-1 justify-between">
                  <div className="bg-[#080914] border border-slate-800 focus-within:border-purple-500/60 rounded-xl px-2.5 py-1.5 sm:py-2 flex items-center justify-between shadow-inner flex-1 min-h-[44px]">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-xs sm:text-sm font-bold text-purple-400 font-mono">R$</span>
                      <input
                        id="valor-input"
                        type="text"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-transparent text-xl sm:text-2xl font-black font-mono text-white focus:outline-none placeholder-slate-600"
                      />
                    </div>

                    {amount && (
                      <button
                        type="button"
                        onClick={() => setAmount('')}
                        className="p-1 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                        title="Apagar valor"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Atalhos de Valores Rápidos (2 linhas de 3 botões: +2, +5, +10 e +20, +50, +100) */}
                  <div className="grid grid-cols-3 gap-1">
                    {[2, 5, 10, 20, 50, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(amount.replace(',', '.')) || 0;
                          const val = current + preset;
                          setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2).replace('.', ','));
                        }}
                        className="py-1.5 sm:py-2 px-1 bg-[#121426] hover:bg-purple-950/80 active:scale-95 text-purple-300 hover:text-white font-mono font-black text-[11px] sm:text-xs rounded-lg border border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer shadow-xs text-center flex items-center justify-center"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* QUEM PAGOU (DIREITA - LARGURA REDUZIDA E ALINHAMENTO PERFEITO) */}
              <div className="flex flex-col space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  QUEM PAGOU?
                </label>
                <div className="flex flex-col gap-1 p-1 bg-[#080914] border border-slate-800 rounded-xl flex-1 justify-between">
                  {/* Casal */}
                  <button
                    type="button"
                    onClick={() => {
                      setWhoOption('casal');
                      setSplitType('equal');
                      setPaidByMemberId(currentMember.id);
                    }}
                    className={`flex-1 py-1.5 sm:py-2 px-2 rounded-lg text-[10px] sm:text-xs font-extrabold flex items-center justify-start gap-1.5 transition-all cursor-pointer ${
                      whoOption === 'casal'
                        ? 'bg-purple-600 text-white shadow-xs ring-1 ring-purple-400'
                        : 'text-slate-400 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                    <span className="truncate">Casal</span>
                  </button>

                  {/* Member 1 */}
                  <button
                    type="button"
                    onClick={() => {
                      setWhoOption('homem');
                      setSplitType('individual');
                      if (maleMember) setPaidByMemberId(maleMember.id);
                    }}
                    className={`flex-1 py-1.5 sm:py-2 px-2 rounded-lg text-[10px] sm:text-xs font-extrabold flex items-center justify-start gap-1.5 transition-all cursor-pointer ${
                      whoOption === 'homem'
                        ? 'bg-blue-600 text-white shadow-xs ring-1 ring-blue-400'
                        : 'text-slate-400 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                    <span className="truncate">{maleMember?.name || 'Membro 1'}</span>
                  </button>

                  {/* Member 2 */}
                  <button
                    type="button"
                    onClick={() => {
                      setWhoOption('mulher');
                      setSplitType('individual');
                      if (femaleMember) setPaidByMemberId(femaleMember.id);
                    }}
                    className={`flex-1 py-1.5 sm:py-2 px-2 rounded-lg text-[10px] sm:text-xs font-extrabold flex items-center justify-start gap-1.5 transition-all cursor-pointer ${
                      whoOption === 'mulher'
                        ? 'bg-pink-600 text-white shadow-xs ring-1 ring-pink-400'
                        : 'text-slate-400 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                    <span className="truncate">{femaleMember?.name || 'Membro 2'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. CATEGORIA (OTIMIZADO PARA ALTURA FIXA SEM SCROLL) */}
            <div className="space-y-1 bg-[#080914]/50 border border-slate-800/80 p-2 sm:p-2.5 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Categoria
                  </label>
                  {category && (
                    <span className="text-[9px] sm:text-[10px] font-extrabold text-purple-300 bg-purple-950/80 border border-purple-800/80 px-1.5 py-0.2 rounded">
                      {category}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowCategoriesModal(true)}
                  className="text-[10px] sm:text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Personalizar</span>
                </button>
              </div>

              <div className="grid grid-cols-6 gap-1 pt-0.5">
                {shortcutCategoryItems.map((catItem) => {
                  const isSelected = category === catItem.name;
                  return (
                    <button
                      key={catItem.name}
                      type="button"
                      onClick={() => setCategory(catItem.name as CategoryType)}
                      className="flex flex-col items-center gap-0.5 cursor-pointer group"
                    >
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl border flex items-center justify-center transition-all ${
                          isSelected
                            ? 'ring-2 ring-purple-500/80 scale-105 shadow-md shadow-purple-950/60'
                            : 'bg-[#080914] border-slate-800 text-slate-400 group-hover:border-slate-700'
                        }`}
                        style={{
                          backgroundColor: isSelected ? `${catItem.color}25` : undefined,
                          borderColor: isSelected ? catItem.color : undefined,
                          color: isSelected ? catItem.color : undefined,
                        }}
                      >
                        {renderCategoryIcon(catItem.iconName, 'w-3.5 h-3.5 sm:w-4 sm:h-4')}
                      </div>
                      <span
                        className={`text-[8px] sm:text-[9px] text-center truncate max-w-full font-medium leading-tight ${
                          isSelected ? 'text-white font-bold' : 'text-slate-400'
                        }`}
                      >
                        {catItem.label || catItem.name}
                      </span>
                    </button>
                  );
                })}

                {/* 6th Slot: "Ver Todas" button opening the full category modal */}
                <button
                  type="button"
                  onClick={() => setShowCategoriesModal(true)}
                  className="flex flex-col items-center gap-0.5 cursor-pointer group"
                  title="Ver todas as categorias"
                >
                  <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-xl border border-purple-500/40 bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 group-hover:text-purple-200 group-hover:border-purple-400 flex items-center justify-center transition-all group-hover:scale-105 shadow-xs">
                    <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </div>
                  <span className="text-[8px] sm:text-[9px] text-center truncate max-w-full text-purple-300 font-bold leading-tight">
                    Ver Todas
                  </span>
                </button>
              </div>
            </div>

            {/* 4. DATA + BOTÃO LANÇAR (SEMPRE VISÍVEIS EM UMA LINHA COMPACTA) */}
            <div className="pt-1 flex items-center gap-2 shrink-0 w-full">
              {/* Data Field (Predefinido com a data do dia e abre modal com calendário ao clicar) */}
              <button
                id="btn-selecionar-data"
                type="button"
                onClick={() => setShowDatePickerModal(true)}
                className="w-5/12 bg-[#080914] hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 rounded-xl px-2.5 py-2 flex items-center justify-between text-xs text-slate-200 cursor-pointer h-10 shrink-0 transition-all active:scale-98 group shadow-inner"
                title="Clique para selecionar a data no calendário"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] sm:text-[11px] font-bold text-slate-200 truncate">
                    {formattedDateLabel}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-purple-400 shrink-0 transition-colors" />
              </button>

              {/* LANÇAR Button */}
              <button
                type="submit"
                className="w-7/12 h-10 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 hover:opacity-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-purple-600/30 transition-all cursor-pointer text-center active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>Lançar {transactionType === 'fixed' ? 'Despesa Fixa' : 'Gasto'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL OFICIAL: REGISTRAR GANHO / DETALHES DA RENDA EXTRA (IDÊNTICO À RENDA) */}
      {/* ========================================================================= */}
      {activeExtraStream && typeof document !== 'undefined' && createPortal(
        (() => {
          const streamAmt = activeExtraStream.amount || 0;
          const targetGoal = activeExtraStream.targetGoal || 0;
          const isExceeded = streamAmt > targetGoal;
          const diffAmt = isExceeded ? (streamAmt - targetGoal) : (targetGoal - streamAmt);
          const goalPct = targetGoal > 0 ? Math.round((streamAmt / targetGoal) * 100) : (streamAmt > 0 ? 100 : 0);
          const historyList = activeExtraStream.history || [];
          const lastEntry = historyList.length > 0
            ? historyList[0]
            : (activeExtraStream.lastEntryAmount && activeExtraStream.lastEntryAmount > 0
                ? {
                    id: 'last_legacy',
                    amount: activeExtraStream.lastEntryAmount,
                    date: activeExtraStream.receivedDate || `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                    notes: activeExtraStream.notes,
                  }
                : (streamAmt > 0
                    ? {
                        id: 'amount_legacy',
                        amount: streamAmt,
                        date: activeExtraStream.receivedDate || `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}`,
                        notes: activeExtraStream.notes,
                      }
                    : null));

          return (
            <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
              <div className="bg-[#0b0f1d] border border-slate-800/90 rounded-xl sm:rounded-2xl max-w-md w-full p-3.5 sm:p-5 shadow-2xl space-y-2.5 sm:space-y-3.5 text-white my-auto max-h-[92vh] overflow-y-auto scrollbar-thin">
                
                {/* Header Row */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl border flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-md bg-blue-950/80 border-blue-800/60 text-blue-400">
                      {activeExtraStream.icon || '🚗'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-white truncate">{activeExtraStream.name}</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-950/80 border-blue-800/60 text-blue-400">
                          Renda Extra
                        </span>
                      </div>
                      <span className="text-[10.5px] sm:text-[11px] text-slate-400 font-medium block mt-0.5">
                        Meta mensal: R$ {targetGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveExtraStream(null)}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer active:scale-90 transition-transform shrink-0"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>

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
                        <p className="text-[10px] text-slate-400 font-medium">{activeExtraStream.name}</p>
                      </div>
                      <div className="w-12"></div>
                    </div>

                    {/* Summary Banner */}
                    <div className="bg-[#090d1c] border border-blue-900/50 rounded-xl p-3 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Total Acumulado</span>
                        <span className="text-sm font-black font-mono text-emerald-400">
                          R$ {streamAmt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Registros</span>
                        <span className="text-xs font-bold font-mono text-blue-300">
                          {historyList.length} {historyList.length === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                    </div>

                    {/* Entries History List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {historyList.length > 0 ? (
                        historyList.map((item) => (
                          <div key={item.id} className="bg-[#0d1121] border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-7 h-7 rounded-full bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 text-xs shrink-0 font-mono font-bold">
                                +
                              </div>
                              <div className="min-w-0">
                                <span className="text-[11px] font-bold text-white block truncate">
                                  {item.date} • {activeExtraStream.name}
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
                                onClick={() => handleDeleteHistoryEntry(item.id)}
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

                        {/* Quick Presets for Register Gain */}
                        <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                          {[10, 20, 50, 100].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                const cur = parseFloat(registerAmountInput.replace(',', '.')) || 0;
                                const nVal = cur + preset;
                                setRegisterAmountInput(nVal.toString());
                              }}
                              className="py-1 px-1 bg-[#121426] hover:bg-blue-950/80 active:scale-95 text-blue-300 hover:text-white font-mono font-bold text-[11px] rounded-lg border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer text-center"
                            >
                              +{preset}
                            </button>
                          ))}
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
                            placeholder="Ex: Serviço p/ Maria, corrida..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleAddGainToActiveStream}
                            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                          >
                            Adicionar Ganho
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRegisterNoteInput('');
                              setRegisterAmountInput('');
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
                                {lastEntry.date} • {activeExtraStream.name}
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

                      {/* Caixa de confirmação de exclusão do último lançamento */}
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
                                  const newTotal = Math.max(0, streamAmt - lastEntry.amount);
                                  const newLast = updatedHistory.length > 0 ? updatedHistory[0].amount : 0;
                                  const now = new Date();
                                  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                  const targetMemberId = activeTargetMember.id;

                                  const updatedStream: IncomeStream = {
                                    ...activeExtraStream,
                                    amount: newTotal,
                                    received: newTotal > 0,
                                    notes: updatedHistory[0]?.notes || '',
                                    history: updatedHistory,
                                    lastEntryAmount: newLast,
                                  };

                                  if (onAddIncomeStream) {
                                    onAddIncomeStream(targetMemberId, updatedStream, monthKey);
                                  } else {
                                    saveIncomeStreamToStorage(targetMemberId, updatedStream, monthKey, undefined, false);
                                  }

                                  setActiveExtraStream(updatedStream);
                                } else {
                                  const targetMemberId = activeTargetMember.id;
                                  const now = new Date();
                                  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                  const updatedStream: IncomeStream = {
                                    ...activeExtraStream,
                                    amount: 0,
                                    received: false,
                                    notes: '',
                                    history: [],
                                    lastEntryAmount: 0,
                                  };
                                  if (onAddIncomeStream) {
                                    onAddIncomeStream(targetMemberId, updatedStream, monthKey);
                                  } else {
                                    saveIncomeStreamToStorage(targetMemberId, updatedStream, monthKey, undefined, false);
                                  }
                                  setActiveExtraStream(updatedStream);
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
                  </>
                )}

                {/* Footer Actions (Editar Renda / Excluir Renda) */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      const s = activeExtraStream;
                      setActiveExtraStream(null);
                      setEditingStream(s);
                    }}
                    className="py-2.5 bg-[#121629] border border-purple-900/50 hover:bg-purple-950/60 text-purple-300 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors active:scale-95"
                  >
                    <Pencil className="w-3.5 h-3.5 text-purple-400" />
                    <span>Editar renda</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const s = activeExtraStream;
                      setActiveExtraStream(null);
                      setStreamToDelete(s);
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

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DA RENDA                 */}
      {/* ========================================================= */}
      {streamToDelete && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0e1220] border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800/80 flex items-center justify-center mx-auto text-red-400 shadow-inner">
              <Trash2 className="w-6 h-6 text-red-400" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">Excluir Renda</h3>
              <p className="text-xs text-slate-400">
                Tem certeza que deseja excluir a renda <strong className="text-white">"{streamToDelete.name}"</strong>?
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStreamToDelete(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs rounded-xl border border-slate-800 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetMemberId = activeTargetMember.id;
                  const now = new Date();
                  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                  deleteIncomeStreamFromStorage(targetMemberId, streamToDelete.id, monthKey, false);
                  setStreamToDelete(null);
                  setActiveExtraStream(null);
                }}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-red-950/50 cursor-pointer transition-colors active:scale-95"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL DE ADICIONAR / EDITAR RENDA */}
      {(showAddIncomeModal || editingStream) && (
        <AddIncomeModal
          initialNature="extra"
          initialStream={editingStream || undefined}
          currentMember={activeTargetMember}
          onClose={() => {
            setShowAddIncomeModal(false);
            setEditingStream(null);
          }}
          onAddIncomeStream={(memberId, streamData, monthKey) => {
            const now = new Date();
            const mKey = monthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            let createdStreamId = streamData.id;

            if (onAddIncomeStream) {
              onAddIncomeStream(memberId, streamData, mKey);
            } else {
              const saved = saveIncomeStreamToStorage(memberId, streamData, mKey);
              createdStreamId = saved.id;
            }

            setShowAddIncomeModal(false);
            setEditingStream(null);
          }}
        />
      )}

      {/* MODAL DE TODAS AS CATEGORIAS E GERENCIADOR DE ATALHOS */}
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

      {/* MODAL PARA EDITAR APENAS AS CATEGORIAS DA RENDA */}
      <IncomeCategoriesManagerModal
        isOpen={showIncomeCategoriesModal}
        onClose={() => setShowIncomeCategoriesModal(false)}
        members={members}
        selectedMemberId={activeTargetMember.id}
        onSelectCategory={(categoryName, stream) => {
          if (stream) {
            handleOpenStreamModal(stream);
          }
        }}
      />

      {/* MODAL DE SELEÇÃO DE DATA COM CALENDÁRIO */}
      <DatePickerModal
        isOpen={showDatePickerModal}
        selectedDate={selectedDate}
        onSelectDate={(newDate) => setSelectedDate(newDate)}
        onClose={() => setShowDatePickerModal(false)}
      />
    </div>
  );
};
