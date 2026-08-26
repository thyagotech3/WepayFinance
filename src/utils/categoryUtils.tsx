import React from 'react';
import {
  Home,
  ShoppingCart,
  Car,
  Gamepad2,
  Heart,
  ShoppingBag,
  Receipt,
  GraduationCap,
  Fuel,
  Utensils,
  Coffee,
  Plane,
  Film,
  Tv,
  Dumbbell,
  Sparkles,
  Zap,
  Gift,
  Smartphone,
  Tag,
  Wifi,
  Dog,
  Shirt,
  Briefcase,
  Baby,
  MoreHorizontal,
  LayoutGrid,
} from 'lucide-react';

export interface CategoryItem {
  id: string;
  name: string;
  label: string;
  iconName: string;
  color: string;
  isCustom?: boolean;
}

export const AVAILABLE_CATEGORY_ICONS = [
  { name: 'Home', label: 'Casa', icon: Home },
  { name: 'ShoppingCart', label: 'Mercado', icon: ShoppingCart },
  { name: 'Utensils', label: 'Alimentação', icon: Utensils },
  { name: 'Car', label: 'Transporte', icon: Car },
  { name: 'Fuel', label: 'Combustível', icon: Fuel },
  { name: 'Gamepad2', label: 'Jogos/Lazer', icon: Gamepad2 },
  { name: 'Heart', label: 'Saúde', icon: Heart },
  { name: 'Dumbbell', label: 'Academia', icon: Dumbbell },
  { name: 'ShoppingBag', label: 'Compras', icon: ShoppingBag },
  { name: 'Shirt', label: 'Roupas', icon: Shirt },
  { name: 'Receipt', label: 'Contas', icon: Receipt },
  { name: 'Zap', label: 'Energia', icon: Zap },
  { name: 'GraduationCap', label: 'Educação', icon: GraduationCap },
  { name: 'Coffee', label: 'Café', icon: Coffee },
  { name: 'Plane', label: 'Viagem', icon: Plane },
  { name: 'Film', label: 'Cinema', icon: Film },
  { name: 'Tv', label: 'Streaming', icon: Tv },
  { name: 'Dog', label: 'Pet', icon: Dog },
  { name: 'Gift', label: 'Presente', icon: Gift },
  { name: 'Smartphone', label: 'Eletrônicos', icon: Smartphone },
  { name: 'Wifi', label: 'Internet', icon: Wifi },
  { name: 'Tag', label: 'Descontos', icon: Tag },
  { name: 'Briefcase', label: 'Trabalho', icon: Briefcase },
  { name: 'Baby', label: 'Filhos/Bebê', icon: Baby },
  { name: 'Sparkles', label: 'Beleza', icon: Sparkles },
  { name: 'MoreHorizontal', label: 'Outros', icon: MoreHorizontal },
];

export const AVAILABLE_CATEGORY_COLORS = [
  '#f97316', // Orange
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#a855f7', // Purple
  '#ef4444', // Red
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#6366f1', // Indigo
  '#f59e0b', // Amber
  '#14b8a6', // Teal
  '#8b5cf6', // Violet
  '#f43f5e', // Rose
  '#84cc16', // Lime
  '#64748b', // Slate
];

