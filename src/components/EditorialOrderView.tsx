import {useEffect, useState} from 'react';
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {prefetchRecipeDetail} from '../lib/recipePrefetch.ts';
import {formatToman, normalizePersian, toFaDigits, validateIranMobile} from '../shared/persianEngine.ts';
import type {EditorialMenuItem, OrderRecord, UserProfile} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';
import {OrderMenuSkeleton} from './EditorialSkeletons.tsx';

export interface CartEntry {
  dish: EditorialMenuItem;
  portion: 'single' | 'double';
  quantity: number;
  note: string;
}

interface EditorialOrderViewProps {
  user: UserProfile | null;
  cart: CartEntry[];
  onChangeCart: (next: CartEntry[]) => void;
  onOpenLinkedRecipe: (recipeId: string) => void;
  onRefreshUser: () => void;
  onNotify: (msg: string) => void;
}

const MENU_CATEGORIES = ['همه', 'منتخب سرآشپز', 'اصیل ایرانی', 'شمالی', 'گیاهی'];
const DELIVERY_SLOTS = ['امروز ۱۲:۳۰ تا ۱۳:۳۰', 'امروز ۱۳:۳۰ تا ۱۴:۳۰', 'امروز ۱۹:۳۰ تا ۲۰:۳۰', 'امروز ۲۰:۳۰ تا ۲۱:۳۰'];

