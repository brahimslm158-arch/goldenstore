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
  type?: 'app' | 'game'; // distinguishes regular apps from games
  developer?: string;
  version_name?: string;
  version_code?: number;
  min_sdk?: number;
  size_bytes: number;
  apk_key: string;
  icon_key?: string;
  feature_key?: string; // wide "feature graphic" shown in editors-choice carousel
  // Ratings (real, computed from user votes)
  stars: number;          // total number of ratings (kept in sync with rating_count)
  rating_sum?: number;    // sum of all 1–5 star ratings
  rating_count?: number;  // number of ratings received
  rating?: number;        // denormalized average rating (0–5) for sorting/display
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
