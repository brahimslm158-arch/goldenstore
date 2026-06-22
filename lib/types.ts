export interface App {
  id?: string;
  slug: string;
  name: string;
  name_lower: string;
  search_terms: string[];
  package_name: string;
  short_description?: string;
  description?: string;
  category: string;
  developer?: string;
  version_name?: string;
  version_code?: number;
  min_sdk?: number;
  size_bytes: number;
  apk_key: string;
  icon_key?: string;
  stars: number;
  downloads: number;
  created_at: number;
  updated_at: number;
}

export interface Screenshot {
  id?: string;
  app_id: string;
  r2_key: string;
  position: number;
  created_at: number;
}

export interface Category {
  slug: string;
  name: string;
  icon: string;
  position: number;
  count?: number;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { slug: 'games',         name: 'ألعاب',           icon: 'gamepad',   position: 1 },
  { slug: 'social',        name: 'تواصل اجتماعي',   icon: 'message',   position: 2 },
  { slug: 'tools',         name: 'أدوات',           icon: 'wrench',    position: 3 },
  { slug: 'productivity',  name: 'إنتاجية',          icon: 'clipboard', position: 4 },
  { slug: 'entertainment', name: 'ترفيه',           icon: 'film',      position: 5 },
  { slug: 'education',     name: 'تعليم',            icon: 'book',      position: 6 },
  { slug: 'photography',   name: 'تصوير',           icon: 'camera',    position: 7 },
  { slug: 'music',         name: 'موسيقى',           icon: 'music',     position: 8 },
  { slug: 'finance',       name: 'مالية',            icon: 'coin',      position: 9 },
  { slug: 'shopping',      name: 'تسوق',             icon: 'cart',     position: 10 },
  { slug: 'news',          name: 'أخبار',            icon: 'news',     position: 11 },
  { slug: 'health',        name: 'صحة ولياقة',       icon: 'heart',    position: 12 },
  { slug: 'travel',        name: 'سفر',              icon: 'plane',    position: 13 },
  { slug: 'other',         name: 'أخرى',             icon: 'sparkle',  position: 99 },
];
