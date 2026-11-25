import {AnimatePresence, motion} from 'motion/react';
import {Check, ChevronUp, Clock, Leaf, SlidersHorizontal, X} from 'lucide-react';
import type {RecipeFilterState} from './RecipeFeed.tsx';

export type QuickFlyoutFocus = 'maxTotalMinutes' | 'diets';

const DIET_QUICK_OPTIONS: readonly string[] = [
  'گیاهی',
  'پرپروتئین',
  'سنتی',
  'رژیمی',
  'بدون گلوتن',
  'اقتصادی',
];

const TIME_QUICK_OPTIONS: Array<{label: string; value: number | null; feedback: string}> = [
  {label: 'زیر ۳۰ دقیقه', value: 30, feedback: 'فیلتر سریع زمان پخت: زیر ۳۰ دقیقه اعمال شد.'},
  {label: 'تا ۴۵ دقیقه', value: 45, feedback: 'فیلتر سریع زمان پخت: تا ۴۵ دقیقه اعمال شد.'},
  {label: 'تا ۶۰ دقیقه', value: 60, feedback: 'فیلتر سریع زمان پخت: تا ۶۰ دقیقه اعمال شد.'},
  {label: 'همه زمان‌ها', value: null, feedback: 'محدودیت زمان پخت برداشته شد.'},
];

interface ScrollTastePromptProps {
  visible: boolean;
  expanded: boolean;
  focus: QuickFlyoutFocus;
  filters: RecipeFilterState;
  onChangeFocus: (focus: QuickFlyoutFocus) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onSelectMaxMinutes: (minutes: number | null, feedback: string) => void;
  onToggleDiet: (diet: string) => void;
  onDismiss: () => void;
  onMuteSession: () => void;
}

