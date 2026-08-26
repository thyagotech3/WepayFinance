import React, { useState, useRef, useEffect } from 'react';
import { FamilyMember, Transaction, ReceiptItem, MercadoDetails } from '../types';
import { formatMemberName } from '../utils/incomeUtils';
import { 
  Camera, Upload, Plus, Trash2, X, Check, Sparkles, ArrowRight,
  ShoppingCart, AlertCircle, RefreshCw, Layers, Calendar, CreditCard,
  CheckCircle2, Store, FileText, ChevronRight, PieChart, AlertTriangle,
  HelpCircle, Calculator, RefreshCcw, Info, Edit3, Key, Image as ImageIcon
} from 'lucide-react';
import { processAndEnhanceReceiptImage } from '../utils/receiptImageProcessor';
import { parseReceiptWithGeminiDirect } from '../utils/geminiClient';

interface MercadoModalProps {
  members: FamilyMember[];
  currentMember: FamilyMember;
  onClose: () => void;
  onSave?: (tx: Omit<Transaction, 'id' | 'date'> & { date?: string }) => void;
  onSaveMercadoTransaction?: (tx: Omit<Transaction, 'id' | 'date'> & { date?: string }) => void;
  onOpenRaioX?: (tx: Transaction) => void;
}

export const MERCADO_CATEGORIES = [
  { name: 'Hortifrúti', color: '#10b981', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  { name: 'Carnes & Aves', color: '#f43f5e', bg: 'bg-rose-500/15', text: 'text-rose-300', border: 'border-rose-500/30' },
  { name: 'Laticínios & Queijos', color: '#f59e0b', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30' },
  { name: 'Mercearia', color: '#3b82f6', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30' },
  { name: 'Bebidas', color: '#a855f7', bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30' },
  { name: 'Padaria & Confeitaria', color: '#fb923c', bg: 'bg-orange-500/15', text: 'text-orange-300', border: 'border-orange-500/30' },
  { name: 'Limpeza', color: '#06b6d4', bg: 'bg-cyan-500/15', text: 'text-cyan-300', border: 'border-cyan-500/30' },
  { name: 'Higiene & Cuidados', color: '#ec4899', bg: 'bg-pink-500/15', text: 'text-pink-300', border: 'border-pink-500/30' },
  { name: 'Congelados', color: '#38bdf8', bg: 'bg-sky-500/15', text: 'text-sky-300', border: 'border-sky-500/30' },
  { name: 'Pet Shop', color: '#8b5cf6', bg: 'bg-violet-500/15', text: 'text-violet-300', border: 'border-violet-500/30' },
  { name: 'Outros', color: '#94a3b8', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-500/30' },
];

export const getCategoryBadge = (catName?: string) => {
  const found = MERCADO_CATEGORIES.find(c => c.name.toLowerCase() === (catName || '').toLowerCase());
  return found || MERCADO_CATEGORIES[MERCADO_CATEGORIES.length - 1];
};

export interface AuditData {
  isConsistent: boolean;
  itemsCount: number;
  sumOfItems: number;
  receiptTotal: number;
  totalDifference: number;
  hasTotalMismatch: boolean;
  itemsWithWarningCount: number;
  inconsistencies: string[];
}

export const MercadoModal: React.FC<MercadoModalProps> = ({
  members,
  currentMember,
  onClose,
  onSave,
  onSaveMercadoTransaction,
  onOpenRaioX,
}) => {
  // Step state: 'choose' | 'scanning' | 'review' | 'success'
  const [step, setStep] = useState<'choose' | 'scanning' | 'review' | 'success'>('choose');
  const [scanMessage, setScanMessage] = useState<string>('Otimizando imagem do cupom...');
  const [scanProgress, setScanProgress] = useState<number>(10);
  const [scanCurrentModel, setScanCurrentModel] = useState<string>('gemini-3.7-flash');
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Form & Items state
  const [storeName, setStoreName] = useState<string>('Supermercado');
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paidByMemberId, setPaidByMemberId] = useState<string>(currentMember.id);
  const [splitType, setSplitType] = useState<'equal' | 'individual'>('equal');
  const [paymentMethod, setPaymentMethod] = useState<string>('Cartão de Crédito');
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [receiptPrintedTotal, setReceiptPrintedTotal] = useState<number | null>(null);

  // AI Audit feedback state
  const [auditData, setAuditData] = useState<AuditData | null>(null);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Newly created transaction for the success modal
  const [savedTx, setSavedTx] = useState<Transaction | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Calculate sum of items
  const itemsTotal = Number(items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0).toFixed(2));

  // Safeguard: auto-timeout if scanning takes more than 60 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'scanning') {
      timer = setTimeout(() => {
        setScanError('A leitura levou mais tempo que o esperado. Os campos estão abertos para conferência e preenchimento.');
        if (items.length === 0) {
          setItems([
            { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
          ]);
        }
        setStep('review');
        setShowAuditModal(false);
      }, 60000);
    }
    return () => clearTimeout(timer);
  }, [step, items.length]);

  // Handle Image Selection & AI Processing (Vision OCR)
  const handleProcessImage = async (file: File) => {
    try {
      setStep('scanning');
      setScanError(null);
      setScanProgress(15);
      setScanCurrentModel('gemini-3.7-flash');
      setScanLogs(['Carregando arquivo de imagem...']);
      setScanMessage('Analisando nitidez e iluminação da foto...');

      // 1. High-precision client-side enhancement for Thermal Receipt OCR
      setScanProgress(30);
      setScanMessage('Aumentando contraste e preparando cupom para IA...');
      setScanLogs((prev) => [...prev, 'Otimizando resolução e aplicando contraste para cupom térmico...']);
      const { base64DataUrl, rawBase64, mimeType } = await processAndEnhanceReceiptImage(file);
      if (base64DataUrl) {
        setReceiptImage(base64DataUrl);
      }

      setScanProgress(45);
      setScanMessage('Enviando para leitura neural e extração de itens...');
      setScanLogs((prev) => [...prev, 'Enviando imagem compactada para análise multimodal...']);

      // 2. Fetch with 55-second timeout for thorough OCR
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 55000);

      try {
        const response = await fetch('/api/ai/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            imageBase64: rawBase64,
            mimeType,
            memberNames: members.map((m) => m.name),
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setScanProgress(100);
            setScanLogs((prev) => [...prev, 'Itens extraídos e validados com sucesso pelo servidor.']);
            const data = result.data;
            if (data.storeName) setStoreName(data.storeName);
            if (data.purchaseDate) setPurchaseDate(data.purchaseDate);
            if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
            if (data.totalAmount) setReceiptPrintedTotal(Number(data.totalAmount));

            if (result.apiKeyMissing) {
              setScanError('Chave GEMINI_API_KEY não configurada no ambiente. Você pode preencher ou conferir os itens manualmente.');
            } else if (result.isFallback) {
              setScanError(result.errorMessage ? `Aviso de leitura: ${result.errorMessage}. Confira os itens abaixo.` : 'Modo assistido ativado: O cupom foi pré-carregado para você conferir ou ajustar os itens antes de salvar.');
            } else {
              setScanError(null);
            }

            if (Array.isArray(data.items) && data.items.length > 0) {
              const loadedItems: ReceiptItem[] = data.items.map((it: any, index: number) => {
                const quantity = Number(it.quantity) || 1;
                const unitPrice = Number(it.unitPrice) || 0;
                const totalPrice = Number(it.totalPrice) || Number((quantity * unitPrice).toFixed(2)) || 0;
                const expectedTotal = Number((quantity * unitPrice).toFixed(2));
                const hasCalculationMismatch = unitPrice > 0 && quantity > 0 && Math.abs(expectedTotal - totalPrice) > 0.05;

                return {
                  id: `item-${Date.now()}-${index}-${it.id || 'it'}`,
                  name: it.name || `Produto ${index + 1}`,
                  quantity,
                  unitPrice,
                  totalPrice,
                  category: it.category || 'Mercearia',
                  hasCalculationMismatch,
                  mismatchNote: hasCalculationMismatch 
                    ? `Qtd (${quantity}) × Preço (R$ ${unitPrice.toFixed(2)}) = R$ ${expectedTotal.toFixed(2)}, diferente do total na nota (R$ ${totalPrice.toFixed(2)})`
                    : undefined,
                };
              });

              setItems(loadedItems);
            } else {
              setItems([
                { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
              ]);
            }

            if (data.audit && !result.isFallback && !result.apiKeyMissing) {
              setAuditData(data.audit);
              setShowAuditModal(true);
            } else {
              setShowAuditModal(false);
            }
            setStep('review');
            return;
          }
        }

        // Direct client-side Gemini fallback if server returned non-ok or error
        setScanLogs((prev) => [...prev, 'Servidor indisponível. Acionando IA direta no navegador...']);
        const directResult = await parseReceiptWithGeminiDirect(rawBase64, mimeType, (info) => {
          setScanMessage(info.status);
          setScanProgress(info.progress);
          if (info.currentModel) setScanCurrentModel(info.currentModel);
          if (info.log) setScanLogs((prev) => [...prev, info.log!]);
        });

        if (directResult && Array.isArray(directResult.items) && directResult.items.length > 0) {
          setScanProgress(100);
          setScanLogs((prev) => [...prev, 'Leitura concluída com sucesso!']);
          if (directResult.storeName) setStoreName(directResult.storeName);
          if (directResult.purchaseDate) setPurchaseDate(directResult.purchaseDate);
          if (directResult.paymentMethod) setPaymentMethod(directResult.paymentMethod);
          if (directResult.totalAmount) setReceiptPrintedTotal(Number(directResult.totalAmount));

          const loadedItems: ReceiptItem[] = directResult.items.map((it: any, index: number) => {
            const quantity = Number(it.quantity) || 1;
            const unitPrice = Number(it.unitPrice) || 0;
            const totalPrice = Number(it.totalPrice) || Number((quantity * unitPrice).toFixed(2)) || 0;
            const expectedTotal = Number((quantity * unitPrice).toFixed(2));
            const hasCalculationMismatch = unitPrice > 0 && quantity > 0 && Math.abs(expectedTotal - totalPrice) > 0.05;

            return {
              id: `item-${Date.now()}-${index}-${it.id || 'it'}`,
              name: it.name || `Produto ${index + 1}`,
              quantity,
              unitPrice,
              totalPrice,
              category: it.category || 'Mercearia',
              hasCalculationMismatch,
            };
          });

          setItems(loadedItems);
          setScanError(null);
          setShowAuditModal(false);
          setStep('review');
          return;
        }

        // If both failed, provide fallback
        setScanError('Não foi possível ler todos os dados automaticamente. Os campos foram liberados para ajuste manual.');
        setItems([
          { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
        ]);
        setShowAuditModal(false);
        setStep('review');
      } catch (fetchErr: any) {
        setScanLogs((prev) => [...prev, 'Servidor em espera. Acionando IA direta no navegador...']);
        const directResult = await parseReceiptWithGeminiDirect(rawBase64, mimeType, (info) => {
          setScanMessage(info.status);
          setScanProgress(info.progress);
          if (info.currentModel) setScanCurrentModel(info.currentModel);
          if (info.log) setScanLogs((prev) => [...prev, info.log!]);
        });

        if (directResult && Array.isArray(directResult.items) && directResult.items.length > 0) {
          setScanProgress(100);
          setScanLogs((prev) => [...prev, 'Itens extraídos e categorizados com sucesso!']);
          if (directResult.storeName) setStoreName(directResult.storeName);
          if (directResult.purchaseDate) setPurchaseDate(directResult.purchaseDate);
          if (directResult.paymentMethod) setPaymentMethod(directResult.paymentMethod);
          if (directResult.totalAmount) setReceiptPrintedTotal(Number(directResult.totalAmount));

          const loadedItems: ReceiptItem[] = directResult.items.map((it: any, index: number) => {
            const quantity = Number(it.quantity) || 1;
            const unitPrice = Number(it.unitPrice) || 0;
            const totalPrice = Number(it.totalPrice) || Number((quantity * unitPrice).toFixed(2)) || 0;

            return {
              id: it.id || `item-${Date.now()}-${index}`,
              name: it.name || `Produto ${index + 1}`,
              quantity,
              unitPrice,
              totalPrice,
              category: it.category || 'Mercearia',
            };
          });

          setItems(loadedItems);
          setScanError(null);
          setShowAuditModal(false);
          setStep('review');
        } else {
          setScanError(fetchErr?.name === 'AbortError' 
            ? 'Tempo de resposta da IA excedido. Os campos foram liberados para você conferir ou preencher.' 
            : 'Falha na conexão com o serviço de IA. Os campos foram liberados para ajuste manual.'
          );
          setItems([
            { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
          ]);
          setShowAuditModal(false);
          setStep('review');
        }
      }
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      setScanError('Erro ao abrir o arquivo da foto.');
      setItems([
        { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
      ]);
      setShowAuditModal(false);
      setStep('review');
    }
  };

  // Start Manual Mode
  const handleStartManual = () => {
    setStoreName('Supermercado');
    setItems([
      { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
    ]);
    setAuditData(null);
    setScanError(null);
    setReceiptPrintedTotal(null);
    setStep('review');
  };

  // Item list editing helpers
  const handleUpdateItem = (id: string, field: keyof ReceiptItem, value: any) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;

      const updated = { ...item, [field]: value };
      
      const qty = field === 'quantity' ? Number(value) : Number(item.quantity);
      const price = field === 'unitPrice' ? Number(value) : Number(item.unitPrice);
      const total = field === 'totalPrice' ? Number(value) : Number(item.totalPrice);

      // If user altered quantity or unitPrice, calculate expected total and check mismatch
      if (field === 'quantity' || field === 'unitPrice') {
        if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
          const autoTotal = Number((qty * price).toFixed(2));
          updated.totalPrice = autoTotal;
          updated.hasCalculationMismatch = false;
          updated.mismatchNote = undefined;
        }
      } else if (field === 'totalPrice') {
        if (!isNaN(total) && !isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
          const expected = Number((qty * price).toFixed(2));
          const diff = Math.abs(expected - total);
          updated.hasCalculationMismatch = diff > 0.05;
          updated.mismatchNote = updated.hasCalculationMismatch 
            ? `Qtd (${qty}) × Preço (R$ ${price.toFixed(2)}) = R$ ${expected.toFixed(2)}, diferente do total informado (R$ ${total.toFixed(2)})`
            : undefined;
        }
      }

      return updated;
    }));
  };

  // Quick fix: recalculate single item total from qty * unitPrice
  const handleRecalculateItemTotal = (id: string) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== id) return it;
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unitPrice) || 0;
      const correctedTotal = Number((qty * unit).toFixed(2));
      return {
        ...it,
        totalPrice: correctedTotal,
        hasCalculationMismatch: false,
        mismatchNote: undefined,
      };
    }));
  };

  // Quick fix: recalculate ALL items
  const handleRecalculateAllItems = () => {
    setItems((prev) => prev.map((it) => {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unitPrice) || 0;
      const correctedTotal = Number((qty * unit).toFixed(2));
      return {
        ...it,
        totalPrice: correctedTotal,
        hasCalculationMismatch: false,
        mismatchNote: undefined,
      };
    }));
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: `item-${Date.now()}-${items.length + 1}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      category: 'Mercearia',
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      setItems([{ id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }]);
      return;
    }
    setItems((prev) => prev.filter(it => it.id !== id));
  };

  // Count items with calculation warning
  const itemsWithWarningCount = items.filter((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice) || 0;
    const tot = Number(it.totalPrice) || 0;
    return qty > 0 && price > 0 && Math.abs((qty * price) - tot) > 0.05;
  }).length;

  const hasTotalReceiptDiff = receiptPrintedTotal !== null && Math.abs(itemsTotal - receiptPrintedTotal) > 0.10;
  const totalDiffAmount = receiptPrintedTotal !== null ? Number(Math.abs(itemsTotal - receiptPrintedTotal).toFixed(2)) : 0;

  // Save Transaction
  const handleSave = () => {
    try {
      const validItems = items.filter(it => it.name.trim() !== '' || it.totalPrice > 0);
      const finalAmount = itemsTotal > 0 ? Number(itemsTotal.toFixed(2)) : 0;

      if (finalAmount <= 0) {
        alert('Por favor, informe ao menos um item com valor maior que zero.');
        return;
      }

      const cleanStoreName = storeName.trim() || 'Supermercado';

      // Parse and normalize date safely without throwing RangeError
      let safeIsoDate = new Date().toISOString();
      let cleanPurchaseDate = (purchaseDate || '').trim();

      if (cleanPurchaseDate) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanPurchaseDate)) {
          const parsed = new Date(`${cleanPurchaseDate}T12:00:00`);
          if (!isNaN(parsed.getTime())) {
            safeIsoDate = parsed.toISOString();
          }
        } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanPurchaseDate)) {
          const [d, m, y] = cleanPurchaseDate.split('/');
          const parsed = new Date(`${y}-${m}-${d}T12:00:00`);
          if (!isNaN(parsed.getTime())) {
            safeIsoDate = parsed.toISOString();
            cleanPurchaseDate = `${y}-${m}-${d}`;
          }
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(cleanPurchaseDate)) {
          const [d, m, y] = cleanPurchaseDate.split('-');
          const parsed = new Date(`${y}-${m}-${d}T12:00:00`);
          if (!isNaN(parsed.getTime())) {
            safeIsoDate = parsed.toISOString();
            cleanPurchaseDate = `${y}-${m}-${d}`;
          }
        } else {
          const parsed = new Date(cleanPurchaseDate);
          if (!isNaN(parsed.getTime())) {
            safeIsoDate = parsed.toISOString();
            cleanPurchaseDate = parsed.toISOString().split('T')[0];
          } else {
            cleanPurchaseDate = new Date().toISOString().split('T')[0];
          }
        }
      } else {
        cleanPurchaseDate = new Date().toISOString().split('T')[0];
      }

      const mercadoDetails: MercadoDetails = {
        storeName: cleanStoreName,
        purchaseDate: cleanPurchaseDate,
        totalAmount: finalAmount,
        paymentMethod,
        receiptTotalPrinted: receiptPrintedTotal || undefined,
        isAuditConsistent: itemsWithWarningCount === 0 && !hasTotalReceiptDiff,
        items: validItems.length > 0 ? validItems : [{
          id: `item-${Date.now()}`,
          name: cleanStoreName,
          quantity: 1,
          unitPrice: finalAmount,
          totalPrice: finalAmount,
          category: 'Mercearia',
        }],
        receiptImageUrl: receiptImage || undefined,
        notes: notes.trim() || undefined,
      };

      const newTxPayload = {
        description: `🛒 ${cleanStoreName}`,
        amount: finalAmount,
        category: 'Alimentação' as const,
        categoryIcon: 'ShoppingCart',
        type: 'expense' as const,
        paidByMemberId,
        splitType,
        date: safeIsoDate,
        notes: notes.trim() || `Compra detalhada com ${mercadoDetails.items.length} itens`,
        aiCategorized: true,
        mercadoDetails,
      };

      if (onSaveMercadoTransaction) {
        onSaveMercadoTransaction(newTxPayload);
      } else if (onSave) {
        onSave(newTxPayload);
      }

      const completeTx: Transaction = {
        ...newTxPayload,
        id: `tx-${Date.now()}`,
        status: 'active',
      };

      setSavedTx(completeTx);
      setStep('success');
    } catch (err) {
      console.error('Erro ao salvar cupom de mercado:', err);
      alert('Ocorreu um erro ao salvar o cupom. Verifique os dados e tente novamente.');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[90] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b0f24] border border-purple-500/40 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scaleUp relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hidden inputs for camera capture & file upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessImage(e.target.files[0]);
            }
          }}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleProcessImage(e.target.files[0]);
            }
          }}
        />

        {/* Modal Top Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800/90 bg-gradient-to-r from-[#111736] via-[#101b38] to-[#15122e] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-950/50 shrink-0">
              <div className="w-full h-full bg-[#0d1329] rounded-[14px] flex items-center justify-center text-emerald-400">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-tight leading-tight">
                  Lançamento de Mercado
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[9px] font-black uppercase tracking-wider">
                  OCR & IA
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Analisa foto do cupom fiscal, valida quantidades, preços e total da compra
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================= STEP 1: CHOOSE ENTRY METHOD (PHOTO UPLOAD / CAMERA) ================= */}
        {step === 'choose' && (
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-left">
            <div className="text-center max-w-md mx-auto space-y-1">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block">
                Leitura Inteligente de Cupom Fiscal
              </span>
              <h4 className="text-lg sm:text-xl font-black text-white">
                Como deseja lançar o cupom?
              </h4>
              <p className="text-xs text-slate-400">
                A IA analisa a foto do cupom, extrai a lista de produtos, quantidades e preços unitários.
              </p>
            </div>

            {/* Main Action Cards: Camera & Gallery Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              {/* Option 1: Tirar Foto com Câmera */}
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="p-5 rounded-2xl bg-gradient-to-b from-[#0f2c25] via-[#0d2121] to-[#091419] border-2 border-emerald-500/60 hover:border-emerald-400 transition-all cursor-pointer group shadow-2xl hover:scale-[1.02] flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-300" />
                  <span>Câmera</span>
                </div>

                <div className="space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/25 border border-emerald-400/50 text-emerald-300 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm sm:text-base font-black text-white group-hover:text-emerald-300 transition-colors">
                      Tirar Foto do Cupom
                    </h5>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Abra a câmera do celular ou notebook e capture a foto da nota esticada.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-emerald-900/50">
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Abrir Câmera
                  </span>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Option 2: Upload de Foto da Galeria / Arquivo */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl bg-gradient-to-b from-[#131d3d] via-[#101733] to-[#0d1226] border-2 border-blue-500/50 hover:border-blue-400 transition-all cursor-pointer group shadow-2xl hover:scale-[1.02] flex flex-col justify-between space-y-3 relative overflow-hidden"
              >
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-blue-500/25 border border-blue-400/40 text-blue-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                  <ImageIcon className="w-3 h-3 text-blue-300" />
                  <span>Galeria</span>
                </div>

                <div className="space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/25 border border-blue-400/50 text-blue-300 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <h5 className="text-sm sm:text-base font-black text-white group-hover:text-blue-300 transition-colors">
                      Enviar Foto Salva
                    </h5>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Escolha uma foto ou imagem de cupom fiscal salva na galeria ou nos arquivos.
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-blue-900/50">
                  <span className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Selecionar Arquivo
                  </span>
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:translate-x-1 transition-transform">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleProcessImage(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center flex flex-col items-center justify-center gap-1.5 ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-500/10 scale-[1.01]'
                  : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/70'
              }`}
            >
              <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-300">
                Arraste a foto do cupom fiscal aqui
              </p>
              <p className="text-[11px] text-slate-500">
                Formatos aceitos: JPG, PNG, WEBP ou HEIC de qualquer tamanho
              </p>
            </div>

            {/* Tips & Manual Fallback */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Dica: Mantenha a nota reta e bem iluminada para leitura 100% precisa.</span>
              </div>
              <button
                type="button"
                onClick={handleStartManual}
                className="text-purple-400 hover:text-purple-300 font-bold hover:underline flex items-center gap-1.5 shrink-0 cursor-pointer text-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Preencher Itens Manualmente</span>
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: SCANNING / IA PROGRESS ANIMATION ================= */}
        {step === 'scanning' && (
          <div className="p-6 sm:p-10 flex flex-col items-center justify-center space-y-5 text-center flex-1 max-w-md mx-auto w-full">
            <div className="relative w-28 h-36 rounded-2xl bg-slate-900 border-2 border-emerald-500/50 p-2 overflow-hidden shadow-2xl shadow-emerald-950/80 flex flex-col justify-between">
              {receiptImage ? (
                <img src={receiptImage} alt="Cupom" className="w-full h-full object-cover rounded-lg opacity-40 blur-[0.5px]" />
              ) : (
                <div className="w-full h-full bg-slate-800/80 rounded-lg flex items-center justify-center">
                  <FileText className="w-8 h-8 text-slate-600" />
                </div>
              )}
              
              {/* Laser scanning line animation */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-lg shadow-emerald-400 animate-scanLine" />
            </div>

            {/* Model Badge */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-800 text-[11px] font-bold text-slate-300 shadow-inner">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Modelo:</span>
              <span className="text-emerald-400 font-mono font-black">{scanCurrentModel}</span>
            </div>

            {/* Progress Bar & Percentage */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Processando Leitura</span>
                </span>
                <span className="font-mono text-emerald-400 text-sm font-black">{scanProgress}%</span>
              </div>

              <div className="w-full h-2.5 bg-slate-950/80 rounded-full border border-slate-800 overflow-hidden p-0.5 shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${Math.min(scanProgress, 100)}%` }}
                />
              </div>

              <p className="text-xs text-slate-300 font-semibold pt-1">
                {scanMessage}
              </p>
            </div>

            {/* Live Logs Stream */}
            {scanLogs.length > 0 && (
              <div className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-left space-y-1 max-h-24 overflow-y-auto">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Etapas em Tempo Real:
                </p>
                {scanLogs.map((log, index) => (
                  <div key={index} className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <span className="text-emerald-500 font-bold">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                if (items.length === 0) {
                  setItems([
                    { id: `item-${Date.now()}-1`, name: '', quantity: 1, unitPrice: 0, totalPrice: 0, category: 'Mercearia' }
                  ]);
                }
                setStep('review');
              }}
              className="px-4 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Pular espera e preencher manualmente</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ================= STEP 3: REVIEW / CONFERÊNCIA & EDIÇÃO ================= */}
        {step === 'review' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden text-left">
            {/* Scrollable Content: Top Info + Items Table */}
            <div className="p-3 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              
              {/* Audit / Consistency Alert Banner (if scan completed) */}
              {(auditData || scanError || itemsWithWarningCount > 0 || hasTotalReceiptDiff) && (
                <div className={`p-3 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                  scanError
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : itemsWithWarningCount > 0 || hasTotalReceiptDiff
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                }`}>
                  <div className="flex items-start gap-2.5">
                    {scanError ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : itemsWithWarningCount > 0 || hasTotalReceiptDiff ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="font-black block text-xs">
                        {scanError 
                          ? 'Aviso de Leitura'
                          : itemsWithWarningCount > 0 || hasTotalReceiptDiff
                          ? `Atenção: ${itemsWithWarningCount > 0 ? `${itemsWithWarningCount} item(ns) com cálculo divergente` : ''}${itemsWithWarningCount > 0 && hasTotalReceiptDiff ? ' e ' : ''}${hasTotalReceiptDiff ? `diferença de R$ ${totalDiffAmount.toFixed(2)} no total` : ''}`
                          : 'Leitura e Cálculos 100% Consistentes'}
                      </span>
                      <p className="text-[11px] opacity-90 mt-0.5">
                        {scanError 
                          ? scanError
                          : itemsWithWarningCount > 0 || hasTotalReceiptDiff
                          ? 'Confira os itens destacados em alerta abaixo antes de salvar.'
                          : 'Todos os produtos, quantidades, preços unitários e a soma total conferem com o cupom.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {itemsWithWarningCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRecalculateAllItems}
                        className="px-2.5 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Recalcular Total = Qtd × Preço Unitário para todos os itens"
                      >
                        <Calculator className="w-3 h-3" />
                        <span>Recalcular Todos</span>
                      </button>
                    )}
                    {auditData && (
                      <button
                        type="button"
                        onClick={() => setShowAuditModal(true)}
                        className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Ver Detalhes
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Top Row: Store Name, Date & Payment Method */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[#0f142c] border border-slate-800 rounded-2xl p-3">
                {/* 1. Nome do Mercado */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Store className="w-3 h-3 text-emerald-400" /> Estabelecimento
                  </label>
                  <input
                    type="text"
                    required
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Ex: Supermercado Guanabara"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm font-bold text-white focus:outline-none transition-colors"
                  />
                </div>

                {/* 2. Data da Compra */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-purple-400" /> Data da Compra
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors cursor-pointer"
                  />
                </div>

                {/* 3. Forma de Pagamento */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-amber-400" /> Pagamento
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="PIX">PIX</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="VR / VA Alimentação">VR / VA Alimentação</option>
                  </select>
                </div>
              </div>

              {/* Middle Row: Quem Pagou & Divisão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#0f142c] border border-slate-800 rounded-2xl p-3">
                {/* Quem Pagou */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Quem Pagou
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {members.slice(0, 2).map((m) => {
                      const isSelected = paidByMemberId === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaidByMemberId(m.id)}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer capitalize ${
                            isSelected
                              ? 'bg-purple-950/80 border-purple-500 text-white shadow-md'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: m.color || '#a855f7' }}
                          />
                          <span className="truncate">{formatMemberName(m.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divisão */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Divisão da Compra
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSplitType('equal')}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        splitType === 'equal'
                          ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>50/50 Casal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitType('individual')}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        splitType === 'individual'
                          ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-md'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span>Individual</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Items List Section Header */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                    Itens da Compra ({items.length})
                  </h4>
                  {itemsWithWarningCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {itemsWithWarningCount} para conferir
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Tirar nova foto do cupom"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Tirar Foto</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Enviar foto da galeria"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Galeria</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Item</span>
                  </button>
                </div>
              </div>

              {/* Items Table / Row by Row Editor */}
              <div className="space-y-2.5">
                {items.map((item, idx) => {
                  const badge = getCategoryBadge(item.category);
                  const qty = Number(item.quantity) || 0;
                  const price = Number(item.unitPrice) || 0;
                  const tot = Number(item.totalPrice) || 0;
                  const expectedTotal = Number((qty * price).toFixed(2));
                  const isCalculationMismatch = qty > 0 && price > 0 && Math.abs(expectedTotal - tot) > 0.05;

                  return (
                    <div 
                      key={`${item.id}-${idx}`}
                      className={`p-3 rounded-2xl transition-all shadow-sm space-y-2.5 ${
                        isCalculationMismatch 
                          ? 'bg-[#181525] border-2 border-amber-500/60 shadow-amber-950/20' 
                          : 'bg-[#0e1329] border border-slate-800/90 hover:border-slate-700'
                      }`}
                    >
                      {/* Top line: Index, Product Name, Category & Delete */}
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                          isCalculationMismatch ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-900 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>

                        {/* Product Name Input */}
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                            placeholder="Nome do produto (ex: Arroz Tipo 1 5kg)"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl px-2.5 py-1.5 text-xs sm:text-sm text-white font-semibold focus:outline-none"
                          />
                        </div>

                        {/* Category Dropdown */}
                        <select
                          value={item.category || 'Mercearia'}
                          onChange={(e) => handleUpdateItem(item.id, 'category', e.target.value)}
                          className={`text-[11px] font-bold rounded-xl px-2 py-1.5 border ${badge.bg} ${badge.text} ${badge.border} focus:outline-none cursor-pointer max-w-[125px] sm:max-w-[155px] truncate`}
                        >
                          {MERCADO_CATEGORIES.map((cat) => (
                            <option key={cat.name} value={cat.name} className="bg-slate-900 text-white">
                              {cat.name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                          title="Remover item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Bottom line: Qtd / Peso, Preço (Un/Kg), Total */}
                      <div className="grid grid-cols-3 gap-2 pl-7">
                        {/* 1. Qtd / Peso */}
                        <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-2 py-1 space-y-0.5">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">
                            Qtd / Peso
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                            placeholder="1"
                            className="w-full bg-transparent text-white font-mono font-bold focus:outline-none text-xs"
                          />
                        </div>

                        {/* 2. Preço (Unidade ou Kg) */}
                        <div className="bg-slate-950 border border-slate-800/80 rounded-xl px-2 py-1 space-y-0.5">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-tight block">
                            Preço (Un/Kg)
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 font-bold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unitPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                              placeholder="0,00"
                              className="w-full bg-transparent text-white font-mono font-bold focus:outline-none text-xs"
                            />
                          </div>
                        </div>

                        {/* 3. Total do Item */}
                        <div className={`bg-slate-950 border rounded-xl px-2 py-1 space-y-0.5 ${
                          isCalculationMismatch ? 'border-amber-500/60 bg-amber-950/20' : 'border-emerald-500/30'
                        }`}>
                          <label className={`text-[9px] font-bold uppercase tracking-tight block flex items-center justify-between ${
                            isCalculationMismatch ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            <span>Total Item</span>
                            {isCalculationMismatch && <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />}
                          </label>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-emerald-500 font-bold">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.totalPrice}
                              onChange={(e) => handleUpdateItem(item.id, 'totalPrice', e.target.value)}
                              placeholder="0,00"
                              className={`w-full bg-transparent font-mono font-black focus:outline-none text-xs ${
                                isCalculationMismatch ? 'text-amber-300' : 'text-emerald-300'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Calculation Mismatch Warning Bar for this Item */}
                      {isCalculationMismatch && (
                        <div className="ml-7 p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>
                              Cálculo: <strong>{qty} × R$ {price.toFixed(2)} = R$ {expectedTotal.toFixed(2)}</strong> (na nota está R$ {tot.toFixed(2)})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRecalculateItemTotal(item.id)}
                            className="px-2 py-0.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/40 text-amber-100 font-bold text-[10px] transition-all cursor-pointer shrink-0"
                          >
                            Ajustar para R$ {expectedTotal.toFixed(2)}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add item button at bottom */}
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800/90 border border-dashed border-slate-700 hover:border-emerald-500/50 text-slate-300 hover:text-emerald-300 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Adicionar Mais um Item</span>
              </button>
            </div>

            {/* Sticky Bottom Summary Bar & Save Button */}
            <div className="p-3 sm:p-4 bg-[#090d1f] border-t border-slate-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight block">
                      Total da Compra ({items.length} itens)
                    </span>
                    {hasTotalReceiptDiff && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                        Cupom: R$ {receiptPrintedTotal?.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <span className="text-base sm:text-xl font-black font-mono text-emerald-400">
                    R$ {itemsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {receiptImage && (
                  <span className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    Cupom Anexado
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setStep('choose')}
                  className="w-1/3 sm:w-auto px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Compra</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 4: POST-SAVE SUCCESS & IMMEDIATE FEEDBACK ================= */}
        {step === 'success' && savedTx && (
          <div className="p-6 sm:p-8 space-y-6 text-center flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shadow-xl shadow-emerald-950/80 animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1.5 max-w-md">
              <h4 className="text-lg sm:text-xl font-black text-white">
                Compra Registrada com Sucesso!
              </h4>
              <p className="text-xs sm:text-sm text-slate-300">
                A compra no <strong className="text-white">{savedTx.mercadoDetails?.storeName || 'Supermercado'}</strong> no valor de <strong className="text-emerald-400 font-mono">R$ {savedTx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> ({savedTx.mercadoDetails?.items.length || 0} itens) foi adicionada ao histórico financeiro.
              </p>
            </div>

            {/* Quick Summary Pill Card */}
            <div className="w-full max-w-sm p-3.5 rounded-2xl bg-[#0f142c] border border-slate-800 text-left space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Quem Pagou:</span>
                <span className="font-bold text-white capitalize">
                  {formatMemberName(members.find(m => m.id === savedTx.paidByMemberId)?.name) || 'Membro'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Divisão:</span>
                <span className="font-bold text-emerald-400">
                  {savedTx.splitType === 'equal' ? '50/50 Casal' : 'Individual'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Total de Itens:</span>
                <span className="font-mono font-bold text-purple-300">
                  {savedTx.mercadoDetails?.items.length || 0} itens
                </span>
              </div>
            </div>

            {/* 2 Navigation Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-sm pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Concluir
              </button>

              {onOpenRaioX && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenRaioX(savedTx);
                  }}
                  className="w-full sm:w-1/2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition-all shadow-lg shadow-purple-950/50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PieChart className="w-3.5 h-3.5" />
                  <span>Ver Raio-X da Compra</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ================= MODAL DE AVISO / STATUS DA ANÁLISE DO CUPOM ================= */}
        {showAuditModal && (
          <div 
            className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setShowAuditModal(false)}
          >
            <div 
              className="bg-[#0f142c] border border-slate-700 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4 text-left animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header Icon & Title */}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  scanError
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : (itemsWithWarningCount > 0 || hasTotalReceiptDiff)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                }`}>
                  {scanError ? (
                    <AlertCircle className="w-6 h-6" />
                  ) : (itemsWithWarningCount > 0 || hasTotalReceiptDiff) ? (
                    <AlertTriangle className="w-6 h-6" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-black text-white">
                    {scanError
                      ? 'Aviso de Leitura do Cupom'
                      : (itemsWithWarningCount > 0 || hasTotalReceiptDiff)
                      ? 'Atenção: Conferência dos Itens'
                      : 'Análise Concluída com Sucesso!'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {scanError
                      ? 'Não conseguimos extrair todos os dados da foto automaticamente.'
                      : (itemsWithWarningCount > 0 || hasTotalReceiptDiff)
                      ? 'A IA detectou produtos com divergência matemática ou no valor total.'
                      : 'Todos os produtos, quantidades, preços unitários e valores conferem perfeitamente.'}
                  </p>
                </div>
              </div>

              {/* Detail Box */}
              {!scanError && (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Estabelecimento Lido:</span>
                    <span className="font-bold text-white">{storeName}</span>
                  </div>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Total de Itens Identificados:</span>
                    <span className="font-mono font-bold text-purple-300">{items.length} itens</span>
                  </div>
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Soma Calculada dos Itens:</span>
                    <span className="font-mono font-bold text-emerald-400">R$ {itemsTotal.toFixed(2)}</span>
                  </div>
                  {receiptPrintedTotal !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Total Impresso na Nota:</span>
                      <span className="font-mono font-bold text-slate-200">R$ {receiptPrintedTotal.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Highlight specific issues */}
                  {(itemsWithWarningCount > 0 || hasTotalReceiptDiff) && (
                    <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[11px] text-amber-300">
                      {itemsWithWarningCount > 0 && (
                        <p className="flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span><strong>{itemsWithWarningCount} item(ns)</strong> possuem Qtd × Preço diferente do total na nota (destacados em amarelo na lista).</span>
                        </p>
                      )}
                      {hasTotalReceiptDiff && (
                        <p className="flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Diferença de <strong>R$ {totalDiffAmount.toFixed(2)}</strong> entre a soma dos produtos e o total da nota.</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                {itemsWithWarningCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      handleRecalculateAllItems();
                      setShowAuditModal(false);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Recalcular Automaticamente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className={`py-2 px-4 rounded-xl text-white font-bold text-xs transition-all cursor-pointer ${
                    itemsWithWarningCount > 0
                      ? 'bg-slate-800 hover:bg-slate-700'
                      : 'w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-950/50'
                  }`}
                >
                  Conferir e Editar Itens
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
