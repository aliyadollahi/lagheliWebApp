import crypto from 'node:crypto';
import type express from 'express';
import {z} from 'zod';
import {db} from './db.ts';
import {saveUploadedRecipeImage} from './adminAndMediaRoutes.ts';
import type {
  DeliveryPricingConfig,
  EditorialMenuItem,
  GemStoreOffer,
  KitchenConfig,
} from '../shared/types.ts';

export const DEFAULT_DELIVERY_PRICING: DeliveryPricingConfig = {
  freeDeliveryThreshold: 600000,
  packagingFee: 18000,
  standardDeliveryFee: 45000,
};

export const DEFAULT_KITCHEN_CONFIG: KitchenConfig = {
  quickFridgeItems: [
    'تخم‌مرغ',
    'پیاز',
    'سیر',
    'گوجه',
    'بادمجان',
    'برنج ایرانی',
    'سینه مرغ',
    'ماست چکیده',
    'مغز گردو',
    'رب انار',
    'سبزی آش',
    'کشک',
    'شوید',
    'باقالی',
    'زعفران',
  ],
  quickSubQueries: ['ماست چکیده', 'زعفران', 'رب انار', 'کشک', 'تخم‌مرغ', 'کره', 'مغز گردو', 'زرشک'],
  customSubstitutions: [],
};

export function getDeliveryPricingConfig(): DeliveryPricingConfig {
  const row = db.prepare("SELECT value_json FROM app_config WHERE key = 'delivery_pricing'").get() as
    | {value_json: string}
    | undefined;
  if (!row) return DEFAULT_DELIVERY_PRICING;
  try {
    const parsed = JSON.parse(row.value_json);
    return {
      freeDeliveryThreshold: Number(parsed.freeDeliveryThreshold ?? DEFAULT_DELIVERY_PRICING.freeDeliveryThreshold),
      packagingFee: Number(parsed.packagingFee ?? DEFAULT_DELIVERY_PRICING.packagingFee),
      standardDeliveryFee: Number(parsed.standardDeliveryFee ?? DEFAULT_DELIVERY_PRICING.standardDeliveryFee),
    };
  } catch {
    return DEFAULT_DELIVERY_PRICING;
  }
}

export function getKitchenConfig(): KitchenConfig {
  const row = db.prepare("SELECT value_json FROM app_config WHERE key = 'kitchen_config'").get() as
    | {value_json: string}
    | undefined;
  if (!row) return DEFAULT_KITCHEN_CONFIG;
  try {
    const parsed = JSON.parse(row.value_json);
    return {
      quickFridgeItems: Array.isArray(parsed.quickFridgeItems) && parsed.quickFridgeItems.length > 0
        ? parsed.quickFridgeItems
        : DEFAULT_KITCHEN_CONFIG.quickFridgeItems,
      quickSubQueries: Array.isArray(parsed.quickSubQueries) && parsed.quickSubQueries.length > 0
        ? parsed.quickSubQueries
        : DEFAULT_KITCHEN_CONFIG.quickSubQueries,
      customSubstitutions: Array.isArray(parsed.customSubstitutions) ? parsed.customSubstitutions : [],
    };
  } catch {
    return DEFAULT_KITCHEN_CONFIG;
  }
}

export function getGemStoreOffers(defaultOffers: GemStoreOffer[]): GemStoreOffer[] {
  const row = db.prepare("SELECT value_json FROM app_config WHERE key = 'gem_store_offers'").get() as
    | {value_json: string}
    | undefined;
  if (!row) return defaultOffers;
  try {
    const parsed = JSON.parse(row.value_json);
    return Array.isArray(parsed) ? parsed : defaultOffers;
  } catch {
    return defaultOffers;
  }
}

function mapMenuRow(r: Record<string, unknown>): EditorialMenuItem {
  return {
    id: String(r.id),
    title: String(r.title),
    subtitle: String(r.subtitle),
    story: String(r.story),
    category: String(r.category),
    imageUrl: String(r.image_url || ''),
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
  };
}

interface AdminExtrasDeps {
  requireAdmin: (req: express.Request, res: express.Response) => unknown;
  isSafeUrl: (url: string | undefined) => boolean;
  defaultGemOffers: GemStoreOffer[];
}

