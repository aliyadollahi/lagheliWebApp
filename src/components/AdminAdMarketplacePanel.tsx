import {useCallback, useEffect, useState} from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Gavel,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {
  AD_RECIPE_CATEGORIES,
  FLAGSHIP_PACKAGE_CATALOG,
  NATIVE_MEDIA_TYPE_LABELS,
} from '../shared/nativeAdEngine.ts';
import {formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdBidOrBooking,
  AdSlotInventory,
  AdvertiserAccount,
  FlagshipPackageDuration,
  FlagshipSponsorship,
  LocalVenueSuggestion,
  LocalVenueType,
  NativeAdFormat,
  NativeAdMediaType,
  Partner,
} from '../shared/types.ts';

interface AdminAdMarketplacePanelProps {
  partners: Partner[];
  onRefreshAppConfig: () => void;
  onNotify: (msg: string) => void;
}

interface AdMarketOverviewResponse {
  slots: AdSlotInventory[];
  bids: AdBidOrBooking[];
  sponsorships: FlagshipSponsorship[];
  venues: LocalVenueSuggestion[];
  advertisers: AdvertiserAccount[];
  summary: {
    totalImpressions: number;
    totalClicks: number;
    ctrPercent: number;
    pendingBidsCount: number;
    activeSlotsCount: number;
    activeVenuesCount: number;
    contractedRevenueToman: number;
  };
}

type SubTab = 'bids' | 'slots' | 'flagship' | 'venues' | 'advertisers';

const DURATION_LABELS: Record<FlagshipPackageDuration, string> = {
  '1m': '۱ ماهه',
  '3m': '۳ ماهه',
  '6m': '۶ ماهه',
  '12m': '۱ ساله',
};

const VENUE_TYPE_LABELS: Record<LocalVenueType, string> = {
  restaurant: 'رستوران',
  cafe: 'کافه',
  fastfood: 'فست‌فود',
};

