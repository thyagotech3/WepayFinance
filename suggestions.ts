import { CategoryType, ExpenseSuggestion, RecurrentPreset } from '../types';

export interface CategoryMeta {
  name: CategoryType;
  icon: string;
  color: string;
  bgColor: string;
}

export const CATEGORIES_META: Record<CategoryType, CategoryMeta> = {
  'Alimentação': { name: 'Alimentação', icon: 'Utensils', color: '#f97316', bgColor: '#fff7ed' },
  'Moradia': { name: 'Moradia', icon: 'Home', color: '#3b82f6', bgColor: '#eff6ff' },
  'Transporte': { name: 'Transporte', icon: 'Car', color: '#06b6d4', bgColor: '#ecfeff' },
  'Lazer': { name: 'Lazer', icon: 'Tv', color: '#a855f7', bgColor: '#faf5ff' },
  'Saúde': { name: 'Saúde', icon: 'HeartPulse', color: '#ef4444', bgColor: '#fef2f2' },
  'Compras': { name: 'Compras', icon: 'ShoppingBag', color: '#ec4899', bgColor: '#fdf2f8' },
  'Serviços': { name: 'Serviços', icon: 'Receipt', color: '#10b981', bgColor: '#ecfdf5' },
  'Educação': { name: 'Educação', icon: 'GraduationCap', color: '#6366f1', bgColor: '#eef2ff' },
  'Outros': { name: 'Outros', icon: 'Sparkles', color: '#64748b', bgColor: '#f8fafc' },
};

// Common expense suggestions that pop up when clicking the text bar
export const COMMON_SUGGESTIONS: ExpenseSuggestion[] = [
  {
    id: 'sug-1',
    title: 'Supermercado Mensal',
    defaultAmount: 350.00,
    category: 'Alimentação',
    iconName: 'ShoppingCart',
    popularTime: 'Fim de semana'
  },
  {
    id: 'sug-2',
    title: 'Uber / Táxi',
    defaultAmount: 28.50,
    category: 'Transporte',
    iconName: 'Car',
    popularTime: 'Frequente'
  },
  {
    id: 'sug-3',
    title: 'Almoço em Restaurante',
    defaultAmount: 65.00,
    category: 'Alimentação',
    iconName: 'Utensils',
    popularTime: 'Dia a dia'
  },
  {
    id: 'sug-4',
    title: 'Farmácia / Remédios',
    defaultAmount: 45.00,
    category: 'Saúde',
    iconName: 'HeartPulse',
    popularTime: 'Mensal'
  },
  {
    id: 'sug-5',
    title: 'Combustível / Posto',
    defaultAmount: 180.00,
    category: 'Transporte',
    iconName: 'Fuel',
    popularTime: 'Semanal'
  },
  {
    id: 'sug-6',
    title: 'Cinema / Streaming',
    defaultAmount: 55.00,
    category: 'Lazer',
    iconName: 'Film',
    popularTime: 'Lazer'
  },
  {
    id: 'sug-7',
    title: 'Conta de Luz',
    defaultAmount: 140.00,
    category: 'Moradia',
    iconName: 'Zap',
    popularTime: 'Recorrente'
  },
  {
    id: 'sug-8',
    title: 'Padaria de Manhã',
    defaultAmount: 22.00,
    category: 'Alimentação',
    iconName: 'Coffee',
    popularTime: 'Diário'
  }
];

// Quick recurrent expense buttons on the main screen
export const QUICK_RECURRENT_PRESETS: RecurrentPreset[] = [
  {
    id: 'rec-1',
    title: 'Aluguel',
    amount: 1800.00,
    category: 'Moradia',
    categoryIcon: 'Home',
    splitType: 'equal'
  },
  {
    id: 'rec-2',
    title: 'Mercado (R$ 200)',
    amount: 200.00,
    category: 'Alimentação',
    categoryIcon: 'ShoppingCart',
    splitType: 'equal'
  },
  {
    id: 'rec-3',
    title: 'Internet Banda Larga',
    amount: 120.00,
    category: 'Moradia',
    categoryIcon: 'Wifi',
    splitType: 'equal'
  },
  {
    id: 'rec-4',
    title: 'Netflix / Spotify',
    amount: 55.90,
    category: 'Lazer',
    categoryIcon: 'Tv',
    splitType: 'equal'
  },
  {
    id: 'rec-5',
    title: 'Academia do Casal',
    amount: 190.00,
    category: 'Saúde',
    categoryIcon: 'Dumbbell',
    splitType: 'equal'
  },
  {
    id: 'rec-6',
    title: 'Luz & Água',
    amount: 210.00,
    category: 'Moradia',
    categoryIcon: 'Zap',
    splitType: 'equal'
  }
];
