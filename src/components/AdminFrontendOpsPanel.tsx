import {useCallback, useEffect, useState} from 'react';
import {
  ChefHat,
  Gem,
  MessageSquare,
  Plus,
  Save,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdminQuestionRow,
  CustomSubstitutionRule,
  DeliveryPricingConfig,
  EditorialMenuItem,
  GemStoreOffer,
  KitchenConfig,
} from '../shared/types.ts';
import {AdminWorkspaceSkeleton} from './EditorialSkeletons.tsx';

interface AdminFrontendOpsPanelProps {
  onRefreshAppConfig: () => void;
  onNotify: (msg: string) => void;
}

type SubTab = 'menu' | 'kitchen' | 'gems' | 'qa';

export function AdminFrontendOpsPanel({onRefreshAppConfig, onNotify}: AdminFrontendOpsPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('menu');
  const [loading, setLoading] = useState(false);

  // 1. Daily Menu & Delivery Pricing
  const [menuItems, setMenuItems] = useState<EditorialMenuItem[]>([]);
  const [pricing, setPricing] = useState<DeliveryPricingConfig>({
    freeDeliveryThreshold: 600000,
    packagingFee: 18000,
    standardDeliveryFee: 45000,
  });
  const [newDish, setNewDish] = useState({
    title: '',
    subtitle: '',
    category: 'اصیل ایرانی',
    chefName: 'آشپزخانه مرکزی لاقلی',
    singlePrice: 285000,
    doublePrice: 520000,
    prepMinutes: 35,
    calories: 560,
    featured: false,
  });

  // 2. Smart Kitchen / Fridge & Custom Substitutions
  const [kitchenConfig, setKitchenConfig] = useState<KitchenConfig>({
    quickFridgeItems: [],
    quickSubQueries: [],
    customSubstitutions: [],
  });
  const [newFridgeItem, setNewFridgeItem] = useState('');
  const [newSubQuery, setNewSubQuery] = useState('');
  const [newSubRule, setNewSubRule] = useState({
    ingredient: '',
    substitute: '',
    ratio: '۱ به ۱',
    compatibility: 88,
    flavorNote: '',
    isVegan: false,
  });

  // 3. Gem Store Offers
  const [gemOffers, setGemOffers] = useState<GemStoreOffer[]>([]);
  const [newOffer, setNewOffer] = useState({
    title: '',
    partnerName: '',
    discountLabel: '',
    gemCost: 80,
    codePrefix: 'LG',
  });

  // 4. Q&A Moderation
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [menuRes, kitchenRes, gemRes, qaRes] = await Promise.all([
        apiRequest<{items: EditorialMenuItem[]; pricing: DeliveryPricingConfig}>('/api/admin/menu', {useAdmin: true}),
        apiRequest<{kitchenConfig: KitchenConfig}>('/api/admin/kitchen-config', {useAdmin: true}),
        apiRequest<{offers: GemStoreOffer[]}>('/api/admin/gem-offers', {useAdmin: true}),
        apiRequest<{questions: AdminQuestionRow[]}>('/api/admin/questions', {useAdmin: true}),
      ]);
      setMenuItems(menuRes.items);
      setPricing(menuRes.pricing);
      setKitchenConfig(kitchenRes.kitchenConfig);
      setGemOffers(gemRes.offers);
      setQuestions(qaRes.questions);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در دریافت داده‌های مدیریتی');
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // --- Menu handlers ---
  const handleAddMenuDish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDish.title.trim() || !newDish.subtitle.trim()) return;
    try {
      await apiRequest('/api/admin/menu', {method: 'POST', body: JSON.stringify(newDish), useAdmin: true});
      setNewDish({
        title: '',
        subtitle: '',
        category: 'اصیل ایرانی',
        chefName: 'آشپزخانه مرکزی لاقلی',
        singlePrice: 285000,
        doublePrice: 520000,
        prepMinutes: 35,
        calories: 560,
        featured: false,
      });
      onNotify('غذای جدید به منوی روز اضافه شد.');
      loadAll();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در افزودن غذای منو');
    }
  };

  const handleToggleDishFeatured = async (dish: EditorialMenuItem) => {
    try {
      await apiRequest(`/api/admin/menu/${dish.id}`, {
        method: 'PUT',
        body: JSON.stringify({featured: !dish.featured}),
        useAdmin: true,
      });
      onNotify(dish.featured ? 'از حالت منتخب منو خارج شد.' : 'به‌عنوان غذای منتخب روز تنظیم شد.');
      loadAll();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بروزرسانی منو');
    }
  };

  const handleDeleteDish = async (id: string) => {
    try {
      await apiRequest(`/api/admin/menu/${id}`, {method: 'DELETE', useAdmin: true});
      onNotify('غذا از منوی روز حذف شد.');
      loadAll();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف غذا');
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/menu-pricing', {method: 'PUT', body: JSON.stringify(pricing), useAdmin: true});
      onNotify('تعرفه‌های ارسال و بسته‌بندی ذخیره شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره تعرفه‌ها');
    }
  };

  // --- Kitchen / Fridge handlers ---
  const saveKitchenConfig = async (next: KitchenConfig, msg = 'تنظیمات آشپزخانه و یخچال ذخیره شد.') => {
    try {
      const res = await apiRequest<{kitchenConfig: KitchenConfig}>(
        '/api/admin/kitchen-config',
        {method: 'PUT', body: JSON.stringify(next), useAdmin: true}
      );
      setKitchenConfig(res.kitchenConfig);
      onRefreshAppConfig();
      onNotify(msg);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات یخچال');
    }
  };

  const handleAddFridgeItem = () => {
    const clean = newFridgeItem.trim();
    if (!clean || kitchenConfig.quickFridgeItems.includes(clean)) return;
    setNewFridgeItem('');
    saveKitchenConfig({...kitchenConfig, quickFridgeItems: [...kitchenConfig.quickFridgeItems, clean]});
  };

  const handleAddSubQuery = () => {
    const clean = newSubQuery.trim();
    if (!clean || kitchenConfig.quickSubQueries.includes(clean)) return;
    setNewSubQuery('');
    saveKitchenConfig({...kitchenConfig, quickSubQueries: [...kitchenConfig.quickSubQueries, clean]});
  };

  const handleAddCustomSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubRule.ingredient.trim() || !newSubRule.substitute.trim() || !newSubRule.flavorNote.trim()) return;
    const rule: CustomSubstitutionRule = {
      id: `sub-${Date.now()}`,
      ingredient: newSubRule.ingredient.trim(),
      substitute: newSubRule.substitute.trim(),
      ratio: newSubRule.ratio.trim() || '۱ به ۱',
      compatibility: Number(newSubRule.compatibility) || 85,
      flavorNote: newSubRule.flavorNote.trim(),
      isVegan: newSubRule.isVegan,
    };
    setNewSubRule({ingredient: '', substitute: '', ratio: '۱ به ۱', compatibility: 88, flavorNote: '', isVegan: false});
    saveKitchenConfig(
      {...kitchenConfig, customSubstitutions: [rule, ...kitchenConfig.customSubstitutions]},
      'قانون جایگزین سفارشی اضافه شد.'
    );
  };

  // --- Gem Store handlers ---
  const saveGemOffers = async (nextOffers: GemStoreOffer[], msg = 'پیشنهادهای فروشگاه جِم بروزرسانی شد.') => {
    try {
      const res = await apiRequest<{offers: GemStoreOffer[]}>(
        '/api/admin/gem-offers',
        {method: 'PUT', body: JSON.stringify({offers: nextOffers}), useAdmin: true}
      );
      setGemOffers(res.offers);
      onRefreshAppConfig();
      onNotify(msg);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره فروشگاه جِم');
    }
  };

  const handleAddGemOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.title.trim() || !newOffer.partnerName.trim() || !newOffer.discountLabel.trim()) return;
    const offer: GemStoreOffer = {
      id: `gem-${Date.now()}`,
      title: newOffer.title.trim(),
      partnerName: newOffer.partnerName.trim(),
      discountLabel: newOffer.discountLabel.trim(),
      gemCost: Math.max(5, Number(newOffer.gemCost) || 50),
      codePrefix: newOffer.codePrefix.trim().toUpperCase() || 'LG',
    };
    setNewOffer({title: '', partnerName: '', discountLabel: '', gemCost: 80, codePrefix: 'LG'});
    saveGemOffers([offer, ...gemOffers], 'پیشنهاد جدید به فروشگاه جِم اضافه شد.');
  };

  // --- Q&A Moderation handlers ---
  const handleDeleteQuestion = async (id: string) => {
    try {
      await apiRequest(`/api/admin/questions/${id}`, {method: 'DELETE', useAdmin: true});
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      onNotify('پرسش و پاسخ‌های مرتبط با آن حذف شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف پرسش');
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    try {
      await apiRequest(`/api/admin/answers/${answerId}`, {method: 'DELETE', useAdmin: true});
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? {...q, answers: q.answers.filter((a) => a.id !== answerId)} : q))
      );
      onNotify('پاسخ انتخاب‌شده حذف شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف پاسخ');
    }
  };

  const tabs: {id: SubTab; label: string; icon: typeof Utensils; count?: number}[] = [
    {id: 'menu', label: 'منوی غذای روز و ارسال', icon: Utensils, count: menuItems.length},
    {id: 'kitchen', label: 'یخچال‌گردی و جایگزین مواد', icon: ChefHat, count: kitchenConfig.quickFridgeItems.length},
    {id: 'gems', label: 'فروشگاه جِم و پاداش‌ها', icon: Gem, count: gemOffers.length},
    {id: 'qa', label: 'نظارت پرسش‌وپاسخ‌ها', icon: MessageSquare, count: questions.length},
  ];

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E6E6E3] dark:border-[#282825] pb-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                  : 'border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="text-[11px] opacity-75 tabular-nums">({toFaDigits(t.count)})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && menuItems.length === 0 ? <AdminWorkspaceSkeleton /> : null}

      {/* 1. DAILY MENU & DELIVERY PRICING */}
      {!loading && subTab === 'menu' && (
        <div className="space-y-6">
          {/* Delivery Pricing Card */}
          <form
            onSubmit={handleSavePricing}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <h3 className="text-sm font-bold">تعرفه‌های ارسال و بسته‌بندی سفارش روزانه</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="space-y-1 text-xs">
                <span className="text-[#5C5C58] dark:text-[#A3A39E]">سقف ارسال رایگان (تومان)</span>
                <input
                  type="number"
                  min={0}
                  value={pricing.freeDeliveryThreshold}
                  onChange={(e) => setPricing({...pricing, freeDeliveryThreshold: Number(e.target.value)})}
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 tabular-nums"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[#5C5C58] dark:text-[#A3A39E]">هزینه پیک استاندارد (تومان)</span>
                <input
                  type="number"
                  min={0}
                  value={pricing.standardDeliveryFee}
                  onChange={(e) => setPricing({...pricing, standardDeliveryFee: Number(e.target.value)})}
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 tabular-nums"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-[#5C5C58] dark:text-[#A3A39E]">هزینه بسته‌بندی (تومان)</span>
                <input
                  type="number"
                  min={0}
                  value={pricing.packagingFee}
                  onChange={(e) => setPricing({...pricing, packagingFee: Number(e.target.value)})}
                  className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 tabular-nums"
                />
              </label>
            </div>
            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ذخیره تعرفه‌های سفارش</span>
            </button>
          </form>

          {/* Add Dish to Daily Menu */}
          <form
            onSubmit={handleAddMenuDish}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <h3 className="text-sm font-bold">افزودن غذای جدید به منوی روزانه</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <input
                type="text"
                required
                placeholder="نام غذا (مثلاً قرمه‌سبزی جاافتاده)"
                value={newDish.title}
                onChange={(e) => setNewDish({...newDish, title: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="زیرعنوان کوتاه"
                value={newDish.subtitle}
                onChange={(e) => setNewDish({...newDish, subtitle: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <select
                value={newDish.category}
                onChange={(e) => setNewDish({...newDish, category: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              >
                <option value="منتخب سرآشپز">منتخب سرآشپز</option>
                <option value="اصیل ایرانی">اصیل ایرانی</option>
                <option value="شمالی">شمالی</option>
                <option value="گیاهی">گیاهی</option>
              </select>
              <input
                type="number"
                min={10000}
                placeholder="قیمت تک‌نفره (تومان)"
                value={newDish.singlePrice}
                onChange={(e) => setNewDish({...newDish, singlePrice: Number(e.target.value)})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <input
                type="number"
                min={10000}
                placeholder="قیمت دونفره (تومان)"
                value={newDish.doublePrice}
                onChange={(e) => setNewDish({...newDish, doublePrice: Number(e.target.value)})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <input
                type="text"
                placeholder="نام آشپزخانه یا سرآشپز"
                value={newDish.chefName}
                onChange={(e) => setNewDish({...newDish, chefName: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newDish.featured}
                  onChange={(e) => setNewDish({...newDish, featured: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>نمایش در جایگاه غذای منتخب روز</span>
              </label>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-[#111110] dark:bg-[#FAFAFA] text-white dark:text-[#111110] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>افزودن به منوی روز</span>
              </button>
            </div>
          </form>

          {/* Existing Daily Menu List */}
          <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] divide-y divide-[#E6E6E3]/70 dark:divide-[#282825]">
            {menuItems.map((dish) => (
              <div key={dish.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{dish.title}</span>
                    {dish.featured && (
                      <span className="text-[11px] font-medium text-[#B54B1F] dark:text-[#E29A6F]">· منتخب روز</span>
                    )}
                  </div>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    {dish.category} · {dish.chefName} · تک‌نفره {formatToman(dish.singlePrice)} / دونفره{' '}
                    {formatToman(dish.doublePrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleDishFeatured(dish)}
                    className="min-h-[38px] px-3 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-xs inline-flex items-center gap-1"
                  >
                    <Star className="w-3.5 h-3.5" fill={dish.featured ? 'currentColor' : 'none'} />
                    <span>{dish.featured ? 'منتخب' : 'تنظیم منتخب'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDish(dish.id)}
                    aria-label="حذف از منو"
                    className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SMART KITCHEN / FRIDGE & CUSTOM SUBSTITUTIONS */}
      {subTab === 'kitchen' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Fridge Ingredients */}
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">مواد پیشنهادی سریع بخش یخچال‌گردی</h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  این اقلام در صفحه «آشپزخانه هوشمند» برای انتخاب سریع کاربران نمایش داده می‌شوند (قابل تنظیم بر اساس فصل).
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFridgeItem}
                  onChange={(e) => setNewFridgeItem(e.target.value)}
                  placeholder="افزودن ماده جدید (مثلاً کدو حلوایی)"
                  className="flex-1 min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddFridgeItem}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-medium"
                >
                  افزودن
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {kitchenConfig.quickFridgeItems.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 py-1.5 text-xs"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`حذف ${item}`}
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          quickFridgeItems: kitchenConfig.quickFridgeItems.filter((x) => x !== item),
                        })
                      }
                      className="text-[#5C5C58] hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Substitution Queries */}
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">پیشنهادهای سریع موتور جایگزین مواد</h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  مواد پرتقاضایی که کاربران با یک کلیک جایگزین آن‌ها را جست‌وجو می‌کنند.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubQuery}
                  onChange={(e) => setNewSubQuery(e.target.value)}
                  placeholder="مثلاً خامه صبحانه"
                  className="flex-1 min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSubQuery}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-medium"
                >
                  افزودن
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {kitchenConfig.quickSubQueries.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 py-1.5 text-xs"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`حذف ${item}`}
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          quickSubQueries: kitchenConfig.quickSubQueries.filter((x) => x !== item),
                        })
                      }
                      className="text-[#5C5C58] hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Substitutions Rules */}
          <form
            onSubmit={handleAddCustomSub}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <h3 className="text-sm font-bold">افزودن قانون جایگزین سفارشی سرآشپز</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="ماده اصلی (مثلاً خامه)"
                value={newSubRule.ingredient}
                onChange={(e) => setNewSubRule({...newSubRule, ingredient: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="جایگزین (مثلاً شیر + کره)"
                value={newSubRule.substitute}
                onChange={(e) => setNewSubRule({...newSubRule, substitute: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="نسبت جایگزینی"
                value={newSubRule.ratio}
                onChange={(e) => setNewSubRule({...newSubRule, ratio: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="number"
                min={10}
                max={100}
                placeholder="درصد سازگاری"
                value={newSubRule.compatibility}
                onChange={(e) => setNewSubRule({...newSubRule, compatibility: Number(e.target.value)})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                required
                placeholder="توضیح طعم و بافت جایگزین برای کاربر..."
                value={newSubRule.flavorNote}
                onChange={(e) => setNewSubRule({...newSubRule, flavorNote: e.target.value})}
                className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={newSubRule.isVegan}
                  onChange={(e) => setNewSubRule({...newSubRule, isVegan: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>گیاهی</span>
              </label>
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-xl bg-[#111110] dark:bg-[#FAFAFA] text-white dark:text-[#111110] text-xs font-semibold"
              >
                ثبت جایگزین
              </button>
            </div>

            {kitchenConfig.customSubstitutions.length > 0 && (
              <div className="pt-3 border-t border-[#E6E6E3] dark:border-[#282825] space-y-2">
                {kitchenConfig.customSubstitutions.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-bold">{rule.ingredient}</span> ←{' '}
                      <span className="text-[#B54B1F] dark:text-[#E29A6F] font-semibold">{rule.substitute}</span> (
                      {rule.ratio} · {toFaDigits(rule.compatibility)}٪) — {rule.flavorNote}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          customSubstitutions: kitchenConfig.customSubstitutions.filter((r) => r.id !== rule.id),
                        })
                      }
                      className="text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 3. GEM STORE OFFERS CMS */}
      {subTab === 'gems' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddGemOffer}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <h3 className="text-sm font-bold">افزودن کوپن جدید به فروشگاه جِم</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <input
                type="text"
                required
                placeholder="عنوان کوپن"
                value={newOffer.title}
                onChange={(e) => setNewOffer({...newOffer, title: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="نام همکار / برند"
                value={newOffer.partnerName}
                onChange={(e) => setNewOffer({...newOffer, partnerName: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="برچسب تخفیف (مثلاً ۵۰ هزار تومان)"
                value={newOffer.discountLabel}
                onChange={(e) => setNewOffer({...newOffer, discountLabel: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="number"
                min={5}
                placeholder="هزینه (جِم)"
                value={newOffer.gemCost}
                onChange={(e) => setNewOffer({...newOffer, gemCost: Number(e.target.value)})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <input
                type="text"
                dir="ltr"
                placeholder="پیشوند کد (LG)"
                value={newOffer.codePrefix}
                onChange={(e) => setNewOffer({...newOffer, codePrefix: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
            </div>
            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن به فروشگاه جِم</span>
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gemOffers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-sm font-bold">{offer.title}</div>
                  <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    {offer.partnerName} · {offer.discountLabel} · پیشوند <span dir="ltr">{offer.codePrefix}</span>
                  </div>
                  <div className="text-xs font-bold text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
                    {toFaDigits(offer.gemCost)} جِم
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveGemOffers(gemOffers.filter((o) => o.id !== offer.id), 'پیشنهاد از فروشگاه جِم حذف شد.')}
                  aria-label="حذف پیشنهاد جِم"
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. RECIPE Q&A MODERATION */}
      {subTab === 'qa' && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center text-xs text-[#5C5C58]">
              هنوز پرسشی از سوی کاربران ثبت نشده است.
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                      دستور: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{q.recipeTitle}</strong> · پرسشگر:{' '}
                      {q.authorName}
                    </div>
                    <p className="text-sm font-semibold">{q.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="min-h-[36px] px-3 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 text-xs inline-flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف پرسش</span>
                  </button>
                </div>

                {q.answers.length > 0 && (
                  <div className="pt-3 border-t border-[#E6E6E3]/70 dark:border-[#282825] space-y-2">
                    {q.answers.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 py-2.5 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold">{a.authorName}</span>
                          {a.isBest && (
                            <span className="text-[#B54B1F] dark:text-[#E29A6F] mr-1.5">· بهترین پاسخ</span>
                          )}
                          <p className="text-[#5C5C58] dark:text-[#A3A39E]">{a.body}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnswer(q.id, a.id)}
                          aria-label="حذف پاسخ"
                          className="text-red-600 shrink-0 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
