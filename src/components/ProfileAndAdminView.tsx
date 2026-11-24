import {useEffect, useState} from 'react';
import {
  Award,
  BadgeCheck,
  Copy,
  Download,
  Gem,
  LogOut,
  Moon,
  PlayCircle,
  Shield,
  Sun,
  Wallet,
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
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

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
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[42px] px-4 rounded-full bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>نصب وب‌اپ لاقلی</span>
            </button>
          )}
          {!isInstalled && !isInstallable && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="min-h-[42px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>نصب روی آیفون</span>
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

      {/* iOS Safari Install Guide */}
      {showIOSGuide && (
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex items-start justify-between gap-4">
          <div className="space-y-1 text-xs">
            <p className="font-bold text-sm">راهنمای نصب لاقلی روی آیفون (Safari)</p>
            <p className="text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              ۱. دکمه Share در نوار پایین مرورگر Safari را لمس کنید. ۲. گزینه «Add to Home Screen» را انتخاب و روی Add بزنید.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowIOSGuide(false)}
            className="text-xs text-[#5C5C58] px-2 py-1"
          >
            بستن
          </button>
        </div>
      )}

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
