import crypto from 'crypto';
import type express from 'express';
import fs from 'fs';
import path from 'path';
import {z} from 'zod';
import {db} from './db.ts';
import {normalizePersian} from '../shared/persianEngine.ts';
import type {
  AdminDashboardStats,
  AdminUserRow,
  CampaignPlacement,
  Partner,
  PartnerRoleId,
  Recipe,
  RecipePhoto,
  SponsorCampaign,
  WalletTransaction,
} from '../shared/types.ts';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'recipe-photos');
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB

export interface SessionContext {
  userId: string;
  isAdmin: boolean;
}

export interface RouteDeps {
  getSession: (req: express.Request) => SessionContext | null;
  requireAdmin: (req: express.Request, res: express.Response) => SessionContext | null;
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
    if (!requireAdmin(req, res)) return;

    const totalRecipes = (db.prepare('SELECT COUNT(*) as c FROM recipes').get() as {c: number}).c;
    const recipesWithoutPhoto = (
      db.prepare("SELECT COUNT(*) as c FROM recipes WHERE TRIM(COALESCE(image_url, '')) = ''").get() as {c: number}
    ).c;
    const pendingRecipesCount = (
      db.prepare("SELECT COUNT(*) as c FROM recipes WHERE status = 'pending'").get() as {c: number}
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
  // ADMIN RECIPES CMS + BULK IMPORT (FOR THOUSANDS OF PHOTO-LESS RECIPES)
  // =========================================================================
  app.get('/api/admin/recipes', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const q = typeof req.query.q === 'string' ? normalizePersian(req.query.q) : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'all';
    const photoFilter = typeof req.query.photo === 'string' ? req.query.photo : 'all';

    const rows = db.prepare('SELECT * FROM recipes ORDER BY created_at DESC').all() as Record<string, unknown>[];
    let recipes = rows.map((r) => mapRecipeRow(r));
    if (statusFilter === 'published' || statusFilter === 'pending') {
      recipes = recipes.filter((r) => r.status === statusFilter);
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
    if (!requireAdmin(req, res)) return;
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
      d.title.trim(),
      d.subtitle.trim() || `${d.category} · ${d.region}`,
      d.description.trim() || d.subtitle.trim() || d.title.trim(),
      finalImageUrl,
      d.category,
      d.region,
      d.season,
      d.mealType,
      JSON.stringify(d.dietTags),
      d.prepMinutes,
      d.cookMinutes,
      d.servings,
      d.difficulty,
      JSON.stringify({
        calories: d.calories,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        fiber: d.fiber,
      }),
      d.isVip ? 1 : 0,
      d.isVip ? d.vipGemCost : 0,
      d.status,
      JSON.stringify(d.ingredients),
      JSON.stringify(d.steps),
      JSON.stringify(d.tools),
      now
    );

    const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({recipe: mapRecipeRow(row)});
  });

