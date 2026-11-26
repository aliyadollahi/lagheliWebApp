import {getUserToken} from './api.ts';
import {DEFAULT_USER_DIETARY_PREFERENCES} from '../shared/behavioralEngine.ts';
import type {
  BehavioralEventType,
  BehavioralSessionMetaInput,
  BehavioralTelemetryEventInput,
  UserDietaryPreferences,
} from '../shared/types.ts';

const CLIENT_KEY_STORAGE = 'lagheli_anon_client_key_v1';
const DIETARY_PREFS_STORAGE = 'lagheli_dietary_prefs_v1';
const AFFINITY_CATS_STORAGE = 'lagheli_passive_affinity_v1';

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

function detectDeviceMeta(themeMode: 'light' | 'dark'): Omit<BehavioralSessionMetaInput, 'sessionId' | 'durationSeconds' | 'pagesViewed'> {
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
