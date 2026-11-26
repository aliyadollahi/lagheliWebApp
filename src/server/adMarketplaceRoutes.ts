import crypto from 'crypto';
import type express from 'express';
import {z} from 'zod';
import {
  db,
  getActiveFlagshipSponsorship,
  getAdBids,
  getAdSlots,
  getAdvertiserAccounts,
  getFlagshipSponsorships,
  getLocalVenues,
  getNativeAds,
  hashAdvertiserPassword,
  mapNativeAdRow,
} from './db.ts';
import {
  checkDateRangeOverlap,
  matchNearbyVenuesForRecipe,
} from '../shared/nativeAdEngine.ts';
import type {
  AdminPermission,
  AdvertiserAccount,
  AdvertiserDashboardPayload,
  Partner,
  Recipe,
} from '../shared/types.ts';
import type {SessionContext} from './adminAndMediaRoutes.ts';

export interface AdMarketRouteDeps {
  requireAdmin: (
    req: express.Request,
    res: express.Response,
    permission?: AdminPermission
  ) => SessionContext | null;
  isSafeUrl: (url: string | undefined) => boolean;
  mapRecipeRow: (row: Record<string, unknown>, viewerId?: string) => Recipe;
  mapPartnerRow: (row: Record<string, unknown>, viewerId?: string) => Partner;
  checkRateLimit: (key: string, maxRequests: number, windowMs: number) => boolean;
}

interface AdvertiserSessionCtx {
  advertiserId: string;
  partnerId: string;
  partnerName: string;
  managerName: string;
  loginIdentifier: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

function getBearerToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

function createAdvertiserSession(advertiserId: string, partnerId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  db.prepare(
    'INSERT INTO advertiser_sessions (token_hash, advertiser_id, partner_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(hashToken(token), advertiserId, partnerId, expiresAt, new Date().toISOString());
  return token;
}

function getAdvertiserSession(req: express.Request): AdvertiserSessionCtx | null {
  const token = getBearerToken(req);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT s.advertiser_id, s.partner_id, s.expires_at, a.manager_name, a.login_identifier, a.status, p.name AS partner_name
       FROM advertiser_sessions s
       JOIN advertiser_accounts a ON a.id = s.advertiser_id
       LEFT JOIN partners p ON p.id = a.partner_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token)) as
    | {
        advertiser_id: string;
        partner_id: string;
        expires_at: number;
        manager_name: string;
        login_identifier: string;
        status: string;
        partner_name: string | null;
      }
    | undefined;

  if (!row || row.expires_at < Date.now() || row.status !== 'active') {
    return null;
  }

  return {
    advertiserId: row.advertiser_id,
    partnerId: row.partner_id,
    partnerName: row.partner_name || 'برند همکار',
    managerName: row.manager_name,
    loginIdentifier: row.login_identifier,
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function hasExclusiveSlotConflict(
  slotId: string,
  startsAt: string,
  endsAt: string,
  ignoreAdId?: string | null
): {conflict: boolean; partnerName?: string; startsAt?: string; endsAt?: string} {
  const slot = db.prepare('SELECT is_exclusive FROM ad_slots WHERE id = ?').get(slotId) as
    | {is_exclusive: number}
    | undefined;
  if (!slot || Number(slot.is_exclusive) !== 1) {
    return {conflict: false};
  }

  const existingAds = db
    .prepare(
      `SELECT na.id, na.starts_at, na.ends_at, p.name AS partner_name
       FROM native_ads na
       LEFT JOIN partners p ON p.id = na.partner_id
       WHERE na.slot_id = ? AND na.status = 'active'`
    )
    .all(slotId) as {id: string; starts_at: string | null; ends_at: string | null; partner_name: string | null}[];

  for (const ad of existingAds) {
    if (ignoreAdId && ad.id === ignoreAdId) continue;
    if (ad.starts_at && ad.ends_at && checkDateRangeOverlap(startsAt, endsAt, ad.starts_at, ad.ends_at)) {
      return {
        conflict: true,
        partnerName: ad.partner_name || 'برند دیگر',
        startsAt: ad.starts_at,
        endsAt: ad.ends_at,
      };
    }
  }
  return {conflict: false};
}

export function registerAdMarketplaceRoutes(app: express.Express, deps: AdMarketRouteDeps): void {
  // =========================================================================
  // 1. PUBLIC CONSUMER ENDPOINTS (Flagship "Powered By" & Nearby Venues)
  // =========================================================================

  app.get('/api/ads/flagship', (_req, res) => {
    res.json({sponsorship: getActiveFlagshipSponsorship()});
  });

  app.post('/api/ads/flagship/:id/event', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!deps.checkRateLimit(`flagship_ev:${ip}:${req.params.id}`, 60, 60_000)) {
      return res.json({ok: true});
    }
    const type = req.body?.type === 'click' ? 'click' : 'impression';
    const col = type === 'click' ? 'clicks' : 'impressions';
    db.prepare(`UPDATE flagship_sponsorships SET ${col} = ${col} + 1 WHERE id = ?`).run(req.params.id);
    res.json({ok: true});
  });

  app.get('/api/ads/nearby-venues', (req, res) => {
    const recipeId = typeof req.query.recipeId === 'string' ? req.query.recipeId.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const neighborhood = typeof req.query.neighborhood === 'string' ? req.query.neighborhood.trim() : '';
    const latRaw = typeof req.query.lat === 'string' ? Number(req.query.lat) : NaN;
    const lngRaw = typeof req.query.lng === 'string' ? Number(req.query.lng) : NaN;
    const lat = Number.isFinite(latRaw) ? latRaw : null;
    const lng = Number.isFinite(lngRaw) ? lngRaw : null;

    if (!recipeId) {
      return res.json({matches: []});
    }

    const recipeRow = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as
      | Record<string, unknown>
      | undefined;
    if (!recipeRow) {
      return res.json({matches: []});
    }

    const recipe = deps.mapRecipeRow(recipeRow);
    const venues = getLocalVenues(true);
    const matches = matchNearbyVenuesForRecipe(recipe, venues, {city, neighborhood, lat, lng}, 3);
    res.json({matches});
  });