export function EditorialOrderView({
  user,
  cart,
  onChangeCart,
  onOpenLinkedRecipe,
  onRefreshUser,
  onNotify,
}: EditorialOrderViewProps) {
  const [menu, setMenu] = useState<EditorialMenuItem[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [freeThreshold, setFreeThreshold] = useState(600000);
  const [packagingFee, setPackagingFee] = useState(18000);
  const [standardDeliveryFee, setStandardDeliveryFee] = useState(45000);

  const [city, setCity] = useState(user?.city || 'تهران');
  const [neighborhood, setNeighborhood] = useState(user?.neighborhood || 'ونک');
  const [category, setCategory] = useState('همه');
  const [query, setQuery] = useState('');

  // Active dish customization modal
  const [selectedDish, setSelectedDish] = useState<EditorialMenuItem | null>(null);
  const [portion, setPortion] = useState<'single' | 'double'>('single');
  const [kitchenNote, setKitchenNote] = useState('');

  // Checkout drawer
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.phone || '');
  const [deliverySlot, setDeliverySlot] = useState(DELIVERY_SLOTS[0]);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);
  const [orderHistory, setOrderHistory] = useState<OrderRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setLoadingMenu(true);
    apiRequest<{
      items: EditorialMenuItem[];
      freeDeliveryThreshold: number;
      packagingFee: number;
      standardDeliveryFee: number;
    }>('/api/menu')
      .then((res) => {
        setMenu(res.items);
        setFreeThreshold(res.freeDeliveryThreshold);
        setPackagingFee(res.packagingFee);
        setStandardDeliveryFee(res.standardDeliveryFee);
      })
      .catch(() => {})
      .finally(() => setLoadingMenu(false));
  }, []);

  useEffect(() => {
    if (user) {
      setPhone(user.phone);
      apiRequest<{orders: OrderRecord[]}>('/api/orders')
        .then((res) => setOrderHistory(res.orders))
        .catch(() => {});
    }
  }, [user]);

  const filteredMenu = menu.filter((item) => {
    if (category !== 'همه' && item.category !== category) return false;
    if (query.trim()) {
      const hay = normalizePersian(`${item.title} ${item.subtitle} ${item.chefName} ${item.keyIngredients.join(' ')}`);
      if (!hay.includes(normalizePersian(query))) return false;
    }
    return true;
  });

  const featuredDish = filteredMenu.find((m) => m.featured) || filteredMenu[0];
  const listDishes = featuredDish && category === 'همه' && !query ? filteredMenu.filter((m) => m.id !== featuredDish.id) : filteredMenu;

  const addToCart = (dish: EditorialMenuItem, selectedPortion: 'single' | 'double', note: string) => {
    const existingIdx = cart.findIndex((c) => c.dish.id === dish.id && c.portion === selectedPortion);
    if (existingIdx >= 0) {
      const updated = cart.map((c, idx) => (idx === existingIdx ? {...c, quantity: c.quantity + 1, note: note || c.note} : c));
      onChangeCart(updated);
    } else {
      onChangeCart([...cart, {dish, portion: selectedPortion, quantity: 1, note}]);
    }
    setSelectedDish(null);
    setKitchenNote('');
    onNotify(`«${dish.title}» به سبد سفارش اضافه شد.`);
  };

  const updateCartQty = (idx: number, delta: number) => {
    const next = cart
      .map((item, i) => (i === idx ? {...item, quantity: item.quantity + delta} : item))
      .filter((item) => item.quantity > 0);
    onChangeCart(next);
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + (item.portion === 'double' ? item.dish.doublePrice : item.dish.singlePrice) * item.quantity,
    0
  );
  const deliveryFee = subtotal >= freeThreshold || subtotal === 0 ? 0 : standardDeliveryFee;
  const total = subtotal > 0 ? subtotal + packagingFee + deliveryFee : 0;
  const totalCount = cart.reduce((s, c) => s + c.quantity, 0);

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutError(null);
    if (address.trim().length < 8) {
      setCheckoutError('لطفاً نشانی دقیق تحویل (خیابان، کوچه، پلاک و واحد) را کامل وارد کنید.');
      return;
    }
    const phoneCheck = validateIranMobile(phone);
    if (!phoneCheck.valid) {
      setCheckoutError(phoneCheck.error || 'شماره موبایل معتبر نیست.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest<{order: OrderRecord}>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          city,
          neighborhood,
          address: address.trim(),
          phone: phoneCheck.normalized,
          deliverySlot,
          note: cart
            .map((c) => c.note)
            .filter(Boolean)
            .join(' | '),
          items: cart.map((c) => ({dishId: c.dish.id, portion: c.portion, quantity: c.quantity})),
        }),
      });
      setConfirmedOrder(res.order);
      setOrderHistory((prev) => [res.order, ...prev]);
      onChangeCart([]);
      onRefreshUser();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'خطا در ثبت سفارش');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Calm Header & Neighborhood Selector */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E6E6E3] dark:border-[#282825] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">سفره ادیتوریال لاقلی</p>
          <h1 className="text-2xl sm:text-3xl font-bold">منوی دست‌ساز امروز</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-3 min-h-[44px] text-xs">
            <MapPin className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
            <select
              aria-label="شهر تحویل"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="bg-transparent font-medium outline-none"
            >
              <option value="تهران">تهران</option>
              <option value="رشت">رشت</option>
              <option value="شیراز">شیراز</option>
            </select>
            <span aria-hidden="true" className="opacity-40">
              /
            </span>
            <input
              type="text"
              aria-label="محله تحویل"
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
              className="bg-transparent w-20 outline-none"
            />
          </div>

          {orderHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="min-h-[44px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
            >
              {showHistory ? 'بازگشت به منو' : `سفارش‌های من (${toFaDigits(orderHistory.length)})`}
            </button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-lg font-bold">تاریخچه و پیگیری سفارش‌ها</h2>
          {orderHistory.map((ord) => (
            <div
              key={ord.id}
              className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                <span dir="ltr" className="font-mono font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">
                  {ord.trackingCode}
                </span>
                <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">
                  تاییدشده — در حال آماده‌سازی در آشپزخانه
                </span>
              </div>
              <div className="text-sm space-y-1">
                {ord.items.map((l, idx) => (
                  <div key={idx} className="flex justify-between tabular-nums">
                    <span>
                      {l.title} ({l.portion === 'double' ? 'دونفره' : 'تک‌نفره'}) × {toFaDigits(l.quantity)}
                    </span>
                    <span>{formatToman(l.unitPrice * l.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-[#E6E6E3] dark:border-[#282825] text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                <span>بازه تحویل: {ord.deliverySlot}</span>
                <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA] tabular-nums">
                  مجموع: {formatToman(ord.total)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Minimalist Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {MENU_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[42px] px-4 rounded-full text-sm whitespace-nowrap shrink-0 transition-all active:scale-[0.97] ${
                    category === cat
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] font-semibold'
                      : 'bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative sm:w-64">
              <Search className="w-4 h-4 text-[#5C5C58] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجو در منوی روز..."
                className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] pr-10 pl-3 text-sm"
              />
            </div>
          </div>

          {loadingMenu ? (
            <OrderMenuSkeleton />
          ) : (
            <>
          {/* Featured Chef's Dish of the Day */}
          {featuredDish && category === 'همه' && !query && (
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-stretch border-b border-[#E6E6E3] dark:border-[#282825] pb-10">
              <div className="lg:col-span-7 rounded-2xl overflow-hidden border border-[#E6E6E3] dark:border-[#282825]">
                <EditorialImage src={featuredDish.imageUrl} alt={featuredDish.title} aspectClass="aspect-[16/10] lg:h-full" priority />
              </div>
              <div className="lg:col-span-5 flex flex-col justify-between gap-6 py-1">
                <div className="space-y-3.5">
                  <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] flex items-center gap-2">
                    <span>پیشنهاد ویژه سرآشپز امروز</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{toFaDigits(featuredDish.prepMinutes)} دقیقه</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{toFaDigits(featuredDish.calories)} کالری</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold leading-snug">{featuredDish.title}</h2>
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{featuredDish.story}</p>
                  <div className="inline-flex items-center gap-1.5 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    <span>{featuredDish.chefName}</span>
                    {featuredDish.chefVerified && <BadgeCheck className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="text-xl font-bold tabular-nums">{formatToman(featuredDish.singlePrice)}</div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDish(featuredDish);
                        setPortion('single');
                      }}
                      className="min-h-[48px] px-6 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.98] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] text-[#FFFFFF] text-sm font-semibold transition-all"
                    >
                      انتخاب پرس و افزودن به سبد
                    </button>
                    {featuredDish.linkedRecipeId && (
                      <button
                        type="button"
                        onMouseEnter={() =>
                          prefetchRecipeDetail(featuredDish.linkedRecipeId!, city, {priority: 'high'})
                        }
                        onTouchStart={() =>
                          prefetchRecipeDetail(featuredDish.linkedRecipeId!, city, {priority: 'high'})
                        }
                        onClick={() => onOpenLinkedRecipe(featuredDish.linkedRecipeId!)}
                        className="min-h-[48px] px-5 rounded-full border border-[#D8D8D4] dark:border-[#2E2E2B] bg-white dark:bg-[#151514] text-sm font-medium"
                      >
                        دستور پخت خانگی
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Single-Column Breathable Editorial Food List */}
          <section className="max-w-4xl space-y-8">
            {listDishes.map((dish) => (
              <article
                key={dish.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-5 sm:gap-8 pb-8 border-b border-[#E6E6E3]/80 dark:border-[#282825] items-center"
              >
                <div
                  onClick={() => {
                    setSelectedDish(dish);
                    setPortion('single');
                  }}
                  className="sm:col-span-5 rounded-2xl overflow-hidden cursor-pointer border border-[#E6E6E3]/70 dark:border-[#282825]"
                >
                  <EditorialImage src={dish.imageUrl} alt={dish.title} aspectClass="aspect-[4/3]" />
                </div>

                <div className="sm:col-span-7 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                    <span>{dish.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" /> {toFaDigits(dish.prepMinutes)} دقیقه
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{toFaDigits(dish.calories)} کالری</span>
                  </div>

                  <h3 className="text-xl font-bold">{dish.title}</h3>
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{dish.subtitle}</p>

                  <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                    <div className="text-base font-bold tabular-nums">{formatToman(dish.singlePrice)}</div>
                    <div className="flex items-center gap-2">
                      {dish.linkedRecipeId && (
                        <button
                          type="button"
                          onMouseEnter={() => prefetchRecipeDetail(dish.linkedRecipeId!, city, {priority: 'high'})}
                          onTouchStart={() => prefetchRecipeDetail(dish.linkedRecipeId!, city, {priority: 'high'})}
                          onClick={() => onOpenLinkedRecipe(dish.linkedRecipeId!)}
                          className="min-h-[44px] px-3.5 rounded-xl text-xs text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]"
                        >
                          دستور پخت
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDish(dish);
                          setPortion('single');
                        }}
                        className="min-h-[44px] px-5 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.97] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] text-[#FFFFFF] text-sm font-semibold transition-all"
                      >
                        افزودن
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
            </>
          )}
        </>
      )}

      {/* Quiet Floating Cart Summary Bar */}
      {totalCount > 0 && !checkoutOpen && (
        <div className="fixed bottom-[86px] md:bottom-6 inset-x-4 z-30 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => {
              setConfirmedOrder(null);
              setCheckoutOpen(true);
            }}
            className="pointer-events-auto w-full max-w-xl min-h-[54px] px-5 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] flex items-center justify-between gap-4 shadow-[0_14px_34px_-10px_rgba(0,0,0,0.45)] active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              <ShoppingBag className="w-4 h-4" />
              <span>سبد سفارش ({toFaDigits(totalCount)} پرس)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums">{formatToman(total)}</span>
              <span className="text-xs underline">تکمیل سفارش</span>
            </div>
          </button>
        </div>
      )}

      {/* Dish Customization Modal */}
      {selectedDish && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
        >
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{selectedDish.chefName}</p>
                <h3 className="text-xl font-bold mt-0.5">{selectedDish.title}</h3>
              </div>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setSelectedDish(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{selectedDish.story}</p>

            <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
              مواد منتخب: {selectedDish.keyIngredients.join(' · ')}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">انتخاب حجم پرس</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPortion('single')}
                  className={`min-h-[56px] p-3 rounded-xl border text-right transition-colors ${
                    portion === 'single'
                      ? 'border-[#B54B1F] bg-[#B54B1F]/8 dark:border-[#E29A6F]'
                      : 'border-[#E6E6E3] dark:border-[#282825]'
                  }`}
                >
                  <div className="text-sm font-semibold">پرس تک‌نفره</div>
                  <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums mt-0.5">
                    {formatToman(selectedDish.singlePrice)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPortion('double')}
                  className={`min-h-[56px] p-3 rounded-xl border text-right transition-colors ${
                    portion === 'double'
                      ? 'border-[#B54B1F] bg-[#B54B1F]/8 dark:border-[#E29A6F]'
                      : 'border-[#E6E6E3] dark:border-[#282825]'
                  }`}
                >
                  <div className="text-sm font-semibold">پرس دونفره</div>
                  <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums mt-0.5">
                    {formatToman(selectedDish.doublePrice)}
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="kitchen-note" className="block text-sm font-medium mb-1.5">
                توضیحات اختیاری برای آشپزخانه
              </label>
              <input
                id="kitchen-note"
                type="text"
                value={kitchenNote}
                onChange={(e) => setKitchenNote(e.target.value)}
                placeholder="مثلاً بدون پیازداغ، یا کشک جداگانه..."
                className="w-full min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => addToCart(selectedDish, portion, kitchenNote)}
              className="w-full min-h-[48px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-sm font-medium tabular-nums"
            >
              افزودن به سبد — {formatToman(portion === 'double' ? selectedDish.doublePrice : selectedDish.singlePrice)}
            </button>
          </div>
        </div>
      )}

      {/* Checkout Drawer */}
      {checkoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-[#F6F6F5] dark:bg-[#0B0B0B] h-full overflow-y-auto p-6 space-y-6 border-r border-[#E6E6E3] dark:border-[#282825]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{confirmedOrder ? 'سفارش شما ثبت شد' : 'تکمیل سفارش'}</h2>
              <button
                type="button"
                aria-label="بستن"
                onClick={() => setCheckoutOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {confirmedOrder ? (
              <div className="rounded-2xl border border-[#B54B1F]/30 bg-[#FFFFFF] dark:bg-[#151514] p-6 space-y-4">
                <CheckCircle2 className="w-10 h-10 text-[#B54B1F] dark:text-[#E29A6F]" />
                <div className="space-y-1">
                  <h3 className="text-lg font-bold">سفارش با موفقیت تایید شد</h3>
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">
                    آشپزخانه لاقلی آماده‌سازی غذای شما را آغاز کرده است.
                  </p>
                </div>
                <div className="border-t border-[#E6E6E3] dark:border-[#282825] pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">کد پیگیری</span>
                    <span dir="ltr" className="font-mono font-bold">
                      {confirmedOrder.trackingCode}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">بازه تحویل</span>
                    <span>{confirmedOrder.deliverySlot}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">مبلغ نهایی</span>
                    <span className="font-bold tabular-nums">{formatToman(confirmedOrder.total)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  className="w-full min-h-[48px] rounded-xl bg-[#B54B1F] text-[#FAFAFA] text-sm font-medium"
                >
                  بازگشت به منو
                </button>
              </div>
            ) : (
              <form onSubmit={handlePlaceOrder} className="space-y-6">
                {/* Cart Lines */}
                <div className="space-y-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                  {cart.map((item, idx) => (
                    <div
                      key={`${item.dish.id}-${item.portion}`}
                      className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-[#E6E6E3]/70 dark:border-[#282825]"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{item.dish.title}</div>
                        <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                          {item.portion === 'double' ? 'دونفره' : 'تک‌نفره'} ·{' '}
                          {formatToman(item.portion === 'double' ? item.dish.doublePrice : item.dish.singlePrice)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          aria-label="کاهش تعداد"
                          onClick={() => updateCartQty(idx, -1)}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-[#E6E6E3] dark:border-[#282825]"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm tabular-nums">{toFaDigits(item.quantity)}</span>
                        <button
                          type="button"
                          aria-label="افزایش تعداد"
                          onClick={() => updateCartQty(idx, 1)}
                          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg border border-[#E6E6E3] dark:border-[#282825]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery Details */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="ord-slot" className="block text-sm font-medium mb-1.5">
                      بازه زمانی تحویل
                    </label>
                    <select
                      id="ord-slot"
                      value={deliverySlot}
                      onChange={(e) => setDeliverySlot(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-3.5 text-sm"
                    >
                      {DELIVERY_SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ord-phone" className="block text-sm font-medium mb-1.5">
                      شماره موبایل گیرنده
                    </label>
                    <input
                      id="ord-phone"
                      type="tel"
                      dir="ltr"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="09123456789"
                      className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-4 text-left text-sm tabular-nums"
                    />
                  </div>

                  <div>
                    <label htmlFor="ord-address" className="block text-sm font-medium mb-1.5">
                      نشانی دقیق تحویل ({city}، {neighborhood})
                    </label>
                    <textarea
                      id="ord-address"
                      rows={3}
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="خیابان، کوچه، پلاک، طبقه و واحد..."
                      className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-3.5 text-sm"
                    />
                  </div>
                </div>

                {checkoutError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{checkoutError}</span>
                  </div>
                )}

                {/* Transparent Invoice Breakdown */}
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-2.5 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">جمع غذاها</span>
                    <span>{formatToman(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">بسته‌بندی گرم‌نگه‌دار</span>
                    <span>{formatToman(packagingFee)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">
                      هزینه ارسال (رایگان بالای {formatToman(freeThreshold)})
                    </span>
                    <span className={deliveryFee === 0 ? 'text-[#B54B1F] dark:text-[#E29A6F] font-medium' : ''}>
                      {deliveryFee === 0 ? 'رایگان' : formatToman(deliveryFee)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[#E6E6E3] dark:border-[#282825] text-base font-bold">
                    <span>مبلغ قابل پرداخت</span>
                    <span>{formatToman(total)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || cart.length === 0}
                  className="w-full min-h-[50px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-sm font-medium disabled:opacity-40"
                >
                  {submitting ? 'در حال ثبت سفارش...' : `تایید و ثبت سفارش (${formatToman(total)})`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
