import {useMemo, useState} from 'react';
import {
  CheckCircle2,
  Eye,
  Megaphone,
  MousePointerClick,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {NativeAdFormat, NativeAdUnit, Partner} from '../shared/types.ts';
import {NativeAdSlot} from './NativeAdSlot.tsx';

interface AdminNativeAdsPanelProps {
  nativeAds: NativeAdUnit[];
  partners: Partner[];
  disclosureLabel?: string;
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

const FORMAT_META: Record<
  NativeAdFormat,
  {label: string; shortLabel: string; hint: string}
> = {
  inline_ingredient: {
    label: 'یادداشت متنی درون مواد اولیه',
    shortLabel: 'درون مواد',
    hint: 'تک‌خطی آرام و مرتبط زیر ماده اولیه هم‌نام در صفحه دستورپخت',
  },
  contextual_tool: {
    label: 'پیشنهاد ابزار و جایگزین زمینه‌ای',
    shortLabel: 'ابزار و جایگزین',
    hint: 'نمایش هوشمند در بخش مراحل پخت یا جست‌وجوی جایگزین مواد',
  },
  feed_editorial_story: {
    label: 'یادداشت تحریریه برند در فید دستورها',
    shortLabel: 'داستان برند',
    hint: 'کارت هم‌جنس تحریریه با فاصله کنترل‌شده میان کارت‌های دستورپخت',
  },
  pantry_companion: {
    label: 'همراه یخچال هوشمند و لیست خرید',
    shortLabel: 'یخچال و خرید',
    hint: 'پیشنهاد تامین هوشمند بر اساس مواد انتخابی کاربر',
  },
};

const ALL_FORMATS: NativeAdFormat[] = [
  'inline_ingredient',
  'contextual_tool',
  'feed_editorial_story',
  'pantry_companion',
];

const EMPTY_FORM = {
  id: '' as string,
  partnerId: '',
  partnerName: '',
  format: 'inline_ingredient' as NativeAdFormat,
  title: '',
  subtitle: '',
  editorialCopy: '',
  ctaLabel: 'آشنایی با برند',
  targetUrl: '',
  matchKeywordsText: '',
  priority: 10,
  status: 'active' as 'active' | 'paused',
};

export function AdminNativeAdsPanel({
  nativeAds,
  partners,
  disclosureLabel = 'همکار منتخب لاقلی',
  onRefresh,
  onNotify,
}: AdminNativeAdsPanelProps) {
  const [formatFilter, setFormatFilter] = useState<'all' | NativeAdFormat>('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    partnerId: partners[0]?.id || '',
    partnerName: partners[0]?.name || '',
  }));

  const summary = useMemo(() => {
    const totalImpressions = nativeAds.reduce((sum, a) => sum + (a.impressions || 0), 0);
    const totalClicks = nativeAds.reduce((sum, a) => sum + (a.clicks || 0), 0);
    const activeCount = nativeAds.filter((a) => a.status === 'active').length;
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';
    return {totalImpressions, totalClicks, activeCount, ctr};
  }, [nativeAds]);

  const filteredAds = useMemo(() => {
    if (formatFilter === 'all') return nativeAds;
    return nativeAds.filter((a) => a.format === formatFilter);
  }, [nativeAds, formatFilter]);

  const previewAd: NativeAdUnit = useMemo(
    () => ({
      id: form.id || 'preview',
      partnerId: form.partnerId || 'preview-partner',
      partnerName: form.partnerName || partners.find((p) => p.id === form.partnerId)?.name || 'برند همکار نمونه',
      format: form.format,
      title: form.title.trim() || 'عنوان معرفی آرام و خوانای برند همکار',
      subtitle: form.subtitle.trim() || 'توضیح کوتاه تکمیلی بدون لحن تبلیغاتی آزاردهنده',
      editorialCopy:
        form.editorialCopy.trim() ||
        'روایت کوتاه و کاربردی درباره کیفیت محصول یا کاربرد آن در آشپزی روزمره.',
      ctaLabel: form.ctaLabel.trim() || 'آشنایی با برند',
      targetUrl: form.targetUrl.trim() || undefined,
      matchKeywords: form.matchKeywordsText
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      matchCategories: [],
      priority: Number(form.priority) || 10,
      status: form.status,
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString(),
    }),
    [form, partners]
  );

  const openCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      partnerId: partners[0]?.id || '',
      partnerName: partners[0]?.name || '',
    });
    setShowForm(true);
  };

  const openEditForm = (ad: NativeAdUnit) => {
    setForm({
      id: ad.id,
      partnerId: ad.partnerId,
      partnerName: ad.partnerName,
      format: ad.format,
      title: ad.title,
      subtitle: ad.subtitle || '',
      editorialCopy: ad.editorialCopy || '',
      ctaLabel: ad.ctaLabel || 'آشنایی با برند',
      targetUrl: ad.targetUrl || '',
      matchKeywordsText: (ad.matchKeywords || []).join('، '),
      priority: ad.priority || 10,
      status: ad.status,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      onNotify('عنوان واحد تبلیغ بومی الزامی است.');
      return;
    }
    setSaving(true);
    const chosenPartner = partners.find((p) => p.id === form.partnerId);
    const payload = {
      partnerId: form.partnerId || chosenPartner?.id || 'partner-custom',
      partnerName: chosenPartner?.name || form.partnerName.trim() || 'برند همکار لاقلی',
      format: form.format,
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      editorialCopy: form.editorialCopy.trim(),
      ctaLabel: form.ctaLabel.trim() || 'آشنایی با برند',
      targetUrl: form.targetUrl.trim(),
      matchKeywords: form.matchKeywordsText
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean),
      matchCategories: [],
      priority: Number(form.priority) || 10,
      status: form.status,
    };

    try {
      if (form.id) {
        await apiRequest(`/api/admin/native-ads/${form.id}`, {
          method: 'PUT',
          useAdmin: true,
          body: JSON.stringify(payload),
        });
        onNotify('واحد تبلیغ بومی با موفقیت ویرایش و به‌روزرسانی شد.');
      } else {
        await apiRequest('/api/admin/native-ads', {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify(payload),
        });
        onNotify('واحد تبلیغ بومی جدید با موفقیت منتشر شد.');
      }
      setShowForm(false);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره واحد تبلیغ بومی');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (ad: NativeAdUnit) => {
    const nextStatus = ad.status === 'active' ? 'paused' : 'active';
    try {
      await apiRequest(`/api/admin/native-ads/${ad.id}`, {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify({status: nextStatus}),
      });
      onNotify(nextStatus === 'active' ? 'واحد تبلیغاتی فعال شد.' : 'واحد تبلیغاتی موقتاً متوقف شد.');
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تغییر وضعیت');
    }
  };

  const handleDelete = async (ad: NativeAdUnit) => {
    try {
      await apiRequest(`/api/admin/native-ads/${ad.id}`, {
        method: 'DELETE',
        useAdmin: true,
      });
      onNotify(`واحد تبلیغ بومی «${ad.title}» حذف شد.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف واحد تبلیغ');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Performance KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] inline-flex items-center gap-1.5">
            <Megaphone className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
            <span>واحدهای فعال بومی</span>
          </div>
          <div className="text-2xl font-extrabold">
            {toFaDigits(summary.activeCount)} / {toFaDigits(nativeAds.length)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] inline-flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#5C5C58]" />
            <span>مجموع نمایش واقعی</span>
          </div>
          <div className="text-2xl font-extrabold">{toFaDigits(summary.totalImpressions)}</div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] inline-flex items-center gap-1.5">
            <MousePointerClick className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
            <span>مجموع کلیک‌های ارگانیک</span>
          </div>
          <div className="text-2xl font-extrabold">{toFaDigits(summary.totalClicks)}</div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#A97222]" />
            <span>نرخ تعامل میانگین</span>
          </div>
          <div className="text-2xl font-extrabold text-[#B54B1F] dark:text-[#E29A6F]">
            {toFaDigits(summary.ctr)}٪
          </div>
        </div>
      </div>

      {/* 2. Header Bar + Format Filters */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFormatFilter('all')}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium transition-colors ${
              formatFilter === 'all'
                ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                : 'bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]'
            }`}
          >
            همه قالب‌ها ({toFaDigits(nativeAds.length)})
          </button>
          {ALL_FORMATS.map((fmt) => {
            const count = nativeAds.filter((a) => a.format === fmt).length;
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => setFormatFilter(fmt)}
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium transition-colors ${
                  formatFilter === fmt
                    ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                    : 'bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                {FORMAT_META[fmt].shortLabel} ({toFaDigits(count)})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>ساخت واحد تبلیغ بومی جدید</span>
        </button>
      </div>

      {/* 3. Create / Edit Form + Live Visual Harmony Preview */}
      {showForm && (
        <div className="rounded-2xl border border-[#B54B1F]/35 dark:border-[#E29A6F]/35 bg-[#FFFFFF] dark:bg-[#151514] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">
                {form.id ? 'ویرایش واحد تبلیغ بومی' : 'طراحی واحد تبلیغ بومی جدید'}
              </h2>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
                {FORMAT_META[form.format].hint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              aria-label="بستن فرم"
              className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center hover:bg-[#F6F6F5] dark:hover:bg-[#20201E]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">قالب نمایش بومی</label>
                <select
                  value={form.format}
                  onChange={(e) => setForm({...form, format: e.target.value as NativeAdFormat})}
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                >
                  {ALL_FORMATS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {FORMAT_META[fmt].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">برند همکار</label>
                <select
                  value={form.partnerId}
                  onChange={(e) => {
                    const p = partners.find((item) => item.id === e.target.value);
                    setForm({...form, partnerId: e.target.value, partnerName: p?.name || form.partnerName});
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                >
                  {partners.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.city})
                    </option>
                  ))}
                  {partners.length === 0 && <option value="partner-custom">برند همکار</option>}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">اولویت نمایش و وضعیت</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.priority}
                    onChange={(e) => setForm({...form, priority: Number(e.target.value)})}
                    className="w-24 min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
                  />
                  <select
                    value={form.status}
                    onChange={(e) => setForm({...form, status: e.target.value as 'active' | 'paused'})}
                    className="flex-1 min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                  >
                    <option value="active">فعال</option>
                    <option value="paused">متوقف</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">عنوان آرام و تحریریه‌ای</label>
                <input
                  type="text"
                  required
                  maxLength={140}
                  value={form.title}
                  onChange={(e) => setForm({...form, title: e.target.value})}
                  placeholder="مثلاً: زعفران سرگل قائنات؛ عطر اصیل برای ته‌چین"
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">زیرعنوان کوتاه</label>
                <input
                  type="text"
                  maxLength={160}
                  value={form.subtitle}
                  onChange={(e) => setForm({...form, subtitle: e.target.value})}
                  placeholder="توضیح تکمیلی در یک جمله کوتاه..."
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">
                متن روایت برند (برای داستان فید، ابزار و همراه یخچال)
              </label>
              <textarea
                rows={2}
                maxLength={320}
                value={form.editorialCopy}
                onChange={(e) => setForm({...form, editorialCopy: e.target.value})}
                placeholder="یادداشت کوتاه و مفید درباره اصالت یا کاربرد محصول در آشپزی..."
                className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">
                  واژه‌های هدف فارسی (با ویرگول جدا کنید)
                </label>
                <input
                  type="text"
                  value={form.matchKeywordsText}
                  onChange={(e) => setForm({...form, matchKeywordsText: e.target.value})}
                  placeholder="مثلاً: زعفران، برنج، قابلمه، چدن، رب انار"
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">متن دکمه اقدام</label>
                <input
                  type="text"
                  maxLength={40}
                  value={form.ctaLabel}
                  onChange={(e) => setForm({...form, ctaLabel: e.target.value})}
                  placeholder="آشنایی با برند"
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-[#5C5C58] dark:text-[#A3A39E] block">
                  پیوند مقصد برند (اختیاری)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={form.targetUrl}
                  onChange={(e) => setForm({...form, targetUrl: e.target.value})}
                  placeholder="https://example.ir"
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs text-left"
                />
              </div>
            </div>

            {/* Live Harmony Preview Box */}
            <div className="rounded-2xl border border-dashed border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-4 space-y-2">
              <div className="text-[11px] font-semibold text-[#5C5C58] dark:text-[#A3A39E]">
                پیش‌نمایش زنده هارمونی در اپلیکیشن کاربر:
              </div>
              <div className="pointer-events-none">
                <NativeAdSlot ad={previewAd} disclosureLabel={disclosureLabel} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-[42px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-bold disabled:opacity-45"
              >
                {saving ? 'در حال ذخیره...' : form.id ? 'ذخیره تغییرات' : 'انتشار واحد تبلیغ بومی'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. Native Ads List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filteredAds.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-10 text-center space-y-2">
            <p className="text-sm font-bold">واحد تبلیغ بومی در این قالب ثبت نشده است.</p>
            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
              از دکمه بالای صفحه می‌توانید واحد جدید طراحی و با پیش‌نمایش زنده منتشر کنید.
            </p>
          </div>
        ) : (
          filteredAds.map((ad) => {
            const ctr =
              ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : '0.0';
            return (
              <div
                key={ad.id}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2 text-[#5C5C58] dark:text-[#A3A39E]">
                      <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F]">
                        {FORMAT_META[ad.format]?.shortLabel || ad.format}
                      </span>
                      <span>·</span>
                      <span>{ad.partnerName}</span>
                      <span>·</span>
                      <span className="tabular-nums">اولویت {toFaDigits(ad.priority)}</span>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        ad.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-[#5C5C58] dark:text-[#A3A39E]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{ad.status === 'active' ? 'فعال' : 'متوقف'}</span>
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{ad.title}</h3>
                  {(ad.editorialCopy || ad.subtitle) && (
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed line-clamp-2">
                      {ad.editorialCopy || ad.subtitle}
                    </p>
                  )}

                  {ad.matchKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {ad.matchKeywords.map((kw) => (
                        <span
                          key={kw}
                          className="px-2 py-0.5 rounded-md bg-[#F6F6F5] dark:bg-[#0B0B0B] border border-[#E6E6E3] dark:border-[#282825] text-[11px] text-[#5C5C58] dark:text-[#A3A39E]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E6E6E3]/70 dark:border-[#282825] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs tabular-nums text-[#5C5C58] dark:text-[#A3A39E]">
                    <span>نمایش: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{toFaDigits(ad.impressions)}</strong></span>
                    <span>کلیک: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{toFaDigits(ad.clicks)}</strong></span>
                    <span>نرخ تعامل: <strong className="text-[#B54B1F] dark:text-[#E29A6F]">{toFaDigits(ctr)}٪</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditForm(ad)}
                      aria-label="ویرایش واحد تبلیغ"
                      className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-[11px] inline-flex items-center gap-1 hover:bg-[#F6F6F5] dark:hover:bg-[#20201E]"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>ویرایش</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(ad)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-[11px] inline-flex items-center gap-1 hover:bg-[#F6F6F5] dark:hover:bg-[#20201E]"
                    >
                      {ad.status === 'active' ? (
                        <>
                          <PauseCircle className="w-3.5 h-3.5" />
                          <span>توقف</span>
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>فعال‌سازی</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ad)}
                      aria-label="حذف واحد تبلیغ"
                      className="min-h-[34px] min-w-[34px] rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
