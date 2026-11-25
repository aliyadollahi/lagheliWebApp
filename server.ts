import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {createServer as createViteServer} from 'vite';
import {z} from 'zod';
import {
  DEFAULT_ECOSYSTEM_CONFIG,
  GEM_STORE_OFFERS,
  db,
  getEcosystemConfig,
  initDatabase,
} from './src/server/db.ts';
import {
  registerAdminAndMediaRoutes,
  saveUploadedRecipeImage,
} from './src/server/adminAndMediaRoutes.ts';
import {
  getDeliveryPricingConfig,
  getGemStoreOffers,
  getKitchenConfig,
  registerAdminExtrasRoutes,
} from './src/server/adminExtrasRoutes.ts';
import {
  PANTRY_STAPLES,
  PARTNER_ROLES,
  canonicalizeIngredient,
  classifyIngredientCategory,
  computeUserLevel,
  estimateRecipeCost,
  findNativeSubstitutions,
  normalizePersian,
  toEnDigits,
  validateIranMobile,
} from './src/shared/persianEngine.ts';
import type {
  BadgeItem,
  ChefSummary,
  EcosystemConfig,
  Partner,
  PartnerRoleId,
  Recipe,
  ShoppingItem,
  UserProfile,
} from './src/shared/types.ts';

initDatabase();

const app = express();
app.use(express.json({limit: '5mb'}));

// Simple in-memory rate limiter for auth / mutations
const rateLimitMap = new Map<string, {count: number; resetAt: number}>();
function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, {count: 1, resetAt: now + windowMs});
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function isSafeUrl(url: string | undefined): boolean {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/uploads/recipe-photos/')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

interface SessionContext {
  userId: string;
  isAdmin: boolean;
}

function getSession(req: express.Request): SessionContext | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const row = db
    .prepare('SELECT user_id, is_admin, expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token)) as {user_id: string; is_admin: number; expires_at: number} | undefined;
  if (!row || row.expires_at < Date.now()) {
    return null;
  }
  return {userId: row.user_id, isAdmin: row.is_admin === 1};
}

function createSession(userId: string, isAdmin = false): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 days
  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, is_admin, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(hashToken(token), userId, isAdmin ? 1 : 0, expiresAt, new Date().toISOString());
  return token;
}

function buildUserProfile(userId: string): UserProfile | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const followers = (
    db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(userId) as {c: number}
  ).c;
  const following = (
    db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(userId) as {c: number}
  ).c;
  const xp = Number(row.xp);
  const level = computeUserLevel(xp);
  return {
    id: String(row.id),
    phone: String(row.phone),
    name: String(row.name),
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    bio: String(row.bio),
    specialty: String(row.specialty),
    isVerifiedChef: Number(row.is_verified_chef) === 1,
    chefVerificationStatus: row.chef_verification_status as UserProfile['chefVerificationStatus'],
    role: row.role as UserProfile['role'],
    xp,
    levelName: level.levelName,
    nextLevelXp: level.nextLevelXp,
    gems: Number(row.gems),
    walletBalance: Number(row.wallet_balance || 0),
    isSuspended: Number(row.is_suspended || 0) === 1,
    followersCount: followers,
    followingCount: following,
  };
}

function awardXpAndGems(userId: string, xpDelta: number, gemDelta: number, reason: string): void {
  db.prepare('UPDATE users SET xp = xp + ?, gems = gems + ? WHERE id = ?').run(xpDelta, gemDelta, userId);
  if (gemDelta !== 0) {
    db.prepare('INSERT INTO gem_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(
      `tx-${crypto.randomUUID().slice(0, 8)}`,
      userId,
      gemDelta,
      reason,
      new Date().toISOString()
    );
  }
}

function mapRecipeRow(row: Record<string, unknown>, viewerId?: string): Recipe {
  const author = db.prepare('SELECT name, is_verified_chef FROM users WHERE id = ?').get(String(row.author_id)) as
    | {name: string; is_verified_chef: number}
    | undefined;
  const isBookmarked = viewerId
    ? Boolean(
        db.prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND recipe_id = ?').get(viewerId, String(row.id))
      )
    : false;
  const isUnlocked =
    Number(row.is_vip) === 0 ||
    (viewerId
      ? Boolean(
          db
            .prepare('SELECT 1 FROM unlocked_recipes WHERE user_id = ? AND recipe_id = ?')
            .get(viewerId, String(row.id))
        )
      : false);

  const parsedIngredients = JSON.parse(String(row.ingredients_json || '[]'));
  const servings = Number(row.servings) || 4;

  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    subtitle: String(row.subtitle),
    description: String(row.description),
    imageUrl: String(row.image_url),
    category: String(row.category),
    region: String(row.region),
    season: String(row.season),
    mealType: String(row.meal_type),
    dietTags: JSON.parse(String(row.diet_tags_json || '[]')),
    prepMinutes: Number(row.prep_minutes),
    cookMinutes: Number(row.cook_minutes),
    servings,
    difficulty: row.difficulty as Recipe['difficulty'],
    nutrition: JSON.parse(String(row.nutrition_json)),
    isVip: Number(row.is_vip) === 1,
    vipGemCost: Number(row.vip_gem_cost),
    isUnlocked,
    parentRecipeId: row.parent_recipe_id ? String(row.parent_recipe_id) : null,
    variationNote: row.variation_note ? String(row.variation_note) : null,
    authorId: String(row.author_id),
    authorName: author?.name || 'آشپز لاقلی',
    authorVerified: author?.is_verified_chef === 1,
    status: row.status as Recipe['status'],
    ingredients: parsedIngredients,
    steps: JSON.parse(String(row.steps_json || '[]')),
    tools: JSON.parse(String(row.tools_json || '[]')),
    linkedMenuDishId: row.linked_menu_dish_id ? String(row.linked_menu_dish_id) : null,
    createdAt: String(row.created_at),
    isBookmarked,
    photoCreditName: row.photo_credit_name ? String(row.photo_credit_name) : null,
    communityPhotosCount: (
      db
        .prepare("SELECT COUNT(*) as c FROM recipe_photos WHERE recipe_id = ? AND status = 'approved'")
        .get(String(row.id)) as {c: number}
    ).c,
    estimatedCost: estimateRecipeCost(parsedIngredients, servings),
  };
}

function mapPartnerRow(row: Record<string, unknown>, viewerId?: string): Partner {
  const followersCount = (
    db.prepare('SELECT COUNT(*) as c FROM partner_follows WHERE partner_id = ?').get(String(row.id)) as {c: number}
  ).c;
  const isFollowing = viewerId
    ? Boolean(
        db
          .prepare('SELECT 1 FROM partner_follows WHERE user_id = ? AND partner_id = ?')
          .get(viewerId, String(row.id))
      )
    : false;
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    roleType: row.role_type as PartnerRoleId,
    city: String(row.city),
    neighborhood: String(row.neighborhood),
    description: String(row.description),
    address: String(row.address),
    phone: String(row.phone),
    website: row.website ? String(row.website) : undefined,
    verified: Number(row.verified) === 1,
    claimStatus: row.claim_status as Partner['claimStatus'],
    tier: row.tier as Partner['tier'],
    businessBalance: Number(row.business_balance || 0),
    promoCode: row.promo_code ? String(row.promo_code) : undefined,
    promoLabel: row.promo_label ? String(row.promo_label) : undefined,
    affiliateCode: row.affiliate_code ? String(row.affiliate_code) : undefined,
    relatedIngredients: JSON.parse(String(row.related_ingredients_json || '[]')),
    relatedTools: JSON.parse(String(row.related_tools_json || '[]')),
    catalog: JSON.parse(String(row.catalog_json || '[]')),
    status: row.status as Partner['status'],
    followersCount,
    isFollowing,
    createdAt: String(row.created_at),
  };
}

function isTestQuickLoginEnabled(): boolean {
  if (process.env.DISABLE_QUICK_TEST_AUTH === 'true') return false;
  if (process.env.NODE_ENV === 'production' && isEnvAdminPasscodeSet()) return false;
  return true;
}

// =========================================================================
// 1. PUBLIC CONFIG & HEALTH
// =========================================================================
app.get('/api/config', (_req, res) => {
  res.json({
    ecosystem: getEcosystemConfig(),
    partnerRoles: PARTNER_ROLES,
    gemStoreOffers: getGemStoreOffers(GEM_STORE_OFFERS),
    kitchenConfig: getKitchenConfig(),
    deliveryPricing: getDeliveryPricingConfig(),
    quickTestLoginEnabled: isTestQuickLoginEnabled(),
  });
});

// =========================================================================
// 2. IRAN-READY SMS OTP AUTH & PROFILE
// =========================================================================
const requestOtpSchema = z.object({
  phone: z.string().min(10).max(20),
});

