import React, { useState, useMemo } from 'react';
import { Transaction, ReceiptItem } from '../types';
import { formatMemberName } from '../utils/incomeUtils';
import { 
  X, PieChart, ShoppingCart, Calendar, Store, CreditCard,
  Layers, TrendingUp, Award, DollarSign, Search, Check,
  Share2, Image as ImageIcon, Sparkles, Filter, ChevronDown, Copy
} from 'lucide-react';
import { MERCADO_CATEGORIES, getCategoryBadge } from './MercadoModal';

interface MercadoRaioXModalProps {
  transaction: Transaction;
  onClose: () => void;
  memberName?: string;
}

export const MercadoRaioXModal: React.FC<MercadoRaioXModalProps> = ({
  transaction,
  onClose,
  memberName,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  const [showPhoto, setShowPhoto] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const details = transaction.mercadoDetails;
  const items: ReceiptItem[] = useMemo(() => {
    return details?.items || [];
  }, [details]);

  const totalAmount = transaction.amount || details?.totalAmount || 0;

  // Category aggregations
  const categoryStats = useMemo(() => {
    const map: Record<string, { total: number; count: number; items: ReceiptItem[] }> = {};

    items.forEach((it) => {
      const cat = it.category || 'Mercearia';
      if (!map[cat]) {
        map[cat] = { total: 0, count: 0, items: [] };
      }
      map[cat].total += it.totalPrice;
      map[cat].count += 1;
      map[cat].items.push(it);
    });

    const list = Object.entries(map).map(([name, data]) => ({
      name,
      total: data.total,
      count: data.count,
      percent: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0,
      badge: getCategoryBadge(name),
    }));

    // Sort by total descending
    return list.sort((a, b) => b.total - a.total);
  }, [items, totalAmount]);

  // Key KPI calculations
  const mostExpensiveItem = useMemo(() => {
    if (items.length === 0) return null;
    return [...items].sort((a, b) => b.totalPrice - a.totalPrice)[0];
  }, [items]);

  const averageItemPrice = useMemo(() => {
    if (items.length === 0) return 0;
    return totalAmount / items.length;
  }, [items, totalAmount]);

  const topCategory = categoryStats[0] || null;

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchesSearch = it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (it.category || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = selectedSubcategory === 'all' || it.category === selectedSubcategory;
      return matchesSearch && matchesCat;
    });
  }, [items, searchTerm, selectedSubcategory]);

  // Copy WhatsApp / Text Summary
  const handleCopySummary = () => {
    const store = details?.storeName || transaction.description;
    const dateFormatted = new Date(transaction.date).toLocaleDateString('pt-BR');
    
    let text = `🛒 *RAIO-X DE COMPRAS - WePay*\n`;
    text += `🏬 *Local:* ${store}\n`;
    text += `📅 *Data:* ${dateFormatted}\n`;
    text += `💰 *Total Pago:* R$ ${totalAmount.toFixed(2)}\n`;
    text += `📦 *Total de Itens:* ${items.length}\n\n`;

    text += `📊 *Divisão por Categorias:*\n`;
    categoryStats.forEach((cat) => {
      text += `• ${cat.name}: R$ ${cat.total.toFixed(2)} (${cat.percent.toFixed(0)}%)\n`;
    });

    if (mostExpensiveItem) {
      text += `\n🏆 *Item Mais Caro:* ${mostExpensiveItem.name} (R$ ${mostExpensiveItem.totalPrice.toFixed(2)})\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b0f24] border border-purple-500/40 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-3.5 sm:p-5 border-b border-slate-800/90 bg-gradient-to-r from-[#131b3e] via-[#101b38] to-[#1a1336] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-purple-950/50 shrink-0">
              <div className="w-full h-full bg-[#0d1329] rounded-[14px] flex items-center justify-center text-purple-300">
                <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-lg font-black text-white tracking-tight leading-tight">
                  Raio-X da Compra
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  {items.length} itens
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-semibold flex items-center gap-1.5 mt-0.5">
                <Store className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-white font-bold">{details?.storeName || transaction.description}</span>
                <span className="text-slate-500">•</span>
                <Calendar className="w-3 h-3 text-purple-400" />
                <span className="font-mono text-slate-300">
                  {new Date(transaction.date).toLocaleDateString('pt-BR')}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopySummary}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-purple-950/50 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-purple-300 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
              title="Copiar Resumo"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Compartilhar'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-3.5 sm:p-5 space-y-4 overflow-y-auto flex-1 text-left">
          
          {/* 4 Big KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* 1. Total Pago */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-[#131d3d] to-[#0d1226] border border-emerald-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Total Pago</span>
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400 leading-tight">
                R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {transaction.splitType === 'equal' ? '50/50 Casal' : 'Individual'}
              </div>
            </div>

            {/* 2. Item Mais Caro */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-[#26152b] to-[#0d1226] border border-rose-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Mais Caro</span>
                <Award className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-rose-400 leading-tight">
                R$ {mostExpensiveItem ? mostExpensiveItem.totalPrice.toFixed(2) : '0,00'}
              </div>
              <div className="text-[10px] text-slate-300 font-semibold truncate" title={mostExpensiveItem?.name}>
                {mostExpensiveItem ? mostExpensiveItem.name : 'Nenhum'}
              </div>
            </div>

            {/* 3. Preço Médio por Item */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-[#161a38] to-[#0d1226] border border-blue-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Preço Médio</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-blue-400 leading-tight">
                R$ {averageItemPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Por unidade/item
              </div>
            </div>

            {/* 4. Subcategoria Principal */}
            <div className="p-3 rounded-2xl bg-gradient-to-b from-[#20183b] to-[#0d1226] border border-purple-500/30 space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold uppercase tracking-wider">Maior Categoria</span>
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="text-base sm:text-lg font-black text-purple-300 leading-tight">
                {topCategory ? `${topCategory.percent.toFixed(0)}%` : '0%'}
              </div>
              <div className="text-[10px] text-slate-300 font-semibold truncate">
                {topCategory ? topCategory.name : 'Geral'}
              </div>
            </div>
          </div>

          {/* Subcategory Distribution Visualizer */}
          <div className="bg-[#0f142c] border border-slate-800/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Distribuição por Categoria de Produto
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                {categoryStats.length} subcategorias
              </span>
            </div>

            {/* Progress / Share bars */}
            <div className="space-y-2 pt-1">
              {categoryStats.map((cat) => (
                <div key={cat.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: cat.badge.color }} 
                      />
                      <span className="text-slate-200">{cat.name}</span>
                      <span className="text-slate-500 text-[10px]">({cat.count} {cat.count === 1 ? 'item' : 'itens'})</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-slate-400 text-[11px]">{cat.percent.toFixed(1)}%</span>
                      <span className="text-white font-bold">R$ {cat.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.min(100, Math.max(5, cat.percent))}%`,
                        backgroundColor: cat.badge.color 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Receipt Original Image Attachment (if available) */}
          {details?.receiptImageUrl && (
            <div className="bg-[#0f142c] border border-slate-800/90 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Foto do Cupom Fiscal Digitalizado
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPhoto(!showPhoto)}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  {showPhoto ? 'Ocultar Foto' : 'Ver Foto Completa'}
                </button>
              </div>

              {showPhoto && (
                <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center max-h-80 overflow-y-auto">
                  <img 
                    src={details.receiptImageUrl} 
                    alt="Cupom Fiscal" 
                    className="max-h-72 object-contain rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>
          )}

          {/* Search & Filter Bar for Items */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Lista Completa de Itens ({filteredItems.length})
                </h4>
              </div>

              {/* Subcategory Filter Dropdown */}
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-slate-300 font-bold focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                {categoryStats.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar produto por nome..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Items Table */}
          <div className="bg-[#0f142c] border border-slate-800/90 rounded-2xl overflow-hidden divide-y divide-slate-800/80">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Nenhum produto encontrado com os filtros atuais.
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const badge = getCategoryBadge(item.category);

                return (
                  <div key={`${item.id || 'item'}-${idx}`} className="p-2.5 sm:p-3 flex items-center justify-between gap-2 hover:bg-slate-900/60 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-lg bg-slate-900 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                          <span className={`px-1.5 py-0.2 rounded-md border text-[9px] font-bold ${badge.bg} ${badge.text} ${badge.border}`}>
                            {item.category || 'Mercearia'}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span>Qtd: {item.quantity}</span>
                          <span className="text-slate-600">•</span>
                          <span>Unit: R$ {item.unitPrice ? item.unitPrice.toFixed(2) : (item.totalPrice / (item.quantity || 1)).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black font-mono text-emerald-400">
                        R$ {item.totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Modal Sticky Footer */}
        <div className="p-3 sm:p-4 bg-[#090d1f] border-t border-slate-800 shrink-0 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Registrado por <span className="text-white font-bold capitalize">{formatMemberName(memberName) || 'Membro'}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar Raio-X
          </button>
        </div>

      </div>
    </div>
  );
};
