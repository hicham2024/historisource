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
    return JSON.parse(raw) as FavoriteItem[];
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

export function addFavorite(item: FavoriteItem) {
  const favorites = getFavorites();

  if (favorites.some((fav) => fav.id === item.id)) return;

  const updated = [item, ...favorites];
  saveFavorites(updated);
}

export function removeFavorite(id: string) {
  const favorites = getFavorites();
  const updated = favorites.filter((item) => item.id !== id);
  saveFavorites(updated);
}

export function toggleFavorite(item: FavoriteItem) {
  if (isFavorite(item.id)) {
    removeFavorite(item.id);
  } else {
    addFavorite(item);
  }
}