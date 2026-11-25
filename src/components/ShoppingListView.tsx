import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Check,
  CheckCheck,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  SHOPPING_CATEGORIES,
  classifyIngredientCategory,
  formatQuantity,
  toFaDigits,
} from '../shared/persianEngine.ts';
import type {EcosystemConfig, Partner, ShoppingCategory, ShoppingItem} from '../shared/types.ts';

interface ShoppingListViewProps {
  items: ShoppingItem[];
  onAddManual: (item: {name: string; amount: number; unit: string; category?: ShoppingCategory}) => void;
  onToggleChecked: (id: string, checked: boolean) => void;
  onDeleteItem: (id: string) => void;
  onClearChecked: () => void;
  onClearAll: () => void;
  ecosystemConfig: EcosystemConfig;
  deliveryPartner?: Partner;
  onOpenPartner: (partner: Partner) => void;
  onNotify: (msg: string) => void;
}

const QUICK_UNITS = ['عدد', 'گرم', 'کیلوگرم', 'بسته', 'لیتر', 'پیمانه'];

const QUICK_STAPLES: Array<{name: string; amount: number; unit: string}> = [
  {name: 'پیاز طلایی', amount: 1, unit: 'کیلوگرم'},
  {name: 'سیر تازه', amount: 1, unit: 'بسته'},
  {name: 'زعفران دم‌کرده', amount: 1, unit: 'مثقال'},
  {name: 'کره محلی', amount: 100, unit: 'گرم'},
  {name: 'سبزی تازه', amount: 500, unit: 'گرم'},
  {name: 'روغن زیتون', amount: 1, unit: 'بطری'},
];

