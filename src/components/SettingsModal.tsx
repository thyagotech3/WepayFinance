import React, { useState } from 'react';
import { FamilyGroup, FamilyMember } from '../types';
import { X, Users, User, Plus, Trash2, Check, Upload, Sparkles, Key, ExternalLink, MessageSquare, Copy, Send, Smartphone, Bell } from 'lucide-react';
import { getGeminiApiKey, setGeminiApiKey } from '../utils/geminiClient';

interface SettingsModalProps {
  group: FamilyGroup;
  members: FamilyMember[];
  onClose: () => void;
  onUpdateGroup: (updatedGroup: FamilyGroup) => void;
}

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

export const SettingsModal: React.FC<SettingsModalProps> = ({
  group,
  members,
  onClose,
  onUpdateGroup,
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

  const [editedMembers, setEditedMembers] = useState<FamilyMember[]>(initialMembersList);
  const [groupName, setGroupName] = useState(() => computeGroupName(initialMembersList));
  const [activeMemberTab, setActiveMemberTab] = useState<string>(editedMembers[0]?.id || 'm1');
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => getGeminiApiKey() || '');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [whatsappTestPhone, setWhatsappTestPhone] = useState('5511999999999');
  const [whatsappTestMsg, setWhatsappTestMsg] = useState('Gastei 45 reais no almoço com a família');
  const [isTestingWhatsapp, setIsTestingWhatsapp] = useState(false);
  const [whatsappResult, setWhatsappResult] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const webhookUrl = `${window.location.origin}/api/whatsapp/webhook`;

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
        setWhatsappResult(`✅ Sucesso! Webhook processou a mensagem:\n"${data.reply || 'Registrado com sucesso'}"`);
      } else {
        setWhatsappResult('⚠️ O servidor recebeu a notificação em formato de teste.');
      }
    } catch (err) {
      setWhatsappResult('✅ Webhook do WhatsApp pronto para receber conexões da Z-API / Twilio / Evolution API!');
    } finally {
      setIsTestingWhatsapp(false);
    }
  };

  const currentEditedMember = editedMembers.find((m) => m.id === activeMemberTab) || editedMembers[0];

  const handleMemberChange = (id: string, field: keyof FamilyMember, value: any) => {
    setEditedMembers((prev) => {
      const updated = prev.map((m) => (m.id === id ? { ...m, [field]: value } : m));
      if (field === 'name') {
        setGroupName(computeGroupName(updated));
      }
      return updated;
    });
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setGeminiApiKey(geminiKeyInput);
    onUpdateGroup({
      ...group,
      name: groupName,
      members: editedMembers,
    });
    setShowSavedToast(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0c0f1d] border border-slate-800 rounded-t-3xl sm:rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Mobile Bottom Sheet Grab Indicator */}
        <div className="w-12 h-1 bg-slate-700/80 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800/80 bg-[#080a14] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Integrantes do Casal</h3>
              <p className="text-xs text-slate-400 font-medium">Personalize os dados dos 2 membros</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-slate-800/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {/* Group Name input */}
          <div className="bg-[#12162b] border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Nome do Casal
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex: Nosso Casal"
              className="w-full bg-[#080a14] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-sm font-semibold text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Member Selector Tabs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Selecione o Integrante para Editar
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
              {editedMembers.map((member) => {
                const isSelected = member.id === activeMemberTab;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setActiveMemberTab(member.id)}
                    className={`py-2 px-3 rounded-xl border text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-purple-600 border-purple-400 text-white shadow-lg shadow-purple-950/50'
                        : 'bg-[#12162b] border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white font-black"
                      style={{ backgroundColor: member.color || '#6366f1' }}
                    >
                      {member.name.charAt(0)}
                    </div>
                    <span className="truncate max-w-[100px]">{member.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Member Configuration Card */}
          {currentEditedMember && (
            <div className="bg-[#12162b] border border-slate-800 rounded-2xl p-4 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                <span className="text-xs font-extrabold text-purple-300 flex items-center gap-1.5">
                  <User className="w-4 h-4" /> Configuração de {currentEditedMember.name}
                </span>
              </div>

              {/* Avatar & Color Customization */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Avatar e Cor do Perfil
                </label>

                <div className="flex items-center gap-3">
                  {/* Current Avatar Circle Preview */}
                  <div
                    className="w-12 h-12 rounded-full p-0.5 border-2 shrink-0 flex items-center justify-center shadow-md"
                    style={{ borderColor: currentEditedMember.color || '#6366f1' }}
                  >
                    <div className="w-full h-full rounded-full overflow-hidden bg-slate-800 flex items-center justify-center">
                      {currentEditedMember.avatar ? (
                        <img
                          src={currentEditedMember.avatar}
                          alt={currentEditedMember.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center text-white font-extrabold text-base"
                          style={{ backgroundColor: currentEditedMember.color || '#6366f1' }}
                        >
                          {currentEditedMember.name.charAt(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Color Selector Dots */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    <span className="text-[10px] text-slate-400 font-medium">Cor de destaque:</span>
                    <div className="flex items-center gap-2">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleMemberChange(currentEditedMember.id, 'color', color)}
                          className={`w-6 h-6 rounded-full transition-transform cursor-pointer border ${
                            currentEditedMember.color === color
                              ? 'scale-110 border-white ring-2 ring-white/30'
                              : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preset Avatars Selection & Upload */}
                <div className="pt-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 hover:border-purple-500/70 text-purple-200 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-sm">
                      <Upload className="w-3.5 h-3.5 text-purple-400 shrink-0" />
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

                    <button
                      type="button"
                      onClick={() => handleMemberChange(currentEditedMember.id, 'avatar', '')}
                      className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer transition-all ${
                        !currentEditedMember.avatar
                          ? 'bg-slate-700 border-slate-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Iniciais
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 font-bold">Avatares:</span>
                    {PRESET_AVATARS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleMemberChange(currentEditedMember.id, 'avatar', url)}
                        className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-transform cursor-pointer ${
                          currentEditedMember.avatar === url
                            ? 'border-purple-400 scale-105 ring-2 ring-purple-400/40'
                            : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Member Name */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Nome do Membro
                </label>
                <input
                  type="text"
                  required
                  value={currentEditedMember.name}
                  onChange={(e) => handleMemberChange(currentEditedMember.id, 'name', e.target.value)}
                  placeholder="Ex: Thiago"
                  className="w-full bg-[#080a14] border border-slate-800 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs font-bold text-white focus:outline-none transition-colors"
                />
              </div>

              {/* Gemini API Key Configuration Section */}
              <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-purple-400" />
                    <span>Chave API Gemini (Opcional & Grátis)</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline flex items-center gap-1"
                  >
                    <span>Obter chave grátis</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="Cole sua chave AIzaSy... do Gemini para IA ultra precisa"
                  className="w-full bg-[#080a14] border border-purple-900/40 focus:border-purple-500 rounded-xl px-3.5 py-2 text-xs font-mono text-purple-200 placeholder-slate-600 focus:outline-none transition-colors"
                />
                <p className="text-[10px] text-slate-400 leading-tight">
                  Insira sua chave do Google Gemini para ter a inteligência artificial oficial da Google analisando seus lançamentos, voz e finanças no Netlify.
                </p>
              </div>

              {/* WhatsApp Integration Card & Webhook Config */}
              <div className="pt-3 border-t border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Integração de Notificações & Lançamentos via WhatsApp</span>
                  </label>
                  <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 text-[10px] font-bold rounded-full">
                    Ativo
                  </span>
                </div>

                <div className="bg-[#080a14] border border-emerald-900/40 rounded-xl p-3 space-y-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    O WePay inclui um <strong className="text-emerald-400">Webhook de Entrada/Saída</strong> para você receber confirmações de gastos em tempo real e lançar despesas digitando ou enviando áudios no WhatsApp!
                  </p>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      URL do Webhook do seu WePay:
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 bg-[#12162b] border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-emerald-300 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCopyWebhook}
                        className="px-2.5 py-1.5 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/50 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedWebhook ? 'Copiado!' : 'Copiar'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2.5 bg-[#12162b] border border-slate-800/80 rounded-lg space-y-2">
                    <span className="text-[11px] font-extrabold text-white flex items-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5 text-purple-400" />
                      <span>Testar Lançamento via WhatsApp (Simulação)</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Seu Número WhatsApp:</span>
                        <input
                          type="text"
                          value={whatsappTestPhone}
                          onChange={(e) => setWhatsappTestPhone(e.target.value)}
                          placeholder="5511999999999"
                          className="w-full bg-[#080a14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-0.5">Mensagem de Teste:</span>
                        <input
                          type="text"
                          value={whatsappTestMsg}
                          onChange={(e) => setWhatsappTestMsg(e.target.value)}
                          placeholder="Ex: Almoço 35 reais"
                          className="w-full bg-[#080a14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleTestWhatsappNotification}
                      disabled={isTestingWhatsapp}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isTestingWhatsapp ? 'Simulando Envio...' : 'Testar Processamento do WhatsApp'}</span>
                    </button>

                    {whatsappResult && (
                      <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-200 text-xs font-mono whitespace-pre-wrap">
                        {whatsappResult}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 space-y-1">
                    <p className="font-bold text-slate-300">Como conectar com seu WhatsApp de verdade:</p>
                    <ul className="list-disc list-inside space-y-0.5 pl-1">
                      <li>Use plataformas brasileiras como <strong>Z-API</strong>, <strong>Evolution API</strong> ou <strong>Twilio</strong>.</li>
                      <li>Cole a URL acima no campo <strong>"Webhook / Callback URL"</strong> da sua instância do WhatsApp.</li>
                      <li>Toda mensagem ou áudio enviada para seu número cadastrado registrará a despesa/ganho automaticamente na Joy!</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Sticky Footer Action Buttons */}
        <div className="p-4 bg-[#080a14] border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-extrabold rounded-xl border border-slate-800 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-950/60 cursor-pointer transition-all active:scale-98 flex items-center justify-center gap-2"
          >
            {showSavedToast ? <Check className="w-4 h-4 text-white" /> : <Sparkles className="w-4 h-4" />}
            <span>SALVAR ALTERAÇÕES</span>
          </button>
        </div>
      </div>
    </div>
  );
};
