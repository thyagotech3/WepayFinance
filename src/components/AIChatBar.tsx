import React, { useState, useRef, useEffect } from 'react';
import { FamilyMember, Transaction, RecurrentPreset } from '../types';
import { COMMON_SUGGESTIONS, QUICK_RECURRENT_PRESETS } from '../data/suggestions';
import { parseExpenseWithGemini } from '../utils/geminiClient';
import { parseExpenseFallback } from '../utils/aiFallback';
import { Sparkles, Mic, MicOff, Send, Loader2, CheckCircle2, ChevronDown, Repeat, ArrowUpRight, Zap, RefreshCw, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIChatBarProps {
  currentMember: FamilyMember;
  members: FamilyMember[];
  onAddTransaction: (transaction: Omit<Transaction, 'id' | 'date'>) => void;
}

export const AIChatBar: React.FC<AIChatBarProps> = ({
  currentMember,
  members,
  onAddTransaction,
}) => {
  const [inputText, setInputText] = useState('');
  const [isFocusingInput, setIsFocusingInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // AI Interpretation Preview Result
  const [parsedExpense, setParsedExpense] = useState<{
    description: string;
    amount: number;
    category: any;
    categoryIcon?: string;
    type: 'expense' | 'income';
    paidBy: string;
    splitType: 'equal' | 'individual' | 'proportional';
    aiResponse: string;
  } | null>(null);

  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  // Audio Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  // Auto hide suggestions when clicking outside
  const inputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputContainerRef.current && !inputContainerRef.current.contains(e.target as Node)) {
        setIsFocusingInput(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Submit Text to Gemini AI
  const handleInterpretText = async (textToProcess?: string) => {
    const targetText = textToProcess || inputText;
    if (!targetText.trim()) return;

    setIsLoading(true);
    setIsFocusingInput(false);
    setParsedExpense(null);

    // Parse via Gemini or Fallback
    const parsed = await parseExpenseWithGemini(targetText, members.map((m) => m.name));

    // ALWAYS open review & edit card so the user can edit and confirm what Joy understood
    setParsedExpense(parsed as any);
    setIsLoading(false);
  };

  // Toggle Voice Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microfone inacessível:', err);
      // Speech Recognition fallback if microphone access fails or in unsupported context
      runSpeechRecognitionFallback();
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const runSpeechRecognitionFallback = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta gravação de voz direta. Digite no campo de texto.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(transcript);
      setIsRecording(false);
      handleInterpretText(transcript);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const processAudioBlob = async (blob: Blob) => {
    setIsLoading(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        try {
          const response = await fetch('/api/ai/parse-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: 'audio/webm',
              memberNames: members.map((m) => m.name),
            }),
          });

          if (response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const resData = await response.json();
              if (resData.success && resData.data) {
                if (resData.data.transcription) {
                  setInputText(resData.data.transcription);
                }
                setParsedExpense(resData.data);
                setIsLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Erro ao chamar backend de voz, usando fallback:', e);
        }

        // Speech recognition fallback
        runSpeechRecognitionFallback();
        setIsLoading(false);
      };
    } catch (err) {
      console.error(err);
      setIsLoading(false);
    }
  };

  // Confirm adding parsed expense
  const handleConfirmParsedExpense = () => {
    if (!parsedExpense) return;

    // Match paidBy to member ID
    const matchedMember = members.find(
      (m) => m.name.toLowerCase() === parsedExpense.paidBy.toLowerCase()
    ) || currentMember;

    onAddTransaction({
      description: parsedExpense.description,
      amount: parsedExpense.amount,
      category: parsedExpense.category || 'Alimentação',
      categoryIcon: parsedExpense.categoryIcon || 'ShoppingCart',
      type: parsedExpense.type || 'expense',
      paidByMemberId: matchedMember.id,
      splitType: parsedExpense.splitType || 'equal',
      aiCategorized: true,
    });

    setToastSuccess(`Lançamento "${parsedExpense.description}" adicionado com sucesso!`);
    setTimeout(() => setToastSuccess(null), 3500);

    setParsedExpense(null);
    setInputText('');
  };

  // Click on a Quick Recurrent Button
  const handleQuickRecurrentClick = (preset: RecurrentPreset) => {
    onAddTransaction({
      description: preset.title,
      amount: preset.amount,
      category: preset.category,
      categoryIcon: preset.categoryIcon,
      type: 'expense',
      paidByMemberId: currentMember.id,
      splitType: preset.splitType,
      isRecurrent: true,
      aiCategorized: false,
    });

    setToastSuccess(`Gasto recorrente "${preset.title}" (R$ ${preset.amount.toFixed(2)}) lançado!`);
    setTimeout(() => setToastSuccess(null), 3500);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background Gradient Accent */}
      <div className="absolute -top-24 -right-24 w-60 h-60 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Title Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white rounded-xl shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Assistente de Gastos WePay
            </h2>
            <p className="text-xs text-slate-400">
              Digite ou fale para a IA categorizar a despesa automaticamente
            </p>
          </div>
        </div>

        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
          <Zap className="w-3 h-3" /> Gemini 3.6 Flash
        </span>
      </div>

      {/* Main Text Input & Voice Bar Container */}
      <div ref={inputContainerRef} className="relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInterpretText();
          }}
          className="relative flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl p-1.5 focus-within:border-pink-500 transition-all shadow-inner"
        >
          <input
            type="text"
            value={inputText}
            onFocus={() => setIsFocusingInput(true)}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Ex: "Jantei no japonês R$ 120 pago por ${members[0]?.name || 'membro'}" ou "Supermercado R$ 250"`}
            className="w-full bg-transparent px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none"
          />

          {/* Controls: Voice & Submit */}
          <div className="flex items-center gap-1.5 pr-1">
            {/* Voice Record Button */}
            <button
              type="button"
              onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
              className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30'
                  : 'bg-slate-700/80 hover:bg-slate-700 text-slate-200'
              }`}
              title={isRecording ? 'Parar gravação' : 'Falar gasto por voz'}
            >
              {isRecording ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="text-[11px] font-mono">{recordingSeconds}s</span>
                </>
              ) : (
                <Mic className="w-4 h-4 text-pink-400" />
              )}
            </button>

            {/* Interpret Button */}
            <button
              type="submit"
              disabled={isLoading || !inputText.trim()}
              className="p-2.5 bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 disabled:opacity-40 text-white font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-md"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Analisar</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* SUGGESTIONS DROPDOWN (Triggers on focus or click as requested) */}
        <AnimatePresence>
          {isFocusingInput && !parsedExpense && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-3 z-30 max-h-72 overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/80">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <ChevronDown className="w-3.5 h-3.5 text-pink-400" /> Sugestões de Gastos Comuns (Clique para escolher)
                </span>
                <span className="text-[10px] text-slate-500">
                  Valores personalizáveis
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMMON_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug.id}
                    type="button"
                    onClick={() => {
                      setInputText(`${sug.title} R$ ${sug.defaultAmount.toFixed(2)}`);
                      handleInterpretText(`${sug.title} R$ ${sug.defaultAmount.toFixed(2)}`);
                    }}
                    className="flex items-center justify-between p-2.5 bg-slate-900/60 hover:bg-slate-700/60 rounded-xl border border-slate-700/50 transition-all text-left group"
                  >
                    <div>
                      <p className="text-xs font-semibold text-white group-hover:text-pink-300">
                        {sug.title}
                      </p>
                      <span className="text-[10px] text-slate-400">
                        {sug.category} • {sug.popularTime}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20">
                      R$ {sug.defaultAmount.toFixed(2)}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI PARSED EXPENSE CONFIRMATION CARD / MODAL */}
      <AnimatePresence>
        {parsedExpense && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            className="mt-4 bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border-2 border-purple-500/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-500/20 border border-purple-500/40 text-purple-300 rounded-xl shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">O que a Joy entendeu</h3>
                  <p className="text-xs text-purple-200">
                    {parsedExpense.aiResponse || 'Confirme ou ajuste os detalhes antes de registrar'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setParsedExpense(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar e cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Editable Fields */}
            <div className="space-y-3 bg-slate-950/70 p-3.5 rounded-xl border border-purple-500/20 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Descrição</label>
                  <input
                    type="text"
                    value={parsedExpense.description}
                    onChange={(e) => setParsedExpense({ ...parsedExpense, description: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={parsedExpense.amount || ''}
                    onChange={(e) => setParsedExpense({ ...parsedExpense, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-extrabold text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Categoria</label>
                  <select
                    value={parsedExpense.category || 'Alimentação'}
                    onChange={(e) => setParsedExpense({ ...parsedExpense, category: e.target.value as any })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    {['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Compras', 'Serviços', 'Outros'].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Quem Pagou</label>
                  <select
                    value={parsedExpense.paidBy || currentMember.name}
                    onChange={(e) => setParsedExpense({ ...parsedExpense, paidBy: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:border-purple-500 focus:outline-none cursor-pointer"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setParsedExpense(null)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmParsedExpense}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QUICK RECURRENT EXPENSES BUTTONS (Required feature) */}
      <div className="mt-5 pt-4 border-t border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5 text-pink-400" />
            Gastos Recorrentes do Casal (Lançamento Rápido em 1 Clique)
          </span>
          <span className="text-[10px] text-slate-500">Sincronizado</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          {QUICK_RECURRENT_PRESETS.map((rec) => (
            <button
              key={rec.id}
              onClick={() => handleQuickRecurrentClick(rec)}
              className="p-2.5 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 hover:border-pink-500/50 rounded-2xl transition-all text-left flex flex-col justify-between group shadow-sm hover:scale-[1.02]"
            >
              <div>
                <p className="text-xs font-semibold text-slate-200 group-hover:text-pink-300 truncate">
                  {rec.title}
                </p>
                <span className="text-[10px] text-slate-400 block mt-0.5">{rec.category}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-emerald-400 flex items-center justify-between">
                <span>R$ {rec.amount.toFixed(0)}</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-pink-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {toastSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3 p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs rounded-xl flex items-center gap-2 font-medium"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastSuccess}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
