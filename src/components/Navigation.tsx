import {BookOpen, ChefHat, Shield, ShoppingBag, Store, User, Utensils} from 'lucide-react';
import type {EcosystemConfig, UserProfile} from '../shared/types.ts';
import {toFaDigits} from '../shared/persianEngine.ts';

export type AppTab = 'explore' | 'kitchen' | 'order' | 'shopping' | 'marketplace' | 'profile' | 'admin';

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
  // Calm Navigation: max 5 clean primary destinations
  const navItems: {id: AppTab; label: string; count?: number}[] = [
    {id: 'explore', label: 'کاوش'},
    {id: 'kitchen', label: 'آشپزخانه'},
    {id: 'order', label: 'سفارش روز', count: cartCount > 0 ? cartCount : undefined},
    {id: 'shopping', label: 'لیست خرید', count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined},
    ...(ecosystemConfig.marketplaceTabEnabled
      ? [{id: 'marketplace' as AppTab, label: ecosystemConfig.marketplaceTitle || 'اصناف'}]
      : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#EAE7DF] dark:border-[#2A2925] bg-[#FAF9F6]/92 dark:bg-[#141412]/92 backdrop-blur-xl">
      <div
        className={`${
          activeTab === 'admin' ? 'max-w-[1440px]' : 'max-w-6xl'
        } mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6 transition-all`}
      >
        {/* Zone 1: Editorial Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#111110] dark:text-[#F4F1EA] whitespace-nowrap shrink-0 min-h-[44px] flex items-center gap-2"
        >
          <span>لاقلی</span>
        </button>

        {/* Zone 2: Calm Single-line Typography Nav (Desktop) */}
        <nav aria-label="ناوبری اصلی" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-2 text-sm whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center gap-1.5 ${
                  active
                    ? 'font-bold text-[#111110] dark:text-[#F4F1EA]'
                    : 'text-[#615E55] dark:text-[#A9A497] hover:text-[#111110] dark:hover:text-[#F4F1EA]'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums opacity-75">({toFaDigits(item.count)})</span>
                )}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#111110] dark:bg-[#F4F1EA]"
                  />
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className={`relative py-2 text-sm whitespace-nowrap shrink-0 transition-colors min-h-[44px] flex items-center ${
              activeTab === 'profile'
                ? 'font-bold text-[#111110] dark:text-[#F4F1EA]'
                : 'text-[#615E55] dark:text-[#A9A497] hover:text-[#111110] dark:hover:text-[#F4F1EA]'
            }`}
          >
            {user ? user.name.split(' ')[0] : 'پروفایل'}
            {activeTab === 'profile' && (
              <span
                aria-hidden="true"
                className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#111110] dark:bg-[#F4F1EA]"
              />
            )}
          </button>
        </nav>

        {/* Zone 3: Desktop Admin Shortcut + Sculptural Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab(activeTab === 'admin' ? 'explore' : 'admin')}
            aria-label="پنل مدیریت"
            className={`min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'admin'
                ? 'border-[#111110] bg-[#111110] text-white dark:border-[#F4F1EA] dark:bg-[#F4F1EA] dark:text-[#111110]'
                : 'border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55] dark:text-[#A9A497] hover:text-[#111110] dark:hover:text-[#F4F1EA] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]'
            }`}
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">پنل مدیریت</span>
            <span className="sm:hidden">مدیریت</span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={onOpenSubmitRecipe}
              className="min-h-[40px] sm:min-h-[42px] px-3.5 sm:px-5 rounded-full bg-[#111110] hover:bg-[#2A2925] dark:bg-[#F4F1EA] dark:hover:bg-[#E5E1D6] text-[#FAF9F6] dark:text-[#111110] text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              ثبت دستور
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 rounded-full bg-[#111110] hover:bg-[#2A2925] dark:bg-[#F4F1EA] dark:hover:bg-[#E5E1D6] text-[#FAF9F6] dark:text-[#111110] text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0"
            >
              ورود
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

  // Calm Navigation: strictly max 5 tabs in mobile bottom bar (Profile always reachable)
  const displayItems =
    items.length > 5
      ? [items[0], items[1], items[2], items[3], items[items.length - 1]]
      : items;

  return (
    <nav
      aria-label="ناوبری موبایل"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#EAE7DF] dark:border-[#2A2925] bg-[#FAF9F6]/95 dark:bg-[#141412]/95 backdrop-blur-xl pb-safe"
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
                  ? 'text-[#111110] dark:text-[#F4F1EA] font-bold'
                  : 'text-[#615E55] dark:text-[#A9A497]'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" strokeWidth={active ? 2.2 : 1.7} />
                {item.count !== undefined && (
                  <span className="absolute -top-1.5 -left-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B54B1F] dark:bg-[#E29A6F] text-[#FAF9F6] dark:text-[#111110] text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {toFaDigits(item.count)}
                  </span>
                )}
              </div>
              <span className="text-[11px] leading-none whitespace-nowrap">{item.label}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 w-6 h-[2.5px] rounded-b-full bg-[#B54B1F] dark:bg-[#E29A6F]"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
