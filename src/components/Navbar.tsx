import React, { useState, useEffect } from 'react';
import { FamilyGroup, FamilyMember } from '../types';
import { 
  Heart, Settings, LogOut, HelpCircle, User, ChevronDown, X, 
  Sparkles, BookOpen, CheckCircle2, ArrowRight, Home, History,
  Wallet, BarChart3, Bot, Calendar, PiggyBank, Plus, TrendingUp, Users, ShoppingCart
} from 'lucide-react';

interface NavbarProps {
  group: FamilyGroup;
  currentMember: FamilyMember;
  activeTab?: 'home' | 'transactions' | 'split' | 'analytics' | 'advisor';
  setActiveTab?: (tab: 'home' | 'transactions' | 'split' | 'analytics' | 'advisor') => void;
  subView?: 'none' | 'fixedExpenses' | 'fullBalance' | 'newTransaction' | 'cofrinhos' | 'settings';
  setSubView?: (view: 'none' | 'fixedExpenses' | 'fullBalance' | 'newTransaction' | 'cofrinhos' | 'settings') => void;
  onOpenExpense?: () => void;
  onOpenIncome?: () => void;
  onOpenFixedExpenses?: () => void;
  onOpenCofrinhos?: () => void;
  onOpenMercado?: () => void;
  onSwitchMember: (memberId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  group,
  currentMember,
  activeTab = 'home',
  setActiveTab,
  subView = 'none',
  setSubView,
  onOpenExpense,
  onOpenIncome,
  onOpenFixedExpenses,
  onOpenCofrinhos,
  onOpenMercado,
  onSwitchMember,
  onOpenSettings,
  onLogout,
}) => {
  const [greeting, setGreeting] = useState<string>('Bom dia Casal! <3');
  const [showWelcomeModal, setShowWelcomeModal] = useState<boolean>(true);
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Dynamic greeting based on current time
  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        setGreeting('Bom dia Casal! <3');
      } else if (hour >= 12 && hour < 18) {
        setGreeting('Boa tarde Casal! <3');
      } else {
        setGreeting('Boa noite Casal! <3');
      }
    };

    updateGreeting();
    const interval = setInterval(updateGreeting, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  const handleNavClick = (tab: 'home' | 'transactions' | 'split' | 'analytics' | 'advisor') => {
    if (setSubView) setSubView('none');
    if (setActiveTab) setActiveTab(tab);
  };

  const handleSubViewClick = (view: 'fixedExpenses' | 'cofrinhos' | 'settings') => {
    if (setSubView) setSubView(view);
  };

  return (
    <>
      {/* Top Fixed Bar - Glued edge-to-edge, no side borders or rounded corners, only bottom border */}
      <header className="sticky top-0 z-40 w-full bg-[#090d1c]/95 border-b border-slate-800/80 backdrop-blur-xl shadow-lg tap-highlight-transparent">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-6">
          
          {/* Left Side: Logo & Stylized wePay Brand Name */}
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-2.5 sm:gap-3 shrink-0 cursor-pointer group"
          >
            {/* App Logo */}
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 p-0.5 shadow-md shadow-purple-900/30 shrink-0 flex items-center justify-center group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0c0f1d] rounded-[10px] flex items-center justify-center">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 fill-purple-400" />
              </div>
            </div>

            {/* Stylized Brand Name wePay */}
            <div className="flex items-center text-xl sm:text-2xl font-black tracking-tight select-none">
              <span className="text-white">we</span>
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-pink-400 bg-clip-text text-transparent">Pay</span>
            </div>
          </div>

          {/* Center: Desktop Navigation Bar (Seamless, without restrictive outer frame) */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'home' && subView === 'none'
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Home className="w-3.5 h-3.5 shrink-0" />
              <span>Início</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('split')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'split' && subView === 'none'
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 shrink-0" />
              <span>Renda</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('transactions')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'transactions' && subView === 'none'
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span>Histórico</span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('advisor')}
              className={`h-9 flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeTab === 'advisor' && subView === 'none'
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Joy(IA)</span>
            </button>

            <div className="w-px h-4 bg-slate-800 my-auto mx-1" />

            <button
              type="button"
              onClick={() => handleSubViewClick('cofrinhos')}
              className={`h-9 flex items-center gap-1.5 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                subView === 'cofrinhos'
                  ? 'bg-purple-600/90 text-white shadow-md shadow-purple-950/50'
                  : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/50'
              }`}
              title="Cofrinhos e Metas"
            >
              <PiggyBank className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Cofrinhos</span>
            </button>
          </nav>

          {/* Right Side: Quick Action Buttons & Account (Uniform h-9 alignment) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            
            {/* Desktop 3 Action Buttons (Novo Gasto, Despesas Fixas, Arrecadação) */}
            <div className="hidden md:flex items-center gap-1.5 lg:gap-2">
              {onOpenExpense && (
                <button
                  type="button"
                  onClick={onOpenExpense}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-pink-900/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Lançar Novo Gasto / Despesa"
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Novo Gasto</span>
                </button>
              )}

              {onOpenMercado && (
                <button
                  type="button"
                  onClick={onOpenMercado}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Lançar Compra de Mercado / Cupom Fiscal com IA"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Mercado</span>
                </button>
              )}

              {onOpenFixedExpenses && (
                <button
                  type="button"
                  onClick={onOpenFixedExpenses}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-amber-900/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Gerenciar Despesas Fixas"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Despesas Fixas</span>
                </button>
              )}

              {onOpenIncome && (
                <button
                  type="button"
                  onClick={onOpenIncome}
                  className="h-9 flex items-center gap-1.5 px-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-md shadow-emerald-900/30 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Cadastrar Arrecadação / Entradas"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Arrecadação</span>
                </button>
              )}
            </div>

            {/* Account Photo Button - Avatar icon & Profile Name */}
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              className="h-9 flex items-center gap-2 px-2 sm:px-2.5 bg-[#14182e] hover:bg-slate-800/90 border border-slate-800 rounded-xl transition-all cursor-pointer shadow-sm group shrink-0"
              title={`Conta ativa: ${currentMember.name}. Clique para alternar conta`}
            >
              <div className="w-6 h-6 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-indigo-500 to-pink-500 shrink-0 flex items-center justify-center shadow-xs">
                <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                  {currentMember.avatar ? (
                    <img src={currentMember.avatar} alt={currentMember.name} className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-black text-white text-[10px]"
                      style={{ backgroundColor: currentMember.color || '#6366f1' }}
                    >
                      {currentMember.name.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-200 group-hover:text-white truncate max-w-[90px] sm:max-w-[120px]">
                {currentMember.name}
              </span>
            </button>

            {/* Settings Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`h-9 px-2.5 sm:px-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isMenuOpen || subView === 'settings'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-700/60 shadow-lg'
                    : 'bg-[#14182e] hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
                }`}
                title="Opções & Configurações"
              >
                <Settings className="w-4 h-4 text-purple-400" />
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 hidden sm:block ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-[#0f1326] border border-slate-800 rounded-2xl shadow-2xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* User info preview */}
                    <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                      <span className="text-[10px] text-slate-400 font-medium block">Conectado como</span>
                      <span className="text-xs font-bold text-white truncate block">{currentMember.name}</span>
                    </div>

                    {/* Menu Item 1: Configurações */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-purple-950/50 rounded-xl transition-all cursor-pointer"
                    >
                      <Settings className="w-4 h-4 text-purple-400" />
                      <span>Configurações</span>
                    </button>

                    {/* Menu Item 2: Ajuda */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setShowHelpModal(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-blue-950/50 rounded-xl transition-all cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-blue-400" />
                      <span>Ajuda</span>
                    </button>

                    {/* Menu Item 3: Sair */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-xl transition-all cursor-pointer border-t border-slate-800/80 mt-1"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair</span>
                    </button>
                  </div>
                </>
              )}
            </div>

          </div>
        </div>
      </header>

      {/* Account Switch Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f1326] border border-slate-800 w-full max-w-sm rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white">Alternar Perfil</h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Escolha qual membro do casal está realizando os lançamentos agora:
            </p>

            <div className="space-y-2">
              {group.members.map((m) => {
                const isActive = m.id === currentMember.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onSwitchMember(m.id);
                      setShowAccountModal(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-purple-950/60 border-purple-600 text-white shadow-md'
                        : 'bg-[#14182e] border-slate-800 text-slate-300 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center font-black text-xs text-white"
                        style={{ backgroundColor: m.color || '#6366f1' }}
                      >
                        {m.avatar ? (
                          <img src={m.avatar} alt={m.name} className="w-full h-full object-cover" />
                        ) : (
                          m.name.charAt(0)
                        )}
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-bold block">{m.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {m.income ? `R$ ${m.income.toLocaleString('pt-BR')} base` : 'Integrante'}
                        </span>
                      </div>
                    </div>

                    {isActive && <CheckCircle2 className="w-4 h-4 text-purple-400" />}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAccountModal(false);
                onOpenSettings();
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-purple-400" />
              <span>Gerenciar Integrantes</span>
            </button>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f1326] border border-slate-800 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-black text-white">Guia Rápido wePay</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-[#14182e] rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-purple-300 block">💡 Lançamento Rápido</span>
                <p>Use o botão <strong>+ Nova Despesa</strong> no topo ou fale no microfone da <strong>Joy IA</strong> para cadastrar contas em segundos.</p>
              </div>

              <div className="p-3 bg-[#14182e] rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-pink-300 block">⚖️ Divisão & Acerto do Casal</span>
                <p>Na aba <strong>Divisão Casal</strong>, o sistema calcula quem pagou o quê e calcula a compensação justa 50/50 automaticamente.</p>
              </div>

              <div className="p-3 bg-[#14182e] rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-amber-300 block">🗓️ Contas Fixas</span>
                <p>Cadastre aluguéis, faturas e contas de consumo para receber lembretes de vencimento antes do atraso.</p>
              </div>

              <div className="p-3 bg-[#14182e] rounded-2xl border border-slate-800 space-y-1">
                <span className="font-bold text-emerald-300 block">🐷 Cofrinhos & Sonhos</span>
                <p>Guarde dinheiro para viagens, casamento ou reserva de emergência e acompanhe a barra de progresso.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Entendido!
            </button>
          </div>
        </div>
      )}
    </>
  );
};


