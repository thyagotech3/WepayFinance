import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FamilyGroup, FamilyMember, Transaction, AIAdviceResult, IncomeStream, FixedExpenseItem } from '../types';
import { getMonthlyIncomeData, isFixedExpensePaidInMonth, isFixedExpenseActiveInMonth } from '../utils/incomeUtils';
import { parseCurrencyBR } from '../utils/currencyUtils';
import { useAppStore } from '../store/useAppStore';
import { BalanceAIInsightCard } from './BalanceAIInsightCard';
import {
  parseExpenseWithGemini,
  getFinancialAdviceWithGemini,
  chatAuditWithGemini,
} from '../utils/geminiClient';
import { auditHistoryFallback, parseExpenseFallback } from '../utils/aiFallback';
import {
  Sparkles,
  ShieldAlert,
  HeartHandshake,
  Loader2,
  RefreshCw,
  Lightbulb,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Trash2,
  MessageSquare,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Bot,
  User,
  Mic,
  MicOff,
  ArrowDownCircle,
  ArrowUpCircle,
  PlusCircle,
  Check,
  X,
  Edit3,
  Settings,
  Tag,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Wallet,
  Calendar,
  Zap,
  Target,
  ArrowUpRight,
  PieChart,
  Percent,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnomalyItem {
  id: string;
  type: 'duplicate' | 'double_payment' | 'unusual_spike' | 'missing_info' | string;
  severity: 'warning' | 'error' | 'info' | string;
  title: string;
  description: string;
  transactionId?: string;
  fixedExpenseId?: string;
  suggestion: string;
}

interface AuditResult {
  summary: string;
  inconsistenciesFound: number;
  aiGreeting: string;
  anomalies: AnomalyItem[];
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'model';
  text: string;
  timestamp: string;
}

interface ParsedLaunchData {
  description: string;
  amount: number;
  category: string;
  categoryIcon?: string;
  type: 'expense' | 'income';
  paidBy: string;
  splitType?: 'equal' | 'individual' | 'proportional' | string;
  aiResponse: string;
  transcription?: string;
}

interface AIAdvisorViewProps {
  onDeleteTransaction?: (id: string) => void;
  onAddTransaction?: (tx: Omit<Transaction, 'id' | 'date'>) => void;
  onAddIncomeStream?: (memberId: string, streamData: Omit<IncomeStream, 'id'>, monthKey: string) => void;
  onOpenFullBalance?: () => void;
}

export const AIAdvisorView: React.FC<AIAdvisorViewProps> = ({
  onDeleteTransaction,
  onAddTransaction,
  onAddIncomeStream,
  onOpenFullBalance,
}) => {
  const { group, currentMemberId, transactions, fixedExpenses: propFixedExpenses } = useAppStore();
  const members = group?.members || [];
  const currentMember = members.find((m) => m.id === currentMemberId) || members[0];
  // AI Launching State
  const [launchPrompt, setLaunchPrompt] = useState<string>('');
  const [isParsingLaunch, setIsParsingLaunch] = useState<boolean>(false);
  const [parsedLaunch, setParsedLaunch] = useState<ParsedLaunchData | null>(null);
  const [launchSuccessMsg, setLaunchSuccessMsg] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState<boolean>(false);

  // Shortcuts State
  const [shortcuts, setShortcuts] = useState<string[]>(() => {
    const saved = localStorage.getItem('joy_shortcuts');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      '🍽️ Almoço',
      '⛽ Gasolina',
      '🛒 Mercado',
      '☕ Café',
      '💊 Farmácia',
      '🍔 Lanche',
      '💰 Renda Extra',
    ];
  });
  const [isEditingShortcuts, setIsEditingShortcuts] = useState<boolean>(false);
  const [tempShortcuts, setTempShortcuts] = useState<string[]>(shortcuts);

  // Editable fields for parsed launch
  const [editDesc, setEditDesc] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editCategory, setEditCategory] = useState<string>('Alimentação');
  const [editType, setEditType] = useState<'expense' | 'income'>('expense');
  const [editMemberId, setEditMemberId] = useState<string>(currentMember?.id || members[0]?.id || '');
  const [editSplitType, setEditSplitType] = useState<string>('equal');
  const [isEditingInModal, setIsEditingInModal] = useState<boolean>(false);

  // MediaRecorder Voice Ref
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // General Financial Advice State
  const [advice, setAdvice] = useState<AIAdviceResult | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState<boolean>(false);

  // Full History Audit State
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(new Set());

  // Interactive Audit Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [loadingChat, setLoadingChat] = useState<boolean>(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync edit states when parsed launch changes
  useEffect(() => {
    if (parsedLaunch) {
      setEditDesc(parsedLaunch.description || '');
      setEditAmount(parsedLaunch.amount ? String(parsedLaunch.amount) : '');
      setEditCategory(parsedLaunch.category || 'Alimentação');
      
      const rawType = (parsedLaunch.type || '').toLowerCase();
      if (rawType.includes('income') || rawType.includes('receita') || rawType.includes('entrada') || rawType.includes('ganho')) {
        setEditType('income');
      } else {
        setEditType('expense');
      }

      setEditSplitType(parsedLaunch.splitType || 'equal');

      const matchedMember = members.find(
        (m) => m.name.toLowerCase() === (parsedLaunch.paidBy || '').toLowerCase()
      );
      const currentId = currentMember?.id;
      setEditMemberId(matchedMember?.id || currentId || members[0]?.id || '');
      setIsEditingInModal(false);
    }
  }, [parsedLaunch]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loadingChat]);

  // Handle Text Parsing for Expense / Income Launch - ALWAYS opens the modal to confirm and edit
  const handleParseTextLaunch = async (textToParse?: string) => {
    const text = textToParse || launchPrompt.trim();
    if (!text || isParsingLaunch) return;

    setIsParsingLaunch(true);
    setLaunchSuccessMsg(null);

    // Parse via Gemini or Fallback
    const parsed = await parseExpenseWithGemini(text, members.map((m) => m.name));
    
    // ALWAYS open confirmation and edit modal so user can verify what Joy understood
    setParsedLaunch(parsed as any);
    setIsParsingLaunch(false);
  };

  // Toggle Voice Recording
  const handleToggleVoice = async () => {
    if (isRecordingVoice) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsParsingLaunch(true);
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
                  setParsedLaunch(resData.data);
                  if (resData.data.transcription) {
                    setLaunchPrompt(resData.data.transcription);
                  }
                  return;
                }
              }
            }
            const fallback = parseExpenseFallback('Lançamento por Áudio', members.map((m) => m.name));
            setParsedLaunch(fallback as any);
          } catch (e) {
            console.warn('Erro ao processar voz:', e);
            const fallback = parseExpenseFallback('Lançamento por Áudio', members.map((m) => m.name));
            setParsedLaunch(fallback as any);
          } finally {
            setIsParsingLaunch(false);
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecordingVoice(true);
    } catch (err: any) {
      setIsRecordingVoice(false);
      const isDismissed =
        err?.name === 'NotAllowedError' ||
        err?.name === 'PermissionDismissedError' ||
        err?.message?.toLowerCase().includes('dismissed') ||
        err?.message?.toLowerCase().includes('permission');
      if (!isDismissed) {
        console.warn('Microfone não acessível:', err);
      }
    }
  };

  // Confirm and Save Expense, Income or Fixed Expense
  const handleConfirmLaunch = () => {
    if (!parsedLaunch) return;

    const numericAmount = parseCurrencyBR(editAmount) || parsedLaunch.amount || 0;
    const finalDesc = editDesc.trim() || parsedLaunch.description || 'Lançamento IA';
    const finalMemberId = editMemberId || currentMember?.id || members[0]?.id;
    const finalSplit = editSplitType || 'equal';

    if (editType === 'income') {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      if (onAddIncomeStream) {
        onAddIncomeStream(
          finalMemberId,
          {
            name: finalDesc,
            amount: numericAmount,
            nature: 'extra',
            notes: 'Lançado via Joy Assistente',
          },
          monthKey
        );
      } else if (onAddTransaction) {
        onAddTransaction({
          description: finalDesc,
          amount: numericAmount,
          category: editCategory || 'Serviços',
          categoryIcon: 'TrendingUp',
          type: 'income',
          paidByMemberId: finalMemberId,
          splitType: 'individual',
          aiCategorized: true,
        });
      }
    } else {
      if (onAddTransaction) {
        onAddTransaction({
          description: finalDesc,
          amount: numericAmount,
          category: editCategory || 'Alimentação',
          categoryIcon: parsedLaunch.categoryIcon || 'Utensils',
          type: 'expense',
          paidByMemberId: finalMemberId,
          splitType: finalSplit as any,
          aiCategorized: true,
        });
      }
    }

    const memberName = members.find((m) => m.id === finalMemberId)?.name || 'Você';
    const typeLabel = editType === 'income' ? 'Entrada (Receita)' : 'Gasto Rápido';
    setLaunchSuccessMsg(
      `🎉 ${typeLabel} de R$ ${numericAmount.toFixed(
        2
      )} ("${finalDesc}") registrado para ${memberName}!`
    );

    setParsedLaunch(null);
    setIsEditingInModal(false);
    setLaunchPrompt('');
  };

  // Fetch initial general advice on mount
  const fetchAdvice = async () => {
    setLoadingAdvice(true);
    const expenses = transactions.filter(
      (t) => t.type === 'expense' && t.status !== 'reverted' && t.status !== 'deleted'
    );
    const totalExpenses = expenses.reduce((acc, t) => acc + t.amount, 0);

    const categoryTotals: Record<string, number> = {};
    expenses.forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    try {
      const adv = await getFinancialAdviceWithGemini(totalExpenses, group.monthlyBudget, categoryTotals, members.map((m) => m.name));
      setAdvice(adv);
    } catch (err) {
      console.warn('Usando conselho financeiro Joy:', err);
    } finally {
      setLoadingAdvice(false);
    }
  };

  useEffect(() => {
    fetchAdvice();
  }, []);

  // Run full history audit
  const runFullHistoryAudit = async () => {
    setLoadingAudit(true);
    let fixedExpenses: any[] = [];
    const savedFx = localStorage.getItem('wepay_fixed_expenses');
    if (savedFx) {
      try {
        fixedExpenses = JSON.parse(savedFx);
      } catch (e) {
        console.error(e);
      }
    }

    try {
      const response = await fetch('/api/ai/audit-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          fixedExpenses,
          members,
          groupName: group.name,
        }),
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const resData = await response.json();
          if (resData.success && resData.data) {
            const auditData: AuditResult = resData.data;
            setAuditResult(auditData);

            const initialMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              sender: 'model',
              text: auditData.aiGreeting || auditData.summary || 'Olá! Concluí a auditoria do seu histórico. Como posso ajudar com as transações?',
              timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            };
            setChatMessages([initialMsg]);
            setLoadingAudit(false);
            return;
          }
        }
      }
      
      const auditData = auditHistoryFallback(transactions, fixedExpenses);
      setAuditResult(auditData);
      setChatMessages([{
        id: `msg-${Date.now()}`,
        sender: 'model',
        text: auditData.aiGreeting,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (err) {
      console.warn('Usando auditoria Joy local:', err);
      const auditData = auditHistoryFallback(transactions, fixedExpenses);
      setAuditResult(auditData);
      setChatMessages([{
        id: `msg-${Date.now()}`,
        sender: 'model',
        text: auditData.aiGreeting,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Send message in interactive chat
  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || chatInput.trim();
    if (!messageText || loadingChat) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');
    setLoadingChat(true);

    try {
      const replyText = await chatAuditWithGemini(messageText, transactions, members.map((m) => m.name));
      const aiReply: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'model',
        text: replyText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      console.warn('Erro no chat de auditoria:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleDismissAnomaly = (id: string) => {
    setDismissedAnomalies((prev) => new Set(prev).add(id));
  };

  const handleDeleteDuplicate = (transId: string, anomalyId: string) => {
    if (onDeleteTransaction) {
      onDeleteTransaction(transId);
      handleDismissAnomaly(anomalyId);
      // Append message to chat
      handleSendMessage(`Excluí a transação duplicada de ID #${transId}. Pode verificar se o histórico está correto agora?`);
    }
  };

  const activeAnomalies = auditResult?.anomalies.filter(
    (item) => !dismissedAnomalies.has(item.id)
  ) || [];

  // Computed Balance Metrics for Joy IA Balance Analysis replica
  const { currentBalance, totalWalletIncome, totalExpenses, totalFixedPaid, totalFixedToPay, formattedMonthName } = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthNameStr = `${now.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()} ${now.getFullYear()}`;

    const incomeData = getMonthlyIncomeData(currentMonthKey, members);
    const totalIncome = incomeData.totalFamilyIncome;

    const valid = transactions.filter((t) => t.status !== 'reverted' && t.status !== 'deleted');
    const filtered = valid.filter((t) => !t.date || t.date.startsWith(currentMonthKey));
    const active = filtered.length > 0 ? filtered : valid;

    const expenses = active
      .filter((t) => t.type === 'expense')
      .reduce((acc, t) => acc + t.amount, 0);

    let fixedList: FixedExpenseItem[] = propFixedExpenses || [];
    if (!propFixedExpenses) {
      const saved = localStorage.getItem('wepay_fixed_expenses');
      if (saved) {
        try {
          fixedList = JSON.parse(saved);
        } catch (e) {}
      }
    }

    const currentFixedExpenses = fixedList.filter((e) => isFixedExpenseActiveInMonth(e, currentMonthKey));

    const fixedPaid = currentFixedExpenses
      .filter((e) => isFixedExpensePaidInMonth(e, currentMonthKey))
      .reduce((acc, e) => acc + e.amount, 0);

    const fixedToPay = currentFixedExpenses
      .filter((e) => !isFixedExpensePaidInMonth(e, currentMonthKey))
      .reduce((acc, e) => acc + e.amount, 0);

    const balance = totalIncome - expenses;

    return {
      currentBalance: balance,
      totalWalletIncome: totalIncome,
      totalExpenses: expenses,
      totalFixedPaid: fixedPaid,
      totalFixedToPay: fixedToPay,
      formattedMonthName: monthNameStr,
    };
  }, [members, transactions, propFixedExpenses]);

  return (
    <div className="space-y-2.5 sm:space-y-4 max-w-7xl mx-auto pb-4">
      {/* PROMINENT AI LAUNCHER FOR EXPENSES AND INCOMES */}
      <div className="bg-gradient-to-br from-[#0e122b] via-[#141938] to-[#0d0f21] border border-purple-500/30 rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-2xl space-y-2.5 sm:space-y-3 relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-20 -left-20 w-60 sm:w-80 h-60 sm:h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-60 sm:w-80 h-60 sm:h-80 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Title Header */}
        <div className="flex items-center justify-between gap-2 relative z-10">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="p-1.5 sm:p-2 bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-xl shadow-md shadow-purple-500/30 shrink-0">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight uppercase">
                  Joy Assistente
                </h2>
                <span className="text-[9px] text-emerald-400 font-bold flex items-center gap-1 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Gemini
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-300 mt-0.5 leading-tight truncate sm:whitespace-normal">
                Digite ou fale seu Gasto ou Ganho e a Joy registra.
              </p>
            </div>
          </div>
        </div>

        {/* Success Alert Toast */}
        {launchSuccessMsg && (
          <div className="p-2 sm:p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-in fade-in duration-200">
            <span className="leading-tight">{launchSuccessMsg}</span>
            <button
              onClick={() => setLaunchSuccessMsg(null)}
              className="p-1 text-emerald-400 hover:text-white rounded-lg shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Natural Language Prompt & Voice Bar */}
        <div className="space-y-2 relative z-10">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleParseTextLaunch();
            }}
            className="flex items-center gap-1.5 bg-slate-950/90 border border-purple-500/40 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl shadow-inner focus-within:border-purple-400 transition-all"
          >
            {/* Voice Record Button */}
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                isRecordingVoice
                  ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50'
                  : 'bg-purple-950/80 text-purple-300 hover:bg-purple-900 border border-purple-800/60'
              }`}
              title={isRecordingVoice ? 'Gravando... Clique para parar e enviar' : 'Gravar Áudio de Lançamento'}
            >
              {isRecordingVoice ? <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" /> : <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={launchPrompt}
              onChange={(e) => setLaunchPrompt(e.target.value)}
              disabled={isParsingLaunch || isRecordingVoice}
              placeholder={
                isRecordingVoice
                  ? 'Fale o gasto/ganho agora...'
                  : 'Ex: Gastei 10 reais de almoço.'
              }
              className="flex-1 min-w-0 bg-transparent px-1.5 sm:px-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!launchPrompt.trim() || isParsingLaunch}
              className="px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-extrabold text-xs rounded-lg sm:rounded-xl transition-all shadow-md shadow-purple-950 flex items-center gap-1 disabled:opacity-50 cursor-pointer shrink-0"
            >
              {isParsingLaunch ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="hidden sm:inline">Interpretando...</span>
                </>
              ) : (
                <>
                  <Send className="w-3 h-3" />
                  <span>Lançar</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* MODAL DE CONFIRMAÇÃO E EDIÇÃO DO QUE A JOY ENTENDEU */}
        {parsedLaunch && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-slate-950 border-2 border-purple-500/60 rounded-3xl p-4 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 relative my-auto">
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2.5 bg-gradient-to-tr from-purple-600 to-pink-500 text-white rounded-2xl shadow-lg shadow-purple-500/30 shrink-0">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight leading-tight">
                      O que a Joy entendeu
                    </h3>
                    <p className="text-[11px] sm:text-xs text-purple-300/80 font-medium">
                      Revise e edite as informações antes de confirmar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsedLaunch(null);
                    setIsEditingInModal(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors cursor-pointer shrink-0"
                  title="Fechar e cancelar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Joy Assistant Thought Bubble */}
              <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl flex items-start gap-2.5 shadow-inner">
                <div className="p-1.5 bg-purple-600/30 text-purple-300 rounded-xl shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-purple-300" />
                </div>
                <div className="text-xs text-purple-200 leading-relaxed font-medium">
                  {parsedLaunch.aiResponse ? (
                    <span>{parsedLaunch.aiResponse}</span>
                  ) : (
                    <span>Identifiquei seu lançamento! Ajuste ou confirme os campos abaixo:</span>
                  )}
                </div>
              </div>

              {/* Interactive Form with Instant Editing */}
              <div className="space-y-3.5">
                {/* 1. Tipo de Lançamento (Segmented Control) */}
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
                    Tipo de Lançamento
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setEditType('expense')}
                      className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editType === 'expense'
                          ? 'bg-pink-600 text-white shadow-lg shadow-pink-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ArrowDownCircle className="w-3.5 h-3.5" />
                      <span>Gasto Rápido</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('income')}
                      className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        editType === 'income'
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950 font-black'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>Entrada</span>
                    </button>
                  </div>
                </div>

                {/* 2. Valor (R$) e Descrição */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                      Valor (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        R$
                      </span>
                      <input
                        type="text"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="0,00"
                        className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-emerald-400 font-black text-base focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                      Descrição / Nome
                    </label>
                    <input
                      type="text"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Ex: Almoço, Gasolina, Salário"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white font-bold text-xs sm:text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                {/* 3. Categoria e Quem Pagou / Recebeu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                      Categoria
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2.5 text-white font-bold text-xs focus:border-purple-500 focus:outline-none cursor-pointer"
                    >
                      {['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde', 'Compras', 'Serviços', 'Outros'].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                      {editType === 'income' ? 'Quem Recebeu' : 'Quem Pagou'}
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {members.map((m) => {
                        const isSelected = editMemberId === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setEditMemberId(m.id)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                              isSelected
                                ? 'bg-purple-950/90 border-purple-500 text-white shadow-md'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: m.color || '#8b5cf6' }}
                            />
                            <span className="truncate">{m.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Cancelar / Confirmar */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setParsedLaunch(null);
                    setIsEditingInModal(false);
                  }}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLaunch}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-lg shadow-emerald-950 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirmar e Salvar</span>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* SHORTCUT BUTTONS BELOW JOY SECTION (FIXED 4 COLUMNS x 2 ROWS, NO SCROLLING) */}
      <div className="w-full space-y-1 sm:space-y-1.5">
        {/* Row 1: 4 botões na linha de cima */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 w-full">
          {shortcuts.slice(0, 4).map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setLaunchPrompt(item);
                handleParseTextLaunch(item);
              }}
              title={item}
              className="w-full min-w-0 h-7 sm:h-8.5 px-0.5 sm:px-2 py-0.5 bg-slate-950/85 hover:bg-purple-950/90 border border-purple-500/40 hover:border-purple-400 text-purple-200 font-semibold rounded-lg sm:rounded-xl text-center transition-all cursor-pointer text-[10px] sm:text-xs shadow-sm active:scale-95 flex items-center justify-center"
            >
              <span className="truncate block w-full text-center leading-tight">
                {item}
              </span>
            </button>
          ))}
        </div>

        {/* Row 2: 4 botões na linha de baixo (3 atalhos + 1 Editar) */}
        <div className="grid grid-cols-4 gap-1 sm:gap-2 w-full">
          {shortcuts.slice(4, 7).map((item, idx) => (
            <button
              key={idx + 4}
              type="button"
              onClick={() => {
                setLaunchPrompt(item);
                handleParseTextLaunch(item);
              }}
              title={item}
              className="w-full min-w-0 h-7 sm:h-8.5 px-0.5 sm:px-2 py-0.5 bg-slate-950/85 hover:bg-purple-950/90 border border-purple-500/40 hover:border-purple-400 text-purple-200 font-semibold rounded-lg sm:rounded-xl text-center transition-all cursor-pointer text-[10px] sm:text-xs shadow-sm active:scale-95 flex items-center justify-center"
            >
              <span className="truncate block w-full text-center leading-tight">
                {item}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTempShortcuts([...shortcuts]);
              setIsEditingShortcuts(true);
            }}
            title="Editar Atalhos"
            className="w-full min-w-0 h-7 sm:h-8.5 px-0.5 sm:px-2 py-0.5 bg-purple-950/90 hover:bg-purple-900 border border-purple-500/70 hover:border-purple-400 text-purple-300 font-bold rounded-lg sm:rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1 text-[10px] sm:text-xs shadow-sm active:scale-95"
          >
            <Settings className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="truncate leading-tight">Editar</span>
          </button>
        </div>
      </div>

      {/* ================= REPLICA DO CARD DE ANÁLISE IA DO BALANÇO (EXPANSÍVEL) ================= */}
      <BalanceAIInsightCard
        currentBalance={currentBalance}
        totalIncome={totalWalletIncome}
        totalExpenses={totalExpenses}
        totalFixedPaid={totalFixedPaid}
        totalFixedToPay={totalFixedToPay}
        monthName={formattedMonthName}
        memberNames={members.map((m) => m.name)}
        onOpenFullBalance={onOpenFullBalance}
      />

      {/* MODAL EDITAR ATALHOS */}
      {isEditingShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-purple-500/40 rounded-2xl p-4 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/20 text-purple-300 rounded-xl border border-purple-500/30">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Editar Atalhos</h3>
                  <p className="text-xs text-slate-400">Personalize os nomes dos botões de atalho da Joy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingShortcuts(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {tempShortcuts.map((sc, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-purple-400 w-20 shrink-0">Atalho {index + 1}:</span>
                  <input
                    type="text"
                    value={sc}
                    onChange={(e) => {
                      const next = [...tempShortcuts];
                      next[index] = e.target.value;
                      setTempShortcuts(next);
                    }}
                    placeholder={`Ex: Atalho ${index + 1}`}
                    className="flex-1 bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsEditingShortcuts(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShortcuts(tempShortcuts);
                  localStorage.setItem('joy_shortcuts', JSON.stringify(tempShortcuts));
                  setIsEditingShortcuts(false);
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-950 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Atalhos</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
