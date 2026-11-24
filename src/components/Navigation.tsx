import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  BookOpen,
  ChefHat,
  Moon,
  Plus,
  Shield,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  User,
  Utensils,
} from 'lucide-react';
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

interface MobileBottomNavProps
  extends Pick<
    NavigationProps,
    'activeTab' | 'onSelectTab' | 'shoppingRemainingCount' | 'cartCount' | 'ecosystemConfig' | 'onOpenSubmitRecipe'
  > {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
    <header className="sticky top-0 z-30 border-b border-[#E6E6E3] dark:border-[#242422] bg-[#FFFFFF]/90 dark:bg-[#0B0B0B]/90 backdrop-blur-xl">
      <div
        className={`${
          activeTab === 'admin' ? 'max-w-[1440px]' : 'max-w-6xl'
        } mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6 transition-all`}
      >
        {/* Zone 1: Editorial Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA] whitespace-nowrap shrink-0 min-h-[44px] flex items-center gap-2"
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
                    ? 'font-bold text-[#0D0D0D] dark:text-[#FAFAFA]'
                    : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="text-xs tabular-nums opacity-75">({toFaDigits(item.count)})</span>
                )}
                {active && (
                  <motion.span
                    layoutId="desktop-nav-underline"
                    transition={{type: 'spring', stiffness: 460, damping: 34}}
                    aria-hidden="true"
                    className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA]"
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
                ? 'font-bold text-[#0D0D0D] dark:text-[#FAFAFA]'
                : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
            }`}
          >
            {user ? user.name.split(' ')[0] : 'پروفایل'}
            {activeTab === 'profile' && (
              <motion.span
                layoutId="desktop-nav-underline"
                transition={{type: 'spring', stiffness: 460, damping: 34}}
                aria-hidden="true"
                className="absolute bottom-0 inset-x-0 h-[2px] rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA]"
              />
            )}
          </button>
        </nav>

        {/* Zone 3: Desktop Admin Shortcut + Sculptural Black & White Primary Action */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onSelectTab(activeTab === 'admin' ? 'explore' : 'admin')}
            aria-label="پنل مدیریت"
            className={`min-h-[40px] sm:min-h-[42px] px-2.5 sm:px-3.5 rounded-full border text-xs font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.97] whitespace-nowrap ${
              activeTab === 'admin'
                ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                : 'border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]'
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
              className="min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.97] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0"
            >
              ثبت دستور
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] sm:min-h-[42px] px-4 sm:px-5 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.97] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0"
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
  onOpenSubmitRecipe,
  theme,
  onToggleTheme,
}: MobileBottomNavProps) {
  const [quickOpen, setQuickOpen] = useState(false);

  const items: {id: AppTab; label: string; icon: typeof BookOpen; count?: number}[] = [
    {id: 'explore', label: 'کاوش', icon: BookOpen},
    {id: 'kitchen', label: 'یخچال', icon: ChefHat},
    {id: 'order', label: 'سفارش', icon: Utensils, count: cartCount > 0 ? cartCount : undefined},
    {id: 'shopping', label: 'خرید', icon: ShoppingBag, count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined},
    {id: 'profile', label: 'پروفایل', icon: User},
  ];

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    } catch {
      // Ignore unsupported browsers
    }
  };

  const handleSelect = (tab: AppTab) => {
    triggerHaptic();
    setQuickOpen(false);
    onSelectTab(tab);
  };

  const toggleQuickMenu = () => {
    triggerHaptic();
    setQuickOpen((v) => !v);
  };

  return (
    <>
      {/* Interactive Quick-Action Backdrop & Monochrome Sheet */}
      <AnimatePresence>
        {quickOpen && (
          <>
            <motion.div
              key="dock-backdrop"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.18}}
              onClick={() => setQuickOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-black/35 dark:bg-black/60 backdrop-blur-[3px]"
            />

            <motion.div
              key="dock-quick-sheet"
              initial={{opacity: 0, y: 18, scale: 0.94}}
              animate={{opacity: 1, y: 0, scale: 1}}
              exit={{opacity: 0, y: 14, scale: 0.94}}
              transition={{type: 'spring', stiffness: 460, damping: 30}}
              className="md:hidden fixed bottom-[84px] left-3 z-40 w-[232px] rounded-3xl bg-[#FFFFFF]/95 dark:bg-[#151514]/95 backdrop-blur-xl border border-[#E6E6E3] dark:border-[#2C2C29] shadow-[0_20px_50px_-14px_rgba(0,0,0,0.35)] p-2 space-y-1 pb-safe"
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  setQuickOpen(false);
                  onOpenSubmitRecipe();
                }}
                className="w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#F2F2F0] dark:hover:bg-[#232320] active:scale-[0.98] transition-all"
              >
                <span className="w-8 h-8 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] flex items-center justify-center shrink-0">
                  <Plus className="w-4 h-4" />
                </span>
                <span>ثبت دستور پخت</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect('kitchen')}
                className="w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#F2F2F0] dark:hover:bg-[#232320] active:scale-[0.98] transition-all"
              >
                <span className="w-8 h-8 rounded-full bg-[#EFEFED] dark:bg-[#232320] text-[#0D0D0D] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                </span>
                <span>با یخچال چی بپزم؟</span>
              </button>

              {ecosystemConfig.marketplaceTabEnabled && (
                <button
                  type="button"
                  onClick={() => handleSelect('marketplace')}
                  className="w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#F2F2F0] dark:hover:bg-[#232320] active:scale-[0.98] transition-all"
                >
                  <span className="w-8 h-8 rounded-full bg-[#EFEFED] dark:bg-[#232320] text-[#0D0D0D] dark:text-[#FAFAFA] flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </span>
                  <span>{ecosystemConfig.marketplaceTitle || 'بازارچه و اصناف'}</span>
                </button>
              )}

              <div className="h-px bg-[#E6E6E3] dark:bg-[#282825] mx-2 my-1" />

              <button
                type="button"
                onClick={() => {
                  triggerHaptic();
                  onToggleTheme();
                  setQuickOpen(false);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#F2F2F0] dark:hover:bg-[#232320] active:scale-[0.98] transition-all"
              >
                <span className="w-8 h-8 rounded-full bg-[#EFEFED] dark:bg-[#232320] flex items-center justify-center shrink-0">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </span>
                <span>{theme === 'dark' ? 'حالت روشن (سفید)' : 'حالت تاریک (مشکی)'}</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Sculptural High-Contrast Floating Black & White Interactive Dock */}
      <nav
        aria-label="ناوبری موبایل"
        className="md:hidden fixed bottom-3 inset-x-3 z-40 pb-safe pointer-events-none"
      >
        <div className="max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
          {/* Primary Floating Pill Bar */}
          <div className="flex-1 h-[60px] rounded-full bg-[#0D0D0D]/95 dark:bg-[#F5F5F4]/95 backdrop-blur-xl border border-white/10 dark:border-black/10 shadow-[0_14px_34px_-10px_rgba(0,0,0,0.45)] px-1.5 flex items-center justify-between gap-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{scale: 0.9}}
                  onClick={() => handleSelect(item.id)}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`relative h-[48px] rounded-full flex items-center justify-center gap-1.5 transition-colors ${
                    active
                      ? 'px-3.5 text-[#0D0D0D] dark:text-[#FAFAFA] font-bold flex-none'
                      : 'flex-1 min-w-[44px] text-[#A3A39E] dark:text-[#5C5C58] hover:text-white dark:hover:text-[#0D0D0D]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="lagheli-mobile-dock-pill"
                      transition={{type: 'spring', stiffness: 430, damping: 32}}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-[#FFFFFF] dark:bg-[#0D0D0D] shadow-sm"
                    />
                  )}

                  <motion.span
                    animate={active ? {scale: 1.06} : {scale: 1}}
                    transition={{type: 'spring', stiffness: 500, damping: 28}}
                    className="relative z-10 flex items-center justify-center"
                  >
                    <Icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.25 : 1.8} />
                    {item.count !== undefined && (
                      <motion.span
                        key={item.count}
                        initial={{scale: 0.7}}
                        animate={{scale: 1}}
                        className={`absolute -top-2 -left-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums ${
                          active
                            ? 'bg-[#0D0D0D] text-white dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                            : 'bg-[#B54B1F] text-white dark:bg-[#B54B1F] dark:text-white'
                        }`}
                      >
                        {toFaDigits(item.count)}
                      </motion.span>
                    )}
                  </motion.span>

                  <AnimatePresence initial={false} mode="popLayout">
                    {active && (
                      <motion.span
                        key={`${item.id}-label`}
                        initial={{opacity: 0, width: 0}}
                        animate={{opacity: 1, width: 'auto'}}
                        exit={{opacity: 0, width: 0}}
                        transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
                        className="relative z-10 text-xs leading-none whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Detached Tactile Monochrome Quick-Action Button */}
          <motion.button
            type="button"
            whileTap={{scale: 0.9}}
            onClick={toggleQuickMenu}
            aria-label={quickOpen ? 'بستن منوی دسترسی سریع' : 'باز کردن منوی دسترسی سریع'}
            aria-expanded={quickOpen}
            className={`w-[56px] h-[56px] rounded-full shrink-0 flex items-center justify-center border shadow-[0_14px_30px_-10px_rgba(0,0,0,0.4)] transition-colors ${
              quickOpen
                ? 'bg-[#FFFFFF] text-[#0D0D0D] border-[#0D0D0D]/15 dark:bg-[#0D0D0D] dark:text-[#FAFAFA] dark:border-white/20'
                : 'bg-[#0D0D0D] text-[#FFFFFF] border-white/10 dark:bg-[#FAFAFA] dark:text-[#0B0B0B] dark:border-black/10'
            }`}
          >
            <motion.span
              animate={{rotate: quickOpen ? 45 : 0}}
              transition={{type: 'spring', stiffness: 450, damping: 26}}
              className="flex items-center justify-center"
            >
              <Plus className="w-5 h-5" strokeWidth={2.4} />
            </motion.span>
          </motion.button>
        </div>
      </nav>
    </>
  );
}
