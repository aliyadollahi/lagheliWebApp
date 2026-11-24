import {useEffect, useState} from 'react';
import {BadgeCheck, Building2, Copy, ExternalLink, MapPin, Phone, Plus, Search, ShieldCheck, X} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {PARTNER_ROLES, PARTNER_ROLE_LABELS, formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {EcosystemConfig, Partner, PartnerRoleId, UserProfile} from '../shared/types.ts';
import {MarketplaceSkeleton} from './EditorialSkeletons.tsx';

interface MarketplaceViewProps {
  user: UserProfile | null;
  ecosystemConfig: EcosystemConfig;
  selectedPartner: Partner | null;
  onSelectPartner: (partner: Partner | null) => void;
  onRequireAuth: () => void;
  onNotify: (msg: string) => void;
}

export function MarketplaceView({
  user,
  ecosystemConfig,
  selectedPartner,
  onSelectPartner,
  onRequireAuth,
  onNotify,
}: MarketplaceViewProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('همه شهرها');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Self-serve partner registration modal
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({
    name: '',
    roleType: 'food_brands' as PartnerRoleId,
    city: 'تهران',
    neighborhood: '',
    description: '',
    address: '',
    phone: '',
    tier: 'free' as 'free' | 'featured' | 'sponsor',
    promoCode: '',
    promoLabel: '',
  });

  // Claim page modal
  const [claimTarget, setClaimTarget] = useState<Partner | null>(null);
  const [claimPhone, setClaimPhone] = useState('');
  const [claimNote, setClaimNote] = useState('');

  const loadPartners = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('roleType', roleFilter);
      if (cityFilter !== 'همه شهرها') params.set('city', cityFilter);
      if (query.trim()) params.set('q', query.trim());
      const res = await apiRequest<{partners: Partner[]; fallbackUsed: boolean}>(
        `/api/partners?${params.toString()}`
      );
      setPartners(res.partners);
      setFallbackUsed(res.fallbackUsed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, [roleFilter, cityFilter, query, ecosystemConfig]);

  const activeRoles = PARTNER_ROLES.filter((r) => ecosystemConfig.enabledPartnerRoles.includes(r.id));

  const trackEvent = (partnerId: string, eventType: 'profile_open' | 'coupon_copy' | 'affiliate_click') => {
    apiRequest(`/api/partners/${partnerId}/events`, {
      method: 'POST',
      body: JSON.stringify({eventType}),
    }).catch(() => {});
  };

  const openPartnerDetail = (p: Partner) => {
    trackEvent(p.id, 'profile_open');
    onSelectPartner(p);
  };

  const handleFollowPartner = async (p: Partner) => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{following: boolean}>(`/api/partners/${p.id}/follow`, {method: 'POST'});
      const updated = {
        ...p,
        isFollowing: res.following,
        followersCount: p.followersCount + (res.following ? 1 : -1),
      };
      onSelectPartner(updated);
      setPartners((prev) => prev.map((item) => (item.id === p.id ? updated : item)));
      onNotify(res.following ? `«${p.name}» دنبال شد.` : `دنبال کردن «${p.name}» لغو شد.`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا');
    }
  };

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{message: string}>('/api/partners/register', {
        method: 'POST',
        body: JSON.stringify(regForm),
      });
      setShowRegister(false);
      setRegForm({
        name: '',
        roleType: 'food_brands',
        city: 'تهران',
        neighborhood: '',
        description: '',
        address: '',
        phone: '',
        tier: 'free',
        promoCode: '',
        promoLabel: '',
      });
      onNotify(res.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت کسب‌وکار');
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimTarget) return;
    try {
      const res = await apiRequest<{message: string}>(`/api/partners/${claimTarget.id}/claim`, {
        method: 'POST',
        body: JSON.stringify({phone: claimPhone, note: claimNote}),
      });
      setClaimTarget(null);
      setClaimPhone('');
      setClaimNote('');
      onNotify(res.message);
      loadPartners();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت درخواست مالکیت');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E6E6E3] dark:border-[#282825] pb-6">
        <div className="space-y-1">
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">اکوسیستم معرفی اصناف صنعت غذا و آشپزی</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{ecosystemConfig.marketplaceTitle || 'بازارچه و اصناف'}</h1>
        </div>
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="min-h-[46px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-sm font-medium inline-flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>ثبت کسب‌وکار یا برند</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5C5C58] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو در برندها، تجهیزات آشپزخانه، مطبخ‌ها و آموزشگاه‌ها..."
              className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] pr-11 pl-4 text-sm"
            />
          </div>
          <select
            aria-label="فیلتر شهر"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-4 text-sm"
          >
            <option value="همه شهرها">همه شهرها</option>
            <option value="تهران">تهران</option>
            <option value="رشت">رشت</option>
            <option value="شیراز">شیراز</option>
            <option value="اصفهان">اصفهان</option>
          </select>
        </div>

        {/* 10 Programmable Role Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`min-h-[42px] px-4 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
              roleFilter === 'all'
                ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
            }`}
          >
            همه اصناف فعال ({toFaDigits(activeRoles.length)})
          </button>
          {activeRoles.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => setRoleFilter(role.id)}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 ${
                roleFilter === role.id
                  ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                  : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
              }`}
            >
              {role.shortLabel}
            </button>
          ))}
        </div>

        {fallbackUsed && (
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            در شهر «{cityFilter}» هنوز همکار ثبت‌شده‌ای برای این فیلتر وجود ندارد؛ همکاران سراسری نمایش داده شده‌اند.
          </p>
        )}
      </div>

      {/* Partners Directory Grid */}
      {loading ? (
        <MarketplaceSkeleton />
      ) : partners.length === 0 ? (
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-12 text-center space-y-2">
          <p className="text-base font-semibold">کسب‌وکاری در این دسته‌بندی یافت نشد</p>
          <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">
            اگر صاحب کسب‌وکار در این حوزه هستید، از دکمه «ثبت کسب‌وکار» اقدام کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {partners.map((partner) => (
            <article
              key={partner.id}
              onClick={() => openPartnerDetail(partner)}
              className="cursor-pointer rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-6 flex flex-col justify-between gap-5 hover:border-[#B54B1F]/50 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  <span>{PARTNER_ROLE_LABELS[partner.roleType]}</span>
                  <span>
                    {partner.city} · {partner.neighborhood}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <h2 className="text-lg font-bold">{partner.name}</h2>
                  {partner.verified && <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />}
                </div>

                <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed line-clamp-3">
                  {partner.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[#E6E6E3]/70 dark:border-[#282825] flex items-center justify-between text-xs">
                <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium truncate">
                  {partner.promoLabel || 'مشاهده صفحه و کاتالوگ'}
                </span>
                {partner.claimStatus === 'unclaimed' && (
                  <span className="text-[#A97222] shrink-0">قابل ثبت مالکیت</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Partner Dedicated Page Modal */}
      {selectedPartner && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] border border-[#E6E6E3] dark:border-[#282825] p-6 sm:p-8 space-y-6 my-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  {PARTNER_ROLE_LABELS[selectedPartner.roleType]} · {selectedPartner.city}، {selectedPartner.neighborhood}
                </div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>{selectedPartner.name}</span>
                  {selectedPartner.verified && <BadgeCheck className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />}
                </h2>
              </div>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => onSelectPartner(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{selectedPartner.description}</p>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {selectedPartner.address}
              </span>
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone className="w-3.5 h-3.5" /> {selectedPartner.phone}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleFollowPartner(selectedPartner)}
                className={`min-h-[44px] px-5 rounded-xl text-sm font-medium transition-colors ${
                  selectedPartner.isFollowing
                    ? 'border border-[#B54B1F] text-[#B54B1F] dark:border-[#E29A6F] dark:text-[#E29A6F]'
                    : 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                }`}
              >
                {selectedPartner.isFollowing ? 'دنبال می‌کنید' : 'دنبال کردن کسب‌وکار'} ({toFaDigits(selectedPartner.followersCount)})
              </button>

              {selectedPartner.promoCode && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedPartner.promoCode!).catch(() => {});
                    trackEvent(selectedPartner.id, 'coupon_copy');
                    onNotify(`کد تخفیف ${selectedPartner.promoCode} کپی شد.`);
                  }}
                  className="min-h-[44px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی کد تخفیف:</span>
                  <span dir="ltr" className="font-mono font-bold">
                    {selectedPartner.promoCode}
                  </span>
                </button>
              )}
            </div>

            {/* Catalog */}
            {selectedPartner.catalog.length > 0 && (
              <div className="space-y-3 border-t border-[#E6E6E3] dark:border-[#282825] pt-5">
                <h3 className="text-base font-bold">ویترین محصولات و خدمات</h3>
                <div className="space-y-3">
                  {selectedPartner.catalog.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-semibold">{item.title}</div>
                        <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums mt-0.5">
                          {formatToman(item.price)}
                          {item.discountPercent ? ` · ${toFaDigits(item.discountPercent)}٪ تخفیف لاقلی` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          trackEvent(selectedPartner.id, 'affiliate_click');
                          onNotify(`لینک همکاری (${item.affiliateCode || selectedPartner.affiliateCode}) ثبت و آماده استفاده شد.`);
                        }}
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#EFEFED] dark:bg-[#20201E] text-xs font-medium inline-flex items-center gap-1.5 shrink-0"
                      >
                        <span>خرید / رزرو</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Claim Page Flow for Unclaimed Auto-Pages */}
            {selectedPartner.claimStatus === 'unclaimed' && (
              <div className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#A97222] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    صاحب این کسب‌وکار هستید؟ می‌توانید مالکیت این صفحه را ثبت و کاتالوگ خود را مدیریت کنید.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setClaimTarget(selectedPartner)}
                  className="min-h-[42px] px-4 rounded-xl border border-[#B54B1F] text-[#B54B1F] dark:border-[#E29A6F] dark:text-[#E29A6F] text-xs font-medium shrink-0"
                >
                  ثبت مالکیت صفحه
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Claim Page Modal */}
      {claimTarget && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={handleClaimSubmit}
            className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4"
          >
            <h3 className="text-lg font-bold">درخواست مالکیت صفحه «{claimTarget.name}»</h3>
            <input
              type="tel"
              dir="ltr"
              required
              value={claimPhone}
              onChange={(e) => setClaimPhone(e.target.value)}
              placeholder="شماره تماس رسمی صاحب کسب‌وکار"
              className="w-full min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-4 text-left text-sm"
            />
            <textarea
              rows={2}
              value={claimNote}
              onChange={(e) => setClaimNote(e.target.value)}
              placeholder="توضیحات یا شماره مجوز (اختیاری)"
              className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClaimTarget(null)}
                className="min-h-[46px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-sm"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[46px] rounded-xl bg-[#B54B1F] text-[#FAFAFA] text-sm font-medium"
              >
                ارسال درخواست مالکیت
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Self-Serve B2B Registration Modal */}
      {showRegister && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleRegisterPartner}
            className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4 my-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />
                <h2 className="text-lg font-bold">ثبت‌نام همکاران و اصناف در لاقلی</h2>
              </div>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setShowRegister(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="نام برند یا کسب‌وکار"
                value={regForm.name}
                onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
              />
              <select
                value={regForm.roleType}
                onChange={(e) => setRegForm({...regForm, roleType: e.target.value as PartnerRoleId})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-sm"
              >
                {PARTNER_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="شهر (مثلاً تهران)"
                value={regForm.city}
                onChange={(e) => setRegForm({...regForm, city: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
              />
              <input
                type="text"
                placeholder="محله"
                value={regForm.neighborhood}
                onChange={(e) => setRegForm({...regForm, neighborhood: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
              />
            </div>

            <textarea
              rows={3}
              required
              placeholder="معرفی کوتاه محصولات یا خدمات شما..."
              value={regForm.description}
              onChange={(e) => setRegForm({...regForm, description: e.target.value})}
              className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3.5 text-sm"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="آدرس یا محدوده فعالیت"
                value={regForm.address}
                onChange={(e) => setRegForm({...regForm, address: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
              />
              <input
                type="tel"
                dir="ltr"
                required
                placeholder="شماره تماس"
                value={regForm.phone}
                onChange={(e) => setRegForm({...regForm, phone: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-left text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={regForm.tier}
                onChange={(e) => setRegForm({...regForm, tier: e.target.value as 'free' | 'featured' | 'sponsor'})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              >
                <option value="free">بسته لیست رایگان</option>
                <option value="featured">بسته برگزیده</option>
                <option value="sponsor">اسپانسر رسمی دسته</option>
              </select>
              <input
                type="text"
                dir="ltr"
                placeholder="کد تخفیف (اختیاری)"
                value={regForm.promoCode}
                onChange={(e) => setRegForm({...regForm, promoCode: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-left text-sm"
              />
              <input
                type="text"
                placeholder="عنوان تخفیف"
                value={regForm.promoLabel}
                onChange={(e) => setRegForm({...regForm, promoLabel: e.target.value})}
                className="min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-sm"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-[#FAFAFA] text-sm font-medium"
            >
              ارسال درخواست به صف تایید پنل مدیریت
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
