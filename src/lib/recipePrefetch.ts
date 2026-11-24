import {apiRequest} from './api.ts';
import type {Partner, Recipe, RecipePhoto, RecipeQuestion} from '../shared/types.ts';

export interface RecipeDetailPayload {
  recipe: Recipe;
  variations: Recipe[];
  questions: RecipeQuestion[];
  contextualPartners: Partner[];
  communityPhotos: RecipePhoto[];
}

interface CacheEntry {
  data: RecipeDetailPayload;
  fetchedAt: number;
}

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes fresh window
const MAX_CACHE_ENTRIES = 60;
const MAX_CONCURRENT_PREFETCH = 2;

const detailCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<RecipeDetailPayload>>();
const preloadedImages = new Set<string>();

interface PrefetchJob {
  id: string;
  city: string;
  imageUrl?: string;
}

const prefetchQueue: PrefetchJob[] = [];
const queuedKeys = new Set<string>();
let activePrefetches = 0;

function makeKey(recipeIdOrSlug: string, city: string): string {
  return `${recipeIdOrSlug}::${city.trim() || 'تهران'}`;
}

export function isConstrainedNetwork(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & {connection?: NetworkInformationLike}).connection;
  if (!conn) return false;
  return Boolean(conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g');
}

function preloadHeroImage(imageUrl?: string): void {
  if (!imageUrl || typeof window === 'undefined' || isConstrainedNetwork()) return;
  const trimmed = imageUrl.trim();
  if (!trimmed || preloadedImages.has(trimmed)) return;
  preloadedImages.add(trimmed);
  const img = new Image();
  img.decoding = 'async';
  img.src = trimmed;
}

function writeCache(requestedId: string, city: string, data: RecipeDetailPayload): void {
  const entry: CacheEntry = {data, fetchedAt: Date.now()};
  const keysToStore = new Set<string>([
    makeKey(requestedId, city),
    makeKey(data.recipe.id, city),
  ]);
  if (data.recipe.slug) {
    keysToStore.add(makeKey(data.recipe.slug, city));
  }

  for (const key of keysToStore) {
    if (detailCache.has(key)) {
      detailCache.delete(key);
    }
    detailCache.set(key, entry);
  }

  // LRU eviction when exceeding cache budget
  while (detailCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = detailCache.keys().next().value;
    if (!oldestKey) break;
    detailCache.delete(oldestKey);
  }
}

/**
 * Synchronously reads a cached recipe detail for instant 0ms modal rendering.
 */
export function getCachedRecipeDetail(
  recipeIdOrSlug: string,
  city = 'تهران'
): {data: RecipeDetailPayload; isFresh: boolean} | null {
  const key = makeKey(recipeIdOrSlug, city);
  const entry = detailCache.get(key);
  if (!entry) return null;
  // Promote in LRU order
  detailCache.delete(key);
  detailCache.set(key, entry);
  const isFresh = Date.now() - entry.fetchedAt < CACHE_TTL_MS;
  return {data: entry.data, isFresh};
}

/**
 * Fetches recipe details with in-flight deduplication and updates the LRU cache.
 */
