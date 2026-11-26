import {useEffect, useRef, useState, type RefObject} from 'react';
import {getUserToken} from './api.ts';
import {DEFAULT_USER_DIETARY_PREFERENCES} from '../shared/behavioralEngine.ts';
import type {
  AnonymizedBehaviorAggregateStore,
  AnonymizedRecipeBehaviorBucket,
  BehavioralEventType,
  BehavioralSessionMetaInput,
  BehavioralTelemetryEventInput,
  BehaviorObserverMetricEvent,
  UserDietaryPreferences,
} from '../shared/types.ts';

const CLIENT_KEY_STORAGE = 'lagheli_anon_client_key_v1';
const DIETARY_PREFS_STORAGE = 'lagheli_dietary_prefs_v1';
const AFFINITY_CATS_STORAGE = 'lagheli_passive_affinity_v1';
const ANON_AGGREGATE_STORE_KEY = 'lagheli_anon_behavior_aggregates_v1';

export function getOrCreateClientKey(): string {
  try {
    const existing = localStorage.getItem(CLIENT_KEY_STORAGE);
    if (existing && /^[a-zA-Z0-9_-]{8,48}$/.test(existing)) {
      return existing;
    }
    const generated = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_KEY_STORAGE, generated);
    return generated;
  } catch {
    return `c_mem_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function loadLocalDietaryPrefs(): UserDietaryPreferences {
  try {
    const raw = localStorage.getItem(DIETARY_PREFS_STORAGE);
    if (!raw) return {...DEFAULT_USER_DIETARY_PREFERENCES};
    const parsed = JSON.parse(raw) as Partial<UserDietaryPreferences>;
    return {
      diets: Array.isArray(parsed.diets) ? parsed.diets : [],
      excludedIngredients: Array.isArray(parsed.excludedIngredients) ? parsed.excludedIngredients : [],
      preferredMealTimes: Array.isArray(parsed.preferredMealTimes) ? parsed.preferredMealTimes : ['ناهار', 'شام'],
      cookingFrequency: parsed.cookingFrequency || 'weekly',
      strictAdFiltering: parsed.strictAdFiltering !== false,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return {...DEFAULT_USER_DIETARY_PREFERENCES};
  }
}

export function saveLocalDietaryPrefs(prefs: UserDietaryPreferences): void {
  try {
    localStorage.setItem(DIETARY_PREFS_STORAGE, JSON.stringify(prefs));
  } catch {
    // Ignore quota errors
  }
}

export function loadPassiveAffinityCategories(): string[] {
  try {
    const raw = localStorage.getItem(AFFINITY_CATS_STORAGE);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return Object.entries(parsed)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat]) => cat);
  } catch {
    return [];
  }
}

function recordPassiveCategoryAffinity(category?: string): void {
  if (!category || !category.trim()) return;
  try {
    const raw = localStorage.getItem(AFFINITY_CATS_STORAGE);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const key = category.trim();
    map[key] = (map[key] || 0) + 1;
    localStorage.setItem(AFFINITY_CATS_STORAGE, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

function detectDeviceMeta(
  themeMode: 'light' | 'dark'
): Omit<BehavioralSessionMetaInput, 'sessionId' | 'durationSeconds' | 'pagesViewed'> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      osFamily: 'other',
      displayMode: 'browser',
      themeMode,
      viewportWidth: 1280,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const width = window.innerWidth || 390;
  const deviceType: 'mobile' | 'tablet' | 'desktop' =
    width < 680 ? 'mobile' : width < 1080 ? 'tablet' : 'desktop';

  let osFamily: BehavioralSessionMetaInput['osFamily'] = 'other';
  if (/iphone|ipad|ipod/.test(ua)) osFamily = 'ios';
  else if (/android/.test(ua)) osFamily = 'android';
  else if (/mac os x|macintosh/.test(ua)) osFamily = 'macos';
  else if (/windows/.test(ua)) osFamily = 'windows';
  else if (/linux/.test(ua)) osFamily = 'linux';

  const standalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    Boolean((navigator as Navigator & {standalone?: boolean}).standalone);

  return {
    deviceType,
    osFamily,
    displayMode: standalone ? 'pwa' : 'browser',
    themeMode,
    viewportWidth: width,
  };
}

// =============================================================================
// ANONYMIZED AGGREGATE OBSERVER PATTERN (ZERO PII / ZERO IDENTITY STORAGE)
// =============================================================================

export type BehaviorObserverListener = (
  event: BehaviorObserverMetricEvent,
  aggregate: AnonymizedBehaviorAggregateStore
) => void;

function createEmptyAggregateStore(): AnonymizedBehaviorAggregateStore {
  const hourlyVisitCounts: Record<number, number> = {};
  for (let h = 0; h < 24; h += 1) {
    hourlyVisitCounts[h] = 0;
  }
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    totalObservedSessions: 0,
    totalRecipeObservations: 0,
    globalAvgDwellSeconds: 0,
    globalAvgScrollDepthPercent: 0,
    globalAvgClickIntervalMs: 0,
    hourlyVisitCounts,
    recipes: {},
  };
}

function loadAnonymizedAggregateStore(): AnonymizedBehaviorAggregateStore {
  if (typeof window === 'undefined') return createEmptyAggregateStore();
  try {
    const raw = localStorage.getItem(ANON_AGGREGATE_STORE_KEY);
    if (!raw) return createEmptyAggregateStore();
    const parsed = JSON.parse(raw) as Partial<AnonymizedBehaviorAggregateStore>;
    const base = createEmptyAggregateStore();
    return {
      ...base,
      ...parsed,
      schemaVersion: 1,
      hourlyVisitCounts: {
        ...base.hourlyVisitCounts,
        ...(parsed.hourlyVisitCounts || {}),
      },
      recipes: parsed.recipes && typeof parsed.recipes === 'object' ? parsed.recipes : {},
    };
  } catch {
    return createEmptyAggregateStore();
  }
}

function persistAnonymizedAggregateStore(store: AnonymizedBehaviorAggregateStore): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANON_AGGREGATE_STORE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota errors
  }
}

export class BehaviorObserverSubject {
  private listeners = new Set<BehaviorObserverListener>();
  private store: AnonymizedBehaviorAggregateStore = loadAnonymizedAggregateStore();

  public subscribe(listener: BehaviorObserverListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.unsubscribe(listener);
    };
  }

  public unsubscribe(listener: BehaviorObserverListener): void {
    this.listeners.delete(listener);
  }

  public getSnapshot(): AnonymizedBehaviorAggregateStore {
    return {
      ...this.store,
      hourlyVisitCounts: {...this.store.hourlyVisitCounts},
      recipes: {...this.store.recipes},
    };
  }

  public exportAnonymizedJson(): string {
    return JSON.stringify(
      {
        privacyGuarantee: 'تجمیعی و کاملاً بدون اطلاعات هویتی (بدون شناسه کاربر، شماره تماس یا توکن نشست)',
        ...this.getSnapshot(),
      },
      null,
      2
    );
  }

  public resetAggregates(): void {
    this.store = createEmptyAggregateStore();
    persistAnonymizedAggregateStore(this.store);
  }

  public notify(event: BehaviorObserverMetricEvent): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => {
      try {
        listener(event, snapshot);
      } catch {
        // Isolate observer callback errors
      }
    });
  }

  public commitAnonymizedRecipeObservation(input: {
    recipeId: string;
    recipeTitle: string;
    category: string;
    dwellSeconds: number;
    maxScrollDepthPercent: number;
    clickIntervalsMs: number[];
    totalClicks: number;
  }): BehaviorObserverMetricEvent {
    const now = new Date();
    const nowIso = now.toISOString();
    const hour = now.getHours();
    const dwell = Math.max(1, Math.round(input.dwellSeconds));
    const scrollDepth = Math.max(0, Math.min(100, Math.round(input.maxScrollDepthPercent)));
    const validIntervals = input.clickIntervalsMs.filter((ms) => ms >= 80 && ms <= 120_000);
    const intervalSum = validIntervals.reduce((acc, ms) => acc + ms, 0);
    const sessionAvgIntervalMs =
      validIntervals.length > 0 ? Math.round(intervalSum / validIntervals.length) : 0;

    const existing: AnonymizedRecipeBehaviorBucket = this.store.recipes[input.recipeId] || {
      recipeId: input.recipeId,
      recipeTitle: input.recipeTitle || 'دستورپخت',
      category: input.category || 'عمومی',
      visitsCount: 0,
      totalDwellSeconds: 0,
      avgDwellSeconds: 0,
      maxScrollDepthPercent: 0,
      avgScrollDepthPercent: 0,
      totalClicks: 0,
      avgClickIntervalMs: 0,
      clickIntervalSamples: 0,
      hourlyVisits: {},
      lastUpdatedAt: nowIso,
    };

    const nextVisits = existing.visitsCount + 1;
    const nextTotalDwell = existing.totalDwellSeconds + dwell;
    const nextAvgDwell = Math.round(nextTotalDwell / nextVisits);
    const nextAvgScroll = Math.round(
      (existing.avgScrollDepthPercent * existing.visitsCount + scrollDepth) / nextVisits
    );
    const nextSamples = existing.clickIntervalSamples + validIntervals.length;
    const prevIntervalTotal = existing.avgClickIntervalMs * existing.clickIntervalSamples;
    const nextAvgClickInterval =
      nextSamples > 0 ? Math.round((prevIntervalTotal + intervalSum) / nextSamples) : existing.avgClickIntervalMs;

    const nextBucket: AnonymizedRecipeBehaviorBucket = {
      recipeId: input.recipeId,
      recipeTitle: input.recipeTitle || existing.recipeTitle,
      category: input.category || existing.category,
      visitsCount: nextVisits,
      totalDwellSeconds: nextTotalDwell,
      avgDwellSeconds: nextAvgDwell,
      maxScrollDepthPercent: Math.max(existing.maxScrollDepthPercent, scrollDepth),
      avgScrollDepthPercent: nextAvgScroll,
      totalClicks: existing.totalClicks + Math.max(0, input.totalClicks),
      avgClickIntervalMs: nextAvgClickInterval,
      clickIntervalSamples: nextSamples,
      hourlyVisits: {
        ...existing.hourlyVisits,
        [hour]: (existing.hourlyVisits[hour] || 0) + 1,
      },
      lastUpdatedAt: nowIso,
    };

    this.store.recipes[input.recipeId] = nextBucket;
    this.store.totalRecipeObservations += 1;
    this.store.hourlyVisitCounts[hour] = (this.store.hourlyVisitCounts[hour] || 0) + 1;
    this.store.updatedAt = nowIso;

    // Recompute global anonymized averages
    const buckets = Object.values(this.store.recipes);
    const totalObs = Math.max(
      1,
      buckets.reduce((s, b) => s + b.visitsCount, 0)
    );
    const totalDwellAll = buckets.reduce((s, b) => s + b.totalDwellSeconds, 0);
    const weightedScroll = buckets.reduce((s, b) => s + b.avgScrollDepthPercent * b.visitsCount, 0);
    const totalSamplesAll = buckets.reduce((s, b) => s + b.clickIntervalSamples, 0);
    const weightedInterval = buckets.reduce(
      (s, b) => s + b.avgClickIntervalMs * b.clickIntervalSamples,
      0
    );

    this.store.globalAvgDwellSeconds = Math.round(totalDwellAll / totalObs);
    this.store.globalAvgScrollDepthPercent = Math.round(weightedScroll / totalObs);
    this.store.globalAvgClickIntervalMs =
      totalSamplesAll > 0 ? Math.round(weightedInterval / totalSamplesAll) : 0;

    persistAnonymizedAggregateStore(this.store);

    const metricEvent: BehaviorObserverMetricEvent = {
      type: 'commit',
      recipeId: nextBucket.recipeId,
      recipeTitle: nextBucket.recipeTitle,
      category: nextBucket.category,
      dwellSeconds: dwell,
      maxScrollDepthPercent: scrollDepth,
      clickCount: input.totalClicks,
      lastClickIntervalMs: validIntervals.length > 0 ? validIntervals[validIntervals.length - 1] : null,
      avgClickIntervalMs: sessionAvgIntervalMs,
      observedAt: nowIso,
    };

    this.notify(metricEvent);
    return metricEvent;
  }

  public recordObservedSessionStart(): void {
    this.store.totalObservedSessions += 1;
    this.store.updatedAt = new Date().toISOString();
    persistAnonymizedAggregateStore(this.store);
  }
}

export const behaviorObserverSubject = new BehaviorObserverSubject();

export function getAnonymizedBehaviorAggregates(): AnonymizedBehaviorAggregateStore {
  return behaviorObserverSubject.getSnapshot();
}

export function exportAnonymizedBehaviorAggregatesJson(): string {
  return behaviorObserverSubject.exportAnonymizedJson();
}

// =============================================================================
// SILENT BATCHED BEHAVIOR TRACKER (BACKEND TELEMETRY PIPELINE)
// =============================================================================

class SilentBehaviorTracker {
  private sessionId = `bsess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  private startedAtMs = Date.now();
  private pagesViewed = 1;
  private themeMode: 'light' | 'dark' = 'light';
  private queue: BehavioralTelemetryEventInput[] = [];
  private activeSection = 'explore';
  private sectionEnteredAtMs = Date.now();
  private reachedScrollMilestones = new Set<string>();
  private lastBlockedReportSignature = '';
  private flushTimer: number | null = null;
  private initialized = false;

  public start(theme: 'light' | 'dark'): void {
    this.themeMode = theme;
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;
    behaviorObserverSubject.recordObservedSessionStart();

    this.enqueue({
      eventType: 'session_start',
      sectionName: 'explore',
      targetType: 'section',
      targetId: 'explore',
    });

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
      const ratio = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      for (const milestone of [25, 50, 75, 100]) {
        if (ratio >= milestone) {
          const key = `${this.activeSection}:${milestone}`;
          if (!this.reachedScrollMilestones.has(key)) {
            this.reachedScrollMilestones.add(key);
            this.enqueue({
              eventType: 'scroll_depth',
              sectionName: this.activeSection,
              targetType: 'section',
              targetId: this.activeSection,
              numericValue: milestone,
            });
          }
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    };

    window.addEventListener('scroll', onScroll, {passive: true});
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', () => this.flush());

    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, 12_000);
  }

  public setTheme(theme: 'light' | 'dark'): void {
    this.themeMode = theme;
  }

  public trackSectionChange(nextSection: string): void {
    const now = Date.now();
    const dwellSeconds = Math.max(1, Math.round((now - this.sectionEnteredAtMs) / 1000));
    if (this.activeSection && this.activeSection !== nextSection) {
      if (dwellSeconds <= 5) {
        this.enqueue({
          eventType: 'section_skip',
          sectionName: this.activeSection,
          targetType: 'section',
          targetId: this.activeSection,
          numericValue: dwellSeconds,
        });
      }
      this.pagesViewed += 1;
    }

    this.activeSection = nextSection;
    this.sectionEnteredAtMs = now;
    this.enqueue({
      eventType: 'tab_view',
      sectionName: nextSection,
      targetType: 'tab',
      targetId: nextSection,
      numericValue: dwellSeconds,
    });
  }

  public trackEvent(
    eventType: BehavioralEventType,
    payload: Omit<BehavioralTelemetryEventInput, 'eventType'> = {}
  ): void {
    if (payload.category && (eventType === 'recipe_view' || eventType === 'recipe_cook_start')) {
      recordPassiveCategoryAffinity(payload.category);
    }
    this.enqueue({eventType, ...payload});
  }

  public trackDietBlockedAds(blockedCount: number, dietSignature: string): void {
    if (blockedCount <= 0) return;
    const sig = `${dietSignature}:${blockedCount}`;
    if (sig === this.lastBlockedReportSignature) return;
    this.lastBlockedReportSignature = sig;
    this.enqueue({
      eventType: 'ad_diet_blocked',
      sectionName: this.activeSection,
      targetType: 'ad',
      targetId: dietSignature,
      targetLabel: 'مسدودسازی قطعی تبلیغ ناسازگار با رژیم',
      category: 'حفاظت رژیمی',
      numericValue: blockedCount,
    });
  }

  private enqueue(ev: BehavioralTelemetryEventInput): void {
    if (this.queue.length >= 36) {
      this.flush();
    }
    this.queue.push(ev);
  }

  public flush(): void {
    if (typeof window === 'undefined') return;
    // Never send consumer telemetry while inside Super Admin or Advertiser portals
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    if (
      pathname.startsWith('/superadmin') ||
      pathname.startsWith('/advertiser') ||
      params.get('portal') === 'superadmin' ||
      params.get('portal') === 'advertiser'
    ) {
      this.queue = [];
      return;
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - this.startedAtMs) / 1000));
    const eventsToSend = this.queue.splice(0, 35);
    if (eventsToSend.length === 0 && durationSeconds < 10) return;

    const meta = detectDeviceMeta(this.themeMode);
    const body = JSON.stringify({
      session: {
        sessionId: this.sessionId,
        ...meta,
        durationSeconds,
        pagesViewed: this.pagesViewed,
      },
      events: eventsToSend,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Lagheli-Client': getOrCreateClientKey(),
    };
    const token = getUserToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    fetch('/api/telemetry/batch', {
      method: 'POST',
      headers,
      body,
      keepalive: true,
    }).catch(() => {
      // Silently ignore offline telemetry failures
    });
  }
}

