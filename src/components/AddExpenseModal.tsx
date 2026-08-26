import React, { useState, useEffect, useMemo } from 'react';
import { FamilyMember, CategoryType, SplitType, Transaction } from '../types';
import { CATEGORIES_META } from '../data/suggestions';
import { getMemberIncomeOptions, saveIncomeStreamToStorage, formatMemberName } from '../utils/incomeUtils';
import { AddIncomeModal } from './AddIncomeModal';
import { DatePickerModal } from './DatePickerModal';
import { 
  X, HelpCircle, Calculator, 
  Users, User, Home as HomeIcon, ShoppingCart, Car, Gamepad2, 
  Heart, MoreHorizontal, Calendar, ChevronDown, Info, 
  ArrowDownCircle, ArrowUpCircle, Wallet, Plus
} from 'lucide-react';

interface AddExpenseModalProps {
  members: FamilyMember[];
  currentMember: FamilyMember;
  onClose: () => void;
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'date'> & { date?: string }) => void;
  onAddIncomeStream?: (memberId: string, streamData: any, monthKey: string) => void;
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  members,
  currentMember,
  onClose,
  onAddTransaction,
  onAddIncomeStream,
}) => {
  const [transactionType, setTransactionType] = useState<'expense' | 'income' | 'fixed'>('expense');

  // Form states
  const [amount, setAmount] = useState('');
  const [whoOption, setWhoOption] = useState<'casal' | 'homem' | 'mulher'>('casal');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidByMemberId, setPaidByMemberId] = useState<string>(currentMember.id);
  const [category, setCategory] = useState<CategoryType>('Alimentação');
  const [description, setDescription] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showAddIncomeModal, setShowAddIncomeModal] = useState(false);
  const [showAllIncomesModal, setShowAllIncomesModal] = useState(false);

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

  // Helper member references for members
  const maleMember = members[0] || { id: 'm1', name: 'Membro 1', color: '#3b82f6' };
  const femaleMember = members[1] || members[0] || { id: 'm2', name: 'Membro 2', color: '#ec4899' };

  const CATEGORIES_LIST: { name: CategoryType; label: string; icon: React.ReactNode; activeColor: string }[] = [
    { name: 'Moradia', label: 'Casa', icon: <HomeIcon className="w-3.5 h-3.5" />, activeColor: 'text-purple-400 border-purple-500 bg-purple-500/20' },
    { name: 'Alimentação', label: 'Alimentação', icon: <ShoppingCart className="w-3.5 h-3.5" />, activeColor: 'text-amber-400 border-amber-500 bg-amber-500/20' },
    { name: 'Transporte', label: 'Transporte', icon: <Car className="w-3.5 h-3.5" />, activeColor: 'text-cyan-400 border-cyan-500 bg-cyan-500/20' },
    { name: 'Lazer', label: 'Lazer', icon: <Gamepad2 className="w-3.5 h-3.5" />, activeColor: 'text-emerald-400 border-emerald-500 bg-emerald-500/20' },
    { name: 'Saúde', label: 'Saúde', icon: <Heart className="w-3.5 h-3.5" />, activeColor: 'text-pink-400 border-pink-500 bg-pink-500/20' },
    { name: 'Outros', label: 'Outros', icon: <MoreHorizontal className="w-3.5 h-3.5" />, activeColor: 'text-slate-300 border-slate-500 bg-slate-500/20' },
  ];

  // Dynamic income options from Renda page + fixed Outros
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount.replace(',', '.')) || 0;
    if (numericAmount <= 0) return;

    const finalDescription = description.trim() || (
      transactionType === 'income' ? (category || 'Entrada sem nome') :
      transactionType === 'fixed' ? 'Despesa fixa sem nome' : 'Gasto sem nome'
    );

    if (transactionType === 'income') {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const matchedStream = incomeOptions.find((opt) => opt.name === category);
      if (matchedStream && matchedStream.id) {
        const streamPayload = {
          id: matchedStream.id,
          name: matchedStream.name,
          amount: numericAmount,
          nature: (matchedStream.nature || 'extra') as any,
          icon: matchedStream.icon,
          notes: description.trim() || undefined,
          isAccumulate: true,
          received: true,
          receivedDate: now.toISOString().split('T')[0],
        };
        try {
          saveIncomeStreamToStorage(paidByMemberId, streamPayload, monthKey, undefined, false);
        } catch (err) {
          console.error('Error accumulating income in storage:', err);
        }
      }
    }

    const txDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      12, 0, 0
    ).toISOString();

    onAddTransaction({
      description: finalDescription,
      amount: numericAmount,
      category: (transactionType === 'income') ? ((category as CategoryType) || 'Outros') : category,
      categoryIcon: (transactionType === 'income') ? 'TrendingUp' : (CATEGORIES_META[category]?.icon || 'ShoppingCart'),
      type: (transactionType === 'income') ? 'income' : 'expense',
      paidByMemberId,
      splitType,
      isRecurrent: transactionType === 'fixed',
      aiCategorized: false,
      date: txDate,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#090b15] border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-2 max-h-[92dvh] overflow-hidden flex flex-col justify-between pb-safe">
        {/* Mobile Bottom Sheet Grab Bar */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto -mt-1 mb-0.5 sm:hidden" />

        {/* 1. TOP HEADER BAR */}
        <div className="flex items-center justify-between pb-0.5">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#111326] border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          <div className="text-center">
            <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-none">
              Novo lançamento
            </h1>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Registre um gasto ou entrada
            </p>
          </div>

          <button
            type="button"
            className="w-7 h-7 rounded-full bg-[#111326] border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2. TRANSACTION TYPE SWITCHER: Gasto / Entrada / Despesas Fixas (Styled like HomeDashboard Action Cards) */}
        <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-1 sm:gap-2 w-full pt-0.5">
          {/* Gasto */}
          <button
            type="button"
            onClick={() => setTransactionType('expense')}
            className={`py-2 px-1 sm:px-1.5 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
              transactionType === 'expense'
                ? 'bg-gradient-to-b from-[#1c122e] to-[#0e1220] border-2 border-purple-500 text-white shadow-lg shadow-purple-950/50 scale-[1.02]'
                : 'bg-gradient-to-b from-[#161324]/60 to-[#0e1220]/60 border border-purple-500/20 text-slate-400 hover:border-purple-500/40 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
              transactionType === 'expense'
                ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            }`}>
              <Wallet className="w-3.5 h-3.5" />
            </div>
            <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Gasto</span>
          </button>

          {/* Entrada */}
          <button
            type="button"
            onClick={() => setTransactionType('income')}
            className={`py-2 px-1 sm:px-1.5 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
              transactionType === 'income'
                ? 'bg-gradient-to-b from-[#10241b] to-[#0e1220] border-2 border-emerald-500 text-white shadow-lg shadow-emerald-950/50 scale-[1.02]'
                : 'bg-gradient-to-b from-[#10241b]/40 to-[#0e1220]/60 border border-emerald-500/20 text-slate-400 hover:border-emerald-500/40 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
              transactionType === 'income'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            }`}>
              <Users className="w-3.5 h-3.5" />
            </div>
            <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Entrada</span>
          </button>

          {/* Despesas Fixas */}
          <button
            type="button"
            onClick={() => setTransactionType('fixed')}
            className={`py-2 px-1 sm:px-1.5 rounded-xl font-extrabold text-[10px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 transition-all duration-200 cursor-pointer ${
              transactionType === 'fixed'
                ? 'bg-gradient-to-b from-[#241a12] to-[#0e1220] border-2 border-amber-500 text-white shadow-lg shadow-amber-950/50 scale-[1.02]'
                : 'bg-gradient-to-b from-[#241a12]/40 to-[#0e1220]/60 border border-amber-500/20 text-slate-400 hover:border-amber-500/40 hover:text-slate-200'
            }`}
          >
            <div className={`p-1 rounded-lg border shrink-0 transition-colors ${
              transactionType === 'fixed'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-900/60 text-slate-400 border-slate-800'
            }`}>
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <span className="whitespace-nowrap uppercase tracking-tighter sm:tracking-tight">Despesas Fixas</span>
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-2 flex-1 flex flex-col justify-between overflow-hidden">
          <div className="space-y-2 flex-1 flex flex-col justify-evenly">
            {/* 1. DESCRIÇÃO (OPCIONAL) - MOVED TO TOP WITH LARGER HEIGHT */}
            <div className="space-y-1">
              <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Descrição <span className="text-slate-500 font-normal lowercase">(opcional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Almoço no restaurante"
                className="w-full bg-[#080914] border border-slate-800 focus:border-purple-500/60 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors shadow-inner"
              />
            </div>

            {/* 2. MIDDLE ROW: VALOR (MAIOR) + PARA QUEM (NARROWER HORIZONTALLY, SAME HEIGHT) */}
            <div className="grid grid-cols-[1.35fr_0.65fr] gap-2 items-stretch">
              {/* VALOR (MAIOR & MAIS LARGO) */}
              <div className="flex flex-col justify-between space-y-1">
                <label className="block text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  Valor
                </label>
                <div className="flex-1 flex flex-col justify-between space-y-1.5">
                  <div className="bg-[#080914] border border-slate-800 focus-within:border-purple-500/60 rounded-xl px-3 py-2.5 flex items-center justify-between shadow-inner flex-1 min-h-[44px]">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className="text-sm font-bold text-slate-400 font-mono">R$</span>
                      <input
                        id="valor-input-modal"
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
                        className="p-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-1 cursor-pointer shrink-0 flex items-center justify-center"
                        title="Apagar valor"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Atalhos de Valores Rápidos (+2, +5, +10) - MAIORES */}
                  <div className="grid grid-cols-3 gap-1.5 w-full">
                    {[2, 5, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(amount.replace(',', '.')) || 0;
                          const val = current + preset;
                          setAmount(val % 1 === 0 ? val.toString() : val.toFixed(2).replace('.', ','));
                        }}
                        className="py-2 px-1 bg-[#121426] hover:bg-purple-950/80 active:scale-95 text-purple-300 hover:text-white font-mono font-black text-sm sm:text-base rounded-xl border border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer shadow-xs text-center flex items-center justify-center"
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* QUEM PAGOU / QUEM RECEBEU */}
              <div className="flex flex-col justify-between space-y-1">
                <div className="flex items-center gap-1">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">
                    {transactionType === 'income' ? 'QUEM RECEBEU?' : 'QUEM PAGOU?'}
                  </label>
                </div>

                <div className="flex-1 flex flex-col gap-1 p-1 bg-[#080914] border border-slate-800 rounded-xl justify-between">
                  {/* Casal (Apenas para despesas) */}
                  {transactionType !== 'income' && (
                    <button
                      type="button"
                      onClick={() => {
                        setWhoOption('casal');
                        setSplitType('equal');
                        setPaidByMemberId(currentMember.id);
                      }}
                      className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-extrabold flex items-center justify-start gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                        whoOption === 'casal'
                          ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-400'
                          : 'text-slate-400 hover:text-white bg-slate-900/30'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 text-purple-300 shrink-0" />
                      <span className="truncate">Casal</span>
                    </button>
                  )}

                  {/* Member 1 */}
                  <button
                    type="button"
                    onClick={() => {
                      setWhoOption('homem');
                      setSplitType('individual');
                      if (maleMember) setPaidByMemberId(maleMember.id);
                    }}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-extrabold flex items-center justify-start gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                      whoOption === 'homem'
                        ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                        : 'text-slate-400 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                    <span className="truncate capitalize">{formatMemberName(maleMember?.name) || 'Membro 1'}</span>
                  </button>

                  {/* Member 2 */}
                  <button
                    type="button"
                    onClick={() => {
                      setWhoOption('mulher');
                      setSplitType('individual');
                      if (femaleMember) setPaidByMemberId(femaleMember.id);
                    }}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-xs font-extrabold flex items-center justify-start gap-1 sm:gap-1.5 transition-all cursor-pointer ${
                      whoOption === 'mulher'
                        ? 'bg-pink-600 text-white shadow-md ring-1 ring-pink-400'
                        : 'text-slate-400 hover:text-white bg-slate-900/30'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-pink-300 shrink-0" />
                    <span className="truncate capitalize">{formatMemberName(femaleMember?.name) || 'Membro 2'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* CATEGORIA */}
            {transactionType === 'income' ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Renda / Categoria
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllIncomesModal(true)}
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    Ver todas
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto py-1 pr-0.5 custom-scrollbar scrollbar-none">
                  {incomeOptions.map((item) => {
                    const isSelected = category === item.name;
                    return (
                      <button
                        key={item.id + item.name}
                        type="button"
                        onClick={() => setCategory(item.name as CategoryType)}
                        className={`py-1.5 px-2.5 rounded-xl border text-[11px] font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                          isSelected
                            ? 'bg-purple-600 border-purple-400 text-white shadow-md ring-1 ring-purple-400'
                            : 'bg-[#080914] border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <span className="text-xs shrink-0">{item.icon}</span>
                        <span className="whitespace-nowrap">{item.name}</span>
                      </button>
                    );
                  })}

                  {/* SQUARE PLUS BUTTON FOR NEW EXTRA INCOME */}
                  <button
                    type="button"
                    onClick={() => setShowAddIncomeModal(true)}
                    className="w-8 h-8 rounded-xl border border-dashed border-purple-500/60 bg-purple-950/30 hover:bg-purple-900/50 text-purple-300 hover:text-white transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-xs active:scale-95"
                    title="Adicionar nova renda extra"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] sm:text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Categoria
                  </label>
                  <button
                    type="button"
                    className="text-[10px] font-bold text-purple-400 hover:text-purple-300"
                  >
                    Ver todas
                  </button>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {CATEGORIES_LIST.map((catItem) => {
                    const isSelected = category === catItem.name;
                    return (
                      <button
                        key={catItem.name}
                        type="button"
                        onClick={() => setCategory(catItem.name)}
                        className="flex flex-col items-center gap-0.5 cursor-pointer group"
                      >
                        <div
                          className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected
                              ? catItem.activeColor + ' ring-1 ring-purple-500/60 scale-105'
                              : 'bg-[#080914] border-slate-800 text-slate-400'
                          }`}
                        >
                          {catItem.icon}
                        </div>
                        <span className={`text-[8px] sm:text-[9px] text-center truncate max-w-full ${isSelected ? 'text-white font-bold' : 'text-slate-400'}`}>
                          {catItem.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* BOTTOM HORIZONTAL ROW: DATA + "LANÇAR" BUTTON */}
          <div className="pt-2 flex items-center gap-2 shrink-0">
            {/* Data Field (Left Side) */}
            <button
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

            {/* LANÇAR Button (Right Side) */}
            <button
              type="submit"
              className="w-7/12 h-10 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-fuchsia-600 hover:opacity-95 text-white font-black text-xs sm:text-sm tracking-wide shadow-lg shadow-purple-600/30 transition-all cursor-pointer text-center active:scale-98 flex items-center justify-center"
            >
              Lançar
            </button>
          </div>
        </form>

        {/* MODALS */}
        {showAddIncomeModal && (
          <AddIncomeModal
            currentMember={
              whoOption === 'homem' ? maleMember : whoOption === 'mulher' ? femaleMember : currentMember
            }
            onClose={() => setShowAddIncomeModal(false)}
            onAddIncomeStream={(memberId, streamData, monthKey) => {
              const mKey = monthKey || '2026-08';
              saveIncomeStreamToStorage(memberId, streamData, mKey);

              if (onAddIncomeStream) {
                onAddIncomeStream(memberId, streamData, mKey);
              }

              setShowAddIncomeModal(false);
              if (streamData.name) {
                setCategory(streamData.name as CategoryType);
              }
            }}
          />
        )}

        {showAllIncomesModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#0f1123] border border-slate-800 rounded-2xl w-full max-w-sm p-4 space-y-3 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>💵</span> Todas as Rendas
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAllIncomesModal(false)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {incomeOptions.map((item) => {
                  const isSelected = category === item.name;
                  return (
                    <button
                      key={item.id + item.name}
                      type="button"
                      onClick={() => {
                        setCategory(item.name as CategoryType);
                        setShowAllIncomesModal(false);
                      }}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                          : 'bg-[#080914] border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span className="truncate">{item.name}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAllIncomesModal(false);
                  setShowAddIncomeModal(true);
                }}
                className="w-full py-2 rounded-xl bg-purple-900/40 border border-purple-500/40 text-purple-300 hover:text-white hover:bg-purple-800/50 text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Nova Renda Extra
              </button>
            </div>
          </div>
        )}

        {/* MODAL DE SELEÇÃO DE DATA */}
        <DatePickerModal
          isOpen={showDatePickerModal}
          selectedDate={selectedDate}
          onSelectDate={(newDate) => setSelectedDate(newDate)}
          onClose={() => setShowDatePickerModal(false)}
        />
      </div>
    </div>
  );
};