export async function fetchRecipeDetail(
  recipeIdOrSlug: string,
  city = 'تهران',
  options?: {force?: boolean}
): Promise<RecipeDetailPayload> {
  const key = makeKey(recipeIdOrSlug, city);

  if (!options?.force) {
    const cached = getCachedRecipeDetail(recipeIdOrSlug, city);
    if (cached?.isFresh) {
      return cached.data;
    }
  }

  const existing = inFlightRequests.get(key);
  if (existing && !options?.force) {
    return existing;
  }

  const promise = apiRequest<{
    recipe: Recipe;
    variations: Recipe[];
    questions: RecipeQuestion[];
    contextualPartners: Partner[];
    communityPhotos?: RecipePhoto[];
  }>(`/api/recipes/${encodeURIComponent(recipeIdOrSlug)}?city=${encodeURIComponent(city)}`)
    .then((raw) => {
      const payload: RecipeDetailPayload = {
        recipe: raw.recipe,
        variations: raw.variations || [],
        questions: raw.questions || [],
        contextualPartners: raw.contextualPartners || [],
        communityPhotos: raw.communityPhotos || [],
      };
      writeCache(recipeIdOrSlug, city, payload);
      return payload;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Invalidates cached entries for a recipe after user mutations (Q&A, photo upload, VIP unlock).
 */
export function invalidateRecipeDetail(recipeIdOrSlug: string): void {
  const prefix = `${recipeIdOrSlug}::`;
  for (const key of Array.from(detailCache.keys())) {
    if (key.startsWith(prefix)) {
      detailCache.delete(key);
    }
  }
}

function scheduleIdle(task: () => void): void {
  if (typeof window === 'undefined') return;
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: {timeout: number}) => number;
  };
  if (typeof win.requestIdleCallback === 'function') {
    win.requestIdleCallback(task, {timeout: 1200});
  } else {
    window.setTimeout(task, 90);
  }
}

function drainPrefetchQueue(): void {
  if (activePrefetches >= MAX_CONCURRENT_PREFETCH || prefetchQueue.length === 0) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const job = prefetchQueue.shift();
  if (!job) return;

  const key = makeKey(job.id, job.city);
  queuedKeys.delete(key);

  const cached = getCachedRecipeDetail(job.id, job.city);
  if (cached?.isFresh) {
    preloadHeroImage(job.imageUrl || cached.data.recipe.imageUrl);
    drainPrefetchQueue();
    return;
  }

  activePrefetches += 1;
  fetchRecipeDetail(job.id, job.city)
    .then((data) => {
      preloadHeroImage(job.imageUrl || data.recipe.imageUrl);
    })
    .catch(() => {
      // Prefetch failures are silently ignored
    })
    .finally(() => {
      activePrefetches = Math.max(0, activePrefetches - 1);
      scheduleIdle(drainPrefetchQueue);
    });
}

/**
 * Queues a recipe detail for background prefetching.
 * - priority: 'low' (scroll lookahead) respects Save-Data / 2G and runs during idle frames.
 * - priority: 'high' (hover / touchstart / focus intent) executes immediately ahead of queue.
 */
export function prefetchRecipeDetail(
  recipeIdOrSlug: string,
  city = 'تهران',
  options?: {priority?: 'low' | 'high'; imageUrl?: string}
): void {
  if (!recipeIdOrSlug) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  const priority = options?.priority || 'low';
  if (priority === 'low' && isConstrainedNetwork()) return;

  const key = makeKey(recipeIdOrSlug, city);
  const cached = getCachedRecipeDetail(recipeIdOrSlug, city);
  if (cached?.isFresh) {
    preloadHeroImage(options?.imageUrl || cached.data.recipe.imageUrl);
    return;
  }

  if (inFlightRequests.has(key) || queuedKeys.has(key)) return;

  const job: PrefetchJob = {id: recipeIdOrSlug, city, imageUrl: options?.imageUrl};
  queuedKeys.add(key);

  if (priority === 'high') {
    prefetchQueue.unshift(job);
    drainPrefetchQueue();
  } else {
    prefetchQueue.push(job);
    scheduleIdle(drainPrefetchQueue);
  }
}

/**
 * Prefetches the next N recipes ahead of the current index during scrolling or browsing.
 */
export function prefetchNextRecipes(
  recipes: Pick<Recipe, 'id' | 'imageUrl'>[],
  currentIndex: number,
  city = 'تهران',
  lookahead = 2
): void {
  if (isConstrainedNetwork() || currentIndex < 0) return;
  const end = Math.min(recipes.length, currentIndex + 1 + lookahead);
  for (let i = currentIndex + 1; i < end; i++) {
    const target = recipes[i];
    if (target?.id) {
      prefetchRecipeDetail(target.id, city, {priority: 'low', imageUrl: target.imageUrl});
    }
  }
}
