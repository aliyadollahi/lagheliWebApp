import crypto from 'crypto';
import type express from 'express';
import {z} from 'zod';
import {db} from './db.ts';
import {
  DEFAULT_USER_DIETARY_PREFERENCES,
  DIETARY_OPTIONS,
  SECTION_LABELS_FA,
} from '../shared/behavioralEngine.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdminBehavioralChartsReportPayload,
  AdminPermission,
  ApprovedExecutiveInsightReport,
  DietaryTagId,
  ExecutiveBehavioralReportPayload,
  UserDietaryPreferences,
} from '../shared/types.ts';
import type {SessionContext} from './adminAndMediaRoutes.ts';

export interface BehavioralRouteDeps {
  getSession: (req: express.Request) => SessionContext | null;
  requireAdmin: (
    req: express.Request,
    res: express.Response,
    permission?: AdminPermission
  ) => SessionContext | null;
  checkRateLimit: (key: string, maxRequests: number, windowMs: number) => boolean;
}

const VALID_DIET_IDS = new Set<string>(DIETARY_OPTIONS.map((o) => o.id));

function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidAdvertiserSession(req: express.Request): boolean {
  const token = getBearerToken(req);
  if (!token) return false;
  const row = db
    .prepare(
      `SELECT s.expires_at, a.status
       FROM advertiser_sessions s
       JOIN advertiser_accounts a ON a.id = s.advertiser_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as {expires_at: number; status: string} | undefined;
  return Boolean(row && row.expires_at >= Date.now() && row.status === 'active');
}

function resolveSubjectKey(req: express.Request, session: SessionContext | null): {
  subjectKey: string;
  userId: string | null;
} {
  if (session && session.userId && !session.userId.startsWith('admin-')) {
    return {subjectKey: session.userId, userId: session.userId};
  }
  const rawHeader = req.headers['x-lagheli-client'];
  const clientId =
    typeof rawHeader === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(rawHeader.trim())
      ? rawHeader.trim()
      : 'guest-anonymous';
  return {subjectKey: `guest-${clientId}`, userId: null};
}

function requireExecutiveAdmin(
  req: express.Request,
  res: express.Response,
  deps: BehavioralRouteDeps
): SessionContext | null {
  const session = deps.requireAdmin(req, res, 'dashboard.view');
  if (!session) return null;
  if (session.adminRole !== 'senior_admin') {
    res.status(403).json({
      error: 'دسترسی به اتاق هوش رفتاری و آمار عمیق کاربران صرفاً در اختیار مدیر ارشد سیستم است.',
    });
    return null;
  }
  return session;
}

function readDietaryPreferences(subjectKey: string): UserDietaryPreferences {
  const row = db
    .prepare('SELECT * FROM user_dietary_profiles WHERE subject_key = ?')
    .get(subjectKey) as Record<string, unknown> | undefined;
  if (!row) {
    return {...DEFAULT_USER_DIETARY_PREFERENCES};
  }
  const parsedDiets = (JSON.parse(String(row.diets_json || '[]')) as string[]).filter((d): d is DietaryTagId =>
    VALID_DIET_IDS.has(d)
  );
  return {
    diets: parsedDiets,
    excludedIngredients: JSON.parse(String(row.excluded_ingredients_json || '[]')),
    preferredMealTimes: JSON.parse(String(row.preferred_meal_times_json || '["ناهار","شام"]')),
    cookingFrequency: (row.cooking_frequency as UserDietaryPreferences['cookingFrequency']) || 'weekly',
    strictAdFiltering: Number(row.strict_ad_filtering ?? 1) === 1,
    updatedAt: String(row.updated_at || ''),
  };
}

function listApprovedReports(publishedOnly = false): ApprovedExecutiveInsightReport[] {
  const rows = db
    .prepare(
      publishedOnly
        ? 'SELECT * FROM executive_insight_reports WHERE published_to_auctions = 1 ORDER BY created_at DESC LIMIT 12'
        : 'SELECT * FROM executive_insight_reports ORDER BY created_at DESC LIMIT 20'
    )
    .all() as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    audienceScope: (r.audience_scope as ApprovedExecutiveInsightReport['audienceScope']) || 'brands',
    approvedBy: String(r.approved_by),
    publishedToAuctions: Number(r.published_to_auctions) === 1,
    createdAt: String(r.created_at),
    summary: JSON.parse(String(r.summary_json || '{}')),
  }));
}

function computeExecutiveBehavioralReport(): ExecutiveBehavioralReportPayload {
  const sessions = db
    .prepare('SELECT * FROM behavior_sessions ORDER BY last_seen_at DESC LIMIT 2000')
    .all() as {
    id: string;
    subject_key: string;
    user_id: string | null;
    device_type: string;
    os_family: string;
    display_mode: string;
    theme_mode: string;
    viewport_width: number;
    duration_seconds: number;
    visit_hour: number;
    day_of_week: number;
    pages_viewed: number;
  }[];

  const events = db
    .prepare('SELECT * FROM behavior_events ORDER BY created_at DESC LIMIT 8000')
    .all() as {
    id: string;
    session_id: string | null;
    subject_key: string;
    user_id: string | null;
    event_type: string;
    section_name: string;
    target_type: string;
    target_id: string;
    target_label: string;
    category: string;
    numeric_value: number;
  }[];

  const dietProfiles = db.prepare('SELECT * FROM user_dietary_profiles').all() as {
    subject_key: string;
    diets_json: string;
    excluded_ingredients_json: string;
    cooking_frequency: string;
    strict_ad_filtering: number;
  }[];

  const totalSessions = sessions.length;
  const subjectSessionCounts = new Map<string, number>();
  let totalDuration = 0;
  let longestDuration = 0;
  let pwaCount = 0;
  let darkCount = 0;
  let weekendCount = 0;

  const deviceTypeCounts = new Map<string, number>();
  const osCounts = new Map<string, number>();
  const hourBuckets = Array.from({length: 24}, (_, h) => ({hour: h, visits: 0, totalDur: 0}));

  for (const s of sessions) {
    subjectSessionCounts.set(s.subject_key, (subjectSessionCounts.get(s.subject_key) || 0) + 1);
    const dur = Math.max(0, Number(s.duration_seconds || 0));
    totalDuration += dur;
    if (dur > longestDuration) longestDuration = dur;
    if (s.display_mode === 'pwa') pwaCount += 1;
    if (s.theme_mode === 'dark') darkCount += 1;
    // In Iran calendar: Thu (4) and Fri (5) are weekend days
    if (s.day_of_week === 4 || s.day_of_week === 5) weekendCount += 1;

    deviceTypeCounts.set(s.device_type, (deviceTypeCounts.get(s.device_type) || 0) + 1);
    osCounts.set(s.os_family, (osCounts.get(s.os_family) || 0) + 1);

    const h = Math.max(0, Math.min(23, Number(s.visit_hour || 0)));
    hourBuckets[h].visits += 1;
    hourBuckets[h].totalDur += dur;
  }

  const uniqueSubjectsCount = Math.max(subjectSessionCounts.size, dietProfiles.length);
  const returningSubjects = Array.from(subjectSessionCounts.values()).filter((c) => c >= 2).length;
  const returningRatePercent =
    subjectSessionCounts.size > 0 ? Math.round((returningSubjects / subjectSessionCounts.size) * 100) : 0;

  const DEVICE_LABELS: Record<string, string> = {
    mobile: 'گوشی موبایل',
    tablet: 'تبلت',
    desktop: 'دسکتاپ و لپ‌تاپ',
  };
  const OS_LABELS: Record<string, string> = {
    android: 'اندروید',
    ios: 'آیفون و آیپد',
    windows: 'ویندوز',
    macos: 'مک',
    linux: 'لینوکس',
    other: 'سایر',
  };

  const byType = ['mobile', 'desktop', 'tablet'].map((key) => {
    const count = deviceTypeCounts.get(key) || 0;
    return {
      key,
      label: DEVICE_LABELS[key] || key,
      count,
      percent: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
    };
  });

  const byOs = Array.from(osCounts.entries())
    .map(([key, count]) => ({
      key,
      label: OS_LABELS[key] || key,
      count,
      percent: totalSessions > 0 ? Math.round((count / totalSessions) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const hourlyHeatmap = hourBuckets.map((b) => ({
    hour: b.hour,
    label: `${toFaDigits(String(b.hour).padStart(2, '0'))}:۰۰`,
    visits: b.visits,
    avgDwellSeconds: b.visits > 0 ? Math.round(b.totalDur / b.visits) : 0,
  }));

  // Find peak 3-hour window
  let bestWindowStart = 18;
  let bestWindowVisits = -1;
  for (let start = 0; start < 24; start++) {
    const sum3 =
      hourBuckets[start].visits +
      hourBuckets[(start + 1) % 24].visits +
      hourBuckets[(start + 2) % 24].visits;
    if (sum3 > bestWindowVisits) {
      bestWindowVisits = sum3;
      bestWindowStart = start;
    }
  }
  const peakWindowLabel = `${toFaDigits(String(bestWindowStart).padStart(2, '0'))}:۰۰ تا ${toFaDigits(
    String((bestWindowStart + 3) % 24).padStart(2, '0')
  )}:۰۰`;

  // Scroll depth funnel & Section Attention Physics
  const scrollByDepth = new Map<number, Set<string>>([
    [25, new Set()],
    [50, new Set()],
    [75, new Set()],
    [100, new Set()],
  ]);

  const sectionStats = new Map<
    string,
    {views: number; totalDwell: number; skips: number; interactions: number}
  >();

  const recipePassive = new Map<
    string,
    {id: string; label: string; category: string; views: number; totalDwell: number; cookStarts: number}
  >();
  const brandPassive = new Map<string, {id: string; label: string; views: number; clicks: number}>();
  const venuePassive = new Map<string, {id: string; label: string; category: string; views: number}>();
  const chefPassive = new Map<string, {id: string; label: string; views: number}>();

  let hardBlockedIncompatibleViews = 0;

  // Per-subject loyalty counters
  const subjectLoyalty = new Map<
    string,
    {
      sessions: number;
      totalDwell: number;
      recipeViews: number;
      cookStarts: number;
      cookCompletes: number;
      fridgeSearches: number;
      shoppingAdds: number;
      venueViews: number;
      brandViews: number;
    }
  >();

  const ensureSubject = (key: string) => {
    let entry = subjectLoyalty.get(key);
    if (!entry) {
      entry = {
        sessions: subjectSessionCounts.get(key) || 1,
        totalDwell: 0,
        recipeViews: 0,
        cookStarts: 0,
        cookCompletes: 0,
        fridgeSearches: 0,
        shoppingAdds: 0,
        venueViews: 0,
        brandViews: 0,
      };
      subjectLoyalty.set(key, entry);
    }
    return entry;
  };

  for (const s of sessions) {
    const sub = ensureSubject(s.subject_key);
    sub.totalDwell += Number(s.duration_seconds || 0);
  }

  for (const ev of events) {
    const sub = ensureSubject(ev.subject_key);
    const secKey = ev.section_name || 'explore';
    const sec = sectionStats.get(secKey) || {views: 0, totalDwell: 0, skips: 0, interactions: 0};

    if (ev.event_type === 'scroll_depth') {
      const d = Number(ev.numeric_value || 0);
      const bucket = d >= 95 ? 100 : d >= 70 ? 75 : d >= 45 ? 50 : 25;
      for (const milestone of [25, 50, 75, 100]) {
        if (milestone <= bucket) {
          scrollByDepth.get(milestone)!.add(ev.session_id || ev.subject_key);
        }
      }
      sec.views += 1;
      sec.totalDwell += Math.min(240, Math.max(10, bucket * 1.4));
    } else if (ev.event_type === 'section_skip') {
      sec.views += 1;
      sec.skips += 1;
      sec.totalDwell += Math.max(1, Number(ev.numeric_value || 4));
    } else if (ev.event_type === 'recipe_view') {
      sub.recipeViews += 1;
      sec.views += 1;
      sec.totalDwell += Math.max(15, Number(ev.numeric_value || 120));
      sec.interactions += 1;
      if (ev.target_id) {
        const prev = recipePassive.get(ev.target_id) || {
          id: ev.target_id,
          label: ev.target_label || 'دستورپخت',
          category: ev.category || 'عمومی',
          views: 0,
          totalDwell: 0,
          cookStarts: 0,
        };
        prev.views += 1;
        prev.totalDwell += Math.max(15, Number(ev.numeric_value || 120));
        recipePassive.set(ev.target_id, prev);
      }
    } else if (ev.event_type === 'recipe_cook_start') {
      sub.cookStarts += 1;
      sec.views += 1;
      sec.interactions += 1;
      sec.totalDwell += Math.max(60, Number(ev.numeric_value || 240));
      if (ev.target_id && recipePassive.has(ev.target_id)) {
        recipePassive.get(ev.target_id)!.cookStarts += 1;
      }
    } else if (ev.event_type === 'recipe_cook_complete') {
      sub.cookCompletes += 1;
      sec.interactions += 1;
    } else if (ev.event_type === 'partner_view') {
      sub.brandViews += 1;
      sec.views += 1;
      sec.totalDwell += Math.max(3, Number(ev.numeric_value || 20));
      if (ev.target_id) {
        const prev = brandPassive.get(ev.target_id) || {
          id: ev.target_id,
          label: ev.target_label || 'برند همکار',
          views: 0,
          clicks: 0,
        };
        prev.views += 1;
        brandPassive.set(ev.target_id, prev);
      }
    } else if (ev.event_type === 'ad_click') {
      sec.interactions += 1;
      if (ev.target_id && brandPassive.has(ev.target_id)) {
        brandPassive.get(ev.target_id)!.clicks += 1;
      }
    } else if (ev.event_type === 'venue_view') {
      sub.venueViews += 1;
      sec.views += 1;
      sec.interactions += 1;
      sec.totalDwell += Math.max(10, Number(ev.numeric_value || 25));
      if (ev.target_id) {
        const prev = venuePassive.get(ev.target_id) || {
          id: ev.target_id,
          label: ev.target_label || 'رستوران همکار',
          category: ev.category || 'restaurant',
          views: 0,
        };
        prev.views += 1;
        venuePassive.set(ev.target_id, prev);
      }
    } else if (ev.event_type === 'chef_view') {
      sec.views += 1;
      sec.interactions += 1;
      if (ev.target_id) {
        const prev = chefPassive.get(ev.target_id) || {
          id: ev.target_id,
          label: ev.target_label || 'سرآشپز',
          views: 0,
        };
        prev.views += 1;
        chefPassive.set(ev.target_id, prev);
      }
    } else if (ev.event_type === 'fridge_search') {
      sub.fridgeSearches += 1;
      sec.views += 1;
      sec.interactions += 1;
      sec.totalDwell += Math.max(20, Number(ev.numeric_value || 55));
    } else if (ev.event_type === 'shopping_add') {
      sub.shoppingAdds += 1;
      sec.views += 1;
      sec.interactions += 1;
      sec.totalDwell += Math.max(15, Number(ev.numeric_value || 35));
    } else if (ev.event_type === 'ad_diet_blocked') {
      hardBlockedIncompatibleViews += Math.max(1, Number(ev.numeric_value || 1));
    } else if (ev.event_type === 'tab_view') {
      sec.views += 1;
      sec.totalDwell += Math.max(8, Number(ev.numeric_value || 30));
    }

    sectionStats.set(secKey, sec);
  }

  const scrollDenom = Math.max(1, totalSessions);
  const scrollFunnel = [
    {depth: 25, label: 'عمق ۲۵٪ صفحه (شروع کاوش)'},
    {depth: 50, label: 'عمق ۵۰٪ صفحه (میانه فید)'},
    {depth: 75, label: 'عمق ۷۵٪ صفحه (مطالعه عمیق)'},
    {depth: 100, label: 'عمق ۱۰۰٪ صفحه (تکمیل کامل)'},
  ].map((m) => {
    const cnt = scrollByDepth.get(m.depth)!.size;
    return {
      depth: m.depth,
      label: m.label,
      sessionsCount: cnt,
      reachPercent: Math.min(100, Math.round((cnt / scrollDenom) * 100)),
    };
  });

  const AD_RECOMMENDATION_BY_SECTION: Record<string, string> = {
    recipe_detail: 'سربرگ دستورپخت و یادداشت متنی یک‌خطی درون مواد اولیه (بیشترین مکث)',
    cooking_mode: 'پیشنهاد آرام ابزار پخت در پایان مراحل (بدون مزاحمت حین تایمر)',
    explore: 'بنر تحریریه‌ای فید پس از هر ۶ دستور در عمق ۵۰٪ تا ۷۵٪',
    kitchen: 'همراه یخچال هوشمند و پیشنهاد جایگزین برند همکار',
    shopping: 'توصیه آرام خرید برند متناسب با اقلام لیست خرید',
    nearby_venues: 'کارت رستوران و کافه محلی دقیقاً برای کاربران کم‌حوصله برای پخت',
    marketplace: 'کاهش شلوغی و تمرکز روی لینک‌های مستقیم از دل دستورپخت‌ها',
  };

  const sectionZones = Array.from(sectionStats.entries())
    .map(([sectionKey, st]) => {
      const avgDwellSeconds = st.views > 0 ? Math.round(st.totalDwell / st.views) : 0;
      const fastSkipPercent = st.views > 0 ? Math.min(100, Math.round((st.skips / st.views) * 100)) : 0;
      const interactionRatePercent =
        st.views > 0 ? Math.min(100, Math.round((st.interactions / st.views) * 100)) : 0;
      const attentionVerdict: 'high_attention' | 'moderate' | 'fast_skip' =
        fastSkipPercent >= 35
          ? 'fast_skip'
          : avgDwellSeconds >= 50 || interactionRatePercent >= 65
            ? 'high_attention'
            : 'moderate';
      return {
        sectionKey,
        sectionLabel: SECTION_LABELS_FA[sectionKey] || sectionKey,
        views: st.views,
        avgDwellSeconds,
        fastSkipPercent,
        interactionRatePercent,
        attentionVerdict,
        recommendedAdPlacement:
          AD_RECOMMENDATION_BY_SECTION[sectionKey] || 'نمایش بومی متناسب با دسته غذایی',
      };
    })
    .sort((a, b) => b.avgDwellSeconds - a.avgDwellSeconds);

  // Dietary safety summary
  const dietCounts = new Map<DietaryTagId, number>();
  const excludedKeywordCounts = new Map<string, number>();
  let strictExclusionEnabledSubjects = 0;

  for (const dp of dietProfiles) {
    const diets = JSON.parse(dp.diets_json || '[]') as DietaryTagId[];
    const excluded = JSON.parse(dp.excluded_ingredients_json || '[]') as string[];
    if (diets.length > 0 || excluded.length > 0) {
      strictExclusionEnabledSubjects += 1;
    }
    for (const d of diets) {
      if (VALID_DIET_IDS.has(d)) {
        dietCounts.set(d, (dietCounts.get(d) || 0) + 1);
      }
    }
    for (const kw of excluded) {
      const clean = String(kw).trim();
      if (clean) {
        excludedKeywordCounts.set(clean, (excludedKeywordCounts.get(clean) || 0) + 1);
      }
    }
  }

  const dietDenom = Math.max(1, uniqueSubjectsCount);
  const dietBreakdown = DIETARY_OPTIONS.map((opt) => {
    const count = dietCounts.get(opt.id) || 0;
    return {
      dietId: opt.id,
      label: opt.label,
      count,
      percent: Math.round((count / dietDenom) * 100),
    };
  })
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);

  const topExcludedKeywords = Array.from(excludedKeywordCounts.entries())
    .map(([keyword, count]) => ({keyword, count}))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Loyalty, Cooking Participation & Subscription Readiness Radar
  const communityAuthors = (
    db.prepare('SELECT COUNT(DISTINCT author_id) as c FROM recipes').get() as {c: number}
  ).c;
  const communityPhotoContributors = (
    db.prepare('SELECT COUNT(DISTINCT user_id) as c FROM recipe_photos').get() as {c: number}
  ).c;
  const totalUsersDb = Math.max(
    1,
    (db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number}).c
  );

  let loyaltySum = 0;
  let activeCooksCount = 0;
  let highReadyCount = 0;

  const personaBuckets = {
    power_cook: 0,
    weekly_planner: 0,
    passive_explorer: 0,
    local_diner: 0,
  };

  for (const [, st] of subjectLoyalty.entries()) {
    const score = Math.min(
      100,
      Math.round(
        Math.min(30, st.sessions * 12) +
          Math.min(25, st.cookStarts * 15 + st.cookCompletes * 10) +
          Math.min(25, st.fridgeSearches * 12 + st.shoppingAdds * 13) +
          Math.min(20, Math.round(st.totalDwell / 90))
      )
    );
    loyaltySum += score;
    if (st.cookStarts > 0 || st.cookCompletes > 0) activeCooksCount += 1;
    if (score >= 65) highReadyCount += 1;

    if (st.cookStarts >= 1 && (st.fridgeSearches > 0 || st.shoppingAdds > 0)) {
      personaBuckets.power_cook += 1;
    } else if (st.fridgeSearches > 0 || st.shoppingAdds > 0 || st.sessions >= 2) {
      personaBuckets.weekly_planner += 1;
    } else if (st.venueViews > 0 && st.cookStarts === 0) {
      personaBuckets.local_diner += 1;
    } else {
      personaBuckets.passive_explorer += 1;
    }
  }

  const subjectTotal = Math.max(1, subjectLoyalty.size);
  const averageLoyaltyScore = Math.round(loyaltySum / subjectTotal);
  const activeCookingRatioPercent = Math.round((activeCooksCount / subjectTotal) * 100);
  const communityParticipationPercent = Math.min(
    100,
    Math.round(((communityAuthors + communityPhotoContributors) / (totalUsersDb * 2)) * 100)
  );
  const subscriptionReadinessPercent = Math.round((highReadyCount / subjectTotal) * 100);

  const personas = [
    {
      id: 'power_cook',
      label: 'آشپز فعال و برنامه‌ریز (بالاترین وفاداری)',
      description: 'حالت آشپزی را اجرا می‌کند، از یخچال هوشمند و لیست خرید استفاده می‌کند و بازگشت منظم دارد.',
      usersCount: personaBuckets.power_cook,
      sharePercent: Math.round((personaBuckets.power_cook / subjectTotal) * 100),
      subscriptionFit: 'high' as const,
    },
    {
      id: 'weekly_planner',
      label: 'کاربر منظم هفتگی و حساس به رژیم',
      description: 'هفته‌ای چند بار سر می‌زند، دستورها را عمیق می‌خواند و از فیلترهای رژیمی استفاده می‌کند.',
      usersCount: personaBuckets.weekly_planner,
      sharePercent: Math.round((personaBuckets.weekly_planner / subjectTotal) * 100),
      subscriptionFit: 'medium' as const,
    },
    {
      id: 'local_diner',
      label: 'رستوران‌گرد و کافه‌پسند محلی',
      description: 'دستورها را می‌بیند اما کمتر می‌پزد و توجه بالایی به کارت رستوران و کافه‌های اطراف دارد.',
      usersCount: personaBuckets.local_diner,
      sharePercent: Math.round((personaBuckets.local_diner / subjectTotal) * 100),
      subscriptionFit: 'low' as const,
    },
    {
      id: 'passive_explorer',
      label: 'الهام‌گیرنده و خواننده خاموش',
      description: 'بدون لایک یا مشارکت، دستورها و برندها را مرور می‌کند؛ بهترین مخاطب تبلیغات بومی آرام.',
      usersCount: personaBuckets.passive_explorer,
      sharePercent: Math.round((personaBuckets.passive_explorer / subjectTotal) * 100),
      subscriptionFit: 'low' as const,
    },
  ];

  const futureValueSignals = [
    {
      featureLabel: 'برنامه غذایی هفتگی و مدیریت هوشمند یخچال + لیست خرید',
      demandScorePercent: Math.min(96, Math.max(48, Math.round(activeCookingRatioPercent * 1.1 + 18))),
      rationale: 'مبتنی بر تکرار بالای استفاده از یخچال هوشمند و لیست خرید در میان آشپزان فعال',
    },
    {
      featureLabel: 'فیلتر سخت‌گیرانه رژیم شخصی و تجربه مطالعه بدون تبلیغ',
      demandScorePercent: Math.min(92, Math.max(42, Math.round((strictExclusionEnabledSubjects / dietDenom) * 100))),
      rationale: 'سهم بالای کاربرانی که رژیم غذایی مشخص (وگان، گیاه‌خوار، بدون لبنیات) ثبت کرده‌اند',
    },
    {
      featureLabel: 'دسترسی زودهنگام به دستورهای ویژه سرآشپزان تاییدشده',
      demandScorePercent: Math.min(88, Math.max(38, Math.round(averageLoyaltyScore * 0.95))),
      rationale: 'مبتنی بر عمق مطالعه بالای ۷۵٪ و مدت مکث طولانی روی دستورهای مجلسی',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      totalTrackedSessions: totalSessions,
      uniqueSubjectsCount,
      totalEventsRecorded: events.length,
      avgSessionDurationSeconds: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
      longestSessionSeconds: longestDuration,
      returningRatePercent,
      dietSafeBlockedAdsCount: hardBlockedIncompatibleViews,
    },
    devices: {
      byType,
      byOs,
      pwaSharePercent: totalSessions > 0 ? Math.round((pwaCount / totalSessions) * 100) : 0,
      darkThemeSharePercent: totalSessions > 0 ? Math.round((darkCount / totalSessions) * 100) : 0,
    },
    temporal: {
      hourlyHeatmap,
      peakWindowLabel,
      weekdayVsWeekend: {
        weekdayPercent: totalSessions > 0 ? Math.round(((totalSessions - weekendCount) / totalSessions) * 100) : 70,
        weekendPercent: totalSessions > 0 ? Math.round((weekendCount / totalSessions) * 100) : 30,
      },
    },
    attentionPhysics: {
      scrollFunnel,
      sectionZones,
    },
    passiveAffinities: {
      topRecipes: Array.from(recipePassive.values())
        .map((r) => ({
          id: r.id,
          label: r.label,
          category: r.category,
          passiveViews: r.views,
          avgDwellSeconds: r.views > 0 ? Math.round(r.totalDwell / r.views) : 0,
          cookStarts: r.cookStarts,
        }))
        .sort((a, b) => b.passiveViews - a.passiveViews || b.avgDwellSeconds - a.avgDwellSeconds)
        .slice(0, 8),
      topBrands: Array.from(brandPassive.values())
        .map((b) => ({id: b.id, label: b.label, passiveViews: b.views, clicks: b.clicks}))
        .sort((a, b) => b.passiveViews - a.passiveViews)
        .slice(0, 6),
      topVenues: Array.from(venuePassive.values())
        .map((v) => ({id: v.id, label: v.label, category: v.category, passiveViews: v.views}))
        .sort((a, b) => b.passiveViews - a.passiveViews)
        .slice(0, 6),
      topChefs: Array.from(chefPassive.values())
        .map((c) => ({id: c.id, label: c.label, passiveViews: c.views}))
        .sort((a, b) => b.passiveViews - a.passiveViews)
        .slice(0, 6),
    },
    dietarySafety: {
      strictExclusionEnabledSubjects,
      dietBreakdown,
      hardBlockedIncompatibleViews,
      topExcludedKeywords,
    },
    loyaltyAndSubscriptionRadar: {
      averageLoyaltyScore,
      activeCookingRatioPercent,
      communityParticipationPercent,
      subscriptionReadinessPercent,
      addressableLoyalUsersCount: highReadyCount,
      personas,
      futureValueSignals,
      nextPhaseNote:
        'این بخش صرفاً رادار تحلیلی و داده‌محور برای تصمیم‌گیری مدیر ارشد است. طراحی بسته، قیمت‌گذاری و اجرای تجاری اشتراک کاربری در طرح مستقل چندجلسه‌ای پس از تثبیت این فاز انجام خواهد شد.',
    },
    approvedReports: listApprovedReports(false),
  };
}

function shortenRecipeTitle(title: string, maxLen = 22): string {
  const clean = title.trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1)}…` : clean;
}

function computeBehavioralChartsReport(): AdminBehavioralChartsReportPayload {
  const sessions = db
    .prepare(
      'SELECT id, duration_seconds, visit_hour FROM behavior_sessions ORDER BY last_seen_at DESC LIMIT 3000'
    )
    .all() as {id: string; duration_seconds: number; visit_hour: number}[];

  const events = db
    .prepare(
      `SELECT session_id, event_type, section_name, target_type, target_id, target_label, category, numeric_value, created_at
       FROM behavior_events
       ORDER BY created_at DESC LIMIT 10000`
    )
    .all() as {
    session_id: string | null;
    event_type: string;
    section_name: string;
    target_type: string;
    target_id: string;
    target_label: string;
    category: string;
    numeric_value: number;
    created_at: string;
  }[];

  const sessionHourMap = new Map<string, number>();
  const hourBuckets = Array.from({length: 24}, (_, hour) => ({
    hour,
    visits: 0,
    totalDwell: 0,
    interactions: 0,
  }));

  for (const s of sessions) {
    const h = Math.max(0, Math.min(23, Number(s.visit_hour || 0)));
    sessionHourMap.set(s.id, h);
    hourBuckets[h].visits += 1;
    hourBuckets[h].totalDwell += Math.max(0, Number(s.duration_seconds || 0));
  }

  const recipeMap = new Map<
    string,
    {
      id: string;
      title: string;
      category: string;
      views: number;
      totalDwell: number;
      cookStarts: number;
      scrollSum: number;
      scrollSamples: number;
      clickIntervalSumMs: number;
      clickIntervalSamples: number;
    }
  >();

  const ensureRecipe = (id: string, title: string, category: string) => {
    let rec = recipeMap.get(id);
    if (!rec) {
      rec = {
        id,
        title: title || 'دستورپخت',
        category: category || 'عمومی',
        views: 0,
        totalDwell: 0,
        cookStarts: 0,
        scrollSum: 0,
        scrollSamples: 0,
        clickIntervalSumMs: 0,
        clickIntervalSamples: 0,
      };
      recipeMap.set(id, rec);
    } else {
      if (title && rec.title === 'دستورپخت') rec.title = title;
      if (category && rec.category === 'عمومی') rec.category = category;
    }
    return rec;
  };

  const scrollByDepth = new Map<number, Set<string>>([
    [25, new Set()],
    [50, new Set()],
    [75, new Set()],
    [100, new Set()],
  ]);

  const clickBuckets = {
    rapid: 0, // < 3s
    active: 0, // 3s - 10s
    deep: 0, // 10s - 30s
    cooking: 0, // > 30s
  };

  let totalClickIntervalMs = 0;
  let totalClickIntervalCount = 0;
  let totalScrollValues = 0;
  let totalScrollCount = 0;

  for (const ev of events) {
    const h =
      ev.session_id && sessionHourMap.has(ev.session_id)
        ? sessionHourMap.get(ev.session_id)!
        : new Date(ev.created_at).getHours();

    if (
      ev.event_type === 'recipe_view' ||
      ev.event_type === 'recipe_cook_start' ||
      ev.event_type === 'click_interval' ||
      ev.event_type === 'fridge_search' ||
      ev.event_type === 'shopping_add'
    ) {
      if (h >= 0 && h < 24) hourBuckets[h].interactions += 1;
    }

    if (ev.event_type === 'recipe_view' && ev.target_id) {
      const rec = ensureRecipe(ev.target_id, ev.target_label, ev.category);
      rec.views += 1;
      rec.totalDwell += Math.max(10, Number(ev.numeric_value || 90));
    } else if (ev.event_type === 'recipe_cook_start' && ev.target_id) {
      const rec = ensureRecipe(ev.target_id, ev.target_label, ev.category);
      rec.cookStarts += 1;
    } else if (ev.event_type === 'scroll_depth') {
      const d = Math.max(0, Math.min(100, Number(ev.numeric_value || 0)));
      totalScrollValues += d;
      totalScrollCount += 1;
      const bucket = d >= 95 ? 100 : d >= 70 ? 75 : d >= 45 ? 50 : 25;
      for (const milestone of [25, 50, 75, 100]) {
        if (milestone <= bucket) {
          scrollByDepth.get(milestone)!.add(ev.session_id || `${ev.target_id}:${ev.created_at}`);
        }
      }
      if (ev.target_type === 'recipe' && ev.target_id) {
        const rec = ensureRecipe(ev.target_id, ev.target_label, ev.category);
        rec.scrollSum += d;
        rec.scrollSamples += 1;
      }
    } else if (ev.event_type === 'click_interval') {
      const ms = Math.max(80, Math.min(120_000, Number(ev.numeric_value || 0)));
      totalClickIntervalMs += ms;
      totalClickIntervalCount += 1;
      if (ms < 3000) clickBuckets.rapid += 1;
      else if (ms < 10_000) clickBuckets.active += 1;
      else if (ms < 30_000) clickBuckets.deep += 1;
      else clickBuckets.cooking += 1;

      if (ev.target_id) {
        const rec = ensureRecipe(ev.target_id, ev.target_label, ev.category);
        rec.clickIntervalSumMs += ms;
        rec.clickIntervalSamples += 1;
      }
    }
  }

  const recipePopularity = Array.from(recipeMap.values())
    .filter((r) => r.views > 0 || r.cookStarts > 0)
    .map((r) => {
      const avgDwellSeconds = r.views > 0 ? Math.round(r.totalDwell / r.views) : 0;
      const avgScrollDepthPercent =
        r.scrollSamples > 0 ? Math.round(r.scrollSum / r.scrollSamples) : 72;
      const avgClickIntervalSec =
        r.clickIntervalSamples > 0
          ? Number((r.clickIntervalSumMs / r.clickIntervalSamples / 1000).toFixed(1))
          : 6.4;
      const popularityScore = Math.round(
        r.views * 14 + r.cookStarts * 22 + avgDwellSeconds * 0.12 + avgScrollDepthPercent * 0.25
      );
      return {
        id: r.id,
        title: r.title,
        shortTitle: shortenRecipeTitle(r.title, 20),
        category: r.category,
        views: r.views,
        avgDwellSeconds,
        cookStarts: r.cookStarts,
        avgScrollDepthPercent,
        avgClickIntervalSec,
        popularityScore,
      };
    })
    .sort((a, b) => b.views - a.views || b.popularityScore - a.popularityScore)
    .slice(0, 10);

  const catAgg = new Map<string, {views: number; totalDwell: number}>();
  let totalRecipeViews = 0;
  let totalRecipeDwell = 0;
  for (const r of recipePopularity) {
    totalRecipeViews += r.views;
    totalRecipeDwell += r.avgDwellSeconds * r.views;
    const prev = catAgg.get(r.category) || {views: 0, totalDwell: 0};
    prev.views += r.views;
    prev.totalDwell += r.avgDwellSeconds * r.views;
    catAgg.set(r.category, prev);
  }

  const catDenom = Math.max(1, totalRecipeViews);
  const categoryPopularity = Array.from(catAgg.entries())
    .map(([category, st]) => ({
      category,
      views: st.views,
      avgDwellSeconds: st.views > 0 ? Math.round(st.totalDwell / st.views) : 0,
      sharePercent: Math.round((st.views / catDenom) * 100),
    }))
    .sort((a, b) => b.views - a.views);

  const peakHours = hourBuckets.map((b) => ({
    hour: b.hour,
    label: `${toFaDigits(String(b.hour).padStart(2, '0'))}:۰۰`,
    visits: b.visits,
    avgDwellSeconds: b.visits > 0 ? Math.round(b.totalDwell / b.visits) : 0,
    interactions: b.interactions,
  }));

  let peakHour = 19;
  let peakHourVisits = -1;
  for (const b of peakHours) {
    if (b.visits > peakHourVisits) {
      peakHourVisits = b.visits;
      peakHour = b.hour;
    }
  }

  let bestWindowStart = 18;
  let bestWindowSum = -1;
  for (let start = 0; start < 24; start += 1) {
    const sum3 =
      hourBuckets[start].visits +
      hourBuckets[(start + 1) % 24].visits +
      hourBuckets[(start + 2) % 24].visits;
    if (sum3 > bestWindowSum) {
      bestWindowSum = sum3;
      bestWindowStart = start;
    }
  }
  const peakWindowLabel = `${toFaDigits(String(bestWindowStart).padStart(2, '0'))}:۰۰ تا ${toFaDigits(
    String((bestWindowStart + 3) % 24).padStart(2, '0')
  )}:۰۰`;

  const scrollDenom = Math.max(1, sessions.length);
  const scrollDepthDistribution = [
    {depth: 25, label: 'عمق ۲۵٪'},
    {depth: 50, label: 'عمق ۵۰٪'},
    {depth: 75, label: 'عمق ۷۵٪'},
    {depth: 100, label: 'عمق ۱۰۰٪'},
  ].map((m) => {
    const cnt = scrollByDepth.get(m.depth)!.size;
    return {
      depth: m.depth,
      label: m.label,
      sessionsCount: cnt,
      reachPercent: Math.min(100, Math.round((cnt / scrollDenom) * 100)),
    };
  });

  const clickDenom = Math.max(1, totalClickIntervalCount);
  const clickIntervalDistribution = [
    {
      bucketKey: 'rapid',
      label: 'زیر ۳ ثانیه',
      description: 'اسکن سریع مواد و کلیدها',
      count: clickBuckets.rapid,
      sharePercent: Math.round((clickBuckets.rapid / clickDenom) * 100),
    },
    {
      bucketKey: 'active',
      label: '۳ تا ۱۰ ثانیه',
      description: 'مطالعه فعال و بررسی جزئیات',
      count: clickBuckets.active,
      sharePercent: Math.round((clickBuckets.active / clickDenom) * 100),
    },
    {
      bucketKey: 'deep',
      label: '۱۰ تا ۳۰ ثانیه',
      description: 'مکث عمیق روی مراحل پخت',
      count: clickBuckets.deep,
      sharePercent: Math.round((clickBuckets.deep / clickDenom) * 100),
    },
    {
      bucketKey: 'cooking',
      label: 'بالای ۳۰ ثانیه',
      description: 'همراهی هم‌زمان در آشپزخانه',
      count: clickBuckets.cooking,
      sharePercent: Math.round((clickBuckets.cooking / clickDenom) * 100),
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalSessions: sessions.length,
      totalRecipeViews,
      avgRecipeDwellSeconds: totalRecipeViews > 0 ? Math.round(totalRecipeDwell / totalRecipeViews) : 0,
      avgScrollDepthPercent: totalScrollCount > 0 ? Math.round(totalScrollValues / totalScrollCount) : 0,
      avgClickIntervalMs:
        totalClickIntervalCount > 0 ? Math.round(totalClickIntervalMs / totalClickIntervalCount) : 0,
      peakHour,
      peakHourLabel: `${toFaDigits(String(peakHour).padStart(2, '0'))}:۰۰`,
      peakHourVisits: Math.max(0, peakHourVisits),
      peakWindowLabel,
    },
    recipePopularity,
    categoryPopularity,
    peakHours,
    scrollDepthDistribution,
    clickIntervalDistribution,
  };
}

export function registerBehavioralRoutes(app: express.Express, deps: BehavioralRouteDeps): void {
  // =========================================================================
  // 1. CONSUMER DIETARY PROFILE & STRICT AD SAFETY PREFERENCES
  // =========================================================================
  app.get('/api/preferences/diet', (req, res) => {
    const session = deps.getSession(req);
    const {subjectKey} = resolveSubjectKey(req, session);
    res.json({preferences: readDietaryPreferences(subjectKey)});
  });

  app.put('/api/preferences/diet', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!deps.checkRateLimit(`diet_pref:${ip}`, 40, 60_000)) {
      return res.status(429).json({error: 'تعداد درخواست‌ها بیش از حد مجاز است.'});
    }

    const schema = z.object({
      diets: z.array(z.string().min(2).max(32)).max(10),
      excludedIngredients: z.array(z.string().min(1).max(40)).max(20).optional().default([]),
      preferredMealTimes: z.array(z.string().min(1).max(30)).max(6).optional().default(['ناهار', 'شام']),
      cookingFrequency: z.enum(['daily', 'weekly', 'occasional', 'rarely']).optional().default('weekly'),
      strictAdFiltering: z.boolean().optional().default(true),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'تنظیمات رژیم و پرهیز غذایی نامعتبر است.'});
    }

    const cleanDiets = Array.from(new Set(parsed.data.diets.filter((d) => VALID_DIET_IDS.has(d))));
    const cleanExcluded = Array.from(
      new Set(parsed.data.excludedIngredients.map((i) => i.trim()).filter(Boolean))
    );
    const session = deps.getSession(req);
    const {subjectKey, userId} = resolveSubjectKey(req, session);
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_dietary_profiles (
        subject_key, user_id, diets_json, excluded_ingredients_json, preferred_meal_times_json,
        cooking_frequency, strict_ad_filtering, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(subject_key) DO UPDATE SET
        user_id = COALESCE(excluded.user_id, user_dietary_profiles.user_id),
        diets_json = excluded.diets_json,
        excluded_ingredients_json = excluded.excluded_ingredients_json,
        preferred_meal_times_json = excluded.preferred_meal_times_json,
        cooking_frequency = excluded.cooking_frequency,
        strict_ad_filtering = excluded.strict_ad_filtering,
        updated_at = excluded.updated_at
    `).run(
      subjectKey,
      userId,
      JSON.stringify(cleanDiets),
      JSON.stringify(cleanExcluded),
      JSON.stringify(parsed.data.preferredMealTimes),
      parsed.data.cookingFrequency,
      parsed.data.strictAdFiltering ? 1 : 0,
      now
    );

    res.json({preferences: readDietaryPreferences(subjectKey)});
  });

  // =========================================================================
  // 2. SILENT BATCHED BEHAVIORAL TELEMETRY INGESTION
  // =========================================================================
  app.post('/api/telemetry/batch', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!deps.checkRateLimit(`telemetry:${ip}`, 90, 60_000)) {
      return res.json({ok: true});
    }

    const schema = z.object({
      session: z.object({
        sessionId: z.string().min(6).max(64),
        deviceType: z.enum(['mobile', 'tablet', 'desktop']),
        osFamily: z.enum(['ios', 'android', 'windows', 'macos', 'linux', 'other']),
        displayMode: z.enum(['pwa', 'browser']),
        themeMode: z.enum(['light', 'dark']),
        viewportWidth: z.number().int().min(200).max(6000),
        durationSeconds: z.number().int().min(0).max(86400),
        pagesViewed: z.number().int().min(1).max(500),
      }),
      events: z
        .array(
          z.object({
            eventType: z.enum([
              'session_start',
              'session_heartbeat',
              'tab_view',
              'recipe_view',
              'recipe_cook_start',
              'recipe_cook_complete',
              'scroll_depth',
              'click_interval',
              'section_skip',
              'ad_impression',
              'ad_click',
              'ad_diet_blocked',
              'partner_view',
              'venue_view',
              'chef_view',
              'fridge_search',
              'shopping_add',
            ]),
            sectionName: z.string().max(50).optional().default(''),
            targetType: z.string().max(30).optional().default(''),
            targetId: z.string().max(80).optional().default(''),
            targetLabel: z.string().max(120).optional().default(''),
            category: z.string().max(60).optional().default(''),
            numericValue: z.number().min(0).max(120000).optional().default(0),
          })
        )
        .max(40)
        .default([]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'بسته داده رفتاری معتبر نیست.'});
    }

    const authSession = deps.getSession(req);
    // Do not pollute consumer telemetry with admin-root sessions
    if (authSession?.isAdmin && authSession.userId.startsWith('admin-')) {
      return res.json({ok: true});
    }

    const {subjectKey, userId} = resolveSubjectKey(req, authSession);
    const nowDate = new Date();
    const nowIso = nowDate.toISOString();
    const s = parsed.data.session;

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO behavior_sessions (
          id, subject_key, user_id, device_type, os_family, display_mode, theme_mode,
          viewport_width, started_at, last_seen_at, duration_seconds, visit_hour, day_of_week, pages_viewed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = COALESCE(excluded.user_id, behavior_sessions.user_id),
          theme_mode = excluded.theme_mode,
          last_seen_at = excluded.last_seen_at,
          duration_seconds = MAX(behavior_sessions.duration_seconds, excluded.duration_seconds),
          pages_viewed = MAX(behavior_sessions.pages_viewed, excluded.pages_viewed)
      `).run(
        s.sessionId,
        subjectKey,
        userId,
        s.deviceType,
        s.osFamily,
        s.displayMode,
        s.themeMode,
        s.viewportWidth,
        nowIso,
        nowIso,
        s.durationSeconds,
        nowDate.getHours(),
        nowDate.getDay(),
        s.pagesViewed
      );

      const insertEv = db.prepare(`
        INSERT INTO behavior_events (
          id, session_id, subject_key, user_id, event_type, section_name, target_type,
          target_id, target_label, category, numeric_value, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)
      `);

      for (const ev of parsed.data.events) {
        insertEv.run(
          `bev-${crypto.randomUUID().slice(0, 10)}`,
          s.sessionId,
          subjectKey,
          userId,
          ev.eventType,
          ev.sectionName,
          ev.targetType,
          ev.targetId,
          ev.targetLabel,
          ev.category,
          ev.numericValue,
          nowIso
        );
      }
    });

    tx();
    res.json({ok: true});
  });

  // =========================================================================
  // 2B. ADMIN BEHAVIORAL CHARTS REPORT (Recharts — Anonymized Aggregates)
  // Accessible to authorized admins with dashboard.view permission
  // =========================================================================
  app.get('/api/admin/behavioral-reports/charts', (req, res) => {
    const session = deps.requireAdmin(req, res, 'dashboard.view');
    if (!session) return;
    res.json(computeBehavioralChartsReport());
  });

  // =========================================================================
  // 3. EXECUTIVE-ONLY SUPER ADMIN BEHAVIORAL INTELLIGENCE HUB (senior_admin ONLY)
  // =========================================================================
  app.get('/api/admin/behavioral-intelligence', (req, res) => {
    const session = requireExecutiveAdmin(req, res, deps);
    if (!session) return;
    res.json(computeExecutiveBehavioralReport());
  });

  app.post('/api/admin/behavioral-intelligence/reports', (req, res) => {
    const session = requireExecutiveAdmin(req, res, deps);
    if (!session) return;

    const schema = z.object({
      title: z.string().min(4).max(140),
      audienceScope: z.enum(['brands', 'institutions', 'special_auctions']),
      publishedToAuctions: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'عنوان یا دامنه گزارش تجمیعی معتبر نیست.'});
    }

    const reportData = computeExecutiveBehavioralReport();
    const mobileShare = reportData.devices.byType.find((d) => d.key === 'mobile')?.percent || 0;
    const scroll75 = reportData.attentionPhysics.scrollFunnel.find((s) => s.depth === 75)?.reachPercent || 0;
    const bestZone = reportData.attentionPhysics.sectionZones[0];

    const categoryAgg = new Map<string, number>();
    for (const r of reportData.passiveAffinities.topRecipes) {
      categoryAgg.set(r.category, (categoryAgg.get(r.category) || 0) + r.passiveViews);
    }
    const catTotal = Math.max(1, Array.from(categoryAgg.values()).reduce((s, n) => s + n, 0));
    const topCategories = Array.from(categoryAgg.entries())
      .map(([label, val]) => ({label, sharePercent: Math.round((val / catTotal) * 100)}))
      .sort((a, b) => b.sharePercent - a.sharePercent)
      .slice(0, 4);

    // Strictly anonymized aggregate summary (ZERO PII, ZERO individual IDs)
    const anonymizedSummary: ApprovedExecutiveInsightReport['summary'] = {
      totalSessionsAnalyzed: reportData.overview.totalTrackedSessions,
      mobileSharePercent: mobileShare,
      peakHourRange: reportData.temporal.peakWindowLabel,
      avgDwellSeconds: reportData.overview.avgSessionDurationSeconds,
      longestSessionMinutes: Math.max(1, Math.round(reportData.overview.longestSessionSeconds / 60)),
      scroll75ReachPercent: scroll75,
      topCategories,
      dietaryRestrictionSharePercent: Math.round(
        (reportData.dietarySafety.strictExclusionEnabledSubjects /
          Math.max(1, reportData.overview.uniqueSubjectsCount)) *
          100
      ),
      bestAttentionSlot: bestZone ? `${bestZone.sectionLabel} (مکث میانگین ${bestZone.avgDwellSeconds} ثانیه)` : 'صفحه جزئیات دستورپخت',
      recommendedAdFormat: bestZone?.recommendedAdPlacement || 'سربرگ دستورپخت و یادداشت متنی درون مواد اولیه',
    };

    const id = `exrep-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO executive_insight_reports (
        id, title, audience_scope, approved_by, summary_json, published_to_auctions, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      parsed.data.title.trim(),
      parsed.data.audienceScope,
      session.actorName,
      JSON.stringify(anonymizedSummary),
      parsed.data.publishedToAuctions ? 1 : 0,
      now
    );

    res.status(201).json({
      id,
      reports: listApprovedReports(false),
    });
  });

  app.put('/api/admin/behavioral-intelligence/reports/:id', (req, res) => {
    const session = requireExecutiveAdmin(req, res, deps);
    if (!session) return;
    const published = Boolean(req.body?.publishedToAuctions);
    db.prepare('UPDATE executive_insight_reports SET published_to_auctions = ? WHERE id = ?').run(
      published ? 1 : 0,
      req.params.id
    );
    res.json({ok: true, reports: listApprovedReports(false)});
  });

  app.delete('/api/admin/behavioral-intelligence/reports/:id', (req, res) => {
    const session = requireExecutiveAdmin(req, res, deps);
    if (!session) return;
    db.prepare('DELETE FROM executive_insight_reports WHERE id = ?').run(req.params.id);
    res.json({ok: true, reports: listApprovedReports(false)});
  });

  // =========================================================================
  // 4. ANONYMIZED APPROVED DEMAND INSIGHTS FOR ADVERTISER SMART AUCTION ROOM
  // =========================================================================
  app.get('/api/advertiser/auctions/demand-insights', (req, res) => {
    if (!isValidAdvertiserSession(req)) {
      return res.status(401).json({error: 'احراز هویت پنل برند الزامی است.'});
    }
    res.json({reports: listApprovedReports(true)});
  });
}
