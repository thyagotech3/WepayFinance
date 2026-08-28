import React, { useState, useEffect } from 'react';
import { FamilyMember, IncomeStream, IncomeNature } from '../types';
import { getMemberIncomeOptions, saveIncomeStreamToStorage, deleteIncomeStreamFromStorage, formatMemberName } from '../utils/incomeUtils';
import { parseCurrencyBR } from '../utils/currencyUtils';
import { 
  X, Plus, Trash2, Edit3, Check, AlertTriangle, Sparkles, 
  Wallet, User, DollarSign, Calendar, CheckCircle2, ChevronRight,
  TrendingUp, Utensils, Briefcase
} from 'lucide-react';

interface IncomeCategoriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: FamilyMember[];
  selectedMemberId?: string;
  onSelectCategory?: (categoryName: string, stream?: IncomeStream) => void;
  onIncomesChanged?: () => void;
  monthKey?: string;
  groupId?: string;
}

const INCOME_EMOJIS = [
  '💼', '💰', '💳', '💻', '📈', '🍔', '🍱', '🚌', 
  '🎁', '🏠', '🛒', '⚡', '🚗', '✈️', '🎓', '💊', 
  '🔑', '🏆', '💎', '💵', '🪙', '📦', '📱', '🛠️'
];

export const IncomeCategoriesManagerModal: React.FC<IncomeCategoriesManagerModalProps> = ({
  isOpen,
  onClose,
  members,
  selectedMemberId,
  onSelectCategory,
  onIncomesChanged,
  monthKey,
  groupId,
}) => {
  const maleMember = members[0] || { id: 'm1', name: 'Membro 1', color: '#3b82f6' };
  const femaleMember = members[1] || members[0] || { id: 'm2', name: 'Membro 2', color: '#ec4899' };

  const [activeMemberId, setActiveMemberId] = useState<string>(
    selectedMemberId || maleMember.id
  );
  const [filterNature, setFilterNature] = useState<'all' | 'fixed' | 'vales' | 'extra'>('all');

  // Deletion mode states
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [streamToDelete, setStreamToDelete] = useState<IncomeStream | null>(null);

  // Creation / Edition modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingStreamId, setEditingStreamId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('💻');
  const [formNature, setFormNature] = useState<IncomeNature>('extra');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('Dia 05');
  const [formIsRecurrent, setFormIsRecurrent] = useState(true);
  const [formError, setFormError] = useState('');

  // Internal trigger to force re-render when storage updates
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    if (selectedMemberId) {
      setActiveMemberId(selectedMemberId);
    }
  }, [selectedMemberId]);

  if (!isOpen) return null;

  // Load all income streams for the active member from localStorage
  const loadMemberStreams = (): IncomeStream[] => {
    try {
      const savedV3 = localStorage.getItem('wepay_couple_incomes_v3');
      if (savedV3) {
        const parsed = JSON.parse(savedV3);
        if (parsed[activeMemberId] && Array.isArray(parsed[activeMemberId])) {
          return parsed[activeMemberId];
        }
      }
    } catch (e) {
      console.error('Error reading income streams:', e);
    }
    return [];
  };

  const currentStreams = loadMemberStreams();

  const filteredStreams = currentStreams.filter((s) => {
    if (filterNature === 'all') return true;
    return s.nature === filterNature;
  });

  const handleOpenCreate = () => {
    setEditingStreamId(null);
    setFormName('');
    setFormIcon('💻');
    setFormNature('extra');
    setFormAmount('');
    setFormDueDate('Dia 05');
    setFormIsRecurrent(true);
    setFormError('');
    setShowFormModal(true);
  };

  const handleOpenEdit = (stream: IncomeStream, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStreamId(stream.id);
    setFormName(stream.name);
    setFormIcon(stream.icon || '💻');
    setFormNature(stream.nature || 'extra');
    setFormAmount(
      stream.amount ? String(stream.amount) : stream.targetGoal ? String(stream.targetGoal) : ''
    );
    setFormDueDate(stream.dueDate || 'Dia 05');
    setFormIsRecurrent(stream.isRecurrent ?? true);
    setFormError('');
    setShowFormModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Digite um nome para a categoria de renda');
      return;
    }

    try {
      const numericAmount = parseCurrencyBR(formAmount);
      const targetMonthKey = monthKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

      saveIncomeStreamToStorage(
        activeMemberId,
        {
          id: editingStreamId || undefined,
          name: formName.trim(),
          icon: formIcon,
          nature: formNature,
          amount: formNature === 'extra' ? 0 : numericAmount,
          targetGoal: formNature === 'extra' ? numericAmount : undefined,
          dueDate: formDueDate,
          isRecurrent: formIsRecurrent,
          isMain: false,
          startDate: targetMonthKey,
          endDate: formIsRecurrent ? undefined : targetMonthKey,
        },
        targetMonthKey,
        groupId,
        formIsRecurrent // Apply to all months only if recurrent
      );

      setUpdateCount((c) => c + 1);
      setShowFormModal(false);
      if (onIncomesChanged) onIncomesChanged();
    } catch (err) {
      console.error('Error saving income category:', err);
    }
  };

  const handleDeleteStream = (stream: IncomeStream) => {
    try {
      const targetMonthKey = monthKey || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      deleteIncomeStreamFromStorage(
        activeMemberId,
        stream.id,
        targetMonthKey,
        'all', // Categorias manager usually deletes from all
        groupId
      );
      setUpdateCount((c) => c + 1);
      if (onIncomesChanged) onIncomesChanged();
    } catch (e) {
      console.error('Error deleting income stream:', e);
    }
    setStreamToDelete(null);
  };

  const getNatureBadge = (nature: IncomeNature) => {
    switch (nature) {
      case 'fixed':
        return (
          <span className="text-[9px] font-extrabold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-1.5 py-0.5 rounded">
            Fixa
          </span>
        );
      case 'vales':
        return (
          <span className="text-[9px] font-extrabold text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
            Vale
          </span>
        );
      case 'extra':
      default:
        return (
          <span className="text-[9px] font-extrabold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.5 rounded">
            Extra
          </span>
        );
    }
  };

  const activeMember = members.find((m) => m.id === activeMemberId) || maleMember;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0b0e1b] border border-slate-800/90 rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-[#0b0e1b] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white">
                  Categorias de Renda
                </h3>
                <p className="text-xs text-slate-400">
                  Gerencie as fontes e categorias de entrada
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Member Selector Tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 p-1 bg-[#070913] border border-slate-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveMemberId(maleMember.id)}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMemberId === maleMember.id
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-300" />
              <span className="truncate">{maleMember.name}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMemberId(femaleMember.id)}
              className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMemberId === femaleMember.id
                  ? 'bg-pink-600 text-white shadow-md ring-1 ring-pink-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5 text-pink-300" />
              <span className="truncate">{femaleMember.name}</span>
            </button>
          </div>

          {/* Nature Filters */}
          <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-0.5 custom-scrollbar">
            {(
              [
                { id: 'all', label: 'Todas' },
                { id: 'extra', label: 'Extras' },
                { id: 'fixed', label: 'Fixas' },
                { id: 'vales', label: 'Vales' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterNature(tab.id)}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  filterNature === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                    : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons: Criar / Excluir */}
        <div className="px-4 py-2.5 bg-[#0e1222] border-b border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleOpenCreate}
            className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-all cursor-pointer active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Criar categoria de renda</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteMode(!isDeleteMode)}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
              isDeleteMode
                ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>{isDeleteMode ? 'Concluir' : 'Excluir categoria'}</span>
          </button>
        </div>

        {/* Scrollable Categories List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {filteredStreams.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-2xl bg-slate-950/40 text-slate-400 space-y-2">
              <span className="text-3xl block">💼</span>
              <p className="text-xs font-semibold">
                Nenhuma categoria de renda cadastrada para {activeMember.name}.
              </p>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="mt-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                + Criar Primeira Categoria
              </button>
            </div>
          ) : (
            filteredStreams.map((stream) => {
              const amountVal = stream.amount || stream.targetGoal || 0;

              return (
                <div
                  key={stream.id}
                  onClick={() => {
                    if (isDeleteMode) {
                      setStreamToDelete(stream);
                    } else if (onSelectCategory) {
                      onSelectCategory(stream.name, stream);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer group ${
                    isDeleteMode
                      ? 'border-red-500/40 hover:bg-red-950/20 bg-[#070913]'
                      : 'bg-[#070913] border-slate-800/90 hover:border-emerald-500/60 hover:bg-emerald-950/15'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/50 flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform">
                      {stream.icon || '💻'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-black text-white truncate max-w-[150px] sm:max-w-[200px]">
                          {stream.name}
                        </span>
                        {getNatureBadge(stream.nature)}
                      </div>

                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                        {amountVal > 0 && (
                          <span className="font-mono font-bold text-slate-200">
                            R$ {amountVal.toFixed(2)}
                          </span>
                        )}
                        {stream.dueDate && (
                          <span className="text-slate-400">• {stream.dueDate}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isDeleteMode ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStreamToDelete(stream);
                        }}
                        className="p-2 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white rounded-xl border border-red-500/40 transition-all cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenEdit(stream, e)}
                        className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-[#080a15] border-t border-slate-800/80 text-center shrink-0">
          <p className="text-[11px] text-slate-400">
            Toque em uma categoria para selecionar ou use os botões para editar.
          </p>
        </div>

        {/* CREATE / EDIT FORM MODAL OVERLAY */}
        {showFormModal && (
          <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <form
              onSubmit={handleSaveForm}
              className="bg-[#0c0f1e] border border-emerald-500/40 rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>
                    {editingStreamId ? 'Editar Categoria de Renda' : 'Nova Categoria de Renda'}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {formError && (
                <div className="p-2 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 text-center font-semibold">
                  {formError}
                </div>
              )}

              {/* Nome */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Freelance de Design, Uber, Consultoria"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none font-bold"
                />
              </div>

              {/* Natureza (Tipo) */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Tipo de Renda
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'extra', label: 'Extra' },
                      { id: 'fixed', label: 'Fixa' },
                      { id: 'vales', label: 'Vale' },
                    ] as const
                  ).map((nat) => (
                    <button
                      key={nat.id}
                      type="button"
                      onClick={() => setFormNature(nat.id)}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        formNature === nat.id
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {nat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor / Meta e Previsão */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    {formNature === 'extra' ? 'Meta Prevista (R$)' : 'Valor (R$)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">
                    Dia Previsto
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Dia 05 ou s/ previsão"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Icon / Emoji Picker */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 block">
                  Ícone / Emoji
                </label>
                <div className="grid grid-cols-8 gap-1 p-2 bg-slate-950 border border-slate-800 rounded-xl max-h-28 overflow-y-auto custom-scrollbar">
                  {INCOME_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormIcon(emoji)}
                      className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all cursor-pointer ${
                        formIcon === emoji
                          ? 'bg-emerald-500/30 border border-emerald-400 scale-110'
                          : 'hover:bg-slate-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recorrente Toggle */}
              <div className="bg-slate-950 border border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[11px] font-bold text-slate-200 block leading-tight">
                    Recorrente?
                  </label>
                  <span className="text-[9.5px] text-slate-400 block leading-tight mt-0.5">
                    Essa renda se repete todos os meses?
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg shrink-0">
                  <button
                    type="button"
                    onClick={() => setFormIsRecurrent(true)}
                    className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      formIsRecurrent
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormIsRecurrent(false)}
                    className={`px-3 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${
                      !formIsRecurrent
                        ? 'bg-slate-800 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Não
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Salvar Categoria</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* CONFIRM DELETE MODAL OVERLAY */}
        {streamToDelete && (
          <div className="fixed inset-0 z-[135] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#0e1222] border border-red-500/40 rounded-3xl p-5 max-w-xs w-full space-y-3 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 mx-auto flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">Excluir Categoria?</h4>
                <p className="text-xs text-slate-300 mt-1">
                  Tem certeza que deseja excluir <strong>"{streamToDelete.name}"</strong>?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStreamToDelete(null)}
                  className="py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStream(streamToDelete)}
                  className="py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-black rounded-xl shadow-md cursor-pointer active:scale-95"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
