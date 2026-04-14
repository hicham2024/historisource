export type FavoriteItem = {
  id: string;
  title: string;
  year: string | null;
  language?: string | null;
  documentType?: string;
  sourceType?: string;
  officialUrl: string | null;
  thumbnailUrl?: string | null;
  source: string;
};

const STORAGE_KEY = "historisource_favorites";

export function getFavorites(): FavoriteItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveFavorites(items: FavoriteItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function isFavorite(id: string): boolean {
  const favorites = getFavorites();
  return favorites.some((item) => item.id === id);
}

export function toggleFavorite(item: FavoriteItem) {
  const favorites = getFavorites();

  const exists = favorites.find((f) => f.id === item.id);

  let updated;

  if (exists) {
    updated = favorites.filter((f) => f.id !== item.id);
  } else {
    updated = [item, ...favorites];
  }

  saveFavorites(updated);
}