export function registerAdminExtrasRoutes(app: express.Express, deps: AdminExtrasDeps) {
  const {requireAdmin, isSafeUrl, defaultGemOffers} = deps;

  // =========================================================================
  // 1. DAILY EDITORIAL MENU CMS & DELIVERY PRICING
  // =========================================================================
  app.get('/api/admin/menu', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM menu_items ORDER BY featured DESC, id DESC').all() as Record<
      string,
      unknown
    >[];
    res.json({
      items: rows.map(mapMenuRow),
      pricing: getDeliveryPricingConfig(),
    });
  });

  const menuItemSchema = z.object({
    title: z.string().min(2).max(120),
    subtitle: z.string().min(2).max(200),
    story: z.string().max(600).default('پخت تازه روزانه در آشپزخانه منتخب لاقلی.'),
    category: z.string().min(2).max(60).default('اصیل ایرانی'),
    imageUrl: z.string().max(400).optional().default(''),
    imageDataUrl: z.string().max(4_500_000).optional(),
    chefName: z.string().min(2).max(80).default('آشپزخانه مرکزی لاقلی'),
    chefVerified: z.boolean().optional().default(true),
    prepMinutes: z.number().int().min(5).max(240).default(35),
    calories: z.number().int().min(50).max(3000).default(540),
    singlePrice: z.number().int().min(10000).max(50_000_000),
    doublePrice: z.number().int().min(10000).max(100_000_000),
    dietTags: z.array(z.string().max(40)).optional().default([]),
    keyIngredients: z.array(z.string().max(60)).optional().default([]),
    featured: z.boolean().optional().default(false),
    linkedRecipeId: z.string().max(80).nullable().optional(),
  });

  app.post('/api/admin/menu', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const parsed = menuItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات غذای منوی روز کامل یا معتبر نیست.'});
    }

    let finalImageUrl = parsed.data.imageUrl.trim();
    if (parsed.data.imageDataUrl) {
      const saved = saveUploadedRecipeImage(parsed.data.imageDataUrl);
      if (!saved.ok) {
        return res.status(400).json({error: saved.error});
      }
      finalImageUrl = saved.url;
    } else if (finalImageUrl && !isSafeUrl(finalImageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر معتبر نیست.'});
    }

    const id = `dish-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO menu_items (
        id, title, subtitle, story, category, image_url, chef_name, chef_verified,
        prep_minutes, calories, single_price, double_price, diet_tags_json,
        key_ingredients_json, featured, linked_recipe_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      parsed.data.title.trim(),
      parsed.data.subtitle.trim(),
      parsed.data.story.trim(),
      parsed.data.category.trim(),
      finalImageUrl,
      parsed.data.chefName.trim(),
      parsed.data.chefVerified ? 1 : 0,
      parsed.data.prepMinutes,
      parsed.data.calories,
      parsed.data.singlePrice,
      parsed.data.doublePrice,
      JSON.stringify(parsed.data.dietTags),
      JSON.stringify(parsed.data.keyIngredients),
      parsed.data.featured ? 1 : 0,
      parsed.data.linkedRecipeId || null
    );

    const row = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json({item: mapMenuRow(row)});
  });

  app.put('/api/admin/menu/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const existing = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'غذای موردنظر در منو یافت نشد.'});

    const parsed = menuItemSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'ورودی ویرایش منو معتبر نیست.'});

    let finalImageUrl =
      parsed.data.imageUrl !== undefined ? parsed.data.imageUrl.trim() : String(existing.image_url || '');
    if (parsed.data.imageDataUrl) {
      const saved = saveUploadedRecipeImage(parsed.data.imageDataUrl);
      if (!saved.ok) {
        return res.status(400).json({error: saved.error});
      }
      finalImageUrl = saved.url;
    } else if (finalImageUrl && !isSafeUrl(finalImageUrl)) {
      return res.status(400).json({error: 'آدرس تصویر معتبر نیست.'});
    }

    db.prepare(
      `UPDATE menu_items SET
        title = ?, subtitle = ?, story = ?, category = ?, image_url = ?, chef_name = ?,
        chef_verified = ?, prep_minutes = ?, calories = ?, single_price = ?, double_price = ?,
        diet_tags_json = ?, key_ingredients_json = ?, featured = ?, linked_recipe_id = ?
      WHERE id = ?`
    ).run(
      parsed.data.title?.trim() ?? String(existing.title),
      parsed.data.subtitle?.trim() ?? String(existing.subtitle),
      parsed.data.story?.trim() ?? String(existing.story),
      parsed.data.category?.trim() ?? String(existing.category),
      finalImageUrl,
      parsed.data.chefName?.trim() ?? String(existing.chef_name),
      parsed.data.chefVerified !== undefined ? (parsed.data.chefVerified ? 1 : 0) : Number(existing.chef_verified),
      parsed.data.prepMinutes ?? Number(existing.prep_minutes),
      parsed.data.calories ?? Number(existing.calories),
      parsed.data.singlePrice ?? Number(existing.single_price),
      parsed.data.doublePrice ?? Number(existing.double_price),
      parsed.data.dietTags ? JSON.stringify(parsed.data.dietTags) : String(existing.diet_tags_json || '[]'),
      parsed.data.keyIngredients
        ? JSON.stringify(parsed.data.keyIngredients)
        : String(existing.key_ingredients_json || '[]'),
      parsed.data.featured !== undefined ? (parsed.data.featured ? 1 : 0) : Number(existing.featured),
      parsed.data.linkedRecipeId !== undefined
        ? parsed.data.linkedRecipeId
        : existing.linked_recipe_id
          ? String(existing.linked_recipe_id)
          : null,
      req.params.id
    );

    const updated = db.prepare('SELECT * FROM menu_items WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({item: mapMenuRow(updated)});
  });

  app.delete('/api/admin/menu/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    db.prepare('DELETE FROM menu_items WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });

  app.put('/api/admin/menu-pricing', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const schema = z.object({
      freeDeliveryThreshold: z.number().int().min(0).max(50_000_000),
      packagingFee: z.number().int().min(0).max(2_000_000),
      standardDeliveryFee: z.number().int().min(0).max(2_000_000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'مقادیر تعرفه ارسال و بسته‌بندی نامعتبر است.'});
    db.prepare("INSERT OR REPLACE INTO app_config (key, value_json) VALUES ('delivery_pricing', ?)").run(
      JSON.stringify(parsed.data)
    );
    res.json({pricing: parsed.data});
  });

  // =========================================================================
  // 2. SMART KITCHEN / FRIDGE ITEMS & CUSTOM SUBSTITUTIONS CMS
  // =========================================================================
  app.get('/api/admin/kitchen-config', (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({kitchenConfig: getKitchenConfig()});
  });

  app.put('/api/admin/kitchen-config', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const schema = z.object({
      quickFridgeItems: z.array(z.string().min(1).max(60)).min(1).max(60),
      quickSubQueries: z.array(z.string().min(1).max(60)).min(1).max(30),
      customSubstitutions: z
        .array(
          z.object({
            id: z.string().min(1).max(60),
            ingredient: z.string().min(1).max(80),
            substitute: z.string().min(1).max(80),
            ratio: z.string().min(1).max(120),
            compatibility: z.number().int().min(10).max(100),
            flavorNote: z.string().min(2).max(240),
            isVegan: z.boolean().default(false),
          })
        )
        .max(200),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'تنظیمات آشپزخانه هوشمند معتبر نیست.'});
    db.prepare("INSERT OR REPLACE INTO app_config (key, value_json) VALUES ('kitchen_config', ?)").run(
      JSON.stringify(parsed.data)
    );
    res.json({kitchenConfig: parsed.data});
  });

  // =========================================================================
  // 3. GEM STORE OFFERS CMS
  // =========================================================================
  app.get('/api/admin/gem-offers', (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({offers: getGemStoreOffers(defaultGemOffers)});
  });

  app.put('/api/admin/gem-offers', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const schema = z.object({
      offers: z
        .array(
          z.object({
            id: z.string().min(1).max(60),
            title: z.string().min(2).max(120),
            partnerName: z.string().min(2).max(100),
            discountLabel: z.string().min(2).max(120),
            gemCost: z.number().int().min(1).max(100_000),
            codePrefix: z.string().min(2).max(20),
          })
        )
        .max(50),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات فروشگاه جِم نامعتبر است.'});
    db.prepare("INSERT OR REPLACE INTO app_config (key, value_json) VALUES ('gem_store_offers', ?)").run(
      JSON.stringify(parsed.data.offers)
    );
    res.json({offers: parsed.data.offers});
  });

  // =========================================================================
  // 4. RECIPE Q&A MODERATION
  // =========================================================================
  app.get('/api/admin/questions', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const qRows = db
      .prepare(
        `SELECT q.*, COALESCE(r.title, 'دستور حذف‌شده') as recipe_title
         FROM recipe_questions q
         LEFT JOIN recipes r ON r.id = q.recipe_id
         ORDER BY q.created_at DESC
         LIMIT 150`
      )
      .all() as Record<string, unknown>[];

    const questions = qRows.map((q) => {
      const answers = (
        db
          .prepare('SELECT * FROM recipe_answers WHERE question_id = ? ORDER BY is_best DESC, created_at ASC')
          .all(String(q.id)) as Record<string, unknown>[]
      ).map((a) => ({
        id: String(a.id),
        authorName: String(a.author_name),
        body: String(a.body),
        upvotes: Number(a.upvotes || 0),
        isBest: Number(a.is_best) === 1,
        createdAt: String(a.created_at),
      }));

      return {
        id: String(q.id),
        recipeId: String(q.recipe_id),
        recipeTitle: String(q.recipe_title),
        authorName: String(q.author_name),
        body: String(q.body),
        solved: Number(q.solved) === 1,
        createdAt: String(q.created_at),
        answers,
      };
    });

    res.json({questions});
  });

  app.delete('/api/admin/questions/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM recipe_answers WHERE question_id = ?').run(req.params.id);
      db.prepare('DELETE FROM recipe_questions WHERE id = ?').run(req.params.id);
    });
    tx();
    res.json({ok: true});
  });

  app.delete('/api/admin/answers/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    db.prepare('DELETE FROM recipe_answers WHERE id = ?').run(req.params.id);
    res.json({ok: true});
  });
}