export function ShoppingListView({
  items,
  onAddManual,
  onToggleChecked,
  onDeleteItem,
  onClearChecked,
  onClearAll,
  ecosystemConfig,
  deliveryPartner,
  onOpenPartner,
  onNotify,
}: ShoppingListViewProps) {
  const [viewMode, setViewMode] = useState<'category' | 'recipe' | 'all'>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState('عدد');
  const [manualCategory, setManualCategory] = useState<string>('auto');
  const [showAdvancedAdd, setShowAdvancedAdd] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const detectedCategory: ShoppingCategory = name.trim()
    ? classifyIngredientCategory(name)
    : SHOPPING_CATEGORIES[SHOPPING_CATEGORIES.length - 1];

  const activeResolvedCategory: ShoppingCategory =
    manualCategory === 'auto' ? detectedCategory : (manualCategory as ShoppingCategory);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedAmount = Math.max(0.25, Number(amount) || 1);
    onAddManual({
      name: name.trim(),
      amount: parsedAmount,
      unit: unit.trim() || 'عدد',
      category: activeResolvedCategory,
    });
    setName('');
    setAmount(1);
    setManualCategory('auto');
  };

  const handleQuickAddStaple = (staple: {name: string; amount: number; unit: string}) => {
    onAddManual({
      name: staple.name,
      amount: staple.amount,
      unit: staple.unit,
      category: classifyIngredientCategory(staple.name),
    });
  };

  const remaining = items.filter((i) => !i.checked);
  const checkedCount = items.length - remaining.length;
  const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

  const filteredItems =
    selectedCategory === 'همه' ? items : items.filter((i) => i.category === selectedCategory);

  const usedCategories = Array.from(new Set(items.map((i) => i.category)));

  const handleShareList = async () => {
    if (remaining.length === 0) {
      onNotify('قلم خریداری‌نشده‌ای برای اشتراک‌گذاری وجود ندارد.');
      return;
    }
    const text =
      'سبد خرید هوشمند لاقلی:\n' +
      remaining.map((i) => `• ${i.name} (${formatQuantity(i.amount)} ${i.unit}) — ${i.category}`).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({title: 'سبد خرید لاقلی', text});
      } else {
        await navigator.clipboard.writeText(text);
        onNotify('متن سبد خرید کپی شد.');
      }
    } catch {
      // Canceled
    }
  };

  const renderRow = (item: ShoppingItem) => (
    <motion.div
      layout
      initial={{opacity: 0, y: 6}}
      animate={{opacity: 1, y: 0}}
      exit={{opacity: 0, height: 0}}
      transition={{duration: 0.2}}
      key={item.id}
      className={`group flex items-start sm:items-center justify-between gap-3 px-4 py-3.5 border-b last:border-b-0 border-[#E6E6E3]/80 dark:border-[#242422] transition-colors ${
        item.checked ? 'bg-[#F6F6F5]/65 dark:bg-[#10100F]/50' : 'hover:bg-[#F6F6F5]/55 dark:hover:bg-[#1B1B19]/60'
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleChecked(item.id, !item.checked)}
        className="flex-1 min-w-0 flex items-start gap-3 text-right py-0.5"
      >
        <span
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
            item.checked
              ? 'bg-[#0D0D0D] border-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:border-[#FAFAFA] dark:text-[#0B0B0B]'
              : 'border-[#5C5C58]/45 dark:border-[#A3A39E]/45 group-hover:border-[#B54B1F] dark:group-hover:border-[#E29A6F]'
          }`}
        >
          {item.checked && <Check className="w-3.5 h-3.5" strokeWidth={2.6} />}
        </span>

        <div className="min-w-0 flex-1 space-y-1">
          <div
            className={`text-sm sm:text-[15px] font-semibold leading-snug break-words transition-opacity ${
              item.checked
                ? 'line-through text-[#5C5C58] dark:text-[#A3A39E] opacity-60'
                : 'text-[#0D0D0D] dark:text-[#FAFAFA]'
            }`}
          >
            {item.name}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            <span>{item.category}</span>
            {item.recipeTitle && (
              <>
                <span aria-hidden="true" className="opacity-45">
                  ·
                </span>
                <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">
                  برای {item.recipeTitle}
                </span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 self-center">
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums whitespace-nowrap border ${
            item.checked
              ? 'border-transparent bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E] opacity-70'
              : 'border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA]'
          }`}
        >
          {formatQuantity(item.amount)} {item.unit}
        </span>

        <button
          type="button"
          aria-label={`حذف ${item.name}`}
          onClick={() => onDeleteItem(item.id)}
          className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#B54B1F] dark:hover:text-[#E29A6F] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );

  // Grouping logic
  const groupedByCategory = SHOPPING_CATEGORIES.map((cat) => ({
    title: cat,
    list: filteredItems.filter((i) => i.category === cat),
  })).filter((g) => g.list.length > 0);

  const groupedByRecipeMap = new Map<string, ShoppingItem[]>();
  filteredItems.forEach((item) => {
    const key = item.recipeTitle || 'اقلام اضافه‌شده دستی';
    groupedByRecipeMap.set(key, [...(groupedByRecipeMap.get(key) || []), item]);
  });
  const groupedByRecipe = Array.from(groupedByRecipeMap.entries()).map(([title, list]) => ({title, list}));

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-10">
      {/* Editorial Basket Summary Header Card */}
      <section className="rounded-[24px] sm:rounded-[28px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 sm:p-7 space-y-5 shadow-[0_14px_40px_-24px_rgba(0,0,0,0.16)]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F]">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>مدیریت هوشمند خرید آشپزخانه</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA]">
              سبد خرید هوشمند
            </h1>
            <p className="text-xs sm:text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              {items.length === 0
                ? 'اقلام هر دستور پخت به‌طور خودکار دسته‌بندی و ادغام می‌شوند.'
                : `${toFaDigits(remaining.length)} قلم باقی‌مانده از مجموع ${toFaDigits(items.length)} قلم در سبد شما`}
            </p>
          </div>

          {/* Clean Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleShareList}
              className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>اشتراک‌گذاری</span>
            </button>

            {checkedCount > 0 && (
              <button
                type="button"
                onClick={onClearChecked}
                className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#151514] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 hover:bg-[#EFEFED] dark:hover:bg-[#20201E] active:scale-[0.98] transition-all whitespace-nowrap"
              >
                <CheckCheck className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                <span>حذف خریداری‌شده‌ها ({toFaDigits(checkedCount)})</span>
              </button>
            )}

            {items.length > 0 && !confirmClearAll && (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="min-h-[42px] px-3.5 rounded-full text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:bg-[#B54B1F]/10 transition-colors whitespace-nowrap"
              >
                خالی‌کردن سبد
              </button>
            )}

            {confirmClearAll && (
              <div className="inline-flex items-center gap-2 rounded-full border border-[#B54B1F]/35 bg-[#B54B1F]/8 px-3.5 py-1 text-xs">
                <span className="font-medium text-[#0D0D0D] dark:text-[#FAFAFA]">کل سبد پاک شود؟</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearAll();
                    setConfirmClearAll(false);
                  }}
                  className="font-bold text-[#B54B1F] dark:text-[#E29A6F] min-h-[34px] px-1.5"
                >
                  بله
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="text-[#5C5C58] dark:text-[#A3A39E] min-h-[34px] px-1.5"
                >
                  انصراف
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visual Shopping Completion Progress Bar */}
        {items.length > 0 && (
          <div className="pt-1 space-y-2">
            <div className="flex items-center justify-between text-xs tabular-nums">
              <span className="font-medium text-[#5C5C58] dark:text-[#A3A39E]">
                پیشرفت خرید امروز
              </span>
              <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                {toFaDigits(checkedCount)} از {toFaDigits(items.length)} قلم ({toFaDigits(progressPercent)}٪)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-[#EFEFED] dark:bg-[#242422] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-l from-[#B54B1F] to-[#A97222] dark:from-[#E29A6F] dark:to-[#D8A85B]"
                initial={{width: 0}}
                animate={{width: `${progressPercent}%`}}
                transition={{duration: 0.4, ease: [0.16, 1, 0.3, 1]}}
              />
            </div>
          </div>
        )}
      </section>

      {/* Modern Tactile Quick-Add Composer */}
      <form
        onSubmit={handleAdd}
        className="rounded-[24px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 sm:p-5 space-y-3.5"
      >
        <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="flex-1 relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="قلم جدید بنویس (مثلاً زعفران، ریحان تازه، کره)..."
              aria-label="نام قلم جدید"
              className="w-full min-h-[48px] rounded-2xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-4 text-sm text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#5C5C58]/80 dark:placeholder:text-[#A3A39E]/75 focus:outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={!name.trim()}
            className="min-h-[48px] px-6 rounded-2xl bg-[#0D0D0D] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all shrink-0 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن به سبد</span>
          </button>
        </div>

        {/* Compact Quantity Stepper + Unit Chips + Smart Category Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tactile Amount Stepper */}
            <div className="inline-flex items-center rounded-full border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] p-0.5">
              <button
                type="button"
                aria-label="کاهش مقدار"
                onClick={() => setAmount((prev) => Math.max(0.5, Number((prev - (prev > 1 ? 1 : 0.5)).toFixed(2))))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#FFFFFF] dark:hover:bg-[#151514] transition-colors"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-[36px] text-center text-xs font-bold tabular-nums text-[#0D0D0D] dark:text-[#FAFAFA]">
                {formatQuantity(amount)}
              </span>
              <button
                type="button"
                aria-label="افزایش مقدار"
                onClick={() => setAmount((prev) => Number((prev + (prev >= 1 ? 1 : 0.5)).toFixed(2)))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#FFFFFF] dark:hover:bg-[#151514] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Unit Pills */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {QUICK_UNITS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`min-h-[34px] px-3 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    unit === u
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'bg-[#F6F6F5] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedAdd((v) => !v)}
            className="min-h-[34px] px-3 rounded-full border border-[#E6E6E3] dark:border-[#2C2C29] text-[11px] font-medium text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] inline-flex items-center gap-1.5 transition-colors"
          >
            <Tag className="w-3 h-3 text-[#B54B1F] dark:text-[#E29A6F]" />
            <span>
              دسته: {manualCategory === 'auto' ? `${detectedCategory} (خودکار)` : manualCategory}
            </span>
          </button>
        </div>

        {/* Optional Category Picker Strip */}
        <AnimatePresence>
          {showAdvancedAdd && (
            <motion.div
              initial={{opacity: 0, height: 0}}
              animate={{opacity: 1, height: 'auto'}}
              exit={{opacity: 0, height: 0}}
              className="overflow-hidden"
            >
              <div className="pt-2.5 border-t border-[#E6E6E3]/80 dark:border-[#242422] flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setManualCategory('auto')}
                  className={`min-h-[32px] px-3 rounded-full text-[11px] font-semibold transition-colors ${
                    manualCategory === 'auto'
                      ? 'bg-[#B54B1F] text-white dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                      : 'bg-[#F6F6F5] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  تشخیص خودکار
                </button>
                {SHOPPING_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setManualCategory(c)}
                    className={`min-h-[32px] px-3 rounded-full text-[11px] font-medium transition-colors ${
                      manualCategory === c
                        ? 'bg-[#0D0D0D] text-white dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                        : 'bg-[#F6F6F5] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {/* View Mode Switcher & Category Filter */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-full bg-[#EFEFED] dark:bg-[#20201E] border border-[#E6E6E3]/80 dark:border-[#2C2C29]">
              {[
                {id: 'category', label: 'دسته‌بندی'},
                {id: 'recipe', label: 'دستور پخت'},
                {id: 'all', label: 'همه اقلام'},
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id as 'category' | 'recipe' | 'all')}
                  className={`min-h-[38px] px-4 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                    viewMode === m.id
                      ? 'bg-[#FFFFFF] dark:bg-[#151514] text-[#0D0D0D] dark:text-[#FAFAFA] shadow-xs'
                      : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {usedCategories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('همه')}
                className={`min-h-[36px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === 'همه'
                    ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                    : 'bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                همه ({toFaDigits(items.length)})
              </button>
              {usedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[36px] px-3.5 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    selectedCategory === cat
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items List or Editorial Empty State with Quick Staples */}
      {items.length === 0 ? (
        <div className="rounded-[26px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-7 sm:p-10 text-center space-y-5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] border border-[#E6E6E3] dark:border-[#2C2C29] flex items-center justify-center text-[#B54B1F] dark:text-[#E29A6F]">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-base sm:text-lg font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
              سبد خرید شما هنوز خالی است
            </h2>
            <p className="text-xs sm:text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              از داخل هر دستور پخت با یک کلیک مواد لازم را اضافه کنید، یا اقلام پرمصرف زیر را سریع به سبد بیندازید:
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {QUICK_STAPLES.map((staple) => (
              <button
                key={staple.name}
                type="button"
                onClick={() => handleQuickAddStaple(staple)}
                className="min-h-[38px] px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 active:scale-[0.97] transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                <span>{staple.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : viewMode === 'all' ? (
        <div className="rounded-[24px] overflow-hidden border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514]">
          <AnimatePresence initial={false}>{filteredItems.map(renderRow)}</AnimatePresence>
        </div>
      ) : (
        <div className="space-y-5">
          {(viewMode === 'category' ? groupedByCategory : groupedByRecipe).map((group) => {
            const doneInGroup = group.list.filter((i) => i.checked).length;
            return (
              <section key={group.title} className="space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <h2 className="text-sm font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] leading-snug">
                    {group.title}
                  </h2>
                  <span className="text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] tabular-nums whitespace-nowrap">
                    {doneInGroup > 0
                      ? `${toFaDigits(doneInGroup)} از ${toFaDigits(group.list.length)} انجام‌شده`
                      : `${toFaDigits(group.list.length)} قلم`}
                  </span>
                </div>
                <div className="rounded-[22px] overflow-hidden border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514]">
                  <AnimatePresence initial={false}>{group.list.map(renderRow)}</AnimatePresence>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Admin-Controlled Delivery Partner Card */}
      {ecosystemConfig.shoppingDeliveryCardEnabled && deliveryPartner && (
        <div className="rounded-[24px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#5C5C58] dark:text-[#A3A39E]">
                <Sparkles className="w-3 h-3 text-[#A97222]" />
                <span>تامین و ارسال فوری سبد خرید</span>
              </div>
              <div className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{deliveryPartner.name}</div>
              {deliveryPartner.promoLabel && (
                <div className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F]">
                  {deliveryPartner.promoLabel}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenPartner(deliveryPartner)}
            className="min-h-[44px] px-5 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold shrink-0 active:scale-[0.98] transition-transform"
          >
            مشاهده سرویس ارسال
          </button>
        </div>
      )}
    </div>
  );
}
