import {useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Pause, Play, RotateCcw, Timer, Volume2, X} from 'lucide-react';
import {formatQuantity, toFaDigits} from '../shared/persianEngine.ts';
import type {Recipe} from '../shared/types.ts';

interface CookModeOverlayProps {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
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
    const AudioCtx = window.AudioContext || (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext;
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

export function CookModeOverlay({recipe, servings, onClose}: CookModeOverlayProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<{release: () => Promise<void>} | null>(null);

  const scale = servings / Math.max(1, recipe.servings);
  const currentStep = recipe.steps[stepIdx];

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

  const startStepTimer = (minutes: number, order: number) => {
    const id = `step-${order}`;
    setTimers((prev) => {
      if (prev.some((t) => t.id === id)) {
        return prev.map((t) => (t.id === id ? {...t, running: true} : t));
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

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${toFaDigits(String(m).padStart(2, '0'))}:${toFaDigits(String(s).padStart(2, '0'))}`;
  };

  const stepIngredients = recipe.ingredients.filter((ing) =>
    currentStep?.highlightIngredients?.some((h) => ing.name.includes(h) || h.includes(ing.name))
  );

  const progress = Math.round(((stepIdx + 1) / Math.max(1, recipe.steps.length)) * 100);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`حالت آشپزی ${recipe.title}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#F9F8F4] dark:bg-[#141412] text-[#1C1B18] dark:text-[#F4F1EA]"
    >
      {/* Top Bar */}
      <div className="border-b border-[#E5E1D6] dark:border-[#2F2D27] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
            حالت آشپزی · مرحله {toFaDigits(stepIdx + 1)} از {toFaDigits(recipe.steps.length)}
            {wakeLockActive ? ' · صفحه‌نمایش روشن می‌ماند' : ''}
          </p>
          <h2 className="text-base font-bold truncate">{recipe.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="خروج از حالت آشپزی"
          className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Hairline */}
      <div className="h-1 w-full bg-[#E5E1D6] dark:bg-[#2F2D27]">
        <div
          className="h-full bg-[#3F523B] dark:bg-[#8EA888] transition-all duration-300"
          style={{width: `${progress}%`}}
        />
      </div>

      {/* Main Step Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 max-w-3xl w-full mx-auto flex flex-col justify-between gap-8">
        <div className="space-y-8">
          <div className="text-sm font-medium text-[#3F523B] dark:text-[#8EA888]">
            گام {toFaDigits(currentStep?.order || stepIdx + 1)}
          </div>

          <p className="text-2xl sm:text-3xl font-medium leading-[1.85] text-[#1C1B18] dark:text-[#F4F1EA]">
            {currentStep?.instruction}
          </p>

          {/* Inline Ingredients for this step */}
          {stepIngredients.length > 0 && (
            <div className="border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-5">
              <p className="text-xs text-[#615E55] dark:text-[#A9A497] mb-3">
                مواد مورد نیاز این مرحله (برای {toFaDigits(servings)} نفر):
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
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
                className="inline-flex items-center gap-2.5 min-h-[48px] px-5 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium transition-colors"
              >
                <Timer className="w-4 h-4" />
                <span>شروع تایمر {toFaDigits(currentStep.timerMinutes)} دقیقه‌ای این مرحله</span>
              </button>
            </div>
          )}
        </div>

        {/* Simultaneous Active Timers Bar */}
        {timers.length > 0 && (
          <div aria-live="polite" className="border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-5 space-y-3">
            <p className="text-xs text-[#615E55] dark:text-[#A9A497]">تایمرهای فعال هم‌زمان</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {timers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] px-4 py-3"
                >
                  <div>
                    <div className="text-xs text-[#615E55] dark:text-[#A9A497] flex items-center gap-1.5">
                      <span>{t.label}</span>
                      {t.remainingSeconds === 0 && (
                        <span className="text-[#3F523B] dark:text-[#8EA888] font-semibold flex items-center gap-1">
                          <Volume2 className="w-3.5 h-3.5" /> زمان پایان یافت
                        </span>
                      )}
                    </div>
                    <div dir="ltr" className="text-xl font-bold tabular-nums mt-0.5 text-right">
                      {formatTimer(t.remainingSeconds)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={t.running ? 'توقف تایمر' : 'ادامه تایمر'}
                      onClick={() =>
                        setTimers((prev) =>
                          prev.map((item) => (item.id === t.id ? {...item, running: !item.running} : item))
                        )
                      }
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
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
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Large Touch Controls */}
      <div className="border-t border-[#E5E1D6] dark:border-[#2F2D27] px-4 sm:px-8 py-4 bg-[#FFFFFF] dark:bg-[#1C1B18] pb-safe">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="min-h-[48px] px-5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] flex items-center gap-2 text-sm font-medium disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
            <span>مرحله قبل</span>
          </button>

          {stepIdx < recipe.steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(recipe.steps.length - 1, i + 1))}
              className="flex-1 sm:flex-none min-h-[48px] px-8 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] flex items-center justify-center gap-2 text-sm font-medium"
            >
              <span>مرحله بعد</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none min-h-[48px] px-8 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium"
            >
              پایان آشپزی — نوش جان
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
