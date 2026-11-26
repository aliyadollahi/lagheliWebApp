import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import {DEFAULT_AD_HARMONY, isAdActiveInDateWindow} from '../shared/nativeAdEngine.ts';
import {DEFAULT_DYNAMIC_ROLES} from '../shared/rbac.ts';
import type {
  AdBidOrBooking,
  AdSlotInventory,
  AdminPermission,
  AdvertiserAccount,
  DynamicAppSectionsConfig,
  DynamicRoleDefinition,
  EcosystemConfig,
  FlagshipSponsorship,
  GemStoreOffer,
  LocalVenueSuggestion,
  NativeAdFormat,
  NativeAdMediaType,
  NativeAdUnit,
} from '../shared/types.ts';

const DB_PATH = process.env.SQLITE_PATH || path.resolve(process.cwd(), 'lagheli.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const DEFAULT_APP_SECTIONS: DynamicAppSectionsConfig = {
  heroEnabled: true,
  heroTitle: 'دستورهای اصیل، آرام و دقیق برای آشپزی روزمره',
  heroSubtitle: 'مرجع دستورپخت ایرانی با مقیاس هوشمند نفرات، تایمر گام‌به‌گام و آشپزخانه بدون اتلاف مواد.',
  editorialNotice: '',
  searchBarEnabled: true,
  quickCategoriesEnabled: true,
  kitchenTabEnabled: true,
  shoppingTabEnabled: true,
  submitRecipeEnabled: true,
  featuredCategories: [
    'همه',
    'ناهار و شام',
    'پیش‌غذا و عصرانه',
    'وگان و گیاهی',
    'پخت سریع',
    'رژیمی و سبک',
    'پرپروتئین',
    'غذای شمالی',
  ],
};

export const DEFAULT_ECOSYSTEM_CONFIG: EcosystemConfig = {
  marketplaceTabEnabled: true,
  marketplaceTitle: 'برندهای همکار',
  exploreShowcaseEnabled: true,
  recipeContextEnabled: true,
  shoppingDeliveryCardEnabled: false,
  maxPartnerCardsPerRecipe: 1,
  enabledPartnerRoles: [
    'food_brands',
    'kitchen_equipment',
    'stores_supermarkets',
    'chefs_nutritionists',
    'culinary_schools',
    'local_artisans',
  ],
  activeCampaignTitle: 'برندهای منتخب تحریریه لاقلی',
  appSections: DEFAULT_APP_SECTIONS,
  adHarmony: DEFAULT_AD_HARMONY,
};

