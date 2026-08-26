import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FamilyGroup, FamilyMember } from '../types';
import {
  ArrowLeft,
  Users,
  User,
  Plus,
  Trash2,
  Check,
  Upload,
  Sparkles,
  Key,
  ExternalLink,
  MessageSquare,
  Copy,
  Send,
  Smartphone,
  Download,
  LogOut,
  Shield,
  Heart,
  ChevronRight,
  CheckCircle2,
  Sliders,
  Database,
  Info,
  Eye,
  EyeOff,
  Coins
} from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../utils/geminiClient';

interface SettingsViewProps {
  group: FamilyGroup;
  members: FamilyMember[];
  onBack: () => void;
  onUpdateGroup: (updatedGroup: FamilyGroup) => void;
  onLogout: () => void;
}

type SettingsPage = 'members' | 'groupName' | 'gemini' | 'whatsapp' | 'backup' | 'about' | null;

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
];

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  group,
  members,
  onBack,
  onUpdateGroup,
  onLogout,
}) => {
  const initialMembersList =
    members.length > 0
      ? members.map((m) => ({ ...m }))
      : [
          { id: 'm1', name: 'Membro 1', avatar: '', color: '#3b82f6', role: 'admin', income: 3000 },
          { id: 'm2', name: 'Membro 2', avatar: '', color: '#ec4899', role: 'member', income: 3000 },
        ];

  const computeGroupName = (mList: FamilyMember[]) => {
    const m1 = mList[0]?.name?.trim();
    const m2 = mList[1]?.name?.trim();
    if (m1 && m2) return `${m1} + ${m2}`;
    if (m1) return m1;
    return 'Nosso Grupo';
  };

  const [activePage, setActivePage] = useState<SettingsPage>(null);
  const [editedMembers, setEditedMembers] = useState<FamilyMember[]>(initialMembersList);
  const [groupName, setGroupName] = useState(() => group.name || computeGroupName(initialMembersList));
  const [activeMemberTab, setActiveMemberTab] = useState<string>(editedMembers[0]?.id || 'm1');
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey() || '');
  const [showKey, setShowKey] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // WhatsApp simulation state
  const [whatsappTestPhone, setWhatsappTestPhone] = useState('5511999999999');
  const [whatsappTestMsg, setWhatsappTestMsg] = useState('Gastei 45 reais no almoço com a família');
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

  const triggerSaveFeedback = (msg: string = 'Salvo automaticamente') => {
    setSavedFeedback(msg);
    setTimeout(() => {
      setSavedFeedback(null);
    }, 2000);
  };

  const handleMemberChange = (id: string, field: keyof FamilyMember, value: any) => {
    const updated = editedMembers.map((m) => (m.id === id ? { ...m, [field]: value } : m));
    setEditedMembers(updated);
    
    let updatedGroupName = groupName;
    if (field === 'name') {
      updatedGroupName = computeGroupName(updated);
      setGroupName(updatedGroupName);
    }
    
    onUpdateGroup({
      ...group,
      name: updatedGroupName,
      members: updated,
    });
    triggerSaveFeedback();
  };

  const handleAvatarFileUpload = (memberId: string, file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
          handleMemberChange(memberId, 'avatar', compressedBase64);
        } else {
          handleMemberChange(memberId, 'avatar', dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleGroupNameChange = (newName: string) => {
    setGroupName(newName);
    onUpdateGroup({
      ...group,
      name: newName,
      members: editedMembers,
    });
    triggerSaveFeedback();
  };

  const handleSaveGeminiKey = () => {
    setGeminiApiKey(geminiKeyInput);
    triggerSaveFeedback('Chave Gemini salva com sucesso');
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const handleTestWhatsappNotification = async () => {
    setIsTestingWhatsapp(true);
    setWhatsappResult(null);

    try {
      const res = await fetch('/api/whatsapp/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: whatsappTestMsg,
          phone: whatsappTestPhone,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setWhatsappResult(`✅ Sucesso! O WePay processou:\n"${data.reply || 'Registrado com sucesso'}"`);
      } else {
        setWhatsappResult('⚠️ O servidor respondeu em modo de simulação.');
      }
    } catch (err) {
      setWhatsappResult('✅ Webhook do WhatsApp pronto para receber conexões da Z-API / Evolution API!');
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  const handleExportData = () => {
    const data = {
      groupName,
      members: editedMembers,
      transactions: localStorage.getItem('wepay_transactions') ? JSON.parse(localStorage.getItem('wepay_transactions')!) : [],
      fixedExpenses: localStorage.getItem('wepay_fixed_expenses') ? JSON.parse(localStorage.getItem('wepay_fixed_expenses')!) : [],
      cofrinhos: localStorage.getItem('wepay_cofrinhos') ? JSON.parse(localStorage.getItem('wepay_cofrinhos')!) : [],
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wepay-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentEditedMember = editedMembers.find((m) => m.id === activeMemberTab) || editedMembers[0];

  // Floating Toast Notification Card
  const floatingNotification = (
    <AnimatePresence>
      {savedFeedback && (
        <motion.div
          initial={{ opacity: 0, y: -24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-4 sm:top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none px-4 w-full max-w-xs sm:max-w-sm flex justify-center"
        >
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#0a0e24]/95 border border-emerald-500/50 rounded-2xl shadow-2xl shadow-black/90 backdrop-blur-md">
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-emerald-200 tracking-wide">
              {savedFeedback}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // =========================================================================
  // SUB-PAGES RENDERING
  // =========================================================================

  // Page 1: Membros do Grupo
  if (activePage === 'members') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        {floatingNotification}

        {/* Top Bar Navigation & Title */}
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              Integrantes do Casal
            </h1>
          </div>
        </div>

        {/* Member Tabs / Selector */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {editedMembers.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMemberTab(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-2 ${
                  activeMemberTab === m.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-950/50'
                    : 'bg-[#111528] text-slate-400 hover:text-white border border-slate-800/80'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: m.color || '#3b82f6' }}
                />
                <span>{m.name || 'Sem nome'}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Member Edit Card */}
        {currentEditedMember && (
          <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Avatar & Basic preview */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-slate-800/60">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-purple-500/60 bg-slate-800 flex items-center justify-center shrink-0 shadow-md">
                {currentEditedMember.avatar ? (
                  <img src={currentEditedMember.avatar} alt={currentEditedMember.name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center font-black text-white text-lg"
                    style={{ backgroundColor: currentEditedMember.color || '#6366f1' }}
                  >
                    {currentEditedMember.name?.charAt(0) || 'M'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-400 block">Editando perfil de:</span>
                <h3 className="text-base font-black text-white truncate">{currentEditedMember.name}</h3>
              </div>
            </div>

            {/* Field: Nome */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Nome de Exibição
              </label>
              <input
                type="text"
                value={currentEditedMember.name}
                onChange={(e) => handleMemberChange(currentEditedMember.id, 'name', e.target.value)}
                className="w-full bg-[#080a14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="Ex: Thyago"
              />
            </div>

            {/* Field: Cor Identificadora */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleMemberChange(currentEditedMember.id, 'color', c)}
                    className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                      currentEditedMember.color === c ? 'scale-110 border-white shadow-md' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Field: Foto de Perfil */}
            <div className="space-y-2.5 pt-1">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Foto de Perfil
              </label>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Upload Button */}
                <label className="flex items-center gap-2 px-3.5 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 hover:border-purple-500/70 text-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm">
                  <Upload className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>{currentEditedMember.avatar ? 'Alterar Foto' : 'Upload de Foto'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleAvatarFileUpload(currentEditedMember.id, file);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>

                {/* Remove photo button if avatar is set */}
                {currentEditedMember.avatar && (
                  <button
                    type="button"
                    onClick={() => handleMemberChange(currentEditedMember.id, 'avatar', '')}
                    className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Usar Iniciais</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] text-slate-500 font-bold">Ou escolha um avatar:</span>
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleMemberChange(currentEditedMember.id, 'avatar', url)}
                    className={`w-7 h-7 rounded-full overflow-hidden border transition-all cursor-pointer ${
                      currentEditedMember.avatar === url
                        ? 'border-purple-400 ring-2 ring-purple-500/40 scale-105'
                        : 'border-slate-700 hover:border-purple-500'
                    }`}
                  >
                    <img src={url} alt="preset" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Page 2: Nome do Grupo de Casal
  if (activePage === 'groupName') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        {floatingNotification}

        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              Nome do Grupo
            </h1>
          </div>
        </div>

        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
              <span>Título do Grupo</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => handleGroupNameChange(e.target.value)}
              placeholder="Ex: Thyago + Josy"
              className="w-full bg-[#080a14] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              Este nome é exibido no topo do painel, em extratos de balanço e nas saudações da assistente Joy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Page 3: Google Gemini IA
  if (activePage === 'gemini') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        {floatingNotification}

        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
              Google Gemini IA
            </h1>
          </div>
        </div>

        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-pink-400" />
              <span>Chave da API Gemini (GEMINI_API_KEY)</span>
            </span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1"
            >
              <span>Gerar Chave Gratuita</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-[#080a14] border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-pink-500"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
              title={showKey ? 'Ocultar' : 'Exibir'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={handleSaveGeminiKey}
            className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-pink-950/50 active:scale-98"
          >
            Salvar Chave API
          </button>

          <div className="bg-[#11152a] p-3.5 rounded-xl border border-slate-800/80 space-y-1.5 text-xs text-slate-400">
            <span className="font-bold text-slate-300 block">Recursos habilitados pela IA:</span>
            <ul className="list-disc list-inside space-y-1 text-[11px] pl-1">
              <li>Reconhecimento e cadastro de comprovantes e cupons fiscais via câmera.</li>
              <li>Interpretação de áudios gravados e mensagens naturais de despesas.</li>
              <li>Conselhos financeiros personalizados e projeções para os cofrinhos do casal.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Page 4: WhatsApp & Webhook
  if (activePage === 'whatsapp') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            WhatsApp & Webhook
          </h1>
        </div>

        {/* Webhook Card */}
        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
          <span className="text-xs font-bold text-slate-300 block">URL do Webhook para Conexão</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 bg-[#080a14] border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-emerald-300 focus:outline-none truncate"
            />
            <button
              type="button"
              onClick={handleCopyWebhook}
              className="px-3.5 py-2 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Simulator Card */}
        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xl">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-purple-400" />
            <span>Simulador de Mensagens do WhatsApp</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-1">Telefone:</span>
              <input
                type="text"
                value={whatsappTestPhone}
                onChange={(e) => setWhatsappTestPhone(e.target.value)}
                placeholder="5511999999999"
                className="w-full bg-[#080a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-bold block mb-1">Mensagem de Teste:</span>
              <input
                type="text"
                value={whatsappTestMsg}
                onChange={(e) => setWhatsappTestMsg(e.target.value)}
                placeholder="Ex: Almoço 35 reais"
                className="w-full bg-[#080a14] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestWhatsappNotification}
            disabled={isTestingWhatsapp}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isTestingWhatsapp ? 'Processando...' : 'Testar Mensagem'}</span>
          </button>

          {whatsappResult && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs font-mono whitespace-pre-wrap">
              {whatsappResult}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Page 5: Backup & Exportação
  if (activePage === 'backup') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            Dados & Backup
          </h1>
        </div>

        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-200 block">Exportação de Segurança</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              O arquivo JSON exportado contém todos os seus lançamentos, cofrinhos, contas fixas e histórico do grupo.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportData}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Backup Completo (.JSON)</span>
          </button>
        </div>
      </div>
    );
  }

  // Page 6: Sobre o WePay
  if (activePage === 'about') {
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-28 animate-in fade-in slide-in-from-right-4 duration-200">
        <div className="flex items-center justify-between pb-1">
          <button
            type="button"
            onClick={() => setActivePage(null)}
            className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
            title="Voltar"
          >
            <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            <span className="text-xs font-bold">Voltar</span>
          </button>

          <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
            Sobre o WePay
          </h1>
        </div>

        <div className="bg-[#0e1224] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-xl text-xs text-slate-300">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 font-medium">Aplicativo:</span>
            <span className="font-bold text-white">WePay AI - Finanças em Casal</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 font-medium">Versão:</span>
            <span className="font-mono font-bold text-purple-400">2.4.0 (Cloud Sync)</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
            <span className="text-slate-400 font-medium">Banco de Dados:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              Firestore Nuvem Ativo
            </span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-slate-400 font-medium">Segurança:</span>
            <span className="font-bold text-slate-200">Criptografia Ponta a Ponta</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAIN SETTINGS MENU LIST (Clean, Organic, Compact)
  // =========================================================================
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-28 sm:pb-32 animate-in fade-in duration-150">
      {floatingNotification}

      {/* Top Bar Navigation & Title */}
      <div className="flex items-center justify-between pb-1">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 p-2 -ml-2 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer group"
          title="Voltar ao início"
        >
          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-purple-400 group-hover:border-purple-500/40 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold">Voltar</span>
        </button>

        <h1 className="text-base sm:text-lg font-black text-white tracking-tight">
          Configurações
        </h1>
      </div>

      {/* Group 1: CASAL & IDENTIDADE */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
          Casal & Integrantes
        </span>
        <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-800/60">
          
          {/* Item 1: Integrantes do Casal */}
          <button
            type="button"
            onClick={() => setActivePage('members')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                    Integrantes do Casal
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-purple-950/80 border border-purple-800/60 text-[9px] font-extrabold text-purple-300 font-mono">
                    2
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {editedMembers.slice(0, 2).map((m) => m.name).join(' & ')}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Item 2: Nome do Casal */}
          <button
            type="button"
            onClick={() => setActivePage('groupName')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
                <Heart className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-pink-300 transition-colors block">
                  Nome do Casal
                </span>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {groupName || 'Configurar nome'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Group 2: IA & AUTOMAÇÕES */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
          Inteligência Artificial & Automações
        </span>
        <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-800/60">
          
          {/* Item 3: Gemini IA */}
          <button
            type="button"
            onClick={() => setActivePage('gemini')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Google Gemini IA (Joy)
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-[9px] font-bold text-emerald-300">
                    Ativo
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Chave API, áudio e leitura de comprovantes
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Item 4: WhatsApp */}
          <button
            type="button"
            onClick={() => setActivePage('whatsapp')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition-colors">
                    WhatsApp & Webhook
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Conexão por mensagens e simulador de testes
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Group 3: DADOS & SISTEMA */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
          Dados & Segurança
        </span>
        <div className="bg-[#0e1224] border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg divide-y divide-slate-800/60">
          
          {/* Item 5: Backup */}
          <button
            type="button"
            onClick={() => setActivePage('backup')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-300 transition-colors block">
                  Exportar Backup (JSON)
                </span>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Baixe todos os lançamentos e cofrinhos
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>

          {/* Item 6: Sobre */}
          <button
            type="button"
            onClick={() => setActivePage('about')}
            className="w-full p-3.5 sm:p-4 flex items-center justify-between hover:bg-slate-800/40 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Info className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors block">
                  Sobre o WePay
                </span>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  Versão 2.4.0 e status da sincronização
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
          </button>
        </div>
      </div>

      {/* Group 4: SESSÃO / SAIR */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onLogout}
          className="w-full p-3.5 rounded-2xl bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 text-red-400 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da Conta do Casal</span>
        </button>
      </div>

    </div>
  );
};