  app.post('/api/ads/nearby-venues/:id/event', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!deps.checkRateLimit(`venue_ev:${ip}:${req.params.id}`, 60, 60_000)) {
      return res.json({ok: true});
    }
    const type = req.body?.type === 'click' ? 'click' : 'impression';
    const col = type === 'click' ? 'clicks' : 'impressions';
    db.prepare(`UPDATE local_venues SET ${col} = ${col} + 1 WHERE id = ?`).run(req.params.id);
    res.json({ok: true});
  });

  // =========================================================================
  // 2. ISOLATED ADVERTISER / BRAND MANAGER PORTAL (/api/advertiser/*)
  // =========================================================================

  app.get('/api/advertiser/demo-accounts', (_req, res) => {
    const demoEnabled = process.env.DISABLE_DEMO_ADVERTISER_LOGIN !== 'true';
    if (!demoEnabled) {
      return res.json({demoEnabled: false, accounts: []});
    }
    const accounts = getAdvertiserAccounts()
      .filter((a) => a.status === 'active')
      .map((a) => ({
        id: a.id,
        partnerId: a.partnerId,
        partnerName: a.partnerName,
        managerName: a.managerName,
        loginIdentifier: a.loginIdentifier,
      }));
    res.json({demoEnabled: true, accounts});
  });

  app.post('/api/advertiser/login', (req, res) => {
    const ip = req.ip || 'unknown';
    if (!deps.checkRateLimit(`adv_login:${ip}`, 15, 60_000)) {
      return res.status(429).json({error: 'تعداد تلاش‌های ورود بیش از حد مجاز است. لطفاً کمی بعد دوباره تلاش کنید.'});
    }

    const schema = z.object({
      identifier: z.string().min(3).max(120),
      password: z.string().min(4).max(120),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'شناسه کاربری یا رمز عبور نامعتبر است.'});
    }

    const row = db
      .prepare(
        `SELECT a.*, p.name AS partner_name
         FROM advertiser_accounts a
         LEFT JOIN partners p ON p.id = a.partner_id
         WHERE lower(a.login_identifier) = lower(?)`
      )
      .get(parsed.data.identifier.trim()) as Record<string, unknown> | undefined;

    if (!row || !verifyPassword(parsed.data.password, String(row.password_hash))) {
      return res.status(401).json({error: 'شناسه یا رمز عبور پنل برند اشتباه است.'});
    }
    if (row.status !== 'active') {
      return res.status(403).json({error: 'دسترسی این حساب تبلیغاتی توسط مدیریت معلق شده است.'});
    }

    const token = createAdvertiserSession(String(row.id), String(row.partner_id));
    const account: AdvertiserAccount = {
      id: String(row.id),
      partnerId: String(row.partner_id),
      partnerName: String(row.partner_name || 'برند همکار'),
      loginIdentifier: String(row.login_identifier),
      managerName: String(row.manager_name),
      status: 'active',
      createdAt: String(row.created_at),
    };
    res.json({token, account});
  });

  app.post('/api/advertiser/demo-login', (req, res) => {
    if (process.env.DISABLE_DEMO_ADVERTISER_LOGIN === 'true') {
      return res.status(403).json({error: 'ورود آزمایشی در این محیط غیرفعال است.'});
    }
    const accountId = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
    const row = db
      .prepare(
        `SELECT a.*, p.name AS partner_name
         FROM advertiser_accounts a
         LEFT JOIN partners p ON p.id = a.partner_id
         WHERE a.id = ? AND a.status = 'active'`
      )
      .get(accountId) as Record<string, unknown> | undefined;
    if (!row) {
      return res.status(404).json({error: 'حساب برند مورد نظر یافت نشد.'});
    }

    const token = createAdvertiserSession(String(row.id), String(row.partner_id));
    const account: AdvertiserAccount = {
      id: String(row.id),
      partnerId: String(row.partner_id),
      partnerName: String(row.partner_name || 'برند همکار'),
      loginIdentifier: String(row.login_identifier),
      managerName: String(row.manager_name),
      status: 'active',
      createdAt: String(row.created_at),
    };
    res.json({token, account});
  });

  app.post('/api/advertiser/logout', (req, res) => {
    const token = getBearerToken(req);
    if (token) {
      db.prepare('DELETE FROM advertiser_sessions WHERE token_hash = ?').run(hashToken(token));
    }
    res.json({ok: true});
  });

  app.get('/api/advertiser/dashboard', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'لطفاً وارد پنل اختصاصی برند شوید.'});
    }

    const partnerRow = db.prepare('SELECT * FROM partners WHERE id = ?').get(adv.partnerId) as
      | Record<string, unknown>
      | undefined;
    const partner = partnerRow ? deps.mapPartnerRow(partnerRow) : null;

    const brandAdRows = db
      .prepare(
        `SELECT na.*, p.name AS partner_name
         FROM native_ads na
         LEFT JOIN partners p ON p.id = na.partner_id
         WHERE na.partner_id = ?
         ORDER BY na.created_at DESC`
      )
      .all(adv.partnerId) as Record<string, unknown>[];
    const ads = brandAdRows.map(mapNativeAdRow);
    const bids = getAdBids(adv.partnerId);
    const slots = getAdSlots(true);
    const venues = getLocalVenues(false).filter((v) => v.partnerId === adv.partnerId);
    const sponsorships = getFlagshipSponsorships().filter((s) => s.partnerId === adv.partnerId);

    const totalImpressions =
      ads.reduce((s, a) => s + a.impressions, 0) +
      venues.reduce((s, v) => s + v.impressions, 0) +
      sponsorships.reduce((s, sp) => s + sp.impressions, 0);
    const totalClicks =
      ads.reduce((s, a) => s + a.clicks, 0) +
      venues.reduce((s, v) => s + v.clicks, 0) +
      sponsorships.reduce((s, sp) => s + sp.clicks, 0);
    const ctrPercent = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;
    const approvedSpendToman =
      bids.filter((b) => b.status === 'approved').reduce((s, b) => s + b.bidAmountToman, 0) +
      sponsorships.reduce((s, sp) => s + sp.priceToman, 0);

    const accountRow = db.prepare('SELECT created_at FROM advertiser_accounts WHERE id = ?').get(adv.advertiserId) as
      | {created_at: string}
      | undefined;

    const payload: AdvertiserDashboardPayload = {
      account: {
        id: adv.advertiserId,
        partnerId: adv.partnerId,
        partnerName: adv.partnerName,
        loginIdentifier: adv.loginIdentifier,
        managerName: adv.managerName,
        status: 'active',
        createdAt: accountRow?.created_at || new Date().toISOString(),
      },
      partner,
      summary: {
        totalImpressions,
        totalClicks,
        ctrPercent,
        activeAdsCount: ads.filter((a) => a.status === 'active').length,
        pendingBidsCount: bids.filter((b) => b.status === 'pending').length,
        approvedSpendToman,
      },
      ads,
      bids,
      slots,
      venues,
      sponsorships,
    };

    res.json(payload);
  });

  app.post('/api/advertiser/bids', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'برای ثبت درخواست رزرو یا مزایده، وارد پنل برند شوید.'});
    }

    const schema = z.object({
      slotId: z.string().min(2),
      bookingType: z.enum(['fixed', 'auction']),
      bidAmountToman: z.number().int().min(100_000).max(5_000_000_000),
      startsAt: z.string().refine(isIsoDate, 'تاریخ شروع نامعتبر است.'),
      endsAt: z.string().refine(isIsoDate, 'تاریخ پایان نامعتبر است.'),
      title: z.string().min(3).max(120),
      subtitle: z.string().max(160).optional().default(''),
      editorialCopy: z.string().max(340).optional().default(''),
      ctaLabel: z.string().min(2).max(40).optional().default('مشاهده معرفی برند'),
      targetUrl: z.string().max(320).optional().default(''),
      utmSource: z.string().max(60).optional().default('lagheli'),
      utmMedium: z.string().max(60).optional().default('native_ad'),
      utmCampaign: z.string().max(80).optional().default(''),
      recipeCategories: z.array(z.string().min(1).max(40)).max(10).optional().default([]),
      matchKeywords: z.array(z.string().min(1).max(40)).max(15).optional().default([]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات فرم رزرو یا مزایده کامل و معتبر نیست.'});
    }

    const d = parsed.data;
    if (d.endsAt < d.startsAt) {
      return res.status(400).json({error: 'تاریخ پایان باید بعد از تاریخ شروع باشد.'});
    }
    if (d.targetUrl && !deps.isSafeUrl(d.targetUrl)) {
      return res.status(400).json({error: 'نشانی لینک مقصد معتبر نیست (فقط پروتکل امن وب مجاز است).'});
    }

    const slot = db.prepare('SELECT * FROM ad_slots WHERE id = ? AND status = \'open\'').get(d.slotId) as
      | Record<string, unknown>
      | undefined;
    if (!slot) {
      return res.status(404).json({error: 'جایگاه انتخاب‌شده یافت نشد یا در حال حاضر بسته است.'});
    }

    const pricingModel = String(slot.pricing_model);
    if (d.bookingType === 'fixed' && pricingModel === 'auction') {
      return res.status(400).json({error: 'این جایگاه صرفاً به صورت مزایده عرضه می‌شود.'});
    }
    if (d.bookingType === 'auction' && pricingModel === 'fixed') {
      return res.status(400).json({error: 'این جایگاه فقط با قیمت ثابت قابل رزرو است.'});
    }

    const fixedPrice = Number(slot.fixed_price_toman || 0);
    const minBid = Number(slot.min_bid_toman || 0);
    const bidStep = Number(slot.bid_step_toman || 500000);
    const finalAmount = d.bookingType === 'fixed' ? fixedPrice : d.bidAmountToman;

    if (d.bookingType === 'auction') {
      const highestRow = db
        .prepare("SELECT MAX(bid_amount_toman) AS m FROM ad_bids WHERE slot_id = ? AND status = 'pending'")
        .get(d.slotId) as {m: number | null};
      const requiredMin = highestRow?.m ? Math.max(minBid, highestRow.m + bidStep) : minBid;
      if (finalAmount < requiredMin) {
        return res.status(400).json({
          error: `حداقل مبلغ قابل قبول برای شرکت در مزایده این جایگاه ${requiredMin.toLocaleString('fa-IR')} تومان است.`,
        });
      }
    }

    // Exclusivity check against already approved/active bookings on this slot
    const conflict = hasExclusiveSlotConflict(d.slotId, d.startsAt, d.endsAt);
    if (conflict.conflict) {
      return res.status(409).json({
        error: `این جایگاه انحصاری در بازه ${conflict.startsAt} تا ${conflict.endsAt} قبلاً رزرو شده است. لطفاً بازه زمانی دیگری انتخاب کنید.`,
      });
    }

    const id = `bid-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const effectiveCategories =
      d.recipeCategories.length > 0 ? d.recipeCategories : [String(slot.target_category || 'همه دسته‌ها')];

    db.prepare(`
      INSERT INTO ad_bids (
        id, slot_id, advertiser_id, partner_id, booking_type, bid_amount_toman,
        starts_at, ends_at, title, subtitle, editorial_copy, cta_label, target_url,
        utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
        status, admin_note, created_ad_id, created_at, reviewed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', NULL, ?, NULL)
    `).run(
      id,
      d.slotId,
      adv.advertiserId,
      adv.partnerId,
      d.bookingType,
      finalAmount,
      d.startsAt,
      d.endsAt,
      d.title.trim(),
      d.subtitle.trim(),
      d.editorialCopy.trim(),
      d.ctaLabel.trim(),
      d.targetUrl.trim() || null,
      d.utmSource.trim() || 'lagheli',
      d.utmMedium.trim() || String(slot.media_type || 'native_ad'),
      d.utmCampaign.trim(),
      JSON.stringify(effectiveCategories),
      JSON.stringify(d.matchKeywords),
      now
    );

    res.status(201).json({
      id,
      message: 'درخواست شما ثبت شد و برای بررسی و تایید نهایی به سوپرپنل مدیریت ارسال گردید.',
    });
  });

  // Helper to compute live Smart Auction competition state for an authenticated advertiser
  const buildLiveAuctionPayload = (adv: AdvertiserSessionCtx) => {
    const openSlots = getAdSlots(true).filter((s) => s.pricingModel === 'auction' || s.pricingModel === 'hybrid');
    const allPendingBids = getAdBids().filter((b) => b.status === 'pending' && b.bookingType === 'auction');

    // Deterministic weekly auction cycle end (every Sunday 23:59:59 UTC / aligns cleanly across refreshes)
    const now = new Date();
    const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
    const roundEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 20, 30, 0)
    );

    const auctions = openSlots.map((slot) => {
      const slotBids = allPendingBids
        .filter((b) => b.slotId === slot.id)
        .sort((a, b) => b.bidAmountToman - a.bidAmountToman || a.createdAt.localeCompare(b.createdAt));

      const highestBid = slotBids[0]?.bidAmountToman || 0;
      const nextMinBid = highestBid > 0 ? Math.max(slot.minBidToman, highestBid + slot.bidStepToman) : slot.minBidToman;

      // Anonymize rival brands consistently per slot while showing own brand transparently
      const rivalAliasMap = new Map<string, string>();
      let rivalCounter = 1;
      const distinctPartners = new Set<string>();

      const leaderboard = slotBids.map((b, index) => {
        distinctPartners.add(b.partnerId);
        const isOwn = b.partnerId === adv.partnerId;
        let bidderLabel: string;
        if (isOwn) {
          bidderLabel = `برند شما (${adv.partnerName})`;
        } else {
          if (!rivalAliasMap.has(b.partnerId)) {
            rivalAliasMap.set(b.partnerId, `برند رقیب ${rivalCounter}`);
            rivalCounter += 1;
          }
          bidderLabel = rivalAliasMap.get(b.partnerId)!;
        }
        return {
          id: b.id,
          rank: index + 1,
          bidderLabel,
          isOwn,
          bidAmountToman: b.bidAmountToman,
          startsAt: b.startsAt,
          endsAt: b.endsAt,
          createdAt: b.createdAt,
          title: isOwn ? b.title : undefined,
          editorialCopy: isOwn ? b.editorialCopy : undefined,
          targetUrl: isOwn ? b.targetUrl : undefined,
          utmCampaign: isOwn ? b.utmCampaign : undefined,
          gapFromLeaderToman: Math.max(0, highestBid - b.bidAmountToman),
        };
      });

      const myBestIndex = leaderboard.findIndex((entry) => entry.isOwn);
      const myBestBidObj = slotBids.find((b) => b.partnerId === adv.partnerId) || null;
      const myHighestBidToman = myBestIndex >= 0 ? leaderboard[myBestIndex].bidAmountToman : null;
      const myRank = myBestIndex >= 0 ? myBestIndex + 1 : null;
      const myStatus: 'leading' | 'outbid' | 'watching' =
        myRank === 1 ? 'leading' : myRank && myRank > 1 ? 'outbid' : 'watching';
      const gapToLeadToman =
        myStatus === 'leading'
          ? 0
          : myHighestBidToman !== null
            ? Math.max(slot.bidStepToman, highestBid + slot.bidStepToman - myHighestBidToman)
            : nextMinBid;

      const priceSpreadPercent =
        slot.minBidToman > 0 && highestBid > slot.minBidToman
          ? Math.round(((highestBid - slot.minBidToman) / slot.minBidToman) * 100)
          : 0;

      const competitionLevel: 'calm' | 'active' | 'heated' =
        distinctPartners.size >= 3 || priceSpreadPercent >= 25
          ? 'heated'
          : distinctPartners.size >= 1
            ? 'active'
            : 'calm';

      // Deterministic win probability based on current standing & rival density
      let estimatedWinProbability = 42;
      if (myStatus === 'leading') {
        const secondBid = leaderboard[1]?.bidAmountToman || slot.minBidToman;
        const leadMarginRatio = secondBid > 0 ? (highestBid - secondBid) / secondBid : 0.2;
        estimatedWinProbability = Math.min(95, Math.max(66, Math.round(72 + leadMarginRatio * 90 - distinctPartners.size * 3)));
      } else if (myStatus === 'outbid') {
        estimatedWinProbability = Math.max(12, Math.min(44, Math.round(40 - (myRank! - 1) * 10)));
      } else {
        estimatedWinProbability = distinctPartners.size === 0 ? 78 : Math.max(28, 62 - distinctPartners.size * 10);
      }

      // Stagger round close slightly per slot index so slots feel realistic & distinct
      const slotEndDate = new Date(roundEnd.getTime() + (slot.id.length % 4) * 3600_000 * 6);

      return {
        slot,
        currentHighestBidToman: highestBid,
        nextMinimumBidToman: nextMinBid,
        totalActiveBids: slotBids.length,
        uniqueBiddersCount: distinctPartners.size,
        competitionLevel,
        priceSpreadPercent,
        myHighestBidToman,
        myRank,
        myStatus,
        gapToLeadToman,
        estimatedWinProbability,
        roundEndsAt: slotEndDate.toISOString(),
        myLastCreative: myBestBidObj
          ? {
              title: myBestBidObj.title,
              subtitle: myBestBidObj.subtitle,
              editorialCopy: myBestBidObj.editorialCopy,
              ctaLabel: myBestBidObj.ctaLabel,
              targetUrl: myBestBidObj.targetUrl || '',
              utmCampaign: myBestBidObj.utmCampaign || '',
              startsAt: myBestBidObj.startsAt,
              endsAt: myBestBidObj.endsAt,
              keywords: myBestBidObj.matchKeywords || [],
            }
          : null,
        leaderboard,
      };
    });

    // Recent real bid activity across all open auctionable slots
    const openSlotIds = new Set(openSlots.map((s) => s.id));
    const globalRivalMap = new Map<string, string>();
    let globalRivalSeq = 1;
    const recentEvents = allPendingBids
      .filter((b) => openSlotIds.has(b.slotId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)
      .map((b) => {
        const isOwn = b.partnerId === adv.partnerId;
        let bidderLabel: string;
        if (isOwn) {
          bidderLabel = `برند شما (${adv.partnerName})`;
        } else {
          if (!globalRivalMap.has(b.partnerId)) {
            globalRivalMap.set(b.partnerId, `برند رقیب ${globalRivalSeq}`);
            globalRivalSeq += 1;
          }
          bidderLabel = globalRivalMap.get(b.partnerId)!;
        }
        return {
          id: b.id,
          slotId: b.slotId,
          slotTitle: b.slotTitle,
          bidderLabel,
          isOwn,
          bidAmountToman: b.bidAmountToman,
          createdAt: b.createdAt,
        };
      });

    const leadingSlotsCount = auctions.filter((a) => a.myStatus === 'leading').length;
    const outbidSlotsCount = auctions.filter((a) => a.myStatus === 'outbid').length;
    const watchingSlotsCount = auctions.filter((a) => a.myStatus === 'watching').length;
    const myTotalActiveBidCommitmentToman = auctions.reduce((sum, a) => sum + (a.myHighestBidToman || 0), 0);

    return {
      serverTime: now.toISOString(),
      partnerId: adv.partnerId,
      partnerName: adv.partnerName,
      summary: {
        activeAuctionSlotsCount: auctions.length,
        leadingSlotsCount,
        outbidSlotsCount,
        watchingSlotsCount,
        myTotalActiveBidCommitmentToman,
      },
      auctions,
      recentEvents,
    };
  };

  app.get('/api/advertiser/auctions/live', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'لطفاً برای مشاهده اتاق مزایده هوشمند وارد پنل برند شوید.'});
    }
    res.json(buildLiveAuctionPayload(adv));
  });

  app.post('/api/advertiser/auctions/quick-bid', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'برای ثبت پیشنهاد لحظه‌ای وارد پنل برند شوید.'});
    }

    const schema = z.object({
      slotId: z.string().min(2),
      bidAmountToman: z.number().int().min(100_000).max(5_000_000_000),
      startsAt: z.string().refine(isIsoDate, 'تاریخ شروع نامعتبر است.'),
      endsAt: z.string().refine(isIsoDate, 'تاریخ پایان نامعتبر است.'),
      title: z.string().min(3).max(120),
      subtitle: z.string().max(160).optional().default(''),
      editorialCopy: z.string().max(340).optional().default(''),
      ctaLabel: z.string().min(2).max(40).optional().default('مشاهده معرفی برند'),
      targetUrl: z.string().max(320).optional().default(''),
      utmCampaign: z.string().max(80).optional().default(''),
      matchKeywords: z.array(z.string().min(1).max(40)).max(15).optional().default([]),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات پیشنهاد مزایده کامل و معتبر نیست.'});
    }

    const d = parsed.data;
    if (d.endsAt < d.startsAt) {
      return res.status(400).json({error: 'تاریخ پایان باید بعد از تاریخ شروع باشد.'});
    }
    if (d.targetUrl && !deps.isSafeUrl(d.targetUrl)) {
      return res.status(400).json({error: 'نشانی لینک مقصد معتبر نیست.'});
    }

    const slot = db.prepare("SELECT * FROM ad_slots WHERE id = ? AND status = 'open'").get(d.slotId) as
      | Record<string, unknown>
      | undefined;
    if (!slot) {
      return res.status(404).json({error: 'جایگاه انتخاب‌شده یافت نشد یا مزایده آن بسته است.'});
    }
    if (String(slot.pricing_model) === 'fixed') {
      return res.status(400).json({error: 'این جایگاه فقط با قیمت ثابت عرضه می‌شود و مشمول مزایده نیست.'});
    }

    const minBid = Number(slot.min_bid_toman || 0);
    const bidStep = Number(slot.bid_step_toman || 500_000);

    const highestRow = db
      .prepare("SELECT MAX(bid_amount_toman) AS m FROM ad_bids WHERE slot_id = ? AND status = 'pending' AND booking_type = 'auction'")
      .get(d.slotId) as {m: number | null};
    const requiredMin = highestRow?.m ? Math.max(minBid, highestRow.m + bidStep) : minBid;
    if (d.bidAmountToman < requiredMin) {
      return res.status(400).json({
        error: `برای پیشتازی در این جایگاه، حداقل مبلغ پیشنهادی ${requiredMin.toLocaleString('fa-IR')} تومان است.`,
      });
    }

    const conflict = hasExclusiveSlotConflict(d.slotId, d.startsAt, d.endsAt);
    if (conflict.conflict) {
      return res.status(409).json({
        error: `این جایگاه در بازه ${conflict.startsAt} تا ${conflict.endsAt} رزرو قطعی دارد. بازه دیگری انتخاب کنید.`,
      });
    }

    const id = `bid-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const targetCategory = String(slot.target_category || 'همه دسته‌ها');

    const tx = db.transaction(() => {
      // Supersede older lower pending auction bids from the same brand on the same slot
      db.prepare(
        `UPDATE ad_bids
         SET status = 'outbid', admin_note = 'جایگزین‌شده با پیشنهاد جدیدتر همین برند در اتاق مزایده هوشمند', reviewed_at = ?
         WHERE slot_id = ? AND partner_id = ? AND status = 'pending' AND booking_type = 'auction'`
      ).run(now, d.slotId, adv.partnerId);

      db.prepare(`
        INSERT INTO ad_bids (
          id, slot_id, advertiser_id, partner_id, booking_type, bid_amount_toman,
          starts_at, ends_at, title, subtitle, editorial_copy, cta_label, target_url,
          utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
          status, admin_note, created_ad_id, created_at, reviewed_at
        ) VALUES (?, ?, ?, ?, 'auction', ?, ?, ?, ?, ?, ?, ?, ?, 'lagheli', ?, ?, ?, ?, 'pending', '', NULL, ?, NULL)
      `).run(
        id,
        d.slotId,
        adv.advertiserId,
        adv.partnerId,
        d.bidAmountToman,
        d.startsAt,
        d.endsAt,
        d.title.trim(),
        d.subtitle.trim(),
        d.editorialCopy.trim(),
        d.ctaLabel.trim(),
        d.targetUrl.trim() || null,
        String(slot.media_type || 'banner'),
        d.utmCampaign.trim() || `smart_auction_${d.slotId}`,
        JSON.stringify([targetCategory]),
        JSON.stringify(d.matchKeywords),
        now
      );
    });

    tx();
    res.status(201).json({
      id,
      message: 'پیشنهاد شما با موفقیت در صف مزایده ثبت شد و اکنون در رتبه اول رقابت قرار دارید.',
      live: buildLiveAuctionPayload(adv),
    });
  });

  app.put('/api/advertiser/ads/:id/status', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'احراز هویت پنل برند الزامی است.'});
    }
    const status = req.body?.status === 'paused' ? 'paused' : 'active';
    const result = db
      .prepare('UPDATE native_ads SET status = ? WHERE id = ? AND partner_id = ?')
      .run(status, req.params.id, adv.partnerId);
    if (result.changes === 0) {
      return res.status(404).json({error: 'تبلیغ مورد نظر در حساب برند شما یافت نشد.'});
    }
    res.json({ok: true, status});
  });

  app.put('/api/advertiser/venues/:id', (req, res) => {
    const adv = getAdvertiserSession(req);
    if (!adv) {
      return res.status(401).json({error: 'احراز هویت پنل برند الزامی است.'});
    }
    const schema = z.object({
      city: z.string().min(2).max(50),
      neighborhood: z.string().min(2).max(60),
      address: z.string().max(180).optional().default(''),
      phone: z.string().max(30).optional().default(''),
      servedDishes: z.array(z.string().min(1).max(60)).max(25),
      deliveryNote: z.string().max(180).optional().default(''),
      menuUrl: z.string().max(300).optional().default(''),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({error: 'اطلاعات مکانی رستوران یا کافه معتبر نیست.'});
    }
    if (parsed.data.menuUrl && !deps.isSafeUrl(parsed.data.menuUrl)) {
      return res.status(400).json({error: 'نشانی منو نامعتبر است.'});
    }

    const result = db
      .prepare(
        `UPDATE local_venues
         SET city = ?, neighborhood = ?, address = ?, phone = ?, served_dishes_json = ?, delivery_note = ?, menu_url = ?
         WHERE id = ? AND partner_id = ?`
      )
      .run(
        parsed.data.city.trim(),
        parsed.data.neighborhood.trim(),
        parsed.data.address.trim(),
        parsed.data.phone.trim(),
        JSON.stringify(parsed.data.servedDishes),
        parsed.data.deliveryNote.trim(),
        parsed.data.menuUrl.trim() || null,
        req.params.id,
        adv.partnerId
      );

    if (result.changes === 0) {
      return res.status(404).json({error: 'مجموعه مکانی متعلق به حساب برند شما یافت نشد.'});
    }
    res.json({ok: true});
  });

  // =========================================================================
  // 3. SUPER ADMIN AD MARKETPLACE, AUCTION & FLAGSHIP CONTROL (/api/admin/ad-market/*)
  // =========================================================================

  app.get('/api/admin/ad-market/overview', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const slots = getAdSlots(false);
    const bids = getAdBids();
    const sponsorships = getFlagshipSponsorships();
    const venues = getLocalVenues(false);
    const advertisers = getAdvertiserAccounts();
    const nativeAds = getNativeAds(false);

    const totalImpressions =
      nativeAds.reduce((s, a) => s + a.impressions, 0) +
      sponsorships.reduce((s, sp) => s + sp.impressions, 0) +
      venues.reduce((s, v) => s + v.impressions, 0);
    const totalClicks =
      nativeAds.reduce((s, a) => s + a.clicks, 0) +
      sponsorships.reduce((s, sp) => s + sp.clicks, 0) +
      venues.reduce((s, v) => s + v.clicks, 0);
    const contractedRevenueToman =
      bids.filter((b) => b.status === 'approved').reduce((s, b) => s + b.bidAmountToman, 0) +
      sponsorships.filter((s) => s.status === 'active' || s.status === 'scheduled').reduce((s, sp) => s + sp.priceToman, 0) +
      nativeAds.filter((a) => !a.slotId && a.status === 'active').reduce((s, a) => s + (a.bidAmountToman || 0), 0);

    res.json({
      slots,
      bids,
      sponsorships,
      venues,
      advertisers,
      summary: {
        totalImpressions,
        totalClicks,
        ctrPercent: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0,
        pendingBidsCount: bids.filter((b) => b.status === 'pending').length,
        activeSlotsCount: slots.filter((s) => s.status === 'open').length,
        activeVenuesCount: venues.filter((v) => v.status === 'active').length,
        contractedRevenueToman,
      },
    });
  });

  app.post('/api/admin/ad-market/slots', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const schema = z.object({
      title: z.string().min(3).max(120),
      description: z.string().max(300).optional().default(''),
      format: z.enum(['inline_ingredient', 'contextual_tool', 'feed_editorial_story', 'pantry_companion']),
      mediaType: z.enum(['text', 'click', 'banner']),
      targetCategory: z.string().min(2).max(60),
      pricingModel: z.enum(['fixed', 'auction', 'hybrid']),
      fixedPriceToman: z.number().int().min(0),
      minBidToman: z.number().int().min(0),
      bidStepToman: z.number().int().min(100_000).optional().default(500_000),
      isExclusive: z.boolean().optional().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'مشخصات جایگاه تبلیغاتی معتبر نیست.'});

    const d = parsed.data;
    const id = `slot-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO ad_slots (
        id, title, description, format, media_type, target_category, pricing_model,
        fixed_price_toman, min_bid_toman, bid_step_toman, is_exclusive, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(
      id,
      d.title.trim(),
      d.description.trim(),
      d.format,
      d.mediaType,
      d.targetCategory.trim(),
      d.pricingModel,
      d.fixedPriceToman,
      d.minBidToman,
      d.bidStepToman,
      d.isExclusive ? 1 : 0,
      new Date().toISOString()
    );
    res.status(201).json({id, slots: getAdSlots(false)});
  });

  app.put('/api/admin/ad-market/slots/:id', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const schema = z.object({
      title: z.string().min(3).max(120).optional(),
      description: z.string().max(300).optional(),
      pricingModel: z.enum(['fixed', 'auction', 'hybrid']).optional(),
      fixedPriceToman: z.number().int().min(0).optional(),
      minBidToman: z.number().int().min(0).optional(),
      bidStepToman: z.number().int().min(100_000).optional(),
      isExclusive: z.boolean().optional(),
      status: z.enum(['open', 'paused']).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'داده‌های ویرایش جایگاه معتبر نیست.'});

    const existing = db.prepare('SELECT * FROM ad_slots WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) return res.status(404).json({error: 'جایگاه یافت نشد.'});

    const d = parsed.data;
    db.prepare(`
      UPDATE ad_slots
      SET title = ?, description = ?, pricing_model = ?, fixed_price_toman = ?,
          min_bid_toman = ?, bid_step_toman = ?, is_exclusive = ?, status = ?
      WHERE id = ?
    `).run(
      d.title?.trim() ?? String(existing.title),
      d.description?.trim() ?? String(existing.description),
      d.pricingModel ?? String(existing.pricing_model),
      d.fixedPriceToman ?? Number(existing.fixed_price_toman),
      d.minBidToman ?? Number(existing.min_bid_toman),
      d.bidStepToman ?? Number(existing.bid_step_toman),
      d.isExclusive === undefined ? Number(existing.is_exclusive) : d.isExclusive ? 1 : 0,
      d.status ?? String(existing.status),
      req.params.id
    );
    res.json({ok: true, slots: getAdSlots(false)});
  });

  // Super Admin approves a booking or selects an auction winner
  app.post('/api/admin/ad-market/bids/:id/approve', (req, res) => {
    const session = deps.requireAdmin(req, res, 'ads.manage');
    if (!session) return;

    const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim().slice(0, 200) : '';
    const bid = db.prepare('SELECT * FROM ad_bids WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!bid) return res.status(404).json({error: 'درخواست رزرو یا مزایده یافت نشد.'});
    if (bid.status !== 'pending') {
      return res.status(400).json({error: 'این درخواست قبلاً تعیین تکلیف شده است.'});
    }

    const slot = db.prepare('SELECT * FROM ad_slots WHERE id = ?').get(String(bid.slot_id)) as
      | Record<string, unknown>
      | undefined;
    if (!slot) return res.status(404).json({error: 'جایگاه مرتبط با این درخواست یافت نشد.'});

    const conflict = hasExclusiveSlotConflict(String(bid.slot_id), String(bid.starts_at), String(bid.ends_at));
    if (conflict.conflict) {
      return res.status(409).json({
        error: `تداخل زمانی با رزرو فعال برند «${conflict.partnerName}» (${conflict.startsAt} تا ${conflict.endsAt}) وجود دارد.`,
      });
    }

    const now = new Date().toISOString();
    const newAdId = `nad-${crypto.randomUUID().slice(0, 8)}`;

    const approveTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO native_ads (
          id, partner_id, format, media_type, title, subtitle, editorial_copy, cta_label, target_url,
          utm_source, utm_medium, utm_campaign, recipe_categories_json, match_keywords_json,
          match_categories_json, slot_id, starts_at, ends_at, pricing_mode, bid_amount_toman,
          priority, status, impressions, clicks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, 10, 'active', 0, 0, ?)
      `).run(
        newAdId,
        String(bid.partner_id),
        String(slot.format),
        String(slot.media_type),
        String(bid.title),
        String(bid.subtitle || ''),
        String(bid.editorial_copy || ''),
        String(bid.cta_label || 'مشاهده معرفی برند'),
        bid.target_url ? String(bid.target_url) : null,
        String(bid.utm_source || 'lagheli'),
        String(bid.utm_medium || slot.media_type || 'native_ad'),
        String(bid.utm_campaign || ''),
        String(bid.recipe_categories_json || '[]'),
        String(bid.match_keywords_json || '[]'),
        String(bid.slot_id),
        String(bid.starts_at),
        String(bid.ends_at),
        String(bid.booking_type),
        Number(bid.bid_amount_toman || 0),
        now
      );

      db.prepare(
        `UPDATE ad_bids
         SET status = 'approved', admin_note = ?, created_ad_id = ?, reviewed_at = ?
         WHERE id = ?`
      ).run(adminNote || `تایید و انتخاب برنده توسط ${session.actorName}`, newAdId, now, req.params.id);

      // If slot is exclusive, mark competing overlapping pending bids as outbid
      if (Number(slot.is_exclusive) === 1) {
        const rivals = db
          .prepare("SELECT id, starts_at, ends_at FROM ad_bids WHERE slot_id = ? AND status = 'pending' AND id != ?")
          .all(String(bid.slot_id), req.params.id) as {id: string; starts_at: string; ends_at: string}[];
        for (const rival of rivals) {
          if (checkDateRangeOverlap(String(bid.starts_at), String(bid.ends_at), rival.starts_at, rival.ends_at)) {
            db.prepare(
              `UPDATE ad_bids
               SET status = 'outbid', admin_note = ?, reviewed_at = ?
               WHERE id = ?`
            ).run('جایگاه در این بازه به پیشنهاد برنده مزایده اختصاص یافت.', now, rival.id);
          }
        }
      }
    });

    approveTx();
    res.json({ok: true, createdAdId: newAdId, bids: getAdBids(), slots: getAdSlots(false)});
  });

  app.post('/api/admin/ad-market/bids/:id/reject', (req, res) => {
    const session = deps.requireAdmin(req, res, 'ads.manage');
    if (!session) return;
    const adminNote =
      typeof req.body?.adminNote === 'string' && req.body.adminNote.trim()
        ? req.body.adminNote.trim().slice(0, 200)
        : `رد شده در بررسی سوپرپنل توسط ${session.actorName}`;
    db.prepare("UPDATE ad_bids SET status = 'rejected', admin_note = ?, reviewed_at = ? WHERE id = ?").run(
      adminNote,
      new Date().toISOString(),
      req.params.id
    );
    res.json({ok: true, bids: getAdBids()});
  });

  // Flagship "Powered By" Sponsorship CRUD (1m / 3m / 6m / 12m)
  app.post('/api/admin/ad-market/flagship', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const schema = z.object({
      partnerId: z.string().min(2),
      partnerName: z.string().min(2).max(80),
      tagline: z.string().min(4).max(140),
      ctaLabel: z.string().min(2).max(40).optional().default('آشنایی با حامی'),
      targetUrl: z.string().max(300).optional().default(''),
      utmCampaign: z.string().max(80).optional().default(''),
      duration: z.enum(['1m', '3m', '6m', '12m']),
      priceToman: z.number().int().min(0),
      startsAt: z.string().refine(isIsoDate, 'تاریخ شروع نامعتبر است.'),
      endsAt: z.string().refine(isIsoDate, 'تاریخ پایان نامعتبر است.'),
      status: z.enum(['active', 'scheduled', 'paused']).optional().default('active'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات قرارداد حامی پرچمدار معتبر نیست.'});
    if (parsed.data.targetUrl && !deps.isSafeUrl(parsed.data.targetUrl)) {
      return res.status(400).json({error: 'نشانی مقصد نامعتبر است.'});
    }

    const d = parsed.data;
    const id = `flagship-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      if (d.status === 'active') {
        db.prepare("UPDATE flagship_sponsorships SET status = 'paused' WHERE status = 'active'").run();
      }
      db.prepare(`
        INSERT INTO flagship_sponsorships (
          id, partner_id, partner_name, tagline, cta_label, target_url, utm_campaign,
          duration, price_toman, starts_at, ends_at, status, impressions, clicks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      `).run(
        id,
        d.partnerId,
        d.partnerName.trim(),
        d.tagline.trim(),
        d.ctaLabel.trim(),
        d.targetUrl.trim() || null,
        d.utmCampaign.trim(),
        d.duration,
        d.priceToman,
        d.startsAt,
        d.endsAt,
        d.status,
        now
      );
    });
    tx();
    res.status(201).json({id, sponsorships: getFlagshipSponsorships()});
  });

  app.put('/api/admin/ad-market/flagship/:id', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const status = req.body?.status as 'active' | 'scheduled' | 'paused' | 'ended' | undefined;
    if (!status || !['active', 'scheduled', 'paused', 'ended'].includes(status)) {
      return res.status(400).json({error: 'وضعیت انتخاب‌شده معتبر نیست.'});
    }
    const tx = db.transaction(() => {
      if (status === 'active') {
        db.prepare("UPDATE flagship_sponsorships SET status = 'paused' WHERE status = 'active' AND id != ?").run(
          req.params.id
        );
      }
      db.prepare('UPDATE flagship_sponsorships SET status = ? WHERE id = ?').run(status, req.params.id);
    });
    tx();
    res.json({ok: true, sponsorships: getFlagshipSponsorships()});
  });

  // Nearby Local Venues Management (Restaurants, Cafes & Fast-Foods)
  app.post('/api/admin/ad-market/venues', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const schema = z.object({
      partnerId: z.string().nullable().optional(),
      name: z.string().min(2).max(100),
      venueType: z.enum(['restaurant', 'cafe', 'fastfood']),
      city: z.string().min(2).max(50),
      neighborhood: z.string().min(2).max(60),
      address: z.string().max(200).optional().default(''),
      phone: z.string().max(30).optional().default(''),
      lat: z.number().min(-90).max(90).optional().default(35.7575),
      lng: z.number().min(-180).max(180).optional().default(51.4099),
      servedDishes: z.array(z.string().min(1).max(60)).max(30),
      servedCategories: z.array(z.string().min(1).max(40)).max(12),
      deliveryNote: z.string().max(180).optional().default(''),
      menuUrl: z.string().max(300).optional().default(''),
      utmCampaign: z.string().max(80).optional().default(''),
      isFeatured: z.boolean().optional().default(false),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'مشخصات رستوران یا کافه معتبر نیست.'});
    if (parsed.data.menuUrl && !deps.isSafeUrl(parsed.data.menuUrl)) {
      return res.status(400).json({error: 'نشانی منو معتبر نیست.'});
    }

    const d = parsed.data;
    const id = `venue-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO local_venues (
        id, partner_id, name, venue_type, city, neighborhood, address, phone, lat, lng,
        served_dishes_json, served_categories_json, delivery_note, menu_url, utm_campaign,
        is_featured, status, impressions, clicks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 0, ?)
    `).run(
      id,
      d.partnerId || null,
      d.name.trim(),
      d.venueType,
      d.city.trim(),
      d.neighborhood.trim(),
      d.address.trim(),
      d.phone.trim(),
      d.lat,
      d.lng,
      JSON.stringify(d.servedDishes),
      JSON.stringify(d.servedCategories),
      d.deliveryNote.trim(),
      d.menuUrl.trim() || null,
      d.utmCampaign.trim(),
      d.isFeatured ? 1 : 0,
      new Date().toISOString()
    );
    res.status(201).json({id, venues: getLocalVenues(false)});
  });

  app.put('/api/admin/ad-market/venues/:id', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const status = req.body?.status === 'paused' ? 'paused' : 'active';
    db.prepare('UPDATE local_venues SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ok: true, venues: getLocalVenues(false)});
  });

  app.delete('/api/admin/ad-market/venues/:id', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    db.prepare('DELETE FROM local_venues WHERE id = ?').run(req.params.id);
    res.json({ok: true, venues: getLocalVenues(false)});
  });

  // Advertiser Portal Accounts Management from Super Admin
  app.post('/api/admin/ad-market/advertisers', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const schema = z.object({
      partnerId: z.string().min(2),
      loginIdentifier: z.string().min(4).max(100),
      managerName: z.string().min(2).max(80),
      password: z.string().min(6).max(80),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({error: 'اطلاعات حساب مدیر برند معتبر نیست (رمز حداقل ۶ کاراکتر).'});

    const d = parsed.data;
    const dup = db
      .prepare('SELECT 1 FROM advertiser_accounts WHERE lower(login_identifier) = lower(?)')
      .get(d.loginIdentifier.trim());
    if (dup) return res.status(409).json({error: 'این شناسه ورود قبلاً برای یک مدیر برند ثبت شده است.'});

    const id = `adv-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO advertiser_accounts (id, partner_id, login_identifier, manager_name, password_hash, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?)
    `).run(
      id,
      d.partnerId,
      d.loginIdentifier.trim(),
      d.managerName.trim(),
      hashAdvertiserPassword(d.password),
      new Date().toISOString()
    );
    res.status(201).json({id, advertisers: getAdvertiserAccounts()});
  });

  app.put('/api/admin/ad-market/advertisers/:id/status', (req, res) => {
    if (!deps.requireAdmin(req, res, 'ads.manage')) return;
    const status = req.body?.status === 'suspended' ? 'suspended' : 'active';
    db.prepare('UPDATE advertiser_accounts SET status = ? WHERE id = ?').run(status, req.params.id);
    if (status === 'suspended') {
      db.prepare('DELETE FROM advertiser_sessions WHERE advertiser_id = ?').run(req.params.id);
    }
    res.json({ok: true, advertisers: getAdvertiserAccounts()});
  });
}