export function AdminAdMarketplacePanel({
  partners,
  onRefreshAppConfig,
  onNotify,
}: AdminAdMarketplacePanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('bids');
  const [data, setData] = useState<AdMarketOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Create Slot form
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [newSlot, setNewSlot] = useState({
    title: '',
    description: '',
    format: 'feed_editorial_story' as NativeAdFormat,
    mediaType: 'banner' as NativeAdMediaType,
    targetCategory: 'خورش',
    pricingModel: 'hybrid' as AdSlotInventory['pricingModel'],
    fixedPriceToman: 22_000_000,
    minBidToman: 15_000_000,
    bidStepToman: 1_000_000,
    isExclusive: true,
  });

  // Create Flagship form
  const [flagshipFormOpen, setFlagshipFormOpen] = useState(false);
  const [newFlagship, setNewFlagship] = useState({
    partnerId: partners[0]?.id || 'prt-kalleh',
    partnerName: partners[0]?.name || 'کاله',
    tagline: '',
    ctaLabel: 'آشنایی با حامی',
    targetUrl: '',
    utmCampaign: 'lagheli_flagship',
    duration: '3m' as FlagshipPackageDuration,
    priceToman: 120_000_000,
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  });

  // Create Local Venue form
  const [venueFormOpen, setVenueFormOpen] = useState(false);
  const [newVenue, setNewVenue] = useState({
    partnerId: '',
    name: '',
    venueType: 'restaurant' as LocalVenueType,
    city: 'تهران',
    neighborhood: 'ونک',
    address: '',
    phone: '',
    lat: 35.7575,
    lng: 51.4099,
    dishesText: 'ته‌چین، فسنجان، قورمه‌سبزی',
    categoriesText: 'خورش، پلو و ته‌چین',
    deliveryNote: '',
    menuUrl: '',
    isFeatured: true,
  });

  // Create Advertiser Account form
  const [advFormOpen, setAdvFormOpen] = useState(false);
  const [newAdv, setNewAdv] = useState({
    partnerId: partners[0]?.id || 'prt-kalleh',
    loginIdentifier: '',
    managerName: '',
    password: '',
  });

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdMarketOverviewResponse>('/api/admin/ad-market/overview', {
        useAdmin: true,
      });
      setData(res);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بارگذاری بازارچه تبلیغات.');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleApproveBid = async (bid: AdBidOrBooking) => {
    try {
      await apiRequest(`/api/admin/ad-market/bids/${bid.id}/approve`, {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({
          adminNote: `تایید و انتخاب برنده برای جایگاه ${bid.slotTitle}`,
        }),
      });
      onNotify(`پیشنهاد برند «${bid.partnerName}» تایید و تبلیغ آن در اپلیکیشن فعال شد.`);
      await loadOverview();
      onRefreshAppConfig();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تایید درخواست.');
    }
  };

  const handleRejectBid = async (bid: AdBidOrBooking) => {
    try {
      await apiRequest(`/api/admin/ad-market/bids/${bid.id}/reject`, {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({adminNote: 'پیشنهاد در ارزیابی نهایی تایید نشد.'}),
      });
      onNotify(`درخواست برند «${bid.partnerName}» رد شد.`);
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در رد درخواست.');
    }
  };

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/ad-market/slots', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify(newSlot),
      });
      onNotify('جایگاه تبلیغاتی جدید در بازارچه برندها منتشر شد.');
      setSlotFormOpen(false);
      setNewSlot({...newSlot, title: '', description: ''});
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ایجاد جایگاه.');
    }
  };

  const handleToggleSlotStatus = async (slot: AdSlotInventory) => {
    try {
      await apiRequest(`/api/admin/ad-market/slots/${slot.id}`, {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify({status: slot.status === 'open' ? 'paused' : 'open'}),
      });
      onNotify('وضعیت عرضه جایگاه به‌روزرسانی شد.');
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تغییر وضعیت جایگاه.');
    }
  };

  const handleCreateFlagship = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/ad-market/flagship', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({...newFlagship, status: 'active'}),
      });
      onNotify('جایگاه پرچمدار «قدرت گرفته از ...» در بالای صفحه و فوتر فعال شد.');
      setFlagshipFormOpen(false);
      await loadOverview();
      onRefreshAppConfig();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت حامی پرچمدار.');
    }
  };

  const handleFlagshipStatus = async (id: string, status: FlagshipSponsorship['status']) => {
    try {
      await apiRequest(`/api/admin/ad-market/flagship/${id}`, {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify({status}),
      });
      onNotify('وضعیت قرارداد حامی پرچمدار به‌روزرسانی شد.');
      await loadOverview();
      onRefreshAppConfig();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تغییر وضعیت.');
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/ad-market/venues', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({
          partnerId: newVenue.partnerId || null,
          name: newVenue.name,
          venueType: newVenue.venueType,
          city: newVenue.city,
          neighborhood: newVenue.neighborhood,
          address: newVenue.address,
          phone: newVenue.phone,
          lat: Number(newVenue.lat),
          lng: Number(newVenue.lng),
          servedDishes: newVenue.dishesText.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
          servedCategories: newVenue.categoriesText.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
          deliveryNote: newVenue.deliveryNote,
          menuUrl: newVenue.menuUrl,
          isFeatured: newVenue.isFeatured,
        }),
      });
      onNotify('رستوران/کافه مکانی جدید ثبت شد و در دستورپخت‌های مرتبط نمایش داده می‌شود.');
      setVenueFormOpen(false);
      setNewVenue({...newVenue, name: '', address: '', phone: '', deliveryNote: '', menuUrl: ''});
      await loadOverview();
      onRefreshAppConfig();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت مجموعه مکانی.');
    }
  };

  const handleDeleteVenue = async (id: string) => {
    try {
      await apiRequest(`/api/admin/ad-market/venues/${id}`, {method: 'DELETE', useAdmin: true});
      onNotify('مجموعه مکانی حذف شد.');
      await loadOverview();
      onRefreshAppConfig();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف.');
    }
  };

  const handleCreateAdvertiser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/ad-market/advertisers', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify(newAdv),
      });
      onNotify('حساب مستقل مدیر برند ایجاد شد.');
      setAdvFormOpen(false);
      setNewAdv({...newAdv, loginIdentifier: '', managerName: '', password: ''});
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ایجاد حساب برند.');
    }
  };

  const handleToggleAdvertiser = async (acc: AdvertiserAccount) => {
    try {
      await apiRequest(`/api/admin/ad-market/advertisers/${acc.id}/status`, {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify({status: acc.status === 'active' ? 'suspended' : 'active'}),
      });
      onNotify('وضعیت دسترسی پنل برند به‌روزرسانی شد.');
      await loadOverview();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تغییر وضعیت حساب.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Advertiser Portal Quick Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E6E3] dark:border-[#242422]">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold">بازارچه جایگاه‌ها، مزایده، حامی پرچمدار و پنل برندها</h2>
          <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
            کنترل کامل نرخ‌ها، تایید نهایی برندگان مزایده، قرارداد ۱ تا ۱۲ ماهه «قدرت گرفته از ...» و رستوران‌های مکانی
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadOverview}
            disabled={loading}
            className="min-h-[38px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>
          <a
            href="/?portal=advertiser"
            className="min-h-[38px] px-3.5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>مشاهده پنل برندها</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* KPI Strip */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              label: 'در صف تایید رزرو و مزایده',
              value: toFaDigits(String(data.summary.pendingBidsCount)),
              sub: 'نیازمند بررسی و انتخاب برنده',
            },
            {
              label: 'مجموع نمایش شبکه تبلیغات',
              value: toFaDigits(data.summary.totalImpressions.toLocaleString('en-US')),
              sub: `کلیک کل: ${toFaDigits(data.summary.totalClicks.toLocaleString('en-US'))} (${toFaDigits(String(data.summary.ctrPercent))}٪)`,
            },
            {
              label: 'جایگاه باز / رستوران مکانی',
              value: `${toFaDigits(String(data.summary.activeSlotsCount))} / ${toFaDigits(String(data.summary.activeVenuesCount))}`,
              sub: 'آماده فروش و نمایش هوشمند',
            },
            {
              label: 'ارزش قراردادهای فعال',
              value: formatToman(data.summary.contractedRevenueToman),
              sub: 'رزروها، مزایده‌ها و حامی پرچمدار',
            },
          ].map((k) => (
            <div
              key={k.label}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-4 space-y-1"
            >
              <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">{k.label}</p>
              <p className="text-lg font-extrabold tabular-nums">{k.value}</p>
              <p className="text-[11px] text-[#6B6B66] dark:text-[#84847E]">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Segmented Sub-navigation */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#EFEFED] dark:bg-[#181816]">
        {[
          {id: 'bids' as SubTab, label: `صف تایید و مزایده (${toFaDigits(String(data?.summary.pendingBidsCount || 0))})`},
          {id: 'slots' as SubTab, label: 'موجودی جایگاه‌ها'},
          {id: 'flagship' as SubTab, label: 'جایگاه «قدرت گرفته از ...»'},
          {id: 'venues' as SubTab, label: 'رستوران‌ها و کافه‌های مکانی'},
          {id: 'advertisers' as SubTab, label: 'حساب مدیران برندها'},
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
              subTab === tab.id
                ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#0D0D0D] dark:text-[#FAFAFA] shadow-sm'
                : 'text-[#6B6B66] dark:text-[#989892] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: AUCTION & BOOKING APPROVAL QUEUE */}
      {subTab === 'bids' && data && (
        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] divide-y divide-[#E6E6E3] dark:divide-[#242422]">
          {data.bids.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#6B6B66]">هیچ درخواست رزرو یا مزایده‌ای ثبت نشده است.</div>
          ) : (
            data.bids.map((bid) => (
              <div key={bid.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#7A7A74] dark:text-[#989892]">
                    <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{bid.partnerName}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bid.slotTitle}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bid.bookingType === 'fixed' ? 'قیمت ثابت' : 'مزایده'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">
                      {bid.startsAt} تا {bid.endsAt}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold">{bid.title}</p>
                  {bid.editorialCopy && (
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{bid.editorialCopy}</p>
                  )}
                  <div className="text-[11px] text-[#7A7A74] dark:text-[#84847E]">
                    دسته‌ها: {bid.recipeCategories.join('، ')}
                    {bid.utmCampaign ? ` · شناسه ردیابی: ${bid.utmCampaign}` : ''}
                    {bid.adminNote ? ` · یادداشت: ${bid.adminNote}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <div className="text-left">
                    <p className="text-sm font-extrabold tabular-nums">{formatToman(bid.bidAmountToman)}</p>
                    <p className="text-[11px] text-[#7A7A74]">
                      {bid.status === 'pending' && 'در انتظار تایید'}
                      {bid.status === 'approved' && 'تایید و فعال شد'}
                      {bid.status === 'rejected' && 'رد شده'}
                      {bid.status === 'outbid' && 'رقابت واگذار شد'}
                    </p>
                  </div>

                  {bid.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveBid(bid)}
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تایید و انتخاب برنده</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectBid(bid)}
                        className="min-h-[38px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] text-xs font-semibold text-[#B91C1C] dark:text-[#F87171] inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>رد</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* TAB 2: SLOT INVENTORY */}
      {subTab === 'slots' && data && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSlotFormOpen((v) => !v)}
              className="min-h-[38px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تعریف جایگاه جدید</span>
            </button>
          </div>

          {slotFormOpen && (
            <form
              onSubmit={handleCreateSlot}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-4"
            >
              <h3 className="text-sm font-extrabold">ایجاد جایگاه جدید در بازارچه برندها</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="عنوان جایگاه (مثلاً بنر دسته خورش)"
                  value={newSlot.title}
                  onChange={(e) => setNewSlot({...newSlot, title: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <select
                  value={newSlot.targetCategory}
                  onChange={(e) => setNewSlot({...newSlot, targetCategory: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  {AD_RECIPE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={newSlot.pricingModel}
                  onChange={(e) => setNewSlot({...newSlot, pricingModel: e.target.value as AdSlotInventory['pricingModel']})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  <option value="hybrid">قیمت ثابت و مزایده</option>
                  <option value="fixed">فقط قیمت ثابت</option>
                  <option value="auction">فقط مزایده</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <select
                  value={newSlot.mediaType}
                  onChange={(e) => setNewSlot({...newSlot, mediaType: e.target.value as NativeAdMediaType})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  <option value="banner">بنری در فید</option>
                  <option value="click">کلیکی با لینک ردیابی</option>
                  <option value="text">متنی تحریریه‌ای</option>
                </select>
                <select
                  value={newSlot.format}
                  onChange={(e) => setNewSlot({...newSlot, format: e.target.value as NativeAdFormat})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  <option value="feed_editorial_story">کارت فید دستورپخت</option>
                  <option value="inline_ingredient">زیر مواد اولیه</option>
                  <option value="contextual_tool">بخش ابزار و جایگزین</option>
                  <option value="pantry_companion">یخچال و لیست خرید</option>
                </select>
                <input
                  type="number"
                  value={newSlot.fixedPriceToman}
                  onChange={(e) => setNewSlot({...newSlot, fixedPriceToman: Number(e.target.value)})}
                  placeholder="قیمت ثابت (تومان)"
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                />
                <input
                  type="number"
                  value={newSlot.minBidToman}
                  onChange={(e) => setNewSlot({...newSlot, minBidToman: Number(e.target.value)})}
                  placeholder="کف مزایده (تومان)"
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                />
              </div>
              <input
                type="text"
                placeholder="توضیح کوتاه برای مدیران برندها"
                value={newSlot.description}
                onChange={(e) => setNewSlot({...newSlot, description: e.target.value})}
                className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={newSlot.isExclusive}
                    onChange={(e) => setNewSlot({...newSlot, isExclusive: e.target.checked})}
                  />
                  <span>جایگاه انحصاری در بازه زمانی</span>
                </label>
                <button
                  type="submit"
                  className="min-h-[38px] px-5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
                >
                  ثبت جایگاه
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.slots.map((slot) => (
              <div
                key={slot.id}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] text-[#7A7A74]">
                      {slot.targetCategory} · {NATIVE_MEDIA_TYPE_LABELS[slot.mediaType]} · {slot.isExclusive ? 'انحصاری' : 'مشترک'}
                    </p>
                    <h4 className="text-sm font-extrabold">{slot.title}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleSlotStatus(slot)}
                    className="min-h-[32px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#2C2C29] text-[11px] font-semibold"
                  >
                    {slot.status === 'open' ? 'بستن موقت' : 'بازگشایی'}
                  </button>
                </div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{slot.description}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums pt-1 border-t border-[#E6E6E3] dark:border-[#242422]">
                  <span>قیمت ثابت: <strong>{formatToman(slot.fixedPriceToman)}</strong></span>
                  <span>کف مزایده: <strong>{formatToman(slot.minBidToman)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: FLAGSHIP "POWERED BY" SPONSORSHIP */}
      {subTab === 'flagship' && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              نمایش در نوار ظریف بالای صفحه و فوتر تمام صفحات اپلیکیشن با بسته‌های ۱، ۳، ۶ و ۱۲ ماهه
            </p>
            <button
              type="button"
              onClick={() => setFlagshipFormOpen((v) => !v)}
              className="min-h-[38px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>ثبت قرارداد حامی جدید</span>
            </button>
          </div>

          {flagshipFormOpen && (
            <form
              onSubmit={handleCreateFlagship}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-4"
            >
              <h3 className="text-sm font-extrabold">ثبت پکیج جدید «قدرت گرفته از ...»</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FLAGSHIP_PACKAGE_CATALOG.map((pkg) => (
                  <button
                    key={pkg.duration}
                    type="button"
                    onClick={() => {
                      const start = new Date().toISOString().slice(0, 10);
                      const end = new Date(Date.now() + pkg.months * 30 * 86400000).toISOString().slice(0, 10);
                      setNewFlagship({
                        ...newFlagship,
                        duration: pkg.duration,
                        priceToman: pkg.recommendedPriceToman,
                        startsAt: start,
                        endsAt: end,
                      });
                    }}
                    className={`rounded-xl border p-3 text-right transition-colors ${
                      newFlagship.duration === pkg.duration
                        ? 'border-[#0D0D0D] dark:border-[#FAFAFA] bg-[#F9F8F6] dark:bg-[#1D1D1B]'
                        : 'border-[#E6E6E3] dark:border-[#262624]'
                    }`}
                  >
                    <p className="text-xs font-bold">{pkg.label}</p>
                    <p className="text-[11px] tabular-nums text-[#B54B1F] dark:text-[#E29A6F]">
                      {formatToman(pkg.recommendedPriceToman)}
                    </p>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select
                  value={newFlagship.partnerId}
                  onChange={(e) => {
                    const p = partners.find((item) => item.id === e.target.value);
                    setNewFlagship({
                      ...newFlagship,
                      partnerId: e.target.value,
                      partnerName: p?.name || newFlagship.partnerName,
                    });
                  }}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="نام نمایشی برند (مثلاً کاله)"
                  value={newFlagship.partnerName}
                  onChange={(e) => setNewFlagship({...newFlagship, partnerName: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="number"
                  required
                  value={newFlagship.priceToman}
                  onChange={(e) => setNewFlagship({...newFlagship, priceToman: Number(e.target.value)})}
                  placeholder="مبلغ قرارداد (تومان)"
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs tabular-nums"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="شعار کوتاه یک‌خطی حامی"
                  value={newFlagship.tagline}
                  onChange={(e) => setNewFlagship({...newFlagship, tagline: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://brand.ir"
                  value={newFlagship.targetUrl}
                  onChange={(e) => setNewFlagship({...newFlagship, targetUrl: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[40px] px-5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
                >
                  فعال‌سازی حامی پرچمدار
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] divide-y divide-[#E6E6E3] dark:divide-[#242422]">
            {data.sponsorships.map((sp) => (
              <div key={sp.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-[11px] text-[#7A7A74]">
                    <span>پکیج {DURATION_LABELS[sp.duration]}</span>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span className="tabular-nums">{sp.startsAt} تا {sp.endsAt}</span>
                    <span aria-hidden="true" className="mx-1.5">·</span>
                    <span className={sp.status === 'active' ? 'text-[#15803D] font-bold' : ''}>
                      {sp.status === 'active' ? 'فعال در کل اپ' : 'متوقف'}
                    </span>
                  </div>
                  <p className="text-sm font-extrabold">
                    قدرت گرفته از {sp.partnerName} — {sp.tagline}
                  </p>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                    مبلغ قرارداد: {formatToman(sp.priceToman)} · نمایش: {toFaDigits(sp.impressions.toLocaleString('en-US'))} · کلیک: {toFaDigits(sp.clicks.toLocaleString('en-US'))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFlagshipStatus(sp.id, sp.status === 'active' ? 'paused' : 'active')}
                  className="min-h-[38px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] text-xs font-semibold whitespace-nowrap"
                >
                  {sp.status === 'active' ? 'توقف نمایش' : 'فعال‌سازی'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: LOCAL VENUES */}
      {subTab === 'venues' && data && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setVenueFormOpen((v) => !v)}
              className="min-h-[38px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>افزودن رستوران یا کافه مکانی</span>
            </button>
          </div>

          {venueFormOpen && (
            <form
              onSubmit={handleCreateVenue}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 space-y-3"
            >
              <h3 className="text-sm font-extrabold">ثبت رستوران، کافه یا فست‌فود سروکننده دستورپخت‌ها</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  placeholder="نام مجموعه (مثلاً رستوران سو)"
                  value={newVenue.name}
                  onChange={(e) => setNewVenue({...newVenue, name: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <select
                  value={newVenue.venueType}
                  onChange={(e) => setNewVenue({...newVenue, venueType: e.target.value as LocalVenueType})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  <option value="restaurant">رستوران</option>
                  <option value="cafe">کافه</option>
                  <option value="fastfood">فست‌فود</option>
                </select>
                <select
                  value={newVenue.partnerId}
                  onChange={(e) => setNewVenue({...newVenue, partnerId: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                >
                  <option value="">اتصال به برند همکار (اختیاری)</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  placeholder="شهر"
                  value={newVenue.city}
                  onChange={(e) => setNewVenue({...newVenue, city: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="text"
                  required
                  placeholder="محله"
                  value={newVenue.neighborhood}
                  onChange={(e) => setNewVenue({...newVenue, neighborhood: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="text"
                  placeholder="شماره تماس"
                  value={newVenue.phone}
                  onChange={(e) => setNewVenue({...newVenue, phone: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://venue.ir/menu"
                  value={newVenue.menuUrl}
                  onChange={(e) => setNewVenue({...newVenue, menuUrl: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="غذاها/نوشیدنی‌های سرو‌شده (با ویرگول)"
                  value={newVenue.dishesText}
                  onChange={(e) => setNewVenue({...newVenue, dishesText: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
                <input
                  type="text"
                  placeholder="توضیح سرو یا محدوده ارسال"
                  value={newVenue.deliveryNote}
                  onChange={(e) => setNewVenue({...newVenue, deliveryNote: e.target.value})}
                  className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[38px] px-5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
                >
                  ثبت مجموعه
                </button>
              </div>
            </form>
          )}

          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] divide-y divide-[#E6E6E3] dark:divide-[#242422]">
            {data.venues.map((v) => (
              <div key={v.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-[#7A7A74]">
                    {VENUE_TYPE_LABELS[v.venueType]} · {v.city}، {v.neighborhood} · نمایش:{' '}
                    <span className="tabular-nums">{toFaDigits(String(v.impressions))}</span> · کلیک:{' '}
                    <span className="tabular-nums">{toFaDigits(String(v.clicks))}</span>
                  </div>
                  <p className="text-sm font-bold">{v.name}</p>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    منوی تطبیقی: {v.servedDishes.join('، ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteVenue(v.id)}
                  className="min-h-[36px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] text-xs text-[#B91C1C] dark:text-[#F87171] inline-flex items-center gap-1 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: ISOLATED ADVERTISER ACCOUNTS */}
      {subTab === 'advertisers' && data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              حساب‌های اختصاصی مدیران برندها در مسیر مستقل پنل تبلیغ‌دهندگان (کاملاً جدا از کاربران عادی اپ)
            </p>
            <button
              type="button"
              onClick={() => setAdvFormOpen((v) => !v)}
              className="min-h-[38px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5" />
              <span>ساخت حساب مدیر برند</span>
            </button>
          </div>

          {advFormOpen && (
            <form
              onSubmit={handleCreateAdvertiser}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              <select
                value={newAdv.partnerId}
                onChange={(e) => setNewAdv({...newAdv, partnerId: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="نام مدیر برند"
                value={newAdv.managerName}
                onChange={(e) => setNewAdv({...newAdv, managerName: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
              <input
                type="text"
                required
                dir="ltr"
                placeholder="brand@company.ir"
                value={newAdv.loginIdentifier}
                onChange={(e) => setNewAdv({...newAdv, loginIdentifier: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
              <input
                type="password"
                required
                dir="ltr"
                placeholder="رمز عبور (حداقل ۶ کاراکتر)"
                value={newAdv.password}
                onChange={(e) => setNewAdv({...newAdv, password: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
              >
                ایجاد حساب
              </button>
            </form>
          )}

          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#141413] divide-y divide-[#E6E6E3] dark:divide-[#242422]">
            {data.advertisers.map((acc) => (
              <div key={acc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">{acc.partnerName} — {acc.managerName}</p>
                  <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                    شناسه ورود: <span dir="ltr">{acc.loginIdentifier}</span> · وضعیت:{' '}
                    <strong>{acc.status === 'active' ? 'فعال' : 'معلق'}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleAdvertiser(acc)}
                  className="min-h-[36px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] text-xs font-semibold whitespace-nowrap"
                >
                  {acc.status === 'active' ? 'تعلیق دسترسی' : 'فعال‌سازی مجدد'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
