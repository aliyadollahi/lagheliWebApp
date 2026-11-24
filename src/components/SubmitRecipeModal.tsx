import {useState} from 'react';
import {Camera, Plus, Trash2, X} from 'lucide-react';
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

export function SubmitRecipeModal({
  open,
  parentRecipe,
  onClose,
  onSubmitted,
  onNotify,
}: SubmitRecipeModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState(parentRecipe ? `${parentRecipe.title} (نسخه جایگزین)` : '');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [variationNote, setVariationNote] = useState('');
  const [imageUrl, setImageUrl] = useState(parentRecipe?.imageUrl || '');
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [category, setCategory] = useState(parentRecipe?.category || 'ناهار و شام');
  const [region, setRegion] = useState(parentRecipe?.region || 'تهران');
  const [season, setSeason] = useState('چهارفصل');
  const [mealType, setMealType] = useState('ناهار');
  const [difficulty, setDifficulty] = useState<'آسان' | 'متوسط' | 'حرفه‌ای'>('متوسط');
  const [prepMinutes, setPrepMinutes] = useState(20);
  const [cookMinutes, setCookMinutes] = useState(40);
  const [servings, setServings] = useState(4);
  const [dietTags, setDietTags] = useState<string[]>(['سنتی']);

  const [ingredients, setIngredients] = useState<{name: string; amount: number; unit: string}[]>([
    {name: 'پیاز', amount: 1, unit: 'عدد'},
    {name: 'زعفران دم‌کرده', amount: 2, unit: 'قاشق غذاخوری'},
  ]);
  const [steps, setSteps] = useState<{instruction: string; timerMinutes?: number}[]>([
    {instruction: '', timerMinutes: undefined},
  ]);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const toggleDiet = (d: string) => {
    setDietTags((prev) => (prev.includes(d) ? prev.filter((item) => item !== d) : [...prev, d]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const validIngredients = ingredients.filter((i) => i.name.trim());
      const validSteps = steps
        .filter((s) => s.instruction.trim().length >= 5)
        .map((s, idx) => ({order: idx + 1, instruction: s.instruction.trim(), timerMinutes: s.timerMinutes}));

      const res = await apiRequest<{message: string}>('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim() || description.trim().slice(0, 70),
          description: description.trim(),
          imageUrl,
          imageDataUrl: imageDataUrl || undefined,
          category,
          region,
          season,
          mealType,
          dietTags,
          prepMinutes: Number(prepMinutes) || 15,
          cookMinutes: Number(cookMinutes) || 30,
          servings: Number(servings) || 4,
          difficulty,
          parentRecipeId: parentRecipe?.id || null,
          variationNote: parentRecipe ? variationNote.trim() || 'روش پخت جایگزین ثبت‌شده توسط کاربر' : null,
          ingredients: validIngredients,
          steps: validSteps,
        }),
      });
      onNotify(res.message);
      onSubmitted();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت دستور پخت');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 sm:p-8 space-y-6 my-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
              گام {toFaDigits(step)} از ۳ · {parentRecipe ? 'ثبت روش جایگزین' : 'ثبت دستور پخت جدید'}
            </p>
            <h2 className="text-xl font-bold mt-0.5">
              {parentRecipe ? `نسخه جایگزین برای «${parentRecipe.title}»` : 'ثبت دستور پخت در لاقلی'}
            </h2>
          </div>
          <button
            type="button"
            aria-label="بستن"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {id: 1, label: '۱. معرفی غذا'},
            {id: 2, label: '۲. مواد اولیه'},
            {id: 3, label: '۳. مراحل پخت'},
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id as 1 | 2 | 3)}
              className={`min-h-[40px] rounded-xl text-xs font-medium transition-colors ${
                step === s.id
                  ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                  : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 1 && (
            <div className="space-y-4">
              <input
                type="text"
                required
                placeholder="عنوان دستور پخت (مثلاً عدس‌پلوی مجلسی با کشمش)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-sm"
              />
              <input
                type="text"
                placeholder="زیرعنوان کوتاه (یک جمله ادیتوریال درباره طعم و بافت)"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-sm"
              />
              {parentRecipe && (
                <input
                  type="text"
                  required
                  placeholder="تفاوت این روش جایگزین با دستور اصلی چیست؟"
                  value={variationNote}
                  onChange={(e) => setVariationNote(e.target.value)}
                  className="w-full min-h-[46px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-sm"
                />
              )}
              <textarea
                rows={3}
                required
                placeholder="توضیح کوتاه درباره غذا، نکات کلیدی و نحوه سرو..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3.5 text-sm"
              />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                >
                  <option value="ناهار و شام">ناهار و شام</option>
                  <option value="صبحانه">صبحانه</option>
                  <option value="پیش‌غذا و عصرانه">پیش‌غذا و عصرانه</option>
                  <option value="وگان و گیاهی">وگان و گیاهی</option>
                  <option value="پخت سریع">پخت سریع</option>
                </select>
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="منطقه"
                  className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                />
                <select
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                >
                  <option value="چهارفصل">چهارفصل</option>
                  <option value="بهار">بهار</option>
                  <option value="تابستان">تابستان</option>
                  <option value="پاییز">پاییز</option>
                  <option value="زمستان">زمستان</option>
                </select>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as 'آسان' | 'متوسط' | 'حرفه‌ای')}
                  className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                >
                  <option value="آسان">آسان</option>
                  <option value="متوسط">متوسط</option>
                  <option value="حرفه‌ای">حرفه‌ای</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-[#615E55]">آماده‌سازی (دقیقه)</label>
                  <input
                    type="number"
                    min={1}
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#615E55]">زمان پخت (دقیقه)</label>
                  <input
                    type="number"
                    min={1}
                    value={cookMinutes}
                    onChange={(e) => setCookMinutes(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#615E55]">تعداد نفرات</label>
                  <input
                    type="number"
                    min={1}
                    value={servings}
                    onChange={(e) => setServings(Number(e.target.value))}
                    className="mt-1 w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                  تصویر واقعی غذای پخته‌شده (اختیاری — اگر فعلاً عکسی ندارید، کاربران بعد از پخت عکس واقعی آن را ثبت می‌کنند)
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="min-h-[44px] px-4 rounded-xl border border-dashed border-[#B54B1F]/50 dark:border-[#E29A6F]/50 bg-[#F9F8F4] dark:bg-[#141412] text-xs font-medium inline-flex items-center gap-2 cursor-pointer hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]">
                    <Camera className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                    <span>{imageDataUrl ? 'تغییر عکس انتخاب‌شده' : 'آپلود عکس واقعی از گوشی یا سیستم'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const dataUrl = await fileToCompressedDataUrl(file);
                          setImageDataUrl(dataUrl);
                          setImageUrl('');
                        } catch (err) {
                          onNotify(err instanceof Error ? err.message : 'خطا در خواندن تصویر');
                        }
                      }}
                    />
                  </label>
                  {(imageDataUrl || imageUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setImageDataUrl('');
                        setImageUrl('');
                      }}
                      className="text-xs text-[#615E55] hover:text-red-600 min-h-[40px] px-2"
                    >
                      حذف تصویر
                    </button>
                  )}
                </div>
                {(imageDataUrl || imageUrl) && (
                  <img
                    src={imageDataUrl || imageUrl}
                    alt="پیش‌نمایش تصویر دستور"
                    className="w-40 h-28 object-cover rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27]"
                  />
                )}
              </div>

              <div>
                <p className="text-xs text-[#615E55] mb-2">برچسب‌های تغذیه‌ای</p>
                <div className="flex flex-wrap gap-1.5">
                  {['سنتی', 'گیاهی', 'رژیمی', 'پرپروتئین', 'بدون گلوتن', 'سریع', 'اقتصادی'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDiet(d)}
                      className={`min-h-[36px] px-3 rounded-lg text-xs ${
                        dietTags.includes(d)
                          ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55]'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-xs text-[#615E55] dark:text-[#A9A497]">حداقل ۲ ماده اولیه وارد کنید:</p>
              {ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="نام ماده"
                    value={ing.name}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r, i) => (i === idx ? {...r, name: e.target.value} : r)))
                    }
                    className="col-span-6 min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min={0.25}
                    value={ing.amount}
                    onChange={(e) =>
                      setIngredients((prev) =>
                        prev.map((r, i) => (i === idx ? {...r, amount: Number(e.target.value) || 1} : r))
                      )
                    }
                    className="col-span-2 min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2 text-sm tabular-nums"
                  />
                  <input
                    type="text"
                    placeholder="واحد"
                    value={ing.unit}
                    onChange={(e) =>
                      setIngredients((prev) => prev.map((r, i) => (i === idx ? {...r, unit: e.target.value} : r)))
                    }
                    className="col-span-3 min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2.5 text-sm"
                  />
                  <button
                    type="button"
                    aria-label="حذف ردیف"
                    disabled={ingredients.length <= 2}
                    onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
                    className="col-span-1 min-h-[44px] flex items-center justify-center text-[#615E55] disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setIngredients((prev) => [...prev, {name: '', amount: 1, unit: 'قاشق'}])}
                className="min-h-[42px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> افزودن ماده دیگر
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {steps.map((st, idx) => (
                <div key={idx} className="space-y-2 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5">
                  <div className="flex items-center justify-between text-xs text-[#615E55]">
                    <span>مرحله {toFaDigits(idx + 1)}</span>
                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-600"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    required
                    placeholder="شرح دقیق این مرحله از پخت..."
                    value={st.instruction}
                    onChange={(e) =>
                      setSteps((prev) => prev.map((r, i) => (i === idx ? {...r, instruction: e.target.value} : r)))
                    }
                    className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-sm"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="تایمر اختیاری این مرحله (دقیقه)"
                    value={st.timerMinutes ?? ''}
                    onChange={(e) =>
                      setSteps((prev) =>
                        prev.map((r, i) =>
                          i === idx ? {...r, timerMinutes: e.target.value ? Number(e.target.value) : undefined} : r
                        )
                      )
                    }
                    className="w-56 min-h-[40px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSteps((prev) => [...prev, {instruction: ''}])}
                className="min-h-[42px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> افزودن مرحله جدید
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-[#E5E1D6] dark:border-[#2F2D27]">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="min-h-[46px] px-5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-sm"
              >
                مرحله قبل
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
                className="min-h-[46px] px-6 rounded-xl bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412] text-sm font-medium"
              >
                مرحله بعد
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="min-h-[46px] px-6 rounded-xl bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412] text-sm font-medium disabled:opacity-40"
              >
                {submitting ? 'در حال ثبت...' : 'ثبت نهایی دستور (+۲۰ جِم)'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