app.post('/api/auth/request-otp', (req, res) => {
  const parsed = requestOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({error: 'لطفاً شماره موبایل معتبر وارد کنید.'});
  }
  const check = validateIranMobile(parsed.data.phone);
  if (!check.valid) {
    return res.status(400).json({error: check.error});
  }
  if (!checkRateLimit(`otp:${check.normalized}`, 6, 1000 * 60 * 5)) {
    return res.status(429).json({error: 'تعداد درخواست کد زیاد است؛ لطفاً چند دقیقه بعد تلاش کنید.'});
  }

  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = Date.now() + 1000 * 60 * 5;
  db.prepare('INSERT OR REPLACE INTO otp_codes (phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)').run(
    check.normalized,
    hashPassword(code),
    expiresAt
  );

  // Adapter hook: When SMS_PROVIDER is configured (kavenegar/melipayamak) & SMS_API_KEY exists, send SMS here.
  const isDevSms = !process.env.SMS_API_KEY || (process.env.SMS_PROVIDER || 'dev') === 'dev';
  res.json({
    ok: true,
    phone: check.normalized,
    message: isDevSms
      ? 'کد تایید آزمایشی (حالت توسعه بدون نیاز به پنل پیامک) صادر شد.'
      : 'کد تایید به شماره موبایل شما پیامک شد.',
    devCode: isDevSms ? code : undefined,
  });
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(20),
  code: z.string().min(4).max(8),
  name: z.string().max(60).optional(),
  city: z.string().max(40).optional(),
  guestBookmarks: z.array(z.string()).max(100).optional(),
  guestShoppingItems: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        amount: z.number().positive(),
        unit: z.string().max(30),
        category: z.string().optional(),
        recipeId: z.string().nullable().optional(),
        recipeTitle: z.string().nullable().optional(),
        checked: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
});

app.post('/api/auth/verify-otp', (req, res) => {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({error: 'اطلاعات ورود کامل نیست.'});
  }
  const check = validateIranMobile(parsed.data.phone);
  if (!check.valid) {
    return res.status(400).json({error: check.error});
  }
  const cleanCode = toEnDigits(parsed.data.code).trim();
  const otpRow = db.prepare('SELECT * FROM otp_codes WHERE phone = ?').get(check.normalized) as
    | {phone: string; code_hash: string; expires_at: number; attempts: number}
    | undefined;

  if (!otpRow || otpRow.expires_at < Date.now()) {
    return res.status(400).json({error: 'کد تایید منقضی شده است؛ لطفاً دوباره درخواست دهید.'});
  }
  if (otpRow.attempts >= 5) {
    return res.status(429).json({error: 'تعداد تلاش‌های ناموفق بیش از حد مجاز است.'});
  }
  if (!verifyPassword(cleanCode, otpRow.code_hash)) {
    db.prepare('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = ?').run(check.normalized);
    return res.status(401).json({error: 'کد تایید واردشده نادرست است.'});
  }

  db.prepare('DELETE FROM otp_codes WHERE phone = ?').run(check.normalized);

  let userRow = db.prepare('SELECT id FROM users WHERE phone = ?').get(check.normalized) as {id: string} | undefined;
  const now = new Date().toISOString();
  if (!userRow) {
    const newId = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const displayName = parsed.data.name?.trim() || `آشپز ${check.normalized.slice(-4)}`;
    db.prepare(
      `INSERT INTO users (id, phone, name, city, neighborhood, bio, specialty, is_verified_chef, chef_verification_status, role, xp, gems, created_at)
       VALUES (?, ?, ?, ?, 'مرکز', '', 'آشپزی خانگی', 0, 'none', 'user', 80, 120, ?)`
    ).run(newId, check.normalized, displayName, parsed.data.city?.trim() || 'تهران', now);
    db.prepare('INSERT INTO gem_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(
      `tx-${crypto.randomUUID().slice(0, 8)}`,
      newId,
      120,
      'هدیه خوش‌آمدگویی عضویت در لاقلی',
      now
    );
    userRow = {id: newId};
  }

  // Merge Guest Local-First Bookmarks & Shopping Items seamlessly
  if (parsed.data.guestBookmarks?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, recipe_id, created_at) VALUES (?, ?, ?)');
    for (const rid of parsed.data.guestBookmarks) {
      stmt.run(userRow.id, rid, now);
    }
  }
  if (parsed.data.guestShoppingItems?.length) {
    for (const item of parsed.data.guestShoppingItems) {
      upsertShoppingItem(userRow.id, item);
    }
  }

  const token = createSession(userRow.id, false);
  const profile = buildUserProfile(userRow.id);
  res.json({token, user: profile});
});

// Preview/Test-mode 1-click user login (automatically disabled when DISABLE_QUICK_TEST_AUTH=true or in production with secrets)
const quickTestUserSchema = z.object({
  guestBookmarks: z.array(z.string()).max(100).optional(),
  guestShoppingItems: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        amount: z.number().positive(),
        unit: z.string().max(30),
        category: z.string().optional(),
        recipeId: z.string().nullable().optional(),
        recipeTitle: z.string().nullable().optional(),
        checked: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
});

app.post('/api/auth/quick-test-login', (req, res) => {
  if (!isTestQuickLoginEnabled()) {
    return res.status(403).json({error: 'ورود سریع آزمایشی در این محیط غیرفعال است.'});
  }
  if (!checkRateLimit(`quick-user:${req.ip}`, 20, 1000 * 60 * 5)) {
    return res.status(429).json({error: 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید.'});
  }
  const parsed = quickTestUserSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({error: 'داده‌های همگام‌سازی نامعتبر است.'});
  }

  const testPhone = '09120000001';
  const now = new Date().toISOString();
  let userRow = db.prepare('SELECT id FROM users WHERE phone = ?').get(testPhone) as {id: string} | undefined;
  if (!userRow) {
    const newId = 'usr-test-preview';
    db.prepare(
      `INSERT OR IGNORE INTO users (id, phone, name, city, neighborhood, bio, specialty, is_verified_chef, chef_verification_status, role, xp, gems, wallet_balance, created_at)
       VALUES (?, ?, 'کاربر آزمایشی لاقلی', 'تهران', 'ونک', 'حساب آزمایشی برای بررسی سریع امکانات لاقلی', 'آشپزی ایرانی', 1, 'approved', 'chef', 420, 350, 500000, ?)`
    ).run(newId, testPhone, now);
    userRow = (db.prepare('SELECT id FROM users WHERE phone = ?').get(testPhone) as {id: string}) || {id: newId};
  }

  if (parsed.data.guestBookmarks?.length) {
    const stmt = db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, recipe_id, created_at) VALUES (?, ?, ?)');
    for (const rid of parsed.data.guestBookmarks) {
      stmt.run(userRow.id, rid, now);
    }
  }
  if (parsed.data.guestShoppingItems?.length) {
    for (const item of parsed.data.guestShoppingItems) {
      upsertShoppingItem(userRow.id, item);
    }
  }

  const token = createSession(userRow.id, false);
  const profile = buildUserProfile(userRow.id);
  res.json({token, user: profile, testMode: true});
});

app.get('/api/auth/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'احراز هویت انجام نشده است.'});
  const profile = buildUserProfile(session.userId);
  if (!profile) return res.status(404).json({error: 'کاربر یافت نشد.'});
  res.json({user: profile});
});

app.post('/api/auth/logout', (req, res) => {
  const token = getBearerToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  res.json({ok: true});
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  city: z.string().min(2).max(40).optional(),
  neighborhood: z.string().max(60).optional(),
  bio: z.string().max(300).optional(),
  specialty: z.string().max(80).optional(),
});

app.patch('/api/profile', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای ویرایش پروفایل وارد شوید.'});
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'اطلاعات واردشده معتبر نیست.'});

  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(session.userId) as Record<string, unknown>;
  if (!existing) return res.status(404).json({error: 'کاربر یافت نشد.'});

  db.prepare(
    'UPDATE users SET name = ?, city = ?, neighborhood = ?, bio = ?, specialty = ? WHERE id = ?'
  ).run(
    parsed.data.name ?? existing.name,
    parsed.data.city ?? existing.city,
    parsed.data.neighborhood ?? existing.neighborhood,
    parsed.data.bio ?? existing.bio,
    parsed.data.specialty ?? existing.specialty,
    session.userId
  );
  res.json({user: buildUserProfile(session.userId)});
});

app.post('/api/profile/verify-chef', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد حساب کاربری شوید.'});
  const schema = z.object({bio: z.string().min(10).max(300), specialty: z.string().min(3).max(80)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'لطفاً بیوگرافی و تخصص خود را کامل وارد کنید.'});

  db.prepare(
    "UPDATE users SET bio = ?, specialty = ?, chef_verification_status = 'pending' WHERE id = ?"
  ).run(parsed.data.bio, parsed.data.specialty, session.userId);
  res.json({user: buildUserProfile(session.userId), message: 'درخواست نشان سرآشپز تاییدشده ثبت شد.'});
});

