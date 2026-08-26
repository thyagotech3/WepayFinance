import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Wallet,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  getBalanceAIAnalysisWithGemini,
  BalanceAIAnalysis,
} from '../utils/geminiClient';
import { balanceAnalysisFallback } from '../utils/aiFallback';

interface BalanceAIInsightCardProps {
  currentBalance: number;
  totalIncome: number;
  totalExpenses: number;
  totalFixedPaid: number;
  totalFixedToPay: number;
  monthName: string;
  memberNames: string[];
  onOpenFullBalance?: () => void;
}

export const BalanceAIInsightCard: React.FC<BalanceAIInsightCardProps> = ({
  currentBalance,
  totalIncome,
  totalExpenses,
  totalFixedPaid,
  totalFixedToPay,
  monthName,
  memberNames,
  onOpenFullBalance,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<BalanceAIAnalysis>(() =>
    balanceAnalysisFallback(
      currentBalance,
      totalIncome,
      totalExpenses,
      totalFixedPaid,
      totalFixedToPay,
      monthName,
      memberNames
    )
  );

  // Recalculate analysis when balance metrics change or month changes
  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const result = await getBalanceAIAnalysisWithGemini(
        currentBalance,
        totalIncome,
        totalExpenses,
        totalFixedPaid,
        totalFixedToPay,
        monthName,
        memberNames
      );
      setAnalysis(result);
    } catch (err) {
      console.warn('AI Balance Analysis error:', err);
      setAnalysis(
        balanceAnalysisFallback(
          currentBalance,
          totalIncome,
          totalExpenses,
          totalFixedPaid,
          totalFixedToPay,
          monthName,
          memberNames
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Instant update with heuristic, then trigger async Gemini if available
    setAnalysis(
      balanceAnalysisFallback(
        currentBalance,
        totalIncome,
        totalExpenses,
        totalFixedPaid,
        totalFixedToPay,
        monthName,
        memberNames
      )
    );
    runAnalysis();
  }, [
    currentBalance,
    totalIncome,
    totalExpenses,
    totalFixedPaid,
    totalFixedToPay,
    monthName,
    memberNames.join(','),
  ]);

  // Color schemes based on status
  const statusTheme = useMemo(() => {
    switch (analysis.status) {
      case 'danger':
        return {
          cardBg: 'bg-gradient-to-r from-[#260e14] via-[#1a101d] to-[#0e1220]',
          border: 'border-rose-500/50 hover:border-rose-400',
          glow: 'shadow-rose-900/20',
          iconBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          badgeBg: 'bg-rose-950/80 text-rose-300 border-rose-600/60',
          headlineColor: 'text-rose-200',
          accentText: 'text-rose-400',
          icon: <ShieldAlert className="w-4 h-4" />,
        };
      case 'warning':
        return {
          cardBg: 'bg-gradient-to-r from-[#24170d] via-[#1a1224] to-[#0e1220]',
          border: 'border-amber-500/50 hover:border-amber-400',
          glow: 'shadow-amber-900/20',
          iconBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          badgeBg: 'bg-amber-950/80 text-amber-300 border-amber-600/60',
          headlineColor: 'text-amber-200',
          accentText: 'text-amber-400',
          icon: <AlertTriangle className="w-4 h-4" />,
        };
      case 'positive':
        return {
          cardBg: 'bg-gradient-to-r from-[#0d221c] via-[#10192e] to-[#0e1220]',
          border: 'border-emerald-500/50 hover:border-emerald-400',
          glow: 'shadow-emerald-900/20',
          iconBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          badgeBg: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60',
          headlineColor: 'text-emerald-200',
          accentText: 'text-emerald-400',
          icon: <Sparkles className="w-4 h-4" />,
        };
      case 'neutral':
      default:
        return {
          cardBg: 'bg-gradient-to-r from-[#171333] via-[#10142b] to-[#0c1f29]',
          border: 'border-purple-500/50 hover:border-purple-400',
          glow: 'shadow-purple-900/20',
          iconBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          badgeBg: 'bg-purple-950/80 text-purple-300 border-purple-600/60',
          headlineColor: 'text-purple-200',
          accentText: 'text-purple-400',
          icon: <Sparkles className="w-4 h-4" />,
        };
    }
  }, [analysis.status]);

  return (
    <div
      id="ai-balance-insight-card"
      onClick={() => setIsExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsExpanded((prev) => !prev);
        }
      }}
      className={`w-full rounded-2xl border transition-all duration-200 cursor-pointer shadow-lg select-none text-left overflow-hidden ${statusTheme.cardBg} ${statusTheme.border} ${statusTheme.glow}`}
    >
      {/* ================= COMPACT COLLAPSED BAR ================= */}
      <div className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 flex items-center justify-between gap-2.5">
        {/* Left: AI Avatar / Icon */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 transition-transform ${statusTheme.iconBg}`}
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              statusTheme.icon
            )}
          </div>

          {/* Center: Title + 1-Line Highlight */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                Análise IA Joy
              </span>
              <span
                className={`px-1.5 py-0.2 rounded-full border text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider ${statusTheme.badgeBg}`}
              >
                {analysis.badge}
              </span>
            </div>

            <p
              className={`text-[11px] sm:text-xs font-semibold leading-tight truncate mt-0.5 ${statusTheme.headlineColor}`}
            >
              {analysis.headline}
            </p>
          </div>
        </div>

        {/* Right: Expand / Collapse Indicator */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="hidden xs:inline text-[10px] font-bold text-slate-400 uppercase tracking-tight">
            {isExpanded ? 'Recolher' : 'Expandir'}
          </span>
          <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 transition-transform">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        </div>
      </div>

      {/* ================= EXPANDED DETAILED ANALYSIS ================= */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-slate-800/80 bg-[#090b16]/80 px-3 py-3 sm:px-4 sm:py-3.5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Detailed Diagnostic Paragraph */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Diagnóstico do Balanço • {monthName}
              </span>
              <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-normal">
                {analysis.detailedAnalysis}
              </p>
            </div>

            {/* 3 Key Factors Cards */}
            {analysis.keyFactors && analysis.keyFactors.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-0.5">
                {analysis.keyFactors.map((factor, idx) => (
                  <div
                    key={idx}
                    className="bg-[#0e1224] border border-slate-800 rounded-xl p-2 flex flex-col justify-between text-left"
                  >
                    <span className="text-[9px] sm:text-[10px] font-medium text-slate-400 line-clamp-1">
                      {factor.label}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-extrabold mt-0.5 ${
                        factor.impact === 'good'
                          ? 'text-emerald-400'
                          : factor.impact === 'warning'
                          ? 'text-amber-400'
                          : 'text-purple-300'
                      }`}
                    >
                      {factor.value}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations Bullet points */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="bg-[#12162e]/70 border border-purple-500/20 rounded-xl p-2.5 sm:p-3 space-y-1.5 text-left">
                <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  Recomendações da Joy para o Casal:
                </span>
                <ul className="space-y-1 text-xs text-slate-300 font-medium">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-purple-400 font-bold mt-0.5">•</span>
                      <span className="leading-snug">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  runAnalysis();
                }}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-slate-400 hover:text-purple-300 py-1 px-2 rounded-lg hover:bg-purple-950/40 transition-colors cursor-pointer disabled:opacity-50"
                title="Recalcular com IA"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoading ? 'animate-spin text-purple-400' : ''}`}
                />
                <span>{isLoading ? 'Analisando...' : 'Recalcular Análise'}</span>
              </button>

              {onOpenFullBalance && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenFullBalance();
                  }}
                  className="flex items-center gap-1 text-[10px] sm:text-xs font-extrabold text-blue-400 hover:text-blue-300 py-1 px-2.5 rounded-lg bg-blue-950/60 border border-blue-500/30 hover:border-blue-400 transition-all cursor-pointer shadow-xs"
                >
                  <span>Ver Balanço Geral Completo</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