export const GEM_STORE_OFFERS: GemStoreOffer[] = [
  {
    id: 'offer-zafaran',
    title: 'تخفیف ۱۵٪ زعفران سرگل قائنات',
    partnerName: 'خانه زعفران خراسان',
    discountLabel: '۱۵٪ تخفیف خرید اول',
    gemCost: 60,
    codePrefix: 'ZAF',
  },
  {
    id: 'offer-castiron',
    title: 'کوپن ۱۲۰٬۰۰۰ تومانی ظروف چدنی دست‌ساز',
    partnerName: 'کارگاه ظروف چدنی رَست',
    discountLabel: '۱۲۰٬۰۰۰ تومان تخفیف',
    gemCost: 90,
    codePrefix: 'RST',
  },
  {
    id: 'offer-express',
    title: 'ارسال رایگان خرید مواد تازه (۲ نوبت)',
    partnerName: 'پیک سبز لاقلی',
    discountLabel: 'ارسال رایگان فوری',
    gemCost: 45,
    codePrefix: 'EXP',
  },
  {
    id: 'offer-order',
    title: 'کوپن ۸۰٬۰۰۰ تومانی سفارش غذای روز',
    partnerName: 'سفره ادیتوریال لاقلی',
    discountLabel: '۸۰٬۰۰۰ تومان تخفیف سفارش',
    gemCost: 75,
    codePrefix: 'LAG',
  },
];

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL DEFAULT 'تهران',
      neighborhood TEXT NOT NULL DEFAULT 'ونک',
      bio TEXT NOT NULL DEFAULT '',
      specialty TEXT NOT NULL DEFAULT 'آشپزی اصیل ایرانی',
      is_verified_chef INTEGER NOT NULL DEFAULT 0,
      chef_verification_status TEXT NOT NULL DEFAULT 'none',
      role TEXT NOT NULL DEFAULT 'user',
      xp INTEGER NOT NULL DEFAULT 60,
      gems INTEGER NOT NULL DEFAULT 120,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS admin_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT NOT NULL,
      category TEXT NOT NULL,
      region TEXT NOT NULL,
      season TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      diet_tags_json TEXT NOT NULL,
      prep_minutes INTEGER NOT NULL,
      cook_minutes INTEGER NOT NULL,
      servings INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      nutrition_json TEXT NOT NULL,
      is_vip INTEGER NOT NULL DEFAULT 0,
      vip_gem_cost INTEGER NOT NULL DEFAULT 0,
      parent_recipe_id TEXT,
      variation_note TEXT,
      author_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      ingredients_json TEXT NOT NULL,
      steps_json TEXT NOT NULL,
      tools_json TEXT NOT NULL,
      linked_menu_dish_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookmarks (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS unlocked_recipes (
      user_id TEXT NOT NULL,
      recipe_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, recipe_id)
    );

    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT NOT NULL,
      following_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS recipe_questions (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      solved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_answers (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_verified INTEGER NOT NULL DEFAULT 0,
      body TEXT NOT NULL,
      upvotes INTEGER NOT NULL DEFAULT 0,
      is_best INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      amount REAL NOT NULL,
      unit TEXT NOT NULL,
      category TEXT NOT NULL,
      recipe_id TEXT,
      recipe_title TEXT,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      story TEXT NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT NOT NULL,
      chef_name TEXT NOT NULL,
      chef_verified INTEGER NOT NULL DEFAULT 1,
      prep_minutes INTEGER NOT NULL,
      calories INTEGER NOT NULL,
      single_price INTEGER NOT NULL,
      double_price INTEGER NOT NULL,
      diet_tags_json TEXT NOT NULL,
      key_ingredients_json TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0,
      linked_recipe_id TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      tracking_code TEXT UNIQUE NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      delivery_slot TEXT NOT NULL,
      note TEXT,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      packaging_fee INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role_type TEXT NOT NULL,
      city TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      description TEXT NOT NULL,
      address TEXT NOT NULL,
      phone TEXT NOT NULL,
      website TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      claim_status TEXT NOT NULL DEFAULT 'verified',
      tier TEXT NOT NULL DEFAULT 'free',
      promo_code TEXT,
      promo_label TEXT,
      affiliate_code TEXT,
      related_ingredients_json TEXT NOT NULL,
      related_tools_json TEXT NOT NULL,
      catalog_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_follows (
      user_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, partner_id)
    );

    CREATE TABLE IF NOT EXISTS partner_events (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gem_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_coupons (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      code TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      discount_label TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_photos (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      is_cover INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,
      account_type TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sponsor_campaigns (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      placement TEXT NOT NULL,
      promo_code TEXT,
      cta_label TEXT NOT NULL DEFAULT 'مشاهده پیشنهاد',
      budget_toman INTEGER NOT NULL DEFAULT 0,
      spent_toman INTEGER NOT NULL DEFAULT 0,
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT,
      ends_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rbac_audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      target_user_id TEXT NOT NULL,
      target_user_name TEXT NOT NULL,
      previous_role TEXT NOT NULL,
      new_role TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_versions (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      change_summary TEXT NOT NULL DEFAULT '',
      snapshot_json TEXT NOT NULL,
      created_by_id TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      reviewed_by_id TEXT,
      reviewed_by_name TEXT,
      review_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS search_logs (
      id TEXT PRIMARY KEY,
      query_raw TEXT NOT NULL,
      query_norm TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'search',
      results_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS acl_roles (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      short_label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      permissions_json TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS native_ads (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      format TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      editorial_copy TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT 'آشنایی با برند',
      target_url TEXT,
      match_keywords_json TEXT NOT NULL DEFAULT '[]',
      match_categories_json TEXT NOT NULL DEFAULT '[]',
      priority INTEGER NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'active',
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ad_slots (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL,
      media_type TEXT NOT NULL DEFAULT 'banner',
      target_category TEXT NOT NULL DEFAULT 'همه دسته‌ها',
      pricing_model TEXT NOT NULL DEFAULT 'hybrid',
      fixed_price_toman INTEGER NOT NULL DEFAULT 5000000,
      min_bid_toman INTEGER NOT NULL DEFAULT 3500000,
      bid_step_toman INTEGER NOT NULL DEFAULT 500000,
      is_exclusive INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ad_bids (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      advertiser_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      booking_type TEXT NOT NULL DEFAULT 'auction',
      bid_amount_toman INTEGER NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      editorial_copy TEXT NOT NULL DEFAULT '',
      cta_label TEXT NOT NULL DEFAULT 'مشاهده جزئیات',
      target_url TEXT,
      utm_source TEXT NOT NULL DEFAULT 'lagheli',
      utm_medium TEXT NOT NULL DEFAULT 'native_ad',
      utm_campaign TEXT NOT NULL DEFAULT '',
      recipe_categories_json TEXT NOT NULL DEFAULT '[]',
      match_keywords_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      admin_note TEXT NOT NULL DEFAULT '',
      created_ad_id TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS flagship_sponsorships (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      cta_label TEXT NOT NULL DEFAULT 'آشنایی با حامی',
      target_url TEXT,
      utm_campaign TEXT NOT NULL DEFAULT '',
      duration TEXT NOT NULL DEFAULT '3m',
      price_toman INTEGER NOT NULL DEFAULT 120000000,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_venues (
      id TEXT PRIMARY KEY,
      partner_id TEXT,
      name TEXT NOT NULL,
      venue_type TEXT NOT NULL DEFAULT 'restaurant',
      city TEXT NOT NULL DEFAULT 'تهران',
      neighborhood TEXT NOT NULL DEFAULT 'ونک',
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      lat REAL NOT NULL DEFAULT 35.7575,
      lng REAL NOT NULL DEFAULT 51.4099,
      served_dishes_json TEXT NOT NULL DEFAULT '[]',
      served_categories_json TEXT NOT NULL DEFAULT '[]',
      delivery_note TEXT NOT NULL DEFAULT '',
      menu_url TEXT,
      utm_campaign TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      impressions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advertiser_accounts (
      id TEXT PRIMARY KEY,
      partner_id TEXT NOT NULL,
      login_identifier TEXT UNIQUE NOT NULL,
      manager_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS advertiser_sessions (
      token_hash TEXT PRIMARY KEY,
      advertiser_id TEXT NOT NULL,
      partner_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_dietary_profiles (
      subject_key TEXT PRIMARY KEY,
      user_id TEXT,
      diets_json TEXT NOT NULL DEFAULT '[]',
      excluded_ingredients_json TEXT NOT NULL DEFAULT '[]',
      preferred_meal_times_json TEXT NOT NULL DEFAULT '["ناهار","شام"]',
      cooking_frequency TEXT NOT NULL DEFAULT 'weekly',
      strict_ad_filtering INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS behavior_sessions (
      id TEXT PRIMARY KEY,
      subject_key TEXT NOT NULL,
      user_id TEXT,
      device_type TEXT NOT NULL DEFAULT 'mobile',
      os_family TEXT NOT NULL DEFAULT 'android',
      display_mode TEXT NOT NULL DEFAULT 'browser',
      theme_mode TEXT NOT NULL DEFAULT 'light',
      viewport_width INTEGER NOT NULL DEFAULT 390,
      started_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      visit_hour INTEGER NOT NULL DEFAULT 19,
      day_of_week INTEGER NOT NULL DEFAULT 4,
      pages_viewed INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS behavior_events (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      subject_key TEXT NOT NULL,
      user_id TEXT,
      event_type TEXT NOT NULL,
      section_name TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      target_label TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      numeric_value REAL NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON behavior_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_behavior_events_subject ON behavior_events(subject_key);
    CREATE INDEX IF NOT EXISTS idx_behavior_sessions_subject ON behavior_sessions(subject_key);

    CREATE TABLE IF NOT EXISTS executive_insight_reports (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      audience_scope TEXT NOT NULL DEFAULT 'brands',
      approved_by TEXT NOT NULL,
      summary_json TEXT NOT NULL,
      published_to_auctions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  ensureSchemaUpgrades();
  seedInitialData();
  seedV2Content();
}

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {name: string}[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureSchemaUpgrades(): void {
  ensureColumn('users', 'wallet_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('users', 'is_suspended', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('recipes', 'photo_credit_name', 'TEXT');
  ensureColumn('partners', 'business_balance', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn('sessions', 'session_role', 'TEXT');
  ensureColumn('native_ads', 'media_type', "TEXT NOT NULL DEFAULT 'text'");
  ensureColumn('native_ads', 'recipe_categories_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('native_ads', 'utm_source', "TEXT NOT NULL DEFAULT 'lagheli'");
  ensureColumn('native_ads', 'utm_medium', "TEXT NOT NULL DEFAULT 'native_ad'");
  ensureColumn('native_ads', 'utm_campaign', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('native_ads', 'slot_id', 'TEXT');
  ensureColumn('native_ads', 'starts_at', 'TEXT');
  ensureColumn('native_ads', 'ends_at', 'TEXT');
  ensureColumn('native_ads', 'pricing_mode', "TEXT NOT NULL DEFAULT 'fixed'");
  ensureColumn('native_ads', 'bid_amount_toman', 'INTEGER NOT NULL DEFAULT 0');
}

export function getEcosystemConfig(): EcosystemConfig {
  const row = db
    .prepare('SELECT value_json FROM app_config WHERE key = ?')
    .get('ecosystem') as {value_json: string} | undefined;
  if (!row) {
    db.prepare('INSERT OR REPLACE INTO app_config (key, value_json) VALUES (?, ?)').run(
      'ecosystem',
      JSON.stringify(DEFAULT_ECOSYSTEM_CONFIG)
    );
    return DEFAULT_ECOSYSTEM_CONFIG;
  }
  const parsed = JSON.parse(row.value_json) as Partial<EcosystemConfig>;
  return {
    ...DEFAULT_ECOSYSTEM_CONFIG,
    ...parsed,
    marketplaceTitle:
      !parsed.marketplaceTitle || parsed.marketplaceTitle === 'بازارچه و اصناف'
        ? DEFAULT_ECOSYSTEM_CONFIG.marketplaceTitle
        : parsed.marketplaceTitle,
    appSections: {
      ...DEFAULT_APP_SECTIONS,
      ...(parsed.appSections || {}),
    },
    adHarmony: {
      ...DEFAULT_AD_HARMONY,
      ...(parsed.adHarmony || {}),
    },
  };
}

export function getAclRoles(): DynamicRoleDefinition[] {
  const rows = db.prepare('SELECT * FROM acl_roles ORDER BY is_system DESC, created_at ASC').all() as Record<
    string,
    unknown
  >[];
  if (rows.length === 0) {
    return DEFAULT_DYNAMIC_ROLES;
  }
  return rows.map((r) => ({
    id: String(r.id),
    label: String(r.label),
    shortLabel: String(r.short_label || r.label),
    description: String(r.description || ''),
    permissions: JSON.parse(String(r.permissions_json || '[]')) as AdminPermission[],
    isSystem: Number(r.is_system) === 1,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }));
}

export function mapNativeAdRow(row: Record<string, unknown>): NativeAdUnit {
  const fmt = row.format as NativeAdFormat;
  const fallbackMedia: NativeAdMediaType =
    fmt === 'feed_editorial_story' ? 'banner' : row.target_url ? 'click' : 'text';
  const rawMedia = String(row.media_type || fallbackMedia);
  const mediaType: NativeAdMediaType =
    rawMedia === 'banner' || rawMedia === 'click' || rawMedia === 'text' ? rawMedia : fallbackMedia;
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: String(row.partner_name || 'برند همکار لاقلی'),
    format: fmt,
    mediaType,
    title: String(row.title),
    subtitle: String(row.subtitle || ''),
    editorialCopy: String(row.editorial_copy || ''),
    ctaLabel: String(row.cta_label || 'آشنایی با برند'),
    targetUrl: row.target_url ? String(row.target_url) : undefined,
    utmSource: row.utm_source ? String(row.utm_source) : 'lagheli',
    utmMedium: row.utm_medium ? String(row.utm_medium) : mediaType,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : '',
    recipeCategories: JSON.parse(String(row.recipe_categories_json || '[]')),
    matchKeywords: JSON.parse(String(row.match_keywords_json || '[]')),
    matchCategories: JSON.parse(String(row.match_categories_json || '[]')),
    slotId: row.slot_id ? String(row.slot_id) : null,
    startsAt: row.starts_at ? String(row.starts_at) : null,
    endsAt: row.ends_at ? String(row.ends_at) : null,
    pricingMode:
      row.pricing_mode === 'auction' || row.pricing_mode === 'sponsorship' ? row.pricing_mode : 'fixed',
    bidAmountToman: Number(row.bid_amount_toman || 0),
    priority: Number(row.priority || 5),
    status: row.status === 'paused' ? 'paused' : 'active',
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    createdAt: String(row.created_at),
  };
}

export function getNativeAds(activeOnly = false): NativeAdUnit[] {
  const sql = activeOnly
    ? `SELECT na.*, p.name AS partner_name
       FROM native_ads na
       LEFT JOIN partners p ON p.id = na.partner_id
       WHERE na.status = 'active'
       ORDER BY na.priority DESC, na.created_at DESC`
    : `SELECT na.*, p.name AS partner_name
       FROM native_ads na
       LEFT JOIN partners p ON p.id = na.partner_id
       ORDER BY na.priority DESC, na.created_at DESC`;
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  return rows.map(mapNativeAdRow);
}

export function getAdSlots(openOnly = false): AdSlotInventory[] {
  const rows = db
    .prepare(
      openOnly
        ? "SELECT * FROM ad_slots WHERE status = 'open' ORDER BY created_at ASC"
        : 'SELECT * FROM ad_slots ORDER BY created_at ASC'
    )
    .all() as Record<string, unknown>[];

  const today = new Date().toISOString().slice(0, 10);

  return rows.map((row) => {
    const slotId = String(row.id);
    const activeAd = db
      .prepare(
        `SELECT na.starts_at, na.ends_at, p.name AS partner_name
         FROM native_ads na
         LEFT JOIN partners p ON p.id = na.partner_id
         WHERE na.slot_id = ? AND na.status = 'active'
           AND (na.ends_at IS NULL OR na.ends_at = '' OR na.ends_at >= ?)
         ORDER BY na.created_at DESC LIMIT 1`
      )
      .get(slotId, today) as {starts_at?: string; ends_at?: string; partner_name?: string} | undefined;

    const bidAgg = db
      .prepare(
        `SELECT MAX(bid_amount_toman) AS highest_bid, COUNT(*) AS pending_count
         FROM ad_bids
         WHERE slot_id = ? AND status = 'pending'`
      )
      .get(slotId) as {highest_bid: number | null; pending_count: number};

    return {
      id: slotId,
      title: String(row.title),
      description: String(row.description || ''),
      format: row.format as NativeAdFormat,
      mediaType: (row.media_type as NativeAdMediaType) || 'banner',
      targetCategory: String(row.target_category || 'همه دسته‌ها'),
      pricingModel: (row.pricing_model as AdSlotInventory['pricingModel']) || 'hybrid',
      fixedPriceToman: Number(row.fixed_price_toman || 0),
      minBidToman: Number(row.min_bid_toman || 0),
      bidStepToman: Number(row.bid_step_toman || 500000),
      isExclusive: Number(row.is_exclusive) === 1,
      status: row.status === 'paused' ? 'paused' : 'open',
      activePartnerName: activeAd?.partner_name || null,
      activeStartsAt: activeAd?.starts_at || null,
      activeEndsAt: activeAd?.ends_at || null,
      highestPendingBidToman: Number(bidAgg?.highest_bid || 0),
      pendingBidsCount: Number(bidAgg?.pending_count || 0),
      createdAt: String(row.created_at),
    };
  });
}

export function getAdBids(partnerId?: string): AdBidOrBooking[] {
  const sql = partnerId
    ? `SELECT b.*, p.name AS partner_name, s.title AS slot_title, s.target_category AS slot_target_category,
              s.format AS slot_format, s.media_type AS slot_media_type
       FROM ad_bids b
       LEFT JOIN partners p ON p.id = b.partner_id
       LEFT JOIN ad_slots s ON s.id = b.slot_id
       WHERE b.partner_id = ?
       ORDER BY b.created_at DESC`
    : `SELECT b.*, p.name AS partner_name, s.title AS slot_title, s.target_category AS slot_target_category,
              s.format AS slot_format, s.media_type AS slot_media_type
       FROM ad_bids b
       LEFT JOIN partners p ON p.id = b.partner_id
       LEFT JOIN ad_slots s ON s.id = b.slot_id
       ORDER BY CASE b.status WHEN 'pending' THEN 0 ELSE 1 END, b.bid_amount_toman DESC, b.created_at DESC`;
  const rows = (partnerId ? db.prepare(sql).all(partnerId) : db.prepare(sql).all()) as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    slotId: String(row.slot_id),
    slotTitle: String(row.slot_title || 'جایگاه تبلیغاتی'),
    slotTargetCategory: String(row.slot_target_category || 'همه دسته‌ها'),
    slotFormat: (row.slot_format as NativeAdFormat) || 'feed_editorial_story',
    slotMediaType: (row.slot_media_type as NativeAdMediaType) || 'banner',
    advertiserId: String(row.advertiser_id),
    partnerId: String(row.partner_id),
    partnerName: String(row.partner_name || 'برند همکار'),
    bookingType: row.booking_type === 'fixed' ? 'fixed' : 'auction',
    bidAmountToman: Number(row.bid_amount_toman || 0),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    title: String(row.title),
    subtitle: String(row.subtitle || ''),
    editorialCopy: String(row.editorial_copy || ''),
    ctaLabel: String(row.cta_label || 'مشاهده جزئیات'),
    targetUrl: row.target_url ? String(row.target_url) : undefined,
    utmSource: row.utm_source ? String(row.utm_source) : 'lagheli',
    utmMedium: row.utm_medium ? String(row.utm_medium) : 'native_ad',
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : '',
    recipeCategories: JSON.parse(String(row.recipe_categories_json || '[]')),
    matchKeywords: JSON.parse(String(row.match_keywords_json || '[]')),
    status: row.status as AdBidOrBooking['status'],
    adminNote: String(row.admin_note || ''),
    createdAdId: row.created_ad_id ? String(row.created_ad_id) : null,
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  }));
}

export function getFlagshipSponsorships(): FlagshipSponsorship[] {
  const rows = db
    .prepare('SELECT * FROM flagship_sponsorships ORDER BY CASE status WHEN \'active\' THEN 0 ELSE 1 END, created_at DESC')
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: String(row.partner_name),
    tagline: String(row.tagline),
    ctaLabel: String(row.cta_label || 'آشنایی با حامی'),
    targetUrl: row.target_url ? String(row.target_url) : undefined,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : '',
    duration: row.duration as FlagshipSponsorship['duration'],
    priceToman: Number(row.price_toman || 0),
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status as FlagshipSponsorship['status'],
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    createdAt: String(row.created_at),
  }));
}

export function getActiveFlagshipSponsorship(): FlagshipSponsorship | null {
  const all = getFlagshipSponsorships();
  return all.find((s) => s.status === 'active' && isAdActiveInDateWindow(s.startsAt, s.endsAt)) || null;
}

export function getLocalVenues(activeOnly = false): LocalVenueSuggestion[] {
  const rows = db
    .prepare(
      activeOnly
        ? "SELECT * FROM local_venues WHERE status = 'active' ORDER BY is_featured DESC, created_at DESC"
        : 'SELECT * FROM local_venues ORDER BY is_featured DESC, created_at DESC'
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    partnerId: row.partner_id ? String(row.partner_id) : null,
    name: String(row.name),
    venueType: row.venue_type as LocalVenueSuggestion['venueType'],
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    address: String(row.address || ''),
    phone: String(row.phone || ''),
    lat: Number(row.lat || 0),
    lng: Number(row.lng || 0),
    servedDishes: JSON.parse(String(row.served_dishes_json || '[]')),
    servedCategories: JSON.parse(String(row.served_categories_json || '[]')),
    deliveryNote: String(row.delivery_note || ''),
    menuUrl: row.menu_url ? String(row.menu_url) : undefined,
    utmCampaign: row.utm_campaign ? String(row.utm_campaign) : '',
    isFeatured: Number(row.is_featured) === 1,
    status: row.status === 'paused' ? 'paused' : 'active',
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    createdAt: String(row.created_at),
  }));
}

export function getAdvertiserAccounts(): AdvertiserAccount[] {
  const rows = db
    .prepare(
      `SELECT a.*, p.name AS partner_name
       FROM advertiser_accounts a
       LEFT JOIN partners p ON p.id = a.partner_id
       ORDER BY a.created_at ASC`
    )
    .all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: String(row.partner_name || 'برند همکار'),
    loginIdentifier: String(row.login_identifier),
    managerName: String(row.manager_name),
    status: row.status === 'suspended' ? 'suspended' : 'active',
    createdAt: String(row.created_at),
  }));
}

export function hashAdvertiserPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function seedInitialData(): void {
  const existingRecipes = db.prepare('SELECT COUNT(*) as count FROM recipes').get() as {count: number};
  if (existingRecipes.count > 0) return;

  const now = new Date().toISOString();

  // Ensure default config exists
  db.prepare('INSERT OR IGNORE INTO app_config (key, value_json) VALUES (?, ?)').run(
    'ecosystem',
    JSON.stringify(DEFAULT_ECOSYSTEM_CONFIG)
  );

  // Seed Verified Chefs
  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (id, phone, name, city, neighborhood, bio, specialty, is_verified_chef, chef_verification_status, role, xp, gems, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'chef-mahsa',
    '09120001001',
    'سرآشپز مهسا رادمنش',
    'تهران',
    'جردن',
    'پژوهشگر آشپزی اصیل ایرانی و نویسنده کتاب‌های طعم‌های آرام خانه.',
    'پلوهای مجلسی و ته‌چین',
    1,
    'approved',
    'chef',
    1380,
    340,
    now
  );
  insertUser.run(
    'chef-kaveh',
    '09120001002',
    'سرآشپز کاوه گیلانی',
    'رشت',
    'گلسار',
    'متخصص آشپزی بومی گیلان و غذاهای فصلی با مواد تازه محلی.',
    'غذاهای شمالی و گیاهی',
    1,
    'approved',
    'chef',
    920,
    210,
    now
  );
  insertUser.run(
    'chef-sara',
    '09120001003',
    'سارا فرهادی',
    'شیراز',
    'معالی‌آباد',
    'علاقه‌مند به خورشت‌های جاافتاده، آش‌های سنتی و نسخه سبک غذاهای ایرانی.',
    'خورشت و آش‌های اصیل',
    1,
    'approved',
    'chef',
    760,
    180,
    now
  );

  // Seed Follows between chefs
  const insertFollow = db.prepare(
    'INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)'
  );
  insertFollow.run('chef-kaveh', 'chef-mahsa', now);
  insertFollow.run('chef-sara', 'chef-mahsa', now);
  insertFollow.run('chef-mahsa', 'chef-kaveh', now);
  insertFollow.run('chef-sara', 'chef-kaveh', now);
  insertFollow.run('chef-mahsa', 'chef-sara', now);

  // Image paths generated via generate_image
  const IMG_TAHCHIN = '/src/assets/images/hero_tahchin_saffron_1795554313371.jpg';
  const IMG_FESENJAN = '/src/assets/images/dish_fesenjan_editorial_1795554313427.jpg';
  const IMG_MIRZA = '/src/assets/images/dish_mirza_ghasemi_1795554314673.jpg';
  const IMG_BAGHALI = '/src/assets/images/dish_baghali_polo_1795554313137.jpg';
  const IMG_ASH = '/src/assets/images/dish_ash_reshteh_1795554316371.jpg';

  const insertRecipe = db.prepare(`
    INSERT INTO recipes (
      id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
      diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
      is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
      ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecipe.run(
    'rec-tahchin',
    'saffron-tahchin-morgh',
    'ته‌چین زعفرانی مرغ با زرشک و خلال پسته',
    'پوسته طلایی برشته با بافت نرم ماست چکیده و عطر زعفران قائنات',
    'ته‌چین اصیل تهرانی با توازن دقیق زرده تخم‌مرغ، ماست چکیده پرچرب و زعفران غلیظ که هم روی شعله ملایم و هم در فر به پوسته‌ای یکدست و طلایی می‌رسد.',
    IMG_TAHCHIN,
    'ناهار و شام',
    'تهران',
    'چهارفصل',
    'ناهار',
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    30,
    60,
    4,
    'متوسط',
    JSON.stringify({calories: 560, protein: 34, carbs: 58, fat: 21, fiber: 3}),
    0,
    0,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'سینه مرغ', amount: 450, unit: 'گرم'},
      {name: 'ماست چکیده', amount: 1.5, unit: 'پیمانه'},
      {name: 'تخم‌مرغ', amount: 2, unit: 'عدد'},
      {name: 'زعفران دم‌کرده', amount: 4, unit: 'قاشق غذاخوری'},
      {name: 'زرشک', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'خلال پسته', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'کره', amount: 40, unit: 'گرم'},
      {name: 'پیاز', amount: 1, unit: 'عدد'},
      {name: 'نمک', amount: 1, unit: 'قاشق چای‌خوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'برنج ایرانی را با آب ولرم و نمک از دو ساعت قبل خیس کنید، سپس در آب جوش بریزید و کمی زنده‌تر از حالت معمول آبکش کنید.',
        timerMinutes: 10,
        highlightIngredients: ['برنج ایرانی', 'نمک'],
      },
      {
        order: 2,
        instruction: 'سینه مرغ را همراه با پیاز خردشده، برگ بو، کمی زردچوبه و نمک بپزید و پس از خنک شدن به‌صورت ریش‌ریش درشت آماده کنید.',
        timerMinutes: 35,
        highlightIngredients: ['سینه مرغ', 'پیاز'],
      },
      {
        order: 3,
        instruction: 'زرده تخم‌مرغ‌ها، ماست چکیده، ۳ قاشق زعفران دم‌کرده و نصف کره ذوب‌شده را آرام هم بزنید تا مایه‌ای یکدست و خوش‌رنگ بسازید، سپس نیمی از برنج را با آن مخلوط کنید.',
        highlightIngredients: ['ماست چکیده', 'تخم‌مرغ', 'زعفران دم‌کرده', 'کره'],
      },
      {
        order: 4,
        instruction: 'کف قابلمه نچسب یا ظرف چدنی را چرب کنید، لایه اول برنج زعفرانی را فشرده بچینید، مرغ و بخشی از زرشک تفت‌داده را وسط قرار دهید و بقیه برنج را روی آن ببندید.',
        highlightIngredients: ['زرشک', 'خلال پسته'],
      },
      {
        order: 5,
        instruction: 'روی شعله بسیار ملایم با دم‌کنی یا در فر ۱۸۰ درجه بپزید تا دیواره‌ها طلایی و برشته شوند. هنگام سرو با زرشک و خلال پسته بیارایید.',
        timerMinutes: 50,
        highlightIngredients: ['زرشک', 'خلال پسته'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'فر', 'زعفران‌ساب']),
    'dish-tahchin',
    now
  );

  insertRecipe.run(
    'rec-fesenjan',
    'khoresh-fesenjan-malas',
    'خورشت فسنجان ملس با گردوی بوداده و رب انار گیلان',
    'روغن‌اندازی طبیعی گردو با پخت آهسته و توازن دقیق ترشی و شیرینی',
    'نسخه‌ای آرام و شفاف از فسنجان اصیل شمالی؛ با تفت ملایم مغز گردو و شوک آب سرد برای رسیدن به بافتی مخملی و براق بدون نیاز به روغن اضافه.',
    IMG_FESENJAN,
    'ناهار و شام',
    'گیلان',
    'پاییز',
    'شام',
    JSON.stringify(['سنتی', 'بدون گلوتن']),
    20,
    120,
    4,
    'حرفه‌ای',
    JSON.stringify({calories: 620, protein: 28, carbs: 32, fat: 42, fiber: 5}),
    0,
    0,
    null,
    null,
    'chef-kaveh',
    'published',
    JSON.stringify([
      {name: 'مغز گردو', amount: 300, unit: 'گرم'},
      {name: 'سینه مرغ', amount: 500, unit: 'گرم'},
      {name: 'رب انار', amount: 4, unit: 'قاشق غذاخوری'},
      {name: 'پیاز', amount: 1, unit: 'عدد'},
      {name: 'دانه انار', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'زعفران دم‌کرده', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'شکر', amount: 1, unit: 'قاشق غذاخوری', optional: true},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'مغز گردو را دو بار آسیاب کنید تا نرم و نیمه‌خمیری شود، سپس در قابلمه چدنی روی حرارت بسیار کم ۳ دقیقه تفت دهید تا عطرش آزاد شود.',
        timerMinutes: 4,
        highlightIngredients: ['مغز گردو'],
      },
      {
        order: 2,
        instruction: '۳ لیوان آب سرد به گردو اضافه کنید و اجازه دهید با شعله ملایم بجوشد و به‌تدریج روغن بیندازد.',
        timerMinutes: 60,
        highlightIngredients: ['مغز گردو'],
      },
      {
        order: 3,
        instruction: 'پیاز رنده‌شده را سبک تفت دهید، تکه‌های مرغ را با زردچوبه و زعفران مزه دار کرده و به خورشت اضافه کنید.',
        timerMinutes: 35,
        highlightIngredients: ['پیاز', 'سینه مرغ', 'زعفران دم‌کرده'],
      },
      {
        order: 4,
        instruction: 'رب انار ملس را بیفزایید و در صورت تمایل میزان ترشی را با کمی شکر تنظیم کنید. نیم ساعت آخر درِ قابلمه را نیمه‌باز بگذارید تا جا بیفتد و با دانه انار سرو کنید.',
        timerMinutes: 25,
        highlightIngredients: ['رب انار', 'دانه انار'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'آسیاب']),
    'dish-fesenjan',
    now
  );

  insertRecipe.run(
    'rec-mirza',
    'mirza-ghasemi-smoked',
    'میرزاقاسمی دودی رشتی با نان سنگک داغ',
    'عطر بادمجان کبابی روی آتش، سیر تازه و گوجه‌فرنگی رسیده در ۳۵ دقیقه',
    'یک وعده گیاهی سریع، سبک و سرشار از طعم اصیل شمال ایران که برای صبحانه دیرهنگام، پیش‌غذا یا شام سبک ایده‌آل است.',
    IMG_MIRZA,
    'پخت سریع',
    'گیلان',
    'تابستان',
    'شام',
    JSON.stringify(['گیاهی', 'رژیمی', 'سریع', 'بدون گلوتن']),
    10,
    25,
    3,
    'آسان',
    JSON.stringify({calories: 290, protein: 12, carbs: 24, fat: 16, fiber: 7}),
    0,
    0,
    null,
    null,
    'chef-kaveh',
    'published',
    JSON.stringify([
      {name: 'بادمجان', amount: 4, unit: 'عدد'},
      {name: 'گوجه', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 5, unit: 'حبه'},
      {name: 'تخم‌مرغ', amount: 2, unit: 'عدد'},
      {name: 'روغن زیتون', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'زردچوبه', amount: 0.5, unit: 'قاشق چای‌خوری'},
      {name: 'نمک', amount: 1, unit: 'قاشق چای‌خوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'بادمجان‌ها را مستقیم روی شعله یا در فر گریل کنید تا پوستشان کاملاً بسوزد و مغزشان نرم و دودی شود؛ سپس پوست بگیرید و ساطوری کنید.',
        timerMinutes: 12,
        highlightIngredients: ['بادمجان'],
      },
      {
        order: 2,
        instruction: 'سیر خردشده را با روغن زیتون و زردچوبه ۱ دقیقه تفت دهید تا عطرش بلند شود، سپس گوجه‌های پوست‌گرفته و خردشده را اضافه کنید تا آبش کشیده شود.',
        timerMinutes: 8,
        highlightIngredients: ['سیر', 'روغن زیتون', 'گوجه', 'زردچوبه'],
      },
      {
        order: 3,
        instruction: 'بادمجان ساطوری را اضافه کنید و ۵ دقیقه با هم تفت دهید. در پایان تخم‌مرغ‌ها را روی غذا بشکنید و پس از بسته‌شدن سرو کنید.',
        timerMinutes: 6,
        highlightIngredients: ['تخم‌مرغ'],
      },
    ]),
    JSON.stringify(['تابه چدنی', 'شعله‌خشک‌کن']),
    'dish-mirza',
    now
  );

  insertRecipe.run(
    'rec-baghali',
    'baghali-polo-mahiche',
    'باقالی‌پلو با شوید تازه و ماهیچه آرام‌پز',
    'برنج عطری دودی‌شده با باقالی سبز بهاری و ماهیچه نرم زعفرانی',
    'یکی از شاخص‌ترین غذاهای سفره ایرانی؛ با تکنیک پخت آرام ماهیچه در سس پیاز کاراملی و زعفران تا گوشت به‌راحتی از استخوان جدا شود.',
    IMG_BAGHALI,
    'ناهار و شام',
    'تهران',
    'بهار',
    'ناهار',
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    25,
    150,
    4,
    'متوسط',
    JSON.stringify({calories: 690, protein: 46, carbs: 64, fat: 26, fiber: 6}),
    1,
    40,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'ماهیچه', amount: 800, unit: 'گرم'},
      {name: 'باقالی', amount: 2, unit: 'پیمانه'},
      {name: 'شوید', amount: 200, unit: 'گرم'},
      {name: 'پیاز', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'زعفران دم‌کرده', amount: 3, unit: 'قاشق غذاخوری'},
      {name: 'کره', amount: 50, unit: 'گرم'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'پیازها را خلالی درشت خرد کنید و کف قابلمه بچینید؛ ماهیچه، سیر، چوب دارچین و کمی آب اضافه کنید و با حرارت بسیار ملایم ۲ ساعت آرام‌پز کنید.',
        timerMinutes: 120,
        highlightIngredients: ['ماهیچه', 'پیاز', 'سیر'],
      },
      {
        order: 2,
        instruction: 'باقالی‌ها را ۵ دقیقه پیش از آبکش کردن برنج به آب جوش اضافه کنید تا رنگ سبز زنده بماند.',
        timerMinutes: 8,
        highlightIngredients: ['برنج ایرانی', 'باقالی'],
      },
      {
        order: 3,
        instruction: 'برنج و باقالی را لابه‌لا با شوید تازه خردشده و کره دم بگذارید. نیم ساعت پایانی زعفران دم‌کرده را به ماهیچه بیفزایید و سرو کنید.',
        timerMinutes: 35,
        highlightIngredients: ['شوید', 'کره', 'زعفران دم‌کرده'],
      },
    ]),
    JSON.stringify(['قابلمه چدنی', 'بخارپز']),
    'dish-baghali',
    now
  );

  insertRecipe.run(
    'rec-ash',
    'ash-reshteh-authentic',
    'آش رشته اصیل با نعناداغ زمردی و کشک محلی',
    'هماهنگی سبزی تازه، حبوبات لعاب‌دار و تزیین آرام پیازداغ طلایی',
    'آش رشته‌ای که نه بیش از حد سنگین است و نه آبکی؛ با دستور دقیق زمان افزودن سبزی و رشته برای حفظ رنگ سبز و عطر نعناداغ.',
    IMG_ASH,
    'پیش‌غذا و عصرانه',
    'شیراز',
    'زمستان',
    'عصرانه',
    JSON.stringify(['گیاهی', 'سنتی', 'اقتصادی']),
    20,
    65,
    6,
    'آسان',
    JSON.stringify({calories: 380, protein: 16, carbs: 56, fat: 11, fiber: 9}),
    0,
    0,
    null,
    null,
    'chef-sara',
    'published',
    JSON.stringify([
      {name: 'سبزی آش', amount: 500, unit: 'گرم'},
      {name: 'رشته آش', amount: 250, unit: 'گرم'},
      {name: 'نخود', amount: 0.5, unit: 'پیمانه'},
      {name: 'لوبیا چیتی', amount: 0.5, unit: 'پیمانه'},
      {name: 'عدس', amount: 0.5, unit: 'پیمانه'},
      {name: 'کشک', amount: 1, unit: 'پیمانه'},
      {name: 'پیاز', amount: 2, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'نعنا خشک', amount: 2, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'نخود و لوبیای خیس‌خورده را بپزید؛ در میانه پخت عدس را اضافه کنید تا له نشود.',
        timerMinutes: 30,
        highlightIngredients: ['نخود', 'لوبیا چیتی', 'عدس'],
      },
      {
        order: 2,
        instruction: 'سبزی آش خردشده و نیمی از پیازداغ طلایی را به قابلمه اضافه کنید و اجازه دهید ۱۵ دقیقه آرام بجوشد.',
        timerMinutes: 15,
        highlightIngredients: ['سبزی آش', 'پیاز'],
      },
      {
        order: 3,
        instruction: 'رشته آش را آرام اضافه کنید و به آرامی هم بزنید تا به هم نچسبد؛ پس از ۱۵ دقیقه لعاب‌گیری، با کشک، سیرداغ و نعناداغ سرو کنید.',
        timerMinutes: 15,
        highlightIngredients: ['رشته آش', 'کشک', 'سیر', 'نعنا خشک'],
      },
    ]),
    JSON.stringify(['قابلمه لعابی', 'تابه']),
    'dish-ash',
    now
  );

  // Variation / Fork of Mirza Ghasemi (Vegan version!)
  insertRecipe.run(
    'rec-mirza-vegan',
    'mirza-ghasemi-vegan-version',
    'میرزاقاسمی کاملاً وگان با گردو و سیب‌زمینی تنوری',
    'نسخه گیاهی بدون تخم‌مرغ با بافت غنی‌تر و عطر دودی ملایم',
    'روش پخت جایگزین برای علاقه‌مندان به تغذیه کاملاً وگان که به جای تخم‌مرغ از گردوی ساطوری و روغن زیتون فرابکر استفاده می‌کند.',
    IMG_MIRZA,
    'وگان و گیاهی',
    'گیلان',
    'چهارفصل',
    'شام',
    JSON.stringify(['گیاهی', 'رژیمی', 'سریع', 'بدون گلوتن']),
    10,
    20,
    2,
    'آسان',
    JSON.stringify({calories: 255, protein: 7, carbs: 22, fat: 15, fiber: 8}),
    0,
    0,
    'rec-mirza',
    'حذف تخم‌مرغ و افزودن مغز گردوی ساطوری‌شده برای ایجاد غلظت و پروتئین گیاهی.',
    'chef-sara',
    'published',
    JSON.stringify([
      {name: 'بادمجان', amount: 3, unit: 'عدد'},
      {name: 'گوجه', amount: 3, unit: 'عدد'},
      {name: 'سیر', amount: 4, unit: 'حبه'},
      {name: 'مغز گردو', amount: 40, unit: 'گرم'},
      {name: 'روغن زیتون', amount: 2, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {
        order: 1,
        instruction: 'بادمجان‌ها را کبابی و ساطوری کنید و با سیر و گوجه تفت دهید تا آب اضافی بخار شود.',
        timerMinutes: 15,
        highlightIngredients: ['بادمجان', 'سیر', 'گوجه'],
      },
      {
        order: 2,
        instruction: 'در ۵ دقیقه پایانی، مغز گردوی ساطوری و روغن زیتون تازه را اضافه کنید و گرم سرو کنید.',
        timerMinutes: 5,
        highlightIngredients: ['مغز گردو', 'روغن زیتون'],
      },
    ]),
    JSON.stringify(['تابه چدنی']),
    null,
    now
  );

  // Seed Q&A
  db.prepare(
    'INSERT INTO recipe_questions (id, recipe_id, author_id, author_name, body, solved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'q-1',
    'rec-tahchin',
    'chef-sara',
    'سارا فرهادی',
    'اگر بخواهیم ته‌چین را داخل فر درست کنیم، روی ظرف را با فویل بپوشانیم یا بدون پوشش بپزد؟',
    1,
    now
  );

  db.prepare(
    'INSERT INTO recipe_answers (id, question_id, author_id, author_name, author_verified, body, upvotes, is_best, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    'a-1',
    'q-1',
    'chef-mahsa',
    'سرآشپز مهسا رادمنش',
    1,
    'حتماً روی ظرف را با فویل آلومینیومی بپوشانید و چند سوراخ کوچک ایجاد کنید تا رطوبت برنج حفظ شود و کف و دیواره‌ها یکدست طلایی شوند.',
    14,
    1,
    now
  );

  // Seed Editorial Daily Food Ordering Menu
  const insertMenu = db.prepare(`
    INSERT INTO menu_items (
      id, title, subtitle, story, category, image_url, chef_name, chef_verified,
      prep_minutes, calories, single_price, double_price, diet_tags_json, key_ingredients_json, featured, linked_recipe_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertMenu.run(
    'dish-tahchin',
    'ته‌چین زعفرانی مرغ و زرشک دست‌ساز',
    'پخته‌شده با برنج هاشمی گیلان، ماست چکیده محلی و زعفران سرگل قائنات',
    'هر روز صبح در قابلمه‌های چدنی کوچک با پخت آهسته آماده می‌شود تا هنگام تحویل، لایه بیرونی کاملاً ترد و مغز آن نرم و معطر بماند.',
    'منتخب سرآشپز',
    IMG_TAHCHIN,
    'سرآشپز مهسا رادمنش',
    1,
    35,
    560,
    345000,
    640000,
    JSON.stringify(['سنتی', 'پرپروتئین', 'بدون گلوتن']),
    JSON.stringify(['برنج هاشمی', 'سینه مرغ تازه', 'ماست چکیده', 'زعفران قائنات', 'زرشک پلویی', 'خلال پسته']),
    1,
    'rec-tahchin'
  );

  insertMenu.run(
    'dish-fesenjan',
    'خورشت فسنجان ملس با پلوی زعفرانی',
    'تهیه‌شده از گردوی تویسرکان و رب انار خانگی گیلان با ۵ ساعت پخت آرام',
    'بدون روغن اضافه و تنها با روغن‌اندازی طبیعی مغز گردو؛ همراه با برنج دم‌کشیده عطری و دانه‌های انار تازه.',
    'اصیل ایرانی',
    IMG_FESENJAN,
    'سرآشپز کاوه گیلانی',
    1,
    40,
    620,
    390000,
    730000,
    JSON.stringify(['سنتی', 'بدون گلوتن']),
    JSON.stringify(['گردوی تویسرکان', 'رب انار ملس', 'مرغ محلی', 'برنج ایرانی', 'دانه انار']),
    0,
    'rec-fesenjan'
  );

  insertMenu.run(
    'dish-mirza',
    'میرزاقاسمی دودی رشتی با نان سنگک تازه',
    'بادمجان کبابی روی آتش، سیر تازه شمالی و گوجه‌فرنگی محلی',
    'انتخابی سبک، معطر و گیاهی برای ناهار یا شام آرام روزهای کاری؛ سرو شده همراه با نان تازه و زیتون پرورده.',
    'شمالی',
    IMG_MIRZA,
    'سرآشپز کاوه گیلانی',
    1,
    25,
    290,
    245000,
    450000,
    JSON.stringify(['گیاهی', 'رژیمی']),
    JSON.stringify(['بادمجان کبابی', 'گوجه محلی', 'سیر شمالی', 'تخم‌مرغ محلی', 'روغن زیتون']),
    0,
    'rec-mirza'
  );

  insertMenu.run(
    'dish-baghali',
    'باقالی‌پلو با ماهیچه آرام‌پز',
    'ماهیچه گوسفندی تازه پخته‌شده در سس پیاز و زعفران کنار پلوی شوید تازه',
    'به مدت ۴ ساعت در حرارت ملایم پخته می‌شود تا بافتی لطیف و بدون چربی اضافه داشته باشد.',
    'اصیل ایرانی',
    IMG_BAGHALI,
    'سرآشپز مهسا رادمنش',
    1,
    45,
    690,
    580000,
    1090000,
    JSON.stringify(['پرپروتئین', 'سنتی']),
    JSON.stringify(['ماهیچه تازه', 'برنج طارم', 'باقالی سبز', 'شوید تازه', 'زعفران']),
    0,
    'rec-baghali'
  );

  insertMenu.run(
    'dish-ash',
    'آش رشته دست‌ساز عصرانه با کشک محلی',
    'سبزی تازه روز، حبوبات لعاب‌دار، نعناداغ زمردی و پیازداغ طلایی',
    'بسته‌بندی‌شده در ظروف گرم‌نگه‌دار با کشک و نعناداغ جداگانه برای حفظ تازگی تا لحظه سرو.',
    'گیاهی',
    IMG_ASH,
    'سارا فرهادی',
    1,
    20,
    380,
    195000,
    360000,
    JSON.stringify(['گیاهی', 'سنتی']),
    JSON.stringify(['سبزی آش تازه', 'رشته محلی', 'نخود و لوبیا', 'کشک محلی', 'نعناداغ']),
    0,
    'rec-ash'
  );

  // Seed Ecosystem Partners (covering diverse roles out of 10)
  const insertPartner = db.prepare(`
    INSERT INTO partners (
      id, slug, name, role_type, city, neighborhood, description, address, phone, website,
      verified, claim_status, tier, promo_code, promo_label, affiliate_code,
      related_ingredients_json, related_tools_json, catalog_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPartner.run(
    'prt-zaferan',
    'khorasan-saffron-house',
    'خانه زعفران خراسان',
    'food_brands',
    'تهران',
    'ونک',
    'تامین مستقیم زعفران سرگل قائنات، زرشک پفکی و ادویه‌های دست‌چین بدون واسطه از کشاورزان خراسان.',
    'تهران، میدان ونک، خیابان ملاصدرا، پلاک ۴۲',
    '۰۲۱-۸۸۶۵۱۲۳۴',
    'https://lagheli.ir/partners/saffron',
    1,
    'verified',
    'sponsor',
    'LAGHELI15',
    '۱۵٪ تخفیف ویژه کاربران لاقلی',
    'AFF-ZAF-01',
    JSON.stringify(['زعفران', 'زعفران دم‌کرده', 'زرشک', 'هل']),
    JSON.stringify(['زعفران‌ساب']),
    JSON.stringify([
      {id: 'c1', title: 'زعفران سرگل ممتاز قائنات (۱ مثقال)', price: 460000, discountPercent: 15, affiliateCode: 'AFF-ZAF-01'},
      {id: 'c2', title: 'زرشک پفکی تازه دست‌چین (۲۵۰ گرم)', price: 185000, discountPercent: 10, affiliateCode: 'AFF-ZAF-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-castiron',
    'rast-castiron-studio',
    'کارگاه ظروف چدنی رَست',
    'kitchen_equipment',
    'تهران',
    'اندرزگو',
    'طراحی و تولید ظروف چدنی لعاب‌دار و تابه‌های سنگین مناسب پخت آهسته ته‌چین، فسنجان و نان خانگی.',
    'تهران، بلوار اندرزگو، گالری خانه رَست',
    '۰۲۱-۲۲۶۸۹۰۱۰',
    'https://lagheli.ir/partners/rast',
    1,
    'verified',
    'featured',
    'RAST120',
    '۱۲۰٬۰۰۰ تومان تخفیف روی قابلمه‌های چدنی',
    'AFF-RST-01',
    JSON.stringify([]),
    JSON.stringify(['قابلمه چدنی', 'تابه چدنی', 'قابلمه لعابی', 'فر']),
    JSON.stringify([
      {id: 'c3', title: 'قابلمه چدنی لعاب‌دار ۲۴ سانتی (رنگ زیتونی)', price: 3850000, discountPercent: 8, affiliateCode: 'AFF-RST-01'},
      {id: 'c4', title: 'تابه چدنی دست‌ساز میرزاقاسمی', price: 1950000, discountPercent: 5, affiliateCode: 'AFF-RST-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-gilan-artisan',
    'gilan-organic-pantry',
    'خواربار بومی باغستان گیلان',
    'local_artisans',
    'رشت',
    'گلسار',
    'تولید خانگی رب انار ملس ارگانیک، برنج هاشمی درجه‌یک، سیر ترشی هفت‌ساله و زیتون پرورده رودبار.',
    'رشت، بلوار گلسار، خیابان ۱۰۲',
    '۰۱۳-۳۳۱۱۴۴۵۵',
    '',
    1,
    'verified',
    'featured',
    'GILAN10',
    '۱۰٪ تخفیف محصولات ارگانیک شمال',
    'AFF-GIL-01',
    JSON.stringify(['رب انار', 'برنج ایرانی', 'برنج', 'مغز گردو', 'سیر']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c5', title: 'رب انار ملس خانگی گیلان (۵۰۰ گرم)', price: 290000, discountPercent: 10, affiliateCode: 'AFF-GIL-01'},
      {id: 'c6', title: 'برنج هاشمی معطر کشت اول (۵ کیلوگرم)', price: 980000, affiliateCode: 'AFF-GIL-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-express',
    'sabz-fresh-delivery',
    'پیک سبز — تامین و ارسال فوری تازه‌بار',
    'instant_delivery',
    'تهران',
    'سراسر تهران',
    'تامین و ارسال زیر ۴۵ دقیقه سبزیجات تازه پاک‌شده، لبنیات محلی و اقلام لیست خرید شما.',
    'تهران، مرکز توزیع تازه غرب و شمال',
    '۰۲۱-۴۱۰۹۹۰۰۰',
    '',
    1,
    'verified',
    'sponsor',
    'FREESABZ',
    'ارسال رایگان اولین سبد لیست خرید',
    'AFF-EXP-01',
    JSON.stringify(['سبزی آش', 'شوید', 'بادمجان', 'گوجه', 'پیاز', 'ماست چکیده']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c7', title: 'سبد سبزی تازه پاک‌شده (آش، قورمه، پلو)', price: 145000, affiliateCode: 'AFF-EXP-01'},
      {id: 'c8', title: 'اشتراک ارسال فوری ماهانه لیست خرید', price: 220000, discountPercent: 20, affiliateCode: 'AFF-EXP-02'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-school',
    'ateliere-ashpazi-saffron',
    'آکادمی آشپزی معاصر ایرانی',
    'culinary_schools',
    'تهران',
    'جردن',
    'کارگاه‌های حضوری و آنلاین تکنیک‌های آشپزی اصیل ایرانی، عکاسی غذا و مدیریت آشپزخانه.',
    'تهران، بلوار نلسون ماندلا، کوچه ناهید شرقی',
    '۰۲۱-۲۲۰۵۵۴۱۲',
    '',
    0,
    'unclaimed',
    'free',
    'CLASS15',
    '۱۵٪ تخفیف کارگاه ته‌چین و پلوهای ایرانی',
    'AFF-SCH-01',
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c9', title: 'کارگاه تخصصی پلوها و ته‌چین‌های ایرانی', price: 1650000, discountPercent: 15, affiliateCode: 'AFF-SCH-01'},
    ]),
    'approved',
    now
  );

  insertPartner.run(
    'prt-restaurant',
    'matbakh-narenj',
    'مطبخ ادیتوریال نارنج و ترنج',
    'restaurants_kitchens',
    'شیراز',
    'معالی‌آباد',
    'سرو غذاهای آرام‌پز ایرانی در فضایی مینیمال با تمرکز بر مواد فصلی فارس و گیلان.',
    'شیراز، بلوار معالی‌آباد، نبش کوچه ۵',
    '۰۷۱-۳۶۳۵۲۲۱۰',
    '',
    0,
    'unclaimed',
    'free',
    'NARENJ10',
    '۱۰٪ تخفیف رزرو میز ناهار',
    'AFF-NAR-01',
    JSON.stringify(['کشک', 'سبزی آش']),
    JSON.stringify([]),
    JSON.stringify([
      {id: 'c10', title: 'منوی تست طعم‌های فصل (دونفره)', price: 890000, discountPercent: 10, affiliateCode: 'AFF-NAR-01'},
    ]),
    'approved',
    now
  );

  // Seed a few sample partner events for initial analytics
  const insertEvent = db.prepare(
    'INSERT INTO partner_events (id, partner_id, event_type, created_at) VALUES (?, ?, ?, ?)'
  );
  insertEvent.run('ev-1', 'prt-zaferan', 'impression', now);
  insertEvent.run('ev-2', 'prt-zaferan', 'impression', now);
  insertEvent.run('ev-3', 'prt-zaferan', 'profile_open', now);
  insertEvent.run('ev-4', 'prt-zaferan', 'coupon_copy', now);
  insertEvent.run('ev-5', 'prt-castiron', 'impression', now);
  insertEvent.run('ev-6', 'prt-castiron', 'affiliate_click', now);
  insertEvent.run('ev-7', 'prt-express', 'impression', now);
}

function seedV2Content(): void {
  const now = new Date().toISOString();

  // Seed 2 authentic Iranian recipes WITHOUT photos yet (to demonstrate crowdsourced real dish photography)
  const insertRecipe = db.prepare(`
    INSERT OR IGNORE INTO recipes (
      id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
      diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
      is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
      ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertRecipe.run(
    'rec-kuku-sabzi',
    'kuku-sabzi-majlesi',
    'کوکو سبزی مجلسی با گردو و زرشک',
    'عطر سبزی تازه ایرانی با بافت پفکی در ماهیتابه چدنی (در انتظار عکس واقعی شما)',
    'یکی از محبوب‌ترین و اصیل‌ترین غذاهای خانگی ایران که با سبزی ریزخردشده، تخم‌مرغ تازه، گردوی خردشده و زرشک تفت‌خورده در لاقلی آماده می‌شود. اگر این دستور را پختید، اولین عکس واقعی آن را ثبت کنید و ۴۰ جِم هدیه بگیرید.',
    '',
    'ناهار و شام',
    'تهران',
    'بهار',
    'شام',
    JSON.stringify(['سنتی', 'گیاهی', 'سریع', 'اقتصادی']),
    20,
    25,
    4,
    'آسان',
    JSON.stringify({calories: 320, protein: 14, carbs: 16, fat: 22, fiber: 5}),
    0,
    0,
    null,
    null,
    'chef-mahsa',
    'published',
    JSON.stringify([
      {name: 'سبزی کوکو (تره، جعفری، گشنیز، شوید)', amount: 400, unit: 'گرم'},
      {name: 'تخم‌مرغ', amount: 5, unit: 'عدد'},
      {name: 'گردو خردشده', amount: 50, unit: 'گرم'},
      {name: 'زرشک', amount: 2, unit: 'قاشق غذاخوری'},
      {name: 'آرد سفید', amount: 1, unit: 'قاشق غذاخوری'},
      {name: 'زردچوبه', amount: 1, unit: 'قاشق چای‌خوری'},
      {name: 'روغن مایع', amount: 4, unit: 'قاشق غذاخوری'},
    ]),
    JSON.stringify([
      {order: 1, instruction: 'سبزی کوکو را شسته و کاملاً خشک کنید تا هنگام سرخ شدن آب نیندازد، سپس خیلی ریز خرد کنید.'},
      {order: 2, instruction: 'تخم‌مرغ‌ها را با آرد، زردچوبه، نمک و فلفل سیاه خوب هم بزنید تا کف سبک ایجاد شود.'},
      {order: 3, instruction: 'سبزی، گردو و زرشک را اضافه کرده و آرام مخلوط کنید تا مایه‌ای یکدست به‌دست آید.'},
      {order: 4, instruction: 'ماهیتابه چدنی (لاقلی) را با روغن گرم کنید، مایه را پهن کرده و با درِ بسته روی حرارت ملایم بپزید.', timerMinutes: 12},
      {order: 5, instruction: 'کوکو را برش داده و برگردانید تا طرف دیگر نیز برشته و طلایی شود (این بار بدون در).', timerMinutes: 8},
    ]),
    JSON.stringify(['ماهیتابه چدنی', 'کفگیر']),
    null,
    now
  );

  insertRecipe.run(
    'rec-adas-polo',
    'adas-polo-majlesi',
    'عدس‌پلو مجلسی با کشمش، خرما و پیازداغ طلایی',
    'پلوی مقوی و ساده ایرانی با عطر دارچین و زیره (در انتظار اولین عکس کاربران)',
    'ترکیبی متعادل از عدس نیم‌پز، برنج ایرانی قدکشیده، کشمش پلویی و پیازداغ کاراملی. این دستور از آرشیو پایه لاقلی بارگذاری شده و منتظر ثبت تصویر واقعی غذای پخته‌شده توسط کاربران است.',
    '',
    'ناهار و شام',
    'اصفهان',
    'چهارفصل',
    'ناهار',
    JSON.stringify(['سنتی', 'گیاهی', 'اقتصادی']),
    20,
    50,
    4,
    'آسان',
    JSON.stringify({calories: 485, protein: 16, carbs: 74, fat: 13, fiber: 9}),
    0,
    0,
    null,
    null,
    'chef-parisa',
    'published',
    JSON.stringify([
      {name: 'برنج ایرانی', amount: 3, unit: 'پیمانه'},
      {name: 'عدس سبز', amount: 1.5, unit: 'پیمانه'},
      {name: 'پیاز', amount: 2, unit: 'عدد'},
      {name: 'کشمش پلویی', amount: 100, unit: 'گرم'},
      {name: 'خرما بدون هسته', amount: 10, unit: 'عدد'},
      {name: 'دارچین', amount: 1, unit: 'قاشق چای‌خوری'},
      {name: 'کره', amount: 40, unit: 'گرم'},
    ]),
    JSON.stringify([
      {order: 1, instruction: 'عدس را ۲ ساعت خیس کنید و سپس با کمی نمک حدود ۲۰ دقیقه بپزید تا نرم شود ولی له نشود.', timerMinutes: 20},
      {order: 2, instruction: 'پیازها را خلالی کرده و با حرارت ملایم تا طلایی شدن سرخ کنید؛ کشمش و دارچین را در ۲ دقیقه آخر بیفزایید.', timerMinutes: 10},
      {order: 3, instruction: 'برنج آبکش‌شده را لایه‌لایه با عدس و کمی پودر دارچین در قابلمه ریخته و دم بگذارید.', timerMinutes: 35},
      {order: 4, instruction: 'هنگام سرو، عدس‌پلو را با پیازداغ، کشمش و خرمای تفت‌خورده در کره تزیین کنید.'},
    ]),
    JSON.stringify(['قابلمه نچسب', 'ماهیتابه چدنی']),
    null,
    now
  );

  // Give seeded sponsor partners initial commercial wallet balances if 0
  db.prepare('UPDATE partners SET business_balance = 5000000 WHERE id = ? AND business_balance = 0').run('prt-zaferan');
  db.prepare('UPDATE partners SET business_balance = 3200000 WHERE id = ? AND business_balance = 0').run('prt-express');
  db.prepare('UPDATE partners SET business_balance = 1800000 WHERE id = ? AND business_balance = 0').run('prt-castiron');

  // Seed initial sponsor campaigns if empty
  const campCount = (db.prepare('SELECT COUNT(*) as c FROM sponsor_campaigns').get() as {c: number}).c;
  if (campCount === 0) {
    const insertCamp = db.prepare(`
      INSERT INTO sponsor_campaigns (
        id, partner_id, title, subtitle, placement, promo_code, cta_label,
        budget_toman, spent_toman, impressions, clicks, status, starts_at, ends_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCamp.run(
      'camp-zaferan-autumn',
      'prt-zaferan',
      'برداشت تازه زعفران سرگل قائنات — ۱۵٪ ویژه کاربران لاقلی',
      'مستقیم از کشاورز با برگه آزمایش خلوص برای ته‌چین‌ها و پلوهای اصیل ایرانی.',
      'explore_showcase',
      'LAGHELI15',
      'مشاهده فروشگاه زعفران',
      2500000,
      420000,
      1420,
      98,
      'active',
      '۱۴۰۵/۰۸/۰۱',
      '۱۴۰۵/۰۹/۳۰',
      now
    );
    insertCamp.run(
      'camp-sabz-delivery',
      'prt-express',
      'ارسال رایگان اولین سبد لیست خرید در زیر ۴۵ دقیقه',
      'سبزی تازه پاک‌شده، لبنیات محلی و مواد اولیه دستور پخت شما درب منزل.',
      'shopping_delivery',
      'FREESABZ',
      'تکمیل سبد با پیک سبز',
      1800000,
      310000,
      960,
      74,
      'active',
      '۱۴۰۵/۰۸/۱۰',
      '۱۴۰۵/۱۰/۱۵',
      now
    );
  }

  // Seed 1 sample pending user photo so Admin Photo Moderation queue is testable immediately
  const photoCount = (db.prepare('SELECT COUNT(*) as c FROM recipe_photos').get() as {c: number}).c;
  if (photoCount === 0) {
    db.prepare(`
      INSERT INTO recipe_photos (id, recipe_id, user_id, user_name, image_url, caption, status, is_cover, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'photo-seed-1',
      'rec-fesenjan',
      'chef-parisa',
      'سرآشپز پریسا بهرامی',
      '/src/assets/images/dish_fesenjan_editorial_1795554313427.jpg',
      'با گردوی تازه تویسرکان و ۴ ساعت جاافتادن آرام؛ روغن‌انداختن بی‌نظیری داشت.',
      'pending',
      0,
      now
    );
  }

  // Seed initial anonymized search trends when search_logs is empty (live user searches append continuously)
  const searchLogCount = (db.prepare('SELECT COUNT(*) as c FROM search_logs').get() as {c: number}).c;
  if (searchLogCount === 0) {
    const insertSearch = db.prepare(`
      INSERT INTO search_logs (id, query_raw, query_norm, source, results_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const baselineTrends: {raw: string; norm: string; source: 'search' | 'fridge'; results: number; count: number}[] = [
      {raw: 'کوکو سبزی', norm: 'کوکو سبزی', source: 'search', results: 1, count: 14},
      {raw: 'عدس پلو', norm: 'عدس پلو', source: 'search', results: 1, count: 11},
      {raw: 'ته‌چین زعفرانی', norm: 'ته چین زعفرانی', source: 'search', results: 1, count: 12},
      {raw: 'فسنجان ملس', norm: 'فسنجان ملس', source: 'search', results: 1, count: 9},
      {raw: 'قرمه سبزی اصیل', norm: 'قرمه سبزی اصیل', source: 'search', results: 0, count: 10},
      {raw: 'زرشک پلو با مرغ مجلسی', norm: 'زرشک پلو با مرغ مجلسی', source: 'search', results: 0, count: 8},
      {raw: 'میرزاقاسمی', norm: 'میرزاقاسمی', source: 'search', results: 2, count: 7},
      {raw: 'کباب تابه‌ای', norm: 'کباب تابه ای', source: 'search', results: 0, count: 6},
      {raw: 'آش رشته', norm: 'اش رشته', source: 'search', results: 1, count: 6},
      {raw: 'تخم مرغ', norm: 'تخم مرغ', source: 'fridge', results: 3, count: 5},
      {raw: 'زعفران', norm: 'زعفران', source: 'fridge', results: 3, count: 5},
    ];
    let idx = 1;
    for (const item of baselineTrends) {
      for (let i = 0; i < item.count; i++) {
        const offsetHours = (idx * 3) % 120;
        const ts = new Date(Date.now() - offsetHours * 3600 * 1000).toISOString();
        insertSearch.run(`slog-seed-${idx}`, item.raw, item.norm, item.source, item.results, ts);
        idx++;
      }
    }
  }

  // Ensure default dynamic ACL roles exist in acl_roles table
  const insertAclRole = db.prepare(`
    INSERT OR IGNORE INTO acl_roles (
      id, label, short_label, description, permissions_json, is_system, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `);
  for (const roleDef of DEFAULT_DYNAMIC_ROLES) {
    insertAclRole.run(
      roleDef.id,
      roleDef.label,
      roleDef.shortLabel,
      roleDef.description,
      JSON.stringify(roleDef.permissions),
      now,
      now
    );
  }

  // Upgrade existing senior_admin and finance_manager rows to include finance.reports idempotently
  for (const roleId of ['senior_admin', 'finance_manager']) {
    const existingRole = db
      .prepare('SELECT permissions_json FROM acl_roles WHERE id = ?')
      .get(roleId) as {permissions_json: string} | undefined;
    if (existingRole) {
      const perms = JSON.parse(existingRole.permissions_json || '[]') as string[];
      if (!perms.includes('finance.reports')) {
        perms.push('finance.reports');
        db.prepare('UPDATE acl_roles SET permissions_json = ?, updated_at = ? WHERE id = ?').run(
          JSON.stringify(Array.from(new Set(perms))),
          now,
          roleId
        );
      }
    }
  }

  // Seed curated, non-intrusive Native Ad Units across all 4 formats (zero fake discount codes)
  const nativeAdCount = (db.prepare('SELECT COUNT(*) as c FROM native_ads').get() as {c: number}).c;
  if (nativeAdCount === 0) {
    const insertNativeAd = db.prepare(`
      INSERT INTO native_ads (
        id, partner_id, format, title, subtitle, editorial_copy, cta_label, target_url,
        match_keywords_json, match_categories_json, priority, status, impressions, clicks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    insertNativeAd.run(
      'nad-zaferan-inline',
      'prt-zaferan',
      'inline_ingredient',
      'زعفران سرگل خالص قائنات',
      'پیشنهاد برای عطر و رنگ طبیعی پلوها و ته‌چین',
      'برداشت پاییزی مزارع قائنات با دم‌دهی شفاف و بدون افزودنی رنگ.',
      'مشاهده معرفی برند',
      null,
      JSON.stringify(['زعفران', 'زعفران دم کرده', 'زعفران سابیده', 'برنج ایرانی']),
      JSON.stringify(['ادویه و معطرها']),
      9,
      640,
      54,
      now
    );

    insertNativeAd.run(
      'nad-gilan-inline',
      'prt-artisan',
      'inline_ingredient',
      'رب انار ملس خانگی و گردوی تویسرکان',
      'انتخاب تحریریه برای خورش‌های اصیل شمالی',
      'پخت آرام روی هیزم در کارگاه بومی بدون مواد نگهدارنده برای تعادل طعم ملس.',
      'آشنایی با تولیدکننده',
      null,
      JSON.stringify(['رب انار', 'گردو', 'مغز گردو', 'سبزی', 'بادمجان']),
      JSON.stringify(['چاشنی و رب‌ها', 'خشکبار و مغزها']),
      8,
      510,
      41,
      now
    );

    insertNativeAd.run(
      'nad-castiron-tool',
      'prt-castiron',
      'contextual_tool',
      'تابه و قابلمه چدن طبیعی رَست',
      'پخش یکنواخت حرارت برای ته‌دیگ طلایی و جاافتادن آرام خورش',
      'چدن بدون پوشش شیمیایی، مناسب شعله ملایم و فر برای پخت‌های طولانی ایرانی.',
      'بررسی ابزار آشپزی',
      null,
      JSON.stringify(['قابلمه', 'ماهیتابه', 'تابه', 'چدن', 'فر', 'قابلمه نچسب']),
      JSON.stringify([]),
      9,
      420,
      39,
      now
    );

    insertNativeAd.run(
      'nad-story-zaferan',
      'prt-zaferan',
      'feed_editorial_story',
      'راز دم‌کردن زعفران با یخ؛ از مزارع قائنات تا آشپزخانه شما',
      'یادداشت مشترک تحریریه لاقلی و خانه زعفران خراسان',
      'چرا شوک دمایی یخ عطر سافرانال زعفران تازه را تا دو برابر آزاد می‌کند؟ در صفحه خانه زعفران با استاندارد تشخیص اصالت کلاله آشنا شوید.',
      'مطالعه معرفی برند',
      null,
      JSON.stringify(['زعفران', 'ته چین', 'پلو']),
      JSON.stringify(['ادویه و معطرها']),
      9,
      1180,
      92,
      now
    );

    insertNativeAd.run(
      'nad-story-castiron',
      'prt-castiron',
      'feed_editorial_story',
      'چرا سرآشپزها برای خورش‌های جاافتاده سراغ چدن طبیعی می‌روند؟',
      'داستان ساخت ظروف دست‌ساز در کارگاه چدنی رَست',
      'ظرف چدنی با ذخیره حرارتی بالا از سوختن ته‌دیگ جلوگیری می‌کند و طعم خورش را عمیق‌تر می‌سازد.',
      'آشنایی با کارگاه رَست',
      null,
      JSON.stringify(['خورش', 'قابلمه', 'چدن']),
      JSON.stringify([]),
      7,
      890,
      63,
      now
    );

    insertNativeAd.run(
      'nad-pantry-fresh',
      'prt-artisan',
      'pantry_companion',
      'تأمین مواد بومی و ادویه‌های دست‌چین بدون واسطه',
      'برگزیده برای لیست خرید و یخچال خانگی شما',
      'اگر دنبال سبزی خشک معطر، رب انار خالص و ادویه تازه آسیاب‌شده هستید، مجموعه تولیدکنندگان بومی تاییدشده لاقلی را ببینید.',
      'مشاهده تولیدکنندگان بومی',
      null,
      JSON.stringify(['پیاز', 'سیر', 'سبزی', 'رب انار', 'کشک', 'زعفران', 'برنج', 'عدس', 'گردو']),
      JSON.stringify(['سبزیجات و صیفی‌جات', 'ادویه و معطرها', 'چاشنی و رب‌ها', 'حبوبات']),
      8,
      730,
      58,
      now
    );
  }

  // Seed iconic Iranian brands & venues for smart category-based native ads, auctions, and location recommendations
  const insertBrandPartner = db.prepare(`
    INSERT OR IGNORE INTO partners (
      id, slug, name, role_type, city, neighborhood, description, address, phone, website,
      verified, claim_status, tier, business_balance, promo_code, promo_label, affiliate_code,
      related_ingredients_json, related_tools_json, catalog_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'verified', ?, ?, '', '', '', ?, ?, '[]', 'approved', ?)
  `);

  insertBrandPartner.run(
    'prt-kalleh',
    'kalleh-dairy',
    'لبنیات کاله',
    'food_brands',
    'تهران',
    'ونک',
    'تولیدکننده پیشرو محصولات لبنی تازه شامل ماست چکیده، کره پاستوریزه، پنیر و خامه برای آشپزی اصیل ایرانی.',
    'تهران، بلوار میرداماد، دفتر مرکزی کاله',
    '021-84321000',
    'https://kalleh.com',
    'sponsor',
    45000000,
    JSON.stringify(['ماست', 'ماست چکیده', 'کره', 'خامه', 'پنیر', 'شیر', 'کشک']),
    JSON.stringify([]),
    now
  );

  insertBrandPartner.run(
    'prt-mihan',
    'mihan-dairy',
    'لبنیات میهن',
    'food_brands',
    'تهران',
    'جردن',
    'مجموعه لبنیات تازه و محصولات خامه‌ای میهن برای طعم لطیف دسرها، صبحانه و غذاهای ایرانی.',
    'تهران، جردن، دفتر مرکزی میهن',
    '021-88776655',
    'https://mihan.ir',
    'featured',
    28000000,
    JSON.stringify(['شیر', 'خامه', 'کره', 'ماست', 'پنیر']),
    JSON.stringify([]),
    now
  );

  insertBrandPartner.run(
    'prt-zarmacaron',
    'zar-macaron',
    'زر ماکارون',
    'food_brands',
    'تهران',
    'مرکزی',
    'پاستا و ماکارونی تهیه‌شده از آرد سمولینا برای پخت یکدست و بافت حرفه‌ای در انواع پاستا و لازانیا.',
    'تهران، دفتر مرکزی زر ماکارون',
    '021-44556677',
    'https://zarmacaron.com',
    'featured',
    19000000,
    JSON.stringify(['ماکارونی', 'پاستا', 'اسپاگتی', 'لازانیا', 'رشته']),
    JSON.stringify([]),
    now
  );

  insertBrandPartner.run(
    'prt-bahram',
    'bahram-sauce',
    'سس بهرام',
    'food_brands',
    'تهران',
    'مرکزی',
    'چاشنی‌ها، سس‌های گرم و سرد و رب‌های استاندارد برای تکمیل طعم پاستا، ساندویچ و غذاهای سریع.',
    'تهران، دفتر فروش سس بهرام',
    '021-66778899',
    'https://bahramsauce.ir',
    'featured',
    14000000,
    JSON.stringify(['سس', 'رب گوجه', 'رب گوجه‌فرنگی', 'کچاپ', 'مایونز']),
    JSON.stringify([]),
    now
  );

  insertBrandPartner.run(
    'prt-can',
    'can-kitchenware',
    'لوازم آشپزخانه کَن',
    'kitchen_equipment',
    'تهران',
    'شریعتی',
    'تولیدکننده اجاق گاز، هود و فرهای توکار مدرن با کنترل دقیق حرارت برای جاافتادن خورش‌ها و پخت حرفه‌ای.',
    'تهران، خیابان شریعتی، نمایشگاه مرکزی کَن',
    '021-22889900',
    'https://can.ir',
    'sponsor',
    35000000,
    JSON.stringify(['خورش', 'ته چین']),
    JSON.stringify(['فر', 'اجاق', 'قابلمه', 'ماهیتابه', 'تابه', 'هود']),
    now
  );

  insertBrandPartner.run(
    'prt-soo',
    'soo-restaurant',
    'رستوران سو',
    'restaurants_kitchens',
    'تهران',
    'ونک',
    'رستوران ایرانی معاصر در قلب تهران با سرو روزانه خورش‌های اصیل، ته‌چین زعفرانی و غذاهای شمالی دست‌پخت سرآشپز.',
    'تهران، میدان ونک، خیابان ملاصدرا، پلاک ۴۲',
    '021-88664422',
    'https://soo-restaurant.ir',
    'featured',
    12000000,
    JSON.stringify(['فسنجان', 'ته‌چین', 'قورمه‌سبزی', 'عدس‌پلو', 'میرزاقاسمی']),
    JSON.stringify([]),
    now
  );

  insertBrandPartner.run(
    'prt-roastcafe',
    'roast-cafe-tehran',
    'کافه برشته‌کاری رُست',
    'cafes_bakeries',
    'تهران',
    'جردن',
    'کافه تخصصی نوشیدنی‌های گرم و سرد، صبحانه سالم و پاستاهای تازه در محله جردن.',
    'تهران، بلوار نلسون ماندلا، کوچه ناهید غربی، پلاک ۱۸',
    '021-22051133',
    'https://roastcafe.ir',
    'featured',
    9000000,
    JSON.stringify(['قهوه', 'لاته', 'صبحانه', 'پاستا', 'کوکو']),
    JSON.stringify([]),
    now
  );

  // Backfill semantic recipe categories & media types on legacy seeded native ads + add brand-specific ads
  db.prepare(
    `UPDATE native_ads
     SET media_type = 'text', recipe_categories_json = ?
     WHERE id = 'nad-zaferan-inline' AND (recipe_categories_json IS NULL OR recipe_categories_json = '[]')`
  ).run(JSON.stringify(['پلو و ته‌چین', 'خورش', 'ادویه و چاشنی']));

  db.prepare(
    `UPDATE native_ads
     SET media_type = 'text', recipe_categories_json = ?
     WHERE id = 'nad-gilan-inline' AND (recipe_categories_json IS NULL OR recipe_categories_json = '[]')`
  ).run(JSON.stringify(['خورش', 'غذای شمالی', 'ادویه و چاشنی']));

  db.prepare(
    `UPDATE native_ads
     SET media_type = 'click', recipe_categories_json = ?
     WHERE id = 'nad-castiron-tool' AND (recipe_categories_json IS NULL OR recipe_categories_json = '[]')`
  ).run(JSON.stringify(['خورش', 'لوازم آشپزخانه', 'پلو و ته‌چین']));

  db.prepare(
    `UPDATE native_ads
     SET media_type = 'banner', recipe_categories_json = ?
     WHERE id = 'nad-story-zaferan' AND (recipe_categories_json IS NULL OR recipe_categories_json = '[]')`
  ).run(JSON.stringify(['پلو و ته‌چین', 'ادویه و چاشنی', 'همه دسته‌ها']));

  db.prepare(
    `UPDATE native_ads
     SET media_type = 'banner', recipe_categories_json = ?
     WHERE id = 'nad-story-castiron' AND (recipe_categories_json IS NULL OR recipe_categories_json = '[]')`
  ).run(JSON.stringify(['خورش', 'لوازم آشپزخانه']));

  const insertExtendedNativeAd = db.prepare(`
    INSERT OR IGNORE INTO native_ads (
      id, partner_id, format, media_type, title, subtitle, editorial_copy, cta_label, target_url,
      utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
      match_categories_json, slot_id, starts_at, ends_at, pricing_mode, bid_amount_toman,
      priority, status, impressions, clicks, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
  `);

  const todayIso = new Date().toISOString().slice(0, 10);
  const plus60Iso = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);

  insertExtendedNativeAd.run(
    'nad-kalleh-dairy-inline',
    'prt-kalleh',
    'inline_ingredient',
    'click',
    'ماست چکیده و کره پاستوریزه کاله',
    'بافت غلیظ و یکدست برای ته‌چین طلایی و غذاهای لبنی',
    'انتخاب حرفه‌ای برای جلوگیری از آب‌انداختن مایه ته‌چین و عطر طبیعی کره در پلوهای مجلسی.',
    'مشاهده محصولات کاله',
    'https://kalleh.com/products/dairy',
    'lagheli',
    'inline_click',
    'kalleh_dairy_recipes',
    JSON.stringify(['لبنیات', 'پلو و ته‌چین', 'پیش‌غذا و صبحانه']),
    JSON.stringify(['ماست چکیده', 'ماست', 'کره', 'خامه', 'پنیر', 'کشک', 'شیر']),
    JSON.stringify(['لبنیات']),
    'slot-dairy-inline',
    todayIso,
    plus60Iso,
    'fixed',
    14000000,
    10,
    1540,
    132,
    now
  );

  insertExtendedNativeAd.run(
    'nad-kalleh-dairy-banner',
    'prt-kalleh',
    'feed_editorial_story',
    'banner',
    'راز تردی ته‌چین و بافت لطیف غذاهای لبنی با لبنیات تازه کاله',
    'پیشنهاد ویژه دسته‌بندی غذاهای لبنی و پلوهای مجلسی',
    'استفاده از ماست چکیده کم‌آب و کره حیوانی باکیفیت تفاوت میان یک ته‌چین معمولی و یک ته‌چین رستورانی را رقم می‌زند.',
    'بررسی راهنمای لبنیات کاله',
    'https://kalleh.com/recipes',
    'lagheli',
    'feed_banner',
    'kalleh_feed_dairy',
    JSON.stringify(['لبنیات', 'پلو و ته‌چین', 'ناهار و شام']),
    JSON.stringify(['ماست', 'کره', 'کشک', 'پنیر', 'ته‌چین']),
    JSON.stringify(['لبنیات']),
    'slot-dairy-banner',
    todayIso,
    plus60Iso,
    'auction',
    24000000,
    9,
    2180,
    176,
    now
  );

  insertExtendedNativeAd.run(
    'nad-can-stew-tool',
    'prt-can',
    'contextual_tool',
    'click',
    'پخت آرام و یکنواخت خورش‌های مجلسی روی اجاق و فر توکار کَن',
    'جایگاه اختصاصی دسته‌بندی خورش و تجهیزات آشپزخانه',
    'شعله‌پخش‌کن دقیق و کنترل حرارت ملایم در سری جدید اجاق و فرهای کَن، جاافتادن فسنجان و قورمه‌سبزی را بدون سوختگی تضمین می‌کند.',
    'مشاهده پروموشن کَن',
    'https://can.ir/promotion/stew-season',
    'lagheli',
    'contextual_click',
    'can_khorsht_promo',
    JSON.stringify(['خورش', 'لوازم آشپزخانه', 'ناهار و شام']),
    JSON.stringify(['خورش', 'فسنجان', 'قرمه', 'قابلمه', 'فر', 'اجاق']),
    JSON.stringify([]),
    'slot-stew-kitchen',
    todayIso,
    plus60Iso,
    'fixed',
    18500000,
    10,
    1320,
    118,
    now
  );

  insertExtendedNativeAd.run(
    'nad-zar-pasta-inline',
    'prt-zarmacaron',
    'inline_ingredient',
    'click',
    'پاستا و رشته سمولینا زر ماکارون',
    'بافت آل‌دنته بدون له‌شدن در پخت‌های خمیری و آش‌ها',
    'تهیه‌شده از گندم دوروم با پایداری بافت عالی برای انواع پاستا، ماکارونی و رشته اصیل.',
    'مشاهده سبد زر ماکارون',
    'https://zarmacaron.com/products',
    'lagheli',
    'inline_click',
    'zar_pasta_slot',
    JSON.stringify(['پاستا و ماکارونی', 'ناهار و شام']),
    JSON.stringify(['ماکارونی', 'پاستا', 'رشته', 'رشته آش', 'لازانیا', 'اسپاگتی']),
    JSON.stringify(['غلات و آرد']),
    'slot-pasta-inline',
    todayIso,
    plus60Iso,
    'auction',
    12500000,
    8,
    870,
    69,
    now
  );

  insertExtendedNativeAd.run(
    'nad-bahram-sauce-inline',
    'prt-bahram',
    'inline_ingredient',
    'text',
    'سس‌ها و چاشنی‌های اصیل بهرام',
    'تعادل طعم گوجه و ادویه در سس‌های گرم و غذاهای سریع',
    'توصیه تحریریه برای چاشنی‌زدن دقیق به غذاهای سریع، پاستا و خوراک‌های روزمره.',
    'آشنایی با سس بهرام',
    'https://bahramsauce.ir/catalog',
    'lagheli',
    'text_mention',
    'bahram_sauces',
    JSON.stringify(['پاستا و ماکارونی', 'ادویه و چاشنی', 'پیش‌غذا و صبحانه']),
    JSON.stringify(['رب گوجه', 'رب گوجه‌فرنگی', 'سس', 'گوجه', 'پیاز']),
    JSON.stringify(['چاشنی و رب‌ها']),
    null,
    todayIso,
    plus60Iso,
    'fixed',
    9500000,
    7,
    620,
    47,
    now
  );

  // Seed Ad Slot Inventory (Fixed, Auction, and Hybrid Slots)
  const slotCount = (db.prepare('SELECT COUNT(*) as c FROM ad_slots').get() as {c: number}).c;
  if (slotCount === 0) {
    const insertSlot = db.prepare(`
      INSERT INTO ad_slots (
        id, title, description, format, media_type, target_category, pricing_model,
        fixed_price_toman, min_bid_toman, bid_step_toman, is_exclusive, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `);

    insertSlot.run(
      'slot-dairy-banner',
      'بنر تحریریه‌ای دسته‌بندی لبنیات و پلوها',
      'نمایش بنر هماهنگ و بدون مزاحمت در فید دستورهای دارای ماست، کره، پنیر، کشک و خامه (مناسب برندهای لبنی مانند کاله و میهن).',
      'feed_editorial_story',
      'banner',
      'لبنیات',
      'hybrid',
      26000000,
      18000000,
      1500000,
      1,
      now
    );

    insertSlot.run(
      'slot-stew-kitchen',
      'جایگاه انحصاری تجهیزات آشپزی در دسته خورش',
      'توصیه کلیکی با لینک ردیابی اختصاصی در صفحه دستورپخت خورش‌ها و ابزار پخت (مناسب برندهای تجهیزات آشپزخانه مانند کَن).',
      'contextual_tool',
      'click',
      'خورش',
      'hybrid',
      22000000,
      15000000,
      1000000,
      1,
      now
    );

    insertSlot.run(
      'slot-spices-stew-text',
      'یادداشت متنی ادویه و چاشنی در دستورهای خورش',
      'نمایش یادداشت یک‌خطی بسیار آرام زیر مواد ادویه‌ای و چاشنی‌های خورش‌های ایرانی بدون حس شلوغی.',
      'inline_ingredient',
      'text',
      'ادویه و چاشنی',
      'fixed',
      11000000,
      8000000,
      500000,
      0,
      now
    );

    insertSlot.run(
      'slot-pasta-inline',
      'توصیه کلیکی دسته پاستا، ماکارونی و سس‌ها',
      'جایگاه توصیه برند دقیقاً کنار مواد پاستا، رشته و سس‌ها با لینک ردیابی بازاریابی (مناسب زر ماکارون و سس بهرام).',
      'inline_ingredient',
      'click',
      'پاستا و ماکارونی',
      'auction',
      16000000,
      11000000,
      1000000,
      1,
      now
    );

    insertSlot.run(
      'slot-dairy-inline',
      'توصیه درون‌مواد لبنیات (متنی و کلیکی)',
      'درج معرفی برند زیر اقلام لبنی در لیست مواد اولیه دستورها برای بیشترین نرخ تعامل در لحظه تصمیم خرید.',
      'inline_ingredient',
      'click',
      'لبنیات',
      'hybrid',
      15000000,
      10000000,
      1000000,
      0,
      now
    );

    insertSlot.run(
      'slot-feed-general-banner',
      'بنر تحریریه‌ای صفحه اول کاوش (همه دسته‌ها)',
      'کارت داستان برند با فاصله حداقل ۶ دستورپخت در فید اصلی، ویژه معرفی داستان تولیدکنندگان و برندهای بزرگ.',
      'feed_editorial_story',
      'banner',
      'همه دسته‌ها',
      'auction',
      32000000,
      22000000,
      2000000,
      1,
      now
    );
  }

  // Ensure high-demand recipe-header auction slots always exist for the Smart Auction Room
  const insertSlotIgnore = db.prepare(`
    INSERT OR IGNORE INTO ad_slots (
      id, title, description, format, media_type, target_category, pricing_model,
      fixed_price_toman, min_bid_toman, bid_step_toman, is_exclusive, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
  `);

  insertSlotIgnore.run(
    'slot-recipe-header-stews',
    'سربرگ دستورپخت‌های ویژه خورش‌های اصیل ایرانی',
    'حضور انحصاری و باوقار در سربرگ صفحه دستورپخت‌های پرطرفدار خورش (قورمه‌سبزی، فسنجان، قیمه) با بیشترین زمان مطالعه کاربر.',
    'contextual_tool',
    'banner',
    'خورش',
    'auction',
    34000000,
    24000000,
    1500000,
    1,
    now
  );

  insertSlotIgnore.run(
    'slot-recipe-header-tahchin',
    'سربرگ دستورپخت‌های مجلسی پلو، ته‌چین و زعفران',
    'جایگاه مزایده‌ای در بالای دستورهای مجلسی پلو و ته‌چین؛ مناسب برندهای زعفران، برنج، لبنیات و ادویه ممتاز.',
    'feed_editorial_story',
    'banner',
    'پلو و ته‌چین',
    'hybrid',
    29000000,
    19000000,
    1500000,
    1,
    now
  );

  // Seed Flagship "Powered By" Sponsorship (1m / 3m / 6m / 12m)
  const flagshipCount = (db.prepare('SELECT COUNT(*) as c FROM flagship_sponsorships').get() as {c: number}).c;
  if (flagshipCount === 0) {
    const plus180Iso = new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO flagship_sponsorships (
        id, partner_id, partner_name, tagline, cta_label, target_url, utm_campaign,
        duration, price_toman, starts_at, ends_at, status, impressions, clicks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `).run(
      'flagship-kalleh-6m',
      'prt-kalleh',
      'کاله',
      'همراه طعم اصیل و لبنیات تازه در آشپزخانه ایرانی',
      'آشنایی با حامی',
      'https://kalleh.com',
      'lagheli_powered_by_6m',
      '6m',
      215000000,
      todayIso,
      plus180Iso,
      4820,
      312,
      now
    );
  }

  // Seed Local Venues (Restaurants, Cafes & Fast-Foods matched by location + recipe)
  const venueCount = (db.prepare('SELECT COUNT(*) as c FROM local_venues').get() as {c: number}).c;
  if (venueCount === 0) {
    const insertVenue = db.prepare(`
      INSERT INTO local_venues (
        id, partner_id, name, venue_type, city, neighborhood, address, phone, lat, lng,
        served_dishes_json, served_categories_json, delivery_note, menu_url, utm_campaign,
        is_featured, status, impressions, clicks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `);

    insertVenue.run(
      'venue-soo-vanak',
      'prt-soo',
      'رستوران سو',
      'restaurant',
      'تهران',
      'ونک',
      'میدان ونک، خیابان ملاصدرا، پلاک ۴۲',
      '021-88664422',
      35.7575,
      51.4099,
      JSON.stringify(['ته‌چین زعفرانی مرغ', 'ته‌چین', 'فسنجان', 'خورشت فسنجان', 'باقالی پلو', 'عدس پلو', 'میرزاقاسمی']),
      JSON.stringify(['خورش', 'پلو و ته‌چین', 'ناهار و شام', 'غذای شمالی']),
      'سرو حضوری و ارسال داغ محدوده ونک و جردن در ۳۵ دقیقه',
      'https://soo-restaurant.ir/menu',
      'soo_recipe_nearby',
      1,
      940,
      118,
      now
    );

    insertVenue.run(
      'venue-roast-jordan',
      'prt-roastcafe',
      'کافه برشته‌کاری رُست',
      'cafe',
      'تهران',
      'جردن',
      'بلوار نلسون ماندلا، کوچه ناهید غربی، پلاک ۱۸',
      '021-22051133',
      35.7689,
      51.4167,
      JSON.stringify(['لاته', 'قهوه', 'نوشیدنی', 'کوکو سبزی', 'صبحانه', 'پاستا', 'آش رشته']),
      JSON.stringify(['نوشیدنی', 'پیش‌غذا و صبحانه', 'پاستا و ماکارونی', 'گیاهی و رژیمی']),
      'سرو تخصصی نوشیدنی، عصرانه و پیش‌غذاهای سالم روزانه',
      'https://roastcafe.ir/menu',
      'roast_cafe_nearby',
      1,
      610,
      74,
      now
    );

    insertVenue.run(
      'venue-gilaneh-west',
      'prt-artisan',
      'آشپزخانه محلی گیلانه',
      'restaurant',
      'تهران',
      'شهرک غرب',
      'شهرک غرب، بلوار دادمان، نبش فخار مقدم',
      '021-88361212',
      35.7618,
      51.3724,
      JSON.stringify(['میرزاقاسمی', 'فسنجان', 'خورشت فسنجان', 'کوکو سبزی', 'باقالی قاتوق', 'آش رشته']),
      JSON.stringify(['غذای شمالی', 'خورش', 'گیاهی و رژیمی', 'پیش‌غذا و صبحانه']),
      'طبخ روزانه با مواد بومی گیلان و ارسال در غرب تهران',
      'https://gilanehkitchen.ir',
      'gilaneh_nearby',
      0,
      480,
      52,
      now
    );

    insertVenue.run(
      'venue-atish-tajrish',
      null,
      'فست‌فود و گریل آتیش',
      'fastfood',
      'تهران',
      'تجریش',
      'خیابان ولیعصر، نرسیده به میدان تجریش، پلاک ۱۱۴',
      '021-22719090',
      35.8044,
      51.4281,
      JSON.stringify(['پاستا', 'ماکارونی', 'خوراک سریع', 'ساندویچ', 'مرغ گریل', 'کوکو']),
      JSON.stringify(['پاستا و ماکارونی', 'پخت سریع', 'پرپروتئین']),
      'آماده‌سازی سریع زیر ۲۰ دقیقه برای وعده‌های پرتحرک',
      'https://atishgrill.ir/order',
      'atish_fastfood_nearby',
      0,
      390,
      41,
      now
    );

    insertVenue.run(
      'venue-shomal-rasht',
      'prt-artisan',
      'سفره‌خانه اصیل گلسار',
      'restaurant',
      'رشت',
      'گلسار',
      'رشت، بلوار گلسار، خیابان ۱۰۲',
      '013-33114455',
      37.2952,
      49.5912,
      JSON.stringify(['میرزاقاسمی', 'فسنجان', 'باقالی پلو', 'آش رشته', 'کوکو سبزی']),
      JSON.stringify(['غذای شمالی', 'خورش', 'ناهار و شام']),
      'سرو اصیل گیلانی در قلب گلسار رشت',
      'https://golsar-kitchen.ir',
      'golsar_rasht_nearby',
      1,
      340,
      39,
      now
    );
  }

  // Seed Isolated Advertiser Portal Accounts (strictly separate from regular consumer users & Super Admin)
  const advCount = (db.prepare('SELECT COUNT(*) as c FROM advertiser_accounts').get() as {c: number}).c;
  if (advCount === 0) {
    const insertAdv = db.prepare(`
      INSERT INTO advertiser_accounts (id, partner_id, login_identifier, manager_name, password_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `);
    const demoPassHash = hashAdvertiserPassword('brand1234');
    insertAdv.run('adv-kalleh', 'prt-kalleh', 'kalleh@brand.ir', 'مدیر بازاریابی کاله', demoPassHash, now);
    insertAdv.run('adv-mihan', 'prt-mihan', 'mihan@brand.ir', 'تیم برندینگ میهن', demoPassHash, now);
    insertAdv.run('adv-can', 'prt-can', 'can@brand.ir', 'مدیر کمپین لوازم آشپزخانه کَن', demoPassHash, now);
    insertAdv.run('adv-soo', 'prt-soo', 'soo@brand.ir', 'مدیریت رستوران سو', demoPassHash, now);
  }

  // Seed 2 pending bids/bookings so Super Admin Approval & Auction Settlement Queue is immediately live
  const bidCount = (db.prepare('SELECT COUNT(*) as c FROM ad_bids').get() as {c: number}).c;
  if (bidCount === 0) {
    const nextStart = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const nextEnd = new Date(Date.now() + 37 * 86400000).toISOString().slice(0, 10);
    const insertBid = db.prepare(`
      INSERT INTO ad_bids (
        id, slot_id, advertiser_id, partner_id, booking_type, bid_amount_toman,
        starts_at, ends_at, title, subtitle, editorial_copy, cta_label, target_url,
        utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
        status, admin_note, created_ad_id, created_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', NULL, ?, NULL)
    `);

    insertBid.run(
      'bid-mihan-dairy-1',
      'slot-dairy-banner',
      'adv-mihan',
      'prt-mihan',
      'auction',
      27500000,
      nextStart,
      nextEnd,
      'خامه صبحانه و کره تازه میهن؛ لطافت طعم در غذاهای خانگی',
      'پیشنهاد مزایده برای ماه آینده دسته‌بندی لبنیات',
      'محصولات لبنی تازه میهن با استاندارد زنجیره سرد، انتخاب مطمئن برای دسرها، صبحانه و غذاهای ایرانی.',
      'مشاهده محصولات میهن',
      'https://mihan.ir/dairy-recipes',
      'lagheli',
      'feed_banner',
      'mihan_dairy_auction_q4',
      JSON.stringify(['لبنیات', 'پیش‌غذا و صبحانه']),
      JSON.stringify(['خامه', 'کره', 'شیر', 'ماست']),
      now
    );

    insertBid.run(
      'bid-can-stew-2',
      'slot-feed-general-banner',
      'adv-can',
      'prt-can',
      'auction',
      29000000,
      nextStart,
      nextEnd,
      'جشنواره پخت آرام با فرها و اجاق‌های هوشمند کَن',
      'کمپین کلیکی با لینک ردیابی اختصاصی فصل پاییز',
      'با کنترل دمای دیجیتال کَن، هر دستورپخت سنتی و مدرن دقیقاً مطابق زمان‌بندی سرآشپز آماده می‌شود.',
      'دریافت اطلاعات پروموشن کَن',
      'https://can.ir/festival',
      'lagheli',
      'feed_banner',
      'can_autumn_festival',
      JSON.stringify(['خورش', 'لوازم آشپزخانه', 'همه دسته‌ها']),
      JSON.stringify(['خورش', 'فر', 'اجاق', 'قابلمه']),
      now
    );
  }

  // Ensure live multi-bidder competition exists on recipe-header auction slots for immediate Smart Auction experience
  const recipeHeaderBidsCount = (
    db.prepare("SELECT COUNT(*) as c FROM ad_bids WHERE slot_id IN ('slot-recipe-header-stews', 'slot-recipe-header-tahchin')").get() as {c: number}
  ).c;
  if (recipeHeaderBidsCount === 0) {
    const nextStart = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const nextEnd = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);
    const olderTs = new Date(Date.now() - 1000 * 60 * 38).toISOString();
    const recentTs = new Date(Date.now() - 1000 * 60 * 11).toISOString();
    const insertBidIgnore = db.prepare(`
      INSERT OR IGNORE INTO ad_bids (
        id, slot_id, advertiser_id, partner_id, booking_type, bid_amount_toman,
        starts_at, ends_at, title, subtitle, editorial_copy, cta_label, target_url,
        utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
        status, admin_note, created_ad_id, created_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', NULL, ?, NULL)
    `);

    insertBidIgnore.run(
      'bid-can-header-stew-1',
      'slot-recipe-header-stews',
      'adv-can',
      'prt-can',
      'auction',
      25500000,
      nextStart,
      nextEnd,
      'پخت یکنواخت خورش‌های اصیل با اجاق‌های هوشمند کَن',
      'حمایت سربرگ دستورپخت‌های خورش',
      'تنظیم دقیق شعله آرام برای جاافتادن خورش‌های سنتی ایرانی بدون ته‌گرفتن.',
      'مشاهده کلکسیون آشپزی کَن',
      'https://can.ir/stews-header',
      'lagheli',
      'banner',
      'can_stews_header_auction',
      JSON.stringify(['خورش']),
      JSON.stringify(['خورش', 'قورمه سبزی', 'فسنجان', 'قابلمه']),
      olderTs
    );

    insertBidIgnore.run(
      'bid-kalleh-header-stew-2',
      'slot-recipe-header-stews',
      'adv-kalleh',
      'prt-kalleh',
      'auction',
      27000000,
      nextStart,
      nextEnd,
      'کره حیوانی تازه کاله؛ راز عطر خورش‌های مجلسی',
      'همراهی سربرگ دستورهای خورش ایرانی',
      'عطر اصیل کره تازه در تفت دادن سبزی و پیازداغ، تفاوت خورش خانگی را رقم می‌زند.',
      'آشنایی با محصولات لبنی کاله',
      'https://kalleh.com/stew-butter',
      'lagheli',
      'banner',
      'kalleh_stews_header_q4',
      JSON.stringify(['خورش', 'لبنیات']),
      JSON.stringify(['کره', 'خورش', 'قیمه']),
      recentTs
    );

    insertBidIgnore.run(
      'bid-mihan-header-tahchin-1',
      'slot-recipe-header-tahchin',
      'adv-mihan',
      'prt-mihan',
      'auction',
      21500000,
      nextStart,
      nextEnd,
      'ماست چکیده و کره ممتاز میهن؛ بافت طلایی ته‌چین',
      'سربرگ اختصاصی پلو و ته‌چین مجلسی',
      'برای ته‌دیگ یکدست و لایه میانی لطیف در ته‌چین زعفرانی، از ماست چکیده تازه استفاده کنید.',
      'مشاهده محصولات میهن',
      'https://mihan.ir/tahchin-guide',
      'lagheli',
      'banner',
      'mihan_tahchin_header',
      JSON.stringify(['پلو و ته‌چین', 'لبنیات']),
      JSON.stringify(['ته‌چین', 'ماست', 'کره', 'پلو']),
      recentTs
    );
  }

  // Seed realistic baseline behavioral telemetry & dietary profiles so Super Admin Intelligence Hub is immediately meaningful
  const behaviorSessCount = (db.prepare('SELECT COUNT(*) as c FROM behavior_sessions').get() as {c: number}).c;
  if (behaviorSessCount === 0) {
    const insertDiet = db.prepare(`
      INSERT OR IGNORE INTO user_dietary_profiles (
        subject_key, user_id, diets_json, excluded_ingredients_json, preferred_meal_times_json,
        cooking_frequency, strict_ad_filtering, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const seedProfiles: {
      key: string;
      userId: string | null;
      diets: string[];
      excl: string[];
      freq: string;
    }[] = [
      {key: 'usr-sara', userId: 'usr-sara', diets: ['no_processed_meat'], excl: ['سوسیس', 'کالباس'], freq: 'daily'},
      {key: 'usr-reza', userId: 'usr-reza', diets: ['vegan'], excl: ['گوشت', 'سوسیس', 'شیر'], freq: 'daily'},
      {key: 'usr-niloofar', userId: 'usr-niloofar', diets: ['vegetarian', 'no_sugar'], excl: ['سوسیس', 'شکر'], freq: 'weekly'},
      {key: 'usr-parsa', userId: 'usr-parsa', diets: ['dairy_free'], excl: ['خامه', 'پنیر'], freq: 'weekly'},
      {key: 'usr-mahsa', userId: 'usr-mahsa', diets: ['gluten_free', 'low_carb'], excl: ['ماکارونی'], freq: 'weekly'},
      {key: 'guest-tehran-1', userId: null, diets: ['vegan'], excl: ['سوسیس', 'کباب'], freq: 'occasional'},
      {key: 'guest-tehran-2', userId: null, diets: [], excl: [], freq: 'daily'},
      {key: 'guest-shiraz-3', userId: null, diets: ['no_red_meat'], excl: ['گوشت قرمز'], freq: 'weekly'},
      {key: 'guest-rasht-4', userId: null, diets: [], excl: [], freq: 'occasional'},
      {key: 'guest-isfahan-5', userId: null, diets: ['vegetarian'], excl: ['کالباس'], freq: 'rarely'},
    ];

    for (const p of seedProfiles) {
      insertDiet.run(
        p.key,
        p.userId,
        JSON.stringify(p.diets),
        JSON.stringify(p.excl),
        JSON.stringify(['ناهار', 'شام']),
        p.freq,
        now
      );
    }

    const insertSess = db.prepare(`
      INSERT OR IGNORE INTO behavior_sessions (
        id, subject_key, user_id, device_type, os_family, display_mode, theme_mode,
        viewport_width, started_at, last_seen_at, duration_seconds, visit_hour, day_of_week, pages_viewed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertEv = db.prepare(`
      INSERT OR IGNORE INTO behavior_events (
        id, session_id, subject_key, user_id, event_type, section_name, target_type,
        target_id, target_label, category, numeric_value, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const recipesList = db
      .prepare("SELECT id, title, category FROM recipes WHERE status = 'published' LIMIT 8")
      .all() as {id: string; title: string; category: string}[];
    const partnersList = db.prepare('SELECT id, name FROM partners LIMIT 6').all() as {id: string; name: string}[];
    const venuesList = db.prepare('SELECT id, name, venue_type FROM local_venues LIMIT 4').all() as {
      id: string;
      name: string;
      venue_type: string;
    }[];
    const chefsList = db
      .prepare('SELECT id, name FROM users WHERE is_verified_chef = 1 LIMIT 4')
      .all() as {id: string; name: string}[];

    const seedSessionConfigs: {
      subject: string;
      userId: string | null;
      device: string;
      os: string;
      mode: string;
      theme: string;
      width: number;
      hour: number;
      dow: number;
      dur: number;
      pages: number;
      maxScroll: number;
      cooks: boolean;
      usesFridge: boolean;
      skipsMarket: boolean;
    }[] = [
      {subject: 'usr-sara', userId: 'usr-sara', device: 'mobile', os: 'ios', mode: 'pwa', theme: 'light', width: 393, hour: 11, dow: 2, dur: 840, pages: 7, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-sara', userId: 'usr-sara', device: 'mobile', os: 'ios', mode: 'pwa', theme: 'dark', width: 393, hour: 19, dow: 4, dur: 1120, pages: 9, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-sara', userId: 'usr-sara', device: 'desktop', os: 'macos', mode: 'browser', theme: 'light', width: 1440, hour: 12, dow: 5, dur: 690, pages: 6, maxScroll: 75, cooks: false, usesFridge: true, skipsMarket: true},
      {subject: 'usr-reza', userId: 'usr-reza', device: 'mobile', os: 'android', mode: 'pwa', theme: 'dark', width: 412, hour: 18, dow: 1, dur: 960, pages: 8, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-reza', userId: 'usr-reza', device: 'mobile', os: 'android', mode: 'pwa', theme: 'dark', width: 412, hour: 20, dow: 3, dur: 1480, pages: 11, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-niloofar', userId: 'usr-niloofar', device: 'mobile', os: 'ios', mode: 'browser', theme: 'light', width: 390, hour: 19, dow: 4, dur: 620, pages: 5, maxScroll: 75, cooks: true, usesFridge: false, skipsMarket: true},
      {subject: 'usr-niloofar', userId: 'usr-niloofar', device: 'tablet', os: 'ios', mode: 'pwa', theme: 'light', width: 820, hour: 10, dow: 5, dur: 910, pages: 7, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-parsa', userId: 'usr-parsa', device: 'desktop', os: 'windows', mode: 'browser', theme: 'dark', width: 1366, hour: 21, dow: 2, dur: 540, pages: 5, maxScroll: 75, cooks: false, usesFridge: true, skipsMarket: true},
      {subject: 'usr-parsa', userId: 'usr-parsa', device: 'mobile', os: 'android', mode: 'browser', theme: 'dark', width: 390, hour: 12, dow: 6, dur: 430, pages: 4, maxScroll: 50, cooks: false, usesFridge: false, skipsMarket: true},
      {subject: 'usr-mahsa', userId: 'usr-mahsa', device: 'mobile', os: 'android', mode: 'pwa', theme: 'light', width: 384, hour: 17, dow: 0, dur: 780, pages: 6, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'guest-tehran-1', userId: null, device: 'mobile', os: 'ios', mode: 'browser', theme: 'light', width: 390, hour: 19, dow: 3, dur: 360, pages: 4, maxScroll: 75, cooks: false, usesFridge: false, skipsMarket: true},
      {subject: 'guest-tehran-2', userId: null, device: 'mobile', os: 'android', mode: 'pwa', theme: 'dark', width: 412, hour: 11, dow: 4, dur: 1260, pages: 10, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'guest-tehran-2', userId: null, device: 'mobile', os: 'android', mode: 'pwa', theme: 'dark', width: 412, hour: 20, dow: 5, dur: 890, pages: 7, maxScroll: 75, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'guest-shiraz-3', userId: null, device: 'desktop', os: 'windows', mode: 'browser', theme: 'light', width: 1440, hour: 13, dow: 1, dur: 490, pages: 5, maxScroll: 75, cooks: false, usesFridge: true, skipsMarket: true},
      {subject: 'guest-rasht-4', userId: null, device: 'mobile', os: 'android', mode: 'browser', theme: 'light', width: 360, hour: 22, dow: 5, dur: 290, pages: 3, maxScroll: 50, cooks: false, usesFridge: false, skipsMarket: true},
      {subject: 'guest-isfahan-5', userId: null, device: 'mobile', os: 'ios', mode: 'browser', theme: 'light', width: 390, hour: 15, dow: 6, dur: 210, pages: 3, maxScroll: 25, cooks: false, usesFridge: false, skipsMarket: true},
      {subject: 'usr-sara', userId: 'usr-sara', device: 'mobile', os: 'ios', mode: 'pwa', theme: 'light', width: 393, hour: 18, dow: 5, dur: 1050, pages: 8, maxScroll: 100, cooks: true, usesFridge: true, skipsMarket: false},
      {subject: 'usr-reza', userId: 'usr-reza', device: 'tablet', os: 'android', mode: 'pwa', theme: 'dark', width: 800, hour: 12, dow: 4, dur: 740, pages: 6, maxScroll: 75, cooks: true, usesFridge: true, skipsMarket: false},
    ];

    seedSessionConfigs.forEach((sc, idx) => {
      const sid = `bsess-seed-${idx + 1}`;
      const startTs = new Date(Date.now() - (idx + 1) * 3600_000 * 5).toISOString();
      const endTs = new Date(Date.now() - (idx + 1) * 3600_000 * 5 + sc.dur * 1000).toISOString();
      insertSess.run(
        sid,
        sc.subject,
        sc.userId,
        sc.device,
        sc.os,
        sc.mode,
        sc.theme,
        sc.width,
        startTs,
        endTs,
        sc.dur,
        sc.hour,
        sc.dow,
        sc.pages
      );

      // Scroll depth milestones
      for (const depth of [25, 50, 75, 100]) {
        if (depth <= sc.maxScroll) {
          insertEv.run(
            `bev-scr-${idx}-${depth}`,
            sid,
            sc.subject,
            sc.userId,
            'scroll_depth',
            'explore',
            'section',
            'explore',
            'صفحه کاوش و فید دستورپخت‌ها',
            '',
            depth,
            '{}',
            endTs
          );
        }
      }

      // Passive recipe views (without requiring likes/bookmarks)
      if (recipesList.length > 0) {
        const rec1 = recipesList[idx % recipesList.length];
        const rec2 = recipesList[(idx + 2) % recipesList.length];
        insertEv.run(
          `bev-rv1-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'recipe_view',
          'recipe_detail',
          'recipe',
          rec1.id,
          rec1.title,
          rec1.category,
          Math.round(sc.dur * 0.42),
          '{}',
          endTs
        );
        insertEv.run(
          `bev-rv2-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'recipe_view',
          'recipe_detail',
          'recipe',
          rec2.id,
          rec2.title,
          rec2.category,
          Math.round(sc.dur * 0.25),
          '{}',
          endTs
        );
        if (sc.cooks) {
          insertEv.run(
            `bev-ck-${idx}`,
            sid,
            sc.subject,
            sc.userId,
            'recipe_cook_start',
            'cooking_mode',
            'recipe',
            rec1.id,
            rec1.title,
            rec1.category,
            Math.round(sc.dur * 0.35),
            '{}',
            endTs
          );
          if (idx % 2 === 0) {
            insertEv.run(
              `bev-ckc-${idx}`,
              sid,
              sc.subject,
              sc.userId,
              'recipe_cook_complete',
              'cooking_mode',
              'recipe',
              rec1.id,
              rec1.title,
              rec1.category,
              1,
              '{}',
              endTs
            );
          }
        }
      }

      // Passive partner & venue views
      if (partnersList.length > 0) {
        const prt = partnersList[idx % partnersList.length];
        insertEv.run(
          `bev-pv-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'partner_view',
          'marketplace',
          'partner',
          prt.id,
          prt.name,
          'برند همکار',
          sc.skipsMarket ? 4 : 38,
          '{}',
          endTs
        );
        if (sc.skipsMarket) {
          insertEv.run(
            `bev-skp-${idx}`,
            sid,
            sc.subject,
            sc.userId,
            'section_skip',
            'marketplace',
            'section',
            'marketplace',
            'ویترین برندهای همکار',
            '',
            4,
            '{}',
            endTs
          );
        }
      }

      if (venuesList.length > 0 && idx % 2 === 0) {
        const v = venuesList[idx % venuesList.length];
        insertEv.run(
          `bev-vv-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'venue_view',
          'nearby_venues',
          'venue',
          v.id,
          v.name,
          v.venue_type,
          29,
          '{}',
          endTs
        );
      }

      if (chefsList.length > 0 && idx % 3 === 0) {
        const ch = chefsList[idx % chefsList.length];
        insertEv.run(
          `bev-cv-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'chef_view',
          'recipe_detail',
          'chef',
          ch.id,
          ch.name,
          'سرآشپز',
          22,
          '{}',
          endTs
        );
      }

      if (sc.usesFridge) {
        insertEv.run(
          `bev-fr-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'fridge_search',
          'kitchen',
          'tab',
          'kitchen',
          'آشپزخانه هوشمند',
          'یخچال هوشمند',
          65,
          '{}',
          endTs
        );
        insertEv.run(
          `bev-sh-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'shopping_add',
          'shopping',
          'tab',
          'shopping',
          'لیست خرید هوشمند',
          'لیست خرید',
          42,
          '{}',
          endTs
        );
      }

      // Diet-safe ad blocks logged for vegan/vegetarian/dairy-free profiles
      if (['usr-reza', 'usr-niloofar', 'usr-parsa', 'guest-tehran-1', 'usr-sara'].includes(sc.subject)) {
        insertEv.run(
          `bev-blk-${idx}`,
          sid,
          sc.subject,
          sc.userId,
          'ad_diet_blocked',
          'explore',
          'ad',
          `blocked-${idx}`,
          'تبلیغ ناسازگار با رژیم کاربر',
          'حفاظت رژیمی',
          3,
          '{}',
          endTs
        );
      }
    });

    // Seed one executive-approved anonymized demand insight published to Smart Auctions
    db.prepare(`
      INSERT OR IGNORE INTO executive_insight_reports (
        id, title, audience_scope, approved_by, summary_json, published_to_auctions, created_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
      'exrep-seed-q4',
      'گزارش تقاضا و نقاط توجه مخاطبان لاقلی (ویژه مزایده‌های فصل)',
      'special_auctions',
      'مدیر ارشد سیستم',
      JSON.stringify({
        totalSessionsAnalyzed: seedSessionConfigs.length,
        mobileSharePercent: 72,
        peakHourRange: '۱۸:۰۰ تا ۲۱:۰۰ (اوج برنامه‌ریزی شام)',
        avgDwellSeconds: 745,
        longestSessionMinutes: 25,
        scroll75ReachPercent: 78,
        topCategories: [
          {label: 'خورش‌های اصیل و ناهار', sharePercent: 38},
          {label: 'پلو و ته‌چین مجلسی', sharePercent: 26},
          {label: 'وگان و گیاهی', sharePercent: 21},
          {label: 'پیش‌غذا و نوشیدنی', sharePercent: 15},
        ],
        dietaryRestrictionSharePercent: 60,
        bestAttentionSlot: 'سربرگ و بخش مواد اولیه دستورپخت (مکث میانگین ۵ دقیقه)',
        recommendedAdFormat: 'بنر تحریریه‌ای سربرگ + یادداشت متنی درون مواد اولیه',
      }),
      now
    );
  }

  // Idempotent seed for Observer click-interval and per-recipe scroll depth samples
  const clickIntervalCount = (
    db.prepare("SELECT COUNT(*) as c FROM behavior_events WHERE event_type = 'click_interval'").get() as {
      c: number;
    }
  ).c;

  if (clickIntervalCount === 0) {
    const recipesList = db
      .prepare("SELECT id, title, category FROM recipes WHERE status = 'published' LIMIT 8")
      .all() as {id: string; title: string; category: string}[];
    const existingSessions = db
      .prepare('SELECT id, subject_key, user_id, last_seen_at FROM behavior_sessions LIMIT 18')
      .all() as {id: string; subject_key: string; user_id: string | null; last_seen_at: string}[];

    const insertEv = db.prepare(`
      INSERT OR IGNORE INTO behavior_events (
        id, session_id, subject_key, user_id, event_type, section_name, target_type,
        target_id, target_label, category, numeric_value, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)
    `);

    const clickIntervalSamplesMs = [
      2200, 4800, 6400, 8900, 14200, 3400, 18500, 7100, 36000, 5200, 11800, 2700, 22500, 6300, 9400, 41000,
      5800, 13400,
    ];
    const scrollSamples = [100, 75, 100, 75, 100, 75, 50, 75, 100, 50, 75, 100, 75, 50, 25, 100, 75, 100];

    existingSessions.forEach((sess, idx) => {
      if (recipesList.length === 0) return;
      const rec = recipesList[idx % recipesList.length];
      insertEv.run(
        `bev-ci-seed-${idx}`,
        sess.id,
        sess.subject_key,
        sess.user_id,
        'click_interval',
        'recipe_detail',
        'recipe',
        rec.id,
        rec.title,
        rec.category,
        clickIntervalSamplesMs[idx % clickIntervalSamplesMs.length],
        sess.last_seen_at
      );
      insertEv.run(
        `bev-rscr-seed-${idx}`,
        sess.id,
        sess.subject_key,
        sess.user_id,
        'scroll_depth',
        'recipe_detail',
        'recipe',
        rec.id,
        rec.title,
        rec.category,
        scrollSamples[idx % scrollSamples.length],
        sess.last_seen_at
      );
    });
  }
}
