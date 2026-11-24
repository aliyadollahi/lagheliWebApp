import {useState} from 'react';
import {AlertCircle, CheckCircle2, X} from 'lucide-react';
import {apiRequest, setUserToken} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {ShoppingItem, UserProfile} from '../shared/types.ts';

interface AuthModalProps {
  open: boolean;
  quickTestLoginEnabled?: boolean;
  onClose: () => void;
  guestBookmarks: string[];
  guestShoppingItems: ShoppingItem[];
  onSuccess: (user: UserProfile) => void;
}

export function AuthModal({
  open,
  quickTestLoginEnabled = false,
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

  const handleQuickTestUserLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest<{token: string; user: UserProfile}>('/api/auth/quick-test-login', {
        method: 'POST',
        body: JSON.stringify({
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
      setError(err instanceof Error ? err.message : 'ورود سریع آزمایشی ناموفق بود');
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
      <div className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
              ورود به لاقلی
            </h2>
            <p className="mt-1 text-sm text-[#5C5C58] dark:text-[#A3A39E]">
              احراز هویت بومی با شماره موبایل و همگام‌سازی خودکار نشانک‌ها و لیست خرید شما
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#5C5C58] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
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

        {quickTestLoginEnabled && (
          <div className="mt-5 pb-5 border-b border-[#E6E6E3] dark:border-[#242422] space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickTestUserLogin}
              className="w-full min-h-[48px] rounded-full bg-[#0D0D0D] hover:bg-[#242422] active:scale-[0.98] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] text-[#FFFFFF] text-sm font-semibold transition-all disabled:opacity-50"
            >
              {loading ? 'در حال ورود...' : 'ورود سریع آزمایشی (بدون کد پیامکی)'}
            </button>
            <p className="text-[11px] text-center text-[#5C5C58] dark:text-[#A3A39E]">
              حالت تست فعال است · برای بررسی فوری امکانات کاربر و سرآشپز بدون نیاز به دریافت کد
            </p>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleRequestOtp} className="mt-5 space-y-4">
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
                className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-4 text-left tabular-nums text-base"
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
                  className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-sm"
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
                  className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-sm"
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
              className="w-full min-h-[48px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:hover:bg-[#ECA982] text-[#FAFAFA] dark:text-[#0B0B0B] font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'در حال ارسال کد...' : 'دریافت کد تایید پیامکی'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
            {devCode && (
              <div className="rounded-xl border border-[#B54B1F]/25 bg-[#EFEFED] dark:bg-[#20201E] p-3.5 text-sm flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[#0D0D0D] dark:text-[#FAFAFA]">
                    کد آزمایشی برای شماره <span dir="ltr" className="tabular-nums font-medium">{toFaDigits(phone)}</span>:
                  </p>
                  <p dir="ltr" className="mt-1 text-lg font-bold tracking-widest text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
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
                className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-4 text-center tracking-[0.35em] text-lg tabular-nums"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setError(null);
                }}
                className="min-h-[48px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-sm font-medium"
              >
                اصلاح شماره
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[48px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:hover:bg-[#ECA982] text-[#FAFAFA] dark:text-[#0B0B0B] font-medium text-sm transition-colors disabled:opacity-50"
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