// =========================================================================
// 3. RECIPES, FACETED SEARCH, BOOKMARKS, VARIATIONS, VIP & Q&A
// =========================================================================
app.get('/api/recipes', (req, res) => {
  const session = getSession(req);
  const q = typeof req.query.q === 'string' ? normalizePersian(req.query.q) : '';
  const categories = typeof req.query.categories === 'string' && req.query.categories ? req.query.categories.split(',') : [];
  const seasons = typeof req.query.seasons === 'string' && req.query.seasons ? req.query.seasons.split(',') : [];
  const regions = typeof req.query.regions === 'string' && req.query.regions ? req.query.regions.split(',') : [];
  const diets = typeof req.query.diets === 'string' && req.query.diets ? req.query.diets.split(',') : [];
  const verifiedOnly = req.query.verifiedOnly === 'true';
  const followedOnly = req.query.followedOnly === 'true';
  const bookmarkedOnly = req.query.bookmarkedOnly === 'true';
  const includePending = req.query.includePending === 'true' && session?.isAdmin;

  const rows = (
    includePending
      ? db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all()
      : db.prepare("SELECT * FROM recipes WHERE status = 'published' ORDER BY created_at DESC").all()
  ) as Record<string, unknown>[];

  const followedIds =
    followedOnly && session
      ? new Set(
          (
            db.prepare('SELECT following_id FROM follows WHERE follower_id = ?').all(session.userId) as {
              following_id: string;
            }[]
          ).map((r) => r.following_id)
        )
      : null;

  let recipes = rows.map((r) => mapRecipeRow(r, session?.userId));

  recipes = recipes.filter((rec) => {
    // Only show top-level recipes in main feed unless searching or filtering variations
    if (rec.parentRecipeId && !q && categories.length === 0) return false;
    if (q) {
      const hay = normalizePersian(
        [
          rec.title,
          rec.subtitle,
          rec.description,
          rec.region,
          rec.authorName,
          ...rec.ingredients.map((i) => i.name),
        ].join(' ')
      );
      if (!hay.includes(q)) return false;
    }
    // OR within group, AND across groups
    if (categories.length > 0) {
      const matchCat = categories.some((c) => {
        if (c === 'پخت سریع') return rec.prepMinutes + rec.cookMinutes <= 45 || rec.category === 'پخت سریع';
        if (c === 'وگان و گیاهی') return rec.dietTags.includes('گیاهی') || rec.category === 'وگان و گیاهی';
        if (c === 'رژیمی و سبک') return rec.dietTags.includes('رژیمی') || rec.nutrition.calories <= 400;
        if (c === 'پرپروتئین') return rec.dietTags.includes('پرپروتئین') || rec.nutrition.protein >= 30;
        if (c === 'غذای شمالی') return rec.region === 'گیلان' || rec.region === 'مازندران';
        return rec.category === c;
      });
      if (!matchCat) return false;
    }
    if (seasons.length > 0 && !seasons.includes(rec.season)) return false;
    if (regions.length > 0 && !regions.includes(rec.region)) return false;
    if (diets.length > 0 && !diets.some((d) => rec.dietTags.includes(d))) return false;
    if (verifiedOnly && !rec.authorVerified) return false;
    if (followedIds && !followedIds.has(rec.authorId)) return false;
    if (bookmarkedOnly && !rec.isBookmarked) return false;
    return true;
  });

  res.json({recipes});
});

app.get('/api/recipes/:id', (req, res) => {
  const session = getSession(req);
  const row = db.prepare('SELECT * FROM recipes WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!row) return res.status(404).json({error: 'دستور پخت یافت نشد.'});
  const recipe = mapRecipeRow(row, session?.userId);

  const variationRows = db
    .prepare("SELECT * FROM recipes WHERE parent_recipe_id = ? AND status = 'published'")
    .all(recipe.id) as Record<string, unknown>[];
  const variations = variationRows.map((v) => mapRecipeRow(v, session?.userId));

  // Questions & Answers
  const qRows = db
    .prepare('SELECT * FROM recipe_questions WHERE recipe_id = ? ORDER BY created_at DESC')
    .all(recipe.id) as Record<string, unknown>[];
  const questions = qRows.map((q) => {
    const aRows = db
      .prepare('SELECT * FROM recipe_answers WHERE question_id = ? ORDER BY is_best DESC, upvotes DESC')
      .all(String(q.id)) as Record<string, unknown>[];
    return {
      id: String(q.id),
      recipeId: String(q.recipe_id),
      authorId: String(q.author_id),
      authorName: String(q.author_name),
      body: String(q.body),
      solved: Number(q.solved) === 1,
      createdAt: String(q.created_at),
      answers: aRows.map((a) => ({
        id: String(a.id),
        questionId: String(a.question_id),
        authorId: String(a.author_id),
        authorName: String(a.author_name),
        authorVerified: Number(a.author_verified) === 1,
        body: String(a.body),
        upvotes: Number(a.upvotes),
        isBest: Number(a.is_best) === 1,
        createdAt: String(a.created_at),
      })),
    };
  });

  // Contextual Partners governed strictly by Admin Config & maxPartnerCardsPerRecipe
  const config = getEcosystemConfig();
  let contextualPartners: Partner[] = [];
  if (config.recipeContextEnabled && config.maxPartnerCardsPerRecipe > 0) {
    const userCity = typeof req.query.city === 'string' ? req.query.city : 'تهران';
    const allPartners = (
      db.prepare("SELECT * FROM partners WHERE status = 'approved'").all() as Record<string, unknown>[]
    )
      .map((p) => mapPartnerRow(p, session?.userId))
      .filter((p) => config.enabledPartnerRoles.includes(p.roleType));

    const recipeIngNorms = recipe.ingredients.map((i) => normalizePersian(i.name));
    const recipeToolNorms = recipe.tools.map((t) => normalizePersian(t));

    const scored = allPartners
      .map((p) => {
        let score = 0;
        if (p.relatedIngredients.some((ing) => recipeIngNorms.some((ri) => ri.includes(normalizePersian(ing))))) {
          score += 3;
        }
        if (p.relatedTools.some((tool) => recipeToolNorms.some((rt) => rt.includes(normalizePersian(tool))))) {
          score += 3;
        }
        if (p.city === userCity) score += 2;
        if (p.tier === 'sponsor') score += 2;
        else if (p.tier === 'featured') score += 1;
        return {partner: p, score};
      })
      .filter((item) => item.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, config.maxPartnerCardsPerRecipe)
      .map((item) => item.partner);

    contextualPartners = scored;
  }

  const communityPhotos = (
    db
      .prepare(
        `SELECT * FROM recipe_photos WHERE recipe_id = ? AND status = 'approved' ORDER BY is_cover DESC, created_at DESC`
      )
      .all(recipe.id) as Record<string, unknown>[]
  ).map((p) => ({
    id: String(p.id),
    recipeId: String(p.recipe_id),
    userId: String(p.user_id),
    userName: String(p.user_name),
    imageUrl: String(p.image_url),
    caption: String(p.caption || ''),
    status: p.status as 'approved',
    isCover: Number(p.is_cover) === 1,
    createdAt: String(p.created_at),
  }));

  res.json({recipe, variations, questions, contextualPartners, communityPhotos});
});

const createRecipeSchema = z.object({
  title: z.string().min(3).max(120),
  subtitle: z.string().min(3).max(180),
  description: z.string().min(10).max(1000),
  imageUrl: z.string().optional(),
  imageDataUrl: z.string().optional(),
  category: z.string().min(2).max(50),
  region: z.string().min(2).max(50),
  season: z.string().min(2).max(30),
  mealType: z.string().min(2).max(30),
  dietTags: z.array(z.string()).max(8),
  prepMinutes: z.number().int().min(1).max(600),
  cookMinutes: z.number().int().min(1).max(600),
  servings: z.number().int().min(1).max(30),
  difficulty: z.enum(['آسان', 'متوسط', 'حرفه‌ای']),
  parentRecipeId: z.string().nullable().optional(),
  variationNote: z.string().max(300).nullable().optional(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        amount: z.number().positive(),
        unit: z.string().min(1).max(30),
      })
    )
    .min(2),
  steps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        instruction: z.string().min(5).max(500),
        timerMinutes: z.number().int().min(1).max(300).optional(),
      })
    )
    .min(1),
  tools: z.array(z.string()).max(10).optional(),
});

