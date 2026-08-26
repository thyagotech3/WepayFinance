import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check, Clock
} from 'lucide-react';

interface DatePickerModalProps {
  isOpen: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onClose: () => void;
  title?: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  isOpen,
  selectedDate,
  onSelectDate,
  onClose,
  title = 'Selecionar Data',
}) => {
  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate || new Date()));
  const [tempSelectedDate, setTempSelectedDate] = useState<Date>(() => new Date(selectedDate || new Date()));

  useEffect(() => {
    if (isOpen) {
      const validDate = selectedDate instanceof Date && !isNaN(selectedDate.getTime()) 
        ? new Date(selectedDate) 
        : new Date();
      setViewDate(validDate);
      setTempSelectedDate(validDate);
    }
  }, [isOpen, selectedDate]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleQuickSelect = (daysOffset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    d.setHours(12, 0, 0, 0);
    setTempSelectedDate(d);
    setViewDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const handleSelectDay = (day: number) => {
    const newDate = new Date(currentYear, currentMonth, day, 12, 0, 0, 0);
    setTempSelectedDate(newDate);
  };

  const handleConfirm = () => {
    onSelectDate(tempSelectedDate);
    onClose();
  };

  // Calendar matrix calculations
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 to 6
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevMonthTotalDays = new Date(currentYear, currentMonth, 0).getDate();

    const days: Array<{
      day: number;
      monthType: 'prev' | 'current' | 'next';
      dateObj: Date;
    }> = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthTotalDays - i;
      const prevDate = new Date(currentYear, currentMonth - 1, dayNum, 12, 0, 0);
      days.push({ day: dayNum, monthType: 'prev', dateObj: prevDate });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const currDate = new Date(currentYear, currentMonth, d, 12, 0, 0);
      days.push({ day: d, monthType: 'current', dateObj: currDate });
    }

    // Next month filler days (fill up to 35 or 42 cells)
    const remainingCells = (7 - (days.length % 7)) % 7;
    for (let n = 1; n <= remainingCells; n++) {
      const nextDate = new Date(currentYear, currentMonth + 1, n, 12, 0, 0);
      days.push({ day: n, monthType: 'next', dateObj: nextDate });
    }

    return days;
  }, [currentYear, currentMonth]);

  if (!isOpen) return null;

  const today = new Date();
  const isToday = (d: Date) => {
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (d: Date) => {
    return (
      d.getDate() === tempSelectedDate.getDate() &&
      d.getMonth() === tempSelectedDate.getMonth() &&
      d.getFullYear() === tempSelectedDate.getFullYear()
    );
  };

  // Formatted preview of tempSelectedDate
  const formattedSelectedLong = tempSelectedDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-[#0e1224] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 w-full max-w-sm shadow-2xl space-y-3.5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider leading-tight">
                {title}
              </h3>
              <p className="text-[10px] text-slate-400 capitalize truncate max-w-[200px]">
                {formattedSelectedLong}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Shortcut Buttons (Hoje, Ontem, Anteontem) */}
        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80 text-center">
          <button
            type="button"
            onClick={() => handleQuickSelect(0)}
            className={`py-1.5 px-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              isToday(tempSelectedDate)
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect(-1)}
            className={`py-1.5 px-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              (() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                return isSelected(y);
              })()
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Ontem
          </button>
          <button
            type="button"
            onClick={() => handleQuickSelect(-2)}
            className={`py-1.5 px-2 rounded-lg text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
              (() => {
                const y = new Date();
                y.setDate(y.getDate() - 2);
                return isSelected(y);
              })()
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            Anteontem
          </button>
        </div>

        {/* Month Navigation Row */}
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all cursor-pointer"
            title="Mês anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-center">
            <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider block">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-purple-950/60 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-all cursor-pointer"
            title="Próximo mês"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-1">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEK_DAYS.map((wd, i) => (
              <span
                key={wd}
                className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${
                  i === 0 || i === 6 ? 'text-pink-400/80' : 'text-slate-500'
                }`}
              >
                {wd}
              </span>
            ))}
          </div>

          {/* Days Numbers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarDays.map(({ day, monthType, dateObj }, idx) => {
              const active = isSelected(dateObj);
              const todayMark = isToday(dateObj);
              const isCurrentMonth = monthType === 'current';

              return (
                <button
                  key={`${monthType}-${day}-${idx}`}
                  type="button"
                  onClick={() => {
                    setTempSelectedDate(dateObj);
                    if (monthType === 'prev') handlePrevMonth();
                    if (monthType === 'next') handleNextMonth();
                  }}
                  className={`h-8 sm:h-9 rounded-xl text-xs font-mono font-bold flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black shadow-md shadow-purple-950/60 scale-105 ring-1 ring-white/30 z-10'
                      : isCurrentMonth
                      ? todayMark
                        ? 'bg-purple-500/15 border border-purple-500/40 text-purple-300 hover:bg-purple-900/40'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-900/40'
                  }`}
                >
                  <span>{day}</span>
                  {todayMark && !active && (
                    <span className="w-1 h-1 rounded-full bg-purple-400 absolute bottom-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black shadow-lg shadow-purple-950/50 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Confirmar Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
