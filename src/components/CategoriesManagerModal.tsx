import React, { useState } from 'react';
import {
  CategoryItem,
  AVAILABLE_CATEGORY_ICONS,
  AVAILABLE_CATEGORY_COLORS,
  renderCategoryIcon,
} from '../utils/categoryUtils';
import {
  X,
  Plus,
  Trash2,
  Check,
  SlidersHorizontal,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface CategoriesManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: CategoryItem[];
  selectedCategoryName: string;
  onSelectCategory: (categoryName: string) => void;
  onUpdateCategories: (newCategories: CategoryItem[]) => void;
  shortcutNames: string[];
  onUpdateShortcuts: (newShortcuts: string[]) => void;
}

export const CategoriesManagerModal: React.FC<CategoriesManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  selectedCategoryName,
  onSelectCategory,
  onUpdateCategories,
  shortcutNames,
  onUpdateShortcuts,
}) => {
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<CategoryItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isEditingShortcuts, setIsEditingShortcuts] = useState(false);

  // New Category Form States
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('ShoppingBag');
  const [newCatColor, setNewCatColor] = useState('#f97316');
  const [createError, setCreateError] = useState('');

  if (!isOpen) return null;

  // Handle Category Selection
  const handleCategoryClick = (cat: CategoryItem) => {
    if (isDeleteMode) {
      setCategoryToDelete(cat);
      return;
    }
    onSelectCategory(cat.name);
    onClose();
  };

  // Handle Category Deletion Confirmation
  const handleConfirmDelete = () => {
    if (!categoryToDelete) return;
    const updated = categories.filter((c) => c.id !== categoryToDelete.id && c.name !== categoryToDelete.name);
    onUpdateCategories(updated);

    // Also remove from shortcuts if present
    const updatedShortcuts = shortcutNames.filter((name) => name !== categoryToDelete.name);
    if (updatedShortcuts.length !== shortcutNames.length) {
      onUpdateShortcuts(updatedShortcuts);
    }

    setCategoryToDelete(null);
    if (updated.length === 0) {
      setIsDeleteMode(false);
    }
  };

  // Handle Create New Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) {
      setCreateError('Digite o nome da categoria');
      return;
    }

    const alreadyExists = categories.some(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (alreadyExists) {
      setCreateError('Já existe uma categoria com este nome');
      return;
    }

    const newCategory: CategoryItem = {
      id: `cat-custom-${Date.now()}`,
      name: trimmed,
      label: trimmed,
      iconName: newCatIcon,
      color: newCatColor,
      isCustom: true,
    };

    const updated = [...categories, newCategory];
    onUpdateCategories(updated);

    // If shortcuts have space (< 5), optionally offer or auto add
    if (shortcutNames.length < 5) {
      onUpdateShortcuts([...shortcutNames, newCategory.name]);
    }

    // Reset Form
    setNewCatName('');
    setNewCatIcon('ShoppingBag');
    setNewCatColor('#f97316');
    setCreateError('');
    setShowCreateModal(false);
  };

  // Handle Shortcut Removal
  const handleRemoveShortcut = (nameToRemove: string) => {
    const updated = shortcutNames.filter((name) => name !== nameToRemove);
    onUpdateShortcuts(updated);
  };

  // Handle Shortcut Addition
  const handleAddShortcut = (nameToAdd: string) => {
    if (shortcutNames.includes(nameToAdd)) return;
    if (shortcutNames.length >= 5) {
      return;
    }
    const updated = [...shortcutNames, nameToAdd];
    onUpdateShortcuts(updated);
  };

  // Non-shortcut categories available to be added
  const availableToAddAsShortcuts = categories.filter(
    (cat) => !shortcutNames.includes(cat.name)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[#0b0e1b] border border-slate-800/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center justify-between bg-[#0e1224]/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white tracking-wide leading-tight flex items-center gap-2">
                Todas as Categorias
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {categories.length}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Toque para selecionar ou personalizar atalhos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons Row: Criar Categoria & Excluir Categoria */}
        <div className="p-3 sm:p-4 pb-2 grid grid-cols-2 gap-2 bg-[#0b0e1b]">
          {/* Criar Categoria in Prominence */}
          <button
            type="button"
            onClick={() => {
              setIsDeleteMode(false);
              setShowCreateModal(true);
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-purple-900/30 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Criar categoria</span>
          </button>

          {/* Excluir Categoria Button */}
          <button
            type="button"
            onClick={() => setIsDeleteMode(!isDeleteMode)}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 cursor-pointer border ${
              isDeleteMode
                ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-950/50'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-rose-400 border-slate-800'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            <span>{isDeleteMode ? 'Cancelar exclusão' : 'Excluir categoria'}</span>
          </button>
        </div>

        {isDeleteMode && (
          <div className="mx-3 sm:mx-4 mb-2 p-2 rounded-xl bg-rose-950/40 border border-rose-900/50 flex items-center gap-2 text-rose-300 text-[11px] animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Toque na categoria que deseja excluir permanentemente.</span>
          </div>
        )}

        {/* Scrollable Grid of All Categories (3 cols on mobile, 6 cols on larger screens) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 pt-1 space-y-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Selecione uma categoria ({categories.length})
            </span>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5 max-h-56 sm:max-h-64 overflow-y-auto pr-1">
              {categories.map((cat) => {
                const isSelected = selectedCategoryName === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryClick(cat)}
                    className={`relative flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer group ${
                      isDeleteMode
                        ? 'bg-rose-950/20 border-rose-800/60 hover:bg-rose-900/40 hover:border-rose-500 scale-95'
                        : isSelected
                        ? 'bg-purple-950/40 border-purple-500/80 shadow-md ring-1 ring-purple-500'
                        : 'bg-[#101426] border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                    }`}
                  >
                    {isDeleteMode && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs">
                        <X className="w-2.5 h-2.5" />
                      </div>
                    )}

                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs shrink-0"
                      style={{
                        backgroundColor: `${cat.color}25`,
                        color: cat.color,
                        border: `1px solid ${cat.color}40`,
                      }}
                    >
                      {renderCategoryIcon(cat.iconName, 'w-4 h-4')}
                    </div>

                    <span
                      className={`text-[9px] sm:text-[10px] text-center font-medium mt-1.5 line-clamp-1 w-full truncate ${
                        isSelected ? 'text-white font-black' : 'text-slate-300'
                      }`}
                    >
                      {cat.label || cat.name}
                    </span>

                    {isSelected && !isDeleteMode && (
                      <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-purple-500 text-white flex items-center justify-center">
                        <Check className="w-2 h-2" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/80 pt-3">
            {/* Section: Editar Atalhos de Categorias */}
            <div className="bg-[#0e1224] border border-slate-800 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
                  <h3 className="text-xs font-bold text-white tracking-wide">
                    Atalhos da Tela de Lançamento
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingShortcuts(!isEditingShortcuts)}
                  className="flex items-center gap-1 text-[11px] font-bold text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  <span>{isEditingShortcuts ? 'Concluir' : 'Editar atalhos'}</span>
                  {isEditingShortcuts ? (
                    <ChevronUp className="w-3 h-3 text-purple-300" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-purple-300" />
                  )}
                </button>
              </div>

              {/* Preview of shortcut categories as they appear in the new transaction view */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>Preview dos atalhos ({shortcutNames.length}/5):</span>
                  {isEditingShortcuts && (
                    <span className="text-purple-300">Toque no (X) para remover</span>
                  )}
                </div>

                {/* 6-box Preview Grid matching the New Transaction view */}
                <div className="grid grid-cols-6 gap-1 bg-[#080914] p-2 rounded-xl border border-slate-800/80">
                  {shortcutNames.map((name) => {
                    const catObj = categories.find((c) => c.name === name) || {
                      id: name,
                      name,
                      label: name,
                      iconName: 'MoreHorizontal',
                      color: '#94a3b8',
                    };

                    return (
                      <div
                        key={name}
                        className="relative flex flex-col items-center gap-0.5 group"
                      >
                        {isEditingShortcuts && (
                          <button
                            type="button"
                            onClick={() => handleRemoveShortcut(name)}
                            className="absolute -top-1.5 -right-1 z-10 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
                            title={`Remover ${name} dos atalhos`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}

                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shadow-xs"
                          style={{
                            backgroundColor: `${catObj.color}25`,
                            color: catObj.color,
                            border: `1px solid ${catObj.color}50`,
                          }}
                        >
                          {renderCategoryIcon(catObj.iconName, 'w-3.5 h-3.5')}
                        </div>
                        <span className="text-[8px] text-center truncate max-w-full text-slate-300 font-medium">
                          {catObj.label || catObj.name}
                        </span>
                      </div>
                    );
                  })}

                  {/* Empty slots if less than 5 */}
                  {Array.from({ length: Math.max(0, 5 - shortcutNames.length) }).map((_, idx) => (
                    <div
                      key={`empty-${idx}`}
                      className="flex flex-col items-center gap-0.5 opacity-40 border border-dashed border-slate-700 rounded-xl p-1 justify-center min-h-[46px]"
                    >
                      <Plus className="w-3 h-3 text-slate-500" />
                      <span className="text-[7px] text-slate-500">Vazio</span>
                    </div>
                  ))}

                  {/* 6th Slot is always "Ver Todas" */}
                  <div className="flex flex-col items-center gap-0.5 opacity-90">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/50 text-purple-300 flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[8px] text-center truncate max-w-full text-purple-300 font-bold">
                      Ver Todas
                    </span>
                  </div>
                </div>
              </div>

              {/* List to choose other categories when in editing mode */}
              {isEditingShortcuts && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Adicionar aos atalhos ({availableToAddAsShortcuts.length} disponíveis):
                  </span>

                  {shortcutNames.length >= 5 ? (
                    <p className="text-[11px] text-amber-400 bg-amber-950/30 border border-amber-800/40 p-2 rounded-lg">
                      Limite de 5 atalhos atingido. Remova um atalho acima para adicionar outro.
                    </p>
                  ) : availableToAddAsShortcuts.length === 0 ? (
                    <p className="text-[11px] text-slate-400">
                      Todas as categorias já estão nos atalhos.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {availableToAddAsShortcuts.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleAddShortcut(cat.name)}
                          className="flex items-center gap-1.5 py-1 px-2 rounded-lg bg-slate-900 border border-slate-700/80 hover:border-purple-500/60 hover:bg-slate-800 text-slate-200 text-[11px] font-medium transition-all active:scale-95 cursor-pointer"
                        >
                          <div
                            className="w-4 h-4 rounded-md flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${cat.color}25`, color: cat.color }}
                          >
                            {renderCategoryIcon(cat.iconName, 'w-2.5 h-2.5')}
                          </div>
                          <span>{cat.label || cat.name}</span>
                          <Plus className="w-3 h-3 text-purple-400 ml-0.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-[#080a14] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Deletion */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121528] border border-rose-900/60 rounded-2xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Excluir Categoria?</h3>
                <p className="text-xs text-slate-400">Esta ação não pode ser desfeita.</p>
              </div>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  backgroundColor: `${categoryToDelete.color}25`,
                  color: categoryToDelete.color,
                }}
              >
                {renderCategoryIcon(categoryToDelete.iconName, 'w-4 h-4')}
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  {categoryToDelete.label || categoryToDelete.name}
                </span>
                <span className="text-[10px] text-slate-400">
                  {categoryToDelete.isCustom ? 'Categoria personalizada' : 'Categoria padrão'}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-300">
              Tem certeza que deseja excluir a categoria{' '}
              <strong className="text-white">"{categoryToDelete.name}"</strong>?
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-950/50 transition-colors cursor-pointer"
              >
                Sim, excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Dialog: Criar Categoria */}
      {showCreateModal && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#121528] border border-slate-800 rounded-2xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Criar Nova Categoria</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError('');
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3.5">
              {/* Nome */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Nome da Categoria
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    if (createError) setCreateError('');
                  }}
                  placeholder="Ex: Assinaturas, Cursos, Pet..."
                  className="w-full bg-[#080914] border border-slate-800 focus:border-purple-500 rounded-xl px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
                  autoFocus
                />
                {createError && (
                  <span className="text-[10px] text-rose-400 block">{createError}</span>
                )}
              </div>

              {/* Escolha do Ícone */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Escolha o Ícone
                </label>
                <div className="grid grid-cols-6 gap-1.5 max-h-32 overflow-y-auto p-1 bg-[#080914] border border-slate-800 rounded-xl">
                  {AVAILABLE_CATEGORY_ICONS.map((iconItem) => {
                    const isIconSelected = newCatIcon === iconItem.name;
                    return (
                      <button
                        key={iconItem.name}
                        type="button"
                        onClick={() => setNewCatIcon(iconItem.name)}
                        className={`p-1.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                          isIconSelected
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={iconItem.label}
                      >
                        {renderCategoryIcon(iconItem.name, 'w-4 h-4')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Escolha da Cor */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
                  Cor
                </label>
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#080914] border border-slate-800 rounded-xl">
                  {AVAILABLE_CATEGORY_COLORS.map((c) => {
                    const isColorSelected = newCatColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCatColor(c)}
                        className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                          isColorSelected ? 'scale-110 ring-2 ring-white shadow-sm' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-[#080914] p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">Pré-visualização:</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{
                      backgroundColor: `${newCatColor}25`,
                      color: newCatColor,
                      border: `1px solid ${newCatColor}60`,
                    }}
                  >
                    {renderCategoryIcon(newCatIcon, 'w-3.5 h-3.5')}
                  </div>
                  <span className="text-xs font-bold text-white">
                    {newCatName.trim() || 'Nova Categoria'}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-purple-950/50 transition-colors cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