export const INITIAL_DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'cat-moradia', name: 'Moradia', label: 'Casa', iconName: 'Home', color: '#a855f7' },
  { id: 'cat-alimentacao', name: 'Alimentação', label: 'Alimentação', iconName: 'ShoppingCart', color: '#f59e0b' },
  { id: 'cat-transporte', name: 'Transporte', label: 'Transporte', iconName: 'Car', color: '#06b6d4' },
  { id: 'cat-lazer', name: 'Lazer', label: 'Lazer', iconName: 'Gamepad2', color: '#10b981' },
  { id: 'cat-saude', name: 'Saúde', label: 'Saúde', iconName: 'Heart', color: '#ec4899' },
  { id: 'cat-compras', name: 'Compras', label: 'Compras', iconName: 'ShoppingBag', color: '#f43f5e' },
  { id: 'cat-servicos', name: 'Serviços', label: 'Serviços', iconName: 'Receipt', color: '#3b82f6' },
  { id: 'cat-educacao', name: 'Educação', label: 'Educação', iconName: 'GraduationCap', color: '#6366f1' },
  { id: 'cat-supermercado', name: 'Supermercado', label: 'Supermercado', iconName: 'ShoppingCart', color: '#ea580c' },
  { id: 'cat-farmacia', name: 'Farmácia', label: 'Farmácia', iconName: 'Heart', color: '#e11d48' },
  { id: 'cat-combustivel', name: 'Combustível', label: 'Combustível', iconName: 'Fuel', color: '#eab308' },
  { id: 'cat-restaurante', name: 'Restaurante', label: 'Restaurante', iconName: 'Utensils', color: '#f97316' },
  { id: 'cat-pet', name: 'Pet', label: 'Pet', iconName: 'Dog', color: '#84cc16' },
  { id: 'cat-viagem', name: 'Viagem', label: 'Viagem', iconName: 'Plane', color: '#0284c7' },
  { id: 'cat-streaming', name: 'Streaming', label: 'Streaming', iconName: 'Tv', color: '#8b5cf6' },
  { id: 'cat-academia', name: 'Academia', label: 'Academia', iconName: 'Dumbbell', color: '#14b8a6' },
  { id: 'cat-beleza', name: 'Beleza', label: 'Beleza', iconName: 'Sparkles', color: '#d946ef' },
  { id: 'cat-contas', name: 'Contas', label: 'Contas', iconName: 'Zap', color: '#64748b' },
  { id: 'cat-presentes', name: 'Presentes', label: 'Presentes', iconName: 'Gift', color: '#fb7185' },
  { id: 'cat-eletronicos', name: 'Eletrônicos', label: 'Eletrônicos', iconName: 'Smartphone', color: '#38bdf8' },
  { id: 'cat-vestuario', name: 'Vestuário', label: 'Roupas', iconName: 'Shirt', color: '#f472b6' },
  { id: 'cat-assinaturas', name: 'Assinaturas', label: 'Assinaturas', iconName: 'Wifi', color: '#60a5fa' },
  { id: 'cat-trabalho', name: 'Trabalho', label: 'Trabalho', iconName: 'Briefcase', color: '#3b82f6' },
  { id: 'cat-outros', name: 'Outros', label: 'Outros', iconName: 'MoreHorizontal', color: '#94a3b8' },
];

export const DEFAULT_SHORTCUT_NAMES = ['Moradia', 'Alimentação', 'Transporte', 'Lazer', 'Saúde'];

export function getStoredCategories(): CategoryItem[] {
  try {
    const raw = localStorage.getItem('wepay_categories_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored categories:', e);
  }
  return INITIAL_DEFAULT_CATEGORIES;
}

export function saveStoredCategories(categories: CategoryItem[]): void {
  try {
    localStorage.setItem('wepay_categories_v2', JSON.stringify(categories));
  } catch (e) {
    console.error('Error saving categories:', e);
  }
}

export function getStoredShortcutNames(): string[] {
  try {
    const raw = localStorage.getItem('wepay_category_shortcuts_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading stored category shortcuts:', e);
  }
  return DEFAULT_SHORTCUT_NAMES;
}

export function saveStoredShortcutNames(shortcuts: string[]): void {
  try {
    localStorage.setItem('wepay_category_shortcuts_v2', JSON.stringify(shortcuts));
  } catch (e) {
    console.error('Error saving category shortcuts:', e);
  }
}

export function renderCategoryIcon(iconName: string, className: string = 'w-4 h-4'): React.ReactNode {
  switch (iconName) {
    case 'Home':
      return <Home className={className} />;
    case 'ShoppingCart':
      return <ShoppingCart className={className} />;
    case 'Utensils':
      return <Utensils className={className} />;
    case 'Car':
      return <Car className={className} />;
    case 'Fuel':
      return <Fuel className={className} />;
    case 'Gamepad2':
      return <Gamepad2 className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'Dumbbell':
      return <Dumbbell className={className} />;
    case 'ShoppingBag':
      return <ShoppingBag className={className} />;
    case 'Shirt':
      return <Shirt className={className} />;
    case 'Receipt':
      return <Receipt className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'GraduationCap':
      return <GraduationCap className={className} />;
    case 'Coffee':
      return <Coffee className={className} />;
    case 'Plane':
      return <Plane className={className} />;
    case 'Film':
      return <Film className={className} />;
    case 'Tv':
      return <Tv className={className} />;
    case 'Dog':
      return <Dog className={className} />;
    case 'Gift':
      return <Gift className={className} />;
    case 'Smartphone':
      return <Smartphone className={className} />;
    case 'Wifi':
      return <Wifi className={className} />;
    case 'Tag':
      return <Tag className={className} />;
    case 'Briefcase':
      return <Briefcase className={className} />;
    case 'Baby':
      return <Baby className={className} />;
    case 'Sparkles':
      return <Sparkles className={className} />;
    case 'LayoutGrid':
      return <LayoutGrid className={className} />;
    default:
      return <MoreHorizontal className={className} />;
  }
}