app.post('/api/recipes', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای ثبت دستور پخت ابتدا وارد شوید.'});
  const parsed = createRecipeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'لطفاً تمام بخش‌های ضروری دستور پخت را کامل کنید.'});
  if (!isSafeUrl(parsed.data.imageUrl)) return res.status(400).json({error: 'آدرس تصویر معتبر نیست.'});

  let finalImg = parsed.data.imageUrl?.trim() || '';
  if (parsed.data.imageDataUrl && parsed.data.imageDataUrl.startsWith('data:image/')) {
    const saved = saveUploadedRecipeImage(parsed.data.imageDataUrl);
    if (!saved.ok) return res.status(400).json({error: saved.error});
    finalImg = saved.url;
  }

  const user = db.prepare('SELECT is_verified_chef FROM users WHERE id = ?').get(session.userId) as
    | {is_verified_chef: number}
    | undefined;
  const id = `rec-${crypto.randomUUID().slice(0, 8)}`;
  const slug = `recipe-${Date.now()}`;
  const status = user?.is_verified_chef === 1 ? 'published' : 'pending';
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO recipes (
      id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
      diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
      is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
      ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`
  ).run(
    id,
    slug,
    parsed.data.title,
    parsed.data.subtitle,
    parsed.data.description,
    finalImg,
    parsed.data.category,
    parsed.data.region,
    parsed.data.season,
    parsed.data.mealType,
    JSON.stringify(parsed.data.dietTags),
    parsed.data.prepMinutes,
    parsed.data.cookMinutes,
    parsed.data.servings,
    parsed.data.difficulty,
    JSON.stringify({calories: 410, protein: 22, carbs: 46, fat: 15, fiber: 5}),
    parsed.data.parentRecipeId || null,
    parsed.data.variationNote || null,
    session.userId,
    status,
    JSON.stringify(parsed.data.ingredients),
    JSON.stringify(parsed.data.steps),
    JSON.stringify(parsed.data.tools || []),
    now
  );

  awardXpAndGems(session.userId, 40, 20, `ثبت دستور پخت «${parsed.data.title}»`);
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Record<string, unknown>;
  res.status(201).json({
    recipe: mapRecipeRow(row, session.userId),
    message:
      status === 'published'
        ? 'دستور پخت شما منتشر شد و ۲۰ جِم پاداش گرفتید.'
        : 'دستور پخت شما ثبت شد و در صف تایید پنل مدیریت قرار گرفت (۲۰ جِم پاداش).',
  });
});

app.post('/api/recipes/:id/bookmark', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای همگام‌سازی نشانک وارد حساب شوید.'});
  const exists = db
    .prepare('SELECT 1 FROM bookmarks WHERE user_id = ? AND recipe_id = ?')
    .get(session.userId, req.params.id);
  if (exists) {
    db.prepare('DELETE FROM bookmarks WHERE user_id = ? AND recipe_id = ?').run(session.userId, req.params.id);
    return res.json({bookmarked: false});
  }
  db.prepare('INSERT INTO bookmarks (user_id, recipe_id, created_at) VALUES (?, ?, ?)').run(
    session.userId,
    req.params.id,
    new Date().toISOString()
  );
  res.json({bookmarked: true});
});

app.post('/api/recipes/:id/unlock-vip', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای بازگشایی دستور ویژه وارد حساب شوید.'});
  const recipe = db.prepare('SELECT id, title, is_vip, vip_gem_cost FROM recipes WHERE id = ?').get(req.params.id) as
    | {id: string; title: string; is_vip: number; vip_gem_cost: number}
    | undefined;
  if (!recipe || recipe.is_vip === 0) return res.status(400).json({error: 'این دستور رایگان است.'});

  const already = db
    .prepare('SELECT 1 FROM unlocked_recipes WHERE user_id = ? AND recipe_id = ?')
    .get(session.userId, recipe.id);
  if (already) return res.json({unlocked: true});

  const user = db.prepare('SELECT gems FROM users WHERE id = ?').get(session.userId) as {gems: number};
  if (user.gems < recipe.vip_gem_cost) {
    return res.status(400).json({error: 'موجودی جِم شما برای بازگشایی این دستور کافی نیست.'});
  }

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO unlocked_recipes (user_id, recipe_id, created_at) VALUES (?, ?, ?)').run(
      session.userId,
      recipe.id,
      new Date().toISOString()
    );
    awardXpAndGems(session.userId, 10, -recipe.vip_gem_cost, `بازگشایی دستور ویژه «${recipe.title}»`);
  });
  tx();

  res.json({unlocked: true, user: buildUserProfile(session.userId)});
});

// Q&A Endpoints
app.post('/api/recipes/:id/questions', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای طرح سوال وارد شوید.'});
  const schema = z.object({body: z.string().min(6).max(400)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'متن سوال باید حداقل ۶ کاراکتر باشد.'});

  const user = db.prepare('SELECT name FROM users WHERE id = ?').get(session.userId) as {name: string};
  const id = `q-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO recipe_questions (id, recipe_id, author_id, author_name, body, solved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)'
  ).run(id, req.params.id, session.userId, user.name, parsed.data.body.trim(), now);

  if (checkRateLimit(`qa-gem:${session.userId}`, 3, 1000 * 60 * 60 * 24)) {
    awardXpAndGems(session.userId, 15, 5, 'طرح سوال مفید در بخش پرسش‌وپاسخ');
  }
  res.status(201).json({
    question: {
      id,
      recipeId: req.params.id,
      authorId: session.userId,
      authorName: user.name,
      body: parsed.data.body.trim(),
      solved: false,
      createdAt: now,
      answers: [],
    },
  });
});

app.post('/api/questions/:id/answers', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای ثبت پاسخ وارد شوید.'});
  const schema = z.object({body: z.string().min(4).max(500)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'متن پاسخ کوتاه است.'});

  const user = db.prepare('SELECT name, is_verified_chef FROM users WHERE id = ?').get(session.userId) as {
    name: string;
    is_verified_chef: number;
  };
  const id = `a-${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO recipe_answers (id, question_id, author_id, author_name, author_verified, body, upvotes, is_best, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)'
  ).run(id, req.params.id, session.userId, user.name, user.is_verified_chef, parsed.data.body.trim(), now);

  if (checkRateLimit(`ans-gem:${session.userId}`, 5, 1000 * 60 * 60 * 24)) {
    awardXpAndGems(session.userId, 20, 10, 'پاسخ‌دهی به سوال جامعه لاقلی');
  }
  res.status(201).json({
    answer: {
      id,
      questionId: req.params.id,
      authorId: session.userId,
      authorName: user.name,
      authorVerified: user.is_verified_chef === 1,
      body: parsed.data.body.trim(),
      upvotes: 0,
      isBest: false,
      createdAt: now,
    },
  });
});

app.post('/api/answers/:id/upvote', (req, res) => {
  db.prepare('UPDATE recipe_answers SET upvotes = upvotes + 1 WHERE id = ?').run(req.params.id);
  const row = db.prepare('SELECT upvotes FROM recipe_answers WHERE id = ?').get(req.params.id) as
    | {upvotes: number}
    | undefined;
  res.json({upvotes: row?.upvotes ?? 0});
});

app.post('/api/answers/:id/best', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد حساب شوید.'});
  const ans = db
    .prepare('SELECT id, question_id, author_id, is_best FROM recipe_answers WHERE id = ?')
    .get(req.params.id) as {id: string; question_id: string; author_id: string; is_best: number} | undefined;
  if (!ans) return res.status(404).json({error: 'پاسخ یافت نشد.'});

  const q = db.prepare('SELECT author_id FROM recipe_questions WHERE id = ?').get(ans.question_id) as
    | {author_id: string}
    | undefined;
  if (!q || (q.author_id !== session.userId && !session.isAdmin)) {
    return res.status(403).json({error: 'فقط پرسش‌کننده می‌تواند بهترین پاسخ را انتخاب کند.'});
  }
  if (ans.is_best === 0) {
    db.prepare('UPDATE recipe_answers SET is_best = 0 WHERE question_id = ?').run(ans.question_id);
    db.prepare('UPDATE recipe_answers SET is_best = 1 WHERE id = ?').run(ans.id);
    db.prepare('UPDATE recipe_questions SET solved = 1 WHERE id = ?').run(ans.question_id);
    awardXpAndGems(ans.author_id, 50, 25, 'انتخاب به عنوان بهترین پاسخ توسط جامعه لاقلی');
  }
  res.json({ok: true});
});

// =========================================================================
// 4. SMART KITCHEN: FRIDGE MATCH & NATIVE PERSIAN SUBSTITUTIONS (ZERO EXTERNAL API LOCK-IN)
// =========================================================================
app.post('/api/kitchen/fridge-match', (req, res) => {
  const schema = z.object({
    ingredients: z.array(z.string()).max(40),
    exactOnly: z.boolean().optional(),
    includePantryStaples: z.boolean().optional(),
    category: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'فهرست مواد معتبر نیست.'});

  const availablePool = [
    ...parsed.data.ingredients,
    ...(parsed.data.includePantryStaples !== false ? PANTRY_STAPLES : []),
  ].map((item) => normalizePersian(canonicalizeIngredient(item)));

  const rows = db.prepare("SELECT * FROM recipes WHERE status = 'published'").all() as Record<string, unknown>[];
  const session = getSession(req);

  const matches = rows
    .map((r) => mapRecipeRow(r, session?.userId))
    .filter((rec) => !parsed.data.category || parsed.data.category === 'همه' || rec.category === parsed.data.category)
    .map((rec) => {
      const required = rec.ingredients.filter((i) => !i.optional);
      const matched: string[] = [];
      const missing: typeof required = [];

      for (const ing of required) {
        const canonNorm = normalizePersian(canonicalizeIngredient(ing.name));
        const rawNorm = normalizePersian(ing.name);
        const found = availablePool.some(
          (av) => av && (av.includes(canonNorm) || canonNorm.includes(av) || av.includes(rawNorm) || rawNorm.includes(av))
        );
        if (found) matched.push(ing.name);
        else missing.push(ing);
      }
      const matchPercent = required.length > 0 ? Math.round((matched.length / required.length) * 100) : 0;
      return {recipe: rec, matchPercent, matchedIngredients: matched, missingIngredients: missing};
    })
    .filter((m) => (parsed.data.exactOnly ? m.missingIngredients.length === 0 : m.matchPercent > 0))
    .sort((a, b) => b.matchPercent - a.matchPercent);

  res.json({matches});
});

app.get('/api/kitchen/substitutions', (req, res) => {
  const ingredient = typeof req.query.ingredient === 'string' ? req.query.ingredient.trim() : '';
  if (!ingredient) return res.json({ingredient: '', suggestions: []});
  const normQuery = normalizePersian(ingredient);
  const customRules = getKitchenConfig()
    .customSubstitutions.filter((rule) => {
      const normRule = normalizePersian(rule.ingredient);
      return normRule.includes(normQuery) || normQuery.includes(normRule);
    })
    .map((rule) => ({
      substitute: rule.substitute,
      ratio: rule.ratio,
      compatibility: rule.compatibility,
      flavorNote: rule.flavorNote,
      isVegan: rule.isVegan,
      source: 'native' as const,
    }));
  const nativeSuggestions = findNativeSubstitutions(ingredient, 'native');
  res.json({ingredient, suggestions: [...customRules, ...nativeSuggestions]});
});

// =========================================================================
// 5. SMART CATEGORIZED SHOPPING LIST (DEDUPLICATION + 11 CATEGORIES)
// =========================================================================
function upsertShoppingItem(
  userId: string,
  input: {
    name: string;
    amount: number;
    unit: string;
    category?: string;
    recipeId?: string | null;
    recipeTitle?: string | null;
    checked?: boolean;
  }
): void {
  const canonical = canonicalizeIngredient(input.name);
  const category = input.category || classifyIngredientCategory(input.name);
  const normCanon = normalizePersian(canonical);
  const normUnit = normalizePersian(input.unit || 'عدد');

  // Smart consolidation if same canonical ingredient + same unit exists unchecked
  const existing = db
    .prepare('SELECT id, amount, canonical_name, unit FROM shopping_items WHERE user_id = ? AND checked = 0')
    .all(userId) as {id: string; amount: number; canonical_name: string; unit: string}[];

  const match = existing.find(
    (row) => normalizePersian(row.canonical_name) === normCanon && normalizePersian(row.unit) === normUnit
  );

  if (match) {
    db.prepare('UPDATE shopping_items SET amount = ? WHERE id = ?').run(
      Math.round((match.amount + input.amount) * 100) / 100,
      match.id
    );
    return;
  }

  db.prepare(
    `INSERT INTO shopping_items (id, user_id, name, canonical_name, amount, unit, category, recipe_id, recipe_title, checked, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `shp-${crypto.randomUUID().slice(0, 8)}`,
    userId,
    input.name.trim(),
    canonical,
    input.amount,
    input.unit.trim() || 'عدد',
    category,
    input.recipeId || null,
    input.recipeTitle || null,
    input.checked ? 1 : 0,
    new Date().toISOString()
  );
}