  app.put('/api/admin/recipes/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
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

    db.prepare(
      `UPDATE recipes SET
        title = ?, subtitle = ?, description = ?, image_url = ?, category = ?, region = ?,
        season = ?, meal_type = ?, diet_tags_json = ?, prep_minutes = ?, cook_minutes = ?,
        servings = ?, difficulty = ?, nutrition_json = ?, is_vip = ?, vip_gem_cost = ?,
        status = ?, ingredients_json = ?, steps_json = ?, tools_json = ?
       WHERE id = ?`
    ).run(
      d.title.trim(),
      d.subtitle.trim() || `${d.category} · ${d.region}`,
      d.description.trim() || d.title.trim(),
      finalImageUrl,
      d.category,
      d.region,
      d.season,
      d.mealType,
      JSON.stringify(d.dietTags),
      d.prepMinutes,
      d.cookMinutes,
      d.servings,
      d.difficulty,
      JSON.stringify({
        calories: d.calories,
        protein: d.protein,
        carbs: d.carbs,
        fat: d.fat,
        fiber: d.fiber,
      }),
      d.isVip ? 1 : 0,
      d.isVip ? d.vipGemCost : 0,
      d.status,
      JSON.stringify(d.ingredients),
      JSON.stringify(d.steps),
      JSON.stringify(d.tools),
      req.params.id
    );

    const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({recipe: mapRecipeRow(row)});
  });

  app.delete('/api/admin/recipes/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    db.prepare('DELETE FROM recipe_photos WHERE recipe_id = ?').run(req.params.id);
    db.prepare('DELETE FROM bookmarks WHERE recipe_id = ?').run(req.params.id);
    db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  app.post('/api/admin/recipes/bulk-import', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
    db.prepare('DELETE FROM recipe_photos WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  // =========================================================================
  // ADMIN USERS MANAGEMENT & USER WALLET (TOMAN / GEM) TOP-UP
  // =========================================================================
  app.get('/api/admin/users', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
    const schema = z.object({
      role: z.enum(['user', 'chef', 'partner', 'admin']).optional(),
      isVerifiedChef: z.boolean().optional(),
      isSuspended: z.boolean().optional(),
      name: z.string().min(2).max(80).optional(),
      city: z.string().min(2).max(50).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات ویرایش کاربر معتبر نیست.'});

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!user) return res.status(404).json({error: 'کاربر یافت نشد.'});

    const d = parsed.data;
    const nextRole = d.role ?? String(user.role);
    const nextVerified = d.isVerifiedChef !== undefined ? (d.isVerifiedChef ? 1 : 0) : Number(user.is_verified_chef);
    const nextChefStatus =
      d.isVerifiedChef !== undefined
        ? d.isVerifiedChef
          ? 'approved'
          : 'none'
        : String(user.chef_verification_status);
    const nextSuspended = d.isSuspended !== undefined ? (d.isSuspended ? 1 : 0) : Number(user.is_suspended || 0);

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

    res.json({ok: true});
  });

  app.post('/api/admin/users/:id/wallet', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
         VALUES (?, 'user', ?, ?, ?, ?, ?, ?, 'admin', ?)`
      ).run(txId, user.id, user.name, currency, amount, nextBalance, reason.trim(), now);
    });

    runTx();
    res.json({ok: true, balanceAfter: nextBalance});
  });

  // =========================================================================
  // ADMIN PARTNERS & COMMERCIAL ACCOUNT WALLET TOP-UP
  // =========================================================================
  app.get('/api/admin/partners', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM partners ORDER BY created_at DESC').all() as Record<string, unknown>[];
    res.json({partners: rows.map((r) => mapPartnerRow(r))});
  });

  app.post('/api/admin/partners', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
         VALUES (?, 'partner', ?, ?, 'toman', ?, ?, 'شارژ اولیه حساب تجاری هنگام ثبت', 'admin', ?)`
      ).run(`wtx-${crypto.randomUUID().slice(0, 8)}`, id, d.name.trim(), d.initialBalance, d.initialBalance, now);
    }

    const row = db.prepare('SELECT * FROM partners WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({partner: mapPartnerRow(row)});
  });

  app.put('/api/admin/partners/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
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
         VALUES (?, 'partner', ?, ?, 'toman', ?, ?, ?, 'admin', ?)`
      ).run(
        `wtx-${crypto.randomUUID().slice(0, 8)}`,
        partner.id,
        partner.name,
        parsed.data.amount,
        nextBalance,
        parsed.data.reason.trim(),
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
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
    db.prepare('DELETE FROM sponsor_campaigns WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  // =========================================================================
  // ADMIN FINANCIAL LEDGER & DAILY FOOD ORDERS
  // =========================================================================
  app.get('/api/admin/transactions', (req, res) => {
    if (!requireAdmin(req, res)) return;
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

  app.get('/api/admin/orders', (req, res) => {
    if (!requireAdmin(req, res)) return;
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
    if (!requireAdmin(req, res)) return;
    const schema = z.object({status: z.enum(['confirmed', 'preparing', 'delivering', 'delivered'])});
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'وضعیت سفارش معتبر نیست.'});
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(parsed.data.status, req.params.id);
    res.json({ok: true});
  });
}
