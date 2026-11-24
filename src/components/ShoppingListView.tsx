import {useState} from 'react';
import {Check, Plus, Share2, Trash2, Truck} from 'lucide-react';
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
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState('عدد');
  const [manualCategory, setManualCategory] = useState<string>('auto');
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const parsedAmount = Math.max(0.25, Number(amount) || 1);
    const resolvedCategory: ShoppingCategory =
      manualCategory === 'auto'
        ? classifyIngredientCategory(name)
        : (manualCategory as ShoppingCategory);
    onAddManual({name: name.trim(), amount: parsedAmount, unit: unit.trim() || 'عدد', category: resolvedCategory});
    setName('');
    setAmount('1');
    setManualCategory('auto');
  };

  const remaining = items.filter((i) => !i.checked);
  const checkedCount = items.length - remaining.length;

  const filteredItems =
    selectedCategory === 'همه' ? items : items.filter((i) => i.category === selectedCategory);

  const usedCategories = Array.from(new Set(items.map((i) => i.category)));

  const handleShareList = async () => {
    if (remaining.length === 0) {
      onNotify('قلم خریداری‌نشده‌ای برای اشتراک‌گذاری وجود ندارد.');
      return;
    }
    const text =
      'لیست خرید لاقلی:\n' +
      remaining.map((i) => `• ${i.name} (${formatQuantity(i.amount)} ${i.unit}) — ${i.category}`).join('\n');
    try {
      if (navigator.share) {
        await navigator.share({title: 'لیست خرید لاقلی', text});
      } else {
        await navigator.clipboard.writeText(text);
        onNotify('متن لیست خرید کپی شد.');
      }
    } catch {
      // Canceled
    }
  };

  const renderRow = (item: ShoppingItem) => (
    <div
      key={item.id}
      className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-[#E5E1D6]/70 dark:border-[#2F2D27]"
    >
      <button
        type="button"
        onClick={() => onToggleChecked(item.id, !item.checked)}
        className="flex-1 flex items-center gap-3 text-right min-h-[44px]"
      >
        <span
          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
            item.checked
              ? 'bg-[#B54B1F] border-[#B54B1F] text-white dark:bg-[#E29A6F] dark:border-[#E29A6F] dark:text-[#141412]'
              : 'border-[#615E55]/40'
          }`}
        >
          {item.checked && <Check className="w-3.5 h-3.5" />}
        </span>
        <div className="min-w-0">
          <div className={`text-sm font-medium ${item.checked ? 'line-through opacity-50' : ''}`}>
            {item.name}
          </div>
          <div className="text-xs text-[#615E55] dark:text-[#A9A497] truncate">
            {item.category}
            {item.recipeTitle ? ` · از ${item.recipeTitle}` : ''}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
          {formatQuantity(item.amount)} {item.unit}
        </span>
        <button
          type="button"
          aria-label={`حذف ${item.name}`}
          onClick={() => onDeleteItem(item.id)}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-[#615E55] hover:text-red-600 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // Grouping logic
  const groupedByCategory = SHOPPING_CATEGORIES.map((cat) => ({
    title: cat,
    list: filteredItems.filter((i) => i.category === cat),
  })).filter((g) => g.list.length > 0);

  const groupedByRecipeMap = new Map<string, ShoppingItem[]>();
  filteredItems.forEach((item) => {
    const key = item.recipeTitle || 'اقلام دستی';
    groupedByRecipeMap.set(key, [...(groupedByRecipeMap.get(key) || []), item]);
  });
  const groupedByRecipe = Array.from(groupedByRecipeMap.entries()).map(([title, list]) => ({title, list}));

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E1D6] dark:border-[#2F2D27] pb-6">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold">لیست خرید هوشمند</h1>
          <p className="text-sm text-[#615E55] dark:text-[#A9A497] tabular-nums">
            {toFaDigits(remaining.length)} قلم باقی‌مانده · دسته‌بندی خودکار ۱۱گانه و ادغام اقلام تکراری
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShareList}
            className="min-h-[44px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>اشتراک‌گذاری</span>
          </button>
          {checkedCount > 0 && (
            <button
              type="button"
              onClick={onClearChecked}
              className="min-h-[44px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
            >
              پاک‌کردن تیک‌خورده‌ها ({toFaDigits(checkedCount)})
            </button>
          )}
          {items.length > 0 && !confirmClearAll && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="min-h-[44px] px-3 rounded-xl text-xs text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              پاک‌کردن کل لیست
            </button>
          )}
          {confirmClearAll && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-red-300 dark:border-red-900 px-3 py-1 text-xs">
              <span>مطمئنید؟</span>
              <button
                type="button"
                onClick={() => {
                  onClearAll();
                  setConfirmClearAll(false);
                }}
                className="font-bold text-red-700 dark:text-red-400 min-h-[36px] px-2"
              >
                بله، پاک شود
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="min-h-[36px] px-2"
              >
                انصراف
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Manual Item Form */}
      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-3"
      >
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="افزودن قلم جدید (مثلاً ریحان تازه، کره، زعفران)..."
          aria-label="نام قلم جدید"
          className="sm:col-span-5 min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3.5 text-sm"
        />
        <input
          type="number"
          step="0.5"
          min="0.25"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="مقدار"
          className="sm:col-span-2 min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm tabular-nums"
        />
        <input
          type="text"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="واحد"
          aria-label="واحد اندازه‌گیری"
          className="sm:col-span-2 min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
        />
        <select
          aria-label="دسته‌بندی قلم"
          value={manualCategory}
          onChange={(e) => setManualCategory(e.target.value)}
          className="sm:col-span-2 min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2.5 text-xs"
        >
          <option value="auto">تشخیص خودکار</option>
          {SHOPPING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label="افزودن به لیست"
          className="sm:col-span-1 min-h-[46px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#141412] text-[#F9F8F4] flex items-center justify-center"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>

      {/* View Mode Switcher & Category Filter */}
      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex p-1 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F]">
              {[
                {id: 'category', label: 'بر اساس دسته‌بندی'},
                {id: 'recipe', label: 'بر اساس دستور پخت'},
                {id: 'all', label: 'همه اقلام'},
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id as 'category' | 'recipe' | 'all')}
                  className={`min-h-[40px] px-3.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    viewMode === m.id
                      ? 'bg-[#FFFFFF] dark:bg-[#1C1B18] text-[#1C1B18] dark:text-[#F4F1EA]'
                      : 'text-[#615E55] dark:text-[#A9A497]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {usedCategories.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedCategory('همه')}
                className={`min-h-[38px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 ${
                  selectedCategory === 'همه'
                    ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                    : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                }`}
              >
                همه ({toFaDigits(items.length)})
              </button>
              {usedCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`min-h-[38px] px-3.5 rounded-lg text-xs whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                      : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Items List */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-12 text-center space-y-2">
          <p className="text-base font-semibold">لیست خرید شما خالی است</p>
          <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
            از داخل هر دستور پخت با یک کلیک کمبودها را اضافه کنید یا بالا به صورت دستی بنویسید.
          </p>
        </div>
      ) : viewMode === 'all' ? (
        <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18]">
          {filteredItems.map(renderRow)}
        </div>
      ) : (
        <div className="space-y-6">
          {(viewMode === 'category' ? groupedByCategory : groupedByRecipe).map((group) => (
            <section key={group.title} className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[#615E55] dark:text-[#A9A497] px-1">
                <h2 className="font-semibold text-[#1C1B18] dark:text-[#F4F1EA]">{group.title}</h2>
                <span className="tabular-nums">{toFaDigits(group.list.length)} قلم</span>
              </div>
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18]">
                {group.list.map(renderRow)}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Admin-Controlled Delivery Partner Suggestion */}
      {ecosystemConfig.shoppingDeliveryCardEnabled && deliveryPartner && (
        <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-xs text-[#615E55] dark:text-[#A9A497]">تامین و ارسال فوری لیست خرید</div>
              <div className="text-sm font-bold">{deliveryPartner.name}</div>
              {deliveryPartner.promoLabel && (
                <div className="text-xs text-[#B54B1F] dark:text-[#E29A6F]">{deliveryPartner.promoLabel}</div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenPartner(deliveryPartner)}
            className="min-h-[44px] px-4 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] text-xs font-medium shrink-0"
          >
            مشاهده سرویس ارسال
          </button>
        </div>
      )}
    </div>
  );
}
