import React, { useState, useMemo } from 'react';
import { FamilyMember, IncomeStream, IncomeNature } from '../types';
import { X, Check, Sparkles, Wallet, Calendar, Calculator, Pencil, CalendarRange, CheckCheck } from 'lucide-react';
import { calculateValesWorkDays, formatMemberName } from '../utils/incomeUtils';

interface AddIncomeModalProps {
  currentMember?: FamilyMember;
  members?: FamilyMember[];
  initialStream?: IncomeStream;
  initialNature?: IncomeNature;
  monthKey?: string;
  onClose: () => void;
  onAddIncomeStream: (
    memberId: string,
    stream: Omit<IncomeStream, 'id'> & { id?: string; received?: boolean },
    monthKey?: string,
    applyToAllMonths?: boolean
  ) => void;
}

const WEEK_DAYS = [
  { id: 'mon', label: 'Seg' },
  { id: 'tue', label: 'Ter' },
  { id: 'wed', label: 'Qua' },
  { id: 'thu', label: 'Qui' },
  { id: 'fri', label: 'Sex' },
  { id: 'sat', label: 'Sáb' },
  { id: 'sun', label: 'Dom' },
];

const INCOME_ICONS = [
  '💼', '💰', '💳', '💻', '📈',
  '🍱', '🍔', '🚌', '🎁', '🏠',
  '🛒', '⚡', '🚗', '✈️', '🎓',
  '💊', '🔑', '🏆', '💎', '💵',
];

interface DayPickerPopoverProps {
  value: string;
  onChange: (val: string) => void;
}

