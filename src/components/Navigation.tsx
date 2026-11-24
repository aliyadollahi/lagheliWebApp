import {BookOpen, ChefHat, ShoppingBag, Store, User, Utensils} from 'lucide-react';
import type {EcosystemConfig, UserProfile} from '../shared/types.ts';
import {toFaDigits} from '../shared/persianEngine.ts';

export type AppTab = 'explore' | 'kitchen' | 'order' | 'shopping' | 'marketplace' | 'profile';

interface NavigationProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  user: UserProfile | null;
  shoppingRemainingCount: number;
  cartCount: number;
  ecosystemConfig: EcosystemConfig;
  onOpenAuth: () => void;
  onOpenSubmitRecipe: () => void;
}

export function TopHeader({
  activeTab,
  onSelectTab,
  user,
  shoppingRemainingCount,
  cartCount,
  ecosystemConfig,
  onOpenAuth,
  onOpenSubmitRecipe,
}: NavigationProps) {
  const navItems: {id: AppTab; label: string; count?: number}[] = [
    {id: 'explore', label: 'کاوش'},
    {id: 'kitchen', label: 'آشپزخانه'},
    {id: 'order', label: 'سفارش روز', count: cartCount > 0 ? cartCount : undefined},
    {id: 'shopping', label: 'لیست خرید', count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined},
    ...(ecosystemConfig.marketplaceTabEnabled
      ? [{id: 'marketplace' as AppTab, label: ecosystemConfig.marketplaceTitle || 'اصناف'}]
      : []),
    {id: 'profile', label: user ? user.name.split(' ')[0] : 'پروفایل'},
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4]/95 dark:bg-[#141412]/95 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className="text-xl font-bold text-[#1C1B18] dark:text-[#F4F1EA] whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
        >
          لاقلی
        </button>

        {/* Zone 2: Clean single-line typography nav links (Desktop) */}
        <nav aria-label="ناوبری اصلی" className="hidden md:flex items-center gap-6">
          {navItems.slice(0, 5).map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center gap-1.5 ${
                  active
                    ? 'font-semibold text-[#3F523B] dark:text-[#8EA888]'
                    : 'text-[#615E55] dark:text-[#A9A497] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA]'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums opacity-80">({toFaDigits(item.count)})</span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 inset-x-0 h-[2px] bg-[#3F523B] dark:bg-[#8EA888]"
                  />
                )}
              </button>
            );
          })}
          {ecosystemConfig.marketplaceTabEnabled && (
            <button
              type="button"
              onClick={() => onSelectTab('profile')}
              className={`relative py-2 text-sm whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
                activeTab === 'profile'
                  ? 'font-semibold text-[#3F523B] dark:text-[#8EA888]'
                  : 'text-[#615E55] dark:text-[#A9A497] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA]'
              }`}
            >
              {user ? user.name.split(' ')[0] : 'پروفایل'}
              {activeTab === 'profile' && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0 inset-x-0 h-[2px] bg-[#3F523B] dark:bg-[#8EA888]"
                />
              )}
            </button>
          )}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onOpenSubmitRecipe}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:hover:bg-[#A2BC9C] text-[#F9F8F4] dark:text-[#141412] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              ثبت دستور
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:hover:bg-[#A2BC9C] text-[#F9F8F4] dark:text-[#141412] text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              ورود با موبایل
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  shoppingRemainingCount,
  cartCount,
  ecosystemConfig,
}: Pick<NavigationProps, 'activeTab' | 'onSelectTab' | 'shoppingRemainingCount' | 'cartCount' | 'ecosystemConfig'>) {
  const items: {id: AppTab; label: string; icon: typeof BookOpen; count?: number}[] = [
    {id: 'explore', label: 'کاوش', icon: BookOpen},
    {id: 'kitchen', label: 'آشپزخانه', icon: ChefHat},
    {id: 'order', label: 'سفارش', icon: Utensils, count: cartCount > 0 ? cartCount : undefined},
    {id: 'shopping', label: 'خرید', icon: ShoppingBag, count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined},
    ...(ecosystemConfig.marketplaceTabEnabled
      ? [{id: 'marketplace' as AppTab, label: 'اصناف', icon: Store}]
      : []),
    {id: 'profile', label: 'پروفایل', icon: User},
  ];

  const displayItems = items.slice(0, 5);

  return (
    <nav
      aria-label="ناوبری موبایل"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4]/95 dark:bg-[#141412]/95 backdrop-blur-md pb-safe"
    >
      <div className="grid grid-cols-5 h-16">
        {displayItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors ${
                active
                  ? 'text-[#3F523B] dark:text-[#8EA888] font-semibold'
                  : 'text-[#615E55] dark:text-[#A9A497]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={active ? 2.1 : 1.7} />
                {item.count !== undefined && (
                  <span className="absolute -top-1.5 -left-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#3F523B] dark:bg-[#8EA888] text-[#F9F8F4] dark:text-[#141412] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {toFaDigits(item.count)}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
