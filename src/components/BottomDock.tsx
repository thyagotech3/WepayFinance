import React from 'react';
import { Home, History, Plus, Sparkles, Wallet } from 'lucide-react';

interface BottomDockProps {
  activeTab: 'home' | 'transactions' | 'split' | 'analytics' | 'advisor';
  setActiveTab: (tab: 'home' | 'transactions' | 'split' | 'analytics' | 'advisor') => void;
  onOpenExpenseModal: () => void;
  onOpenSettings: () => void;
}

export const BottomDock: React.FC<BottomDockProps> = ({
  activeTab,
  setActiveTab,
  onOpenExpenseModal,
}) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-[#090c17]/95 border-t border-slate-800/80 backdrop-blur-xl px-2 sm:px-4 pt-2 pb-safe shadow-2xl tap-highlight-transparent touch-callout-none">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Item 1: Início */}
        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 transition-all cursor-pointer rounded-xl active:scale-95 ${
            activeTab === 'home' 
              ? 'text-purple-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'home' ? 'bg-purple-500/15' : ''}`}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Início</span>
        </button>

        {/* Item 2: Renda */}
        <button
          type="button"
          onClick={() => setActiveTab('split')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 transition-all cursor-pointer rounded-xl active:scale-95 ${
            activeTab === 'split' 
              ? 'text-purple-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <div className={`p-1 rounded-full ${activeTab === 'split' ? 'bg-purple-500/15' : ''}`}>
            <Wallet className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Renda</span>
        </button>

        {/* Center Prominent FAB: + Lançar */}
        <div className="-mt-6 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={onOpenExpenseModal}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-pink-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/40 hover:scale-110 active:scale-95 transition-all cursor-pointer ring-4 ring-[#090c17]"
            title="Lançar Novo Gasto Rápido"
          >
            <Plus className="w-7 h-7 stroke-[2.5]" />
          </button>
          <span className="text-[10px] font-bold text-pink-400 mt-1">Lançar</span>
        </div>

        {/* Item 4: Joy IA */}
        <button
          type="button"
          onClick={() => setActiveTab('advisor')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 transition-all cursor-pointer rounded-xl active:scale-95 ${
            activeTab === 'advisor' 
              ? 'text-purple-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-white'
          }`}
          title="Joy IA - Assistente Financeira"
        >
          <div className={`p-1 rounded-full ${activeTab === 'advisor' ? 'bg-purple-500/15' : ''}`}>
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Joy IA</span>
        </button>

        {/* Item 5: Histórico */}
        <button
          type="button"
          onClick={() => setActiveTab('transactions')}
          className={`flex flex-col items-center justify-center min-w-[54px] py-1 transition-all cursor-pointer rounded-xl active:scale-95 ${
            activeTab === 'transactions' 
              ? 'text-purple-400 font-bold scale-105' 
              : 'text-slate-400 hover:text-white'
          }`}
          title="Histórico de Lançamentos"
        >
          <div className={`p-1 rounded-full ${activeTab === 'transactions' ? 'bg-purple-500/15' : ''}`}>
            <History className="w-5 h-5" />
          </div>
          <span className="text-[10px] tracking-tight">Histórico</span>
        </button>
      </div>
    </nav>
  );
};

