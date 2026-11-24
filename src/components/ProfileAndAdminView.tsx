import {useEffect, useState} from 'react';
import {
  Award,
  BadgeCheck,
  Check,
  Copy,
  Download,
  Gem,
  LogOut,
  Moon,
  PlayCircle,
  Settings,
  Shield,
  Sun,
} from 'lucide-react';
import {usePWAInstall} from '../hooks/usePWA.ts';
import {apiRequest, getAdminToken, setAdminToken} from '../lib/api.ts';
import {PARTNER_ROLES, PARTNER_ROLE_LABELS, toFaDigits} from '../shared/persianEngine.ts';
import type {
  BadgeItem,
  EcosystemConfig,
  GemStoreOffer,
  GemTransaction,
  Partner,
  PartnerAnalyticsSummary,
  PartnerRoleId,
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
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onOpenSubmitRecipe: () => void;
  onRefreshConfig: () => void;
  onRefreshUser: () => void;
  onNotify: (msg: string) => void;
}

export function ProfileAndAdminView({
  user,
  theme,
  onToggleTheme,
  onReplaySplash,
  onOpenAuth,
  onLogout,
  onOpenRecipe,
  onOpenSubmitRecipe,
  onRefreshConfig,
  onRefreshUser,
  onNotify,
}: ProfileAndAdminViewProps) {
  const [section, setSection] = useState<'profile' | 'admin'>('profile');
  const [profileTab, setProfileTab] = useState<'recipes' | 'questions' | 'badges' | 'gems'>('recipes');
  const {isInstallable, isInstalled, isIOS, install} = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // User Dashboard state
  const [myRecipes, setMyRecipes] = useState<Recipe[]>([]);
  const [bookmarkedRecipes, setBookmarkedRecipes] = useState<Recipe[]>([]);
  const [myQuestions, setMyQuestions] = useState<RecipeQuestion[]>([]);
  const [qaStats, setQaStats] = useState({questionsCount: 0, answersCount: 0, bestAnswersCount: 0});
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [transactions, setTransactions] = useState<GemTransaction[]>([]);
  const [coupons, setCoupons] = useState<UserCoupon[]>([]);
  const [gemOffers, setGemOffers] = useState<GemStoreOffer[]>([]);

  // Chef Verification form
  const [showChefForm, setShowChefForm] = useState(false);
  const [chefBio, setChefBio] = useState('');
  const [chefSpecialty, setChefSpecialty] = useState('');

  // Admin state
  const [adminConfigured, setAdminConfigured] = useState<boolean>(true);
  const [adminAuthed, setAdminAuthed] = useState<boolean>(Boolean(getAdminToken()));
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminConfig, setAdminConfig] = useState<EcosystemConfig | null>(null);
  const [pendingPartners, setPendingPartners] = useState<Partner[]>([]);
  const [pendingRecipes, setPendingRecipes] = useState<Recipe[]>([]);
  const [pendingChefs, setPendingChefs] = useState<{id: string; name: string; city: string; specialty: string}[]>([]);
  const [analytics, setAnalytics] = useState<PartnerAnalyticsSummary | null>(null);

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

  const loadAdminStatusAndOverview = async () => {
    try {
      const status = await apiRequest<{configured: boolean; authenticated: boolean}>('/api/admin/status', {
        useAdmin: true,
      });
      setAdminConfigured(status.configured);
      setAdminAuthed(status.authenticated);
      if (status.authenticated) {
        const ov = await apiRequest<{
          config: EcosystemConfig;
          pendingPartners: Partner[];
          pendingRecipes: Recipe[];
          pendingChefs: {id: string; name: string; city: string; specialty: string}[];
          analytics: PartnerAnalyticsSummary;
        }>('/api/admin/overview', {useAdmin: true});
        setAdminConfig(ov.config);
        setPendingPartners(ov.pendingPartners);
        setPendingRecipes(ov.pendingRecipes);
        setPendingChefs(ov.pendingChefs);
        setAnalytics(ov.analytics);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (section === 'admin') {
      loadAdminStatusAndOverview();
    }
  }, [section]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    try {
      const endpoint = adminConfigured ? '/api/admin/login' : '/api/admin/setup';
      const res = await apiRequest<{adminToken: string; message?: string}>(endpoint, {
        method: 'POST',
        body: JSON.stringify({password: adminPassword}),
      });
      setAdminToken(res.adminToken);
      setAdminPassword('');
      setAdminAuthed(true);
      onNotify(res.message || 'وارد پنل مدیریت برنامه‌پذیر شدید.');
      loadAdminStatusAndOverview();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'ورود ناموفق بود');
    }
  };

  const handleSaveAdminConfig = async () => {
    if (!adminConfig) return;
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify(adminConfig),
      });
      onRefreshConfig();
      onNotify('تنظیمات اکوسیستم لاقلی بلافاصله اعمال شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات');
    }
  };

  const togglePartnerRoleInConfig = (roleId: PartnerRoleId) => {
    if (!adminConfig) return;
    const exists = adminConfig.enabledPartnerRoles.includes(roleId);
    const next = exists
      ? adminConfig.enabledPartnerRoles.filter((r) => r !== roleId)
      : [...adminConfig.enabledPartnerRoles, roleId];
    setAdminConfig({...adminConfig, enabledPartnerRoles: next});
  };

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
      {/* Top Mode Switcher + Quiet Utilities (Theme, PWA Install, Replay Splash, Admin) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E1D6] dark:border-[#2F2D27] pb-6">
        <div className="inline-flex p-1 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F]">
          <button
            type="button"
            onClick={() => setSection('profile')}
            className={`min-h-[44px] px-5 rounded-lg text-sm font-medium transition-colors ${
              section === 'profile'
                ? 'bg-[#FFFFFF] dark:bg-[#1C1B18] text-[#1C1B18] dark:text-[#F4F1EA]'
                : 'text-[#615E55] dark:text-[#A9A497]'
            }`}
          >
            پروفایل من
          </button>
          <button
            type="button"
            onClick={() => setSection('admin')}
            className={`min-h-[44px] px-5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 ${
              section === 'admin'
                ? 'bg-[#FFFFFF] dark:bg-[#1C1B18] text-[#1C1B18] dark:text-[#F4F1EA]'
                : 'text-[#615E55] dark:text-[#A9A497]'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>پنل مدیریت اکوسیستم</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* In-App PWA Install Prompt (Chromium + iOS Safari) */}
          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={install}
              className="min-h-[44px] px-4 rounded-xl bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>نصب وب‌اپ لاقلی</span>
            </button>
          )}
          {!isInstalled && !isInstallable && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSGuide(true)}
              className="min-h-[44px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>نصب روی آیفون</span>
            </button>
          )}

          <button
            type="button"
            onClick={onReplaySplash}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            <PlayCircle className="w-4 h-4" />
            <span>نمایش اسپلش لاقلی</span>
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: 4-TAB USER PROFILE */}
      {section === 'profile' ? (
        !user ? (
          <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-10 text-center space-y-4">
            <h1 className="text-2xl font-bold">پروفایل کاربری لاقلی</h1>
            <p className="text-sm text-[#615E55] dark:text-[#A9A497] max-w-md mx-auto leading-relaxed">
              به عنوان کاربر مهمان می‌توانید دستورها را نشانک بزنید و لیست خرید بسازید. با ورود پیامکی، داده‌های شما همگام‌سازی می‌شود و به کیف جِم، نشان‌های افتخار و ثبت دستور دسترسی خواهید داشت.
            </p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[48px] px-6 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-sm font-medium"
            >
              ورود با شماره موبایل (OTP)
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profile Editorial Header */}
            <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{user.name}</h1>
                    {user.isVerifiedChef && <BadgeCheck className="w-5 h-5 text-[#3F523B] dark:text-[#8EA888]" />}
                  </div>
                  <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
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
                      className="min-h-[42px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium"
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
                    className="min-h-[42px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs text-[#615E55] inline-flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>

              {/* XP Bar & Core Metrics */}
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E5E1D6] dark:border-[#2F2D27] tabular-nums">
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">موجودی جِم</div>
                  <div className="text-lg font-bold text-[#A97222] dark:text-[#D8A85B] inline-flex items-center gap-1 mt-0.5">
                    <Gem className="w-4 h-4" />
                    <span>{toFaDigits(user.gems)}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">امتیاز (XP)</div>
                  <div className="text-lg font-bold mt-0.5">
                    {toFaDigits(user.xp)} / {toFaDigits(user.nextLevelXp)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">دنبال‌کنندگان</div>
                  <div className="text-lg font-bold mt-0.5">{toFaDigits(user.followersCount)}</div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs text-[#615E55] dark:text-[#A9A497]">دنبال‌شوندگان</div>
                  <div className="text-lg font-bold mt-0.5">{toFaDigits(user.followingCount)}</div>
                </div>
              </div>

              {showChefForm && (
                <form
                  onSubmit={handleRequestChefVerify}
                  className="pt-4 border-t border-[#E5E1D6] dark:border-[#2F2D27] space-y-3"
                >
                  <p className="text-sm font-semibold">درخواست دریافت نشان «سرآشپز تاییدشده»</p>
                  <input
                    type="text"
                    required
                    placeholder="تخصص آشپزی شما (مثلاً غذاهای سنتی جنوب، شیرینی خانگی)"
                    value={chefSpecialty}
                    onChange={(e) => setChefSpecialty(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3.5 text-sm"
                  />
                  <textarea
                    rows={2}
                    required
                    placeholder="معرفی کوتاه سوابق و علاقه آشپزی شما..."
                    value={chefBio}
                    onChange={(e) => setChefBio(e.target.value)}
                    className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[44px] px-5 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-xs font-medium"
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
                  className={`min-h-[44px] px-5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    profileTab === t.id
                      ? 'bg-[#3F523B] text-[#F9F8F4] dark:bg-[#8EA888] dark:text-[#141412]'
                      : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55] dark:text-[#A9A497]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: My Recipes & Bookmarks */}
            {profileTab === 'recipes' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">دستورهای ارسالی من ({toFaDigits(myRecipes.length)})</h2>
                    <button
                      type="button"
                      onClick={onOpenSubmitRecipe}
                      className="text-xs font-medium text-[#3F523B] dark:text-[#8EA888] hover:underline min-h-[40px]"
                    >
                      + ثبت دستور جدید
                    </button>
                  </div>
                  {myRecipes.length === 0 ? (
                    <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
                      هنوز دستوری ثبت نکرده‌اید. با ثبت اولین دستور ۲۰ جِم هدیه بگیرید.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {myRecipes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onOpenRecipe(r)}
                          className="text-right rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden"
                        >
                          <EditorialImage src={r.imageUrl} alt={r.title} aspectClass="aspect-[4/3]" />
                          <div className="p-4 space-y-1">
                            <div className="text-xs text-[#615E55] dark:text-[#A9A497]">
                              {r.status === 'published' ? 'منتشرشده' : 'در انتظار تایید مدیریت'}
                            </div>
                            <div className="text-sm font-bold">{r.title}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6">
                  <h2 className="text-lg font-bold">دستورهای نشانک‌شده ({toFaDigits(bookmarkedRecipes.length)})</h2>
                  {bookmarkedRecipes.length === 0 ? (
                    <p className="text-sm text-[#615E55] dark:text-[#A9A497]">هنوز دستوری را نشانک نکرده‌اید.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {bookmarkedRecipes.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onOpenRecipe(r)}
                          className="text-right rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden"
                        >
                          <EditorialImage src={r.imageUrl} alt={r.title} aspectClass="aspect-[4/3]" />
                          <div className="p-4 space-y-1">
                            <div className="text-xs text-[#615E55] dark:text-[#A9A497]">
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

            {/* Tab 2: My Questions */}
            {profileTab === 'questions' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 text-center tabular-nums">
                  <div>
                    <div className="text-xs text-[#615E55]">سوال‌های من</div>
                    <div className="text-xl font-bold mt-1">{toFaDigits(qaStats.questionsCount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#615E55]">پاسخ‌های ثبت‌شده</div>
                    <div className="text-xl font-bold mt-1">{toFaDigits(qaStats.answersCount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-[#615E55]">بهترین پاسخ‌ها</div>
                    <div className="text-xl font-bold mt-1 text-[#3F523B] dark:text-[#8EA888]">
                      {toFaDigits(qaStats.bestAnswersCount)}
                    </div>
                  </div>
                </div>

                {myQuestions.length === 0 ? (
                  <p className="text-sm text-[#615E55] dark:text-[#A9A497]">
                    هنوز سوالی زیر دستورهای پخت نپرسیده‌اید.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {myQuestions.map((q) => (
                      <div
                        key={q.id}
                        className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 space-y-1.5"
                      >
                        <div className="text-xs text-[#615E55] dark:text-[#A9A497] flex justify-between">
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

            {/* Tab 3: Badges */}
            {profileTab === 'badges' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {badges.map((b) => (
                  <div
                    key={b.id}
                    className={`rounded-2xl border p-5 space-y-3 ${
                      b.unlocked
                        ? 'border-[#3F523B]/40 bg-[#FFFFFF] dark:bg-[#1C1B18]'
                        : 'border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF]/60 dark:bg-[#1C1B18]/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Award
                          className={`w-5 h-5 ${
                            b.unlocked ? 'text-[#3F523B] dark:text-[#8EA888]' : 'text-[#615E55]'
                          }`}
                        />
                        <h3 className="text-sm font-bold">{b.title}</h3>
                      </div>
                      <span className="text-xs text-[#615E55] tabular-nums">
                        {b.unlocked ? 'بازشده' : `${toFaDigits(b.progress)} / ${toFaDigits(b.target)}`}
                      </span>
                    </div>
                    <p className="text-xs text-[#615E55] dark:text-[#A9A497]">{b.description}</p>
                    <div className="h-1.5 rounded-full bg-[#F1EFE8] dark:bg-[#24231F] overflow-hidden">
                      <div
                        className="h-full bg-[#3F523B] dark:bg-[#8EA888]"
                        style={{width: `${Math.round((b.progress / Math.max(1, b.target)) * 100)}%`}}
                      />
                    </div>
                    <p className="text-xs text-[#615E55] dark:text-[#A9A497] tabular-nums">
                      پاداش: +{toFaDigits(b.xpReward)} امتیاز · +{toFaDigits(b.gemReward)} جِم
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Tab 4: Gem Wallet & Coupons */}
            {profileTab === 'gems' && (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-lg font-bold">تبدیل جِم به کوپن تخفیف همکاران</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gemOffers.map((offer) => (
                      <div
                        key={offer.id}
                        className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 flex flex-col justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-[#615E55] dark:text-[#A9A497]">{offer.partnerName}</div>
                          <h3 className="text-base font-bold">{offer.title}</h3>
                          <p className="text-xs text-[#3F523B] dark:text-[#8EA888]">{offer.discountLabel}</p>
                        </div>
                        <button
                          type="button"
                          disabled={user.gems < offer.gemCost}
                          onClick={() => handleRedeemOffer(offer.id)}
                          className="min-h-[44px] px-4 rounded-xl bg-[#3F523B] hover:bg-[#31412E] dark:bg-[#8EA888] dark:text-[#141412] text-[#F9F8F4] text-xs font-medium disabled:opacity-40"
                        >
                          دریافت کوپن با {toFaDigits(offer.gemCost)} جِم
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {coupons.length > 0 && (
                  <div className="space-y-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6">
                    <h2 className="text-base font-bold">کوپن‌های دریافت‌شده من</h2>
                    <div className="space-y-2.5">
                      {coupons.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-bold">{c.title}</div>
                            <div className="text-xs text-[#615E55] dark:text-[#A9A497]">
                              {c.partnerName} · {c.used ? 'استفاده‌شده' : 'قابل استفاده'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(c.code).catch(() => {});
                              onNotify(`کد ${c.code} کپی شد.`);
                            }}
                            className="min-h-[40px] px-3.5 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-mono font-bold inline-flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span dir="ltr">{c.code}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] pt-6">
                  <h2 className="text-base font-bold">تاریخچه تراکنش‌های جِم</h2>
                  <div className="divide-y divide-[#E5E1D6]/70 dark:divide-[#2F2D27] rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18]">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <span>{tx.reason}</span>
                        <span
                          dir="ltr"
                          className={`font-bold tabular-nums ${
                            tx.amount >= 0 ? 'text-[#3F523B] dark:text-[#8EA888]' : 'text-[#A97222]'
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
        )
      ) : (
        /* SECTION 2: PROGRAMMABLE ADMIN ECOSYSTEM PANEL */
        <div className="space-y-8">
          {!adminAuthed ? (
            <form
              onSubmit={handleAdminAuth}
              className="max-w-md mx-auto rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 sm:p-8 space-y-4"
            >
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#3F523B] dark:text-[#8EA888]" />
                <h2 className="text-lg font-bold">
                  {adminConfigured ? 'ورود به پنل مدیریت لاقلی' : 'تنظیم اولیه رمز مدیریت لاقلی'}
                </h2>
              </div>
              <p className="text-xs text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                {adminConfigured
                  ? 'برای برنامه‌ریزی جایگاه‌های نمایش، کنترل ۱۰ صنف صنعت غذا، تایید درخواست‌ها و مشاهده آمار، رمز مدیریت را وارد کنید.'
                  : 'هنوز رمز مدیریتی ثبت نشده است. یک رمز عبور امن (حداقل ۶ کاراکتر) انتخاب کنید تا پنل مدیریت اختصاصی شما فعال شود.'}
              </p>
              {adminError && <p className="text-xs text-red-600">{adminError}</p>}
              <input
                type="password"
                required
                minLength={6}
                placeholder="رمز عبور مدیریت"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-sm"
              />
              <button
                type="submit"
                className="w-full min-h-[48px] rounded-xl bg-[#3F523B] hover:bg-[#31412E] text-[#F9F8F4] text-sm font-medium"
              >
                {adminConfigured ? 'ورود به پنل مدیریت' : 'ثبت رمز و فعال‌سازی پنل مدیریت'}
              </button>
            </form>
          ) : (
            adminConfig && (
              <div className="space-y-8">
                {/* 1. Programmable Placements & Frequency Caps */}
                <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">کنترل برنامه‌پذیر جایگاه‌ها و اصناف</h2>
                      <p className="text-xs text-[#615E55] dark:text-[#A9A497] mt-0.5">
                        تمامی تغییرات بدون نیاز به تغییر کد، به‌صورت زنده روی اپلیکیشن اعمال می‌شوند.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSaveAdminConfig}
                      className="min-h-[44px] px-5 rounded-xl bg-[#3F523B] hover:bg-[#31412E] text-[#F9F8F4] text-sm font-medium"
                    >
                      ذخیره و اعمال زنده
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-4 cursor-pointer">
                      <span>نمایش تب مستقل بازارچه و اصناف</span>
                      <input
                        type="checkbox"
                        checked={adminConfig.marketplaceTabEnabled}
                        onChange={(e) => setAdminConfig({...adminConfig, marketplaceTabEnabled: e.target.checked})}
                        className="w-4 h-4 accent-[#3F523B]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-4 cursor-pointer">
                      <span>ویترین همکاران در صفحه کاوش</span>
                      <input
                        type="checkbox"
                        checked={adminConfig.exploreShowcaseEnabled}
                        onChange={(e) => setAdminConfig({...adminConfig, exploreShowcaseEnabled: e.target.checked})}
                        className="w-4 h-4 accent-[#3F523B]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-4 cursor-pointer">
                      <span>پیوند زمینه‌ای مواد و تجهیزات درون دستور پخت</span>
                      <input
                        type="checkbox"
                        checked={adminConfig.recipeContextEnabled}
                        onChange={(e) => setAdminConfig({...adminConfig, recipeContextEnabled: e.target.checked})}
                        className="w-4 h-4 accent-[#3F523B]"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-3 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-4 cursor-pointer">
                      <span>کارت سرویس ارسال فوری در لیست خرید</span>
                      <input
                        type="checkbox"
                        checked={adminConfig.shoppingDeliveryCardEnabled}
                        onChange={(e) =>
                          setAdminConfig({...adminConfig, shoppingDeliveryCardEnabled: e.target.checked})
                        }
                        className="w-4 h-4 accent-[#3F523B]"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-[#615E55] mb-1">عنوان تب بازارچه</label>
                      <input
                        type="text"
                        value={adminConfig.marketplaceTitle}
                        onChange={(e) => setAdminConfig({...adminConfig, marketplaceTitle: e.target.value})}
                        className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#615E55] mb-1">عنوان کمپین فعال کاوش</label>
                      <input
                        type="text"
                        value={adminConfig.activeCampaignTitle}
                        onChange={(e) => setAdminConfig({...adminConfig, activeCampaignTitle: e.target.value})}
                        className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#615E55] mb-1">سقف کارت همکار در هر دستور (آرامش بصری)</label>
                      <select
                        value={adminConfig.maxPartnerCardsPerRecipe}
                        onChange={(e) =>
                          setAdminConfig({...adminConfig, maxPartnerCardsPerRecipe: Number(e.target.value)})
                        }
                        className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm"
                      >
                        <option value={0}>۰ (خاموش)</option>
                        <option value={1}>۱ کارت (پیشنهادی مینیمال)</option>
                        <option value={2}>۲ کارت</option>
                        <option value={3}>۳ کارت</option>
                      </select>
                    </div>
                  </div>

                  {/* 10 Industry Roles Toggle Matrix */}
                  <div className="space-y-2.5 pt-2 border-t border-[#E5E1D6] dark:border-[#2F2D27]">
                    <p className="text-xs font-semibold text-[#615E55] dark:text-[#A9A497]">
                      فعال/غیرفعال‌سازی ۱۰ نقش صنعت غذا
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {PARTNER_ROLES.map((r) => {
                        const enabled = adminConfig.enabledPartnerRoles.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => togglePartnerRoleInConfig(r.id)}
                            className={`min-h-[42px] px-3.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-colors ${
                              enabled
                                ? 'border-[#3F523B] bg-[#3F523B]/8 text-[#1C1B18] dark:border-[#8EA888] dark:text-[#F4F1EA]'
                                : 'border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55] opacity-60'
                            }`}
                          >
                            <span>{r.label}</span>
                            {enabled && <Check className="w-3.5 h-3.5 text-[#3F523B] dark:text-[#8EA888]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. Approval Queues */}
                {(pendingPartners.length > 0 || pendingRecipes.length > 0 || pendingChefs.length > 0) && (
                  <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 space-y-5">
                    <h2 className="text-lg font-bold">صف تایید مدیریت</h2>

                    {pendingPartners.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-4 py-2 border-b border-[#E5E1D6]/70">
                        <div>
                          <div className="text-sm font-bold">{p.name}</div>
                          <div className="text-xs text-[#615E55]">
                            {PARTNER_ROLE_LABELS[p.roleType]} · {p.city} ·{' '}
                            {p.claimStatus === 'pending' ? 'درخواست مالکیت (Claim)' : 'ثبت‌نام جدید'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/partners/${p.id}/approve`, {method: 'POST', useAdmin: true});
                            onNotify(`کسب‌وکار «${p.name}» تایید شد.`);
                            loadAdminStatusAndOverview();
                          }}
                          className="min-h-[40px] px-4 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-xs font-medium"
                        >
                          تایید و انتشار
                        </button>
                      </div>
                    ))}

                    {pendingRecipes.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-4 py-2 border-b border-[#E5E1D6]/70">
                        <div>
                          <div className="text-sm font-bold">{r.title}</div>
                          <div className="text-xs text-[#615E55]">دستور پخت ارسالی از {r.authorName}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/recipes/${r.id}/approve`, {method: 'POST', useAdmin: true});
                            onNotify(`دستور «${r.title}» منتشر شد.`);
                            loadAdminStatusAndOverview();
                          }}
                          className="min-h-[40px] px-4 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-xs font-medium"
                        >
                          تایید و انتشار
                        </button>
                      </div>
                    ))}

                    {pendingChefs.map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-4 py-2 border-b border-[#E5E1D6]/70">
                        <div>
                          <div className="text-sm font-bold">{c.name}</div>
                          <div className="text-xs text-[#615E55]">درخواست نشان سرآشپز · {c.specialty}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/chefs/${c.id}/approve`, {method: 'POST', useAdmin: true});
                            onNotify(`نشان سرآشپز برای ${c.name} صادر شد.`);
                            loadAdminStatusAndOverview();
                          }}
                          className="min-h-[40px] px-4 rounded-xl bg-[#3F523B] text-[#F9F8F4] text-xs font-medium"
                        >
                          تایید سرآشپز
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. Partner Interaction Analytics */}
                {analytics && (
                  <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 space-y-5">
                    <h2 className="text-lg font-bold">گزارش سنجش تعاملات اصناف (Data Analyst)</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center tabular-nums">
                      <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3">
                        <div className="text-xs text-[#615E55]">نمایش‌ها</div>
                        <div className="text-xl font-bold mt-1">{toFaDigits(analytics.totalImpressions)}</div>
                      </div>
                      <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3">
                        <div className="text-xs text-[#615E55]">بازدید صفحه</div>
                        <div className="text-xl font-bold mt-1">{toFaDigits(analytics.totalProfileOpens)}</div>
                      </div>
                      <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3">
                        <div className="text-xs text-[#615E55]">کپی کد تخفیف</div>
                        <div className="text-xl font-bold mt-1">{toFaDigits(analytics.totalCouponCopies)}</div>
                      </div>
                      <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3">
                        <div className="text-xs text-[#615E55]">مصرف کوپن جِم</div>
                        <div className="text-xl font-bold mt-1">{toFaDigits(analytics.totalGemRedeems)}</div>
                      </div>
                      <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3">
                        <div className="text-xs text-[#615E55]">کلیک افیلیت</div>
                        <div className="text-xl font-bold mt-1">{toFaDigits(analytics.totalAffiliateClicks)}</div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-right tabular-nums">
                        <thead className="text-xs text-[#615E55] border-b border-[#E5E1D6] dark:border-[#2F2D27]">
                          <tr>
                            <th className="py-2.5 font-medium">نام همکار</th>
                            <th className="py-2.5 font-medium">نمایش</th>
                            <th className="py-2.5 font-medium">بازدید صفحه</th>
                            <th className="py-2.5 font-medium">کپی کد</th>
                            <th className="py-2.5 font-medium">کلیک همکاری</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E1D6]/60 dark:divide-[#2F2D27]">
                          {analytics.byPartner.map((row) => (
                            <tr key={row.partnerId}>
                              <td className="py-2.5 font-medium">{row.partnerName}</td>
                              <td className="py-2.5">{toFaDigits(row.impressions)}</td>
                              <td className="py-2.5">{toFaDigits(row.profileOpens)}</td>
                              <td className="py-2.5">{toFaDigits(row.couponCopies)}</td>
                              <td className="py-2.5">{toFaDigits(row.affiliateClicks)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}

      {/* iOS Safari Install Guide Modal */}
      {showIOSGuide && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-4">
            <h3 className="text-lg font-bold">نصب لاقلی روی آیفون و آیپد</h3>
            <ol className="text-sm text-[#615E55] dark:text-[#A9A497] space-y-2 list-decimal list-inside leading-relaxed">
              <li>در نوار پایین مرورگر Safari دکمه <strong>Share</strong> را لمس کنید.</li>
              <li>صفحه را به پایین بکشید و گزینه <strong>Add to Home Screen</strong> را انتخاب نمایید.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full min-h-[44px] rounded-xl bg-[#3F523B] text-[#F9F8F4] text-sm font-medium"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