function getUserShoppingList(userId: string): ShoppingItem[] {
  const rows = db
    .prepare('SELECT * FROM shopping_items WHERE user_id = ? ORDER BY checked ASC, created_at DESC')
    .all(userId) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    canonicalName: String(r.canonical_name),
    amount: Number(r.amount),
    unit: String(r.unit),
    category: r.category as ShoppingItem['category'],
    recipeId: r.recipe_id ? String(r.recipe_id) : null,
    recipeTitle: r.recipe_title ? String(r.recipe_title) : null,
    checked: Number(r.checked) === 1,
    createdAt: String(r.created_at),
  }));
}

app.get('/api/shopping', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد شوید.'});
  res.json({items: getUserShoppingList(session.userId)});
});

app.post('/api/shopping/bulk', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد شوید.'});
  const schema = z.object({
    items: z
      .array(
        z.object({
          name: z.string().min(1).max(100),
          amount: z.number().positive(),
          unit: z.string().max(30),
          category: z.string().optional(),
          recipeId: z.string().nullable().optional(),
          recipeTitle: z.string().nullable().optional(),
        })
      )
      .min(1)
      .max(50),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'اقلام لیست خرید معتبر نیستند.'});

  const tx = db.transaction(() => {
    for (const item of parsed.data.items) {
      upsertShoppingItem(session.userId, item);
    }
  });
  tx();
  res.json({items: getUserShoppingList(session.userId)});
});

app.patch('/api/shopping/:id', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد شوید.'});
  const checked = Boolean(req.body?.checked);
  db.prepare('UPDATE shopping_items SET checked = ? WHERE id = ? AND user_id = ?').run(
    checked ? 1 : 0,
    req.params.id,
    session.userId
  );
  res.json({items: getUserShoppingList(session.userId)});
});

app.delete('/api/shopping/:id', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد شوید.'});
  if (req.params.id === 'clear-checked') {
    db.prepare('DELETE FROM shopping_items WHERE user_id = ? AND checked = 1').run(session.userId);
  } else if (req.params.id === 'clear-all') {
    db.prepare('DELETE FROM shopping_items WHERE user_id = ?').run(session.userId);
  } else {
    db.prepare('DELETE FROM shopping_items WHERE id = ? AND user_id = ?').run(req.params.id, session.userId);
  }
  res.json({items: getUserShoppingList(session.userId)});
});

// =========================================================================
// 6. EDITORIAL FOOD ORDERING (DAILY MENU + VALIDATED CHECKOUT + TRACKING)
// =========================================================================
app.get('/api/menu', (_req, res) => {
  const rows = db.prepare('SELECT * FROM menu_items ORDER BY featured DESC').all() as Record<string, unknown>[];
  const items = rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    subtitle: String(r.subtitle),
    story: String(r.story),
    category: String(r.category),
    imageUrl: String(r.image_url),
    chefName: String(r.chef_name),
    chefVerified: Number(r.chef_verified) === 1,
    prepMinutes: Number(r.prep_minutes),
    calories: Number(r.calories),
    singlePrice: Number(r.single_price),
    doublePrice: Number(r.double_price),
    dietTags: JSON.parse(String(r.diet_tags_json || '[]')),
    keyIngredients: JSON.parse(String(r.key_ingredients_json || '[]')),
    featured: Number(r.featured) === 1,
    linkedRecipeId: r.linked_recipe_id ? String(r.linked_recipe_id) : null,
  }));
  const pricing = getDeliveryPricingConfig();
  res.json({
    items,
    freeDeliveryThreshold: pricing.freeDeliveryThreshold,
    packagingFee: pricing.packagingFee,
    standardDeliveryFee: pricing.standardDeliveryFee,
  });
});

