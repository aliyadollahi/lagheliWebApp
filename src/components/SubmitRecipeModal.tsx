import {useEffect, useId, useMemo, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Camera,
  Check,
  ChevronDown,
  Clock,
  Flame,
  ImagePlus,
  Minus,
  Plus,
  Sparkles,
  Timer,
  Trash2,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {fileToCompressedDataUrl} from '../lib/imageUpload.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {Recipe} from '../shared/types.ts';

interface SubmitRecipeModalProps {
  open: boolean;
  parentRecipe?: Recipe | null;
  onClose: () => void;
  onSubmitted: () => void;
  onNotify: (msg: string) => void;
}

interface IngredientDraft {
  id: string;
  name: string;
  amount: number;
  unit: string;
}

interface StepDraft {
  id: string;
  instruction: string;
  timerMinutes?: number;
}

const CATEGORIES = ['ناهار و شام', 'صبحانه', 'پیش‌غذا و عصرانه', 'وگان و گیاهی', 'پخت سریع'] as const;
const SEASONS = ['چهارفصل', 'بهار', 'تابستان', 'پاییز', 'زمستان'] as const;
const MEAL_TYPES = ['ناهار', 'شام', 'صبحانه', 'عصرانه', 'دسر و پیش‌غذا'] as const;
const DIFFICULTIES: ('آسان' | 'متوسط' | 'حرفه‌ای')[] = ['آسان', 'متوسط', 'حرفه‌ای'];
const DIET_OPTIONS = ['سنتی', 'گیاهی', 'رژیمی', 'پرپروتئین', 'بدون گلوتن', 'سریع', 'اقتصادی'] as const;
const COMMON_UNITS = ['گرم', 'عدد', 'قاشق غذاخوری', 'قاشق چای‌خوری', 'پیمانه', 'حبه', 'لیوان', 'به مقدار لازم'] as const;
const POPULAR_REGIONS = ['تهران', 'گیلان', 'اصفهان', 'تبریز', 'شیراز', 'مشهد', 'جنوب ایران', 'کرمانشاه'] as const;
const QUICK_STAPLES: {name: string; amount: number; unit: string}[] = [
  {name: 'نمک و فلفل سیاه', amount: 1, unit: 'قاشق چای‌خوری'},
  {name: 'زردچوبه', amount: 1, unit: 'قاشق چای‌خوری'},
  {name: 'روغن زیتون یا مایع', amount: 3, unit: 'قاشق غذاخوری'},
  {name: 'کره محلی', amount: 30, unit: 'گرم'},
  {name: 'رب گوجه‌فرنگی', amount: 2, unit: 'قاشق غذاخوری'},
  {name: 'سیر تازه', amount: 2, unit: 'حبه'},
];
const KITCHEN_TOOLS = ['قابلمه', 'تابه چدنی', 'فر', 'پلوپز', 'غذاساز', 'هاون', 'سینی فر', 'بخارپز'] as const;
const TIMER_PRESETS = [5, 10, 15, 30, 45] as const;

let draftCounter = 1;
const nextDraftId = (prefix: string) => `${prefix}-${draftCounter++}`;

const createInitialIngredients = (): IngredientDraft[] => [
  {id: nextDraftId('ing'), name: 'پیاز', amount: 1, unit: 'عدد'},
  {id: nextDraftId('ing'), name: 'زعفران دم‌کرده', amount: 2, unit: 'قاشق غذاخوری'},
];

const createInitialSteps = (): StepDraft[] => [{id: nextDraftId('stp'), instruction: '', timerMinutes: undefined}];

export function SubmitRecipeModal({
  open,
  parentRecipe,
  onClose,
  onSubmitted,
  onNotify,
}: SubmitRecipeModalProps) {
  const titleId = useId();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState(parentRecipe ? `${parentRecipe.title} (نسخه جایگزین)` : '');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [variationNote, setVariationNote] = useState('');
  const [imageUrl, setImageUrl] = useState(parentRecipe?.imageUrl || '');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [category, setCategory] = useState(parentRecipe?.category || 'ناهار و شام');
  const [region, setRegion] = useState(parentRecipe?.region || 'تهران');
  const [season, setSeason] = useState('چهارفصل');
  const [mealType, setMealType] = useState('ناهار');
  const [difficulty, setDifficulty] = useState<'آسان' | 'متوسط' | 'حرفه‌ای'>('متوسط');
  const [prepMinutes, setPrepMinutes] = useState(20);
  const [cookMinutes, setCookMinutes] = useState(40);
  const [servings, setServings] = useState(4);
  const [dietTags, setDietTags] = useState<string[]>(['سنتی']);
  const [tools, setTools] = useState<string[]>(['قابلمه']);

  const [ingredients, setIngredients] = useState<IngredientDraft[]>(createInitialIngredients);
  const [steps, setSteps] = useState<StepDraft[]>(createInitialSteps);
  const [submitting, setSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Sync draft defaults whenever the modal opens or parentRecipe switches
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setStepError(null);
    setTitle(parentRecipe ? `${parentRecipe.title} (نسخه جایگزین)` : '');
    setSubtitle('');
    setDescription('');
    setVariationNote('');
    setImageUrl(parentRecipe?.imageUrl || '');
    setImageDataUrl('');
    setCategory(parentRecipe?.category || 'ناهار و شام');
    setRegion(parentRecipe?.region || 'تهران');
    setSeason('چهارفصل');
    setMealType('ناهار');
    setDifficulty('متوسط');
    setPrepMinutes(20);
    setCookMinutes(40);
    setServings(4);
    setDietTags(['سنتی']);
    setTools(['قابلمه']);
    setIngredients(createInitialIngredients());
    setSteps(createInitialSteps());
  }, [open, parentRecipe]);

  // Escape key close + background body scroll lock
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, submitting, onClose]);

  // Scroll step canvas to top when switching steps
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({top: 0, behavior: 'smooth'});
  }, [step]);

  const validIngredients = useMemo(
    () => ingredients.filter((i) => i.name.trim().length > 0 && i.amount > 0 && i.unit.trim().length > 0),
    [ingredients]
  );

  const validSteps = useMemo(() => steps.filter((s) => s.instruction.trim().length >= 5), [steps]);

  const step1Complete = useMemo(() => {
    const baseOk = title.trim().length >= 3 && description.trim().length >= 10 && region.trim().length >= 2;
    if (parentRecipe) return baseOk && variationNote.trim().length >= 3;
    return baseOk;
  }, [title, description, region, parentRecipe, variationNote]);

  const step2Complete = validIngredients.length >= 2;
  const step3Complete = validSteps.length >= 1;
  const totalMinutes = (Number(prepMinutes) || 0) + (Number(cookMinutes) || 0);
  const previewImage = imageDataUrl || imageUrl;

  const validateStep = (targetStep: 1 | 2 | 3): string | null => {
    if (targetStep === 1) {
      if (title.trim().length < 3) return 'لطفاً عنوان دستور پخت را با حداقل ۳ کاراکتر وارد کنید.';
      if (parentRecipe && variationNote.trim().length < 3) {
        return 'تفاوت این روش جایگزین با دستور اصلی را کوتاه توضیح دهید.';
      }
      if (description.trim().length < 10) {
        return 'توضیح کوتاه درباره غذا باید حداقل ۱۰ کاراکتر باشد تا خوانندگان با طعم و بافت آن آشنا شوند.';
      }
      if (region.trim().length < 2) return 'لطفاً نام شهر یا منطقه اصالت غذا را وارد کنید.';
    }
    if (targetStep === 2) {
      if (validIngredients.length < 2) {
        return 'حداقل ۲ ماده اولیه با نام، مقدار و واحد مشخص وارد کنید.';
      }
    }
    if (targetStep === 3) {
      if (validSteps.length < 1) {
        return 'حداقل یک مرحله پخت (با شرح حداقل ۵ کاراکتر) بنویسید.';
      }
    }
    return null;
  };

  const handleImageFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('لطفاً یک فایل تصویری معتبر (JPG، PNG یا WebP) انتخاب کنید.');
      return;
    }
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      setImageDataUrl(dataUrl);
      setImageUrl('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در پردازش تصویر');
    }
  };

  const toggleDiet = (d: string) => {
    setDietTags((prev) => (prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]));
  };

  const toggleTool = (tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : prev.length < 10 ? [...prev, tool] : prev
    );
  };

  const handleAddStaple = (staple: {name: string; amount: number; unit: string}) => {
    if (ingredients.some((i) => i.name.trim() === staple.name)) return;
    setIngredients((prev) => [...prev, {id: nextDraftId('ing'), ...staple}]);
    setStepError(null);
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    setSteps((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  };

  const handleNextStep = () => {
    const err = validateStep(step);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3);
  };

  const handleJumpStep = (target: 1 | 2 | 3) => {
    if (target > step) {
      const err = validateStep(step);
      if (err) {
        setStepError(err);
        return;
      }
    }
    setStepError(null);
    setStep(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err1 = validateStep(1);
    if (err1) {
      setStep(1);
      setStepError(err1);
      return;
    }
    const err2 = validateStep(2);
    if (err2) {
      setStep(2);
      setStepError(err2);
      return;
    }
    const err3 = validateStep(3);
    if (err3) {
      setStep(3);
      setStepError(err3);
      return;
    }

    setStepError(null);
    setSubmitting(true);
    try {
      const cleanIngredients = validIngredients.map((i) => ({
        name: i.name.trim(),
        amount: Number(i.amount) || 1,
        unit: i.unit.trim(),
      }));
      const cleanSteps = validSteps.map((s, idx) => ({
        order: idx + 1,
        instruction: s.instruction.trim(),
        timerMinutes: s.timerMinutes && s.timerMinutes > 0 ? Math.round(s.timerMinutes) : undefined,
      }));

      const resolvedSubtitle =
        subtitle.trim().length >= 3 ? subtitle.trim() : description.trim().slice(0, 80);

      const res = await apiRequest<{message: string}>('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          subtitle: resolvedSubtitle,
          description: description.trim(),
          imageUrl,
          imageDataUrl: imageDataUrl || undefined,
          category,
          region: region.trim(),
          season,
          mealType,
          dietTags,
          prepMinutes: Math.max(1, Math.min(600, Number(prepMinutes) || 15)),
          cookMinutes: Math.max(1, Math.min(600, Number(cookMinutes) || 30)),
          servings: Math.max(1, Math.min(30, Number(servings) || 4)),
          difficulty,
          parentRecipeId: parentRecipe?.id || null,
          variationNote: parentRecipe ? variationNote.trim() || 'روش پخت جایگزین ثبت‌شده توسط کاربر' : null,
          ingredients: cleanIngredients,
          steps: cleanSteps,
          tools,
        }),
      });
      onNotify(res.message);
      onSubmitted();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطا در ثبت دستور پخت';
      setStepError(message);
      onNotify(message);
    } finally {
      setSubmitting(false);
    }
  };

  const stepMeta: {id: 1 | 2 | 3; label: string; shortLabel: string; done: boolean}[] = [
    {id: 1, label: 'معرفی غذا', shortLabel: 'معرفی', done: step1Complete},
    {id: 2, label: 'مواد اولیه', shortLabel: 'مواد اولیه', done: step2Complete},
    {id: 3, label: 'مراحل پخت', shortLabel: 'مراحل پخت', done: step3Complete},
  ];

  const adjustMetric = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    delta: number,
    min: number,
    max: number
  ) => {
    setter((prev) => Math.max(min, Math.min(max, (Number(prev) || min) + delta)));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{opacity: 0}}
          animate={{opacity: 1}}
          exit={{opacity: 0}}
          transition={{duration: 0.18}}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) onClose();
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm sm:p-5"
        >
          <motion.div
            initial={{opacity: 0, y: 36, scale: 0.985}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: 28, scale: 0.985}}
            transition={{type: 'spring', damping: 28, stiffness: 320}}
            className="w-full sm:max-w-3xl lg:max-w-5xl h-[93dvh] sm:h-[88vh] sm:max-h-[820px] flex flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px] bg-[#FFFFFF] dark:bg-[#141413] text-[#0D0D0D] dark:text-[#FAFAFA] border-t sm:border border-[#E6E6E3] dark:border-[#282825] shadow-2xl"
          >
            {/* Mobile Sheet Drag Handle */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0">
              <div className="w-10 h-1 rounded-full bg-[#D8D8D4] dark:bg-[#32322F]" aria-hidden="true" />
            </div>

            {/* Editorial Studio Header */}
            <header className="shrink-0 px-5 sm:px-7 pt-2 sm:pt-5 pb-4 border-b border-[#E6E6E3] dark:border-[#262623] bg-[#FFFFFF] dark:bg-[#141413]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#6B6B66] dark:text-[#9A9A94] tabular-nums">
                    <span>گام {toFaDigits(step)} از ۳</span>
                    <span aria-hidden="true">·</span>
                    <span>{parentRecipe ? 'نسخه جایگزین' : 'استودیو ثبت دستور پخت'}</span>
                  </div>
                  <h2
                    id={titleId}
                    className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA] truncate mt-0.5"
                  >
                    {parentRecipe ? `روش جایگزین «${parentRecipe.title}»` : 'ثبت دستور پخت در لاقلی'}
                  </h2>
                </div>

                <button
                  type="button"
                  aria-label="بستن پنجره ثبت دستور پخت"
                  disabled={submitting}
                  onClick={onClose}
                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-full border border-[#E6E6E3] dark:border-[#2A2A27] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#F3F3F0] dark:hover:bg-[#20201E] active:scale-95 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Stepper Control */}
              <div className="mt-4 grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#F3F3F0] dark:bg-[#1D1D1B] border border-[#E8E8E4] dark:border-[#272724]">
                {stepMeta.map((s) => {
                  const active = step === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleJumpStep(s.id)}
                      className={`relative min-h-[42px] px-2 sm:px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap ${
                        active
                          ? 'text-[#FFFFFF] dark:text-[#0D0D0D]'
                          : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="submitStepActivePill"
                          transition={{type: 'spring', stiffness: 420, damping: 32}}
                          className="absolute inset-0 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] shadow-xs"
                        />
                      )}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums transition-colors ${
                            active
                              ? 'bg-[#B54B1F] text-white dark:bg-[#B54B1F] dark:text-white'
                              : s.done
                                ? 'bg-[#0D0D0D]/12 dark:bg-white/15 text-[#0D0D0D] dark:text-[#FAFAFA]'
                                : 'bg-[#E5E5E0] dark:bg-[#2B2B28] text-[#5C5C58] dark:text-[#9A9A94]'
                          }`}
                        >
                          {s.done && !active ? <Check className="w-3 h-3 stroke-[2.5]" /> : toFaDigits(s.id)}
                        </span>
                        <span className="hidden sm:inline">{s.label}</span>
                        <span className="sm:hidden">{s.shortLabel}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </header>

            {/* Continuous Hairline Progress Track */}
            <div className="h-[2px] w-full bg-[#EFEFED] dark:bg-[#222220] shrink-0 overflow-hidden">
              <motion.div
                className="h-full bg-[#B54B1F] dark:bg-[#E29A6F] origin-right"
                initial={false}
                animate={{scaleX: step / 3}}
                transition={{duration: 0.28, ease: [0.16, 1, 0.3, 1]}}
              />
            </div>

            {/* Body: Responsive 2-Column Studio on Desktop, Single Focused Canvas on Mobile */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
              {/* Primary Form Canvas */}
              <form
                id="lagheli-submit-recipe-form"
                onSubmit={handleSubmit}
                noValidate
                className="flex-1 min-h-0 flex flex-col overflow-hidden"
              >
                <div
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-7 py-5 sm:py-6"
                >
                  {/* Inline Validation Banner */}
                  <AnimatePresence initial={false}>
                    {stepError && (
                      <motion.div
                        initial={{opacity: 0, y: -8}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: -6}}
                        className="mb-5 rounded-2xl border border-[#B54B1F]/30 dark:border-[#E29A6F]/35 bg-[#B54B1F]/[0.06] dark:bg-[#E29A6F]/[0.09] px-4 py-3 flex items-start gap-2.5 text-xs leading-6 text-[#8E3510] dark:text-[#F0B896]"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0 mt-1" />
                        <span>{stepError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence mode="wait" initial={false}>
                    {/* =========================================================
                        STEP 1: EDITORIAL IDENTITY & METADATA
                    ========================================================= */}
                    {step === 1 && (
                      <motion.div
                        key="step-1"
                        initial={{opacity: 0, x: 14}}
                        animate={{opacity: 1, x: 0}}
                        exit={{opacity: 0, x: -14}}
                        transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
                        className="space-y-6 pb-4"
                      >
                        {/* Cover Image Editorial Dropzone */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                              تصویر واقعی غذا
                            </span>
                            <span className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94]">
                              اختیاری · فشرده‌سازی خودکار
                            </span>
                          </div>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            onChange={(e) => {
                              void handleImageFile(e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />

                          {previewImage ? (
                            <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F3F3F0] dark:bg-[#1C1C1A]">
                              <img
                                src={previewImage}
                                alt="پیش‌نمایش تصویر دستور پخت"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="min-h-[38px] px-3.5 rounded-xl bg-white/95 text-[#0D0D0D] text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm hover:bg-white transition-colors"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>تغییر تصویر</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setImageDataUrl('');
                                    setImageUrl('');
                                  }}
                                  className="min-h-[38px] px-3 rounded-xl bg-black/60 text-white backdrop-blur-sm text-xs font-medium inline-flex items-center gap-1.5 hover:bg-black/80 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setIsDraggingImage(true);
                              }}
                              onDragLeave={() => setIsDraggingImage(false)}
                              onDrop={(e) => {
                                e.preventDefault();
                                setIsDraggingImage(false);
                                void handleImageFile(e.dataTransfer.files?.[0]);
                              }}
                              className={`w-full py-6 px-4 rounded-2xl border border-dashed transition-all flex flex-col items-center justify-center text-center gap-2.5 ${
                                isDraggingImage
                                  ? 'border-[#B54B1F] bg-[#B54B1F]/[0.05] dark:border-[#E29A6F] dark:bg-[#E29A6F]/[0.08]'
                                  : 'border-[#D4D4CE] dark:border-[#32322E] bg-[#F8F8F6] dark:bg-[#191917] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA]'
                              }`}
                            >
                              <div className="w-11 h-11 rounded-2xl bg-[#FFFFFF] dark:bg-[#232320] border border-[#E6E6E3] dark:border-[#2F2F2B] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA]">
                                <ImagePlus className="w-5 h-5" />
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                                  آپلود عکس واقعی از گوشی یا سیستم
                                </p>
                                <p className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94] max-w-sm">
                                  اگر فعلاً عکسی ندارید، اشکالی ندارد — کاربران پس از پخت عکس واقعی ثبت می‌کنند.
                                </p>
                              </div>
                            </button>
                          )}
                        </div>

                        {/* Title + Subtitle + Description */}
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="recipe-title-input"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                عنوان دستور پخت <span className="text-[#B54B1F] dark:text-[#E29A6F]">*</span>
                              </label>
                              <span className="text-[11px] text-[#7A7A75] dark:text-[#8E8E88] tabular-nums">
                                {toFaDigits(title.trim().length)} / ۱۲۰
                              </span>
                            </div>
                            <input
                              id="recipe-title-input"
                              type="text"
                              maxLength={120}
                              placeholder="مثلاً: عدس‌پلوی مجلسی با کشمش و پیازداغ"
                              value={title}
                              onChange={(e) => {
                                setTitle(e.target.value);
                                if (stepError) setStepError(null);
                              }}
                              className="w-full min-h-[48px] rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] px-4 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86] dark:placeholder:text-[#73736D] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="recipe-subtitle-input"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                زیرعنوان ادیتوریال
                              </label>
                              <span className="text-[11px] text-[#7A7A75] dark:text-[#8E8E88]">اختیاری</span>
                            </div>
                            <input
                              id="recipe-subtitle-input"
                              type="text"
                              maxLength={180}
                              placeholder="یک جمله کوتاه درباره عطر، بافت یا راز این غذا"
                              value={subtitle}
                              onChange={(e) => setSubtitle(e.target.value)}
                              className="w-full min-h-[46px] rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] px-4 text-sm text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86] dark:placeholder:text-[#73736D] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                            />
                          </div>

                          {parentRecipe && (
                            <div className="space-y-1.5">
                              <label
                                htmlFor="recipe-variation-input"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                تفاوت این روش جایگزین با دستور اصلی{' '}
                                <span className="text-[#B54B1F] dark:text-[#E29A6F]">*</span>
                              </label>
                              <input
                                id="recipe-variation-input"
                                type="text"
                                maxLength={300}
                                placeholder="مثلاً: بدون گوشت و با قارچ مزه‌دارشده در فر"
                                value={variationNote}
                                onChange={(e) => {
                                  setVariationNote(e.target.value);
                                  if (stepError) setStepError(null);
                                }}
                                className="w-full min-h-[46px] rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] px-4 text-sm text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86] dark:placeholder:text-[#73736D] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                              />
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label
                                htmlFor="recipe-desc-input"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                معرفی و نکات کلیدی سرو <span className="text-[#B54B1F] dark:text-[#E29A6F]">*</span>
                              </label>
                              <span
                                className={`text-[11px] tabular-nums ${
                                  description.trim().length > 0 && description.trim().length < 10
                                    ? 'text-[#B54B1F] dark:text-[#E29A6F] font-semibold'
                                    : 'text-[#7A7A75] dark:text-[#8E8E88]'
                                }`}
                              >
                                {toFaDigits(description.trim().length)} / ۱۰۰۰
                              </span>
                            </div>
                            <textarea
                              id="recipe-desc-input"
                              rows={3}
                              maxLength={1000}
                              placeholder="درباره طعم، زمان مناسب سرو و نکته طلایی این غذا بنویسید..."
                              value={description}
                              onChange={(e) => {
                                setDescription(e.target.value);
                                if (stepError) setStepError(null);
                              }}
                              className="w-full rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] p-4 text-sm leading-7 text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86] dark:placeholder:text-[#73736D] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors resize-none"
                            />
                          </div>
                        </div>

                        {/* Hairline Divider */}
                        <hr className="border-[#ECECE8] dark:border-[#242421]" />

                        {/* Category & Difficulty (Tactile Segmented Controls) */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] block">
                              دسته‌بندی اصلی
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {CATEGORIES.map((cat) => {
                                const selected = category === cat;
                                return (
                                  <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`min-h-[40px] px-3.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                                      selected
                                        ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                        : 'bg-[#F3F3F0] dark:bg-[#1E1E1C] text-[#4E4E4A] dark:text-[#A8A8A2] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                                    }`}
                                  >
                                    {cat}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] block">
                              سطح مهارت پخت
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                              {DIFFICULTIES.map((level) => {
                                const selected = difficulty === level;
                                return (
                                  <button
                                    key={level}
                                    type="button"
                                    onClick={() => setDifficulty(level)}
                                    className={`min-h-[44px] rounded-xl border text-xs font-semibold transition-all ${
                                      selected
                                        ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                        : 'border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] text-[#5C5C58] dark:text-[#A3A39E] hover:border-[#0D0D0D]/40 dark:hover:border-[#FAFAFA]/40'
                                    }`}
                                  >
                                    {level}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Region, Season, Meal Type */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <label
                                htmlFor="recipe-region-input"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                اصالت یا شهر
                              </label>
                              <input
                                id="recipe-region-input"
                                type="text"
                                list="lagheli-regions-list"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                placeholder="مثلاً: گیلان"
                                className="w-full min-h-[46px] rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] px-3.5 text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                              />
                              <datalist id="lagheli-regions-list">
                                {POPULAR_REGIONS.map((r) => (
                                  <option key={r} value={r} />
                                ))}
                              </datalist>
                            </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="recipe-season-select"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                فصل پیشنهادی
                              </label>
                              <div className="relative">
                                <select
                                  id="recipe-season-select"
                                  value={season}
                                  onChange={(e) => setSeason(e.target.value)}
                                  className="w-full min-h-[46px] appearance-none rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] pr-3.5 pl-9 text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                                >
                                  {SEASONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-[#6B6B66] dark:text-[#9A9A94] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label
                                htmlFor="recipe-meal-select"
                                className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]"
                              >
                                وعده سرو
                              </label>
                              <div className="relative">
                                <select
                                  id="recipe-meal-select"
                                  value={mealType}
                                  onChange={(e) => setMealType(e.target.value)}
                                  className="w-full min-h-[46px] appearance-none rounded-2xl border border-[#E2E2DE] dark:border-[#2C2C28] bg-[#F8F8F6] dark:bg-[#1B1B19] pr-3.5 pl-9 text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA] focus:bg-[#FFFFFF] dark:focus:bg-[#141413] focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA] transition-colors"
                                >
                                  {MEAL_TYPES.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-[#6B6B66] dark:text-[#9A9A94] pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Precision Time & Servings Steppers */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">زمان‌بندی و تعداد نفرات</span>
                            <span className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94] tabular-nums">
                              مجموع {toFaDigits(totalMinutes)} دقیقه · مناسب {toFaDigits(servings)} نفر
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {[
                              {
                                label: 'آماده‌سازی',
                                unit: 'دقیقه',
                                value: prepMinutes,
                                onMinus: () => adjustMetric(setPrepMinutes, -5, 1, 600),
                                onPlus: () => adjustMetric(setPrepMinutes, 5, 1, 600),
                                onInput: (v: number) => setPrepMinutes(Math.max(1, Math.min(600, v || 1))),
                              },
                              {
                                label: 'زمان پخت',
                                unit: 'دقیقه',
                                value: cookMinutes,
                                onMinus: () => adjustMetric(setCookMinutes, -5, 1, 600),
                                onPlus: () => adjustMetric(setCookMinutes, 5, 1, 600),
                                onInput: (v: number) => setCookMinutes(Math.max(1, Math.min(600, v || 1))),
                              },
                              {
                                label: 'تعداد نفرات',
                                unit: 'نفر',
                                value: servings,
                                onMinus: () => adjustMetric(setServings, -1, 1, 30),
                                onPlus: () => adjustMetric(setServings, 1, 1, 30),
                                onInput: (v: number) => setServings(Math.max(1, Math.min(30, v || 1))),
                              },
                            ].map((metric) => (
                              <div
                                key={metric.label}
                                className="rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F8F8F6] dark:bg-[#1B1B19] p-3 flex sm:flex-col items-center sm:items-stretch justify-between gap-2"
                              >
                                <span className="text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">
                                  {metric.label}
                                </span>
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    aria-label={`کاهش ${metric.label}`}
                                    onClick={metric.onMinus}
                                    className="w-9 h-9 rounded-xl bg-[#FFFFFF] dark:bg-[#252522] border border-[#E2E2DE] dark:border-[#32322E] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] active:scale-95 transition-transform"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="flex items-baseline gap-1 tabular-nums">
                                    <input
                                      type="number"
                                      min={1}
                                      value={metric.value}
                                      onChange={(e) => metric.onInput(Number(e.target.value))}
                                      aria-label={metric.label}
                                      className="w-12 text-center bg-transparent text-sm font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] focus:outline-none"
                                    />
                                    <span className="text-[11px] text-[#7A7A75] dark:text-[#8E8E88]">
                                      {metric.unit}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    aria-label={`افزایش ${metric.label}`}
                                    onClick={metric.onPlus}
                                    className="w-9 h-9 rounded-xl bg-[#FFFFFF] dark:bg-[#252522] border border-[#E2E2DE] dark:border-[#32322E] flex items-center justify-center text-[#0D0D0D] dark:text-[#FAFAFA] active:scale-95 transition-transform"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Dietary Tags */}
                        <div className="space-y-2">
                          <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] block">
                            سبک تغذیه و ویژگی‌ها
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {DIET_OPTIONS.map((tag) => {
                              const active = dietTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleDiet(tag)}
                                  className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium border transition-all ${
                                    active
                                      ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                      : 'border-[#E2E2DE] dark:border-[#2C2C28] bg-transparent text-[#5C5C58] dark:text-[#A3A39E] hover:border-[#0D0D0D]/40 dark:hover:border-[#FAFAFA]/40'
                                  }`}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* =========================================================
                        STEP 2: INGREDIENTS COMPOSER
                    ========================================================= */}
                    {step === 2 && (
                      <motion.div
                        key="step-2"
                        initial={{opacity: 0, x: 14}}
                        animate={{opacity: 1, x: 0}}
                        exit={{opacity: 0, x: -14}}
                        transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
                        className="space-y-5 pb-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                              فهرست مواد اولیه ({toFaDigits(servings)} نفر)
                            </h3>
                            <p className="text-xs text-[#6B6B66] dark:text-[#9A9A94] mt-0.5 tabular-nums">
                              {toFaDigits(validIngredients.length)} ماده کامل ثبت شده · حداقل ۲ ماده ضروری است
                            </p>
                          </div>
                        </div>

                        <datalist id="lagheli-units-list">
                          {COMMON_UNITS.map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>

                        <div className="space-y-3">
                          {ingredients.map((ing, idx) => (
                            <div
                              key={ing.id}
                              className="rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F8F8F6] dark:bg-[#1A1A18] p-3.5 space-y-2.5"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#EAEAE6] dark:bg-[#262623] text-[11px] font-bold text-[#5C5C58] dark:text-[#A3A39E] flex items-center justify-center shrink-0 tabular-nums">
                                  {toFaDigits(idx + 1)}
                                </span>
                                <input
                                  type="text"
                                  placeholder="نام ماده اولیه (مثلاً: برنج ایرانی)"
                                  value={ing.name}
                                  onChange={(e) => {
                                    setIngredients((prev) =>
                                      prev.map((r) => (r.id === ing.id ? {...r, name: e.target.value} : r))
                                    );
                                    if (stepError) setStepError(null);
                                  }}
                                  className="flex-1 min-h-[44px] rounded-xl border border-[#E2E2DE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] px-3.5 text-sm font-medium text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86]"
                                />
                                <button
                                  type="button"
                                  aria-label={`حذف ماده ${idx + 1}`}
                                  disabled={ingredients.length <= 2}
                                  onClick={() => setIngredients((prev) => prev.filter((r) => r.id !== ing.id))}
                                  className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl flex items-center justify-center text-[#6B6B66] dark:text-[#9A9A94] hover:bg-[#EFEFED] dark:hover:bg-[#252522] hover:text-[#B54B1F] disabled:opacity-25 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-12 gap-2 ps-8">
                                <div className="col-span-5 sm:col-span-4">
                                  <label className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94] block mb-1">
                                    مقدار
                                  </label>
                                  <input
                                    type="number"
                                    step="0.5"
                                    min={0.25}
                                    value={ing.amount}
                                    onChange={(e) =>
                                      setIngredients((prev) =>
                                        prev.map((r) =>
                                          r.id === ing.id ? {...r, amount: Math.max(0.25, Number(e.target.value) || 0.5)} : r
                                        )
                                      )
                                    }
                                    className="w-full min-h-[42px] rounded-xl border border-[#E2E2DE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] px-3 text-sm font-semibold tabular-nums text-[#0D0D0D] dark:text-[#FAFAFA]"
                                  />
                                </div>
                                <div className="col-span-7 sm:col-span-8">
                                  <label className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94] block mb-1">
                                    واحد اندازه‌گیری
                                  </label>
                                  <input
                                    type="text"
                                    list="lagheli-units-list"
                                    placeholder="پیمانه، گرم، قاشق..."
                                    value={ing.unit}
                                    onChange={(e) =>
                                      setIngredients((prev) =>
                                        prev.map((r) => (r.id === ing.id ? {...r, unit: e.target.value} : r))
                                      )
                                    }
                                    className="w-full min-h-[42px] rounded-xl border border-[#E2E2DE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] px-3 text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA]"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setIngredients((prev) => [
                              ...prev,
                              {id: nextDraftId('ing'), name: '', amount: 1, unit: 'قاشق غذاخوری'},
                            ])
                          }
                          className="w-full min-h-[48px] rounded-2xl border border-dashed border-[#CFCFC9] dark:border-[#343430] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>افزودن ردیف ماده اولیه جدید</span>
                        </button>

                        {/* Quick-Add Common Persian Staples */}
                        <div className="pt-2 space-y-2">
                          <span className="text-[11px] font-semibold text-[#6B6B66] dark:text-[#9A9A94] block">
                            افزودن سریع چاشنی‌ها و پایه‌های پرکاربرد:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {QUICK_STAPLES.map((st) => {
                              const alreadyAdded = ingredients.some((i) => i.name.trim() === st.name);
                              return (
                                <button
                                  key={st.name}
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => handleAddStaple(st)}
                                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium inline-flex items-center gap-1 transition-colors ${
                                    alreadyAdded
                                      ? 'bg-[#EFEFED] dark:bg-[#1F1F1D] text-[#9A9A94] dark:text-[#5C5C58] cursor-default'
                                      : 'bg-[#F3F3F0] dark:bg-[#1E1E1C] text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#E7E7E2] dark:hover:bg-[#292926]'
                                  }`}
                                >
                                  {alreadyAdded ? (
                                    <Check className="w-3 h-3" />
                                  ) : (
                                    <Plus className="w-3 h-3 text-[#B54B1F] dark:text-[#E29A6F]" />
                                  )}
                                  <span>{st.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* =========================================================
                        STEP 3: EDITORIAL COOKING CHAPTERS & TOOLS
                    ========================================================= */}
                    {step === 3 && (
                      <motion.div
                        key="step-3"
                        initial={{opacity: 0, x: 14}}
                        animate={{opacity: 1, x: 0}}
                        exit={{opacity: 0, x: -14}}
                        transition={{duration: 0.18, ease: [0.16, 1, 0.3, 1]}}
                        className="space-y-5 pb-4"
                      >
                        <div>
                          <h3 className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                            مراحل گام‌به‌گام پخت
                          </h3>
                          <p className="text-xs text-[#6B6B66] dark:text-[#9A9A94] mt-0.5">
                            برای مراحلی که زمان دقیق دارند، تایمر تنظیم کنید تا در «حالت آشپزی» خودکار اجرا شود.
                          </p>
                        </div>

                        <div className="space-y-3.5">
                          {steps.map((st, idx) => (
                            <div
                              key={st.id}
                              className="rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F8F8F6] dark:bg-[#1A1A18] p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-black tracking-tight tabular-nums text-[#0D0D0D] dark:text-[#FAFAFA]">
                                    {toFaDigits(String(idx + 1).padStart(2, '0'))}
                                  </span>
                                  <span className="text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E]">
                                    مرحله {toFaDigits(idx + 1)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1">
                                  {steps.length > 1 && (
                                    <>
                                      <button
                                        type="button"
                                        aria-label="انتقال مرحله به بالا"
                                        disabled={idx === 0}
                                        onClick={() => moveStep(idx, -1)}
                                        className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E] hover:bg-[#EAEAE6] dark:hover:bg-[#262623] disabled:opacity-25"
                                      >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label="انتقال مرحله به پایین"
                                        disabled={idx === steps.length - 1}
                                        onClick={() => moveStep(idx, 1)}
                                        className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#5C5C58] dark:text-[#A3A39E] hover:bg-[#EAEAE6] dark:hover:bg-[#262623] disabled:opacity-25"
                                      >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        aria-label={`حذف مرحله ${idx + 1}`}
                                        onClick={() => setSteps((prev) => prev.filter((r) => r.id !== st.id))}
                                        className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-[#6B6B66] hover:text-[#B54B1F] hover:bg-[#EAEAE6] dark:hover:bg-[#262623]"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <textarea
                                rows={3}
                                maxLength={500}
                                placeholder="شرح دقیق این مرحله از پخت، حرارت شعله و نشانه آماده شدن..."
                                value={st.instruction}
                                onChange={(e) => {
                                  setSteps((prev) =>
                                    prev.map((r) => (r.id === st.id ? {...r, instruction: e.target.value} : r))
                                  );
                                  if (stepError) setStepError(null);
                                }}
                                className="w-full rounded-xl border border-[#E2E2DE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] p-3.5 text-sm leading-7 text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8C8C86] resize-none"
                              />

                              {/* Optional Smart Timer Row */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B6B66] dark:text-[#9A9A94] ml-1">
                                    <Timer className="w-3.5 h-3.5" />
                                    <span>تایمر:</span>
                                  </span>
                                  {TIMER_PRESETS.map((min) => {
                                    const selected = st.timerMinutes === min;
                                    return (
                                      <button
                                        key={min}
                                        type="button"
                                        onClick={() =>
                                          setSteps((prev) =>
                                            prev.map((r) =>
                                              r.id === st.id
                                                ? {...r, timerMinutes: selected ? undefined : min}
                                                : r
                                            )
                                          )
                                        }
                                        className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold tabular-nums transition-colors ${
                                          selected
                                            ? 'bg-[#0D0D0D] text-white dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                            : 'bg-[#FFFFFF] dark:bg-[#232320] border border-[#E2E2DE] dark:border-[#2E2E2A] text-[#5C5C58] dark:text-[#A3A39E]'
                                        }`}
                                      >
                                        {toFaDigits(min)} دقیقه
                                      </button>
                                    );
                                  })}
                                </div>

                                <input
                                  type="number"
                                  min={1}
                                  max={300}
                                  placeholder="دلخواه (دقیقه)"
                                  value={st.timerMinutes ?? ''}
                                  onChange={(e) =>
                                    setSteps((prev) =>
                                      prev.map((r) =>
                                        r.id === st.id
                                          ? {
                                              ...r,
                                              timerMinutes: e.target.value
                                                ? Math.min(300, Math.max(1, Number(e.target.value)))
                                                : undefined,
                                            }
                                          : r
                                      )
                                    )
                                  }
                                  className="w-28 min-h-[34px] rounded-lg border border-[#E2E2DE] dark:border-[#2E2E2A] bg-[#FFFFFF] dark:bg-[#141413] px-2.5 text-xs tabular-nums text-[#0D0D0D] dark:text-[#FAFAFA]"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setSteps((prev) => [...prev, {id: nextDraftId('stp'), instruction: ''}])
                          }
                          className="w-full min-h-[48px] rounded-2xl border border-dashed border-[#CFCFC9] dark:border-[#343430] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA] flex items-center justify-center gap-2 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>افزودن مرحله جدید</span>
                        </button>

                        {/* Optional Kitchen Tools */}
                        <div className="pt-2 space-y-2 border-t border-[#ECECE8] dark:border-[#242421]">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                              ابزارهای مورد نیاز
                            </span>
                            <span className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94]">اختیاری</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {KITCHEN_TOOLS.map((tool) => {
                              const active = tools.includes(tool);
                              return (
                                <button
                                  key={tool}
                                  type="button"
                                  onClick={() => toggleTool(tool)}
                                  className={`min-h-[36px] px-3 rounded-xl text-xs font-medium border transition-colors ${
                                    active
                                      ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#FAFAFA] dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                      : 'border-[#E2E2DE] dark:border-[#2C2C28] text-[#5C5C58] dark:text-[#A3A39E]'
                                  }`}
                                >
                                  {tool}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Compact Mobile Review Strip (visible < lg) */}
                        <div className="lg:hidden rounded-2xl border border-[#E6E6E3] dark:border-[#2A2A27] bg-[#F6F6F5] dark:bg-[#191917] p-4 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] text-[#6B6B66] dark:text-[#9A9A94]">
                            <span>خلاصه پیش از انتشار</span>
                            <span className="font-bold text-[#B54B1F] dark:text-[#E29A6F]">+۲۰ جِم پاداش</span>
                          </div>
                          <p className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA] truncate">
                            {title.trim() || 'بدون عنوان'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                            <span>{category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{toFaDigits(totalMinutes)} دقیقه</span>
                            <span aria-hidden="true">·</span>
                            <span>{toFaDigits(validIngredients.length)} ماده اولیه</span>
                            <span aria-hidden="true">·</span>
                            <span>{toFaDigits(validSteps.length)} مرحله</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Sticky Thumb-Zone Action Footer */}
                <footer className="shrink-0 px-5 sm:px-7 py-3.5 pb-safe border-t border-[#E6E6E3] dark:border-[#262623] bg-[#FFFFFF]/95 dark:bg-[#141413]/95 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-3">
                    {step > 1 ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          setStepError(null);
                          setStep((s) => (s - 1) as 1 | 2 | 3);
                        }}
                        className="min-h-[48px] px-4 sm:px-5 rounded-2xl border border-[#E2E2DE] dark:border-[#2E2E2A] text-xs sm:text-sm font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#F3F3F0] dark:hover:bg-[#1E1E1C] inline-flex items-center gap-1.5 active:scale-[0.98] transition-all whitespace-nowrap"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>مرحله قبل</span>
                      </button>
                    ) : (
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#6B6B66] dark:text-[#9A9A94]">
                        <Sparkles className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                        <span>با انتشار هر دستور +۲۰ جِم می‌گیرید</span>
                      </div>
                    )}

                    {step < 3 ? (
                      <button
                        type="button"
                        onClick={handleNextStep}
                        className={`${
                          step === 1 ? 'w-full sm:w-auto' : 'flex-1 sm:flex-none'
                        } min-h-[48px] px-6 rounded-2xl bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0D0D0D] hover:bg-[#222220] dark:hover:bg-[#E8E8E4] text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-all whitespace-nowrap`}
                      >
                        <span>{step === 1 ? 'ادامه: مواد اولیه' : 'ادامه: مراحل پخت'}</span>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 sm:flex-none min-h-[48px] px-6 rounded-2xl bg-[#B54B1F] hover:bg-[#963B15] text-[#FFFFFF] dark:bg-[#E29A6F] dark:hover:bg-[#ECA982] dark:text-[#0D0D0D] text-sm font-bold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-45 whitespace-nowrap"
                      >
                        <span>{submitting ? 'در حال ثبت...' : 'انتشار دستور پخت (+۲۰ جِم)'}</span>
                      </button>
                    )}
                  </div>
                </footer>
              </form>

              {/* Desktop Live Editorial Preview Column */}
              <aside className="hidden lg:flex w-[340px] xl:w-[360px] shrink-0 flex-col justify-between border-r border-[#E6E6E3] dark:border-[#262623] bg-[#F6F6F5] dark:bg-[#10100F] p-6 overflow-y-auto">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                      پیش‌نمایش زنده مجله لاقلی
                    </span>
                    <span className="text-[11px] text-[#6B6B66] dark:text-[#9A9A94] tabular-nums">
                      {toFaDigits(
                        [step1Complete, step2Complete, step3Complete].filter(Boolean).length
                      )}{' '}
                      از ۳ آماده
                    </span>
                  </div>

                  {/* Live Magazine Card Preview */}
                  <article className="rounded-3xl overflow-hidden bg-[#FFFFFF] dark:bg-[#171715] border border-[#E6E6E3] dark:border-[#262623]">
                    <div className="aspect-[4/3] w-full bg-[#ECECE8] dark:bg-[#1F1F1C] relative overflow-hidden flex items-center justify-center">
                      {previewImage ? (
                        <img
                          src={previewImage}
                          alt={title || 'پیش‌نمایش کارت دستور پخت'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-[#8C8C86] dark:text-[#666660] px-6 text-center">
                          <UtensilsCrossed className="w-7 h-7 stroke-[1.5]" />
                          <span className="text-[11px]">
                            بدون عکس هم قابل انتشار است
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#6B6B66] dark:text-[#9A9A94] truncate">
                        <span>{category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{region.trim() || 'ایران'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{season}</span>
                      </div>

                      <h3 className="text-base font-extrabold leading-snug text-[#0D0D0D] dark:text-[#FAFAFA] line-clamp-2">
                        {title.trim() || 'عنوان دستور پخت شما اینجا دیده می‌شود'}
                      </h3>

                      <p className="text-xs leading-6 text-[#5C5C58] dark:text-[#A3A39E] line-clamp-2">
                        {subtitle.trim() ||
                          description.trim() ||
                          'خلاصه ادیتوریال و طعم غذای شما پس از نوشتن در کارت نمایش داده می‌شود.'}
                      </p>

                      <div className="pt-2.5 border-t border-[#EFEFED] dark:border-[#242421] flex items-center justify-between text-[11px] font-medium text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {toFaDigits(totalMinutes)} دقیقه
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {toFaDigits(servings)} نفر
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          {difficulty}
                        </span>
                      </div>
                    </div>
                  </article>

                  {/* Clean Readiness Checklist */}
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-semibold text-[#6B6B66] dark:text-[#9A9A94]">
                      وضعیت تکمیل دستور پخت
                    </p>
                    <ul className="space-y-2 text-xs">
                      {[
                        {label: 'عنوان و توضیح کوتاه غذا', ok: step1Complete},
                        {
                          label: `حداقل ۲ ماده اولیه (${toFaDigits(validIngredients.length)} مورد)`,
                          ok: step2Complete,
                        },
                        {
                          label: `حداقل ۱ مرحله پخت (${toFaDigits(validSteps.length)} مرحله)`,
                          ok: step3Complete,
                        },
                      ].map((item) => (
                        <li key={item.label} className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                              item.ok
                                ? 'bg-[#0D0D0D] text-white dark:bg-[#FAFAFA] dark:text-[#0D0D0D]'
                                : 'border border-[#CFCFC9] dark:border-[#3A3A36]'
                            }`}
                          >
                            {item.ok && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span
                            className={
                              item.ok
                                ? 'text-[#0D0D0D] dark:text-[#FAFAFA] font-medium'
                                : 'text-[#6B6B66] dark:text-[#8E8E88]'
                            }
                          >
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-[#E6E6E3] dark:border-[#262623] text-[11px] leading-5 text-[#6B6B66] dark:text-[#9A9A94]">
                  دستور پخت شما پس از ثبت با نام خودتان در مجله لاقلی منتشر می‌شود و{' '}
                  <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">۴۰ امتیاز تجربه و ۲۰ جِم</strong> به
                  حساب‌تان اضافه خواهد شد.
                </div>
              </aside>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
