import {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  Gavel,
  Link2,
  LogOut,
  MapPin,
  Megaphone,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import {apiRequest, getAdvertiserToken, setAdvertiserToken} from '../lib/api.ts';
import {
  AD_RECIPE_CATEGORIES,
  FLAGSHIP_PACKAGE_CATALOG,
  NATIVE_MEDIA_TYPE_LABELS,
  buildTrackedAdUrl,
} from '../shared/nativeAdEngine.ts';
import {formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdBidOrBooking,
  AdSlotInventory,
  AdvertiserDashboardPayload,
  AdvertiserLiveAuctionPayload,
  ApprovedExecutiveInsightReport,
  LiveAuctionSlotState,
  LocalVenueSuggestion,
  NativeAdFormat,
} from '../shared/types.ts';

interface AdvertiserPortalProps {
  onBackToApp: () => void;
  onNotify: (msg: string) => void;
}

type PortalSection = 'overview' | 'smart_auction' | 'marketplace' | 'bids' | 'venues';

interface DemoAccountSummary {
  id: string;
  partnerId: string;
  partnerName: string;
  managerName: string;
  loginIdentifier: string;
}

const FORMAT_LABELS: Record<NativeAdFormat, string> = {
  inline_ingredient: 'یادداشت درون مواد اولیه',
  contextual_tool: 'پیشنهاد ابزار و جایگزین',
  feed_editorial_story: 'بنر تحریریه‌ای در فید',
  pantry_companion: 'همراه یخچال و لیست خرید',
};

const PRICING_LABELS: Record<AdSlotInventory['pricingModel'], string> = {
  fixed: 'قیمت ثابت',
  auction: 'مزایده جایگاه',
  hybrid: 'قیمت ثابت یا مزایده',
};

const BID_STATUS_LABELS: Record<AdBidOrBooking['status'], string> = {
  pending: 'در انتظار تایید سوپرپنل',
  approved: 'تایید و برنده شد',
  rejected: 'رد شده',
  outbid: 'پیشنهاد بالاتر برنده شد',
};

const BID_STATUS_TONES: Record<AdBidOrBooking['status'], string> = {
  pending: 'text-[#B45309] dark:text-[#FBBF24]',
  approved: 'text-[#15803D] dark:text-[#4ADE80]',
  rejected: 'text-[#B91C1C] dark:text-[#F87171]',
  outbid: 'text-[#6B6B66] dark:text-[#A3A39E]',
};

function defaultDateRange(): {start: string; end: string} {
  const start = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const end = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
  return {start, end};
}

function formatCountdownFa(targetIso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((new Date(targetIso).getTime() - nowMs) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  const pad = (n: number) => toFaDigits(String(n).padStart(2, '0'));
  return days > 0 ? `${toFaDigits(days)} روز و ${pad(hours)}:${pad(mins)}:${pad(secs)}` : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function formatRelativeTimeFa(iso: string, nowMs: number): string {
  const diffSec = Math.max(1, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${toFaDigits(diffSec)} ثانیه پیش`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${toFaDigits(mins)} دقیقه پیش`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${toFaDigits(hours)} ساعت پیش`;
  return `${toFaDigits(Math.floor(hours / 24))} روز پیش`;
}

function estimateInteractiveWinChance(slotState: LiveAuctionSlotState, proposedBid: number): number {
  const base = slotState.slot.minBidToman;
  const highest = Math.max(base, slotState.currentHighestBidToman);
  if (proposedBid < slotState.nextMinimumBidToman) {
    return Math.max(8, Math.min(35, Math.round((proposedBid / Math.max(1, slotState.nextMinimumBidToman)) * 32)));
  }
  const extraSteps = Math.max(0, (proposedBid - highest) / Math.max(1, slotState.slot.bidStepToman));
  const rivalPenalty = slotState.uniqueBiddersCount * 3;
  return Math.min(97, Math.max(58, Math.round(68 + extraSteps * 8 - rivalPenalty)));
}

const COMPETITION_HEAT_META: Record<
  LiveAuctionSlotState['competitionLevel'],
  {label: string; tone: string}
> = {
  heated: {label: 'رقابت داغ', tone: 'text-[#B91C1C] dark:text-[#F87171]'},
  active: {label: 'رقابت فعال', tone: 'text-[#A97222] dark:text-[#ECC06E]'},
  calm: {label: 'فرصت بکر (آرام)', tone: 'text-[#15803D] dark:text-[#4ADE80]'},
};

interface SmartAuctionPanelProps {
  partnerName: string;
  partnerWebsite: string;
  partnerSlug: string;
  liveAuction: AdvertiserLiveAuctionPayload | null;
  demandInsights: ApprovedExecutiveInsightReport[];
  liveLoading: boolean;
  liveSyncEnabled: boolean;
  lastSyncedAt: string | null;
  onToggleLiveSync: () => void;
  onRefreshLive: () => void;
  onBidCommitted: (updatedLive: AdvertiserLiveAuctionPayload) => void;
  onNotify: (msg: string) => void;
}

function SmartAuctionPanel({
  partnerName,
  partnerWebsite,
  partnerSlug,
  liveAuction,
  demandInsights,
  liveLoading,
  liveSyncEnabled,
  lastSyncedAt,
  onToggleLiveSync,
  onRefreshLive,
  onBidCommitted,
  onNotify,
}: SmartAuctionPanelProps) {
  const reduceMotion = useReducedMotion();
  const [slotFilter, setSlotFilter] = useState<'all' | 'recipe_header' | 'mine' | 'خورش' | 'لبنیات' | 'پلو و ته‌چین'>('all');
  const [sortBy, setSortBy] = useState<'heat' | 'highest' | 'lowest_base'>('heat');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Instant bid form state for active room
  const [quickBidAmount, setQuickBidAmount] = useState(0);
  const [quickStart, setQuickStart] = useState(() => defaultDateRange().start);
  const [quickEnd, setQuickEnd] = useState(() => defaultDateRange().end);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCopy, setQuickCopy] = useState('');
  const [quickUrl, setQuickUrl] = useState(partnerWebsite || '');
  const [quickUtm, setQuickUtm] = useState('');
  const [showCreativeFields, setShowCreativeFields] = useState(false);
  const [submittingQuickBid, setSubmittingQuickBid] = useState(false);

  // 1-second tick for crisp live countdowns
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filteredAuctions = useMemo(() => {
    const list = liveAuction?.auctions || [];
    const filtered = list.filter((item) => {
      if (slotFilter === 'all') return true;
      if (slotFilter === 'recipe_header') {
        return item.slot.title.includes('سربرگ') || item.slot.id.includes('header');
      }
      if (slotFilter === 'mine') {
        return item.myStatus !== 'watching';
      }
      return item.slot.targetCategory === slotFilter;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'highest') return b.currentHighestBidToman - a.currentHighestBidToman;
      if (sortBy === 'lowest_base') return a.slot.minBidToman - b.slot.minBidToman;
      // Default: heated & active recipe-header slots first
      const score = (x: LiveAuctionSlotState) =>
        (x.myStatus === 'outbid' ? 50 : 0) +
        (x.slot.title.includes('سربرگ') ? 25 : 0) +
        x.uniqueBiddersCount * 10 +
        x.priceSpreadPercent;
      return score(b) - score(a);
    });
  }, [liveAuction, slotFilter, sortBy]);

  const activeAuction = useMemo(() => {
    if (!filteredAuctions.length) return liveAuction?.auctions[0] || null;
    return filteredAuctions.find((a) => a.slot.id === selectedSlotId) || filteredAuctions[0];
  }, [filteredAuctions, liveAuction, selectedSlotId]);

  // Sync default quick-bid controls whenever the brand switches active auction slot
  useEffect(() => {
    if (!activeAuction) return;
    setSelectedSlotId(activeAuction.slot.id);
    setQuickBidAmount(activeAuction.nextMinimumBidToman);
    if (activeAuction.myLastCreative) {
      setQuickStart(activeAuction.myLastCreative.startsAt);
      setQuickEnd(activeAuction.myLastCreative.endsAt);
      setQuickTitle(activeAuction.myLastCreative.title);
      setQuickCopy(activeAuction.myLastCreative.editorialCopy);
      setQuickUrl(activeAuction.myLastCreative.targetUrl || partnerWebsite || '');
      setQuickUtm(activeAuction.myLastCreative.utmCampaign || `${partnerSlug || 'brand'}_${activeAuction.slot.id}`);
      setShowCreativeFields(false);
    } else {
      const range = defaultDateRange();
      setQuickStart(range.start);
      setQuickEnd(range.end);
      setQuickTitle(`همراهی ویژه ${partnerName} در ${activeAuction.slot.targetCategory}`);
      setQuickCopy(`پیشنهاد منتخب ${partnerName} برای کیفیت بالاتر دستورهای دسته ${activeAuction.slot.targetCategory}.`);
      setQuickUrl(partnerWebsite || '');
      setQuickUtm(`${partnerSlug || 'brand'}_${activeAuction.slot.id}`);
      setShowCreativeFields(true);
    }
  }, [activeAuction?.slot.id, partnerName, partnerSlug, partnerWebsite]);

  // Keep minimum floor updated if a rival raises the bid during live polling
  useEffect(() => {
    if (activeAuction && quickBidAmount < activeAuction.nextMinimumBidToman) {
      setQuickBidAmount(activeAuction.nextMinimumBidToman);
    }
  }, [activeAuction?.nextMinimumBidToman]);

  const liveTrackedUrl = useMemo(
    () =>
      buildTrackedAdUrl(
        quickUrl,
        'lagheli',
        activeAuction?.slot.mediaType || 'banner',
        quickUtm || 'smart_auction'
      ),
    [quickUrl, activeAuction?.slot.mediaType, quickUtm]
  );

  const handleQuickBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAuction) return;
    setSubmittingQuickBid(true);
    try {
      const res = await apiRequest<{message: string; live: AdvertiserLiveAuctionPayload}>(
        '/api/advertiser/auctions/quick-bid',
        {
          method: 'POST',
          useAdvertiser: true,
          body: JSON.stringify({
            slotId: activeAuction.slot.id,
            bidAmountToman: Number(quickBidAmount),
            startsAt: quickStart,
            endsAt: quickEnd,
            title: quickTitle.trim() || `همراهی ویژه ${partnerName}`,
            subtitle: `پیشنهاد مزایده هوشمند برای ${activeAuction.slot.title}`,
            editorialCopy: quickCopy.trim(),
            ctaLabel: `مشاهده معرفی ${partnerName}`,
            targetUrl: quickUrl.trim(),
            utmCampaign: quickUtm.trim(),
            matchKeywords: [activeAuction.slot.targetCategory].filter((c) => c !== 'همه دسته‌ها'),
          }),
        }
      );
      onBidCommitted(res.live);
      onNotify(res.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'ثبت پیشنهاد لحظه‌ای ناموفق بود.');
    } finally {
      setSubmittingQuickBid(false);
    }
  };

  if (!liveAuction) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-8 text-center text-xs text-[#6B6B66] dark:text-[#989892]">
        در حال اتصال به اتاق مزایده هوشمند و دریافت وضعیت لحظه‌ای رقابت...
      </div>
    );
  }

  const sliderMin = activeAuction ? activeAuction.nextMinimumBidToman : 0;
  const sliderMax = activeAuction
    ? Math.max(
        activeAuction.slot.fixedPriceToman > 0 ? Math.round(activeAuction.slot.fixedPriceToman * 1.45) : 0,
        activeAuction.nextMinimumBidToman + activeAuction.slot.bidStepToman * 8
      )
    : 0;
  const interactiveWinProb = activeAuction ? estimateInteractiveWinChance(activeAuction, quickBidAmount) : 0;
  const latestInsight = demandInsights[0] || null;

  return (
    <div className="space-y-5">
      {/* Live Sync Control Strip */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#A97222] dark:text-[#ECC06E]">
            <Activity className="w-4 h-4 shrink-0" />
            <span>
              {liveSyncEnabled
                ? 'پایش لحظه‌ای رقابت فعال است (همگام‌سازی خودکار هر ۵ ثانیه)'
                : 'پایش خودکار موقتاً متوقف شده است'}
            </span>
          </div>
          <p className="text-[11px] text-[#6B6B66] dark:text-[#989892] tabular-nums">
            آخرین همگام‌سازی جدول رقابت:{' '}
            {lastSyncedAt ? formatRelativeTimeFa(lastSyncedAt, nowMs) : 'هم‌اکنون'} · نام برندهای رقیب برای حفظ محرمانگی به‌صورت کدگذاری‌شده نمایش داده می‌شود.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLiveSync}
            className="min-h-[38px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {liveSyncEnabled ? <PauseCircle className="w-3.5 h-3.5 text-[#A97222]" /> : <PlayCircle className="w-3.5 h-3.5 text-[#15803D]" />}
            <span>{liveSyncEnabled ? 'توقف همگام‌سازی' : 'شروع پایش لحظه‌ای'}</span>
          </button>
          <button
            type="button"
            onClick={onRefreshLive}
            disabled={liveLoading}
            className="min-h-[38px] px-3.5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی آنی</span>
          </button>
        </div>
      </section>

      {/* Auction Summary Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
        {[
          {
            label: 'جایگاه‌های باز مزایده',
            value: toFaDigits(liveAuction.summary.activeAuctionSlotsCount),
            hint: 'شامل سربرگ دستورپخت‌های خاص و فید',
          },
          {
            label: 'جایگاه‌های پیشتاز شما (رتبه ۱)',
            value: toFaDigits(liveAuction.summary.leadingSlotsCount),
            hint: 'بالاترین پیشنهاد در صف تایید',
          },
          {
            label: 'نیازمند افزایش پیشنهاد',
            value: toFaDigits(liveAuction.summary.outbidSlotsCount),
            hint: 'رقیب پیشنهاد بالاتری ثبت کرده است',
          },
          {
            label: 'جمع پیشنهادهای فعال برند شما',
            value: formatToman(liveAuction.summary.myTotalActiveBidCommitmentToman),
            hint: 'تعهد در انتظار تایید نهایی سوپرپنل',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-4 space-y-1"
          >
            <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">{kpi.label}</p>
            <p className="text-lg sm:text-xl font-extrabold">{kpi.value}</p>
            <p className="text-[11px] text-[#6B6B66] dark:text-[#84847E]">{kpi.hint}</p>
          </div>
        ))}
      </section>

      {/* Super-Admin-Approved Anonymized Market Demand Signal (Zero PII) */}
      {latestInsight && (
        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FAF8F4] dark:bg-[#161410] p-4 sm:p-5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-extrabold text-[#8C5B12] dark:text-[#ECC06E] inline-flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>شاخص تجمیعی تقاضای مخاطبان لاقلی (تاییدشده توسط مدیریت)</span>
            </span>
            <span className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{latestInsight.title}</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs tabular-nums">
            <div>
              <span className="text-[11px] text-[#7A7A74] block">ساعت اوج بازدید کاربران</span>
              <strong>{latestInsight.summary.peakHourRange}</strong>
            </div>
            <div>
              <span className="text-[11px] text-[#7A7A74] block">سهم مخاطبان موبایل</span>
              <strong>{toFaDigits(latestInsight.summary.mobileSharePercent)}٪</strong>
            </div>
            <div>
              <span className="text-[11px] text-[#7A7A74] block">نرخ رسیدن به عمق ۷۵٪ اسکرول</span>
              <strong>{toFaDigits(latestInsight.summary.scroll75ReachPercent)}٪</strong>
            </div>
            <div>
              <span className="text-[11px] text-[#7A7A74] block">پرتوجه‌ترین جایگاه</span>
              <strong className="truncate block">{latestInsight.summary.bestAttentionSlot}</strong>
            </div>
          </div>
        </section>
      )}

      {/* Filter & Sort Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {id: 'all' as const, label: 'همه جایگاه‌ها'},
            {id: 'recipe_header' as const, label: 'سربرگ دستورپخت‌های خاص'},
            {id: 'خورش' as const, label: 'دسته خورش'},
            {id: 'پلو و ته‌چین' as const, label: 'پلو و ته‌چین'},
            {id: 'لبنیات' as const, label: 'دسته لبنیات'},
            {id: 'mine' as const, label: 'رقابت‌های من'},
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSlotFilter(f.id)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                slotFilter === f.id
                  ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B]'
                  : 'bg-[#FFFFFF] dark:bg-[#141413] border border-[#E6E6E3] dark:border-[#242422] text-[#52524E] dark:text-[#A3A39E]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#7A7A74] text-[11px]">مرتب‌سازی:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'heat' | 'highest' | 'lowest_base')}
            className="min-h-[36px] rounded-xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] px-3 text-xs font-semibold"
          >
            <option value="heat">داغ‌ترین رقابت</option>
            <option value="highest">بالاترین پیشنهاد فعلی</option>
            <option value="lowest_base">کمترین قیمت پایه</option>
          </select>
        </div>
      </div>

      {/* Master-Detail Live Auction Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Right Column (RTL First): Live Auction Slots List */}
        <div className="lg:col-span-5 space-y-2.5">
          {filteredAuctions.length === 0 ? (
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-6 text-center text-xs text-[#6B6B66]">
              جایگاه مزایده‌ای با این فیلتر یافت نشد.
            </div>
          ) : (
            filteredAuctions.map((item) => {
              const selected = activeAuction?.slot.id === item.slot.id;
              const heat = COMPETITION_HEAT_META[item.competitionLevel];
              return (
                <button
                  key={item.slot.id}
                  type="button"
                  onClick={() => setSelectedSlotId(item.slot.id)}
                  className={`w-full text-right rounded-2xl border p-4 transition-colors space-y-2.5 ${
                    selected
                      ? 'border-[#A97222] dark:border-[#D8A85B] bg-[#FFFDF8] dark:bg-[#1C1810]'
                      : 'border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] hover:border-[#A97222]/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#7A7A74] dark:text-[#989892] truncate">
                      {item.slot.targetCategory} · {NATIVE_MEDIA_TYPE_LABELS[item.slot.mediaType]}
                    </span>
                    <span className={`font-bold whitespace-nowrap shrink-0 ${heat.tone}`}>{heat.label}</span>
                  </div>

                  <h3 className="text-sm font-extrabold leading-snug text-[#0D0D0D] dark:text-[#FAFAFA]">
                    {item.slot.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#EFEFED] dark:border-[#242422] text-xs tabular-nums">
                    <div>
                      <span className="text-[11px] text-[#7A7A74] block">
                        {item.currentHighestBidToman > 0 ? 'بالاترین پیشنهاد فعلی' : 'قیمت پایه مزایده'}
                      </span>
                      <strong className="font-extrabold">
                        {formatToman(item.currentHighestBidToman > 0 ? item.currentHighestBidToman : item.slot.minBidToman)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[#7A7A74] block">وضعیت شما</span>
                      <strong
                        className={
                          item.myStatus === 'leading'
                            ? 'text-[#15803D] dark:text-[#4ADE80]'
                            : item.myStatus === 'outbid'
                              ? 'text-[#B91C1C] dark:text-[#F87171]'
                              : 'text-[#6B6B66] dark:text-[#A3A39E]'
                        }
                      >
                        {item.myStatus === 'leading'
                          ? 'پیشتاز (رتبه ۱)'
                          : item.myStatus === 'outbid'
                            ? `رتبه ${toFaDigits(item.myRank || 2)} · نیازمند ارتقا`
                            : `${toFaDigits(item.uniqueBiddersCount)} رقیب فعال`}
                      </strong>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Left Column (RTL Second): Active Slot Live Competition Console */}
        {activeAuction && (
          <div className="lg:col-span-7 space-y-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeAuction.slot.id}
                initial={reduceMotion ? false : {opacity: 0, y: 6}}
                animate={{opacity: 1, y: 0}}
                exit={reduceMotion ? undefined : {opacity: 0, y: -4}}
                transition={{duration: 0.18}}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 sm:p-6 space-y-5"
              >
                {/* Slot Header & Live Countdown */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E6E6E3] dark:border-[#242422] pb-4">
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold text-[#A97222] dark:text-[#ECC06E]">
                      اتاق رقابت زنده · {activeAuction.slot.targetCategory} ·{' '}
                      {activeAuction.slot.isExclusive ? 'جایگاه انحصاری' : 'جایگاه مشترک'}
                    </p>
                    <h3 className="text-base sm:text-lg font-extrabold">{activeAuction.slot.title}</h3>
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                      {activeAuction.slot.description}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#FAF9F7] dark:bg-[#10100F] px-3.5 py-2.5 shrink-0 text-left tabular-nums">
                    <span className="text-[10px] text-[#7A7A74] inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>پایان دوره مزایده</span>
                    </span>
                    <div className="text-xs font-extrabold mt-0.5">
                      {formatCountdownFa(activeAuction.roundEndsAt, nowMs)}
                    </div>
                  </div>
                </div>

                {/* Live Standing & Smart Win Estimator */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 tabular-nums">
                  <div className="rounded-xl border border-[#EFEFED] dark:border-[#242422] bg-[#FAF9F7] dark:bg-[#10100F] p-3.5 space-y-0.5">
                    <span className="text-[11px] text-[#7A7A74]">بالاترین پیشنهاد لحظه‌ای</span>
                    <p className="text-base font-extrabold">
                      {formatToman(
                        activeAuction.currentHighestBidToman > 0
                          ? activeAuction.currentHighestBidToman
                          : activeAuction.slot.minBidToman
                      )}
                    </p>
                    <p className="text-[11px] text-[#6B6B66]">
                      {toFaDigits(activeAuction.uniqueBiddersCount)} برند در رقابت · گام:{' '}
                      {formatToman(activeAuction.slot.bidStepToman)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#EFEFED] dark:border-[#242422] bg-[#FAF9F7] dark:bg-[#10100F] p-3.5 space-y-0.5">
                    <span className="text-[11px] text-[#7A7A74]">جایگاه فعلی برند شما</span>
                    <p
                      className={`text-base font-extrabold ${
                        activeAuction.myStatus === 'leading'
                          ? 'text-[#15803D] dark:text-[#4ADE80]'
                          : activeAuction.myStatus === 'outbid'
                            ? 'text-[#B91C1C] dark:text-[#F87171]'
                            : ''
                      }`}
                    >
                      {activeAuction.myStatus === 'leading'
                        ? 'رتبه ۱ (پیشتاز)'
                        : activeAuction.myStatus === 'outbid'
                          ? `رتبه ${toFaDigits(activeAuction.myRank || 2)} رقابت`
                          : 'بدون پیشنهاد'}
                    </p>
                    <p className="text-[11px] text-[#6B6B66]">
                      {activeAuction.myStatus === 'leading'
                        ? 'پیشنهاد شما بالاترین رقم فعلی است'
                        : `حداقل برای پیشتازی: ${formatToman(activeAuction.nextMinimumBidToman)}`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#EFEFED] dark:border-[#242422] bg-[#FAF9F7] dark:bg-[#10100F] p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#7A7A74]">شانس تخمینی برد با رقم زیر</span>
                      <strong className="text-[#A97222] dark:text-[#ECC06E]">
                        {toFaDigits(interactiveWinProb)}٪
                      </strong>
                    </div>
                    <div className="h-2 rounded-full bg-[#E6E6E3] dark:bg-[#262624] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#A97222] dark:bg-[#D8A85B] transition-all duration-200"
                        style={{width: `${interactiveWinProb}%`}}
                      />
                    </div>
                    <p className="text-[11px] text-[#6B6B66]">
                      {interactiveWinProb >= 80
                        ? 'محدوده بسیار مطمئن برای پیروزی'
                        : interactiveWinProb >= 65
                          ? 'محدوده رقابتی استاندارد'
                          : 'احتمال سبقت رقبا در دقایق پایانی'}
                    </p>
                  </div>
                </div>

                {/* Smart Instant Bidding Console */}
                <form onSubmit={handleQuickBidSubmit} className="space-y-4 pt-2 border-t border-[#E6E6E3] dark:border-[#242422]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold inline-flex items-center gap-1.5">
                      <Gavel className="w-4 h-4 text-[#A97222] dark:text-[#ECC06E]" />
                      <span>ثبت یا افزایش لحظه‌ای پیشنهاد قیمت</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCreativeFields((v) => !v)}
                      className="text-[11px] font-semibold text-[#A97222] dark:text-[#ECC06E] hover:underline"
                    >
                      {showCreativeFields ? 'بستن جزئیات متن و لینک تبلیغ' : 'ویرایش تیتر، بازه زمانی و لینک ردیابی'}
                    </button>
                  </div>

                  {/* Quick Smart Increment Presets */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 tabular-nums">
                    {[
                      {
                        label: 'حداقل گام پیشتازی (+۱)',
                        amount: activeAuction.nextMinimumBidToman,
                      },
                      {
                        label: 'پیشنهاد رقابتی (+۲ گام)',
                        amount: activeAuction.nextMinimumBidToman + activeAuction.slot.bidStepToman,
                      },
                      {
                        label: 'پیشنهاد قاطع (+۳ گام)',
                        amount: activeAuction.nextMinimumBidToman + activeAuction.slot.bidStepToman * 2,
                      },
                    ].map((preset) => {
                      const isCurrent = quickBidAmount === preset.amount;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setQuickBidAmount(preset.amount)}
                          className={`rounded-xl border px-3 py-2.5 text-right transition-colors ${
                            isCurrent
                              ? 'border-[#A97222] dark:border-[#D8A85B] bg-[#FFF8EA] dark:bg-[#241C0F]'
                              : 'border-[#E6E6E3] dark:border-[#2A2A27] hover:border-[#A97222]/60'
                          }`}
                        >
                          <span className="text-[11px] text-[#6B6B66] dark:text-[#989892] block">
                            {preset.label}
                          </span>
                          <strong className="text-xs font-extrabold">{formatToman(preset.amount)}</strong>
                        </button>
                      );
                    })}
                  </div>

                  {/* Slider + Precision Input */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums">
                      <label htmlFor="smart-bid-input" className="font-semibold">
                        مبلغ پیشنهادی شما (تومان)
                      </label>
                      <strong className="text-sm font-extrabold text-[#8C5B12] dark:text-[#ECC06E]">
                        {formatToman(quickBidAmount)}
                      </strong>
                    </div>
                    <input
                      type="range"
                      min={sliderMin}
                      max={sliderMax}
                      step={activeAuction.slot.bidStepToman}
                      value={Math.min(sliderMax, Math.max(sliderMin, quickBidAmount))}
                      onChange={(e) => setQuickBidAmount(Number(e.target.value))}
                      className="w-full accent-[#A97222]"
                    />
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        id="smart-bid-input"
                        type="number"
                        required
                        min={activeAuction.nextMinimumBidToman}
                        step={activeAuction.slot.bidStepToman}
                        value={quickBidAmount}
                        onChange={(e) => setQuickBidAmount(Number(e.target.value))}
                        className="flex-1 min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3.5 text-xs font-bold tabular-nums"
                      />
                      <button
                        type="submit"
                        disabled={submittingQuickBid || quickBidAmount < activeAuction.nextMinimumBidToman}
                        className="min-h-[42px] px-5 rounded-xl bg-[#A97222] hover:bg-[#8E5E18] dark:bg-[#D8A85B] dark:text-[#0B0B0B] text-white text-xs font-extrabold whitespace-nowrap disabled:opacity-50 transition-colors"
                      >
                        {submittingQuickBid
                          ? 'در حال ثبت لحظه‌ای...'
                          : activeAuction.myStatus === 'outbid'
                            ? 'افزایش پیشنهاد و بازپس‌گیری رتبه ۱'
                            : activeAuction.myStatus === 'leading'
                              ? 'تقویت پیشنهاد پیشتاز'
                              : 'ثبت پیشنهاد در مزایده هوشمند'}
                      </button>
                    </div>
                  </div>

                  {/* Optional/Collapsible Creative & Schedule Controls */}
                  {showCreativeFields && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#EFEFED] dark:border-[#242422]">
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold">تاریخ شروع نمایش</span>
                        <input
                          type="date"
                          required
                          value={quickStart}
                          onChange={(e) => setQuickStart(e.target.value)}
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold">تاریخ پایان نمایش</span>
                        <input
                          type="date"
                          required
                          value={quickEnd}
                          onChange={(e) => setQuickEnd(e.target.value)}
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                        />
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[11px] font-semibold">تیتر تحریریه‌ای تبلیغ در این جایگاه</span>
                        <input
                          type="text"
                          required
                          value={quickTitle}
                          onChange={(e) => setQuickTitle(e.target.value)}
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                        />
                      </label>
                      <label className="space-y-1 sm:col-span-2">
                        <span className="text-[11px] font-semibold">توضیح کوتاه غیرمزاحم</span>
                        <input
                          type="text"
                          value={quickCopy}
                          onChange={(e) => setQuickCopy(e.target.value)}
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold">لینک فرود (اختیاری)</span>
                        <input
                          type="url"
                          dir="ltr"
                          value={quickUrl}
                          onChange={(e) => setQuickUrl(e.target.value)}
                          placeholder="https://brand.ir/promo"
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-semibold">شناسه ردیابی کمپین</span>
                        <input
                          type="text"
                          dir="ltr"
                          value={quickUtm}
                          onChange={(e) => setQuickUtm(e.target.value)}
                          className="w-full min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                        />
                      </label>
                      {liveTrackedUrl && (
                        <div className="sm:col-span-2 text-[11px] text-[#6B6B66] dark:text-[#989892] flex items-center gap-1.5 truncate">
                          <Link2 className="w-3.5 h-3.5 shrink-0 text-[#A97222]" />
                          <span dir="ltr" className="truncate">{liveTrackedUrl}</span>
                        </div>
                      )}
                    </div>
                  )}
                </form>

                {/* Live Competitive Leaderboard */}
                <div className="space-y-2.5 pt-3 border-t border-[#E6E6E3] dark:border-[#242422]">
                  <div className="flex items-center justify-between text-xs">
                    <h4 className="font-extrabold inline-flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-[#A97222] dark:text-[#ECC06E]" />
                      <span>جدول زنده رتبه‌بندی پیشنهادهای این جایگاه</span>
                    </h4>
                    <span className="text-[11px] text-[#7A7A74] tabular-nums">
                      {toFaDigits(activeAuction.leaderboard.length)} پیشنهاد فعال در صف
                    </span>
                  </div>

                  {activeAuction.leaderboard.length === 0 ? (
                    <p className="text-xs text-[#6B6B66] dark:text-[#989892] py-4 text-center">
                      هنوز پیشنهادی برای این جایگاه ثبت نشده است؛ اولین پیشنهاد را با قیمت پایه ثبت کنید و رتبه اول را بگیرید.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-xs tabular-nums">
                        <thead className="text-[11px] text-[#7A7A74] dark:text-[#989892] border-b border-[#EFEFED] dark:border-[#242422]">
                          <tr>
                            <th className="py-2 px-2 font-semibold">رتبه</th>
                            <th className="py-2 px-2 font-semibold">پیشنهاددهنده</th>
                            <th className="py-2 px-2 font-semibold">بازه نمایش</th>
                            <th className="py-2 px-2 font-semibold text-left">مبلغ پیشنهاد</th>
                            <th className="py-2 px-2 font-semibold text-left">زمان ثبت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EFEFED] dark:divide-[#242422]">
                          {activeAuction.leaderboard.map((row) => (
                            <tr
                              key={row.id}
                              className={
                                row.isOwn
                                  ? 'bg-[#FFF8EA] dark:bg-[#231B0E] font-bold'
                                  : 'hover:bg-[#FAF9F7] dark:hover:bg-[#181816]'
                              }
                            >
                              <td className="py-2.5 px-2 font-extrabold">
                                {row.rank === 1 ? '۱ (پیشتاز)' : toFaDigits(row.rank)}
                              </td>
                              <td className="py-2.5 px-2">
                                <span>{row.bidderLabel}</span>
                                {row.isOwn && row.title && (
                                  <span className="block text-[10px] font-normal text-[#6B6B66] dark:text-[#A3A39E] truncate max-w-[200px]">
                                    {row.title}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-[11px] text-[#6B6B66] dark:text-[#989892]">
                                {row.startsAt} تا {row.endsAt}
                              </td>
                              <td className="py-2.5 px-2 text-left font-extrabold">
                                {formatToman(row.bidAmountToman)}
                                {row.gapFromLeaderToman > 0 && (
                                  <span className="block text-[10px] font-normal text-[#B91C1C] dark:text-[#F87171]">
                                    -{formatToman(row.gapFromLeaderToman)} از نفر اول
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-left text-[11px] text-[#7A7A74]">
                                {formatRelativeTimeFa(row.createdAt, nowMs)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Recent Real Auction Activity Across Slots */}
            {liveAuction.recentEvents.length > 0 && (
              <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-3">
                <h4 className="text-xs font-extrabold inline-flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-[#A97222] dark:text-[#ECC06E]" />
                  <span>آخرین تحرکات زنده در اتاق مزایده جایگاه‌ها</span>
                </h4>
                <div className="divide-y divide-[#EFEFED] dark:divide-[#242422] text-xs tabular-nums">
                  {liveAuction.recentEvents.slice(0, 6).map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedSlotId(ev.slotId)}
                      className="w-full py-2.5 flex items-center justify-between gap-3 text-right hover:opacity-80 transition-opacity"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate">
                          <span className={ev.isOwn ? 'text-[#8C5B12] dark:text-[#ECC06E] font-extrabold' : ''}>
                            {ev.bidderLabel}
                          </span>{' '}
                          روی «{ev.slotTitle}»
                        </p>
                        <p className="text-[11px] text-[#7A7A74]">{formatRelativeTimeFa(ev.createdAt, nowMs)}</p>
                      </div>
                      <strong className="shrink-0 font-extrabold">{formatToman(ev.bidAmountToman)}</strong>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdvertiserPortal({onBackToApp, onNotify}: AdvertiserPortalProps) {
  const [authed, setAuthed] = useState(Boolean(getAdvertiserToken()));
  const [demoEnabled, setDemoEnabled] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccountSummary[]>([]);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [section, setSection] = useState<PortalSection>('smart_auction');
  const [dashboard, setDashboard] = useState<AdvertiserDashboardPayload | null>(null);
  const [liveAuction, setLiveAuction] = useState<AdvertiserLiveAuctionPayload | null>(null);
  const [demandInsights, setDemandInsights] = useState<ApprovedExecutiveInsightReport[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSyncEnabled, setLiveSyncEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('همه دسته‌ها');

  // Booking / Auction Bid Drawer State
  const [selectedSlot, setSelectedSlot] = useState<AdSlotInventory | null>(null);
  const [bookingType, setBookingType] = useState<'fixed' | 'auction'>('auction');
  const [bidAmount, setBidAmount] = useState(20_000_000);
  const [startsAt, setStartsAt] = useState(() => defaultDateRange().start);
  const [endsAt, setEndsAt] = useState(() => defaultDateRange().end);
  const [adTitle, setAdTitle] = useState('');
  const [adSubtitle, setAdSubtitle] = useState('');
  const [adCopy, setAdCopy] = useState('');
  const [ctaLabel, setCtaLabel] = useState('مشاهده معرفی برند');
  const [targetUrl, setTargetUrl] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [keywordsText, setKeywordsText] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);

  // Local Venue Editor State (for Restaurant / Cafe Advertisers)
  const [editingVenue, setEditingVenue] = useState<LocalVenueSuggestion | null>(null);
  const [venueDishesText, setVenueDishesText] = useState('');
  const [savingVenue, setSavingVenue] = useState(false);

  const loadLiveAuction = useCallback(async (silent = false) => {
    if (!getAdvertiserToken()) return;
    if (!silent) setLiveLoading(true);
    try {
      const [liveData, insightsData] = await Promise.all([
        apiRequest<AdvertiserLiveAuctionPayload>('/api/advertiser/auctions/live', {useAdvertiser: true}),
        apiRequest<{reports: ApprovedExecutiveInsightReport[]}>('/api/advertiser/auctions/demand-insights', {
          useAdvertiser: true,
        }).catch(() => ({reports: []})),
      ]);
      setLiveAuction(liveData);
      setDemandInsights(insightsData.reports || []);
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Handled by dashboard auth check
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!getAdvertiserToken()) return;
    setLoading(true);
    try {
      const data = await apiRequest<AdvertiserDashboardPayload>('/api/advertiser/dashboard', {
        useAdvertiser: true,
      });
      setDashboard(data);
      setAuthed(true);
    } catch {
      setAdvertiserToken(null);
      setAuthed(false);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    apiRequest<{demoEnabled: boolean; accounts: DemoAccountSummary[]}>('/api/advertiser/demo-accounts')
      .then((res) => {
        setDemoEnabled(res.demoEnabled);
        setDemoAccounts(res.accounts || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (authed) {
      loadDashboard();
      loadLiveAuction();
    }
  }, [authed, loadDashboard, loadLiveAuction]);

  // Real-time 5-second live sync while inside Smart Auction Room
  useEffect(() => {
    if (!authed || section !== 'smart_auction' || !liveSyncEnabled) return;
    const id = window.setInterval(() => {
      loadLiveAuction(true);
    }, 5000);
    return () => window.clearInterval(id);
  }, [authed, section, liveSyncEnabled, loadLiveAuction]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await apiRequest<{token: string}>('/api/advertiser/login', {
        method: 'POST',
        body: JSON.stringify({identifier, password}),
      });
      setAdvertiserToken(res.token);
      setAuthed(true);
      setPassword('');
      onNotify('ورود به پنل اختصاصی برند با موفقیت انجام شد.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'ورود ناموفق بود.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async (accountId: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await apiRequest<{token: string}>('/api/advertiser/demo-login', {
        method: 'POST',
        body: JSON.stringify({accountId}),
      });
      setAdvertiserToken(res.token);
      setAuthed(true);
      onNotify('نشست آزمایشی پنل برند فعال شد.');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'ورود آزمایشی ناموفق بود.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiRequest('/api/advertiser/logout', {method: 'POST', useAdvertiser: true}).catch(() => {});
    setAdvertiserToken(null);
    setAuthed(false);
    setDashboard(null);
    onNotify('از پنل اختصاصی تبلیغ‌دهندگان خارج شدید.');
  };

  const openSlotBooking = (slot: AdSlotInventory) => {
    setSelectedSlot(slot);
    const defaultType = slot.pricingModel === 'fixed' ? 'fixed' : 'auction';
    setBookingType(defaultType);
    const nextMinBid =
      slot.highestPendingBidToman && slot.highestPendingBidToman > 0
        ? Math.max(slot.minBidToman, slot.highestPendingBidToman + slot.bidStepToman)
        : slot.minBidToman;
    setBidAmount(defaultType === 'fixed' ? slot.fixedPriceToman : nextMinBid);
    const range = defaultDateRange();
    setStartsAt(range.start);
    setEndsAt(range.end);
    setAdTitle('');
    setAdSubtitle('');
    setAdCopy('');
    setCtaLabel('مشاهده معرفی برند');
    setTargetUrl(dashboard?.partner?.website || '');
    setUtmCampaign(`${dashboard?.partner?.slug || 'brand'}_${slot.id}`);
    setKeywordsText(slot.targetCategory === 'همه دسته‌ها' ? '' : slot.targetCategory);
  };

  const trackedPreviewUrl = useMemo(
    () =>
      buildTrackedAdUrl(
        targetUrl,
        'lagheli',
        selectedSlot?.mediaType || 'native_ad',
        utmCampaign || 'brand_campaign'
      ),
    [targetUrl, selectedSlot?.mediaType, utmCampaign]
  );

  const handleSubmitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setSubmittingBid(true);
    try {
      const keywords = keywordsText
        .split(/[،,]/)
        .map((k) => k.trim())
        .filter(Boolean);
      const res = await apiRequest<{message: string}>('/api/advertiser/bids', {
        method: 'POST',
        useAdvertiser: true,
        body: JSON.stringify({
          slotId: selectedSlot.id,
          bookingType,
          bidAmountToman: bookingType === 'fixed' ? selectedSlot.fixedPriceToman : Number(bidAmount),
          startsAt,
          endsAt,
          title: adTitle,
          subtitle: adSubtitle,
          editorialCopy: adCopy,
          ctaLabel,
          targetUrl,
          utmSource: 'lagheli',
          utmMedium: selectedSlot.mediaType,
          utmCampaign,
          recipeCategories: [selectedSlot.targetCategory],
          matchKeywords: keywords,
        }),
      });
      onNotify(res.message);
      setSelectedSlot(null);
      setSection('bids');
      await loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'ثبت درخواست با خطا مواجه شد.');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleToggleAdStatus = async (adId: string, nextStatus: 'active' | 'paused') => {
    try {
      await apiRequest(`/api/advertiser/ads/${adId}/status`, {
        method: 'PUT',
        useAdvertiser: true,
        body: JSON.stringify({status: nextStatus}),
      });
      onNotify(nextStatus === 'active' ? 'کمپین مجدداً فعال شد.' : 'نمایش کمپین متوقف شد.');
      await loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'به‌روزرسانی وضعیت ناموفق بود.');
    }
  };

  const handleCopyUrl = (url: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => onNotify('لینک ردیابی کپی شد.')).catch(() => {});
    }
  };

  const handleSaveVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVenue) return;
    setSavingVenue(true);
    try {
      const dishes = venueDishesText
        .split(/[،,]/)
        .map((d) => d.trim())
        .filter(Boolean);
      await apiRequest(`/api/advertiser/venues/${editingVenue.id}`, {
        method: 'PUT',
        useAdvertiser: true,
        body: JSON.stringify({
          city: editingVenue.city,
          neighborhood: editingVenue.neighborhood,
          address: editingVenue.address,
          phone: editingVenue.phone,
          servedDishes: dishes,
          deliveryNote: editingVenue.deliveryNote,
          menuUrl: editingVenue.menuUrl || '',
        }),
      });
      onNotify('اطلاعات مکانی و منوی مجموعه ذخیره شد.');
      setEditingVenue(null);
      await loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره اطلاعات مجموعه.');
    } finally {
      setSavingVenue(false);
    }
  };

  // =========================================================================
  // ISOLATED ADVERTISER LOGIN VIEW
  // =========================================================================
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA] flex items-center justify-center p-4">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Brand Portal Context Panel */}
          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[#B54B1F] dark:text-[#E29A6F]">
                  پورتال اختصاصی برندها و همکاران تجاری لاقلی
                </span>
                <button
                  type="button"
                  onClick={onBackToApp}
                  className="text-xs text-[#6B6B66] dark:text-[#989892] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>بازگشت به لاقلی</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold leading-snug text-balance">
                پنل مدیریت جایگاه‌های تبلیغاتی، مزایده و آمار زنده برندها
              </h1>
              <p className="text-xs sm:text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                این فضا به‌طور کامل از کاربران عادی اپلیکیشن و سوپرپنل مدیریت جداست. هر برند تنها آمار نمایش، کلیک، لینک‌های ردیابی و پیشنهادهای مزایده متعلق به حساب خود را مدیریت می‌کند.
              </p>

              <div className="pt-2 space-y-3 border-t border-[#E6E6E3] dark:border-[#242422] text-xs text-[#4A4A46] dark:text-[#B5B5B0]">
                <p>۰۱. انتخاب جایگاه بر اساس دسته دستورپخت (خورش، لبنیات، پاستا، نوشیدنی)</p>
                <p>۰۲. رزرو با قیمت ثابت یا رقابت در مزایده برای بازه زمانی انحصاری</p>
                <p>۰۳. رصد شفاف نمایش، کلیک، نرخ کلیک و لینک ردیابی بازاریابی</p>
              </div>
            </div>

            <div className="text-[11px] text-[#7A7A74] dark:text-[#84847E] border-t border-[#E6E6E3] dark:border-[#242422] pt-4">
              تمام رزروها و برندگان مزایده پس از بررسی هارمونی توسط سوپرپنل مدیریت منتشر می‌شوند.
            </div>
          </div>

          {/* Login Form + Preview Demo Accounts */}
          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-6 sm:p-8 space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-extrabold">ورود مدیر برند</h2>
                <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                  شناسه سازمانی و رمز عبور اختصاصی دریافت‌شده از تیم بازاریابی لاقلی را وارد کنید.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#52524E] dark:text-[#C4C4BE]">
                    ایمیل یا شناسه ورود برند
                  </span>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="مثلاً kalleh@brand.ir"
                    dir="ltr"
                    className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3.5 text-sm outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-xs font-medium text-[#52524E] dark:text-[#C4C4BE]">رمز عبور</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3.5 text-sm outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
                  />
                </label>
              </div>

              {authError && (
                <p role="alert" className="text-xs font-medium text-[#B91C1C] dark:text-[#F87171]">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full min-h-[44px] rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {authLoading ? 'در حال بررسی...' : 'ورود به پنل برند'}
              </button>
            </form>

            {demoEnabled && demoAccounts.length > 0 && (
              <div className="pt-5 border-t border-[#E6E6E3] dark:border-[#242422] space-y-3">
                <p className="text-xs font-bold text-[#52524E] dark:text-[#C4C4BE]">
                  ورود سریع آزمایشی به عنوان مدیر برند:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {demoAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={authLoading}
                      onClick={() => handleDemoLogin(acc.id)}
                      className="text-right rounded-xl border border-[#E6E6E3] dark:border-[#282825] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] px-3.5 py-2.5 transition-colors space-y-0.5"
                    >
                      <div className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        {acc.partnerName}
                      </div>
                      <div className="text-[11px] text-[#7A7A74] dark:text-[#989892] truncate">
                        {acc.managerName}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // AUTHENTICATED ADVERTISER WORKSPACE (SaaS 260px Sidebar + Content Canvas)
  // =========================================================================
  const filteredSlots = (dashboard?.slots || []).filter(
    (s) => categoryFilter === 'همه دسته‌ها' || s.targetCategory === categoryFilter
  );

  return (
    <div className="min-h-screen bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA] flex flex-col lg:flex-row">
      {/* Left/Right RTL Sidebar (260px on desktop) */}
      <aside className="w-full lg:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-l border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#121211] p-5 flex flex-col justify-between gap-6">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-[#B54B1F] dark:text-[#E29A6F]">
              پنل مستقل تبلیغ‌دهندگان
            </p>
            <h1 className="text-base font-extrabold truncate">
              {dashboard?.account.partnerName || 'حساب برند'}
            </h1>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892] truncate">
              {dashboard?.account.managerName}
            </p>
          </div>

          <nav className="grid grid-cols-2 lg:grid-cols-1 gap-1.5" aria-label="بخش‌های پنل برند">
            {[
              {id: 'smart_auction' as PortalSection, label: 'مزایده هوشمند (زنده)', icon: Flame},
              {id: 'overview' as PortalSection, label: 'آمار و کمپین‌های من', icon: BarChart3},
              {id: 'marketplace' as PortalSection, label: 'بازارچه جایگاه و پکیج', icon: Gavel},
              {id: 'bids' as PortalSection, label: 'سوابق درخواست‌ها', icon: Calendar},
              {id: 'venues' as PortalSection, label: 'رستوران و کافه مکانی', icon: Store},
            ].map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSection(item.id)}
                  className={`min-h-[42px] px-3.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B]'
                      : 'text-[#52524E] dark:text-[#A3A39E] hover:bg-[#F3F2EE] dark:hover:bg-[#1C1C1A]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2.5 truncate">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.id === 'smart_auction' && liveAuction && liveAuction.summary.outbidSlotsCount > 0 && (
                    <span className="text-[10px] font-extrabold text-[#B91C1C] dark:text-[#F87171] tabular-nums shrink-0">
                      {toFaDigits(liveAuction.summary.outbidSlotsCount)}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-[#E6E6E3] dark:border-[#242422] flex lg:flex-col gap-2">
          <button
            type="button"
            onClick={onBackToApp}
            className="flex-1 min-h-[40px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-semibold hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] inline-flex items-center justify-center gap-1.5"
          >
            <span>مشاهده اپلیکیشن لاقلی</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-[#B91C1C] dark:text-[#F87171] hover:bg-red-500/10 inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج از حساب برند</span>
          </button>
        </div>
      </aside>

      {/* Main Content Canvas */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        {/* Top Bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#E6E6E3] dark:border-[#242422]">
          <div className="space-y-0.5">
            <p className="text-xs text-[#7A7A74] dark:text-[#989892]">
              پنل برندها / {dashboard?.account.partnerName || 'مدیریت تبلیغات'}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold">
              {section === 'smart_auction' && 'اتاق مزایده هوشمند و رصد لحظه‌ای رقابت'}
              {section === 'overview' && 'گزارش عملکرد و کمپین‌های فعال'}
              {section === 'marketplace' && 'بازارچه جایگاه‌های تبلیغاتی و پکیج پرچمدار'}
              {section === 'bids' && 'پیگیری رزروها و پیشنهادهای مزایده'}
              {section === 'venues' && 'مدیریت معرفی مکانی رستوران و کافه'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadDashboard();
                loadLiveAuction();
              }}
              disabled={loading || liveLoading}
              className="min-h-[40px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#141413] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || liveLoading ? 'animate-spin' : ''}`} />
              <span>بروزرسانی آمار</span>
            </button>
            <button
              type="button"
              onClick={() => setSection(section === 'smart_auction' ? 'marketplace' : 'smart_auction')}
              className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold whitespace-nowrap"
            >
              {section === 'smart_auction' ? 'مشاهده همه جایگاه‌ها' : 'ورود به مزایده هوشمند'}
            </button>
          </div>
        </header>

        {/* SECTION 0: LIVE SMART AUCTION ROOM */}
        {section === 'smart_auction' && (
          <SmartAuctionPanel
            partnerName={dashboard?.account.partnerName || 'برند شما'}
            partnerWebsite={dashboard?.partner?.website || ''}
            partnerSlug={dashboard?.partner?.slug || 'brand'}
            liveAuction={liveAuction}
            demandInsights={demandInsights}
            liveLoading={liveLoading}
            liveSyncEnabled={liveSyncEnabled}
            lastSyncedAt={lastSyncedAt}
            onToggleLiveSync={() => setLiveSyncEnabled((v) => !v)}
            onRefreshLive={() => loadLiveAuction(false)}
            onBidCommitted={(updatedLive) => {
              setLiveAuction(updatedLive);
              setLastSyncedAt(new Date().toISOString());
              loadDashboard();
            }}
            onNotify={onNotify}
          />
        )}

        {/* KPI Strip (Visible in Overview / Marketplace / Bids / Venues) */}
        {dashboard && section !== 'smart_auction' && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="شاخص‌های کلیدی عملکرد برند">
            {[
              {
                label: 'مجموع نمایش (بازدید)',
                value: toFaDigits(dashboard.summary.totalImpressions.toLocaleString('en-US')),
                hint: 'کل نمایش‌های ثبت‌شده برند',
              },
              {
                label: 'مجموع کلیک‌های ثبت‌شده',
                value: toFaDigits(dashboard.summary.totalClicks.toLocaleString('en-US')),
                hint: 'کلیک روی کارت و لینک ردیابی',
              },
              {
                label: 'نرخ کلیک میانگین',
                value: `${toFaDigits(String(dashboard.summary.ctrPercent))}٪`,
                hint: 'کیفیت تعامل مخاطبان هدف',
              },
              {
                label: 'کمپین فعال / در انتظار',
                value: `${toFaDigits(String(dashboard.summary.activeAdsCount))} / ${toFaDigits(String(dashboard.summary.pendingBidsCount))}`,
                hint: 'تایید نهایی توسط سوپرپنل',
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-4 space-y-1"
              >
                <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">{kpi.label}</p>
                <p className="text-xl sm:text-2xl font-extrabold tabular-nums">{kpi.value}</p>
                <p className="text-[11px] text-[#6B6B66] dark:text-[#84847E]">{kpi.hint}</p>
              </div>
            ))}
          </section>
        )}

        {/* SECTION 1: OVERVIEW & LIVE ADS */}
        {section === 'overview' && dashboard && (
          <div className="space-y-6">
            {/* Flagship Sponsorship Card if this brand holds one */}
            {dashboard.sponsorships.length > 0 && (
              <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-[#B54B1F] dark:text-[#E29A6F]">
                  <Sparkles className="w-4 h-4" />
                  <span>قرارداد جایگاه پرچمدار «قدرت گرفته از ...»</span>
                </div>
                {dashboard.sponsorships.map((sp) => (
                  <div
                    key={sp.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-[#E6E6E3] dark:border-[#242422]"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold">
                        قدرت گرفته از {sp.partnerName} — {sp.tagline}
                      </p>
                      <p className="text-xs text-[#6B6B66] dark:text-[#989892] tabular-nums">
                        بازه: {sp.startsAt} تا {sp.endsAt} · مبلغ قرارداد: {formatToman(sp.priceToman)}
                      </p>
                    </div>
                    <div className="flex items-center gap-5 text-xs tabular-nums shrink-0">
                      <div>
                        <span className="text-[#7A7A74] block">نمایش نوار و فوتر</span>
                        <strong className="text-sm font-extrabold">
                          {toFaDigits(sp.impressions.toLocaleString('en-US'))}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[#7A7A74] block">کلیک</span>
                        <strong className="text-sm font-extrabold">
                          {toFaDigits(sp.clicks.toLocaleString('en-US'))}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Brand Active & Paused Native Ads Table */}
            <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] overflow-hidden">
              <div className="p-5 border-b border-[#E6E6E3] dark:border-[#242422] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">تبلیغات بومی ثبت‌شده برای برند شما</h3>
                  <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                    آمار لحظه‌ای نمایش، کلیک و لینک ردیابی اختصاصی هر جایگاه
                  </p>
                </div>
              </div>

              {dashboard.ads.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm font-semibold">هنوز کمپین تاییدشده‌ای برای برند شما فعال نشده است.</p>
                  <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                    از بخش «بازارچه جایگاه و مزایده» جایگاه دلخواه خود را رزرو یا پیشنهاد قیمت ثبت کنید.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSection('marketplace')}
                    className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
                  >
                    مشاهده جایگاه‌های باز
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#F9F8F6] dark:bg-[#181816] text-[#6B6B66] dark:text-[#989892] border-b border-[#E6E6E3] dark:border-[#242422]">
                      <tr>
                        <th className="py-3 px-4 font-semibold">عنوان و جایگاه</th>
                        <th className="py-3 px-4 font-semibold">نوع و دسته‌ها</th>
                        <th className="py-3 px-4 font-semibold text-left">نمایش</th>
                        <th className="py-3 px-4 font-semibold text-left">کلیک</th>
                        <th className="py-3 px-4 font-semibold text-left">نرخ کلیک</th>
                        <th className="py-3 px-4 font-semibold">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E3] dark:divide-[#242422]">
                      {dashboard.ads.map((ad) => {
                        const ctr =
                          ad.impressions > 0 ? Math.round((ad.clicks / ad.impressions) * 1000) / 10 : 0;
                        const tracked = buildTrackedAdUrl(
                          ad.targetUrl,
                          ad.utmSource || 'lagheli',
                          ad.utmMedium || ad.mediaType || ad.format,
                          ad.utmCampaign || `ad_${ad.id}`
                        );
                        return (
                          <tr key={ad.id} className="hover:bg-[#FAF9F7] dark:hover:bg-[#181816]">
                            <td className="py-3.5 px-4 space-y-0.5 max-w-xs">
                              <p className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{ad.title}</p>
                              <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
                                {FORMAT_LABELS[ad.format]}
                                {ad.startsAt && ad.endsAt ? ` · ${ad.startsAt} تا ${ad.endsAt}` : ''}
                              </p>
                            </td>
                            <td className="py-3.5 px-4 text-[#52524E] dark:text-[#B5B5B0]">
                              <div>{NATIVE_MEDIA_TYPE_LABELS[ad.mediaType || 'text']}</div>
                              <div className="text-[11px] text-[#7A7A74] dark:text-[#84847E]">
                                {(ad.recipeCategories || []).join('، ') || 'عمومی'}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-left font-semibold tabular-nums">
                              {toFaDigits(ad.impressions.toLocaleString('en-US'))}
                            </td>
                            <td className="py-3.5 px-4 text-left font-semibold tabular-nums">
                              {toFaDigits(ad.clicks.toLocaleString('en-US'))}
                            </td>
                            <td className="py-3.5 px-4 text-left font-semibold tabular-nums">
                              {toFaDigits(String(ctr))}٪
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleToggleAdStatus(ad.id, ad.status === 'active' ? 'paused' : 'active')
                                  }
                                  className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#2C2C29] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                                >
                                  {ad.status === 'active' ? (
                                    <>
                                      <PauseCircle className="w-3.5 h-3.5 text-[#B45309]" />
                                      <span>توقف موقت</span>
                                    </>
                                  ) : (
                                    <>
                                      <PlayCircle className="w-3.5 h-3.5 text-[#15803D]" />
                                      <span>فعال‌سازی</span>
                                    </>
                                  )}
                                </button>
                                {tracked && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyUrl(tracked)}
                                    title="کپی لینک ردیابی بازاریابی"
                                    className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#2C2C29] text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>لینک ردیابی</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* SECTION 2: OPEN SLOTS MARKETPLACE & AUCTION */}
        {section === 'marketplace' && dashboard && (
          <div className="space-y-5">
            {/* Category Filter Buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {AD_RECIPE_CATEGORIES.slice(0, 8).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    categoryFilter === cat
                      ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B]'
                      : 'bg-[#FFFFFF] dark:bg-[#141413] border border-[#E6E6E3] dark:border-[#242422] text-[#52524E] dark:text-[#A3A39E]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSlots.map((slot) => (
                <article
                  key={slot.id}
                  className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
                      <span>{NATIVE_MEDIA_TYPE_LABELS[slot.mediaType]}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>دسته: {slot.targetCategory}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>{slot.isExclusive ? 'انحصاری' : 'مشترک'}</span>
                    </div>

                    <h3 className="text-sm sm:text-base font-extrabold">{slot.title}</h3>
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                      {slot.description}
                    </p>

                    <div className="pt-2 border-t border-[#E6E6E3] dark:border-[#242422] grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[11px] text-[#7A7A74] block">مدل عرضه</span>
                        <strong className="font-bold">{PRICING_LABELS[slot.pricingModel]}</strong>
                      </div>
                      <div>
                        <span className="text-[11px] text-[#7A7A74] block">
                          {slot.pricingModel === 'auction' ? 'پایه مزایده' : 'قیمت ثابت ماهانه'}
                        </span>
                        <strong className="font-bold tabular-nums">
                          {formatToman(slot.pricingModel === 'auction' ? slot.minBidToman : slot.fixedPriceToman)}
                        </strong>
                      </div>
                    </div>

                    {slot.activePartnerName && (
                      <p className="text-[11px] text-[#B45309] dark:text-[#FBBF24] tabular-nums">
                        رزرو فعال فعلی: {slot.activePartnerName} ({slot.activeStartsAt} تا {slot.activeEndsAt}) — بازه‌های بعدی قابل رزرو هستند.
                      </p>
                    )}

                    {slot.highestPendingBidToman ? (
                      <p className="text-[11px] text-[#15803D] dark:text-[#4ADE80] tabular-nums">
                        بالاترین پیشنهاد در صف مزایده: {formatToman(slot.highestPendingBidToman)} ({toFaDigits(String(slot.pendingBidsCount || 0))} پیشنهاد)
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => openSlotBooking(slot)}
                    className="w-full min-h-[42px] rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    {slot.pricingModel === 'fixed'
                      ? 'رزرو با قیمت ثابت'
                      : slot.pricingModel === 'auction'
                        ? 'ثبت پیشنهاد در مزایده'
                        : 'رزرو یا شرکت در مزایده'}
                  </button>
                </article>
              ))}
            </div>

            {/* Flagship Package Reference Table */}
            <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-[#B54B1F] dark:text-[#E29A6F]">
                  جایگاه پرچمدار و انحصاری کل اپلیکیشن
                </p>
                <h3 className="text-base font-extrabold">
                  پکیج‌های «قدرت گرفته از ...» (نوار بالای صفحه و فوتر تمام صفحات)
                </h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  قرارداد این جایگاه ویژه پس از هماهنگی مستقیم توسط سوپرپنل مدیریت فعال می‌شود.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {FLAGSHIP_PACKAGE_CATALOG.map((pkg) => (
                  <div
                    key={pkg.duration}
                    className="rounded-xl border border-[#E6E6E3] dark:border-[#262624] p-4 space-y-2"
                  >
                    <p className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{pkg.label}</p>
                    <p className="text-base font-extrabold tabular-nums text-[#B54B1F] dark:text-[#E29A6F]">
                      {formatToman(pkg.recommendedPriceToman)}
                    </p>
                    <p className="text-[11px] text-[#6B6B66] dark:text-[#989892] leading-relaxed">
                      {pkg.pitch}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* SECTION 3: SUBMITTED BIDS & BOOKINGS */}
        {section === 'bids' && dashboard && (
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] overflow-hidden">
            <div className="p-5 border-b border-[#E6E6E3] dark:border-[#242422]">
              <h3 className="text-sm font-extrabold">سوابق رزرو و پیشنهادهای مزایده برند شما</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                نتیجه بررسی و تایید نهایی سوپرپنل مدیریت در این جدول به‌روزرسانی می‌شود.
              </p>
            </div>
            {dashboard.bids.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B6B66] dark:text-[#989892]">
                تاکنون درخواست رزرو یا پیشنهاد مزایده‌ای ثبت نکرده‌اید.
              </div>
            ) : (
              <div className="divide-y divide-[#E6E6E3] dark:divide-[#242422]">
                {dashboard.bids.map((b) => (
                  <div key={b.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
                        <span>{b.slotTitle}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span>{b.bookingType === 'fixed' ? 'رزرو قیمت ثابت' : 'پیشنهاد مزایده'}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span className="tabular-nums">
                          {b.startsAt} تا {b.endsAt}
                        </span>
                      </div>
                      <p className="text-sm font-bold">{b.title}</p>
                      {b.adminNote && (
                        <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          یادداشت مدیریت: {b.adminNote}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-left">
                        <p className="text-sm font-extrabold tabular-nums">{formatToman(b.bidAmountToman)}</p>
                        <p className={`text-xs font-bold ${BID_STATUS_TONES[b.status]}`}>
                          {BID_STATUS_LABELS[b.status]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 4: LOCAL VENUES (FOR RESTAURANTS / CAFES LIKE SOO) */}
        {section === 'venues' && dashboard && (
          <section className="space-y-4">
            {dashboard.venues.length === 0 ? (
              <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-8 text-center space-y-2">
                <MapPin className="w-6 h-6 mx-auto text-[#7A7A74]" />
                <p className="text-sm font-bold">هیچ شعبه رستوران، کافه یا فست‌فود مکانی به حساب این برند متصل نیست.</p>
                <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                  اگر رستوران یا کافه دارید، از طریق سوپرپنل مدیریت شعبه خود را متصل کنید تا در صفحه دستورپخت‌های مرتبط به کاربران نزدیک نمایش داده شوید.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.venues.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
                          {v.city} · محله {v.neighborhood} · {v.status === 'active' ? 'فعال در صفحه دستورپخت‌ها' : 'متوقف'}
                        </p>
                        <h3 className="text-base font-extrabold">{v.name}</h3>
                        <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                          غذاها و نوشیدنی‌های سرو‌شده: {v.servedDishes.join('، ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-xs tabular-nums">
                        <div>
                          <span className="text-[#7A7A74] block">نمایش مکانی</span>
                          <strong className="text-sm font-extrabold">
                            {toFaDigits(v.impressions.toLocaleString('en-US'))}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#7A7A74] block">کلیک منو/تماس</span>
                          <strong className="text-sm font-extrabold">
                            {toFaDigits(v.clicks.toLocaleString('en-US'))}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVenue(v);
                            setVenueDishesText(v.servedDishes.join('، '));
                          }}
                          className="min-h-[38px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] font-semibold hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA]"
                        >
                          ویرایش منو و محله
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Booking & Auction Bid Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitBid}
            className="w-full max-w-2xl rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#141413] p-5 sm:p-6 space-y-4 my-auto"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#E6E6E3] dark:border-[#242422] pb-3">
              <div>
                <p className="text-[11px] text-[#B54B1F] dark:text-[#E29A6F] font-semibold">
                  {selectedSlot.targetCategory} · {NATIVE_MEDIA_TYPE_LABELS[selectedSlot.mediaType]}
                </p>
                <h3 className="text-base font-extrabold">{selectedSlot.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="text-xs text-[#6B6B66] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]"
              >
                بستن
              </button>
            </div>

            {selectedSlot.pricingModel === 'hybrid' && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#F3F2EE] dark:bg-[#1D1D1B]">
                <button
                  type="button"
                  onClick={() => {
                    setBookingType('fixed');
                    setBidAmount(selectedSlot.fixedPriceToman);
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
                    bookingType === 'fixed'
                      ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#0D0D0D] dark:text-[#FAFAFA]'
                      : 'text-[#6B6B66]'
                  }`}
                >
                  رزرو با قیمت ثابت ({formatToman(selectedSlot.fixedPriceToman)})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingType('auction');
                    setBidAmount(
                      selectedSlot.highestPendingBidToman
                        ? Math.max(
                            selectedSlot.minBidToman,
                            selectedSlot.highestPendingBidToman + selectedSlot.bidStepToman
                          )
                        : selectedSlot.minBidToman
                    );
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
                    bookingType === 'auction'
                      ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#0D0D0D] dark:text-[#FAFAFA]'
                      : 'text-[#6B6B66]'
                  }`}
                >
                  شرکت در مزایده جایگاه
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold">تاریخ شروع</span>
                <input
                  type="date"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">تاریخ پایان</span>
                <input
                  type="date"
                  required
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">
                  {bookingType === 'fixed' ? 'مبلغ قطعی (تومان)' : 'پیشنهاد شما (تومان)'}
                </span>
                <input
                  type="number"
                  required
                  disabled={bookingType === 'fixed'}
                  step={selectedSlot.bidStepToman}
                  min={selectedSlot.minBidToman}
                  value={bookingType === 'fixed' ? selectedSlot.fixedPriceToman : bidAmount}
                  onChange={(e) => setBidAmount(Number(e.target.value))}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums disabled:opacity-70"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold">تیتر اصلی تبلیغ</span>
                <input
                  type="text"
                  required
                  value={adTitle}
                  onChange={(e) => setAdTitle(e.target.value)}
                  placeholder="مثلاً بافت عالی ته‌چین با ماست چکیده تازه"
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">زیرتیتر کوتاه</span>
                <input
                  type="text"
                  value={adSubtitle}
                  onChange={(e) => setAdSubtitle(e.target.value)}
                  placeholder="توصیه اختصاصی برای دستورهای مرتبط"
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">متن تحریریه‌ای آرام و غیرتبلیغاتی</span>
              <textarea
                rows={2}
                value={adCopy}
                onChange={(e) => setAdCopy(e.target.value)}
                placeholder="توضیحی مفید و کوتاه درباره مزیت محصول شما برای آشپز..."
                className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] p-3 text-xs"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold">لینک صفحه فرود (اختیاری)</span>
                <input
                  type="url"
                  dir="ltr"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://brand.ir/promo"
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">شناسه ردیابی کمپین</span>
                <input
                  type="text"
                  dir="ltr"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  placeholder="autumn_promo_1405"
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">متن دکمه</span>
                <input
                  type="text"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">کلیدواژه‌های هدف (با ویرگول جدا کنید)</span>
              <input
                type="text"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="خورش، ماست، کره، قابلمه"
                className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
            </label>

            {trackedPreviewUrl && (
              <div className="rounded-xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FAF9F7] dark:bg-[#10100F] px-3 py-2 flex items-center gap-2 text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
                <Link2 className="w-3.5 h-3.5 shrink-0 text-[#B54B1F]" />
                <span dir="ltr" className="truncate">
                  {trackedPreviewUrl}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E6E6E3] dark:border-[#242422]">
              <button
                type="button"
                onClick={() => setSelectedSlot(null)}
                className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={submittingBid}
                className="min-h-[40px] px-5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold disabled:opacity-50"
              >
                {submittingBid ? 'در حال ارسال...' : 'ارسال برای تایید سوپرپنل'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Local Venue Edit Modal */}
      {editingVenue && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveVenue}
            className="w-full max-w-lg rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-4"
          >
            <h3 className="text-base font-extrabold">ویرایش اطلاعات مکانی «{editingVenue.name}»</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs font-semibold">شهر</span>
                <input
                  type="text"
                  required
                  value={editingVenue.city}
                  onChange={(e) => setEditingVenue({...editingVenue, city: e.target.value})}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold">محله</span>
                <input
                  type="text"
                  required
                  value={editingVenue.neighborhood}
                  onChange={(e) => setEditingVenue({...editingVenue, neighborhood: e.target.value})}
                  className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">غذاها و نوشیدنی‌های سرو‌شده (با ویرگول جدا کنید)</span>
              <textarea
                rows={2}
                value={venueDishesText}
                onChange={(e) => setVenueDishesText(e.target.value)}
                className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] p-3 text-xs"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">توضیح سرو و ارسال</span>
              <input
                type="text"
                value={editingVenue.deliveryNote}
                onChange={(e) => setEditingVenue({...editingVenue, deliveryNote: e.target.value})}
                className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-semibold">لینک منو یا سفارش</span>
              <input
                type="url"
                dir="ltr"
                value={editingVenue.menuUrl || ''}
                onChange={(e) => setEditingVenue({...editingVenue, menuUrl: e.target.value})}
                className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
            </label>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingVenue(null)}
                className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-semibold"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={savingVenue}
                className="min-h-[40px] px-5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
              >
                {savingVenue ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
