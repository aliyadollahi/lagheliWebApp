import crypto from 'crypto';
import type express from 'express';
import fs from 'fs';
import path from 'path';
import {z} from 'zod';
import {db, getAclRoles, getNativeAds, mapNativeAdRow} from './db.ts';
import {
  buildAdminEditorialInsights,
  type RawSearchLogRow,
  type RecipeEngagementSignals,
} from '../shared/editorialInsightsEngine.ts';
import {normalizePersian} from '../shared/persianEngine.ts';
import {ALL_ADMIN_PERMISSIONS, hasAdminPermission} from '../shared/rbac.ts';
import type {
  AdminDashboardStats,
  AdminPermission,
  AdminRole,
  AdminUserRow,
  CampaignPlacement,
  Partner,
  PartnerRoleId,
  PendingRecipeDraftItem,
  RbacAuditLog,
  Recipe,
  RecipePhoto,
  RecipeVersion,
  RecipeVersionSnapshot,
  RecipeVersionStatus,
  SponsorCampaign,
  UserRole,
  WalletTransaction,
} from '../shared/types.ts';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'recipe-photos');
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB

export interface SessionContext {
  userId: string;
  isAdmin: boolean;
  adminRole: AdminRole | null;
  actorName: string;
}

export interface RouteDeps {
  getSession: (req: express.Request) => SessionContext | null;
  requireAdmin: (
    req: express.Request,
    res: express.Response,
    permission?: AdminPermission
  ) => SessionContext | null;
  isSafeUrl: (url: string | undefined) => boolean;
  mapRecipeRow: (row: Record<string, unknown>, viewerId?: string) => Recipe;
  mapPartnerRow: (row: Record<string, unknown>, viewerId?: string) => Partner;
  awardXpAndGems: (userId: string, xpDelta: number, gemDelta: number, reason: string) => void;
  checkRateLimit: (key: string, maxRequests: number, windowMs: number) => boolean;
}

export function saveUploadedRecipeImage(
  dataUrl: string
): {ok: true; url: string} | {ok: false; error: string} {
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match) {
    return {ok: false, error: 'فرمت تصویر مجاز نیست؛ لطفاً فقط JPG، PNG یا WebP ارسال کنید.'};
  }

  const base64Body = match[2].replace(/\s+/g, '');
  const buf = Buffer.from(base64Body, 'base64');
  if (buf.length < 100 || buf.length > MAX_UPLOAD_BYTES) {
    return {ok: false, error: 'حجم تصویر باید کمتر از ۳ مگابایت باشد.'};
  }

  // Verify binary magic bytes strictly (blocks spoofed MIME / SVG / scripts)
  let ext: '.jpg' | '.png' | '.webp' | null = null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    ext = '.jpg';
  } else if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    ext = '.png';
  } else if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    ext = '.webp';
  }

  if (!ext) {
    return {ok: false, error: 'محتوای فایل تصویر معتبر نیست.'};
  }

  fs.mkdirSync(UPLOAD_DIR, {recursive: true});
  const filename = `${crypto.randomUUID()}${ext}`;
  const resolvedPath = path.resolve(UPLOAD_DIR, filename);
  if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep)) {
    return {ok: false, error: 'مسیر ذخیره فایل نامعتبر است.'};
  }

  fs.writeFileSync(resolvedPath, buf);
  return {ok: true, url: `/uploads/recipe-photos/${filename}`};
}

function mapPhotoRow(row: Record<string, unknown>): RecipePhoto {
  return {
    id: String(row.id),
    recipeId: String(row.recipe_id),
    recipeTitle: row.recipe_title ? String(row.recipe_title) : undefined,
    recipeHasCover:
      row.recipe_image_url !== undefined ? String(row.recipe_image_url || '').trim().length > 0 : undefined,
    userId: String(row.user_id),
    userName: String(row.user_name),
    imageUrl: String(row.image_url),
    caption: String(row.caption || ''),
    status: row.status as RecipePhoto['status'],
    isCover: Number(row.is_cover) === 1,
    createdAt: String(row.created_at),
  };
}

function mapCampaignRow(row: Record<string, unknown>): SponsorCampaign {
  return {
    id: String(row.id),
    partnerId: String(row.partner_id),
    partnerName: String(row.partner_name || 'همکار لاقلی'),
    title: String(row.title),
    subtitle: String(row.subtitle || ''),
    placement: row.placement as CampaignPlacement,
    promoCode: row.promo_code ? String(row.promo_code) : undefined,
    ctaLabel: String(row.cta_label || 'مشاهده پیشنهاد'),
    budgetToman: Number(row.budget_toman || 0),
    spentToman: Number(row.spent_toman || 0),
    impressions: Number(row.impressions || 0),
    clicks: Number(row.clicks || 0),
    status: row.status as SponsorCampaign['status'],
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
    endsAt: row.ends_at ? String(row.ends_at) : undefined,
    createdAt: String(row.created_at),
  };
}

function parseJsonSafe<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function snapshotFromRecipeRow(row: Record<string, unknown>): RecipeVersionSnapshot {
  const nutrition = parseJsonSafe(row.nutrition_json, {
    calories: 420,
    protein: 18,
    carbs: 45,
    fat: 14,
    fiber: 5,
  });
  return {
    title: String(row.title || ''),
    subtitle: String(row.subtitle || ''),
    description: String(row.description || ''),
    imageUrl: String(row.image_url || ''),
    category: String(row.category || 'ناهار و شام'),
    region: String(row.region || 'سراسری'),
    season: String(row.season || 'چهارفصل'),
    mealType: String(row.meal_type || 'ناهار'),
    dietTags: parseJsonSafe<string[]>(row.diet_tags_json, ['سنتی']),
    prepMinutes: Number(row.prep_minutes || 20),
    cookMinutes: Number(row.cook_minutes || 40),
    servings: Number(row.servings || 4),
    difficulty: (row.difficulty === 'آسان' || row.difficulty === 'حرفه‌ای'
      ? row.difficulty
      : 'متوسط') as RecipeVersionSnapshot['difficulty'],
    nutrition,
    isVip: Number(row.is_vip || 0) === 1,
    vipGemCost: Number(row.vip_gem_cost || 0),
    ingredients: parseJsonSafe(row.ingredients_json, []),
    steps: parseJsonSafe(row.steps_json, []),
    tools: parseJsonSafe<string[]>(row.tools_json, []),
  };
}