const createOrderSchema = z.object({
  city: z.string().min(2).max(40),
  neighborhood: z.string().min(2).max(60),
  address: z.string().min(8).max(300),
  phone: z.string().min(10).max(20),
  deliverySlot: z.string().min(3).max(60),
  note: z.string().max(250).optional(),
  items: z
    .array(
      z.object({
        dishId: z.string().min(1),
        portion: z.enum(['single', 'double']),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1),
});

app.post('/api/orders', (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({error: 'لطفاً نشانی دقیق (حداقل ۸ کاراکتر) و اقلام سفارش را کامل وارد کنید.'});
  }
  const phoneCheck = validateIranMobile(parsed.data.phone);
  if (!phoneCheck.valid) {
    return res.status(400).json({error: phoneCheck.error});
  }

  let subtotal = 0;
  const resolvedItems: {
    dishId: string;
    title: string;
    portion: 'single' | 'double';
    quantity: number;
    unitPrice: number;
  }[] = [];

  for (const line of parsed.data.items) {
    const dish = db
      .prepare('SELECT id, title, single_price, double_price FROM menu_items WHERE id = ?')
      .get(line.dishId) as {id: string; title: string; single_price: number; double_price: number} | undefined;
    if (!dish) return res.status(400).json({error: 'یکی از غذاهای انتخابی در منوی امروز موجود نیست.'});
    const unitPrice = line.portion === 'double' ? dish.double_price : dish.single_price;
    subtotal += unitPrice * line.quantity;
    resolvedItems.push({
      dishId: dish.id,
      title: dish.title,
      portion: line.portion,
      quantity: line.quantity,
      unitPrice,
    });
  }

  const pricing = getDeliveryPricingConfig();
  const packagingFee = pricing.packagingFee;
  const deliveryFee = subtotal >= pricing.freeDeliveryThreshold ? 0 : pricing.standardDeliveryFee;
  const total = subtotal + packagingFee + deliveryFee;
  const id = `ord-${crypto.randomUUID().slice(0, 8)}`;
  const trackingCode = `LG-${crypto.randomInt(10000, 99999)}`;
  const session = getSession(req);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO orders (
      id, user_id, tracking_code, city, neighborhood, address, phone, delivery_slot, note,
      items_json, subtotal, packaging_fee, delivery_fee, total, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
  ).run(
    id,
    session?.userId || null,
    trackingCode,
    parsed.data.city,
    parsed.data.neighborhood,
    parsed.data.address.trim(),
    phoneCheck.normalized,
    parsed.data.deliverySlot,
    parsed.data.note?.trim() || null,
    JSON.stringify(resolvedItems),
    subtotal,
    packagingFee,
    deliveryFee,
    total,
    now
  );

  if (session) {
    awardXpAndGems(session.userId, 35, 15, `ثبت سفارش ادیتوریال (${trackingCode})`);
  }

  res.status(201).json({
    order: {
      id,
      trackingCode,
      city: parsed.data.city,
      neighborhood: parsed.data.neighborhood,
      address: parsed.data.address.trim(),
      phone: phoneCheck.normalized,
      deliverySlot: parsed.data.deliverySlot,
      note: parsed.data.note?.trim(),
      items: resolvedItems,
      subtotal,
      packagingFee,
      deliveryFee,
      total,
      status: 'confirmed',
      createdAt: now,
    },
  });
});

app.get('/api/orders', (req, res) => {
  const session = getSession(req);
  if (!session) return res.json({orders: []});
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(session.userId) as Record<string, unknown>[];
  res.json({
    orders: rows.map((r) => ({
      id: String(r.id),
      trackingCode: String(r.tracking_code),
      city: String(r.city),
      neighborhood: String(r.neighborhood),
      address: String(r.address),
      phone: String(r.phone),
      deliverySlot: String(r.delivery_slot),
      note: r.note ? String(r.note) : undefined,
      items: JSON.parse(String(r.items_json)),
      subtotal: Number(r.subtotal),
      packagingFee: Number(r.packaging_fee),
      deliveryFee: Number(r.delivery_fee),
      total: Number(r.total),
      status: r.status,
      createdAt: String(r.created_at),
    })),
  });
});

// =========================================================================
// 7. COMMUNITY: 4-TAB PROFILE, CHEF PROFILES, FOLLOW/UNFOLLOW, BADGES, GEM WALLET
// =========================================================================
app.get('/api/profile/dashboard', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'ابتدا وارد حساب کاربری شوید.'});

  const user = buildUserProfile(session.userId);
  if (!user) return res.status(404).json({error: 'کاربر یافت نشد.'});

  const myRecipeRows = db
    .prepare('SELECT * FROM recipes WHERE author_id = ? ORDER BY created_at DESC')
    .all(session.userId) as Record<string, unknown>[];
  const bookmarkedRows = db
    .prepare(
      `SELECT r.* FROM recipes r INNER JOIN bookmarks b ON b.recipe_id = r.id WHERE b.user_id = ? ORDER BY b.created_at DESC`
    )
    .all(session.userId) as Record<string, unknown>[];

  const myQuestions = (
    db
      .prepare(
        `SELECT q.*, r.title as recipe_title FROM recipe_questions q LEFT JOIN recipes r ON r.id = q.recipe_id WHERE q.author_id = ? ORDER BY q.created_at DESC`
      )
      .all(session.userId) as Record<string, unknown>[]
  ).map((q) => ({
    id: String(q.id),
    recipeId: String(q.recipe_id),
    recipeTitle: q.recipe_title ? String(q.recipe_title) : 'دستور پخت',
    authorId: String(q.author_id),
    authorName: String(q.author_name),
    body: String(q.body),
    solved: Number(q.solved) === 1,
    createdAt: String(q.created_at),
    answers: [],
  }));

  const answersCount = (
    db.prepare('SELECT COUNT(*) as c FROM recipe_answers WHERE author_id = ?').get(session.userId) as {c: number}
  ).c;
  const bestAnswersCount = (
    db.prepare('SELECT COUNT(*) as c FROM recipe_answers WHERE author_id = ? AND is_best = 1').get(session.userId) as {
      c: number;
    }
  ).c;

  const badges: BadgeItem[] = [
    {
      id: 'badge-first-bookmark',
      title: 'گردآورنده طعم‌ها',
      description: 'ذخیره حداقل ۲ دستور پخت محبوب در فهرست نشانک‌ها',
      xpReward: 40,
      gemReward: 15,
      progress: Math.min(bookmarkedRows.length, 2),
      target: 2,
      unlocked: bookmarkedRows.length >= 2,
    },
    {
      id: 'badge-author',
      title: 'نویسنده آشپزخانه',
      description: 'ثبت اولین دستور پخت یا روش جایگزین در لاقلی',
      xpReward: 80,
      gemReward: 30,
      progress: Math.min(myRecipeRows.length, 1),
      target: 1,
      unlocked: myRecipeRows.length >= 1,
    },
    {
      id: 'badge-helper',
      title: 'همراه پرسش‌وپاسخ',
      description: 'طرح سوال یا ثبت ۲ پاسخ مفید برای سایر آشپزها',
      xpReward: 60,
      gemReward: 25,
      progress: Math.min(myQuestions.length + answersCount, 2),
      target: 2,
      unlocked: myQuestions.length + answersCount >= 2,
    },
    {
      id: 'badge-social',
      title: 'عضو جامعه سرآشپزها',
      description: 'دنبال کردن حداقل ۲ سرآشپز در لاقلی',
      xpReward: 50,
      gemReward: 20,
      progress: Math.min(user.followingCount, 2),
      target: 2,
      unlocked: user.followingCount >= 2,
    },
  ];

  const transactions = (
    db
      .prepare('SELECT * FROM gem_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(session.userId) as Record<string, unknown>[]
  ).map((t) => ({
    id: String(t.id),
    amount: Number(t.amount),
    reason: String(t.reason),
    createdAt: String(t.created_at),
  }));

  const coupons = (
    db
      .prepare('SELECT * FROM user_coupons WHERE user_id = ? ORDER BY created_at DESC')
      .all(session.userId) as Record<string, unknown>[]
  ).map((c) => ({
    id: String(c.id),
    title: String(c.title),
    code: String(c.code),
    partnerName: String(c.partner_name),
    discountLabel: String(c.discount_label),
    used: Number(c.used) === 1,
    createdAt: String(c.created_at),
  }));

  res.json({
    user,
    myRecipes: myRecipeRows.map((r) => mapRecipeRow(r, session.userId)),
    bookmarkedRecipes: bookmarkedRows.map((r) => mapRecipeRow(r, session.userId)),
    myQuestions,
    qaStats: {questionsCount: myQuestions.length, answersCount, bestAnswersCount},
    badges,
    transactions,
    coupons,
    gemStoreOffers: getGemStoreOffers(GEM_STORE_OFFERS),
  });
});

app.post('/api/gems/redeem', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای دریافت کوپن وارد حساب شوید.'});
  const offerId = String(req.body?.offerId || '');
  const offer = getGemStoreOffers(GEM_STORE_OFFERS).find((o) => o.id === offerId);
  if (!offer) return res.status(404).json({error: 'پیشنهاد مورد نظر یافت نشد.'});

  const user = db.prepare('SELECT gems FROM users WHERE id = ?').get(session.userId) as {gems: number};
  if (user.gems < offer.gemCost) {
    return res.status(400).json({error: 'موجودی جِم شما برای دریافت این کوپن کافی نیست.'});
  }

  const code = `${offer.codePrefix}-${crypto.randomInt(1000, 9999)}`;
  const now = new Date().toISOString();
  const couponId = `cpn-${crypto.randomUUID().slice(0, 8)}`;

  const tx = db.transaction(() => {
    awardXpAndGems(session.userId, 10, -offer.gemCost, `تبدیل جِم به کوپن «${offer.title}»`);
    db.prepare(
      'INSERT INTO user_coupons (id, user_id, title, code, partner_name, discount_label, used, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(couponId, session.userId, offer.title, code, offer.partnerName, offer.discountLabel, now);
    db.prepare('INSERT INTO partner_events (id, partner_id, event_type, created_at) VALUES (?, ?, ?, ?)').run(
      `ev-${crypto.randomUUID().slice(0, 8)}`,
      'prt-zaferan',
      'gem_redeem',
      now
    );
  });
  tx();

  res.status(201).json({
    coupon: {
      id: couponId,
      title: offer.title,
      code,
      partnerName: offer.partnerName,
      discountLabel: offer.discountLabel,
      used: false,
      createdAt: now,
    },
    user: buildUserProfile(session.userId),
  });
});

