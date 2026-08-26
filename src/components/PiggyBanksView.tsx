import React, { useState, useEffect } from 'react';
import { FamilyMember, PiggyBankItem, Transaction } from '../types';
import { INITIAL_PIGGY_BANKS } from '../data/mockInitialData';
import {
  ChevronLeft,
  X,
  PiggyBank,
  Plus,
  Plane,
  Home as HomeIcon,
  GraduationCap,
  Shield,
  Car,
  Heart,
  Palmtree,
  Gift,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
} from 'lucide-react';

interface PiggyBanksViewProps {
  members: FamilyMember[];
  currentMember: FamilyMember;
  cofrinhos?: PiggyBankItem[];
  onUpdateCofrinhos?: (cofrinhos: PiggyBankItem[]) => void;
  onBack: () => void;
  onClose?: () => void;
  onAddTransaction?: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
}

export const PiggyBanksView: React.FC<PiggyBanksViewProps> = ({
  members,
  currentMember,
  cofrinhos: propCofrinhos,
  onUpdateCofrinhos,
  onBack,
  onClose,
  onAddTransaction,
}) => {
  // Load initial cofrinhos from props or localStorage
  const [localCofrinhos, setLocalCofrinhos] = useState<PiggyBankItem[]>(() => {
    if (propCofrinhos) return propCofrinhos;
    const saved = localStorage.getItem('wepay_cofrinhos');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing cofrinhos:', e);
      }
    }
    return [];
  });

  const cofrinhos = propCofrinhos || localCofrinhos;

  const updateCofrinhosList = (newItems: PiggyBankItem[]) => {
    setLocalCofrinhos(newItems);
    localStorage.setItem('wepay_cofrinhos', JSON.stringify(newItems));
    if (onUpdateCofrinhos) {
      onUpdateCofrinhos(newItems);
    }
  };

  const setCofrinhos = (action: React.SetStateAction<PiggyBankItem[]>) => {
    const updated = typeof action === 'function' ? action(cofrinhos) : action;
    updateCofrinhosList(updated);
  };

  // Selected item for Management Modal
  const [selectedCofrinho, setSelectedCofrinho] = useState<PiggyBankItem | null>(null);

  // Sub-modal modes inside management or global modals
  const [modalMode, setModalMode] = useState<'manage' | 'deposit' | 'withdraw' | 'edit' | 'create'>('manage');

  // Input states for deposit/withdraw
  const [actionAmount, setActionAmount] = useState<string>('');
  const [actionMemberId, setActionMemberId] = useState<string>(currentMember.id);
  const [recordTransaction, setRecordTransaction] = useState<boolean>(true);

  // Input states for create/edit
  const [formTitle, setFormTitle] = useState<string>('');
  const [formTargetAmount, setFormTargetAmount] = useState<string>('');
  const [formCurrentAmount, setFormCurrentAmount] = useState<string>('');
  const [formIcon, setFormIcon] = useState<string>('PiggyBank');
  const [formColorTheme, setFormColorTheme] = useState<PiggyBankItem['colorTheme']>('purple');
  const [formNotes, setFormNotes] = useState<string>('');

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Helper calculation totals
  const totalSaved = cofrinhos.reduce((acc, item) => acc + item.currentAmount, 0);
  const totalTarget = cofrinhos.reduce((acc, item) => acc + item.targetAmount, 0);
  const globalProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;

  // Icon mapping helper
  const renderIcon = (iconName: string, className = 'w-4 h-4') => {
    switch (iconName) {
      case 'Plane': return <Plane className={className} />;
      case 'Home': return <HomeIcon className={className} />;
      case 'GraduationCap': return <GraduationCap className={className} />;
      case 'Shield': return <Shield className={className} />;
      case 'Car': return <Car className={className} />;
      case 'Heart': return <Heart className={className} />;
      case 'Palmtree': return <Palmtree className={className} />;
      case 'Gift': return <Gift className={className} />;
      default: return <PiggyBank className={className} />;
    }
  };

  // Theme styling mapping helper
  const getThemeStyles = (theme: PiggyBankItem['colorTheme']) => {
    switch (theme) {
      case 'purple':
        return {
          bgBox: 'bg-[#1d1238] border-purple-500/30 text-purple-400',
          badge: 'bg-purple-950/90 text-purple-300 border-purple-800/60',
          barGradient: 'from-purple-600 via-purple-500 to-pink-500',
          textTitle: 'text-purple-400',
        };
      case 'blue':
        return {
          bgBox: 'bg-[#0d2140] border-blue-500/30 text-blue-400',
          badge: 'bg-blue-950/90 text-blue-300 border-blue-800/60',
          barGradient: 'from-blue-600 to-sky-400',
          textTitle: 'text-blue-400',
        };
      case 'emerald':
        return {
          bgBox: 'bg-[#0c2a20] border-emerald-500/30 text-emerald-400',
          badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-800/60',
          barGradient: 'from-emerald-600 via-emerald-500 to-green-400',
          textTitle: 'text-emerald-400',
        };
      case 'amber':
        return {
          bgBox: 'bg-[#2b1f0d] border-amber-500/30 text-amber-400',
          badge: 'bg-amber-950/90 text-amber-300 border-amber-800/60',
          barGradient: 'from-amber-600 via-amber-500 to-yellow-400',
          textTitle: 'text-amber-400',
        };
      case 'rose':
        return {
          bgBox: 'bg-[#2e0f1d] border-rose-500/30 text-rose-400',
          badge: 'bg-rose-950/90 text-rose-300 border-rose-800/60',
          barGradient: 'from-rose-600 via-pink-600 to-rose-400',
          textTitle: 'text-rose-400',
        };
      default:
        return {
          bgBox: 'bg-[#181238] border-indigo-500/30 text-indigo-400',
          badge: 'bg-indigo-950/90 text-indigo-300 border-indigo-800/60',
          barGradient: 'from-indigo-600 to-purple-500',
          textTitle: 'text-indigo-400',
        };
    }
  };

  // Open Cofrinho Manage Modal
  const handleSelectCofrinho = (item: PiggyBankItem) => {
    setSelectedCofrinho(item);
    setModalMode('manage');
    setActionAmount('');
    setActionMemberId(currentMember.id);
    setRecordTransaction(true);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setSelectedCofrinho(null);
    setFormTitle('');
    setFormTargetAmount('');
    setFormCurrentAmount('');
    setFormIcon('PiggyBank');
    setFormColorTheme('purple');
    setFormNotes('');
    setModalMode('create');
  };

  // Open Edit inside modal
  const handleStartEdit = () => {
    if (!selectedCofrinho) return;
    setFormTitle(selectedCofrinho.title);
    setFormTargetAmount(selectedCofrinho.targetAmount.toString());
    setFormCurrentAmount(selectedCofrinho.currentAmount.toString());
    setFormIcon(selectedCofrinho.icon);
    setFormColorTheme(selectedCofrinho.colorTheme);
    setFormNotes(selectedCofrinho.notes || '');
    setModalMode('edit');
  };

  // Save Create or Edit
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const targetVal = parseFloat(formTargetAmount.replace(',', '.')) || 0;
    const currentVal = parseFloat(formCurrentAmount.replace(',', '.')) || 0;

    if (modalMode === 'edit' && selectedCofrinho) {
      const updated: PiggyBankItem = {
        ...selectedCofrinho,
        title: formTitle.trim(),
        targetAmount: targetVal,
        currentAmount: currentVal,
        icon: formIcon,
        colorTheme: formColorTheme,
        notes: formNotes.trim(),
      };
      setCofrinhos((prev) => prev.map((item) => (item.id === selectedCofrinho.id ? updated : item)));
      setSelectedCofrinho(updated);
      setModalMode('manage');
      showToast(`Cofrinho "${formTitle}" atualizado!`);
    } else if (modalMode === 'create') {
      const newItem: PiggyBankItem = {
        id: `piggy-${Date.now()}`,
        title: formTitle.trim(),
        targetAmount: targetVal,
        currentAmount: currentVal,
        icon: formIcon,
        colorTheme: formColorTheme,
        notes: formNotes.trim(),
      };
      setCofrinhos((prev) => [...prev, newItem]);
      setSelectedCofrinho(newItem);
      setModalMode('manage');
      showToast(`Cofrinho "${formTitle}" criado com sucesso!`);
    }
  };

  // Confirm Deposit or Withdraw
  const handleConfirmAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCofrinho) return;

    const val = parseFloat(actionAmount.replace(',', '.')) || 0;
    if (val <= 0) return;

    if (modalMode === 'deposit') {
      const updatedAmount = selectedCofrinho.currentAmount + val;
      const updatedItem = { ...selectedCofrinho, currentAmount: updatedAmount };

      setCofrinhos((prev) =>
        prev.map((item) => (item.id === selectedCofrinho.id ? updatedItem : item))
      );
      setSelectedCofrinho(updatedItem);

      if (recordTransaction && onAddTransaction) {
        onAddTransaction({
          description: `Aporte Cofrinho: ${selectedCofrinho.title}`,
          amount: val,
          category: 'Outros',
          categoryIcon: 'PiggyBank',
          type: 'expense',
          paidByMemberId: actionMemberId,
          splitType: 'individual',
          notes: `Investimento / Reserva no cofrinho ${selectedCofrinho.title}`,
        });
      }

      showToast(`R$ ${val.toFixed(2)} guardados em "${selectedCofrinho.title}"!`);
      setModalMode('manage');
    } else if (modalMode === 'withdraw') {
      const updatedAmount = Math.max(0, selectedCofrinho.currentAmount - val);
      const updatedItem = { ...selectedCofrinho, currentAmount: updatedAmount };

      setCofrinhos((prev) =>
        prev.map((item) => (item.id === selectedCofrinho.id ? updatedItem : item))
      );
      setSelectedCofrinho(updatedItem);

      showToast(`R$ ${val.toFixed(2)} resgatados de "${selectedCofrinho.title}".`);
      setModalMode('manage');
    }
  };

  // Delete Item
  const handleDeleteCofrinho = () => {
    if (!selectedCofrinho) return;
    if (window.confirm(`Tem certeza que deseja excluir o cofrinho "${selectedCofrinho.title}"?`)) {
      setCofrinhos((prev) => prev.filter((item) => item.id !== selectedCofrinho.id));
      showToast(`Cofrinho "${selectedCofrinho.title}" removido.`);
      setSelectedCofrinho(null);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-4 max-w-4xl mx-auto pb-8">
      {/* Toast notification */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-emerald-400/40 backdrop-blur-md animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="flex items-center justify-between gap-2 bg-[#080a17] border border-[#1b1a38] rounded-2xl p-2 sm:p-3 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 sm:p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1 shrink-0 cursor-pointer"
            title="Voltar para a tela anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Voltar</span>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <PiggyBank className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div>
              <h1 className="text-xs sm:text-base font-black text-white tracking-tight uppercase leading-tight">
                Cofrinhos & Metas
              </h1>
              <p className="text-[9px] sm:text-xs text-slate-400 leading-tight">
                Clique em qualquer cofrinho para gerenciar
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose || onBack}
          className="p-1.5 sm:px-3 sm:py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-all shadow flex items-center gap-1.5 shrink-0 cursor-pointer"
          title="Fechar e ir para a Página Inicial"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 hover:text-white" />
          <span className="hidden sm:inline">Fechar</span>
        </button>
      </div>

      {/* GLOBAL SUMMARY CARD */}
      <div className="bg-gradient-to-br from-[#0e1220] via-[#090b18] to-[#160c2b] border border-purple-500/30 rounded-2xl p-2.5 sm:p-4 shadow-2xl relative overflow-hidden space-y-2 sm:space-y-3">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[9px] sm:text-[10px] font-extrabold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20 uppercase tracking-wider">
                Patrimônio em Reservas
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-slate-300">
                {cofrinhos.length} {cofrinhos.length === 1 ? 'meta ativa' : 'metas ativas'}
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-2xl font-black text-white font-mono">
                R$ {totalSaved.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-400 font-mono">
                de R$ {totalTarget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="space-y-1 relative z-10 pt-0.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-400 text-[10px] sm:text-[11px]">Progresso Geral das Metas</span>
            <span className="text-purple-300 font-mono font-extrabold bg-purple-950/80 border border-purple-500/30 px-1.5 py-0.2 rounded-md text-[10px] sm:text-xs">
              {globalProgress}% concluído
            </span>
          </div>
          <div className="w-full bg-slate-950/80 border border-slate-800 rounded-full h-2.5 p-0.5 relative overflow-hidden flex items-center">
            <div
              className="bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400 rounded-full h-full shadow-md transition-all duration-700"
              style={{ width: `${globalProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* COFRINHOS LIST & GRID (Responsive on mobile and desktop) */}
      <div className="bg-[#0e1220] border border-[#1b1a38] rounded-2xl p-3 sm:p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <PiggyBank className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-none">
              Todos os Cofrinhos ({cofrinhos.length})
            </h3>
          </div>
          <span className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Clique para gerenciar e guardar
          </span>
        </div>

        {cofrinhos.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-300">Nenhum cofrinho criado ainda.</p>
            <p className="text-[11px] text-slate-500">Clique no botão abaixo para criar seu primeiro cofrinho!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {cofrinhos.map((item) => {
              const theme = getThemeStyles(item.colorTheme);
              const pct =
                item.targetAmount > 0
                  ? Math.min(100, Math.round((item.currentAmount / item.targetAmount) * 100))
                  : 0;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelectCofrinho(item)}
                  className="flex flex-col justify-between p-3.5 rounded-2xl bg-[#0a0c1a] hover:bg-[#12152d] border border-slate-800/80 hover:border-purple-500/40 transition-all cursor-pointer group space-y-3 shadow-md"
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform ${theme.bgBox}`}
                      >
                        {renderIcon(item.icon, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs sm:text-sm font-bold ${theme.textTitle} truncate block`}>
                          {item.title}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate block">
                          Meta: R$ {item.targetAmount.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-black shrink-0 shadow-xs ${theme.badge}`}
                    >
                      {pct}%
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-[10px] uppercase font-bold text-slate-500">Saldo Atual</span>
                      <span className="font-mono font-extrabold text-white">
                        R$ {item.currentAmount.toLocaleString('pt-BR')}
                      </span>
                    </div>

                    <div className="w-full bg-[#121426] border border-slate-800/80 rounded-full h-2 p-0.5 relative flex items-center overflow-hidden">
                      <div
                        className={`bg-gradient-to-r ${theme.barGradient} rounded-full h-full shadow-xs transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Centered Add Cofrinho Button at bottom of list */}
        <div className="pt-3 border-t border-slate-800/60 flex justify-center">
          <button
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-900/90 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 rounded-xl text-xs font-bold text-slate-300 hover:text-purple-300 transition-all flex items-center justify-center gap-2 cursor-pointer group shadow-sm"
          >
            <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center text-purple-400">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <span>Novo Cofrinho</span>
          </button>
        </div>
      </div>

      {/* ================= UNIFIED COFRINHO MANAGEMENT MODAL ================= */}
      {(selectedCofrinho || modalMode === 'create') && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0e1220] border border-slate-800 rounded-2xl p-4 sm:p-5 max-w-md w-full shadow-2xl space-y-4 animate-scale-up max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {modalMode === 'create' ? (
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                ) : (
                  selectedCofrinho && (
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                        getThemeStyles(selectedCofrinho.colorTheme).bgBox
                      }`}
                    >
                      {renderIcon(selectedCofrinho.icon, 'w-4 h-4')}
                    </div>
                  )
                )}

                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {modalMode === 'create'
                      ? 'Novo Cofrinho'
                      : modalMode === 'edit'
                      ? 'Editar Cofrinho'
                      : modalMode === 'deposit'
                      ? 'Guardar Dinheiro'
                      : modalMode === 'withdraw'
                      ? 'Resgatar Valor'
                      : selectedCofrinho?.title}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    {modalMode === 'manage'
                      ? 'Gerenciar reserva e depósitos'
                      : 'Ajuste as informações da meta'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (modalMode !== 'manage' && selectedCofrinho) {
                    setModalMode('manage');
                  } else {
                    setSelectedCofrinho(null);
                    setModalMode('manage');
                  }
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* MODE: MANAGE (Main details & quick action buttons) */}
            {modalMode === 'manage' && selectedCofrinho && (
              <div className="space-y-4">
                {/* Progress Overview Card */}
                <div className="bg-[#080a17] border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">Guardado</span>
                    <span className="font-extrabold text-white text-sm">
                      R${' '}
                      {selectedCofrinho.currentAmount.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 text-[11px]">Meta Final</span>
                    <span className="font-bold text-slate-300">
                      R${' '}
                      {selectedCofrinho.targetAmount.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#121426] border border-slate-800 rounded-full h-2.5 p-0.5 relative flex items-center overflow-hidden">
                    <div
                      className={`bg-gradient-to-r ${
                        getThemeStyles(selectedCofrinho.colorTheme).barGradient
                      } rounded-full h-full shadow-xs transition-all duration-500`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (selectedCofrinho.currentAmount / selectedCofrinho.targetAmount) * 100
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>
                      {selectedCofrinho.targetAmount - selectedCofrinho.currentAmount > 0
                        ? `Faltam R$ ${(
                            selectedCofrinho.targetAmount - selectedCofrinho.currentAmount
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '🎉 Meta Concluída!'}
                    </span>
                    <span className="font-mono font-bold text-purple-300">
                      {Math.min(
                        100,
                        Math.round(
                          (selectedCofrinho.currentAmount / selectedCofrinho.targetAmount) * 100
                        )
                      )}
                      % atingido
                    </span>
                  </div>

                  {selectedCofrinho.notes && (
                    <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-300 bg-slate-950/50 p-2 rounded-lg">
                      <span className="text-slate-500 font-bold block text-[10px]">Nota:</span>
                      {selectedCofrinho.notes}
                    </div>
                  )}
                </div>

                {/* Primary Action Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActionAmount('');
                      setModalMode('deposit');
                    }}
                    className="py-2 px-3 bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 hover:border-emerald-500 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                    <span>+ Guardar</span>
                  </button>

                  <button
                    onClick={() => {
                      setActionAmount('');
                      setModalMode('withdraw');
                    }}
                    className="py-2 px-3 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <ArrowUpRight className="w-4 h-4 text-rose-400" />
                    <span>- Resgatar</span>
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={handleStartEdit}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-purple-400" />
                    <span>Editar Meta</span>
                  </button>

                  <button
                    onClick={handleDeleteCofrinho}
                    className="px-3 py-1.5 bg-rose-950/30 hover:bg-rose-950/80 text-rose-300 border border-rose-900/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            )}

            {/* MODE: DEPOSIT / WITHDRAW FORM */}
            {(modalMode === 'deposit' || modalMode === 'withdraw') && selectedCofrinho && (
              <form onSubmit={handleConfirmAction} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={actionAmount}
                    onChange={(e) => setActionAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-white font-mono text-base focus:outline-none"
                    autoFocus
                  />
                </div>

                {modalMode === 'deposit' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      Membro Responsável
                    </label>
                    <select
                      value={actionMemberId}
                      onChange={(e) => setActionMemberId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modalMode === 'deposit' && onAddTransaction && (
                  <label className="flex items-center gap-2 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recordTransaction}
                      onChange={(e) => setRecordTransaction(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-[11px] font-medium text-slate-300">
                      Registrar como saída/investimento no histórico de lançamentos
                    </span>
                  </label>
                )}

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalMode('manage')}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    className={`px-4 py-2 font-bold text-xs text-white rounded-xl shadow-lg transition-all cursor-pointer ${
                      modalMode === 'deposit'
                        ? 'bg-emerald-600 hover:bg-emerald-500'
                        : 'bg-purple-600 hover:bg-purple-500'
                    }`}
                  >
                    {modalMode === 'deposit' ? 'Confirmar Aporte' : 'Confirmar Resgate'}
                  </button>
                </div>
              </form>
            )}

            {/* MODE: CREATE OR EDIT FORM */}
            {(modalMode === 'create' || modalMode === 'edit') && (
              <form onSubmit={handleSaveForm} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Nome da Meta / Cofrinho
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Viagem, Casa Própria, Carro Novo"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      Valor da Meta (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={formTargetAmount}
                      onChange={(e) => setFormTargetAmount(e.target.value)}
                      placeholder="5000.00"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 block">
                      Valor Já Guardado (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formCurrentAmount}
                      onChange={(e) => setFormCurrentAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Icon Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Escolha o Ícone
                  </label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { name: 'PiggyBank', icon: <PiggyBank className="w-4 h-4" /> },
                      { name: 'Plane', icon: <Plane className="w-4 h-4" /> },
                      { name: 'Home', icon: <HomeIcon className="w-4 h-4" /> },
                      { name: 'GraduationCap', icon: <GraduationCap className="w-4 h-4" /> },
                      { name: 'Shield', icon: <Shield className="w-4 h-4" /> },
                      { name: 'Car', icon: <Car className="w-4 h-4" /> },
                      { name: 'Heart', icon: <Heart className="w-4 h-4" /> },
                      { name: 'Palmtree', icon: <Palmtree className="w-4 h-4" /> },
                      { name: 'Gift', icon: <Gift className="w-4 h-4" /> },
                    ].map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => setFormIcon(item.name)}
                        className={`p-2 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                          formIcon === item.name
                            ? 'bg-purple-600/30 border-purple-500 text-purple-300 shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Theme Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Cor do Tema
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { key: 'purple', bg: 'bg-purple-500' },
                      { key: 'blue', bg: 'bg-blue-500' },
                      { key: 'emerald', bg: 'bg-emerald-500' },
                      { key: 'amber', bg: 'bg-amber-500' },
                      { key: 'rose', bg: 'bg-rose-500' },
                      { key: 'indigo', bg: 'bg-indigo-500' },
                    ].map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setFormColorTheme(t.key as PiggyBankItem['colorTheme'])}
                        className={`h-7 rounded-xl transition-all cursor-pointer ${t.bg} ${
                          formColorTheme === t.key
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-105'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Observações (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Ex: Meta para o final do ano"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (modalMode === 'edit' && selectedCofrinho) {
                        setModalMode('manage');
                      } else {
                        setSelectedCofrinho(null);
                        setModalMode('manage');
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs rounded-xl border border-slate-800 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
                  >
                    Salvar Cofrinho
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
