import {useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useReducedMotion} from 'motion/react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Timer,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import {shareRecipeWithWebShare} from '../lib/webShare.ts';
import {formatQuantity, toFaDigits} from '../shared/persianEngine.ts';
import type {Recipe} from '../shared/types.ts';

interface CookModeOverlayProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
  onNotify?: (msg: string) => void;
}

interface ActiveTimer {
  id: string;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  running: boolean;
}

function playGentleChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch {
    // Ignore audio context block
  }
}

export function CookModeOverlay({recipe, servings, onClose, onNotify}: CookModeOverlayProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [largeText, setLargeText] = useState(false);
  const [ingredientsDrawerOpen, setIngredientsDrawerOpen] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(() => new Set());
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  const wakeLockRef = useRef<{release: () => Promise<void>} | null>(null);
  const touchStartRef = useRef<{x: number; y: number} | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const totalSteps = Math.max(1, recipe.steps.length);
  const scale = servings / Math.max(1, recipe.servings);
  const currentStep = recipe.steps[stepIdx];

  const goToStep = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(totalSteps - 1, nextIndex));
      if (clamped === stepIdx) return;
      setDirection(clamped > stepIdx ? 1 : -1);
      setStepIdx(clamped);
    },
    [stepIdx, totalSteps]
  );

  const goNext = useCallback(() => {
    goToStep(stepIdx + 1);
  }, [goToStep, stepIdx]);

  const goPrev = useCallback(() => {
    goToStep(stepIdx - 1);
  }, [goToStep, stepIdx]);

  // Screen Wake Lock API to keep display awake while cooking
  useEffect(() => {
    let mounted = true;
    const acquireWakeLock = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {request: (type: 'screen') => Promise<{release: () => Promise<void>}>};
        };
        if (nav.wakeLock) {
          const lock = await nav.wakeLock.request('screen');
          if (mounted) {
            wakeLockRef.current = lock;
            setWakeLockActive(true);
          }
        }
      } catch {
        setWakeLockActive(false);
      }
    };
    acquireWakeLock();
    return () => {
      mounted = false;
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  // RTL-aware keyboard navigation (ArrowLeft = next, ArrowRight = prev, Escape = close drawer or overlay)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (ingredientsDrawerOpen) {
          setIngredientsDrawerOpen(false);
        } else {
          onClose();
        }
        return;
      }
      if (ingredientsDrawerOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, ingredientsDrawerOpen, onClose]);

  // Multi-timer ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running || t.remainingSeconds <= 0) return t;
          const next = t.remainingSeconds - 1;
          if (next === 0) {
            playGentleChime();
            return {...t, remainingSeconds: 0, running: false};
          }
          return {...t, remainingSeconds: next};
        })
      );
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (ingredientsDrawerOpen || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {x: touch.clientX, y: touch.clientY};
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (ingredientsDrawerOpen || !touchStartRef.current || e.changedTouches.length !== 1) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Require clear horizontal dominance so vertical scrolling is never hijacked
    if (Math.abs(dx) < 52 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    // RTL page turn: swipe right pulls next step from the left; swipe left returns to previous step
    if (dx > 0) {
      goNext();
    } else {
      goPrev();
    }
  };

  const startStepTimer = (minutes: number, order: number) => {
    const id = `step-${order}`;
    setTimers((prev) => {
      if (prev.some((t) => t.id === id)) {
        return prev.map((t) =>
          t.id === id
            ? {
                ...t,
                remainingSeconds: t.remainingSeconds === 0 ? t.totalSeconds : t.remainingSeconds,
                running: true,
              }
            : t
        );
      }
      return [
        ...prev,
        {
          id,
          label: `مرحله ${toFaDigits(order)}`,
          totalSeconds: minutes * 60,
          remainingSeconds: minutes * 60,
          running: true,
        },
      ];
    });
  };

  const extendTimerByOneMinute = (id: string) => {
    setTimers((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              totalSeconds: item.totalSeconds + 60,
              remainingSeconds: item.remainingSeconds + 60,
              running: true,
            }
          : item
      )
    );
  };

  const removeTimer = (id: string) => {
    setTimers((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleIngredientCheck = (name: string) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${toFaDigits(String(m).padStart(2, '0'))}:${toFaDigits(String(s).padStart(2, '0'))}`;
  };

  const stepIngredients = recipe.ingredients.filter((ing) =>
    currentStep?.highlightIngredients?.some((h) => ing.name.includes(h) || h.includes(ing.name))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`حالت آشپزی ${recipe.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#0D0D0D] dark:text-[#FAFAFA]"
    >
      {/* Top Bar */}
      <div className="border-b border-[#E6E6E3] dark:border-[#282825] px-4 sm:px-8 h-16 flex items-center justify-between gap-3 bg-[#FFFFFF]/90 dark:bg-[#111110]/90 backdrop-blur-md">
        <div className="min-w-0">
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums truncate">
            مرحله {toFaDigits(stepIdx + 1)} از {toFaDigits(totalSteps)}
            {wakeLockActive ? ' · صفحه‌نمایش روشن' : ''}
          </p>
          <h2 className="text-sm sm:text-base font-bold truncate">{recipe.title}</h2>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* 1-Tap Scaled Ingredients Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIngredientsDrawerOpen(true)}
            aria-label="مشاهده مواد اولیه"
            className="min-h-[44px] px-3 sm:px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
          >
            <ListChecks className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
            <span>مواد اولیه</span>
          </button>

          {/* Kitchen-Distance Text Scale Toggle */}
          <button
            type="button"
            onClick={() => setLargeText((v) => !v)}
            aria-pressed={largeText}
            aria-label={largeText ? 'بازگشت به اندازه متن عادی' : 'بزرگ‌نمایی متن برای خواندن از فاصله'}
            className={`min-h-[44px] px-3 sm:px-3.5 rounded-full border inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              largeText
                ? 'border-[#A97222] bg-[#A97222]/12 text-[#A97222] dark:border-[#D8A85B] dark:bg-[#D8A85B]/15 dark:text-[#D8A85B]'
                : 'border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]'
            }`}
          >
            <Type className="w-4 h-4" />
            <span className="hidden sm:inline">{largeText ? 'متن عادی' : 'درشت‌نمایی'}</span>
          </button>

          <button
            type="button"
            onClick={async () => {
              const res = await shareRecipeWithWebShare(recipe, {servings, includeIngredients: true});
              if (res.message && onNotify) onNotify(res.message);
            }}
            aria-label="اشتراک‌گذاری دستور پخت"
            className="hidden md:inline-flex min-h-[44px] px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] items-center gap-1.5 text-xs font-medium whitespace-nowrap transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>اشتراک‌گذاری</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="خروج از حالت آشپزی"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Interactive Clickable Segmented Step Progress Rail */}
      <div
        role="tablist"
        aria-label="مراحل پخت"
        className="px-4 sm:px-8 pt-3 pb-2 max-w-3xl w-full mx-auto flex items-center gap-1.5"
      >
        {recipe.steps.map((st, idx) => {
          const isCurrent = idx === stepIdx;
          const isCompleted = idx < stepIdx;
          return (
            <button
              key={st.order || idx}
              type="button"
              role="tab"
              aria-selected={isCurrent}
              aria-current={isCurrent ? 'step' : undefined}
              aria-label={`رفتن به مرحله ${toFaDigits(idx + 1)}`}
              onClick={() => goToStep(idx)}
              className="group flex-1 py-2 focus-visible:outline-none"
            >
              <span
                className={`block h-1.5 w-full rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-[#B54B1F] dark:bg-[#E29A6F]'
                    : isCompleted
                      ? 'bg-[#A97222] dark:bg-[#D8A85B]'
                      : 'bg-[#E6E6E3] dark:bg-[#282825] group-hover:bg-[#5C5C58]/35 dark:group-hover:bg-[#A3A39E]/35'
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Main Step Content (Swipe-Enabled) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 sm:py-8 max-w-3xl w-full mx-auto flex flex-col justify-between gap-8"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={stepIdx}
            initial={prefersReducedMotion ? {opacity: 0} : {opacity: 0, x: direction === 1 ? -28 : 28}}
            animate={{opacity: 1, x: 0}}
            exit={prefersReducedMotion ? {opacity: 0} : {opacity: 0, x: direction === 1 ? 28 : -28}}
            transition={prefersReducedMotion ? {duration: 0.12} : {duration: 0.22, ease: [0.16, 1, 0.3, 1]}}
            className="space-y-7 sm:space-y-8"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-bold text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
                گام {toFaDigits(currentStep?.order || stepIdx + 1)} از {toFaDigits(totalSteps)}
              </div>
              <span className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] hidden sm:inline">
                جابه‌جایی با کلیدهای جهت‌نما یا کشیدن افقی
              </span>
            </div>

            <p
              className={`font-medium text-[#0D0D0D] dark:text-[#FAFAFA] transition-[font-size] duration-200 ${
                largeText
                  ? 'text-3xl sm:text-4xl lg:text-[2.6rem] leading-[1.72]'
                  : 'text-2xl sm:text-3xl leading-[1.88]'
              }`}
            >
              {currentStep?.instruction}
            </p>

            {/* Inline Ingredients for this step */}
            {stepIngredients.length > 0 && (
              <div className="border-t border-[#E6E6E3] dark:border-[#282825] pt-5">
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mb-3">
                  مواد مورد نیاز این مرحله (برای {toFaDigits(servings)} نفر):
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2.5 text-sm">
                  {stepIngredients.map((ing) => (
                    <span key={ing.name} className="tabular-nums">
                      <strong className="font-semibold">{ing.name}:</strong> {formatQuantity(ing.amount * scale)}{' '}
                      {ing.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Step Timer Launch */}
            {currentStep?.timerMinutes && (
              <div>
                <button
                  type="button"
                  onClick={() => startStepTimer(currentStep.timerMinutes!, currentStep.order)}
                  className="inline-flex items-center gap-2.5 min-h-[48px] px-5 rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-sm font-semibold active:scale-[0.98] transition-all"
                >
                  <Timer className="w-4 h-4" />
                  <span>شروع تایمر {toFaDigits(currentStep.timerMinutes)} دقیقه‌ای این مرحله</span>
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Simultaneous Active Timers Bar */}
        {timers.length > 0 && (
          <div aria-live="polite" className="border-t border-[#E6E6E3] dark:border-[#282825] pt-5 space-y-3">
            <p className="text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">تایمرهای فعال هم‌زمان</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {timers.map((t) => {
                const ratio = t.totalSeconds > 0 ? Math.min(1, Math.max(0, t.remainingSeconds / t.totalSeconds)) : 0;
                const finished = t.remainingSeconds === 0;
                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border bg-[#FFFFFF] dark:bg-[#151514] px-4 pt-3.5 pb-3 space-y-2.5 transition-colors ${
                      finished
                        ? 'border-[#B54B1F] dark:border-[#E29A6F]'
                        : 'border-[#E6E6E3] dark:border-[#282825]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] flex items-center gap-1.5">
                          <span>{t.label}</span>
                          {finished && (
                            <span className="text-[#B54B1F] dark:text-[#E29A6F] font-semibold flex items-center gap-1">
                              <Volume2 className="w-3.5 h-3.5" /> زمان پایان یافت
                            </span>
                          )}
                        </div>
                        <div dir="ltr" className="text-2xl font-bold tabular-nums mt-0.5 text-right">
                          {formatTimer(t.remainingSeconds)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => extendTimerByOneMinute(t.id)}
                          aria-label="افزودن یک دقیقه به تایمر"
                          className="min-h-[44px] px-2.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] text-xs font-semibold text-[#A97222] dark:text-[#D8A85B] inline-flex items-center gap-0.5 tabular-nums transition-colors whitespace-nowrap"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>۱ دقیقه</span>
                        </button>
                        <button
                          type="button"
                          aria-label={t.running ? 'توقف تایمر' : 'ادامه تایمر'}
                          onClick={() =>
                            setTimers((prev) =>
                              prev.map((item) =>
                                item.id === t.id ? {...item, running: !item.running} : item
                              )
                            )
                          }
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                        >
                          {t.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          aria-label="بازنشانی تایمر"
                          onClick={() =>
                            setTimers((prev) =>
                              prev.map((item) =>
                                item.id === t.id
                                  ? {...item, remainingSeconds: item.totalSeconds, running: false}
                                  : item
                              )
                            )
                          }
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="حذف تایمر"
                          onClick={() => removeTimer(t.id)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#B54B1F] dark:hover:text-[#E29A6F] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Countdown Progress Track */}
                    <div className="h-1.5 w-full rounded-full bg-[#EFEFED] dark:bg-[#242422] overflow-hidden">
                      <div
                        className="h-full w-full origin-right rounded-full bg-gradient-to-l from-[#A97222] to-[#B54B1F] dark:from-[#D8A85B] dark:to-[#E29A6F] transition-transform duration-700 ease-linear"
                        style={{transform: `scaleX(${ratio})`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Large Touch Controls */}
      <div className="border-t border-[#E6E6E3] dark:border-[#282825] px-4 sm:px-8 py-3.5 bg-[#FFFFFF] dark:bg-[#151514] pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={goPrev}
            className="min-h-[50px] px-5 rounded-full border border-[#E6E6E3] dark:border-[#282825] flex items-center gap-2 text-sm font-semibold disabled:opacity-35 active:scale-[0.98] transition-all"
          >
            <ChevronRight className="w-4 h-4" />
            <span>مرحله قبل</span>
          </button>

          {stepIdx < totalSteps - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex-1 sm:flex-none min-h-[50px] px-8 rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] flex items-center justify-center gap-2 text-sm font-semibold active:scale-[0.98] transition-all"
            >
              <span>مرحله بعد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-2.5 flex-1 sm:flex-none justify-end">
              <button
                type="button"
                onClick={async () => {
                  const res = await shareRecipeWithWebShare(recipe, {servings, includeIngredients: true});
                  if (res.message && onNotify) onNotify(res.message);
                }}
                className="min-h-[50px] px-4 sm:px-5 rounded-full border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">اشتراک‌گذاری</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none min-h-[50px] px-7 rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:text-[#111110] text-[#FFFFFF] text-sm font-semibold whitespace-nowrap active:scale-[0.98] transition-all"
              >
                پایان آشپزی — نوش جان
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1-Tap Scaled Ingredients Bottom-Sheet Drawer */}
      <AnimatePresence>
        {ingredientsDrawerOpen && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.16}}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIngredientsDrawerOpen(false);
            }}
            className="fixed inset-0 z-60 bg-black/55 backdrop-blur-[2px] flex items-end justify-center"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="فهرست مواد اولیه مقیاس‌شده"
              initial={prefersReducedMotion ? {opacity: 0} : {y: '100%'}}
              animate={prefersReducedMotion ? {opacity: 1} : {y: 0}}
              exit={prefersReducedMotion ? {opacity: 0} : {y: '100%'}}
              transition={prefersReducedMotion ? {duration: 0.12} : {duration: 0.26, ease: [0.16, 1, 0.3, 1]}}
              className="w-full max-w-2xl max-h-[78vh] flex flex-col rounded-t-[28px] bg-[#FFFFFF] dark:bg-[#151514] border-t border-x border-[#E6E6E3] dark:border-[#282825] shadow-2xl overflow-hidden"
            >
              <div className="px-5 sm:px-6 pt-3 pb-3.5 border-b border-[#E6E6E3] dark:border-[#242422] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                    مواد اولیه ({toFaDigits(servings)} نفر)
                  </h3>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                    {toFaDigits(checkedIngredients.size)} از {toFaDigits(recipe.ingredients.length)} قلم استفاده شد
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIngredientsDrawerOpen(false)}
                  aria-label="بستن فهرست مواد اولیه"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-[#EFEFED] dark:hover:bg-[#20201E] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <ul className="flex-1 overflow-y-auto divide-y divide-[#E6E6E3]/80 dark:divide-[#242422] px-5 sm:px-6 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                {recipe.ingredients.map((ing) => {
                  const done = checkedIngredients.has(ing.name);
                  return (
                    <li key={ing.name}>
                      <button
                        type="button"
                        onClick={() => toggleIngredientCheck(ing.name)}
                        className="w-full min-h-[50px] py-2.5 flex items-center justify-between gap-3 text-right"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              done
                                ? 'bg-[#A97222] border-[#A97222] text-white dark:bg-[#D8A85B] dark:border-[#D8A85B] dark:text-[#0B0B0B]'
                                : 'border-[#5C5C58]/40 dark:border-[#A3A39E]/40'
                            }`}
                          >
                            {done && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                          </span>
                          <span
                            className={`text-sm font-medium truncate ${
                              done
                                ? 'line-through text-[#5C5C58] dark:text-[#A3A39E] opacity-55'
                                : 'text-[#0D0D0D] dark:text-[#FAFAFA]'
                            }`}
                          >
                            {ing.name}
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E] tabular-nums whitespace-nowrap shrink-0">
                          {formatQuantity(ing.amount * scale)} {ing.unit}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