function buildChefSummary(row: Record<string, unknown>, viewerId?: string): ChefSummary {
  const id = String(row.id);
  const followersCount = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE following_id = ?').get(id) as {c: number}).c;
  const followingCount = (db.prepare('SELECT COUNT(*) as c FROM follows WHERE follower_id = ?').get(id) as {c: number}).c;
  const recipesCount = (
    db.prepare("SELECT COUNT(*) as c FROM recipes WHERE author_id = ? AND status = 'published'").get(id) as {c: number}
  ).c;
  const isFollowing = viewerId
    ? Boolean(db.prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?').get(viewerId, id))
    : false;
  const xp = Number(row.xp);
  return {
    id,
    name: String(row.name),
    city: String(row.city),
    bio: String(row.bio),
    specialty: String(row.specialty),
    isVerifiedChef: Number(row.is_verified_chef) === 1,
    followersCount,
    followingCount,
    recipesCount,
    xp,
    levelName: computeUserLevel(xp).levelName,
    isFollowing,
  };
}

app.get('/api/chefs/:id', (req, res) => {
  const session = getSession(req);
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!row) return res.status(404).json({error: 'پروفایل سرآشپز یافت نشد.'});

  const chef = buildChefSummary(row, session?.userId);
  const recipes = (
    db
      .prepare("SELECT * FROM recipes WHERE author_id = ? AND status = 'published' ORDER BY created_at DESC")
      .all(chef.id) as Record<string, unknown>[]
  ).map((r) => mapRecipeRow(r, session?.userId));

  const followers = (
    db
      .prepare('SELECT u.* FROM users u INNER JOIN follows f ON f.follower_id = u.id WHERE f.following_id = ?')
      .all(chef.id) as Record<string, unknown>[]
  ).map((u) => buildChefSummary(u, session?.userId));

  const following = (
    db
      .prepare('SELECT u.* FROM users u INNER JOIN follows f ON f.following_id = u.id WHERE f.follower_id = ?')
      .all(chef.id) as Record<string, unknown>[]
  ).map((u) => buildChefSummary(u, session?.userId));

  res.json({chef, recipes, followers, following});
});

app.post('/api/chefs/:id/follow', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای دنبال کردن سرآشپزها وارد شوید.'});
  if (session.userId === req.params.id) {
    return res.status(400).json({error: 'امکان دنبال کردن پروفایل خودتان وجود ندارد.'});
  }
  const exists = db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(session.userId, req.params.id);
  if (exists) {
    db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?').run(session.userId, req.params.id);
    return res.json({following: false});
  }
  db.prepare('INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)').run(
    session.userId,
    req.params.id,
    new Date().toISOString()
  );
  res.json({following: true});
});

// =========================================================================
// 8. FOOD INDUSTRY PARTNERS ECOSYSTEM (10 ROLES, 3 ONBOARDING FLOWS, ANALYTICS)
// =========================================================================
app.get('/api/partners', (req, res) => {
  const session = getSession(req);
  const config = getEcosystemConfig();
  const roleType = typeof req.query.roleType === 'string' ? req.query.roleType : '';
  const city = typeof req.query.city === 'string' ? req.query.city : '';
  const q = typeof req.query.q === 'string' ? normalizePersian(req.query.q) : '';

  let rows = (
    db.prepare("SELECT * FROM partners WHERE status = 'approved' ORDER BY tier DESC, verified DESC").all() as Record<
      string,
      unknown
    >[]
  )
    .map((p) => mapPartnerRow(p, session?.userId))
    .filter((p) => config.enabledPartnerRoles.includes(p.roleType));

  if (roleType && roleType !== 'all') {
    rows = rows.filter((p) => p.roleType === roleType);
  }
  if (q) {
    rows = rows.filter((p) =>
      normalizePersian(`${p.name} ${p.description} ${p.city} ${p.neighborhood}`).includes(q)
    );
  }

  let fallbackUsed = false;
  if (city && city !== 'همه شهرها') {
    const cityMatches = rows.filter((p) => p.city === city);
    if (cityMatches.length > 0) {
      rows = cityMatches;
    } else {
      // Geographic fallback (never show an empty broken directory!)
      fallbackUsed = true;
    }
  }

  res.json({partners: rows, fallbackUsed, config});
});

app.post('/api/partners/register', (req, res) => {
  const schema = z.object({
    name: z.string().min(2).max(100),
    roleType: z.string().min(3),
    city: z.string().min(2).max(40),
    neighborhood: z.string().max(60).optional(),
    description: z.string().min(10).max(500),
    address: z.string().min(4).max(200),
    phone: z.string().min(6).max(30),
    tier: z.enum(['free', 'featured', 'sponsor']).default('free'),
    promoCode: z.string().max(30).optional(),
    promoLabel: z.string().max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'لطفاً تمام اطلاعات کسب‌وکار را کامل وارد کنید.'});

  const id = `prt-${crypto.randomUUID().slice(0, 8)}`;
  const slug = `partner-${Date.now()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO partners (
      id, slug, name, role_type, city, neighborhood, description, address, phone, website,
      verified, claim_status, tier, promo_code, promo_label, affiliate_code,
      related_ingredients_json, related_tools_json, catalog_json, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 0, 'pending', ?, ?, ?, ?, '[]', '[]', '[]', 'pending', ?)`
  ).run(
    id,
    slug,
    parsed.data.name.trim(),
    parsed.data.roleType,
    parsed.data.city.trim(),
    parsed.data.neighborhood?.trim() || 'مرکز',
    parsed.data.description.trim(),
    parsed.data.address.trim(),
    parsed.data.phone.trim(),
    parsed.data.tier,
    parsed.data.promoCode?.trim() || null,
    parsed.data.promoLabel?.trim() || null,
    `AFF-${id.slice(-4).toUpperCase()}`,
    now
  );
  res.status(201).json({
    ok: true,
    id,
    message: 'درخواست عضویت کسب‌وکار شما ثبت شد و در صف تایید پنل مدیریت لاقلی قرار گرفت.',
  });
});

app.post('/api/partners/:id/claim', (req, res) => {
  const schema = z.object({phone: z.string().min(8).max(20), note: z.string().max(200).optional()});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'شماره تماس معتبر وارد کنید.'});
  db.prepare("UPDATE partners SET claim_status = 'pending' WHERE id = ?").run(req.params.id);
  res.json({ok: true, message: 'درخواست ثبت مالکیت صفحه (Claim) برای بررسی مدیریت ارسال شد.'});
});

app.post('/api/partners/:id/follow', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({error: 'برای دنبال کردن کسب‌وکارها وارد شوید.'});
  const exists = db
    .prepare('SELECT 1 FROM partner_follows WHERE user_id = ? AND partner_id = ?')
    .get(session.userId, req.params.id);
  if (exists) {
    db.prepare('DELETE FROM partner_follows WHERE user_id = ? AND partner_id = ?').run(session.userId, req.params.id);
    return res.json({following: false});
  }
  db.prepare('INSERT INTO partner_follows (user_id, partner_id, created_at) VALUES (?, ?, ?)').run(
    session.userId,
    req.params.id,
    new Date().toISOString()
  );
  res.json({following: true});
});