export const behaviorTracker = new SilentBehaviorTracker();

// =============================================================================
// CUSTOM REACT HOOK: useRecipeBehaviorObserver (OBSERVER PATTERN)
// Extracts dwell time, scroll depth (IntersectionObserver + scroll), and
// inter-click intervals, then stores strictly anonymized aggregates.
// =============================================================================

export interface UseRecipeBehaviorObserverOptions {
  recipeId: string;
  recipeTitle?: string;
  category?: string;
  containerRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
  onObserve?: BehaviorObserverListener;
}

export interface RecipeBehaviorObserverState {
  dwellSeconds: number;
  maxScrollDepthPercent: number;
  clickCount: number;
  avgClickIntervalMs: number;
  lastClickIntervalMs: number | null;
}

export function useRecipeBehaviorObserver({
  recipeId,
  recipeTitle = '',
  category = '',
  containerRef,
  enabled = true,
  onObserve,
}: UseRecipeBehaviorObserverOptions): RecipeBehaviorObserverState {
  const [liveState, setLiveState] = useState<RecipeBehaviorObserverState>({
    dwellSeconds: 0,
    maxScrollDepthPercent: 0,
    clickCount: 0,
    avgClickIntervalMs: 0,
    lastClickIntervalMs: null,
  });

  const titleRef = useRef(recipeTitle);
  const categoryRef = useRef(category);
  titleRef.current = recipeTitle;
  categoryRef.current = category;

  useEffect(() => {
    if (!onObserve) return;
    return behaviorObserverSubject.subscribe(onObserve);
  }, [onObserve]);

  useEffect(() => {
    if (!enabled || !recipeId || typeof window === 'undefined') return;

    let activeDwellMs = 0;
    let lastVisibleStartMs = document.visibilityState === 'visible' ? Date.now() : null;
    let maxScrollDepth = 0;
    let totalClicks = 0;
    let lastClickTs: number | null = null;
    const clickIntervalsMs: number[] = [];
    const sentScrollMilestones = new Set<number>();
    let committed = false;

    const computeCurrentDwellSeconds = () => {
      const running =
        lastVisibleStartMs !== null ? Math.max(0, Date.now() - lastVisibleStartMs) : 0;
      return Math.max(0, Math.round((activeDwellMs + running) / 1000));
    };

    const computeAvgClickInterval = () => {
      if (clickIntervalsMs.length === 0) return 0;
      const sum = clickIntervalsMs.reduce((acc, v) => acc + v, 0);
      return Math.round(sum / clickIntervalsMs.length);
    };

    const syncLiveState = (eventType: BehaviorObserverMetricEvent['type']) => {
      const dwellSeconds = computeCurrentDwellSeconds();
      const avgClickIntervalMs = computeAvgClickInterval();
      const lastInterval =
        clickIntervalsMs.length > 0 ? clickIntervalsMs[clickIntervalsMs.length - 1] : null;

      setLiveState({
        dwellSeconds,
        maxScrollDepthPercent: maxScrollDepth,
        clickCount: totalClicks,
        avgClickIntervalMs,
        lastClickIntervalMs: lastInterval,
      });

      behaviorObserverSubject.notify({
        type: eventType,
        recipeId,
        recipeTitle: titleRef.current || 'دستورپخت',
        category: categoryRef.current || 'عمومی',
        dwellSeconds,
        maxScrollDepthPercent: maxScrollDepth,
        clickCount: totalClicks,
        lastClickIntervalMs: lastInterval,
        avgClickIntervalMs,
        observedAt: new Date().toISOString(),
      });
    };

    const updateScrollDepth = (candidatePercent: number) => {
      const clamped = Math.max(0, Math.min(100, Math.round(candidatePercent)));
      if (clamped <= maxScrollDepth) return;
      maxScrollDepth = clamped;

      for (const milestone of [25, 50, 75, 100]) {
        if (maxScrollDepth >= milestone && !sentScrollMilestones.has(milestone)) {
          sentScrollMilestones.add(milestone);
          behaviorTracker.trackEvent('scroll_depth', {
            sectionName: 'recipe_detail',
            targetType: 'recipe',
            targetId: recipeId,
            targetLabel: titleRef.current || 'دستورپخت',
            category: categoryRef.current || 'عمومی',
            numericValue: milestone,
          });
        }
      }
      syncLiveState('scroll');
    };

    const measureContainerScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const total = Math.max(1, el.scrollHeight);
      const reached = Math.min(total, el.scrollTop + el.clientHeight);
      updateScrollDepth((reached / total) * 100);
    };

    // 1. IntersectionObserver on child structural sections inside the recipe container
    let intersectionObserver: IntersectionObserver | null = null;
    const el = containerRef.current;
    if (el && typeof IntersectionObserver !== 'undefined') {
      const observedNodes = Array.from(el.querySelectorAll('section, article, [data-recipe-section]'));
      if (observedNodes.length > 0) {
        intersectionObserver = new IntersectionObserver(
          (entries) => {
            const containerRect = el.getBoundingClientRect();
            const scrollHeight = Math.max(1, el.scrollHeight);
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              const nodeRect = entry.boundingClientRect;
              const nodeBottomInContainer =
                el.scrollTop + (nodeRect.bottom - containerRect.top);
              updateScrollDepth((nodeBottomInContainer / scrollHeight) * 100);
            }
          },
          {
            root: el,
            threshold: [0.25, 0.6, 0.95],
          }
        );
        observedNodes.forEach((node) => intersectionObserver?.observe(node));
      }
    }

    // 2. Scroll fallback observer for continuous depth accuracy
    const onScroll = () => measureContainerScroll();
    el?.addEventListener('scroll', onScroll, {passive: true});
    // Initial visible viewport reading (e.g., 25% above the fold)
    measureContainerScroll();

    // 3. Inter-click interval observer inside the recipe container
    const onClick = () => {
      const now = Date.now();
      totalClicks += 1;
      if (lastClickTs !== null) {
        const deltaMs = now - lastClickTs;
        if (deltaMs >= 80 && deltaMs <= 120_000) {
          clickIntervalsMs.push(deltaMs);
          if (clickIntervalsMs.length > 60) {
            clickIntervalsMs.shift();
          }
        }
      }
      lastClickTs = now;
      syncLiveState('click_interval');
    };
    el?.addEventListener('click', onClick, {passive: true});

    // 4. Visibility-aware dwell timer
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (lastVisibleStartMs !== null) {
          activeDwellMs += Math.max(0, Date.now() - lastVisibleStartMs);
          lastVisibleStartMs = null;
        }
      } else if (lastVisibleStartMs === null) {
        lastVisibleStartMs = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const dwellTick = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        syncLiveState('dwell');
      }
    }, 5000);

    const commitObservation = () => {
      if (committed) return;
      committed = true;
      if (lastVisibleStartMs !== null) {
        activeDwellMs += Math.max(0, Date.now() - lastVisibleStartMs);
        lastVisibleStartMs = null;
      }
      const dwellSeconds = Math.max(1, Math.round(activeDwellMs / 1000));
      const avgInterval = computeAvgClickInterval();

      // Persist strictly anonymized aggregate locally (zero user identity)
      behaviorObserverSubject.commitAnonymizedRecipeObservation({
        recipeId,
        recipeTitle: titleRef.current || 'دستورپخت',
        category: categoryRef.current || 'عمومی',
        dwellSeconds,
        maxScrollDepthPercent: maxScrollDepth,
        clickIntervalsMs,
        totalClicks,
      });

      // Forward aggregate dwell & click-interval telemetry to backend analytics pipeline
      behaviorTracker.trackEvent('recipe_view', {
        sectionName: 'recipe_detail',
        targetType: 'recipe',
        targetId: recipeId,
        targetLabel: titleRef.current || 'دستورپخت',
        category: categoryRef.current || 'عمومی',
        numericValue: dwellSeconds,
      });

      if (avgInterval > 0) {
        behaviorTracker.trackEvent('click_interval', {
          sectionName: 'recipe_detail',
          targetType: 'recipe',
          targetId: recipeId,
          targetLabel: titleRef.current || 'دستورپخت',
          category: categoryRef.current || 'عمومی',
          numericValue: avgInterval,
        });
      }
      behaviorTracker.flush();
    };

    window.addEventListener('pagehide', commitObservation);

    return () => {
      window.clearInterval(dwellTick);
      intersectionObserver?.disconnect();
      el?.removeEventListener('scroll', onScroll);
      el?.removeEventListener('click', onClick);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', commitObservation);
      commitObservation();
    };
  }, [enabled, recipeId, containerRef]);

  return liveState;
}
