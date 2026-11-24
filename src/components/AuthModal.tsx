import {useState} from 'react';
import {AlertCircle, CheckCircle2, X} from 'lucide-react';
import {apiRequest, setUserToken} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {ShoppingItem, UserProfile} from '../shared/types.ts';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  guestBookmarks: string[];
  guestShoppingItems: ShoppingItem[];
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({
  open,
  onClose,
  guestBookmarks,
  guestShoppingItems,
  onSuccess,
}: AuthModalProps) {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('تهران');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{ok: boolean; phone: string; devCode?: string; message: string}>(
        '/api/auth/request-otp',
        {method: 'POST', body: JSON.stringify({phone})}
      );
      setPhone(res.phone);
      setDevCode(res.devCode ?? null);
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارسال کد تایید');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{token: string; user: UserProfile}>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({
          phone,
          code,
          name: name.trim() || undefined,
          city,
          guestBookmarks,
          guestShoppingItems: guestShoppingItems.map((i) => ({
            name: i.name,
            amount: i.amount,
            unit: i.unit,
            category: i.category,
            recipeId: i.recipeId,
            recipeTitle: i.recipeTitle,
            checked: i.checked,
          })),
        }),
      });
      setUserToken(res.token);
      onSuccess(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'کد تایید معتبر نیست');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-[#1C1B18] dark:text-[#F4F1EA]">
              ورود به لاقلی
            </h2>
            <p className="mt-1 text-sm text-[#615E55] dark:text-[#A9A497]">
              احراز هویت بومی با شماره موبایل و همگام‌سازی خودکار نشانک‌ها و لیست خرید شما
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#615E55] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="mt-6 space-y-4">
            <div>
              <label htmlFor="auth-phone" className="block text-sm font-medium mb-1.5">
                شماره موبایل
              </label>
              <input
                id="auth-phone"
                type="tel"
                dir="ltr"
                required
                placeholder="09123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-left tabular-nums text-base"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="auth-name" className="block text-sm font-medium mb-1.5">
                  نام نمایشی (اختیاری)
                </label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="مثلاً علی"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="auth-city" className="block text-sm font-medium mb-1.5">
                  شهر شما
                </label>
                <select
                  id="auth-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                >
                  <option value="تهران">تهران</option>
                  <option value="رشت">رشت</option>
                  <option value="شیراز">شیراز</option>
                  <option value="اصفهان">اصفهان</option>
                  <option value="مشهد">مشهد</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:hover:bg-[#A2BC9C] text-[#F9F8F4] dark:text-[#141412] font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'در حال ارسال کد...' : 'دریافت کد تایید پیامکی'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            {devCode && (
              <div className="rounded-xl border border-[#3F523B]/25 bg-[#F1EFE8] dark:bg-[#24231F] p-3.5 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#3F523B] dark:text-[#8EA888] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#1C1B18] dark:text-[#F4F1EA]">
                    کد آزمایشی برای شماره <span dir="ltr" className="tabular-nums font-medium">{toFaDigits(phone)}</span>:
                  </p>
                  <p dir="ltr" className="mt-1 text-lg font-bold tracking-widest text-[#3F523B] dark:text-[#8EA888] tabular-nums">
                    {devCode}
                  </p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="auth-otp" className="block text-sm font-medium mb-1.5">
                کد ۶ رقمی پیامک‌شده
              </label>
              <input
                id="auth-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                required
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-center tracking-[0.35em] text-lg tabular-nums"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
                className="min-h-[48px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-sm font-medium"
              >
                اصلاح شماره
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[48px] rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:hover:bg-[#A2BC9C] text-[#F9F8F4] dark:text-[#141412] font-medium text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'در حال بررسی...' : 'تایید و ورود'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