app.post('/api/partners/:id/events', (req, res) => {
  const schema = z.object({
    eventType: z.enum(['impression', 'profile_open', 'coupon_copy', 'gem_redeem', 'affiliate_click']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'نوع رویداد معتبر نیست.'});
  db.prepare('INSERT INTO partner_events (id, partner_id, event_type, created_at) VALUES (?, ?, ?, ?)').run(
    `ev-${crypto.randomUUID().slice(0, 8)}`,
    req.params.id,
    parsed.data.eventType,
    new Date().toISOString()
  );
  res.json({ok: true});
});

// =========================================================================
// 9. ADMIN PROGRAMMABLE PANEL (FIRST-RUN SETUP / SERVER-VERIFIED PASSCODE)
// =========================================================================
function isEnvAdminPasscodeSet(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
}

function getStoredAdminHash(): string | null {
  const row = db.prepare('SELECT password_hash FROM admin_auth WHERE id = 1').get() as
    | {password_hash: string}
    | undefined;
  return row?.password_hash ?? null;
}

function requireAdmin(req: express.Request, res: express.Response): SessionContext | null {
  const session = getSession(req);
  if (!session || !session.isAdmin) {
    res.status(403).json({error: 'دسترسی مدیریت تایید نشده است.'});
    return null;
  }
  return session;
}

app.get('/api/admin/status', (req, res) => {
  const session = getSession(req);
  const envConfigured = isEnvAdminPasscodeSet();
  const dbConfigured = Boolean(getStoredAdminHash());
  res.json({
    configured: envConfigured || dbConfigured,
    authenticated: Boolean(session?.isAdmin),
    quickTestLoginEnabled: isTestQuickLoginEnabled(),
  });
});

app.post('/api/admin/quick-test-login', (req, res) => {
  if (!isTestQuickLoginEnabled()) {
    return res.status(403).json({error: 'ورود سریع مدیریت در محیط عملیاتی غیرفعال است.'});
  }
  if (!checkRateLimit(`quick-admin:${req.ip}`, 20, 1000 * 60 * 5)) {
    return res.status(429).json({error: 'تعداد درخواست‌ها زیاد است؛ کمی صبر کنید.'});
  }
  const adminToken = createSession('admin-root', true);
  res.json({adminToken, testMode: true, message: 'ورود سریع آزمایشی به پنل مدیریت فعال شد.'});
});

app.post('/api/admin/setup', (req, res) => {
  if (isEnvAdminPasscodeSet() || getStoredAdminHash()) {
    return res.status(409).json({error: 'رمز مدیریت پیش‌تر تنظیم شده است؛ از بخش ورود استفاده کنید.'});
  }
  const schema = z.object({password: z.string().min(6).max(64)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'رمز عبور مدیریت باید حداقل ۶ کاراکتر باشد.'});

  const hash = hashPassword(parsed.data.password);
  const result = db
    .prepare('INSERT OR IGNORE INTO admin_auth (id, password_hash, updated_at) VALUES (1, ?, ?)')
    .run(hash, new Date().toISOString());
  if (result.changes === 0) {
    return res.status(409).json({error: 'رمز مدیریت پیش‌تر ثبت شده است.'});
  }

  const adminToken = createSession('admin-root', true);
  res.status(201).json({adminToken, message: 'رمز مدیریت با موفقیت ثبت شد و وارد پنل شدید.'});
});

app.post('/api/admin/login', (req, res) => {
  if (!checkRateLimit(`admin-login:${req.ip}`, 8, 1000 * 60 * 5)) {
    return res.status(429).json({error: 'تعداد تلاش‌های ورود زیاد است؛ کمی بعد تلاش کنید.'});
  }
  const schema = z.object({password: z.string().min(1).max(64)});
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'رمز عبور را وارد کنید.'});

  let valid = false;
  if (isEnvAdminPasscodeSet()) {
    const expected = Buffer.from(process.env.ADMIN_PASSCODE!.trim());
    const provided = Buffer.from(parsed.data.password);
    valid = expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
  } else {
    const stored = getStoredAdminHash();
    if (stored) valid = verifyPassword(parsed.data.password, stored);
  }

  if (!valid) return res.status(401).json({error: 'رمز عبور مدیریت نادرست است.'});
  const adminToken = createSession('admin-root', true);
  res.json({adminToken});
});

app.get('/api/admin/overview', (req, res) => {
  if (!requireAdmin(req, res)) return;

  const config = getEcosystemConfig();
  const pendingPartners = (
    db.prepare("SELECT * FROM partners WHERE status = 'pending' OR claim_status = 'pending'").all() as Record<
      string,
      unknown
    >[]
  ).map((p) => mapPartnerRow(p));
  const allPartners = (
    db.prepare('SELECT * FROM partners ORDER BY created_at DESC').all() as Record<string, unknown>[]
  ).map((p) => mapPartnerRow(p));
  const pendingRecipes = (
    db.prepare("SELECT * FROM recipes WHERE status = 'pending'").all() as Record<string, unknown>[]
  ).map((r) => mapRecipeRow(r));
  const pendingChefs = db
    .prepare("SELECT id, name, phone, city, bio, specialty FROM users WHERE chef_verification_status = 'pending'")
    .all();

  const events = db.prepare('SELECT partner_id, event_type FROM partner_events').all() as {
    partner_id: string;
    event_type: string;
  }[];

  const byPartnerMap = new Map<
    string,
    {partnerId: string; partnerName: string; impressions: number; profileOpens: number; couponCopies: number; affiliateClicks: number}
  >();

  for (const p of allPartners) {
    byPartnerMap.set(p.id, {
      partnerId: p.id,
      partnerName: p.name,
      impressions: 0,
      profileOpens: 0,
      couponCopies: 0,
      affiliateClicks: 0,
    });
  }

  let totalImpressions = 0;
  let totalProfileOpens = 0;
  let totalCouponCopies = 0;
  let totalGemRedeems = 0;
  let totalAffiliateClicks = 0;

  for (const ev of events) {
    const bucket = byPartnerMap.get(ev.partner_id);
    if (ev.event_type === 'impression') {
      totalImpressions++;
      if (bucket) bucket.impressions++;
    } else if (ev.event_type === 'profile_open') {
      totalProfileOpens++;
      if (bucket) bucket.profileOpens++;
    } else if (ev.event_type === 'coupon_copy') {
      totalCouponCopies++;
      if (bucket) bucket.couponCopies++;
    } else if (ev.event_type === 'gem_redeem') {
      totalGemRedeems++;
    } else if (ev.event_type === 'affiliate_click') {
      totalAffiliateClicks++;
      if (bucket) bucket.affiliateClicks++;
    }
  }

  res.json({
    config,
    pendingPartners,
    allPartners,
    pendingRecipes,
    pendingChefs,
    analytics: {
      totalImpressions,
      totalProfileOpens,
      totalCouponCopies,
      totalGemRedeems,
      totalAffiliateClicks,
      byPartner: Array.from(byPartnerMap.values()),
    },
  });
});

app.put('/api/admin/config', (req, res) => {
  if (!requireAdmin(req, res)) return;
  const schema = z.object({
    marketplaceTabEnabled: z.boolean(),
    marketplaceTitle: z.string().min(2).max(40),
    exploreShowcaseEnabled: z.boolean(),
    recipeContextEnabled: z.boolean(),
    shoppingDeliveryCardEnabled: z.boolean(),
    maxPartnerCardsPerRecipe: z.number().int().min(0).max(3),
    enabledPartnerRoles: z.array(z.string()),
    activeCampaignTitle: z.string().max(100),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'تنظیمات واردشده معتبر نیست.'});

  const nextConfig: EcosystemConfig = {
    ...DEFAULT_ECOSYSTEM_CONFIG,
    ...parsed.data,
    enabledPartnerRoles: parsed.data.enabledPartnerRoles as PartnerRoleId[],
  };
  db.prepare('INSERT OR REPLACE INTO app_config (key, value_json) VALUES (?, ?)').run(
    'ecosystem',
    JSON.stringify(nextConfig)
  );
  res.json({config: nextConfig});
});

app.post('/api/admin/partners/:id/approve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("UPDATE partners SET status = 'approved', verified = 1, claim_status = 'verified' WHERE id = ?").run(
    req.params.id
  );
  res.json({ok: true});
});

app.post('/api/admin/recipes/:id/approve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("UPDATE recipes SET status = 'published' WHERE id = ?").run(req.params.id);
  res.json({ok: true});
});

app.post('/api/admin/chefs/:id/approve', (req, res) => {
  if (!requireAdmin(req, res)) return;
  db.prepare("UPDATE users SET is_verified_chef = 1, chef_verification_status = 'approved', role = 'chef' WHERE id = ?").run(
    req.params.id
  );
  res.json({ok: true});
});

// Register expanded Desktop Admin CMS, Bulk Import, Photo Moderation, Wallets & Sponsor Campaigns routes
registerAdminAndMediaRoutes(app, {
  getSession,
  requireAdmin,
  isSafeUrl,
  mapRecipeRow,
  mapPartnerRow,
  awardXpAndGems,
  checkRateLimit,
});

registerAdminExtrasRoutes(app, {
  requireAdmin,
  isSafeUrl,
  defaultGemOffers: GEM_STORE_OFFERS,
});

// =========================================================================
// TECHNICAL SEO ENDPOINTS (/robots.txt & DYNAMIC /sitemap.xml)
// =========================================================================
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/robots.txt', (req, res) => {
  const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.type('text/plain; charset=utf-8').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /api/',
      'Disallow: /?tab=admin',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const recipes = db
    .prepare("SELECT slug, created_at FROM recipes WHERE status = 'published' ORDER BY created_at DESC LIMIT 5000")
    .all() as {slug: string; created_at: string}[];

  const today = new Date().toISOString().slice(0, 10);
  const urls: string[] = [
    `<url><loc>${escapeXml(baseUrl)}/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    `<url><loc>${escapeXml(baseUrl)}/?tab=kitchen</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${escapeXml(baseUrl)}/?tab=order</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`,
    `<url><loc>${escapeXml(baseUrl)}/?tab=marketplace</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
  ];

  for (const r of recipes) {
    const lastmod = (r.created_at || today).slice(0, 10);
    const loc = `${baseUrl}/?recipe=${encodeURIComponent(r.slug)}`;
    urls.push(
      `<url><loc>${escapeXml(loc)}</loc><lastmod>${escapeXml(lastmod)}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  res.type('application/xml; charset=utf-8').send(xml);
});

// =========================================================================
// START SERVER WITH VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
// =========================================================================
async function startServer() {
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';
  const httpServer = http.createServer(app);

  if (!isProd) {
    const hmrEnabled = process.env.DISABLE_HMR !== 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: hmrEnabled,
        ws: {server: httpServer},
        watch: hmrEnabled ? {} : null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Lagheli PWA server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