export function ScrollTastePrompt({
  visible,
  expanded,
  focus,
  filters,
  onChangeFocus,
  onExpand,
  onCollapse,
  onSelectMaxMinutes,
  onToggleDiet,
  onDismiss,
  onMuteSession,
}: ScrollTastePromptProps) {
  const isTimeFocus = focus === 'maxTotalMinutes';
  const peekQuestion = isTimeFocus
    ? 'تنظیم سریع زمان پخت می‌خوای؟'
    : 'تنظیم سریع سبک غذایی می‌خوای؟';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[88px] md:bottom-6 z-30 flex justify-center px-3">
      <AnimatePresence mode="wait">
        {visible && !expanded && (
          /* Non-Blocking Bottom-Entry Flyout Trigger — Respects User's View */
          <motion.div
            key={`flyout-peek-${focus}`}
            role="region"
            aria-live="polite"
            aria-label={peekQuestion}
            initial={{opacity: 0, y: 40, scale: 0.94}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 32, scale: 0.95}}
            transition={{type: 'spring', stiffness: 380, damping: 30}}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full bg-[#0D0D0D]/90 dark:bg-[#1E1E1C]/94 text-[#FFFFFF] backdrop-blur-[16px] border border-white/16 shadow-[0_14px_36px_-10px_rgba(0,0,0,0.48)] pl-1.5 pr-3 h-[46px] max-w-full"
          >
            <button
              type="button"
              onClick={onExpand}
              className="inline-flex items-center gap-2 min-w-0 h-full active:scale-[0.98] transition-transform"
            >
              <span className="w-6 h-6 rounded-full bg-white/12 flex items-center justify-center shrink-0">
                {isTimeFocus ? (
                  <Clock className="w-3.5 h-3.5 text-[#D8A85B]" aria-hidden="true" />
                ) : (
                  <Leaf className="w-3.5 h-3.5 text-[#E29A6F]" aria-hidden="true" />
                )}
              </span>
              <span className="text-xs sm:text-[13px] font-bold tracking-tight truncate">
                {peekQuestion}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/14 px-2.5 py-0.5 text-[11px] font-semibold text-[#F6F6F5] shrink-0">
                <span>تنظیم سریع</span>
                <ChevronUp className="w-3 h-3 text-[#E29A6F]" aria-hidden="true" />
              </span>
            </button>

            <button
              type="button"
              aria-label="بستن پیشنهاد"
              onClick={onDismiss}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/65 hover:text-white hover:bg-white/12 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}

        {visible && expanded && (
          /* User-Opened Quick Filter Flyout (diets & maxTotalMinutes) */
          <motion.aside
            key="flyout-panel"
            role="region"
            aria-live="polite"
            aria-label="تنظیمات سریع فیلتر دستورها"
            initial={{opacity: 0, y: 36, scale: 0.96}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 28, scale: 0.96}}
            transition={{type: 'spring', stiffness: 380, damping: 32}}
            className="pointer-events-auto w-full max-w-md"
          >
            <div className="relative overflow-hidden rounded-[22px] bg-[#FFFFFF]/95 dark:bg-[#151514]/95 backdrop-blur-[20px] border border-[#0D0D0D]/12 dark:border-white/14 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.36)] dark:shadow-[0_26px_64px_-16px_rgba(0,0,0,0.82)] p-4 sm:p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] flex items-center justify-center shrink-0 mt-0.5">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-[#B54B1F] dark:text-[#E29A6F]">
                      تنظیمات سریع حین کاوش
                    </p>
                    <h3 className="text-sm sm:text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] leading-snug mt-0.5">
                      {isTimeFocus ? 'حداکثر زمان پخت چقدر باشه؟' : 'چه سبک غذایی مد نظرته؟'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="بستن پنجره تنظیم سریع"
                  onClick={onCollapse}
                  className="min-h-[34px] min-w-[34px] -mt-1 -ml-1 rounded-full flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Clean 2-Mode Switcher: maxTotalMinutes vs diets */}
              <div className="mt-3 inline-flex items-center p-1 rounded-full bg-[#F6F6F5] dark:bg-[#20201E] border border-[#E6E6E3] dark:border-[#2C2C29]">
                <button
                  type="button"
                  onClick={() => onChangeFocus('maxTotalMinutes')}
                  className={`min-h-[34px] px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                    isTimeFocus
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>زمان پخت</span>
                </button>
                <button
                  type="button"
                  onClick={() => onChangeFocus('diets')}
                  className={`min-h-[34px] px-3.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                    !isTimeFocus
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  <Leaf className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>سبک و رژیم</span>
                </button>
              </div>

              {/* Quick Filter Controls */}
              {isTimeFocus ? (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {TIME_QUICK_OPTIONS.map((opt) => {
                    const active = filters.maxTotalMinutes === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => onSelectMaxMinutes(opt.value, opt.feedback)}
                        className={`min-h-[40px] px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.97] transition-all whitespace-nowrap ${
                          active
                            ? 'bg-[#B54B1F] text-[#FFFFFF] border-[#B54B1F] dark:bg-[#E29A6F] dark:text-[#0B0B0B] dark:border-[#E29A6F]'
                            : 'border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA]'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {DIET_QUICK_OPTIONS.map((diet) => {
                    const active = filters.diets.includes(diet);
                    return (
                      <button
                        key={diet}
                        type="button"
                        onClick={() => onToggleDiet(diet)}
                        className={`min-h-[40px] px-3.5 rounded-full border text-xs font-semibold inline-flex items-center gap-1.5 active:scale-[0.97] transition-all whitespace-nowrap ${
                          active
                            ? 'bg-[#B54B1F] text-[#FFFFFF] border-[#B54B1F] dark:bg-[#E29A6F] dark:text-[#0B0B0B] dark:border-[#E29A6F]'
                            : 'border-[#E6E6E3] dark:border-[#2C2C29] bg-[#F6F6F5] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA]'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span>{diet}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quiet Respectful Exit Controls */}
              <div className="mt-3.5 pt-2.5 border-t border-[#E6E6E3]/80 dark:border-[#282825] flex items-center justify-between text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA] py-1 transition-colors"
                >
                  فعلاً نه، ادامه می‌دم
                </button>
                <button
                  type="button"
                  onClick={onMuteSession}
                  className="hover:text-[#B54B1F] dark:hover:text-[#E29A6F] py-1 transition-colors"
                >
                  دیگر نمایش نده
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
