// Client-side API helper with strictly in-memory Bearer auth tokens (never stored in localStorage)

let userAuthToken: string | null = null;
let adminAuthToken: string | null = null;

export function setUserToken(token: string | null): void {
  userAuthToken = token;
}

export function getUserToken(): string | null {
  return userAuthToken;
}

export function setAdminToken(token: string | null): void {
  adminAuthToken = token;
}

export function getAdminToken(): string | null {
  return adminAuthToken;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & {useAdmin?: boolean} = {}
): Promise<T> {
  const {useAdmin, headers, ...rest} = options;
  const token = useAdmin ? adminAuthToken : userAuthToken;
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...rest,
    headers: mergedHeaders,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : 'خطایی در ارتباط با سرور رخ داد.');
  }
  return data as T;
}

// Guest Local-First storage (strictly non-sensitive preferences: bookmarks & shopping list)
const GUEST_BOOKMARKS_KEY = 'lagheli_guest_bookmarks_v1';
const GUEST_SHOPPING_KEY = 'lagheli_guest_shopping_v1';
const THEME_KEY = 'lagheli_theme_v1';

export function loadGuestBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(GUEST_BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestBookmarks(ids: string[]): void {
  try {
    localStorage.setItem(GUEST_BOOKMARKS_KEY, JSON.stringify(ids));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadGuestShopping<T>(): T[] {
  try {
    const raw = localStorage.getItem(GUEST_SHOPPING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveGuestShopping<T>(items: T[]): void {
  try {
    localStorage.setItem(GUEST_SHOPPING_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedTheme(): 'light' | 'dark' {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // Ignore
  }
  return 'light';
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}