function mapVersionRow(row: Record<string, unknown>): RecipeVersion {
  const emptySnapshot: RecipeVersionSnapshot = {
    title: '',
    subtitle: '',
    description: '',
    imageUrl: '',
    category: 'ناهار و شام',
    region: 'سراسری',
    season: 'چهارفصل',
    mealType: 'ناهار',
    dietTags: [],
    prepMinutes: 20,
    cookMinutes: 40,
    servings: 4,
    difficulty: 'متوسط',
    nutrition: {calories: 420, protein: 18, carbs: 45, fat: 14, fiber: 5},
    isVip: false,
    vipGemCost: 0,
    ingredients: [],
    steps: [],
    tools: [],
  };
  return {
    id: String(row.id),
    recipeId: String(row.recipe_id),
    versionNumber: Number(row.version_number || 1),
    status: row.status as RecipeVersionStatus,
    changeSummary: String(row.change_summary || ''),
    snapshot: parseJsonSafe<RecipeVersionSnapshot>(row.snapshot_json, emptySnapshot),
    createdById: String(row.created_by_id || 'system'),
    createdByName: String(row.created_by_name || 'تحریریه لاقلی'),
    reviewedById: row.reviewed_by_id ? String(row.reviewed_by_id) : null,
    reviewedByName: row.reviewed_by_name ? String(row.reviewed_by_name) : null,
    reviewNote: String(row.review_note || ''),
    createdAt: String(row.created_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
  };
}

function ensureBaselineVersion(recipeRow: Record<string, unknown>): void {
  const recipeId = String(recipeRow.id);
  const existingCount = (
    db.prepare('SELECT COUNT(*) as c FROM recipe_versions WHERE recipe_id = ?').get(recipeId) as {c: number}
  ).c;
  if (existingCount > 0) return;

  const authorRow = db
    .prepare('SELECT name FROM users WHERE id = ?')
    .get(String(recipeRow.author_id || '')) as {name: string} | undefined;
  const authorName = authorRow?.name || 'تحریریه لاقلی';
  const isPublished = String(recipeRow.status) === 'published';
  const createdAt = String(recipeRow.created_at || new Date().toISOString());

  db.prepare(
    `INSERT INTO recipe_versions (
      id, recipe_id, version_number, status, change_summary, snapshot_json,
      created_by_id, created_by_name, reviewed_by_id, reviewed_by_name, review_note, created_at, reviewed_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `ver-${crypto.randomUUID().slice(0, 8)}`,
    recipeId,
    isPublished ? 'published' : 'draft',
    isPublished ? 'نسخه پایه منتشرشده' : 'نسخه اولیه در انتظار تایید',
    JSON.stringify(snapshotFromRecipeRow(recipeRow)),
    String(recipeRow.author_id || 'system'),
    authorName,
    isPublished ? 'system' : null,
    isPublished ? 'انتشار اولیه' : null,
    '',
    createdAt,
    isPublished ? createdAt : null
  );
}

function getNextVersionNumber(recipeId: string): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(version_number), 0) as max_ver FROM recipe_versions WHERE recipe_id = ?')
    .get(recipeId) as {max_ver: number};
  return Number(row.max_ver || 0) + 1;
}

const adminRecipePayloadSchema = z.object({
  title: z.string().min(2).max(140),
  subtitle: z.string().max(220).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  imageUrl: z.string().max(400).optional().default(''),
  imageDataUrl: z.string().optional(),
  category: z.string().min(2).max(60).optional().default('ناهار و شام'),
  region: z.string().min(2).max(60).optional().default('سراسری'),
  season: z.string().min(2).max(40).optional().default('چهارفصل'),
  mealType: z.string().min(2).max(40).optional().default('ناهار'),
  dietTags: z.array(z.string().max(40)).max(10).optional().default(['سنتی']),
  prepMinutes: z.number().int().min(1).max(600).optional().default(20),
  cookMinutes: z.number().int().min(1).max(600).optional().default(40),
  servings: z.number().int().min(1).max(50).optional().default(4),
  difficulty: z.enum(['آسان', 'متوسط', 'حرفه‌ای']).optional().default('متوسط'),
  calories: z.number().int().min(0).max(5000).optional().default(420),
  protein: z.number().int().min(0).max(500).optional().default(18),
  carbs: z.number().int().min(0).max(500).optional().default(45),
  fat: z.number().int().min(0).max(500).optional().default(14),
  fiber: z.number().int().min(0).max(200).optional().default(5),
  isVip: z.boolean().optional().default(false),
  vipGemCost: z.number().int().min(0).max(5000).optional().default(0),
  status: z.enum(['published', 'pending']).optional().default('published'),
  changeSummary: z.string().max(240).optional().default(''),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        amount: z.number().nonnegative().default(1),
        unit: z.string().min(1).max(40).default('عدد'),
      })
    )
    .min(1),
  steps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        instruction: z.string().min(3).max(1000),
        timerMinutes: z.number().int().min(1).max(360).optional(),
      })
    )
    .min(1),
  tools: z.array(z.string().max(60)).max(15).optional().default([]),
});

export function registerAdminAndMediaRoutes(app: express.Express, deps: RouteDeps): void {
  const {getSession, requireAdmin, isSafeUrl, mapRecipeRow, mapPartnerRow, awardXpAndGems, checkRateLimit} = deps;

  // =========================================================================
  // SAFE STATIC SERVING FOR UPLOADED USER DISH PHOTOS
  // =========================================================================
  app.get('/uploads/recipe-photos/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(filename)) {
      return res.status(400).send('Invalid filename');
    }
    const resolvedPath = path.resolve(UPLOAD_DIR, filename);
    if (!resolvedPath.startsWith(UPLOAD_DIR + path.sep) || !fs.existsSync(resolvedPath)) {
      return res.status(404).send('Not found');
    }
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(resolvedPath).pipe(res);
  });

  // =========================================================================
  // COMMUNITY REAL DISH PHOTO UPLOAD & GALLERY
  // =========================================================================
  app.get('/api/recipes/:id/photos', (req, res) => {
    const rows = db
      .prepare(
        `SELECT rp.*, r.title AS recipe_title, r.image_url AS recipe_image_url
         FROM recipe_photos rp
         LEFT JOIN recipes r ON r.id = rp.recipe_id
         WHERE rp.recipe_id = ? AND rp.status = 'approved'
         ORDER BY rp.is_cover DESC, rp.created_at DESC`
      )
      .all(req.params.id) as Record<string, unknown>[];
    res.json({photos: rows.map(mapPhotoRow)});
  });

  app.post('/api/recipes/:id/photos', (req, res) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({error: 'برای ارسال عکس غذای پخته‌شده ابتدا وارد شوید.'});
    if (!checkRateLimit(`photo-upload:${session.userId}`, 8, 1000 * 60 * 10)) {
      return res.status(429).json({error: 'تعداد ارسال عکس در دقایق اخیر زیاد است؛ کمی بعد تلاش کنید.'});
    }

    const recipe = db.prepare('SELECT id, title, image_url FROM recipes WHERE id = ?').get(req.params.id) as
      | {id: string; title: string; image_url: string}
      | undefined;
    if (!recipe) return res.status(404).json({error: 'دستور پخت مورد نظر یافت نشد.'});

    const user = db.prepare('SELECT id, name, is_suspended FROM users WHERE id = ?').get(session.userId) as
      | {id: string; name: string; is_suspended: number}
      | undefined;
    if (!user) return res.status(401).json({error: 'حساب کاربری معتبر نیست.'});
    if (user.is_suspended === 1) return res.status(403).json({error: 'دسترسی حساب کاربری شما محدود شده است.'});

    const schema = z.object({
      imageDataUrl: z.string().min(50),
      caption: z.string().max(260).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'لطفاً یک تصویر معتبر انتخاب کنید.'});

    const saved = saveUploadedRecipeImage(parsed.data.imageDataUrl);
    if (!saved.ok) return res.status(400).json({error: saved.error});

    const id = `photo-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recipe_photos (id, recipe_id, user_id, user_name, image_url, caption, status, is_cover, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?)`
    ).run(id, recipe.id, user.id, user.name, saved.url, parsed.data.caption.trim(), now);

    const needsCover = !recipe.image_url || recipe.image_url.trim().length === 0;
    const rewardGems = needsCover ? 40 : 20;

    res.status(201).json({
      photo: {
        id,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        userId: user.id,
        userName: user.name,
        imageUrl: saved.url,
        caption: parsed.data.caption.trim(),
        status: 'pending',
        isCover: false,
        createdAt: now,
      },
      message: needsCover
        ? `عکس واقعی شما ثبت شد و به صف بررسی مدیریت رفت؛ پس از انتخاب به‌عنوان تصویر اصلی، ${rewardGems} جِم هدیه می‌گیرید.`
        : `عکس شما ثبت شد و پس از تایید مدیریت، ${rewardGems} جِم به کیف شما افزوده می‌شود.`,
    });
  });

  // =========================================================================
  // PUBLIC ACTIVE SPONSOR CAMPAIGNS
  // =========================================================================
  app.get('/api/campaigns/active', (req, res) => {
    const placement = typeof req.query.placement === 'string' ? req.query.placement : '';
    const rows = (
      placement
        ? db
            .prepare(
              `SELECT sc.*, p.name AS partner_name
               FROM sponsor_campaigns sc
               LEFT JOIN partners p ON p.id = sc.partner_id
               WHERE sc.status = 'active' AND sc.placement = ?
               ORDER BY sc.created_at DESC`
            )
            .all(placement)
        : db
            .prepare(
              `SELECT sc.*, p.name AS partner_name
               FROM sponsor_campaigns sc
               LEFT JOIN partners p ON p.id = sc.partner_id
               WHERE sc.status = 'active'
               ORDER BY sc.created_at DESC`
            )
            .all()
    ) as Record<string, unknown>[];
    res.json({campaigns: rows.map(mapCampaignRow)});
  });

  app.post('/api/campaigns/:id/event', (req, res) => {
    const schema = z.object({eventType: z.enum(['impression', 'click'])});
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'نوع رویداد نامعتبر است.'});
    if (parsed.data.eventType === 'impression') {
      db.prepare('UPDATE sponsor_campaigns SET impressions = impressions + 1 WHERE id = ?').run(req.params.id);
    } else {
      db.prepare('UPDATE sponsor_campaigns SET clicks = clicks + 1 WHERE id = ?').run(req.params.id);
    }
    res.json({ok: true});
  });

  // =========================================================================
  // ADMIN STATS OVERVIEW
  // =========================================================================
  app.get('/api/admin/stats', (req, res) => {
    if (!requireAdmin(req, res, 'dashboard.view')) return;

    const totalRecipes = (db.prepare('SELECT COUNT(*) as c FROM recipes').get() as {c: number}).c;
    const recipesWithoutPhoto = (
      db.prepare("SELECT COUNT(*) as c FROM recipes WHERE TRIM(COALESCE(image_url, '')) = ''").get() as {c: number}
    ).c;
    const pendingRecipesCount = (
      db.prepare("SELECT COUNT(*) as c FROM recipes WHERE status = 'pending'").get() as {c: number}
    ).c;
    const pendingDraftVersionsCount = (
      db.prepare("SELECT COUNT(*) as c FROM recipe_versions WHERE status = 'draft'").get() as {c: number}
    ).c;
    const pendingPhotosCount = (
      db.prepare("SELECT COUNT(*) as c FROM recipe_photos WHERE status = 'pending'").get() as {c: number}
    ).c;
    const approvedPhotosCount = (
      db.prepare("SELECT COUNT(*) as c FROM recipe_photos WHERE status = 'approved'").get() as {c: number}
    ).c;
    const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as {c: number}).c;
    const verifiedChefsCount = (
      db.prepare('SELECT COUNT(*) as c FROM users WHERE is_verified_chef = 1').get() as {c: number}
    ).c;
    const totalPartners = (db.prepare('SELECT COUNT(*) as c FROM partners').get() as {c: number}).c;
    const pendingPartnersCount = (
      db.prepare("SELECT COUNT(*) as c FROM partners WHERE status = 'pending' OR claim_status = 'pending'").get() as {
        c: number;
      }
    ).c;
    const activeCampaignsCount = (
      db.prepare("SELECT COUNT(*) as c FROM sponsor_campaigns WHERE status = 'active'").get() as {c: number}
    ).c;
    const totalOrdersCount = (db.prepare('SELECT COUNT(*) as c FROM orders').get() as {c: number}).c;
    const totalUserWalletToman = (
      db.prepare('SELECT COALESCE(SUM(wallet_balance), 0) as s FROM users').get() as {s: number}
    ).s;
    const totalPartnerWalletToman = (
      db.prepare('SELECT COALESCE(SUM(business_balance), 0) as s FROM partners').get() as {s: number}
    ).s;

    const stats: AdminDashboardStats = {
      totalRecipes,
      recipesWithoutPhoto,
      pendingRecipesCount,
      pendingDraftVersionsCount,
      pendingPhotosCount,
      approvedPhotosCount,
      totalUsers,
      verifiedChefsCount,
      totalPartners,
      pendingPartnersCount,
      activeCampaignsCount,
      totalOrdersCount,
      totalUserWalletToman,
      totalPartnerWalletToman,
    };
    res.json({stats});
  });

  // =========================================================================
  // ADMIN SMART EDITORIAL RECOMMENDATIONS (SEARCH TRENDS × ATTENTION SIGNALS)
  // =========================================================================
  app.get('/api/admin/editorial-insights', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;

    const rawDays = Number(req.query.days);
    const days = Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 90 ? Math.round(rawDays) : 30;
    const cutoffIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const recipeRows = db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const versionAggRows = db
      .prepare(
        `SELECT recipe_id,
                MAX(version_number) AS max_version,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS pending_drafts
         FROM recipe_versions
         GROUP BY recipe_id`
      )
      .all() as {recipe_id: string; max_version: number; pending_drafts: number}[];
    const versionMap = new Map(versionAggRows.map((v) => [v.recipe_id, v]));

    const recipes = recipeRows.map((r) => {
      const mapped = mapRecipeRow(r);
      const agg = versionMap.get(mapped.id);
      return {
        ...mapped,
        latestVersionNumber: agg ? Number(agg.max_version || 1) : 1,
        pendingDraftsCount: agg ? Number(agg.pending_drafts || 0) : 0,
      };
    });

    const bookmarkAgg = db
      .prepare('SELECT recipe_id, COUNT(*) AS cnt FROM bookmarks GROUP BY recipe_id')
      .all() as {recipe_id: string; cnt: number}[];
    const questionAgg = db
      .prepare(
        `SELECT recipe_id,
                COUNT(*) AS total_q,
                SUM(CASE WHEN solved = 0 THEN 1 ELSE 0 END) AS unsolved_q
         FROM recipe_questions
         GROUP BY recipe_id`
      )
      .all() as {recipe_id: string; total_q: number; unsolved_q: number}[];
    const pendingPhotoAgg = db
      .prepare("SELECT recipe_id, COUNT(*) AS cnt FROM recipe_photos WHERE status = 'pending' GROUP BY recipe_id")
      .all() as {recipe_id: string; cnt: number}[];

    const signalsByRecipe = new Map<string, RecipeEngagementSignals>();
    const ensureSignal = (recipeId: string): RecipeEngagementSignals => {
      let existing = signalsByRecipe.get(recipeId);
      if (!existing) {
        existing = {
          bookmarksCount: 0,
          questionsCount: 0,
          unsolvedQuestionsCount: 0,
          pendingPhotosCount: 0,
          pendingDraftsCount: 0,
        };
        signalsByRecipe.set(recipeId, existing);
      }
      return existing;
    };

    for (const r of recipes) {
      ensureSignal(r.id).pendingDraftsCount = r.pendingDraftsCount || 0;
    }
    for (const b of bookmarkAgg) {
      ensureSignal(b.recipe_id).bookmarksCount = Number(b.cnt || 0);
    }
    for (const q of questionAgg) {
      const s = ensureSignal(q.recipe_id);
      s.questionsCount = Number(q.total_q || 0);
      s.unsolvedQuestionsCount = Number(q.unsolved_q || 0);
    }
    for (const p of pendingPhotoAgg) {
      ensureSignal(p.recipe_id).pendingPhotosCount = Number(p.cnt || 0);
    }

    const rawLogRows = db
      .prepare(
        `SELECT query_raw, query_norm, source, results_count, created_at
         FROM search_logs
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT 5000`
      )
      .all(cutoffIso) as {
      query_raw: string;
      query_norm: string;
      source: string;
      results_count: number;
      created_at: string;
    }[];

    const searchLogs: RawSearchLogRow[] = rawLogRows.map((row) => ({
      queryRaw: row.query_raw,
      queryNorm: row.query_norm,
      source: row.source === 'fridge' ? 'fridge' : 'search',
      resultsCount: Number(row.results_count || 0),
      createdAt: row.created_at,
    }));

    const report = buildAdminEditorialInsights(recipes, searchLogs, signalsByRecipe);
    res.json({report});
  });

  // =========================================================================
  // ADMIN RECIPES CMS + BULK IMPORT (FOR THOUSANDS OF PHOTO-LESS RECIPES)
  // =========================================================================
  app.get('/api/admin/recipes', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;
    const q = typeof req.query.q === 'string' ? normalizePersian(req.query.q) : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
    const photoFilter = typeof req.query.photo === 'string' ? req.query.photo : 'all';

    const versionAggRows = db
      .prepare(
        `SELECT recipe_id,
                MAX(version_number) AS max_version,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS pending_drafts
         FROM recipe_versions
         GROUP BY recipe_id`
      )
      .all() as {recipe_id: string; max_version: number; pending_drafts: number}[];
    const versionMap = new Map(versionAggRows.map((v) => [v.recipe_id, v]));

    const rows = db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all() as Record<string, unknown>[];
    let recipes = rows.map((r) => {
      const mapped = mapRecipeRow(r);
      const agg = versionMap.get(mapped.id);
      return {
        ...mapped,
        latestVersionNumber: agg ? Number(agg.max_version || 1) : 1,
        pendingDraftsCount: agg ? Number(agg.pending_drafts || 0) : 0,
      };
    });
    if (statusFilter === 'published' || statusFilter === 'pending') {
      recipes = recipes.filter((r) => r.status === statusFilter);
    } else if (statusFilter === 'has_draft') {
      recipes = recipes.filter((r) => (r.pendingDraftsCount || 0) > 0 || r.status === 'pending');
    }
    if (photoFilter === 'without') {
      recipes = recipes.filter((r) => !r.imageUrl || r.imageUrl.trim().length === 0);
    } else if (photoFilter === 'with') {
      recipes = recipes.filter((r) => Boolean(r.imageUrl && r.imageUrl.trim().length > 0));
    }
    if (q) {
      recipes = recipes.filter((r) => {
        const hay = normalizePersian(`${r.title} ${r.subtitle} ${r.category} ${r.region} ${r.authorName}`);
        return hay.includes(q);
      });
    }
    res.json({recipes});
  });

  app.post('/api/admin/recipes', (req, res) => {
    const session = requireAdmin(req, res, 'content.recipes');
    if (!session) return;
    const parsed = adminRecipePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات دستور پخت کامل نیست (حداقل عنوان، ۱ ماده اولیه و ۱ مرحله لازم است).'});
    }

    const d = parsed.data;
    let finalImageUrl = d.imageUrl.trim();
    if (d.imageDataUrl && d.imageDataUrl.startsWith('data:image/')) {
      const saved = saveUploadedRecipeImage(d.imageDataUrl);
      if (!saved.ok) return res.status(400).json({error: saved.error});
      finalImageUrl = saved.url;
    } else if (finalImageUrl && !isSafeUrl(finalImageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر واردشده معتبر نیست.'});
    }

    const id = `rec-${crypto.randomUUID().slice(0, 8)}`;
    const slug = `lagheli-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const now = new Date().toISOString();
    const nutrition = {
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      fiber: d.fiber,
    };
    const snapshot: RecipeVersionSnapshot = {
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || `${d.category} · ${d.region}`,
      description: d.description.trim() || d.subtitle.trim() || d.title.trim(),
      imageUrl: finalImageUrl,
      category: d.category,
      region: d.region,
      season: d.season,
      mealType: d.mealType,
      dietTags: d.dietTags,
      prepMinutes: d.prepMinutes,
      cookMinutes: d.cookMinutes,
      servings: d.servings,
      difficulty: d.difficulty,
      nutrition,
      isVip: d.isVip,
      vipGemCost: d.isVip ? d.vipGemCost : 0,
      ingredients: d.ingredients,
      steps: d.steps,
      tools: d.tools,
    };

    const runCreate = db.transaction(() => {
      db.prepare(
        `INSERT INTO recipes (
          id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
          diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
          is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
          ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'chef-mahsa', ?, ?, ?, ?, NULL, ?)`
      ).run(
        id,
        slug,
        snapshot.title,
        snapshot.subtitle,
        snapshot.description,
        snapshot.imageUrl,
        snapshot.category,
        snapshot.region,
        snapshot.season,
        snapshot.mealType,
        JSON.stringify(snapshot.dietTags),
        snapshot.prepMinutes,
        snapshot.cookMinutes,
        snapshot.servings,
        snapshot.difficulty,
        JSON.stringify(snapshot.nutrition),
        snapshot.isVip ? 1 : 0,
        snapshot.vipGemCost,
        d.status,
        JSON.stringify(snapshot.ingredients),
        JSON.stringify(snapshot.steps),
        JSON.stringify(snapshot.tools),
        now
      );

      const isPublished = d.status === 'published';
      db.prepare(
        `INSERT INTO recipe_versions (
          id, recipe_id, version_number, status, change_summary, snapshot_json,
          created_by_id, created_by_name, reviewed_by_id, reviewed_by_name, review_note, created_at, reviewed_at
        ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `ver-${crypto.randomUUID().slice(0, 8)}`,
        id,
        isPublished ? 'published' : 'draft',
        d.changeSummary.trim() || (isPublished ? 'ایجاد و انتشار نسخه اولیه' : 'ایجاد پیش‌نویس اولیه برای بررسی'),
        JSON.stringify(snapshot),
        session.userId,
        session.actorName,
        isPublished ? session.userId : null,
        isPublished ? session.actorName : null,
        '',
        now,
        isPublished ? now : null
      );
    });
    runCreate();

    const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({recipe: {...mapRecipeRow(row), latestVersionNumber: 1, pendingDraftsCount: d.status === 'pending' ? 1 : 0}});
  });

  app.put('/api/admin/recipes/:id', (req, res) => {
    const session = requireAdmin(req, res, 'content.recipes');
    if (!session) return;
    const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'دستور پخت یافت نشد.'});

    const parsed = adminRecipePayloadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'ورودی ویرایش دستور پخت معتبر نیست.'});
    const d = parsed.data;

    let finalImageUrl = d.imageUrl.trim();
    if (d.imageDataUrl && d.imageDataUrl.startsWith('data:image/')) {
      const saved = saveUploadedRecipeImage(d.imageDataUrl);
      if (!saved.ok) return res.status(400).json({error: saved.error});
      finalImageUrl = saved.url;
    } else if (finalImageUrl && !isSafeUrl(finalImageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر واردشده معتبر نیست.'});
    }

    const now = new Date().toISOString();
    const nutrition = {
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      fiber: d.fiber,
    };
    const snapshot: RecipeVersionSnapshot = {
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || `${d.category} · ${d.region}`,
      description: d.description.trim() || d.title.trim(),
      imageUrl: finalImageUrl,
      category: d.category,
      region: d.region,
      season: d.season,
      mealType: d.mealType,
      dietTags: d.dietTags,
      prepMinutes: d.prepMinutes,
      cookMinutes: d.cookMinutes,
      servings: d.servings,
      difficulty: d.difficulty,
      nutrition,
      isVip: d.isVip,
      vipGemCost: d.isVip ? d.vipGemCost : 0,
      ingredients: d.ingredients,
      steps: d.steps,
      tools: d.tools,
    };

    const runUpdate = db.transaction(() => {
      ensureBaselineVersion(existing);
      const nextVer = getNextVersionNumber(req.params.id);

      db.prepare(
        `UPDATE recipes SET
          title = ?, subtitle = ?, description = ?, image_url = ?, category = ?, region = ?,
          season = ?, meal_type = ?, diet_tags_json = ?, prep_minutes = ?, cook_minutes = ?,
          servings = ?, difficulty = ?, nutrition_json = ?, is_vip = ?, vip_gem_cost = ?,
          status = ?, ingredients_json = ?, steps_json = ?, tools_json = ?
         WHERE id = ?`
      ).run(
        snapshot.title,
        snapshot.subtitle,
        snapshot.description,
        snapshot.imageUrl,
        snapshot.category,
        snapshot.region,
        snapshot.season,
        snapshot.mealType,
        JSON.stringify(snapshot.dietTags),
        snapshot.prepMinutes,
        snapshot.cookMinutes,
        snapshot.servings,
        snapshot.difficulty,
        JSON.stringify(snapshot.nutrition),
        snapshot.isVip ? 1 : 0,
        snapshot.vipGemCost,
        d.status,
        JSON.stringify(snapshot.ingredients),
        JSON.stringify(snapshot.steps),
        JSON.stringify(snapshot.tools),
        req.params.id
      );

      const isPublished = d.status === 'published';
      if (isPublished) {
        db.prepare("UPDATE recipe_versions SET status = 'archived' WHERE recipe_id = ? AND status = 'published'").run(
          req.params.id
        );
      }

      db.prepare(
        `INSERT INTO recipe_versions (
          id, recipe_id, version_number, status, change_summary, snapshot_json,
          created_by_id, created_by_name, reviewed_by_id, reviewed_by_name, review_note, created_at, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `ver-${crypto.randomUUID().slice(0, 8)}`,
        req.params.id,
        nextVer,
        isPublished ? 'published' : 'draft',
        d.changeSummary.trim() || (isPublished ? 'ویرایش و انتشار مستقیم نسخه جدید' : 'بروزرسانی پیش‌نویس'),
        JSON.stringify(snapshot),
        session.userId,
        session.actorName,
        isPublished ? session.userId : null,
        isPublished ? session.actorName : null,
        '',
        now,
        isPublished ? now : null
      );
    });
    runUpdate();

    const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({recipe: mapRecipeRow(row)});
  });

  // =========================================================================
  // RECIPE VERSION CONTROL: DRAFTS QUEUE, HISTORY, PREVIEW & APPROVAL
  // =========================================================================
  app.get('/api/admin/recipe-drafts', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;
    const rows = db
      .prepare(
        `SELECT rv.*, r.title AS live_title, r.status AS live_status
         FROM recipe_versions rv
         INNER JOIN recipes r ON r.id = rv.recipe_id
         WHERE rv.status = 'draft'
         ORDER BY rv.created_at DESC`
      )
      .all() as Record<string, unknown>[];

    const drafts: PendingRecipeDraftItem[] = rows.map((row) => {
      const mapped = mapVersionRow(row);
      return {
        versionId: mapped.id,
        recipeId: mapped.recipeId,
        recipeTitle: String(row.live_title || mapped.snapshot.title),
        recipeStatus: (row.live_status === 'pending' ? 'pending' : 'published') as 'published' | 'pending',
        versionNumber: mapped.versionNumber,
        changeSummary: mapped.changeSummary,
        createdByName: mapped.createdByName,
        createdAt: mapped.createdAt,
        snapshot: mapped.snapshot,
      };
    });

    res.json({drafts});
  });

  app.get('/api/admin/recipes/:id/versions', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;
    const recipeRow = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!recipeRow) return res.status(404).json({error: 'دستور پخت مورد نظر یافت نشد.'});

    ensureBaselineVersion(recipeRow);
    const versionRows = db
      .prepare('SELECT * FROM recipe_versions WHERE recipe_id = ? ORDER BY version_number DESC')
      .all(req.params.id) as Record<string, unknown>[];

    res.json({
      recipe: mapRecipeRow(recipeRow),
      versions: versionRows.map(mapVersionRow),
    });
  });

  app.post('/api/admin/recipes/:id/drafts', (req, res) => {
    const session = requireAdmin(req, res, 'content.recipes');
    if (!session) return;

    const existing = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'دستور پخت مورد نظر یافت نشد.'});

    const parsed = adminRecipePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات پیش‌نویس کامل یا معتبر نیست.'});
    }
    const d = parsed.data;

    let finalImageUrl = d.imageUrl.trim();
    if (d.imageDataUrl && d.imageDataUrl.startsWith('data:image/')) {
      const saved = saveUploadedRecipeImage(d.imageDataUrl);
      if (!saved.ok) return res.status(400).json({error: saved.error});
      finalImageUrl = saved.url;
    } else if (finalImageUrl && !isSafeUrl(finalImageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر واردشده معتبر نیست.'});
    }

    const now = new Date().toISOString();
    const versionId = `ver-${crypto.randomUUID().slice(0, 8)}`;
    const snapshot: RecipeVersionSnapshot = {
      title: d.title.trim(),
      subtitle: d.subtitle.trim() || `${d.category} · ${d.region}`,
      description: d.description.trim() || d.title.trim(),
      imageUrl: finalImageUrl,
      category: d.category,
      region: d.region,
      season: d.season,
      mealType: d.mealType,
      dietTags: d.dietTags,
      prepMinutes: d.prepMinutes,
      cookMinutes: d.cookMinutes,
      servings: d.servings,
      difficulty: d.difficulty,
      nutrition: {
        calories: d.calories,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        fiber: d.fiber,
      },
      isVip: d.isVip,
      vipGemCost: d.isVip ? d.vipGemCost : 0,
      ingredients: d.ingredients,
      steps: d.steps,
      tools: d.tools,
    };

    const runDraft = db.transaction(() => {
      ensureBaselineVersion(existing);
      const nextVer = getNextVersionNumber(req.params.id);
      db.prepare(
        `INSERT INTO recipe_versions (
          id, recipe_id, version_number, status, change_summary, snapshot_json,
          created_by_id, created_by_name, reviewed_by_id, reviewed_by_name, review_note, created_at, reviewed_at
        ) VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, NULL, NULL, '', ?, NULL)`
      ).run(
        versionId,
        req.params.id,
        nextVer,
        d.changeSummary.trim() || 'پیش‌نویس ویرایشی در انتظار پیش‌نمایش و تایید',
        JSON.stringify(snapshot),
        session.userId,
        session.actorName,
        now
      );
    });
    runDraft();

    const row = db.prepare('SELECT * FROM recipe_versions WHERE id = ?').get(versionId) as Record<string, unknown>;
    res.status(201).json({version: mapVersionRow(row)});
  });

  app.post('/api/admin/recipes/:id/versions/:versionId/approve', (req, res) => {
    const session = requireAdmin(req, res, 'content.recipes');
    if (!session) return;

    const schema = z.object({reviewNote: z.string().max(240).optional().default('')});
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({error: 'یادداشت تایید بیش از حد مجاز طولانی است.'});

    const versionRow = db
      .prepare('SELECT * FROM recipe_versions WHERE id = ? AND recipe_id = ?')
      .get(req.params.versionId, req.params.id) as Record<string, unknown> | undefined;
    if (!versionRow) return res.status(404).json({error: 'نسخه مورد نظر برای این دستور پخت یافت نشد.'});

    const recipeRow = db.prepare('SELECT id FROM recipes WHERE id = ?').get(req.params.id) as {id: string} | undefined;
    if (!recipeRow) return res.status(404).json({error: 'دستور پخت اصلی یافت نشد.'});

    const mappedVersion = mapVersionRow(versionRow);
    const snap = mappedVersion.snapshot;
    if (snap.imageUrl && !isSafeUrl(snap.imageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر ذخیره‌شده در این نسخه معتبر نیست.'});
    }

    const now = new Date().toISOString();
    const runApprove = db.transaction(() => {
      db.prepare(
        `UPDATE recipes SET
          title = ?, subtitle = ?, description = ?, image_url = ?, category = ?, region = ?,
          season = ?, meal_type = ?, diet_tags_json = ?, prep_minutes = ?, cook_minutes = ?,
          servings = ?, difficulty = ?, nutrition_json = ?, is_vip = ?, vip_gem_cost = ?,
          status = 'published', ingredients_json = ?, steps_json = ?, tools_json = ?
         WHERE id = ?`
      ).run(
        snap.title,
        snap.subtitle,
        snap.description,
        snap.imageUrl,
        snap.category,
        snap.region,
        snap.season,
        snap.mealType,
        JSON.stringify(snap.dietTags),
        snap.prepMinutes,
        snap.cookMinutes,
        snap.servings,
        snap.difficulty,
        JSON.stringify(snap.nutrition),
        snap.isVip ? 1 : 0,
        snap.isVip ? snap.vipGemCost : 0,
        JSON.stringify(snap.ingredients),
        JSON.stringify(snap.steps),
        JSON.stringify(snap.tools),
        req.params.id
      );

      db.prepare(
        "UPDATE recipe_versions SET status = 'archived' WHERE recipe_id = ? AND status = 'published' AND id != ?"
      ).run(req.params.id, req.params.versionId);

      db.prepare(
        `UPDATE recipe_versions
         SET status = 'published', reviewed_by_id = ?, reviewed_by_name = ?, review_note = ?, reviewed_at = ?
         WHERE id = ?`
      ).run(
        session.userId,
        session.actorName,
        parsed.data.reviewNote.trim() || 'تایید و انتشار نهایی پس از پیش‌نمایش',
        now,
        req.params.versionId
      );
    });
    runApprove();

    const updatedRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    const updatedVersion = db
      .prepare('SELECT * FROM recipe_versions WHERE id = ?')
      .get(req.params.versionId) as Record<string, unknown>;
    res.json({
      ok: true,
      recipe: mapRecipeRow(updatedRecipe),
      version: mapVersionRow(updatedVersion),
    });
  });

  app.post('/api/admin/recipes/:id/versions/:versionId/reject', (req, res) => {
    const session = requireAdmin(req, res, 'content.recipes');
    if (!session) return;

    const schema = z.object({reviewNote: z.string().max(240).optional().default('')});
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({error: 'یادداشت رد پیش‌نویس معتبر نیست.'});

    const versionRow = db
      .prepare('SELECT * FROM recipe_versions WHERE id = ? AND recipe_id = ?')
      .get(req.params.versionId, req.params.id) as Record<string, unknown> | undefined;
    if (!versionRow) return res.status(404).json({error: 'نسخه مورد نظر یافت نشد.'});
    if (String(versionRow.status) !== 'draft') {
      return res.status(400).json({error: 'تنها پیش‌نویس‌های در انتظار بررسی قابل رد کردن هستند.'});
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE recipe_versions
       SET status = 'rejected', reviewed_by_id = ?, reviewed_by_name = ?, review_note = ?, reviewed_at = ?
       WHERE id = ?`
    ).run(
      session.userId,
      session.actorName,
      parsed.data.reviewNote.trim() || 'نیاز به بازبینی بیشتر قبل از انتشار',
      now,
      req.params.versionId
    );

    const updated = db
      .prepare('SELECT * FROM recipe_versions WHERE id = ?')
      .get(req.params.versionId) as Record<string, unknown>;
    res.json({ok: true, version: mapVersionRow(updated)});
  });

  app.delete('/api/admin/recipes/:id', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;
    const runDelete = db.transaction(() => {
      db.prepare('DELETE FROM recipe_versions WHERE recipe_id = ?').run(req.params.id);
      db.prepare('DELETE FROM recipe_photos WHERE recipe_id = ?').run(req.params.id);
      db.prepare('DELETE FROM bookmarks WHERE recipe_id = ?').run(req.params.id);
      db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
    });
    runDelete();
    res.json({ok: true});
  });

  app.post('/api/admin/recipes/bulk-import', (req, res) => {
    if (!requireAdmin(req, res, 'content.recipes')) return;
    const bulkSchema = z.object({
      recipes: z.array(z.record(z.string(), z.unknown())).min(1).max(2000),
      defaultStatus: z.enum(['published', 'pending']).optional().default('published'),
    });
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'فهرست ورودی باید آرایه‌ای بین ۱ تا ۲۰۰۰ دستور پخت باشد.'});
    }

    const insertStmt = db.prepare(`
      INSERT INTO recipes (
        id, slug, title, subtitle, description, image_url, category, region, season, meal_type,
        diet_tags_json, prep_minutes, cook_minutes, servings, difficulty, nutrition_json,
        is_vip, vip_gem_cost, parent_recipe_id, variation_note, author_id, status,
        ingredients_json, steps_json, tools_json, linked_menu_dish_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 'chef-mahsa', ?, ?, ?, ?, NULL, ?)
    `);

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    const runTx = db.transaction((rawList: Record<string, unknown>[]) => {
      rawList.forEach((raw, idx) => {
        // Accept flexible bulk formats (ingredients as array or string list, steps as array of strings or objects)
        const title = typeof raw.title === 'string' ? raw.title.trim() : '';
        if (title.length < 2) {
          skippedCount++;
          if (errors.length < 15) errors.push(`ردیف ${idx + 1}: عنوان غذا معتبر نیست.`);
          return;
        }

        const rawIngs = Array.isArray(raw.ingredients) ? raw.ingredients : [];
        const ingredients = rawIngs
          .map((item) => {
            if (typeof item === 'string' && item.trim()) {
              return {name: item.trim(), amount: 1, unit: 'به مقدار لازم'};
            }
            if (item && typeof item === 'object' && typeof (item as {name?: unknown}).name === 'string') {
              const obj = item as {name: string; amount?: unknown; unit?: unknown};
              return {
                name: obj.name.trim(),
                amount: Number(obj.amount) > 0 ? Number(obj.amount) : 1,
                unit: typeof obj.unit === 'string' && obj.unit.trim() ? obj.unit.trim() : 'عدد',
              };
            }
            return null;
          })
          .filter(Boolean);

        const rawSteps = Array.isArray(raw.steps) ? raw.steps : [];
        const steps = rawSteps
          .map((st, sIdx) => {
            if (typeof st === 'string' && st.trim()) {
              return {order: sIdx + 1, instruction: st.trim()};
            }
            if (st && typeof st === 'object' && typeof (st as {instruction?: unknown}).instruction === 'string') {
              const obj = st as {order?: unknown; instruction: string; timerMinutes?: unknown};
              return {
                order: Number(obj.order) > 0 ? Number(obj.order) : sIdx + 1,
                instruction: obj.instruction.trim(),
                timerMinutes: Number(obj.timerMinutes) > 0 ? Number(obj.timerMinutes) : undefined,
              };
            }
            return null;
          })
          .filter(Boolean);

        if (ingredients.length === 0 || steps.length === 0) {
          skippedCount++;
          if (errors.length < 15) errors.push(`ردیف ${idx + 1} (${title}): مواد اولیه یا مراحل پخت خالی است.`);
          return;
        }

        const imgUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl.trim() : '';
        if (imgUrl && !isSafeUrl(imgUrl)) {
          skippedCount++;
          if (errors.length < 15) errors.push(`ردیف ${idx + 1} (${title}): آدرس تصویر مجاز نیست.`);
          return;
        }

        const category = typeof raw.category === 'string' && raw.category.trim() ? raw.category.trim() : 'ناهار و شام';
        const region = typeof raw.region === 'string' && raw.region.trim() ? raw.region.trim() : 'سراسری';
        const season = typeof raw.season === 'string' && raw.season.trim() ? raw.season.trim() : 'چهارفصل';
        const mealType = typeof raw.mealType === 'string' && raw.mealType.trim() ? raw.mealType.trim() : 'ناهار';
        const difficulty =
          raw.difficulty === 'آسان' || raw.difficulty === 'متوسط' || raw.difficulty === 'حرفه‌ای'
            ? raw.difficulty
            : 'متوسط';
        const dietTags = Array.isArray(raw.dietTags)
          ? raw.dietTags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 8)
          : ['سنتی'];
        const tools = Array.isArray(raw.tools)
          ? raw.tools.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).slice(0, 10)
          : [];

        const id = `rec-${crypto.randomUUID().slice(0, 8)}`;
        const slug = `bulk-${Date.now()}-${idx}-${crypto.randomBytes(2).toString('hex')}`;

        insertStmt.run(
          id,
          slug,
          title,
          typeof raw.subtitle === 'string' && raw.subtitle.trim() ? raw.subtitle.trim() : `${category} · ${region}`,
          typeof raw.description === 'string' && raw.description.trim()
            ? raw.description.trim()
            : `${title} — بارگذاری‌شده در آرشیو مرجع لاقلی (در انتظار ثبت عکس واقعی غذای پخته‌شده توسط کاربران).`,
          imgUrl,
          category,
          region,
          season,
          mealType,
          JSON.stringify(dietTags),
          Number(raw.prepMinutes) > 0 ? Math.min(600, Math.round(Number(raw.prepMinutes))) : 20,
          Number(raw.cookMinutes) > 0 ? Math.min(600, Math.round(Number(raw.cookMinutes))) : 40,
          Number(raw.servings) > 0 ? Math.min(50, Math.round(Number(raw.servings))) : 4,
          difficulty,
          JSON.stringify({
            calories: Number(raw.calories) > 0 ? Math.round(Number(raw.calories)) : 410,
            protein: Number(raw.protein) >= 0 ? Math.round(Number(raw.protein)) : 16,
            carbs: Number(raw.carbs) >= 0 ? Math.round(Number(raw.carbs)) : 44,
            fat: Number(raw.fat) >= 0 ? Math.round(Number(raw.fat)) : 15,
            fiber: Number(raw.fiber) >= 0 ? Math.round(Number(raw.fiber)) : 5,
          }),
          raw.isVip ? 1 : 0,
          raw.isVip && Number(raw.vipGemCost) > 0 ? Math.round(Number(raw.vipGemCost)) : 0,
          parsed.data.defaultStatus,
          JSON.stringify(ingredients),
          JSON.stringify(steps),
          JSON.stringify(tools),
          now
        );
        importedCount++;
      });
    });

    runTx(parsed.data.recipes);
    res.status(201).json({importedCount, skippedCount, errors});
  });

  // =========================================================================
  // ADMIN COMMUNITY PHOTO MODERATION & COVER PROMOTION
  // =========================================================================
  app.get('/api/admin/photos', (req, res) => {
    if (!requireAdmin(req, res, 'content.photos')) return;
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
    const rows = (
      statusFilter === 'pending' || statusFilter === 'approved' || statusFilter === 'rejected'
        ? db
            .prepare(
              `SELECT rp.*, r.title AS recipe_title, r.image_url AS recipe_image_url
               FROM recipe_photos rp
               LEFT JOIN recipes r ON r.id = rp.recipe_id
               WHERE rp.status = ?
               ORDER BY rp.created_at DESC`
            )
            .all(statusFilter)
        : db
            .prepare(
              `SELECT rp.*, r.title AS recipe_title, r.image_url AS recipe_image_url
               FROM recipe_photos rp
               LEFT JOIN recipes r ON r.id = rp.recipe_id
               ORDER BY CASE rp.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, rp.created_at DESC`
            )
            .all()
    ) as Record<string, unknown>[];
    res.json({photos: rows.map(mapPhotoRow)});
  });

  app.post('/api/admin/photos/:id/moderate', (req, res) => {
    if (!requireAdmin(req, res, 'content.photos')) return;
    const schema = z.object({action: z.enum(['approve', 'approve_cover', 'reject'])});
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'عملیات بررسی عکس نامعتبر است.'});

    const photo = db.prepare('SELECT * FROM recipe_photos WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!photo) return res.status(404).json({error: 'عکس مورد نظر یافت نشد.'});

    const recipe = db.prepare('SELECT id, title, image_url FROM recipes WHERE id = ?').get(String(photo.recipe_id)) as
      | {id: string; title: string; image_url: string}
      | undefined;
    const wasPending = String(photo.status) === 'pending';
    const recipeHadNoCover = !recipe?.image_url || recipe.image_url.trim().length === 0;

    const runModeration = db.transaction(() => {
      if (parsed.data.action === 'reject') {
        db.prepare("UPDATE recipe_photos SET status = 'rejected', is_cover = 0 WHERE id = ?").run(req.params.id);
        return;
      }

      const isCover = parsed.data.action === 'approve_cover' ? 1 : Number(photo.is_cover);
      if (parsed.data.action === 'approve_cover' && recipe) {
        db.prepare('UPDATE recipe_photos SET is_cover = 0 WHERE recipe_id = ?').run(recipe.id);
        db.prepare('UPDATE recipes SET image_url = ?, photo_credit_name = ? WHERE id = ?').run(
          String(photo.image_url),
          String(photo.user_name),
          recipe.id
        );
      }

      db.prepare("UPDATE recipe_photos SET status = 'approved', is_cover = ? WHERE id = ?").run(isCover, req.params.id);

      // Award user Gems & XP once when approving from pending
      if (wasPending) {
        const gemReward = parsed.data.action === 'approve_cover' && recipeHadNoCover ? 40 : 20;
        const xpReward = parsed.data.action === 'approve_cover' && recipeHadNoCover ? 45 : 25;
        const reason =
          parsed.data.action === 'approve_cover' && recipeHadNoCover
            ? `پاداش ثبت اولین عکس واقعی برای «${recipe?.title || 'دستور پخت'}»`
            : `تایید عکس واقعی ارسالی برای «${recipe?.title || 'دستور پخت'}»`;
        awardXpAndGems(String(photo.user_id), xpReward, gemReward, reason);
      }
    });

    runModeration();
    res.json({ok: true});
  });

  app.delete('/api/admin/photos/:id', (req, res) => {
    if (!requireAdmin(req, res, 'content.photos')) return;
    db.prepare('DELETE FROM recipe_photos WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  // =========================================================================
  // ADMIN USERS MANAGEMENT, RBAC ROLE ASSIGNMENT & USER WALLET TOP-UP
  // =========================================================================
  app.get('/api/admin/users', (req, res) => {
    if (!requireAdmin(req, res, 'users.view')) return;
    const rows = db
      .prepare(
        `SELECT u.*,
          (SELECT COUNT(*) FROM recipes r WHERE r.author_id = u.id) AS recipes_count,
          (SELECT COUNT(*) FROM recipe_photos rp WHERE rp.user_id = u.id) AS photos_count
         FROM users u
         ORDER BY u.created_at DESC`
      )
      .all() as Record<string, unknown>[];

    const users: AdminUserRow[] = rows.map((u) => ({
      id: String(u.id),
      phone: String(u.phone),
      name: String(u.name),
      city: String(u.city),
      neighborhood: String(u.neighborhood),
      specialty: String(u.specialty || ''),
      role: u.role as AdminUserRow['role'],
      isVerifiedChef: Number(u.is_verified_chef) === 1,
      chefVerificationStatus: u.chef_verification_status as AdminUserRow['chefVerificationStatus'],
      xp: Number(u.xp || 0),
      gems: Number(u.gems || 0),
      walletBalance: Number(u.wallet_balance || 0),
      isSuspended: Number(u.is_suspended || 0) === 1,
      recipesCount: Number(u.recipes_count || 0),
      photosCount: Number(u.photos_count || 0),
      createdAt: String(u.created_at),
    }));
    res.json({users});
  });

  app.patch('/api/admin/users/:id', (req, res) => {
    const schema = z.object({
      role: z.string().min(2).max(48).optional(),
      roleNote: z.string().max(180).optional(),
      isVerifiedChef: z.boolean().optional(),
      isSuspended: z.boolean().optional(),
      name: z.string().min(2).max(80).optional(),
      city: z.string().min(2).max(50).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات ویرایش کاربر معتبر نیست.'});

    const d = parsed.data;
    if (d.role !== undefined) {
      const validRoles = new Set(['user', 'chef', 'partner', 'admin', ...getAclRoles().map((r) => r.id)]);
      if (!validRoles.has(d.role)) {
        return res.status(400).json({error: 'نقش انتخاب‌شده در ماتریس دسترسی تعریف نشده است.'});
      }
    }
    const requiredPerm: AdminPermission = d.role !== undefined ? 'rbac.manage' : 'users.manage';
    const session = requireAdmin(req, res, requiredPerm);
    if (!session) return;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!user) return res.status(404).json({error: 'کاربر یافت نشد.'});

    if (session.userId === req.params.id && (d.isSuspended === true || (d.role && d.role !== 'senior_admin' && d.role !== 'admin'))) {
      return res.status(400).json({error: 'امکان کاهش سطح دسترسی یا مسدودسازی حساب فعلی خودتان وجود ندارد.'});
    }

    const prevRole = String(user.role) as UserRole;
    const nextRole = (d.role === 'admin' ? 'senior_admin' : d.role ?? prevRole) as UserRole;
    const nextVerified = d.isVerifiedChef !== undefined ? (d.isVerifiedChef ? 1 : 0) : Number(user.is_verified_chef);
    const nextChefStatus =
      d.isVerifiedChef !== undefined
        ? d.isVerifiedChef
          ? 'approved'
          : 'none'
        : String(user.chef_verification_status);
    const nextSuspended = d.isSuspended !== undefined ? (d.isSuspended ? 1 : 0) : Number(user.is_suspended || 0);

    const runUpdate = db.transaction(() => {
      db.prepare(
        `UPDATE users SET role = ?, is_verified_chef = ?, chef_verification_status = ?, is_suspended = ?, name = ?, city = ?
         WHERE id = ?`
      ).run(
        nextRole,
        nextVerified,
        nextChefStatus,
        nextSuspended,
        d.name?.trim() || String(user.name),
        d.city?.trim() || String(user.city),
        req.params.id
      );

      if (d.role !== undefined && prevRole !== nextRole) {
        db.prepare(
          `INSERT INTO rbac_audit_logs (
            id, actor_id, actor_name, actor_role, target_user_id, target_user_name,
            previous_role, new_role, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          `rbac-${crypto.randomUUID().slice(0, 8)}`,
          session.userId,
          session.actorName,
          session.adminRole || 'senior_admin',
          String(user.id),
          String(user.name),
          prevRole,
          nextRole,
          d.roleNote?.trim() || 'تغییر سطح دسترسی توسط مدیر ارشد',
          new Date().toISOString()
        );
      }
    });
    runUpdate();

    res.json({ok: true});
  });

  app.get('/api/admin/rbac/audit', (req, res) => {
    if (!requireAdmin(req, res, 'rbac.manage')) return;
    const rows = db
      .prepare('SELECT * FROM rbac_audit_logs ORDER BY created_at DESC LIMIT 60')
      .all() as Record<string, unknown>[];
    const logs: RbacAuditLog[] = rows.map((r) => ({
      id: String(r.id),
      actorId: String(r.actor_id),
      actorName: String(r.actor_name),
      actorRole: r.actor_role as AdminRole,
      targetUserId: String(r.target_user_id),
      targetUserName: String(r.target_user_name),
      previousRole: r.previous_role as UserRole,
      newRole: r.new_role as UserRole,
      note: String(r.note || ''),
      createdAt: String(r.created_at),
    }));
    res.json({logs});
  });

  app.post('/api/admin/rbac/assign', (req, res) => {
    const session = requireAdmin(req, res, 'rbac.manage');
    if (!session) return;

    const schema = z.object({
      userId: z.string().min(2).max(80),
      role: z.string().min(2).max(48),
      note: z.string().max(180).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'کاربر یا نقش انتخاب‌شده معتبر نیست.'});

    const {userId, role, note} = parsed.data;
    const validRoles = new Set(['user', 'chef', 'partner', ...getAclRoles().map((r) => r.id)]);
    if (!validRoles.has(role)) {
      return res.status(400).json({error: 'نقش انتخاب‌شده در ماتریس دسترسی تعریف نشده است.'});
    }

    if (session.userId === userId && role !== 'senior_admin') {
      return res.status(400).json({error: 'مدیر ارشد نمی‌تواند نقش فعلی خود را تنزل دهد.'});
    }

    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as
      | {id: string; name: string; role: string}
      | undefined;
    if (!user) return res.status(404).json({error: 'کاربر مورد نظر یافت نشد.'});

    const prevRole = user.role as UserRole;
    if (prevRole === role) {
      return res.json({ok: true, unchanged: true});
    }

    const now = new Date().toISOString();
    const runAssign = db.transaction(() => {
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
      db.prepare(
        `INSERT INTO rbac_audit_logs (
          id, actor_id, actor_name, actor_role, target_user_id, target_user_name,
          previous_role, new_role, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `rbac-${crypto.randomUUID().slice(0, 8)}`,
        session.userId,
        session.actorName,
        session.adminRole || 'senior_admin',
        user.id,
        user.name,
        prevRole,
        role,
        note.trim() || 'تخصیص نقش از کنسول سطوح دسترسی پویا',
        now
      );
    });
    runAssign();
    res.json({ok: true});
  });

  // =========================================================================
  // DYNAMIC ACL ROLE & PERMISSION MATRIX CRUD
  // =========================================================================
  const allowedPermSet = new Set<string>(ALL_ADMIN_PERMISSIONS);

  app.get('/api/admin/acl/roles', (req, res) => {
    if (!requireAdmin(req, res, 'dashboard.view')) return;
    res.json({roles: getAclRoles()});
  });

  app.post('/api/admin/acl/roles', (req, res) => {
    const session = requireAdmin(req, res, 'rbac.manage');
    if (!session) return;

    const schema = z.object({
      id: z
        .string()
        .min(3)
        .max(36)
        .regex(/^[a-z][a-z0-9_]*$/, 'شناسه نقش باید با حروف کوچک لاتین و زیرخط باشد.'),
      label: z.string().min(2).max(60),
      shortLabel: z.string().min(2).max(28).optional(),
      description: z.string().max(220).optional().default(''),
      permissions: z.array(z.string()).min(1).max(30),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'مشخصات نقش جدید معتبر نیست.'});
    }

    const d = parsed.data;
    if (['user', 'chef', 'partner', 'admin'].includes(d.id)) {
      return res.status(400).json({error: 'این شناسه سیستمی رزرو شده است.'});
    }
    const exists = db.prepare('SELECT 1 FROM acl_roles WHERE id = ?').get(d.id);
    if (exists) {
      return res.status(409).json({error: 'نقشی با این شناسه از قبل وجود دارد.'});
    }

    const cleanPerms = Array.from(
      new Set<string>(['dashboard.view', ...d.permissions.filter((p) => allowedPermSet.has(p))])
    );
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO acl_roles (id, label, short_label, description, permissions_json, is_system, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(d.id, d.label.trim(), (d.shortLabel || d.label).trim(), d.description.trim(), JSON.stringify(cleanPerms), now, now);

    db.prepare(
      `INSERT INTO rbac_audit_logs (
        id, actor_id, actor_name, actor_role, target_user_id, target_user_name,
        previous_role, new_role, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `rbac-${crypto.randomUUID().slice(0, 8)}`,
      session.userId,
      session.actorName,
      session.adminRole || 'senior_admin',
      `role:${d.id}`,
      `نقش «${d.label.trim()}»`,
      'new_role',
      d.id,
      `ایجاد نقش سفارشی با ${cleanPerms.length} مجوز`,
      now
    );

    res.status(201).json({roles: getAclRoles()});
  });

  app.put('/api/admin/acl/roles/:id', (req, res) => {
    const session = requireAdmin(req, res, 'rbac.manage');
    if (!session) return;

    const existing = db.prepare('SELECT * FROM acl_roles WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'نقش مورد نظر یافت نشد.'});

    const schema = z.object({
      label: z.string().min(2).max(60).optional(),
      shortLabel: z.string().min(2).max(28).optional(),
      description: z.string().max(220).optional(),
      permissions: z.array(z.string()).max(30),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات ویرایش مجوزها معتبر نیست.'});

    const cleanPerms = new Set<string>(['dashboard.view', ...parsed.data.permissions.filter((p) => allowedPermSet.has(p))]);
    if (req.params.id === 'senior_admin') {
      cleanPerms.add('rbac.manage');
      cleanPerms.add('app.layout');
      cleanPerms.add('ecosystem.manage');
      cleanPerms.add('finance.reports');
    }

    const now = new Date().toISOString();
    const nextLabel = parsed.data.label?.trim() || String(existing.label);
    const nextShort = parsed.data.shortLabel?.trim() || String(existing.short_label);
    const nextDesc = parsed.data.description !== undefined ? parsed.data.description.trim() : String(existing.description);

    db.prepare(
      `UPDATE acl_roles SET label = ?, short_label = ?, description = ?, permissions_json = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextLabel, nextShort, nextDesc, JSON.stringify(Array.from(cleanPerms)), now, req.params.id);

    db.prepare(
      `INSERT INTO rbac_audit_logs (
        id, actor_id, actor_name, actor_role, target_user_id, target_user_name,
        previous_role, new_role, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `rbac-${crypto.randomUUID().slice(0, 8)}`,
      session.userId,
      session.actorName,
      session.adminRole || 'senior_admin',
      `role:${req.params.id}`,
      `ماتریس نقش «${nextLabel}»`,
      req.params.id,
      req.params.id,
      `بروزرسانی ماتریس مجوزها (${cleanPerms.size} مجوز فعال)`,
      now
    );

    res.json({roles: getAclRoles()});
  });

  app.delete('/api/admin/acl/roles/:id', (req, res) => {
    const session = requireAdmin(req, res, 'rbac.manage');
    if (!session) return;

    const existing = db.prepare('SELECT * FROM acl_roles WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'نقش مورد نظر یافت نشد.'});
    if (Number(existing.is_system) === 1) {
      return res.status(400).json({error: 'نقش‌های پایه سیستم قابل حذف نیستند؛ فقط مجوزهای آن‌ها را ویرایش کنید.'});
    }

    const now = new Date().toISOString();
    db.transaction(() => {
      db.prepare("UPDATE users SET role = 'user' WHERE role = ?").run(req.params.id);
      db.prepare('DELETE FROM acl_roles WHERE id = ?').run(req.params.id);
      db.prepare(
        `INSERT INTO rbac_audit_logs (
          id, actor_id, actor_name, actor_role, target_user_id, target_user_name,
          previous_role, new_role, note, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        `rbac-${crypto.randomUUID().slice(0, 8)}`,
        session.userId,
        session.actorName,
        session.adminRole || 'senior_admin',
        `role:${req.params.id}`,
        `حذف نقش «${String(existing.label)}»`,
        req.params.id,
        'user',
        'حذف نقش سفارشی و بازگرداندن اعضا به کاربر عادی',
        now
      );
    })();
    res.json({roles: getAclRoles()});
  });

  // =========================================================================
  // NATIVE MULTI-FORMAT AD STUDIO CRUD (TEXT / CLICK / EDITORIAL BANNER / PANTRY)
  // =========================================================================
  const nativeAdSchema = z.object({
    partnerId: z.string().min(2).max(80),
    format: z.enum(['inline_ingredient', 'contextual_tool', 'feed_editorial_story', 'pantry_companion']),
    title: z.string().min(3).max(120),
    subtitle: z.string().max(160).optional().default(''),
    editorialCopy: z.string().max(320).optional().default(''),
    ctaLabel: z.string().min(2).max(40).optional().default('آشنایی با برند'),
    targetUrl: z.string().max(300).optional().nullable(),
    matchKeywords: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
    matchCategories: z.array(z.string().min(1).max(60)).max(12).optional().default([]),
    priority: z.number().int().min(1).max(10).optional().default(5),
    status: z.enum(['active', 'paused']).optional().default('active'),
  });

  app.get('/api/admin/native-ads', (req, res) => {
    if (!requireAdmin(req, res, 'ads.manage')) return;
    res.json({nativeAds: getNativeAds(false)});
  });

  app.post('/api/admin/native-ads', (req, res) => {
    if (!requireAdmin(req, res, 'ads.manage')) return;
    const parsed = nativeAdSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات واحد تبلیغاتی بومی معتبر نیست.'});
    const d = parsed.data;
    if (d.targetUrl && !isSafeUrl(d.targetUrl)) {
      return res.status(400).json({error: 'نشانی مقصد تبلیغ باید یک پیوند معتبر وب باشد.'});
    }

    const id = `nad-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO native_ads (
        id, partner_id, format, title, subtitle, editorial_copy, cta_label, target_url,
        match_keywords_json, match_categories_json, priority, status, impressions, clicks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
    ).run(
      id,
      d.partnerId,
      d.format,
      d.title.trim(),
      d.subtitle.trim(),
      d.editorialCopy.trim(),
      d.ctaLabel.trim(),
      d.targetUrl?.trim() || null,
      JSON.stringify(d.matchKeywords.map((k) => k.trim()).filter(Boolean)),
      JSON.stringify(d.matchCategories),
      d.priority,
      d.status,
      now
    );

    const row = db
      .prepare('SELECT na.*, p.name AS partner_name FROM native_ads na LEFT JOIN partners p ON p.id = na.partner_id WHERE na.id = ?')
      .get(id) as Record<string, unknown>;
    res.status(201).json({nativeAd: mapNativeAdRow(row)});
  });

  app.put('/api/admin/native-ads/:id', (req, res) => {
    if (!requireAdmin(req, res, 'ads.manage')) return;
    const existing = db.prepare('SELECT * FROM native_ads WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'واحد تبلیغاتی یافت نشد.'});

    const parsed = nativeAdSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات ویرایش تبلیغ معتبر نیست.'});
    const d = parsed.data;
    if (d.targetUrl && !isSafeUrl(d.targetUrl)) {
      return res.status(400).json({error: 'نشانی مقصد تبلیغ معتبر نیست.'});
    }

    db.prepare(
      `UPDATE native_ads SET
        partner_id = ?, format = ?, title = ?, subtitle = ?, editorial_copy = ?,
        cta_label = ?, target_url = ?, match_keywords_json = ?, match_categories_json = ?,
        priority = ?, status = ?
       WHERE id = ?`
    ).run(
      d.partnerId ?? String(existing.partner_id),
      d.format ?? String(existing.format),
      d.title?.trim() ?? String(existing.title),
      d.subtitle !== undefined ? d.subtitle.trim() : String(existing.subtitle || ''),
      d.editorialCopy !== undefined ? d.editorialCopy.trim() : String(existing.editorial_copy || ''),
      d.ctaLabel?.trim() ?? String(existing.cta_label || 'آشنایی با برند'),
      d.targetUrl !== undefined ? d.targetUrl?.trim() || null : existing.target_url,
      d.matchKeywords !== undefined
        ? JSON.stringify(d.matchKeywords.map((k) => k.trim()).filter(Boolean))
        : String(existing.match_keywords_json || '[]'),
      d.matchCategories !== undefined
        ? JSON.stringify(d.matchCategories)
        : String(existing.match_categories_json || '[]'),
      d.priority ?? Number(existing.priority || 5),
      d.status ?? String(existing.status),
      req.params.id
    );

    const row = db
      .prepare('SELECT na.*, p.name AS partner_name FROM native_ads na LEFT JOIN partners p ON p.id = na.partner_id WHERE na.id = ?')
      .get(req.params.id) as Record<string, unknown>;
    res.json({nativeAd: mapNativeAdRow(row)});
  });

  app.delete('/api/admin/native-ads/:id', (req, res) => {
    if (!requireAdmin(req, res, 'ads.manage')) return;
    db.prepare('DELETE FROM native_ads WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  app.post('/api/admin/users/:id/wallet', (req, res) => {
    const session = requireAdmin(req, res, 'finance.wallets');
    if (!session) return;
    const schema = z.object({
      currency: z.enum(['toman', 'gem']),
      amount: z.number().int().refine((n) => n !== 0, 'مبلغ نمی‌تواند صفر باشد'),
      reason: z.string().min(3).max(160),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'مبلغ و توضیح تراکنش را به‌درستی وارد کنید.'});

    const user = db.prepare('SELECT id, name, wallet_balance, gems FROM users WHERE id = ?').get(req.params.id) as
      | {id: string; name: string; wallet_balance: number; gems: number}
      | undefined;
    if (!user) return res.status(404).json({error: 'کاربر مورد نظر یافت نشد.'});

    const {currency, amount, reason} = parsed.data;
    const current = currency === 'toman' ? Number(user.wallet_balance || 0) : Number(user.gems || 0);
    const nextBalance = current + amount;
    if (nextBalance < 0) {
      return res.status(400).json({error: 'موجودی حساب پس از کسر نمی‌تواند منفی شود.'});
    }

    const now = new Date().toISOString();
    const txId = `wtx-${crypto.randomUUID().slice(0, 8)}`;

    const runTx = db.transaction(() => {
      if (currency === 'toman') {
        db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(nextBalance, user.id);
      } else {
        db.prepare('UPDATE users SET gems = ? WHERE id = ?').run(nextBalance, user.id);
        db.prepare('INSERT INTO gem_transactions (id, user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)').run(
          `gtx-${crypto.randomUUID().slice(0, 8)}`,
          user.id,
          amount,
          `[مدیریت] ${reason.trim()}`,
          now
        );
      }
      db.prepare(
        `INSERT INTO wallet_transactions (id, account_type, account_id, account_name, currency, amount, balance_after, reason, created_by, created_at)
         VALUES (?, 'user', ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(txId, user.id, user.name, currency, amount, nextBalance, reason.trim(), session.actorName, now);
    });

    runTx();
    res.json({ok: true, balanceAfter: nextBalance});
  });

  // =========================================================================
  // ADMIN PARTNERS & COMMERCIAL ACCOUNT WALLET TOP-UP
  // =========================================================================
  app.get('/api/admin/partners', (req, res) => {
    if (!requireAdmin(req, res, 'finance.partners')) return;
    const rows = db.prepare('SELECT * FROM partners ORDER BY created_at DESC').all() as Record<string, unknown>[];
    res.json({partners: rows.map((r) => mapPartnerRow(r))});
  });

  app.post('/api/admin/partners', (req, res) => {
    const session = requireAdmin(req, res, 'finance.partners');
    if (!session) return;
    const schema = z.object({
      name: z.string().min(2).max(120),
      roleType: z.string().min(2).max(50),
      city: z.string().min(2).max(50),
      neighborhood: z.string().max(60).optional().default('مرکزی'),
      description: z.string().min(5).max(500),
      address: z.string().min(3).max(200),
      phone: z.string().min(5).max(30),
      website: z.string().max(200).optional().default(''),
      tier: z.enum(['free', 'featured', 'sponsor']).optional().default('free'),
      verified: z.boolean().optional().default(true),
      promoCode: z.string().max(30).optional().default(''),
      promoLabel: z.string().max(120).optional().default(''),
      initialBalance: z.number().int().min(0).max(500000000).optional().default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات کسب‌وکار همکار را کامل وارد کنید.'});
    if (parsed.data.website && !isSafeUrl(parsed.data.website)) {
      return res.status(400).json({error: 'آدرس وب‌سایت معتبر نیست.'});
    }

    const d = parsed.data;
    const id = `prt-${crypto.randomUUID().slice(0, 8)}`;
    const slug = `partner-${Date.now()}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO partners (
        id, slug, name, role_type, city, neighborhood, description, address, phone, website,
        verified, claim_status, tier, business_balance, promo_code, promo_label, affiliate_code,
        related_ingredients_json, related_tools_json, catalog_json, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?, ?, ?, ?, '[]', '[]', '[]', 'approved', ?)`
    ).run(
      id,
      slug,
      d.name.trim(),
      d.roleType as PartnerRoleId,
      d.city.trim(),
      d.neighborhood.trim(),
      d.description.trim(),
      d.address.trim(),
      d.phone.trim(),
      d.website.trim(),
      d.verified ? 1 : 0,
      d.tier,
      d.initialBalance,
      d.promoCode.trim() || null,
      d.promoLabel.trim() || null,
      `AFF-${id.slice(4, 8).toUpperCase()}`,
      now
    );

    if (d.initialBalance > 0) {
      db.prepare(
        `INSERT INTO wallet_transactions (id, account_type, account_id, account_name, currency, amount, balance_after, reason, created_by, created_at)
         VALUES (?, 'partner', ?, ?, 'toman', ?, ?, 'شارژ اولیه حساب تجاری هنگام ثبت', ?, ?)`
      ).run(`wtx-${crypto.randomUUID().slice(0, 8)}`, id, d.name.trim(), d.initialBalance, d.initialBalance, session.actorName, now);
    }

    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({partner: mapPartnerRow(row)});
  });

  app.put('/api/admin/partners/:id', (req, res) => {
    if (!requireAdmin(req, res, 'finance.partners')) return;
    const existing = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'کسب‌وکار همکار یافت نشد.'});

    const schema = z.object({
      tier: z.enum(['free', 'featured', 'sponsor']).optional(),
      verified: z.boolean().optional(),
      status: z.enum(['approved', 'pending']).optional(),
      promoCode: z.string().max(30).optional(),
      promoLabel: z.string().max(120).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'ورودی ویرایش همکار معتبر نیست.'});
    const d = parsed.data;

    db.prepare(
      `UPDATE partners SET tier = ?, verified = ?, status = ?, claim_status = ?, promo_code = ?, promo_label = ?
       WHERE id = ?`
    ).run(
      d.tier ?? String(existing.tier),
      d.verified !== undefined ? (d.verified ? 1 : 0) : Number(existing.verified),
      d.status ?? String(existing.status),
      d.status === 'approved' ? 'verified' : String(existing.claim_status),
      d.promoCode !== undefined ? d.promoCode.trim() || null : existing.promo_code,
      d.promoLabel !== undefined ? d.promoLabel.trim() || null : existing.promo_label,
      req.params.id
    );

    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({partner: mapPartnerRow(row)});
  });

  app.post('/api/admin/partners/:id/wallet', (req, res) => {
    const session = requireAdmin(req, res, 'finance.wallets');
    if (!session) return;
    const schema = z.object({
      amount: z.number().int().refine((n) => n !== 0, 'مبلغ نمی‌تواند صفر باشد'),
      reason: z.string().min(3).max(160),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'مبلغ (تومان) و شرح شارژ تجاری را وارد کنید.'});

    const partner = db.prepare('SELECT id, name, business_balance FROM partners WHERE id = ?').get(req.params.id) as
      | {id: string; name: string; business_balance: number}
      | undefined;
    if (!partner) return res.status(404).json({error: 'حساب تجاری مورد نظر یافت نشد.'});

    const nextBalance = Number(partner.business_balance || 0) + parsed.data.amount;
    if (nextBalance < 0) {
      return res.status(400).json({error: 'موجودی حساب تجاری پس از کسر نمی‌تواند منفی شود.'});
    }

    const now = new Date().toISOString();
    const runTx = db.transaction(() => {
      db.prepare('UPDATE partners SET business_balance = ? WHERE id = ?').run(nextBalance, partner.id);
      db.prepare(
        `INSERT INTO wallet_transactions (id, account_type, account_id, account_name, currency, amount, balance_after, reason, created_by, created_at)
         VALUES (?, 'partner', ?, ?, 'toman', ?, ?, ?, ?, ?)`
      ).run(
        `wtx-${crypto.randomUUID().slice(0, 8)}`,
        partner.id,
        partner.name,
        parsed.data.amount,
        nextBalance,
        parsed.data.reason.trim(),
        session.actorName,
        now
      );
    });
    runTx();
    res.json({ok: true, balanceAfter: nextBalance});
  });

  // =========================================================================
  // ADMIN SPONSORS & ADS CAMPAIGNS MANAGER
  // =========================================================================
  app.get('/api/admin/campaigns', (req, res) => {
    if (!requireAdmin(req, res, 'finance.campaigns')) return;
    const rows = db
      .prepare(
        `SELECT sc.*, p.name AS partner_name
         FROM sponsor_campaigns sc
         LEFT JOIN partners p ON p.id = sc.partner_id
         ORDER BY sc.created_at DESC`
      )
      .all() as Record<string, unknown>[];
    res.json({campaigns: rows.map(mapCampaignRow)});
  });

  const campaignSchema = z.object({
    partnerId: z.string().min(2),
    title: z.string().min(3).max(140),
    subtitle: z.string().max(240).optional().default(''),
    placement: z.enum(['explore_showcase', 'recipe_context', 'shopping_delivery', 'marketplace_banner']),
    promoCode: z.string().max(30).optional().default(''),
    ctaLabel: z.string().min(2).max(50).optional().default('مشاهده پیشنهاد'),
    budgetToman: z.number().int().min(0).max(1000000000),
    status: z.enum(['active', 'paused', 'ended']).optional().default('active'),
    startsAt: z.string().max(30).optional().default(''),
    endsAt: z.string().max(30).optional().default(''),
  });

  app.post('/api/admin/campaigns', (req, res) => {
    if (!requireAdmin(req, res, 'finance.campaigns')) return;
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات کمپین اسپانسری کامل نیست.'});
    const d = parsed.data;
    const partner = db.prepare('SELECT id, name FROM partners WHERE id = ?').get(d.partnerId) as
      | {id: string; name: string}
      | undefined;
    if (!partner) return res.status(404).json({error: 'اسپانسر انتخاب‌شده یافت نشد.'});

    const id = `camp-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO sponsor_campaigns (
        id, partner_id, title, subtitle, placement, promo_code, cta_label,
        budget_toman, spent_toman, impressions, clicks, status, starts_at, ends_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)`
    ).run(
      id,
      d.partnerId,
      d.title.trim(),
      d.subtitle.trim(),
      d.placement,
      d.promoCode.trim() || null,
      d.ctaLabel.trim(),
      d.budgetToman,
      d.status,
      d.startsAt.trim() || null,
      d.endsAt.trim() || null,
      now
    );

    const row = db
      .prepare(
        `SELECT sc.*, p.name AS partner_name FROM sponsor_campaigns sc LEFT JOIN partners p ON p.id = sc.partner_id WHERE sc.id = ?`
      )
      .get(id) as Record<string, unknown>;
    res.status(201).json({campaign: mapCampaignRow(row)});
  });

  app.put('/api/admin/campaigns/:id', (req, res) => {
    if (!requireAdmin(req, res, 'finance.campaigns')) return;
    const existing = db.prepare('SELECT * FROM sponsor_campaigns WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'کمپین یافت نشد.'});

    const schema = campaignSchema.partial();
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات ویرایش کمپین معتبر نیست.'});
    const d = parsed.data;

    db.prepare(
      `UPDATE sponsor_campaigns SET
        partner_id = ?, title = ?, subtitle = ?, placement = ?, promo_code = ?,
        cta_label = ?, budget_toman = ?, status = ?, starts_at = ?, ends_at = ?
       WHERE id = ?`
    ).run(
      d.partnerId ?? String(existing.partner_id),
      d.title?.trim() ?? String(existing.title),
      d.subtitle !== undefined ? d.subtitle.trim() : String(existing.subtitle || ''),
      d.placement ?? String(existing.placement),
      d.promoCode !== undefined ? d.promoCode.trim() || null : existing.promo_code,
      d.ctaLabel?.trim() ?? String(existing.cta_label || 'مشاهده پیشنهاد'),
      d.budgetToman ?? Number(existing.budget_toman || 0),
      d.status ?? String(existing.status),
      d.startsAt !== undefined ? d.startsAt.trim() || null : existing.starts_at,
      d.endsAt !== undefined ? d.endsAt.trim() || null : existing.ends_at,
      req.params.id
    );

    const row = db
      .prepare(
        `SELECT sc.*, p.name AS partner_name FROM sponsor_campaigns sc LEFT JOIN partners p ON p.id = sc.partner_id WHERE sc.id = ?`
      )
      .get(req.params.id) as Record<string, unknown>;
    res.json({campaign: mapCampaignRow(row)});
  });

  app.delete('/api/admin/campaigns/:id', (req, res) => {
    if (!requireAdmin(req, res, 'finance.campaigns')) return;
    db.prepare('DELETE FROM sponsor_campaigns WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  // =========================================================================
  // ADMIN FINANCIAL LEDGER & DAILY FOOD ORDERS
  // =========================================================================
  app.get('/api/admin/transactions', (req, res) => {
    const session = requireAdmin(req, res, 'dashboard.view');
    if (!session) return;
    const dynamicRoles = getAclRoles();
    const canViewFinance =
      hasAdminPermission(session.adminRole, 'finance.reports', dynamicRoles) ||
      hasAdminPermission(session.adminRole, 'finance.wallets', dynamicRoles);
    if (!canViewFinance) {
      return res.status(403).json({
        error: 'دسترسی به گزارش‌گیری مالی و دفتر کل تراکنش‌ها برای نقش شما مجاز نیست.',
      });
    }
    const rows = db
      .prepare('SELECT * FROM wallet_transactions ORDER BY created_at DESC LIMIT 100')
      .all() as Record<string, unknown>[];
    const transactions: WalletTransaction[] = rows.map((r) => ({
      id: String(r.id),
      accountType: r.account_type as WalletTransaction['accountType'],
      accountId: String(r.account_id),
      accountName: String(r.account_name),
      currency: r.currency as WalletTransaction['currency'],
      amount: Number(r.amount),
      balanceAfter: Number(r.balance_after),
      reason: String(r.reason),
      createdBy: String(r.created_by),
      createdAt: String(r.created_at),
    }));
    res.json({transactions});
  });

  app.get('/api/admin/financial-reports/summary', (req, res) => {
    if (!requireAdmin(req, res, 'finance.reports')) return;
    const partnerWalletTotal = Number(
      (db.prepare('SELECT COALESCE(SUM(business_balance), 0) as s FROM partners').get() as {s: number}).s || 0
    );
    const userWalletTotal = Number(
      (db.prepare('SELECT COALESCE(SUM(wallet_balance), 0) as s FROM users').get() as {s: number}).s || 0
    );
    const approvedBidsTotal = Number(
      (
        db
          .prepare("SELECT COALESCE(SUM(bid_amount_toman), 0) as s FROM ad_bids WHERE status = 'approved'")
          .get() as {s: number}
      ).s || 0
    );
    const pendingBidsTotal = Number(
      (
        db
          .prepare("SELECT COALESCE(SUM(bid_amount_toman), 0) as s FROM ad_bids WHERE status = 'pending'")
          .get() as {s: number}
      ).s || 0
    );
    const activeCampaignBudgetTotal = Number(
      (
        db
          .prepare("SELECT COALESCE(SUM(budget_toman), 0) as s FROM sponsor_campaigns WHERE status = 'active'")
          .get() as {s: number}
      ).s || 0
    );
    const transactionsCount = Number(
      (db.prepare('SELECT COUNT(*) as c FROM wallet_transactions').get() as {c: number}).c || 0
    );
    res.json({
      generatedAt: new Date().toISOString(),
      partnerWalletTotalToman: partnerWalletTotal,
      userWalletTotalToman: userWalletTotal,
      approvedAdBidsRevenueToman: approvedBidsTotal,
      pendingAuctionBidsVolumeToman: pendingBidsTotal,
      activeCampaignBudgetToman: activeCampaignBudgetTotal,
      transactionsCount,
    });
  });

  app.get('/api/admin/orders', (req, res) => {
    if (!requireAdmin(req, res, 'finance.orders')) return;
    const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100').all() as Record<
      string,
      unknown
    >[];
    const orders = rows.map((r) => ({
      id: String(r.id),
      trackingCode: String(r.tracking_code),
      city: String(r.city),
      neighborhood: String(r.neighborhood),
      address: String(r.address),
      phone: String(r.phone),
      deliverySlot: String(r.delivery_slot),
      note: r.note ? String(r.note) : undefined,
      items: JSON.parse(String(r.items_json || '[]')),
      subtotal: Number(r.subtotal),
      packagingFee: Number(r.packaging_fee),
      deliveryFee: Number(r.delivery_fee),
      total: Number(r.total),
      status: String(r.status),
      createdAt: String(r.created_at),
    }));
    res.json({orders});
  });

  app.patch('/api/admin/orders/:id/status', (req, res) => {
    if (!requireAdmin(req, res, 'finance.orders')) return;
    const schema = z.object({status: z.enum(['confirmed', 'preparing', 'delivering', 'delivered'])});
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'وضعیت سفارش معتبر نیست.'});
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(parsed.data.status, req.params.id);
    res.json({ok: true});
  });
}
