import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Copy,
  Download,
  Gem,
  LogOut,
  Moon,
  MoreVertical,
  PlayCircle,
  PlusSquare,
  Share,
  Shield,
  Smartphone,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWA.ts';
import {apiRequest} from '../lib/api.ts';
import {formatToman, toFaDigits} from '../shared/persianEngine.ts';
import type {
  BadgeItem,
  GemStoreOffer,
  GemTransaction,
  Recipe,
  RecipeQuestion,
  UserCoupon,
  UserProfile,
} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

interface ProfileAndAdminViewProps {
  user: UserProfile | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onReplaySplash: () => void;
  onOpenAdminPanel: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenSubmitRecipe: () => void;
  onRefreshUser: () => void;
  onNotify: (msg: string) => void;
}

export function ProfileAndAdminView({
  user,
  theme,
  onToggleTheme,
  onReplaySplash,
  onOpenAdminPanel,
  onOpenAuth,
  onLogout,
  onOpenRecipe,
  onOpenSubmitRecipe,
  onRefreshUser,
  onNotify,
}: ProfileAndAdminViewProps) {
  const [profileTab, setProfileTab] = useState<'recipes' | 'questions' | 'badges' | 'gems'>('recipes');
  const {isInstallable, isInstalled, isIOS, isAndroid, install} = usePWAInstall();
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [guidePlatform, setGuidePlatform] = useState<'android' | 'ios'>('android');
  const [installingPWA, setInstallingPWA] = useState(false);

  const handleInstallMobile = async () => {
    if (isInstalled) {
      onNotify('اپلیکیشن لاقلی همین الان روی دستگاه شما نصب است.');
      return;
    }

    if (isInstallable) {
      setInstallingPWA(true);
      const outcome = await install();
      setInstallingPWA(false);
      if (outcome === 'accepted') {
        onNotify('لاقلی با موفقیت روی موبایل شما نصب شد!');
        return;
      }
      if (outcome === 'dismissed') {
        onNotify('نصب لغو شد؛ هر زمان خواستی دوباره روی «نصب در موبایل» بزن.');
        return;
      }
    }

    // Fallback for iOS Safari (no beforeinstallprompt) or browsers where native prompt is unavailable
    setGuidePlatform(isIOS ? 'ios' : isAndroid ? 'android' : 'ios');
    setInstallGuideOpen(true);
  };

  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [bookmarkedRecipes, setBookmarkedRecipes] = useState<Recipe[]>([]);
  const [myQuestions, setMyQuestions] = useState<RecipeQuestion[]>([]);
  const [qaStats, setQaStats] = useState({questionsCount: 0, answersCount: 0, bestAnswersCount: 0});
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [gemOffers, setGemOffers] = useState<GemStoreOffer[]>([]);

  const [showChefForm, setShowChefForm] = useState(false);
  const [chefBio, setChefBio] = useState('');
  const [chefSpecialty, setChefSpecialty] = useState('');

  const loadDashboard = async () => {
    if (!user) return;
    try {
      const data = await apiRequest<{
        myRecipes: Recipe[];
        bookmarkedRecipes: Recipe[];
        myQuestions: RecipeQuestion[];
        qaStats: {questionsCount: number; answersCount: number; bestAnswersCount: number};
        badges: BadgeItem[];
        transactions: GemTransaction[];
        coupons: UserCoupon[];
        gemStoreOffers: GemStoreOffer[];
      }>('/api/profile/dashboard');
      setMyRecipes(data.myRecipes);
      setBookmarkedRecipes(data.bookmarkedRecipes);
      setMyQuestions(data.myQuestions);
      setQaStats(data.qaStats);
      setBadges(data.badges);
      setTransactions(data.transactions);
      setCoupons(data.coupons);
      setGemOffers(data.gemStoreOffers);
    } catch {
      // Ignore offline
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const handleRedeemOffer = async (offerId: string) => {
    try {
      const res = await apiRequest<{coupon: UserCoupon}>('/api/gems/redeem', {
        method: 'POST',
        body: JSON.stringify({offerId}),
      });
      onNotify(`کوپن دریافت شد: ${res.coupon.code}`);
      onRefreshUser();
      loadDashboard();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در دریافت کوپن');
    }
  };

  const handleRequestChefVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{message: string}>('/api/profile/verify-chef', {
        method: 'POST',
        body: JSON.stringify({bio: chefBio, specialty: chefSpecialty}),
      });
      setShowChefForm(false);
      onRefreshUser();
      onNotify(res.message);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت درخواست');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Calm Header Utilities (PWA Install, Theme, Replay Splash, Desktop Admin Workspace) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E6E6E3] dark:border-[#282825] pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">پروفایل و تنظیمات</h1>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
            مدیریت دستورها، کیف پول، کیف جِم و تنظیمات اپلیکیشن لاقلی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isInstalled && (
            <button
              type="button"
              onClick={handleInstallMobile}
              disabled={installingPWA}
              className="min-h-[42px] px-4 rounded-full bg-[#0D0D0D] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:hover:bg-[#E6E6E3] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 shadow-sm active:scale-[0.98] transition-all disabled:opacity-60"
            >
              <Smartphone className="w-4 h-4 text-[#E29A6F] dark:text-[#B54B1F]" />
              <span>{installingPWA ? 'در حال آماده‌سازی...' : 'نصب در موبایل'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReplaySplash}
            className="min-h-[42px] px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
          >
            <PlayCircle className="w-4 h-4" />
            <span>پخش اسپلش لاقلی</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            className="min-h-[42px] px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'روشن' : 'تاریک'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenAdminPanel}
            className="min-h-[42px] px-4 rounded-full border border-[#B54B1F]/40 dark:border-[#E29A6F]/40 text-xs font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:bg-[#B54B1F]/8 inline-flex items-center gap-1.5"
          >
            <Shield className="w-4 h-4" />
            <span>پنل مدیریت جامع</span>
          </button>
        </div>
      </div>

      {/* Dedicated Native Mobile Install Card (Automatically hidden once installed in standalone mode) */}
      {!isInstalled && (
        <section
          aria-label="نصب اپلیکیشن لاقلی در موبایل"
          className="rounded-[24px] border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_12px_34px_-22px_rgba(0,0,0,0.2)]"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-[#E29A6F] dark:text-[#B54B1F]" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                  نصب لاقلی روی گوشی (اندروید و iOS)
                </h2>
                {isInstallable && (
                  <span className="px-2 py-0.5 rounded-full bg-[#B54B1F]/12 text-[#B54B1F] dark:text-[#E29A6F] text-[10px] font-bold">
                    نصب مستقیم آماده است
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                اجرای تمام‌صفحه بدون نوار مرورگر، دسترسی سریع از صفحه اصلی گوشی و مرور آفلاین دستورهای پخت.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleInstallMobile}
            disabled={installingPWA}
            className="min-h-[44px] px-5 rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FFFFFF] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.98] transition-all whitespace-nowrap"
          >
            <Smartphone className="w-4 h-4" />
            <span>{installingPWA ? 'در حال نصب...' : 'نصب در موبایل'}</span>
          </button>
        </section>
      )}

      {/* Guided Mobile Install Modal (iOS Safari & Android Chrome Fallback) */}
      <AnimatePresence>
        {installGuideOpen && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            transition={{duration: 0.18}}
            role="dialog"
            aria-modal="true"
            aria-label="راهنمای نصب اپلیکیشن لاقلی در موبایل"
            onClick={() => setInstallGuideOpen(false)}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-[3px] p-0 sm:p-4"
          >
            <motion.div
              initial={{y: 36, opacity: 0.6}}
              animate={{y: 0, opacity: 1}}
              exit={{y: 28, opacity: 0}}
              transition={{type: 'spring', stiffness: 380, damping: 32}}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-5 sm:p-6 space-y-5 shadow-[0_28px_72px_-20px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-[#E29A6F] dark:text-[#B54B1F]" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                      نصب لاقلی در موبایل
                    </h3>
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
                      مانند اپلیکیشن نیتیو روی صفحه اصلی گوشی
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="بستن راهنما"
                  onClick={() => setInstallGuideOpen(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#EFEFED] dark:hover:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Platform Switcher: iOS vs Android */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#F6F6F5] dark:bg-[#20201E] border border-[#E6E6E3] dark:border-[#2C2C29]">
                <button
                  type="button"
                  onClick={() => setGuidePlatform('ios')}
                  className={`min-h-[38px] rounded-full text-xs font-bold transition-all ${
                    guidePlatform === 'ios'
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  آیفون (iOS / Safari)
                </button>
                <button
                  type="button"
                  onClick={() => setGuidePlatform('android')}
                  className={`min-h-[38px] rounded-full text-xs font-bold transition-all ${
                    guidePlatform === 'android'
                      ? 'bg-[#0D0D0D] text-[#FFFFFF] dark:bg-[#FAFAFA] dark:text-[#0B0B0B]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  اندروید (Chrome)
                </button>
              </div>

              {guidePlatform === 'ios' ? (
                <ol className="space-y-3 text-xs sm:text-sm text-[#0D0D0D] dark:text-[#FAFAFA]">
                  <li className="flex items-start gap-3 rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] p-3.5">
                    <span className="w-7 h-7 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold flex items-center justify-center shrink-0">
                      ۱
                    </span>
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-bold inline-flex items-center gap-1.5">
                        <span>دکمه اشتراک‌گذاری (Share) را بزنید</span>
                        <Share className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                      </p>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                        در نوار پایین مرورگر Safari روی آیکون مربع و فلش رو به بالا بزنید.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] p-3.5">
                    <span className="w-7 h-7 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold flex items-center justify-center shrink-0">
                      ۲
                    </span>
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-bold inline-flex items-center gap-1.5">
                        <span>گزینه «Add to Home Screen» را انتخاب کنید</span>
                        <PlusSquare className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                      </p>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                        در نهایت دکمه <strong>Add</strong> در بالا را بزنید تا آیکون لاقلی اضافه شود.
                      </p>
                    </div>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-xs sm:text-sm text-[#0D0D0D] dark:text-[#FAFAFA]">
                  <li className="flex items-start gap-3 rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] p-3.5">
                    <span className="w-7 h-7 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold flex items-center justify-center shrink-0">
                      ۱
                    </span>
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-bold inline-flex items-center gap-1.5">
                        <span>منوی سه‌نقطه مرورگر Chrome را باز کنید</span>
                        <MoreVertical className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                      </p>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                        در گوشه بالای مرورگر Chrome روی آیکون سه‌نقطه بزنید.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3 rounded-2xl bg-[#F6F6F5] dark:bg-[#20201E] p-3.5">
                    <span className="w-7 h-7 rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold flex items-center justify-center shrink-0">
                      ۲
                    </span>
                    <div className="space-y-1 leading-relaxed">
                      <p className="font-bold inline-flex items-center gap-1.5">
                        <span>«Install app» یا «Add to Home screen» را بزنید</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F]" />
                      </p>
                      <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                        پس از تایید، لاقلی بدون نوار آدرس مرورگر و با آیکون اختصاصی نصب می‌شود.
                      </p>
                    </div>
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setInstallGuideOpen(false)}
                className="w-full min-h-[46px] rounded-full bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-sm font-bold"
              >
                متوجه شدم
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!user ? (
        <div className="rounded-3xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-10 text-center space-y-4">
          <h2 className="text-2xl font-bold">ورود به حساب آشپزخانه لاقلی</h2>
          <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E] max-w-md mx-auto leading-relaxed">
            به عنوان مهمان می‌توانید دستورها را نشانک بزنید و لیست خرید بسازید. با ورود پیامکی، داده‌های شما همگام‌سازی می‌شود و می‌توانید عکس واقعی غذاهای خود را ثبت کرده و جِم هدیه بگیرید.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[48px] px-7 rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:text-[#111110] text-white text-sm font-medium"
          >
            ورود با شماره موبایل (OTP)
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Profile Editorial Header */}
          <div className="rounded-3xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-6 sm:p-7 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                  {user.isVerifiedChef && <BadgeCheck className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />}
                </div>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  {user.levelName} · {user.city}، {user.neighborhood} ·{' '}
                  <span dir="ltr" className="tabular-nums">
                    {toFaDigits(user.phone)}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!user.isVerifiedChef && user.chefVerificationStatus === 'none' && (
                  <button
                    type="button"
                    onClick={() => setShowChefForm((v) => !v)}
                    className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium"
                  >
                    درخواست نشان سرآشپز
                  </button>
                )}
                {user.chefVerificationStatus === 'pending' && (
                  <span className="text-xs text-[#A97222] px-2">درخواست سرآشپز در حال بررسی</span>
                )}
                <button
                  type="button"
                  onClick={onLogout}
                  className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs text-[#5C5C58] inline-flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>خروج</span>
                </button>
              </div>
            </div>

            {/* Clean Tabular Metrics (Wallet Toman + Gems + XP + Followers) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 border-t border-[#E6E6E3] dark:border-[#282825] tabular-nums">
              <div>
                <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">موجودی کیف پول</div>
                <div className="text-lg font-extrabold text-[#B54B1F] dark:text-[#E29A6F] inline-flex items-center gap-1.5 mt-0.5">
                  <Wallet className="w-4 h-4" />
                  <span>{formatToman(user.walletBalance || 0)}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">موجودی جِم</div>
                <div className="text-lg font-extrabold text-[#B54B1F] dark:text-[#E29A6F] inline-flex items-center gap-1 mt-0.5">
                  <Gem className="w-4 h-4" />
                  <span>{toFaDigits(user.gems)}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">امتیاز (XP)</div>
                <div className="text-lg font-bold mt-0.5">
                  {toFaDigits(user.xp)} / {toFaDigits(user.nextLevelXp)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">دنبال‌کنندگان</div>
                <div className="text-lg font-bold mt-0.5">{toFaDigits(user.followersCount)}</div>
              </div>
            </div>

            {showChefForm && (
              <form
                onSubmit={handleRequestChefVerify}
                className="pt-4 border-t border-[#E6E6E3] dark:border-[#282825] space-y-3"
              >
                <p className="text-sm font-semibold">درخواست دریافت نشان «سرآشپز تاییدشده»</p>
                <input
                  type="text"
                  required
                  placeholder="تخصص آشپزی شما (مثلاً غذاهای سنتی جنوب، شیرینی خانگی)"
                  value={chefSpecialty}
                  onChange={(e) => setChefSpecialty(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 text-sm"
                />
                <textarea
                  rows={2}
                  required
                  placeholder="معرفی کوتاه سوابق و علاقه آشپزی شما..."
                  value={chefBio}
                  onChange={(e) => setChefBio(e.target.value)}
                  className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-5 rounded-full bg-[#111110] text-white text-xs font-medium"
                >
                  ارسال درخواست برای بررسی مدیریت
                </button>
              </form>
            )}
          </div>

          {/* Official 4-Tab Profile Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              {id: 'recipes', label: 'دستورهای من'},
              {id: 'questions', label: 'سوالات من'},
              {id: 'badges', label: 'نشان‌های افتخار'},
              {id: 'gems', label: 'کیف جِم'},
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setProfileTab(t.id as 'recipes' | 'questions' | 'badges' | 'gems')}
                className={`min-h-[44px] px-5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                  profileTab === t.id
                    ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                    : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {profileTab === 'recipes' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold">دستورهای ارسالی من ({toFaDigits(myRecipes.length)})</h3>
                  <button
                    type="button"
                    onClick={onOpenSubmitRecipe}
                    className="text-xs font-semibold text-[#111110] dark:text-[#FAFAFA] hover:underline min-h-[40px]"
                  >
                    + ثبت دستور جدید
                  </button>
                </div>
                {myRecipes.length === 0 ? (
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">
                    هنوز دستوری ثبت نکرده‌اید. با ثبت اولین دستور ۲۰ جِم هدیه بگیرید.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {myRecipes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onOpenRecipe(r)}
                        className="text-right rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden"
                      >
                        <EditorialImage src={r.imageUrl} alt={r.title} category={r.category} aspectClass="aspect-[4/3]" />
                        <div className="p-4 space-y-1">
                          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                            {r.status === 'published' ? 'منتشرشده' : 'در انتظار تایید مدیریت'}
                          </div>
                          <div className="text-sm font-bold">{r.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t border-[#E6E6E3] dark:border-[#282825] pt-6">
                <h3 className="text-lg font-bold">دستورهای نشانک‌شده ({toFaDigits(bookmarkedRecipes.length)})</h3>
                {bookmarkedRecipes.length === 0 ? (
                  <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">هنوز دستوری را نشانک نکرده‌اید.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {bookmarkedRecipes.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => onOpenRecipe(r)}
                        className="text-right rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden"
                      >
                        <EditorialImage src={r.imageUrl} alt={r.title} category={r.category} aspectClass="aspect-[4/3]" />
                        <div className="p-4 space-y-1">
                          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                            {r.category} · {toFaDigits(r.prepMinutes + r.cookMinutes)} دقیقه
                          </div>
                          <div className="text-sm font-bold">{r.title}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {profileTab === 'questions' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 text-center tabular-nums">
                <div>
                  <div className="text-xs text-[#5C5C58]">سوال‌های من</div>
                  <div className="text-xl font-bold mt-1">{toFaDigits(qaStats.questionsCount)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#5C5C58]">پاسخ‌های ثبت‌شده</div>
                  <div className="text-xl font-bold mt-1">{toFaDigits(qaStats.answersCount)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#5C5C58]">بهترین پاسخ‌ها</div>
                  <div className="text-xl font-bold mt-1 text-[#B54B1F] dark:text-[#E29A6F]">
                    {toFaDigits(qaStats.bestAnswersCount)}
                  </div>
                </div>
              </div>

              {myQuestions.length === 0 ? (
                <p className="text-sm text-[#5C5C58] dark:text-[#A3A39E]">هنوز سوالی زیر دستورهای پخت نپرسیده‌اید.</p>
              ) : (
                <div className="space-y-3">
                  {myQuestions.map((q) => (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1.5"
                    >
                      <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E] flex justify-between">
                        <span>زیر دستور: {q.recipeTitle}</span>
                        <span>{q.solved ? 'حل‌شده' : 'در انتظار پاسخ'}</span>
                      </div>
                      <p className="text-sm font-medium">{q.body}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {profileTab === 'badges' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {badges.map((b) => (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-5 space-y-3 ${
                    b.unlocked
                      ? 'border-[#B54B1F]/40 bg-[#FFFFFF] dark:bg-[#151514]'
                      : 'border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF]/60 dark:bg-[#151514]/60 opacity-80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Award
                        className={`w-5 h-5 ${
                          b.unlocked ? 'text-[#B54B1F] dark:text-[#E29A6F]' : 'text-[#5C5C58]'
                        }`}
                      />
                      <h3 className="text-sm font-bold">{b.title}</h3>
                    </div>
                    <span className="text-xs text-[#5C5C58] tabular-nums">
                      {b.unlocked ? 'بازشده' : `${toFaDigits(b.progress)} / ${toFaDigits(b.target)}`}
                    </span>
                  </div>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{b.description}</p>
                  <div className="h-1.5 rounded-full bg-[#EFEFED] dark:bg-[#20201E] overflow-hidden">
                    <div
                      className="h-full bg-[#B54B1F] dark:bg-[#E29A6F]"
                      style={{width: `${Math.round((b.progress / Math.max(1, b.target)) * 100)}%`}}
                    />
                  </div>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                    پاداش: +{toFaDigits(b.xpReward)} امتیاز · +{toFaDigits(b.gemReward)} جِم
                  </p>
                </div>
              ))}
            </div>
          )}

          {profileTab === 'gems' && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-lg font-bold">تبدیل جِم به کوپن تخفیف همکاران</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {gemOffers.map((offer) => (
                    <div
                      key={offer.id}
                      className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{offer.partnerName}</div>
                        <h4 className="text-base font-bold">{offer.title}</h4>
                        <p className="text-xs text-[#B54B1F] dark:text-[#E29A6F]">{offer.discountLabel}</p>
                      </div>
                      <button
                        type="button"
                        disabled={user.gems < offer.gemCost}
                        onClick={() => handleRedeemOffer(offer.id)}
                        className="min-h-[44px] px-4 rounded-full bg-[#111110] hover:bg-[#282825] dark:bg-[#FAFAFA] dark:text-[#111110] text-white text-xs font-medium disabled:opacity-40"
                      >
                        دریافت کوپن با {toFaDigits(offer.gemCost)} جِم
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {coupons.length > 0 && (
                <div className="space-y-3 border-t border-[#E6E6E3] dark:border-[#282825] pt-6">
                  <h3 className="text-base font-bold">کوپن‌های دریافت‌شده من</h3>
                  <div className="space-y-2.5">
                    {coupons.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="text-sm font-bold">{c.title}</div>
                          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                            {c.partnerName} · {c.used ? 'استفاده‌شده' : 'قابل استفاده'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(c.code).catch(() => {});
                            onNotify(`کد ${c.code} کپی شد.`);
                          }}
                          className="min-h-[40px] px-3.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-mono font-bold inline-flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span dir="ltr">{c.code}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t border-[#E6E6E3] dark:border-[#282825] pt-6">
                <h3 className="text-base font-bold">تاریخچه تراکنش‌های جِم</h3>
                <div className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825] rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514]">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span>{tx.reason}</span>
                      <span
                        dir="ltr"
                        className={`font-bold tabular-nums ${
                          tx.amount >= 0 ? 'text-[#B54B1F] dark:text-[#E29A6F]' : 'text-[#B54B1F]'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${toFaDigits(tx.amount)}` : toFaDigits(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
