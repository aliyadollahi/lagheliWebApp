import {useState} from 'react';
import {Check, LayoutGrid, Plus, Save, Sliders, Sparkles, X} from 'lucide-react';
import {DEFAULT_AD_HARMONY} from '../shared/nativeAdEngine.ts';
import {PARTNER_ROLES, toFaDigits} from '../shared/persianEngine.ts';
import type {AdHarmonyConfig, DynamicAppSectionsConfig, EcosystemConfig} from '../shared/types.ts';

interface AdminDynamicAppControlPanelProps {
  config: EcosystemConfig;
  onChangeConfig: (next: EcosystemConfig) => void;
  onSave: () => Promise<void> | void;
}

const DEFAULT_SECTIONS: DynamicAppSectionsConfig = {
  heroEnabled: true,
  heroTitle: 'آرشیو مرجع آشپزی لاقلی',
  heroSubtitle: 'دستورپخت‌های اصیل، سنجیده‌شده و مرحله‌به‌مرحله برای آشپزی روزمره',
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

export function AdminDynamicAppControlPanel({
  config,
  onChangeConfig,
  onSave,
}: AdminDynamicAppControlPanelProps) {
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const sections: DynamicAppSectionsConfig = {
    ...DEFAULT_SECTIONS,
    ...(config.appSections || {}),
  };

  const harmony: AdHarmonyConfig = {
    ...DEFAULT_AD_HARMONY,
    ...(config.adHarmony || {}),
  };

  const updateSections = (patch: Partial<DynamicAppSectionsConfig>) => {
    onChangeConfig({
      ...config,
      appSections: {
        ...sections,
        ...patch,
      },
    });
  };

  const updateHarmony = (patch: Partial<AdHarmonyConfig>) => {
    onChangeConfig({
      ...config,
      adHarmony: {
        ...harmony,
        ...patch,
      },
    });
  };

  const handleAddCategory = () => {
    const cleaned = newCategory.trim();
    if (!cleaned || sections.featuredCategories.includes(cleaned)) return;
    setNewCategory('');
    updateSections({featuredCategories: [...sections.featuredCategories, cleaned]});
  };

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold inline-flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
            <span>مرکز کنترل داینامیک اپلیکیشن کاربر</span>
          </h2>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            هر بخش، عنوان، دسته‌بندی یا سقف نمایش تبلیغات بومی که اینجا تغییر دهید، بلافاصله روی اپلیکیشن کاربران اعمال می‌شود.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveClick}
          className="min-h-[44px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'در حال اعمال زنده...' : 'ذخیره و اعمال زنده روی اپ کاربر'}</span>
        </button>
      </div>

      {/* Section 1: User App Live Section Toggles */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold">فعال یا غیرفعال‌سازی بخش‌های اپلیکیشن کاربر</h3>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
            کنترل فوری نمایش تب‌ها، نوار جست‌وجو، جلد سردبیر و دکمه ثبت دستورپخت بدون نیاز به انتشار مجدد
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {(
            [
              {
                label: 'جلد انتخاب سردبیر در صفحه نخست',
                checked: sections.heroEnabled,
                onChange: (v: boolean) => updateSections({heroEnabled: v}),
              },
              {
                label: 'نوار جست‌وجو و فیلتر پیشرفته',
                checked: sections.searchBarEnabled,
                onChange: (v: boolean) => updateSections({searchBarEnabled: v}),
              },
              {
                label: 'نوار دسته‌بندی‌های سریع دستورپخت',
                checked: sections.quickCategoriesEnabled,
                onChange: (v: boolean) => updateSections({quickCategoriesEnabled: v}),
              },
              {
                label: 'تب آشپزخانه هوشمند و یخچال‌گردی',
                checked: sections.kitchenTabEnabled,
                onChange: (v: boolean) => updateSections({kitchenTabEnabled: v}),
              },
              {
                label: 'تب لیست خرید هوشمند مواد اولیه',
                checked: sections.shoppingTabEnabled,
                onChange: (v: boolean) => updateSections({shoppingTabEnabled: v}),
              },
              {
                label: 'تب دایرکتوری برندهای همکار',
                checked: config.marketplaceTabEnabled,
                onChange: (v: boolean) => onChangeConfig({...config, marketplaceTabEnabled: v}),
              },
              {
                label: 'دکمه ثبت دستورپخت توسط کاربران',
                checked: sections.submitRecipeEnabled,
                onChange: (v: boolean) => updateSections({submitRecipeEnabled: v}),
              },
              {
                label: 'ویترین آرام برندهای همکار در انتهای فید',
                checked: config.exploreShowcaseEnabled,
                onChange: (v: boolean) => onChangeConfig({...config, exploreShowcaseEnabled: v}),
              },
              {
                label: 'نمایش برندهای همکار مرتبط در صفحه دستور',
                checked: config.recipeContextEnabled,
                onChange: (v: boolean) => onChangeConfig({...config, recipeContextEnabled: v}),
              },
            ] as const
          ).map((item) => (
            <label
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5]/60 dark:bg-[#0B0B0B]/60 p-3.5 cursor-pointer"
            >
              <span className="font-medium leading-relaxed">{item.label}</span>
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                className="w-4 h-4 accent-[#B54B1F] shrink-0"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Section 2: Live Copy, Editorial Notice & Featured Categories */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
          <h3 className="text-sm font-bold">متون تحریریه، اعلان زنده و دسته‌بندی‌های صفحه نخست</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">تیتر اصلی صفحه کاوش دستورها</label>
            <input
              type="text"
              value={sections.heroTitle}
              onChange={(e) => updateSections({heroTitle: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">زیرتیتر آرام تحریریه</label>
            <input
              type="text"
              value={sections.heroSubtitle}
              onChange={(e) => updateSections({heroSubtitle: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">عنوان تب برندهای همکار</label>
            <input
              type="text"
              value={config.marketplaceTitle}
              onChange={(e) => onChangeConfig({...config, marketplaceTitle: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">عنوان ویترین برندها در پایین فید</label>
            <input
              type="text"
              value={config.activeCampaignTitle}
              onChange={(e) => onChangeConfig({...config, activeCampaignTitle: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">
              اعلان آرام بالای صفحه اصلی (در صورت خالی بودن نمایش داده نمی‌شود)
            </label>
            <input
              type="text"
              maxLength={220}
              value={sections.editorialNotice}
              onChange={(e) => updateSections({editorialNotice: e.target.value})}
              placeholder="مثلاً: مجموعه ویژه دستورهای پاییزی و سوپ‌های خانگی لاقلی منتشر شد."
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
        </div>

        {/* Editable Quick Categories */}
        <div className="space-y-2.5 pt-2 border-t border-[#E6E6E3]/70 dark:border-[#282825]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold">دسته‌بندی‌های سریع نمایش‌داده‌شده در فید دستورها</span>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder="افزودن دسته جدید..."
                className="min-h-[36px] rounded-lg border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="min-h-[36px] px-3 rounded-lg bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-semibold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>افزودن</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {sections.featuredCategories.map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 py-1.5 text-xs"
              >
                <span>{cat}</span>
                {cat !== 'همه' && (
                  <button
                    type="button"
                    aria-label={`حذف ${cat}`}
                    onClick={() =>
                      updateSections({
                        featuredCategories: sections.featuredCategories.filter((c) => c !== cat),
                      })
                    }
                    className="text-[#5C5C58] hover:text-red-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Section 3: Native Ad Harmony Guardrails */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold inline-flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <span>سپر هارمونی و سقف نمایش تبلیغات بومی</span>
            </h3>
            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
              تنظیم دقیق فاصله و تعداد نمایش تبلیغات بومی تا کاربر هیچ‌گاه حس شلوغی یا غرق‌شدن در تبلیغات نداشته باشد.
            </p>
          </div>

          <label className="inline-flex items-center gap-2.5 rounded-xl border border-[#B54B1F]/30 bg-[#B54B1F]/5 px-3.5 py-2 text-xs font-bold cursor-pointer">
            <span>موتور تبلیغات بومی فعال باشد</span>
            <input
              type="checkbox"
              checked={harmony.adsEnabled}
              onChange={(e) => updateHarmony({adsEnabled: e.target.checked})}
              className="w-4 h-4 accent-[#B54B1F]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {(
            [
              {
                label: 'یادداشت متنی آرام زیر مواد اولیه دستور',
                checked: harmony.inlineIngredientMentionEnabled,
                onChange: (v: boolean) => updateHarmony({inlineIngredientMentionEnabled: v}),
              },
              {
                label: 'پیشنهاد ابزار پخت و جایگزین زمینه‌ای',
                checked: harmony.toolAndSubMentionEnabled,
                onChange: (v: boolean) => updateHarmony({toolAndSubMentionEnabled: v}),
              },
              {
                label: 'کارت داستان تحریریه برند در فید دستورها',
                checked: harmony.feedEditorialBannerEnabled,
                onChange: (v: boolean) => updateHarmony({feedEditorialBannerEnabled: v}),
              },
              {
                label: 'همراه هوشمند در صفحه یخچال‌گردی',
                checked: harmony.fridgeCompanionAdEnabled,
                onChange: (v: boolean) => updateHarmony({fridgeCompanionAdEnabled: v}),
              },
              {
                label: 'همراه هوشمند در صفحه لیست خرید',
                checked: harmony.shoppingCompanionAdEnabled,
                onChange: (v: boolean) => updateHarmony({shoppingCompanionAdEnabled: v}),
              },
              {
                label: 'پیشنهاد رستوران و کافه نزدیک در صفحه دستورپخت',
                checked: harmony.nearbyVenuesEnabled !== false,
                onChange: (v: boolean) => updateHarmony({nearbyVenuesEnabled: v}),
              },
              {
                label: 'نوار و فوتر حامی ویژه «قدرت گرفته از ...»',
                checked: harmony.flagshipSponsorEnabled !== false,
                onChange: (v: boolean) => updateHarmony({flagshipSponsorEnabled: v}),
              },
            ] as const
          ).map((item) => (
            <label
              key={item.label}
              className="flex items-center justify-between gap-2 rounded-xl border border-[#E6E6E3] dark:border-[#282825] p-3.5 cursor-pointer"
            >
              <span>{item.label}</span>
              <input
                type="checkbox"
                checked={item.checked}
                disabled={!harmony.adsEnabled}
                onChange={(e) => item.onChange(e.target.checked)}
                className="w-4 h-4 accent-[#B54B1F] shrink-0"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#E6E6E3]/70 dark:border-[#282825] text-xs">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[#5C5C58] dark:text-[#A3A39E]">فاصله کارت داستان برند در فید</span>
              <span className="font-bold tabular-nums text-[#B54B1F] dark:text-[#E29A6F]">
                هر {toFaDigits(harmony.feedBannerEveryNRecipes)} دستور
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              step={1}
              value={harmony.feedBannerEveryNRecipes}
              onChange={(e) => updateHarmony({feedBannerEveryNRecipes: Number(e.target.value)})}
              className="w-full accent-[#B54B1F]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">
              سقف یادداشت متنی درون مواد هر دستور
            </label>
            <select
              value={harmony.maxInlineMentionsPerRecipe}
              onChange={(e) => updateHarmony({maxInlineMentionsPerRecipe: Number(e.target.value)})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            >
              <option value={0}>۰ (خاموش)</option>
              <option value={1}>حداکثر ۱ یادداشت (بسیار آرام)</option>
              <option value={2}>حداکثر ۲ یادداشت (متعادل پیشنهادی)</option>
              <option value={3}>حداکثر ۳ یادداشت</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[#5C5C58] dark:text-[#A3A39E] block">برچسب شفاف افشای همکاری</label>
            <input
              type="text"
              maxLength={40}
              value={harmony.disclosureLabel}
              onChange={(e) => updateHarmony({disclosureLabel: e.target.value})}
              placeholder="همکار منتخب لاقلی"
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>
        </div>
      </div>

      {/* Section 4: Partner Directory Roles */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold">رسته‌های فعال در دایرکتوری برندهای همکار</h3>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
            تعیین کنید کدام دسته‌های تجاری در صفحه برندهای همکار نمایش داده شوند
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PARTNER_ROLES.map((r) => {
            const enabled = config.enabledPartnerRoles.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() =>
                  onChangeConfig({
                    ...config,
                    enabledPartnerRoles: enabled
                      ? config.enabledPartnerRoles.filter((id) => id !== r.id)
                      : [...config.enabledPartnerRoles, r.id],
                  })
                }
                className={`min-h-[40px] px-3 rounded-xl border text-[11px] flex items-center justify-between gap-1.5 transition-colors ${
                  enabled
                    ? 'border-[#B54B1F] bg-[#B54B1F]/8 font-semibold'
                    : 'border-[#E6E6E3] dark:border-[#282825] opacity-60'
                }`}
              >
                <span className="truncate">{r.shortLabel}</span>
                {enabled && <Check className="w-3.5 h-3.5 text-[#B54B1F] shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
