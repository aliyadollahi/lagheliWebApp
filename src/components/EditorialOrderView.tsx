import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle2,
  Clock,
  MapPin,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
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
  const [confirmClearCart, setConfirmClearCart] = useState(false);

  // Lock background page scroll while either dish sheet or cart drawer is open
  useEffect(() => {
    if (!checkoutOpen && !selectedDish) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [checkoutOpen, selectedDish]);

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

      {/* Elevated Floating Cart Bar — Mobile-First with Dish Thumbnails & Free-Delivery Status */}
      <AnimatePresence>
        {totalCount > 0 && !checkoutOpen && (
          <motion.div
            initial={{opacity: 0, y: 28, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 24, scale: 0.96}}
            transition={{type: 'spring', stiffness: 380, damping: 30}}
            className="fixed bottom-[86px] md:bottom-6 inset-x-3 sm:inset-x-4 z-30 flex justify-center pointer-events-none"
          >
            <button
              type="button"
              onClick={() => {
                setConfirmedOrder(null);
                setConfirmClearCart(false);
                setCheckoutOpen(true);
              }}
              className="pointer-events-auto w-full max-w-xl rounded-full bg-[#0D0D0D]/95 dark:bg-[#FAFAFA]/95 text-[#FFFFFF] dark:text-[#0B0B0B] backdrop-blur-xl border border-white/14 dark:border-black/10 p-1.5 pl-2 pr-2.5 flex items-center justify-between gap-2.5 shadow-[0_18px_42px_-12px_rgba(0,0,0,0.52)] active:scale-[0.985] transition-transform"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {/* Overlapping Dish Thumbnails */}
                <div className="flex items-center -space-x-2 space-x-reverse shrink-0">
                  {cart.slice(0, 2).map((entry) => (
                    <div
                      key={`${entry.dish.id}-${entry.portion}`}
                      className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#0D0D0D] dark:border-[#FAFAFA] bg-[#20201E] shrink-0"
                    >
                      <EditorialImage
                        src={entry.dish.imageUrl}
                        alt={entry.dish.title}
                        aspectClass="w-full h-full"
                        compactEmpty
                      />
                    </div>
                  ))}
                </div>

                <div className="text-right min-w-0">
                  <div className="text-xs sm:text-sm font-extrabold leading-tight flex items-center gap-1.5">
                    <span>سبد سفارش</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#B54B1F] text-[#FFFFFF] text-[10px] font-bold tabular-nums">
                      {toFaDigits(totalCount)} پرس
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 leading-tight mt-0.5 tabular-nums truncate">
                    {deliveryFee === 0
                      ? 'ارسال رایگان فعال شد'
                      : `${formatToman(Math.max(0, freeThreshold - subtotal))} تا ارسال رایگان`}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs sm:text-sm font-extrabold tabular-nums whitespace-nowrap">
                  {formatToman(total)}
                </span>
                <span className="min-h-[38px] px-3 sm:px-3.5 rounded-full bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#0D0D0D] dark:text-[#FAFAFA] text-xs font-extrabold inline-flex items-center gap-1 whitespace-nowrap">
                  <span>تکمیل</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Refined Dish Customization Bottom Sheet / Modal */}
      <AnimatePresence>
        {selectedDish && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.18}}
            role="dialog"
            aria-modal="true"
            aria-label={selectedDish.title}
            onClick={() => setSelectedDish(null)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[3px] p-0 sm:p-4"
          >
            <motion.div
              initial={{y: 36, opacity: 0.6}}
              animate={{y: 0, opacity: 1}}
              exit={{y: 32, opacity: 0}}
              transition={{type: 'spring', stiffness: 380, damping: 32}}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-t-[28px] sm:rounded-[28px] bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] overflow-hidden max-h-[92vh] flex flex-col shadow-[0_28px_72px_-20px_rgba(0,0,0,0.55)]"
            >
              {/* Compact Visual Header */}
              <div className="relative h-44 sm:h-48 shrink-0 bg-[#EFEFED] dark:bg-[#20201E]">
                <EditorialImage
                  src={selectedDish.imageUrl}
                  alt={selectedDish.title}
                  aspectClass="w-full h-full"
                  priority
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/65 to-transparent"
                />
                <button
                  type="button"
                  aria-label="بستن"
                  onClick={() => setSelectedDish(null)}
                  className="absolute top-3 left-3 w-10 h-10 rounded-full bg-[#0D0D0D]/72 text-white backdrop-blur-md border border-white/15 flex items-center justify-center hover:bg-[#0D0D0D] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 right-4 left-4 text-white">
                  <p className="text-[11px] text-white/80 font-medium">{selectedDish.chefName}</p>
                  <h3 className="text-lg sm:text-xl font-extrabold leading-snug">{selectedDish.title}</h3>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
                <p className="text-xs sm:text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                  {selectedDish.story}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {selectedDish.keyIngredients.map((ing) => (
                    <span
                      key={ing}
                      className="px-2.5 py-1 rounded-full bg-[#F6F6F5] dark:bg-[#20201E] border border-[#E6E6E3] dark:border-[#2C2C29] text-[11px] font-medium text-[#5C5C58] dark:text-[#A3A39E]"
                    >
                      {ing}
                    </span>
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">انتخاب حجم پرس</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {id: 'single' as const, label: 'پرس تک‌نفره', price: selectedDish.singlePrice},
                      {id: 'double' as const, label: 'پرس دونفره', price: selectedDish.doublePrice},
                    ].map((opt) => {
                      const active = portion === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPortion(opt.id)}
                          className={`min-h-[64px] p-3.5 rounded-2xl border text-right transition-all flex items-start justify-between gap-2 ${
                            active
                              ? 'border-[#0D0D0D] dark:border-[#FAFAFA] bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B]'
                              : 'border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA]'
                          }`}
                        >
                          <div>
                            <div className="text-sm font-bold">{opt.label}</div>
                            <div className="text-xs opacity-80 tabular-nums mt-0.5">
                              {formatToman(opt.price)}
                            </div>
                          </div>
                          {active && (
                            <span className="w-5 h-5 rounded-full bg-[#B54B1F] text-white flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-3 h-3" strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="kitchen-note"
                    className="block text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] mb-1.5"
                  >
                    توضیحات اختیاری برای سرآشپز
                  </label>
                  <input
                    id="kitchen-note"
                    type="text"
                    value={kitchenNote}
                    onChange={(e) => setKitchenNote(e.target.value)}
                    placeholder="مثلاً بدون پیازداغ، یا کشک جداگانه..."
                    className="w-full min-h-[46px] rounded-2xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm focus:outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
                  />
                </div>
              </div>

              <div className="p-4 sm:p-5 border-t border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF] dark:bg-[#151514]">
                <button
                  type="button"
                  onClick={() => addToCart(selectedDish, portion, kitchenNote)}
                  className="w-full min-h-[50px] rounded-full bg-[#0D0D0D] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-extrabold tabular-nums active:scale-[0.985] transition-all"
                >
                  افزودن به سبد سفارش · {formatToman(portion === 'double' ? selectedDish.doublePrice : selectedDish.singlePrice)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Luxury Editorial Checkout & Cart Slide-Over Drawer */}
      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.2}}
            role="dialog"
            aria-modal="true"
            aria-label="سبد سفارش و تکمیل خرید"
            onClick={() => setCheckoutOpen(false)}
            className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-[3px]"
          >
            <motion.div
              initial={{x: -44, opacity: 0.5}}
              animate={{x: 0, opacity: 1}}
              exit={{x: -44, opacity: 0}}
              transition={{type: 'spring', stiffness: 360, damping: 34}}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#F6F6F5] dark:bg-[#0B0B0B] h-full flex flex-col border-r border-[#E6E6E3] dark:border-[#242422] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            >
              {/* Sticky Cart Header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-5 h-16 bg-[#FFFFFF]/92 dark:bg-[#151514]/92 backdrop-blur-md border-b border-[#E6E6E3] dark:border-[#242422]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] leading-tight">
                      {confirmedOrder ? 'تایید سفارش لاقلی' : 'سبد سفارش شما'}
                    </h2>
                    {!confirmedOrder && (
                      <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                        {totalCount > 0 ? `${toFaDigits(totalCount)} پرس انتخاب‌شده` : 'سبد خالی است'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!confirmedOrder && cart.length > 0 && !confirmClearCart && (
                    <button
                      type="button"
                      onClick={() => setConfirmClearCart(true)}
                      className="min-h-[36px] px-3 rounded-full text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:bg-[#B54B1F]/10 transition-colors"
                    >
                      خالی‌کردن
                    </button>
                  )}
                  {!confirmedOrder && confirmClearCart && (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[#B54B1F]/10 border border-[#B54B1F]/30 px-2.5 py-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeCart([]);
                          setConfirmClearCart(false);
                        }}
                        className="font-bold text-[#B54B1F] dark:text-[#E29A6F]"
                      >
                        حذف همه
                      </button>
                      <span className="opacity-35">|</span>
                      <button
                        type="button"
                        onClick={() => setConfirmClearCart(false)}
                        className="text-[#5C5C58] dark:text-[#A3A39E]"
                      >
                        لغو
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label="بستن سبد سفارش"
                    onClick={() => setCheckoutOpen(false)}
                    className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#EFEFED] dark:hover:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5">
                {confirmedOrder ? (
                  <div className="rounded-[24px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-6 space-y-5">
                    <div className="w-12 h-12 rounded-2xl bg-[#B54B1F]/12 text-[#B54B1F] dark:text-[#E29A6F] flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="text-lg font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        سفارش شما با موفقیت ثبت شد
                      </h3>
                      <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                        آشپزخانه لاقلی آماده‌سازی غذای تازه شما را آغاز کرده است.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] p-4 space-y-2.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E]">کد پیگیری</span>
                        <span dir="ltr" className="font-mono font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                          {confirmedOrder.trackingCode}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E]">بازه تحویل</span>
                        <span className="font-medium text-[#0D0D0D] dark:text-[#FAFAFA]">
                          {confirmedOrder.deliverySlot}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 pt-2 border-t border-[#E6E6E3] dark:border-[#2C2C29]">
                        <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">مبلغ نهایی</span>
                        <span className="font-extrabold tabular-nums text-[#B54B1F] dark:text-[#E29A6F]">
                          {formatToman(confirmedOrder.total)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="w-full min-h-[48px] rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-bold"
                    >
                      بازگشت به منوی امروز
                    </button>
                  </div>
                ) : cart.length === 0 ? (
                  /* Graceful Empty Cart View */
                  <div className="rounded-[24px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center space-y-4 my-6">
                    <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E]">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        سبد سفارش شما خالی است
                      </h3>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                        از منوی دست‌ساز امروز، غذای دلخواهتان را انتخاب کنید تا اینجا آماده ثبت شود.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCheckoutOpen(false)}
                      className="min-h-[44px] px-6 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold"
                    >
                      مشاهده منوی امروز
                    </button>
                  </div>
                ) : (
                  <form id="lagheli-checkout-form" onSubmit={handlePlaceOrder} className="space-y-5">
                    {/* Free-Delivery Progress Card */}
                    <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">
                          {deliveryFee === 0 ? (
                            <Sparkles className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                          ) : (
                            <Truck className="w-3.5 h-3.5 text-[#A97222] dark:text-[#D8A85B]" />
                          )}
                          <span>
                            {deliveryFee === 0
                              ? 'ارسال رایگان برای این سفارش فعال شد'
                              : `${formatToman(Math.max(0, freeThreshold - subtotal))} تا ارسال رایگان`}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums text-[#B54B1F] dark:text-[#E29A6F]">
                          {toFaDigits(Math.min(100, Math.round((subtotal / Math.max(1, freeThreshold)) * 100)))}٪
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#EFEFED] dark:bg-[#242422] overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-l from-[#B54B1F] to-[#A97222] dark:from-[#E29A6F] dark:to-[#D8A85B]"
                          initial={{width: 0}}
                          animate={{
                            width: `${Math.min(100, Math.round((subtotal / Math.max(1, freeThreshold)) * 100))}%`,
                          }}
                          transition={{duration: 0.35}}
                        />
                      </div>
                    </div>

                    {/* Minimalist Editorial Cart Items Container */}
                    <div className="order-cart-container rounded-[26px] bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3]/80 dark:border-[#262623] shadow-[0_10px_30px_-20px_rgba(13,13,13,0.14)] px-4 sm:px-5 py-1 divide-y divide-[#EFEFED] dark:divide-[#222220]">
                      {cart.map((item, idx) => {
                        const unitPrice =
                          item.portion === 'double' ? item.dish.doublePrice : item.dish.singlePrice;
                        const isProcessing = item.dish.prepMinutes > 40 || item.quantity >= 3;
                        const statusLabel = isProcessing ? 'در حال تهیه' : 'موجود';
                        return (
                          <div
                            key={`${item.dish.id}-${item.portion}`}
                            className="cart-item relative pt-10 pb-4 sm:pb-5 flex items-start gap-4"
                          >
                            {/* Top-Right Fulfillment Status Badge */}
                            <span
                              data-status={isProcessing ? 'processing' : 'in-stock'}
                              className={`absolute top-3 right-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 ${
                                isProcessing
                                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/25'
                                  : 'bg-green-50 text-green-700 ring-1 ring-green-200/80 dark:bg-green-500/15 dark:text-green-300 dark:ring-green-400/25'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isProcessing
                                    ? 'bg-amber-500 dark:bg-amber-400 animate-pulse'
                                    : 'bg-green-500 dark:bg-green-400'
                                }`}
                              />
                              <span>{statusLabel}</span>
                            </span>

                            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden ring-1 ring-black/[0.05] dark:ring-white/[0.08] shrink-0 bg-[#F6F6F5] dark:bg-[#20201E]">
                              <EditorialImage
                                src={item.dish.imageUrl}
                                alt={item.dish.title}
                                aspectClass="w-full h-full"
                                compactEmpty
                              />
                            </div>

                            <div className="flex-1 min-w-0 space-y-2.5">
                              <div className="space-y-1">
                                <h3 className="text-[15px] sm:text-base font-bold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA] leading-[1.45] break-words">
                                  {item.dish.title}
                                </h3>

                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed tabular-nums">
                                  <span>{item.portion === 'double' ? 'پرس دونفره' : 'پرس تک‌نفره'}</span>
                                  <span aria-hidden="true" className="opacity-40">
                                    ·
                                  </span>
                                  <span>فی {formatToman(unitPrice)}</span>
                                </div>
                                {item.note && (
                                  <p className="text-xs text-[#B54B1F] dark:text-[#E29A6F] leading-relaxed pt-0.5">
                                    یادداشت سرآشپز: {item.note}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-3 pt-1">
                                <span className="text-[15px] font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA] tabular-nums">
                                  {formatToman(unitPrice * item.quantity)}
                                </span>

                                {/* Delicate Soft-Rounded Quantity Icons (No Sharp Borders) */}
                                <div className="inline-flex items-center gap-1 rounded-full bg-[#F6F6F5] dark:bg-[#1F1F1D] px-1.5 py-1">
                                  <button
                                    type="button"
                                    aria-label={item.quantity === 1 ? 'حذف از سبد' : 'کاهش تعداد'}
                                    onClick={() => updateCartQty(idx, -1)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#FFFFFF] dark:hover:bg-[#2B2B28] active:scale-90 transition-all"
                                  >
                                    {item.quantity === 1 ? (
                                      <Trash2
                                        className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]"
                                        strokeWidth={1.75}
                                      />
                                    ) : (
                                      <Minus className="w-4 h-4" strokeWidth={1.75} />
                                    )}
                                  </button>
                                  <span className="min-w-[26px] text-center text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA] tabular-nums select-none">
                                    {toFaDigits(item.quantity)}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="افزایش تعداد"
                                    onClick={() => updateCartQty(idx, 1)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#FFFFFF] dark:hover:bg-[#2B2B28] active:scale-90 transition-all"
                                  >
                                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Tactile Delivery Slot Pills */}
                    <div className="rounded-[22px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        <Clock className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                        <span>انتخاب بازه زمانی تحویل</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {DELIVERY_SLOTS.map((slot) => {
                          const active = deliverySlot === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setDeliverySlot(slot)}
                              className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold text-right flex items-center justify-between gap-2 transition-all ${
                                active
                                  ? 'border-[#0D0D0D] dark:border-[#FAFAFA] bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B]'
                                  : 'border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA]'
                              }`}
                            >
                              <span>{slot}</span>
                              {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recipient Details */}
                    <div className="rounded-[22px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                          <MapPin className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                          <span>اطلاعات تحویل</span>
                        </span>
                        <span className="text-[11px] font-medium text-[#5C5C58] dark:text-[#A3A39E]">
                          {city} · {neighborhood}
                        </span>
                      </div>

                      <div>
                        <label htmlFor="ord-phone" className="block text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E] mb-1.5">
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
                          className="w-full min-h-[46px] rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-left text-sm tabular-nums focus:outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
                        />
                      </div>

                      <div>
                        <label htmlFor="ord-address" className="block text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E] mb-1.5">
                          نشانی دقیق تحویل
                        </label>
                        <textarea
                          id="ord-address"
                          rows={2}
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="خیابان، کوچه، پلاک، طبقه و واحد..."
                          className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3.5 text-sm leading-relaxed focus:outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
                        />
                      </div>
                    </div>

                    {checkoutError && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-2xl border border-[#B54B1F]/35 bg-[#B54B1F]/10 p-3.5 text-xs sm:text-sm text-[#B54B1F] dark:text-[#E29A6F] leading-relaxed"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{checkoutError}</span>
                      </div>
                    )}

                    {/* Receipt-Style Transparent Invoice */}
                    <div className="rounded-[22px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-2.5 text-xs sm:text-sm tabular-nums">
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E]">جمع غذاها ({toFaDigits(totalCount)} پرس)</span>
                        <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">{formatToman(subtotal)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E]">بسته‌بندی گرم‌نگه‌دار</span>
                        <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">{formatToman(packagingFee)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-[#5C5C58] dark:text-[#A3A39E]">هزینه ارسال</span>
                        <span
                          className={
                            deliveryFee === 0
                              ? 'text-[#B54B1F] dark:text-[#E29A6F] font-bold'
                              : 'font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]'
                          }
                        >
                          {deliveryFee === 0 ? 'رایگان' : formatToman(deliveryFee)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 pt-3 border-t border-dashed border-[#E6E6E3] dark:border-[#2C2C29] text-sm sm:text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        <span>مبلغ قابل پرداخت</span>
                        <span>{formatToman(total)}</span>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Sticky Bottom Checkout Action Bar */}
              {!confirmedOrder && cart.length > 0 && (
                <div className="shrink-0 p-4 bg-[#FFFFFF]/95 dark:bg-[#151514]/95 backdrop-blur-md border-t border-[#E6E6E3] dark:border-[#242422] flex items-center justify-between gap-3">
                  <div className="text-right tabular-nums">
                    <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">قابل پرداخت</div>
                    <div className="text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                      {formatToman(total)}
                    </div>
                  </div>
                  <button
                    type="submit"
                    form="lagheli-checkout-form"
                    disabled={submitting || cart.length === 0}
                    className="flex-1 max-w-[260px] min-h-[48px] px-5 rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FFFFFF] text-sm font-extrabold disabled:opacity-40 active:scale-[0.98] transition-all"
                  >
                    {submitting ? 'در حال ثبت سفارش...' : 'تایید و ثبت سفارش'}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
