import {useState} from 'react';
import {AnimatePresence, LayoutGroup, motion, useReducedMotion} from 'motion/react';
import {
  BookOpen,
  ChefHat,
  Moon,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Sun,
  User,
} from 'lucide-react';
import type {EcosystemConfig, UserProfile} from '../shared/types.ts';
import {toFaDigits} from '../shared/persianEngine.ts';

export type AppTab = 'explore' | 'kitchen' | 'shopping' | 'marketplace' | 'profile';

interface NavigationProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  user: UserProfile | null;
  shoppingRemainingCount: number;
  ecosystemConfig: EcosystemConfig;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onQuickSearch: () => void;
  onOpenAuth: () => void;
  onOpenSubmitRecipe: () => void;
}

interface MobileBottomNavProps
  extends Pick<
    NavigationProps,
    'activeTab' | 'onSelectTab' | 'shoppingRemainingCount' | 'ecosystemConfig' | 'onOpenSubmitRecipe'
  > {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function TopHeader({
  activeTab,
  onSelectTab,
  user,
  shoppingRemainingCount,
  ecosystemConfig,
  theme,
  onToggleTheme,
  onQuickSearch,
  onOpenAuth,
  onOpenSubmitRecipe,
}: NavigationProps) {
  const sections = ecosystemConfig.appSections;

  // Strict 3-zone recipe-first navigation (zero food-order clutter, zero admin links for regular users)
  const navItems: {id: AppTab; label: string; count?: number}[] = [
    {id: 'explore', label: 'دستورپخت‌ها'},
    ...(sections?.kitchenTabEnabled !== false ? [{id: 'kitchen' as AppTab, label: 'آشپزخانه'}] : []),
    ...(sections?.shoppingTabEnabled !== false
      ? [
          {
            id: 'shopping' as AppTab,
            label: 'لیست خرید',
            count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined,
          },
        ]
      : []),
    ...(ecosystemConfig.marketplaceTabEnabled
      ? [{id: 'marketplace' as AppTab, label: ecosystemConfig.marketplaceTitle || 'برندهای همکار'}]
      : []),
    {id: 'profile', label: user ? user.name.split(' ')[0] : 'پروفایل'},
  ];

  const canSubmitRecipe = sections?.submitRecipeEnabled !== false;

  return (
    <header className="sticky top-0 z-30 border-b border-[#E6E6E3]/80 dark:border-[#242422] bg-[#FFFFFF]/92 dark:bg-[#0B0B0B]/92 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-3.5 sm:px-6 h-[54px] md:h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-element Editorial Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('explore')}
          className="text-xl md:text-2xl font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA] whitespace-nowrap shrink-0 min-h-[44px] flex items-center"
        >
          لاقلی
        </button>

        {/* Zone 2: Clean Single-line Typography Nav (Desktop) */}
        <nav aria-label="ناوبری اصلی" className="hidden md:flex items-center gap-7">
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
        </nav>

        {/* Zone 3 (Mobile): Quick Search + Theme + Login */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {sections?.searchBarEnabled !== false && (
            <button
              type="button"
              onClick={onQuickSearch}
              aria-label="جست‌وجوی دستور پخت"
              className="min-h-[40px] min-w-[40px] rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#151514] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] active:scale-95 transition-transform"
            >
              <Search className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک'}
            className="min-h-[40px] min-w-[40px] rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#151514] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] active:scale-95 transition-transform"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!user && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] px-4 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold active:scale-95 transition-transform whitespace-nowrap shrink-0"
            >
              ورود
            </button>
          )}
        </div>

        {/* Zone 3 (Desktop): Single Primary Action */}
        <div className="hidden md:flex items-center shrink-0">
          {user ? (
            canSubmitRecipe ? (
              <button
                type="button"
                onClick={onOpenSubmitRecipe}
                className="min-h-[42px] px-5 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.97] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-semibold transition-all whitespace-nowrap shrink-0"
              >
                ثبت دستور
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleTheme}
                className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[42px] px-5 rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.97] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-semibold transition-all whitespace-nowrap shrink-0"
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
  ecosystemConfig,
  onOpenSubmitRecipe,
  theme,
  onToggleTheme,
}: MobileBottomNavProps) {
  const [quickOpen, setQuickOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const sections = ecosystemConfig.appSections;

  const items: {id: AppTab; label: string; icon: typeof BookOpen; count?: number}[] = [
    {id: 'explore', label: 'دستورها', icon: BookOpen},
    ...(sections?.kitchenTabEnabled !== false ? [{id: 'kitchen' as AppTab, label: 'یخچال', icon: ChefHat}] : []),
    ...(sections?.shoppingTabEnabled !== false
      ? [
          {
            id: 'shopping' as AppTab,
            label: 'خرید',
            icon: ShoppingBag,
            count: shoppingRemainingCount > 0 ? shoppingRemainingCount : undefined,
          },
        ]
      : []),
    ...(ecosystemConfig.marketplaceTabEnabled
      ? [{id: 'marketplace' as AppTab, label: 'برندها', icon: Store}]
      : []),
    {id: 'profile', label: 'پروفایل', icon: User},
  ];

  const fluidSpring = prefersReducedMotion
    ? {duration: 0.12}
    : {type: 'spring' as const, stiffness: 420, damping: 30, mass: 0.85};

  const iconSpring = prefersReducedMotion
    ? {duration: 0.12}
    : {type: 'spring' as const, stiffness: 520, damping: 24, mass: 0.65};

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
      {/* Clean Quick-Action Sheet (Zero Admin Links, 100% Culinary Focus) */}
      <AnimatePresence>
        {quickOpen && (
          <>
            <motion.div
              key="dock-backdrop"
              initial={{opacity: 0}}
              animate={{opacity: 1}}
              exit={{opacity: 0}}
              transition={{duration: 0.16}}
              onClick={() => setQuickOpen(false)}
              className="md:hidden fixed inset-0 z-30 bg-[#0D0B08]/35 dark:bg-black/65 backdrop-blur-[4px]"
            />

            <motion.div
              key="dock-quick-sheet"
              initial={prefersReducedMotion ? {opacity: 0} : {opacity: 0, y: 20, scale: 0.94}}
              animate={prefersReducedMotion ? {opacity: 1} : {opacity: 1, y: 0, scale: 1}}
              exit={prefersReducedMotion ? {opacity: 0} : {opacity: 0, y: 14, scale: 0.95}}
              transition={fluidSpring}
              className="md:hidden fixed bottom-[86px] left-3 z-40 w-[236px] rounded-[24px] bg-[#FFFFFF]/96 dark:bg-[#161513]/96 backdrop-blur-2xl border border-[#E6DFD2] dark:border-[#2F2A22] shadow-[0_22px_50px_-14px_rgba(32,22,8,0.34)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.72)] p-2 space-y-1 pb-safe"
            >
              {sections?.submitRecipeEnabled !== false && (
                <motion.button
                  type="button"
                  initial={prefersReducedMotion ? false : {opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  transition={{duration: 0.16, delay: 0.02}}
                  whileTap={prefersReducedMotion ? undefined : {scale: 0.97}}
                  onClick={() => {
                    triggerHaptic();
                    setQuickOpen(false);
                    onOpenSubmitRecipe();
                  }}
                  className="w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#FBF3E4] dark:hover:bg-[#262015] transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-[#A97222] dark:bg-[#D8A85B] text-[#FFFFFF] dark:text-[#161108] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-3px_rgba(169,114,34,0.45)]">
                    <Plus className="w-4 h-4" strokeWidth={2.4} />
                  </span>
                  <span className="whitespace-nowrap">ثبت دستور پخت</span>
                </motion.button>
              )}

              {sections?.kitchenTabEnabled !== false && (
                <motion.button
                  type="button"
                  initial={prefersReducedMotion ? false : {opacity: 0, y: 8}}
                  animate={{opacity: 1, y: 0}}
                  transition={{duration: 0.16, delay: 0.05}}
                  whileTap={prefersReducedMotion ? undefined : {scale: 0.97}}
                  onClick={() => handleSelect('kitchen')}
                  className="w-full min-h-[46px] px-3.5 rounded-2xl flex items-center gap-3 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#FBF3E4] dark:hover:bg-[#262015] transition-colors"
                >
                  <span className="w-8 h-8 rounded-full bg-[#FBF2E1] dark:bg-[#2A2215] text-[#9A6314] dark:text-[#E8BA66] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <span className="whitespace-nowrap">با یخچال چی بپزم؟</span>
                </motion.button>
              )}

              <div className="h-px bg-[#ECE7DC] dark:bg-[#2A2620] mx-2 my-1" />

              <motion.button
                type="button"
                initial={prefersReducedMotion ? false : {opacity: 0, y: 8}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.16, delay: 0.08}}
                whileTap={prefersReducedMotion ? undefined : {scale: 0.97}}
                onClick={() => {
                  triggerHaptic();
                  onToggleTheme();
                  setQuickOpen(false);
                }}
                className="w-full min-h-[44px] px-3.5 rounded-2xl flex items-center gap-3 text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] hover:bg-[#F5F3EE] dark:hover:bg-[#23211D] transition-colors"
              >
                <span className="w-8 h-8 rounded-full bg-[#EFEFED] dark:bg-[#23211D] flex items-center justify-center shrink-0">
                  {theme === 'dark' ? <Sun className="w-4 h-4 text-[#E8BA66]" /> : <Moon className="w-4 h-4" />}
                </span>
                <span className="whitespace-nowrap">{theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}</span>
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Thumb-Zone Dimensional Floating Mobile Dock with Fluid Saffron Transitions */}
      <nav aria-label="ناوبری موبایل" className="md:hidden fixed bottom-3 inset-x-3 z-40 pb-safe pointer-events-none">
        <div className="max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
          <LayoutGroup id="lagheli-mobile-saffron-dock">
            <div className="relative min-w-0 flex-1 h-[60px] rounded-[26px] bg-[#FFFFFF]/92 dark:bg-[#141311]/94 backdrop-blur-2xl border border-[#E5DEC9]/90 dark:border-[#2E2920] shadow-[0_18px_42px_-12px_rgba(28,20,6,0.22),0_4px_12px_-4px_rgba(28,20,6,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[0_22px_48px_-10px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,232,188,0.08)] px-1.5 flex items-center justify-between gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <motion.button
                    key={item.id}
                    type="button"
                    whileTap={prefersReducedMotion ? undefined : {scale: 0.92}}
                    onClick={() => handleSelect(item.id)}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex-1 min-w-[44px] h-[48px] rounded-[20px] flex flex-col items-center justify-center gap-0.5 select-none focus-visible:outline-2 focus-visible:outline-[#A97222] dark:focus-visible:outline-[#E5B45B] transition-colors ${
                      active
                        ? 'text-[#7D4E0D] dark:text-[#F5D38E]'
                        : 'text-[#6B6A64] dark:text-[#94938C] hover:text-[#2D2C28] dark:hover:text-[#E4E3DD]'
                    }`}
                  >
                    {/* Layered Saffron Depth Cushion gliding smoothly across tabs */}
                    {active && (
                      <motion.span
                        layoutId="lagheli-saffron-tab-surface"
                        transition={fluidSpring}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-[#FFF7E6] via-[#FCECC9] to-[#F6DFB0] dark:from-[#362915] dark:via-[#2B2010] dark:to-[#21180B] border border-[#D8A85B]/55 dark:border-[#D8A85B]/35 shadow-[0_8px_18px_-8px_rgba(169,114,34,0.48),inset_0_1px_0_rgba(255,255,255,0.88)] dark:shadow-[0_8px_20px_-8px_rgba(216,168,91,0.3),inset_0_1px_0_rgba(255,228,176,0.16)]"
                      />
                    )}

                    {/* Precision Saffron Top Rim Crest */}
                    {active && (
                      <motion.span
                        layoutId="lagheli-saffron-top-crest"
                        transition={fluidSpring}
                        aria-hidden="true"
                        className="absolute -top-[1px] w-7 h-[2.5px] rounded-full bg-[#B5781D] dark:bg-[#ECC06E]"
                      />
                    )}

                    {/* Dimensional Floating Icon with Saffron Active Highlight */}
                    <motion.span
                      animate={
                        prefersReducedMotion
                          ? {opacity: 1}
                          : active
                            ? {y: -1.5, scale: 1.12}
                            : {y: 0, scale: 1}
                      }
                      transition={iconSpring}
                      className="relative z-10 flex items-center justify-center"
                    >
                      <Icon
                        className={`w-[19px] h-[19px] transition-colors duration-200 ${
                          active
                            ? 'text-[#9A6314] dark:text-[#ECC06E] drop-shadow-[0_2px_6px_rgba(169,114,34,0.28)]'
                            : 'text-current'
                        }`}
                        strokeWidth={active ? 2.35 : 1.85}
                      />

                      {item.count !== undefined && (
                        <motion.span
                          key={item.count}
                          initial={prefersReducedMotion ? false : {scale: 0.7, opacity: 0}}
                          animate={{scale: 1, opacity: 1}}
                          transition={iconSpring}
                          className={`absolute -top-1.5 -left-2.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-extrabold leading-none flex items-center justify-center tabular-nums shadow-sm ${
                            active
                              ? 'bg-[#8C5610] text-[#FFFBF2] dark:bg-[#ECC06E] dark:text-[#1A1308]'
                              : 'bg-[#B54B1F] text-[#FFFFFF] dark:bg-[#D8A85B] dark:text-[#161108]'
                          }`}
                        >
                          {toFaDigits(item.count)}
                        </motion.span>
                      )}
                    </motion.span>

                    {/* Crisp Single-Line Label with Depth Settling */}
                    <motion.span
                      animate={
                        prefersReducedMotion
                          ? {opacity: 1}
                          : active
                            ? {y: 0, opacity: 1}
                            : {y: 0.5, opacity: 0.86}
                      }
                      transition={{duration: 0.16, ease: [0.16, 1, 0.3, 1]}}
                      className={`relative z-10 text-[10.5px] leading-tight whitespace-nowrap tracking-tight ${
                        active ? 'font-extrabold' : 'font-medium'
                      }`}
                    >
                      {item.label}
                    </motion.span>
                  </motion.button>
                );
              })}
            </div>
          </LayoutGroup>

          {/* Elevated Saffron-Accented Quick Action Trigger */}
          <motion.button
            type="button"
            whileTap={prefersReducedMotion ? undefined : {scale: 0.9}}
            onClick={toggleQuickMenu}
            aria-label={quickOpen ? 'بستن منوی سریع' : 'باز کردن منوی سریع'}
            aria-expanded={quickOpen}
            className={`w-[56px] h-[56px] rounded-[22px] shrink-0 flex items-center justify-center border transition-colors duration-200 ${
              quickOpen
                ? 'bg-[#A97222] dark:bg-[#D8A85B] text-[#FFFFFF] dark:text-[#161108] border-[#C99138] dark:border-[#ECC06E] shadow-[0_14px_30px_-8px_rgba(169,114,34,0.55)]'
                : 'bg-[#141311] dark:bg-[#F5EFE2] text-[#F5D38E] dark:text-[#7D4E0D] border-[#2E2920] dark:border-[#E2D6BE] shadow-[0_16px_32px_-10px_rgba(24,18,8,0.45)]'
            }`}
          >
            <motion.span
              animate={{rotate: quickOpen ? 45 : 0}}
              transition={iconSpring}
              className="flex items-center justify-center"
            >
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </motion.span>
          </motion.button>
        </div>
      </nav>
    </>
  );
}