const DayPickerPopover: React.FC<DayPickerPopoverProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Extract numeric day if present
  const match = value ? value.match(/\d+/) : null;
  const selectedDayNum = match ? parseInt(match[0], 10) : null;

  const handleSelectDay = (day: number) => {
    const formatted = `Dia ${String(day).padStart(2, '0')}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectNoForecast = () => {
    onChange('s/ previsão');
    setIsOpen(false);
  };

  const isNoForecast =
    !value ||
    value.trim().toLowerCase() === 's/ previsão' ||
    value.trim().toLowerCase() === 'sem previsão';

  const displayLabel = isNoForecast ? 's/ previsão' : value;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white flex items-center justify-between hover:border-slate-700 transition-all cursor-pointer active:scale-[0.99]"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <span
            className={`truncate font-medium ${
              isNoForecast ? 'text-slate-400 font-normal' : 'text-purple-300 font-bold'
            }`}
          >
            {displayLabel}
          </span>
        </div>
        <span className="text-[10px] text-slate-500 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-[85] bg-[#0f1424] border border-slate-700/80 rounded-xl p-2.5 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150">
          {/* Header with "S/ previsão" button at the top */}
          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Selecione o dia
            </span>
            <button
              type="button"
              onClick={handleSelectNoForecast}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer active:scale-95 ${
                isNoForecast
                  ? 'bg-purple-950/90 border-purple-500 text-purple-300 shadow'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
            >
              🚫 S/ previsão
            </button>
          </div>

          {/* 7-column calendar grid for days 1..31 */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
              const isSelected = selectedDayNum === day;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(168,85,247,0.5)] border border-purple-400'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800/80'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const AddIncomeModal: React.FC<AddIncomeModalProps> = ({
  currentMember,
  members,
  initialStream,
  initialNature,
  monthKey,
  onClose,
  onAddIncomeStream,
}) => {
  const targetMember = currentMember || (members && members[0]);
  const targetMemberId = targetMember?.id || 'member-1';
  const [nature, setNature] = useState<IncomeNature>(initialStream?.nature || initialNature || 'fixed');
  const [name, setName] = useState<string>(initialStream?.name || '');
  const [amount, setAmount] = useState<string>(() => {
    if (!initialStream) return '';
    if (initialStream.nature === 'extra' && initialStream.targetGoal) {
      return String(initialStream.targetGoal);
    }
    return initialStream.amount ? String(initialStream.amount) : '';
  });
  const [dueDate, setDueDate] = useState<string>(initialStream?.dueDate || '');
  const [isRecurrent, setIsRecurrent] = useState<boolean>(initialStream?.isRecurrent ?? true);

  // Icon State
  const [selectedIcon, setSelectedIcon] = useState<string>(initialStream?.icon || '💼');
  const [showIconPicker, setShowIconPicker] = useState<boolean>(false);

  // Confirmation Modal State (When editing existing stream)
  const [showConfirmationModal, setShowConfirmationModal] = useState<boolean>(false);

  // Vales specific states
  const [calculationType, setCalculationType] = useState<'manual' | 'auto'>(initialStream?.calculationType || 'auto');
  const [dailyRate, setDailyRate] = useState<string>(initialStream?.dailyRate ? String(initialStream.dailyRate) : '45');
  const [workDays, setWorkDays] = useState<string[]>(initialStream?.workDays || ['mon', 'tue', 'wed', 'thu', 'fri']);
  const [workOnHolidays, setWorkOnHolidays] = useState<boolean>(initialStream?.workOnHolidays ?? false);

  // Current month key (YYYY-MM)
  const now = new Date();
  const activeMonthKey = monthKey || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Formatted Month Name for single-month option, e.g. "Agosto"
  const currentMonthFormatted = useMemo(() => {
    const [yearStr, monthStr] = activeMonthKey.split('-');
    const year = parseInt(yearStr, 10) || now.getFullYear();
    const month = parseInt(monthStr, 10) || (now.getMonth() + 1);
    const d = new Date(year, month - 1, 1);
    const mName = d.toLocaleDateString('pt-BR', { month: 'long' });
    return mName ? mName.charAt(0).toUpperCase() + mName.slice(1) : 'este mês';
  }, [activeMonthKey]);

  // Live calculation preview for auto Vales
  const calculatedValesDays = useMemo(() => {
    return calculateValesWorkDays(activeMonthKey, workDays, workOnHolidays);
  }, [activeMonthKey, workDays, workOnHolidays]);

  const parsedDaily = parseFloat(dailyRate.replace(',', '.')) || 0;
  const calculatedValesTotal = calculatedValesDays * parsedDaily;

  const toggleWorkDay = (dayId: string) => {
    setWorkDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  const handleNatureChange = (newNature: IncomeNature) => {
    setNature(newNature);
    if (newNature === 'fixed') {
      setIsRecurrent(true);
      setSelectedIcon('💼');
    } else if (newNature === 'extra') {
      setIsRecurrent(false);
      setSelectedIcon('💰');
    } else if (newNature === 'vales') {
      setIsRecurrent(true);
      setSelectedIcon('🍱');
    }
  };

  const executeSave = (applyToAllMonths: boolean) => {
    const parsedValue = parseFloat(amount.replace(',', '.')) || 0;

    let formattedDueDate = dueDate.trim();
    if (formattedDueDate && !formattedDueDate.toLowerCase().startsWith('dia') && !formattedDueDate.toLowerCase().includes('s/')) {
      formattedDueDate = `Dia ${formattedDueDate}`;
    }
    if (!formattedDueDate) {
      formattedDueDate = 's/ previsão';
    }

    let finalAmount = parsedValue;
    if (nature === 'extra') {
      finalAmount = initialStream ? (initialStream.amount || 0) : 0;
    } else if (nature === 'vales' && calculationType === 'auto') {
      finalAmount = calculatedValesTotal;
    }

    const isExtraReceived = nature === 'extra'
      ? (initialStream ? ((initialStream.amount || 0) >= parsedValue && (initialStream.amount || 0) > 0) : false)
      : (initialStream?.received ?? false);

    onAddIncomeStream(
      targetMemberId,
      {
        id: initialStream?.id,
        name: name.trim(),
        amount: finalAmount,
        targetGoal: nature === 'extra' && parsedValue > 0 ? parsedValue : undefined,
        nature,
        isRecurrent,
        icon: selectedIcon,
        dueDate: formattedDueDate,
        received: isExtraReceived,
        calculationType: nature === 'vales' ? calculationType : undefined,
        dailyRate: nature === 'vales' && calculationType === 'auto' ? parsedDaily : undefined,
        workDays: nature === 'vales' && calculationType === 'auto' ? workDays : undefined,
        workOnHolidays: nature === 'vales' && calculationType === 'auto' ? workOnHolidays : undefined,
      },
      activeMonthKey,
      applyToAllMonths
    );

    setShowConfirmationModal(false);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    if (initialStream) {
      // Editing existing stream -> Show confirmation modal
      setShowConfirmationModal(true);
    } else {
      // Creating new stream -> Save directly
      executeSave(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-3 overflow-y-auto">
      <div className="bg-[#0e1220] border border-slate-800 rounded-t-2xl sm:rounded-2xl max-w-md w-full p-3.5 sm:p-4 shadow-2xl space-y-2.5 my-auto max-h-[96vh] flex flex-col justify-between">
        {/* Mobile Bottom Sheet Indicator */}
        <div className="w-10 h-1 bg-slate-700/80 rounded-full mx-auto -mt-1 sm:hidden" />

        <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
          {/* Header - Reformulated with Icon Button + Subtitle + Bold Name Input */}
          <div className="flex items-start justify-between pb-2 border-b border-slate-800/80 gap-2 relative">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Icon Selector Button with Pencil Badge */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowIconPicker(!showIconPicker)}
                  className="relative w-9 h-9 bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center justify-center text-lg transition-all cursor-pointer hover:bg-purple-500/30 active:scale-95 shadow"
                  title="Escolher ícone da renda"
                >
                  <span>{selectedIcon}</span>
                  <div className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-0.5 border border-slate-900 shadow">
                    <Pencil className="w-2.5 h-2.5" />
                  </div>
                </button>

                {/* Icon Picker Popover */}
                {showIconPicker && (
                  <div className="absolute top-11 left-0 z-[80] bg-slate-900 border border-slate-700 rounded-xl p-2 shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Escolha um ícone (20 opções)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowIconPicker(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-0.5">
                      {INCOME_ICONS.map((ico) => (
                        <button
                          key={ico}
                          type="button"
                          onClick={() => {
                            setSelectedIcon(ico);
                            setShowIconPicker(false);
                          }}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all hover:bg-slate-800 active:scale-95 border cursor-pointer ${
                            selectedIcon === ico
                              ? 'bg-purple-600/30 border-purple-500 ring-1 ring-purple-500'
                              : 'border-transparent hover:border-slate-700'
                          }`}
                        >
                          {ico}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitle & Bold Input */}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider block leading-none mb-1">
                  {initialStream ? 'Editar Renda' : 'Nova Renda'} ({formatMemberName(currentMember.name)})
                </span>
                <input
                  type="text"
                  required
                  placeholder={
                    nature === 'fixed'
                      ? 'Ex: Salário, Aluguel, Pensão'
                      : nature === 'extra'
                      ? 'Ex: Projeto Freelance, Comissões'
                      : 'Ex: VR Alimentação, VT Transporte, VA'
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800/90 rounded-lg px-2 py-1 text-xs font-extrabold text-white placeholder:font-normal placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <button
              onClick={onClose}
              type="button"
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 active:bg-slate-800 transition-colors cursor-pointer shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* 1. Tipo de Renda (3 opções) */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
              Tipo de Renda
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleNatureChange('fixed')}
                className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer active:scale-95 ${
                  nature === 'fixed'
                    ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40 shadow'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🟢</span>
                <span>Fixa</span>
              </button>

              <button
                type="button"
                onClick={() => handleNatureChange('extra')}
                className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer active:scale-95 ${
                  nature === 'extra'
                    ? 'bg-purple-950/90 border-purple-500 text-purple-300 ring-1 ring-purple-500/40 shadow'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🟣</span>
                <span>Extra</span>
              </button>

              <button
                type="button"
                onClick={() => handleNatureChange('vales')}
                className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 border cursor-pointer active:scale-95 ${
                  nature === 'vales'
                    ? 'bg-amber-950/90 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 shadow'
                    : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>🍱</span>
                <span>Vales</span>
              </button>
            </div>
          </div>

          {/* 2. Mini Card Explicativo */}
          <div
            className={`p-2 rounded-xl border text-[11px] leading-snug flex items-center gap-2 ${
              nature === 'fixed'
                ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                : nature === 'extra'
                ? 'bg-purple-950/30 border-purple-500/30 text-purple-200'
                : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-80" />
            <p className="min-w-0 flex-1 font-medium text-[10.5px]">
              {nature === 'fixed' &&
                'Renda com valor fixo garantido mensalmente (Salários, Aluguéis, Pensões).'}
              {nature === 'extra' &&
                'Renda por serviços ou comissões. Acumula ao longo do mês com novos registros.'}
              {nature === 'vales' &&
                'Benefícios pagos por dia trabalhado (VA, VR, VT). Manual ou Cálculo Automático.'}
            </p>
          </div>

          {/* VALES SPECIFIC MODE SELECTION */}
          {nature === 'vales' && (
            <div className="space-y-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800">
              <label className="block text-[10.5px] font-bold text-amber-400 uppercase tracking-wider">
                Como deseja definir o valor?
              </label>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setCalculationType('auto')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                    calculationType === 'auto'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Calcular auto</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCalculationType('manual')}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                    calculationType === 'manual'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <span>Informar manual</span>
                </button>
              </div>

              {/* AUTO MODE INPUTS */}
              {calculationType === 'auto' && (
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                        Valor por dia (R$)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        required
                        value={dailyRate}
                        onChange={(e) => setDailyRate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-300 mb-0.5">
                        Trabalha feriados?
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 border border-slate-800 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setWorkOnHolidays(true)}
                          className={`py-1 rounded text-[10px] font-bold ${
                            workOnHolidays ? 'bg-amber-500 text-black' : 'text-slate-400'
                          }`}
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setWorkOnHolidays(false)}
                          className={`py-1 rounded text-[10px] font-bold ${
                            !workOnHolidays ? 'bg-slate-800 text-white' : 'text-slate-400'
                          }`}
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-300 mb-1">
                      Dias da semana trabalhados
                    </label>
                    <div className="flex items-center justify-between gap-1">
                      {WEEK_DAYS.map((day) => {
                        const active = workDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleWorkDay(day.id)}
                            className={`flex-1 py-1 rounded text-[10px] font-extrabold border transition-all cursor-pointer ${
                              active
                                ? 'bg-amber-500/30 border-amber-500 text-amber-200'
                                : 'bg-slate-900 border-slate-800 text-slate-500'
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Auto Calculation Preview */}
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2 text-[11px] text-amber-200 flex items-center justify-between font-mono">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        {calculatedValesDays} dias x R$ {parsedDaily.toFixed(2)}
                      </span>
                    </div>
                    <span className="font-extrabold text-amber-300">
                      R$ {calculatedValesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                      Previsão <span className="text-[9.5px] text-slate-500 font-normal">(opcional)</span>
                    </label>
                    <DayPickerPopover value={dueDate} onChange={setDueDate} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Valor & Previsão lado a lado */}
          {(nature === 'fixed' || (nature === 'vales' && calculationType === 'manual')) && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                  Previsão <span className="text-[9.5px] text-slate-500 font-normal">(opcional)</span>
                </label>
                <DayPickerPopover value={dueDate} onChange={setDueDate} />
              </div>
            </div>
          )}

          {nature === 'extra' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                  Meta mensal (R$) <span className="text-[9.5px] text-slate-500 font-normal">(opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-0.5">
                  Previsão <span className="text-[9.5px] text-slate-500 font-normal">(opcional)</span>
                </label>
                <DayPickerPopover value={dueDate} onChange={setDueDate} />
              </div>
            </div>
          )}

          {/* 5. Recorrente Box (Com texto exato solicitado) */}
          <div className="bg-slate-950 border border-slate-800/80 p-2 rounded-xl flex items-center justify-between gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-200 block leading-tight">
                Recorrente?
              </label>
              <span className="text-[9.5px] text-slate-400 block leading-tight mt-0.5">
                Repetir essa renda todos os próximos meses?
              </span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setIsRecurrent(true)}
                className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                  isRecurrent
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sim
              </button>
              <button
                type="button"
                onClick={() => setIsRecurrent(false)}
                className={`px-2.5 py-1 rounded text-[10.5px] font-bold transition-all cursor-pointer ${
                  !isRecurrent
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Não
              </button>
            </div>
          </div>

          {/* Buttons Footer */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1 cursor-pointer active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{initialStream ? 'Salvar mudança' : 'Salvar Fonte'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Confirmation Modal when editing stream for all months vs this month */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-[95] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0b0f1d] border border-slate-800/90 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
            {/* Header Icon */}
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800/80 flex items-center justify-center mx-auto text-purple-400 shadow-lg shadow-purple-950/50">
              <CalendarRange className="w-6 h-6 text-purple-400" />
            </div>

            {/* Title & Question */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white leading-snug px-1">
                Você deseja fazer essa mudança para todos os próximos meses?
              </h3>
              <p className="text-xs text-slate-400 font-medium leading-relaxed">
                Escolha o escopo de aplicação da alteração da renda <span className="text-purple-300 font-bold">"{name || initialStream?.name}"</span>.
              </p>
            </div>

            {/* Action Buttons Stack */}
            <div className="space-y-2.5 pt-1">
              {/* Option 1: Sim, alterar todos os próximos meses */}
              <button
                type="button"
                onClick={() => executeSave(true)}
                className="w-full py-3 px-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-lg shadow-purple-950/60 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <CheckCheck className="w-4 h-4 shrink-0 text-purple-200" />
                <span className="truncate">Sim, alterar todos os próximos meses</span>
              </button>

              {/* Option 2: Não, alterar apenas esse mês (Mês) */}
              <button
                type="button"
                onClick={() => executeSave(false)}
                className="w-full py-3 px-3.5 bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 text-slate-200 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Calendar className="w-4 h-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  Não, alterar apenas esse mês ({currentMonthFormatted})
                </span>
              </button>

              {/* Option 3: Cancelar alteração */}
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar alteração
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
