import {useCallback, useEffect, useState} from 'react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Coins,
  FileSpreadsheet,
  Image as ImageIcon,
  Layers,
  LogOut,
  Megaphone,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Store,
  Trash2,
  Upload,
  Users,
  Utensils,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {apiRequest, getAdminToken, setAdminToken} from '../lib/api.ts';
import {fileToCompressedDataUrl} from '../lib/imageUpload.ts';
import {
  PARTNER_ROLES,
  PARTNER_ROLE_LABELS,
  formatToman,
  toFaDigits,
} from '../shared/persianEngine.ts';
import type {
  AdminDashboardStats,
  AdminUserRow,
  CampaignPlacement,
  EcosystemConfig,
  OrderRecord,
  Partner,
  PartnerAnalyticsSummary,
  PartnerRoleId,
  Recipe,
  RecipePhoto,
  SponsorCampaign,
  WalletTransaction,
} from '../shared/types.ts';
import {AdminFrontendOpsPanel} from './AdminFrontendOpsPanel.tsx';
import {EditorialImage} from './EditorialImage.tsx';
import {AdminWorkspaceSkeleton} from './EditorialSkeletons.tsx';

type AdminNavId =
  | 'overview'
  | 'recipes'
  | 'photos'
  | 'users'
  | 'partners'
  | 'campaigns'
  | 'frontend_ops'
  | 'ecosystem';

interface AdminDashboardProps {
  onRefreshAppConfig: () => void;
  onRefreshAppRecipes: () => void;
  onBackToApp: () => void;
  onNotify: (msg: string) => void;
}

const PLACEMENT_LABELS: Record<CampaignPlacement, string> = {
  explore_showcase: 'ویترین صفحه کاوش',
  recipe_context: 'کارت زمینه‌ای دستور پخت',
  shopping_delivery: 'پیشنهاد ارسال در لیست خرید',
  marketplace_banner: 'بنر بالای بازارچه اصناف',
};

const ORDER_STATUS_LABELS: Record<OrderRecord['status'], string> = {
  confirmed: 'تاییدشده',
  preparing: 'در حال آماده‌سازی',
  delivering: 'ارسال با پیک',
  delivered: 'تحویل‌شده',
};

const SAMPLE_BULK_JSON = JSON.stringify(
  [
    {
      title: 'قیمه بادمجان مجلسی با سیب‌زمینی خلالی',
      subtitle: 'خورشت اصیل ایرانی با لیموعمانی و عطر دارچین (بدون عکس — آماده ثبت عکس کاربران)',
      category: 'ناهار و شام',
      region: 'تهران',
      season: 'چهارفصل',
      difficulty: 'متوسط',
      prepMinutes: 25,
      cookMinutes: 75,
      servings: 4,
      ingredients: [
        {name: 'گوشت خورشتی', amount: 400, unit: 'گرم'},
        {name: 'لپه', amount: 150, unit: 'گرم'},
        {name: 'بادمجان قلمی', amount: 4, unit: 'عدد'},
        {name: 'رب گوجه‌فرنگی', amount: 2, unit: 'قاشق غذاخوری'},
        {name: 'لیموعمانی', amount: 3, unit: 'عدد'},
      ],
      steps: [
        'پیاز را تفت داده و گوشت را با زردچوبه و فلفل سیاه تفت دهید.',
        'رب گوجه‌فرنگی و لپه خیس‌خورده را اضافه کرده و با آب جوش بپزید.',
        'بادمجان‌های سرخ‌شده و لیموعمانی را در ۳۰ دقیقه پایانی اضافه کنید تا خورشت جا بیفتد.',
      ],
    },
    {
      title: 'خوراک لوبیا چیتی قارچ و سیب‌زمینی',
      subtitle: 'صبحانه و شام مقوی و گیاهی ایرانی با گلپر و آبلیمو تازه',
      category: 'وگان و گیاهی',
      region: 'سراسری',
      season: 'پاییز',
      difficulty: 'آسان',
      prepMinutes: 15,
      cookMinutes: 60,
      servings: 4,
      ingredients: [
        {name: 'لوبیا چیتی', amount: 300, unit: 'گرم'},
        {name: 'قارچ تازه', amount: 200, unit: 'گرم'},
        {name: 'پیاز', amount: 1, unit: 'عدد'},
        {name: 'رب گوجه‌فرنگی', amount: 1.5, unit: 'قاشق غذاخوری'},
      ],
      steps: [
        'لوبیا چیتی را از شب قبل خیس کرده و بپزید تا کاملاً نرم و لعاب‌دار شود.',
        'پیاز و قارچ را تفت داده، رب و ادویه بیفزایید و با لوبیا ۲۰ دقیقه بجوشانید.',
      ],
    },
  ],
  null,
  2
);

export function AdminDashboard({
  onRefreshAppConfig,
  onRefreshAppRecipes,
  onBackToApp,
  onNotify,
}: AdminDashboardProps) {
  const [adminConfigured, setAdminConfigured] = useState(true);
  const [quickTestEnabled, setQuickTestEnabled] = useState(false);
  const [explicitLogout, setExplicitLogout] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(Boolean(getAdminToken()));
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<AdminNavId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Core Admin Data
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [config, setConfig] = useState<EcosystemConfig | null>(null);
  const [analytics, setAnalytics] = useState<PartnerAnalyticsSummary | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [photos, setPhotos] = useState<RecipePhoto[]>([]);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [campaigns, setCampaigns] = useState<SponsorCampaign[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [pendingChefs, setPendingChefs] = useState<{id: string; name: string; city: string; specialty: string}[]>([]);

  // Filters
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeStatusFilter, setRecipeStatusFilter] = useState<'all' | 'published' | 'pending'>('all');
  const [recipePhotoFilter, setRecipePhotoFilter] = useState<'all' | 'without' | 'with'>('all');
  const [photoStatusFilter, setPhotoStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [userSearch, setUserSearch] = useState('');

  // Modals: Recipe Editor / Bulk Import / Wallet Top-up / Partner Create / Campaign Create
  const [editingRecipe, setEditingRecipe] = useState<Recipe | 'new' | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJson, setBulkJson] = useState(SAMPLE_BULK_JSON);
  const [bulkImporting, setBulkImporting] = useState(false);

  const [walletTarget, setWalletTarget] = useState<
    | {type: 'user'; id: string; name: string; currentToman: number; currentGems: number}
    | {type: 'partner'; id: string; name: string; currentToman: number}
    | null
  >(null);
  const [walletCurrency, setWalletCurrency] = useState<'toman' | 'gem'>('toman');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');

  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    roleType: 'food_brands' as PartnerRoleId,
    city: 'تهران',
    neighborhood: 'مرکزی',
    description: '',
    address: '',
    phone: '',
    tier: 'featured' as 'free' | 'featured' | 'sponsor',
    promoCode: '',
    promoLabel: '',
    initialBalance: 0,
  });

  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    partnerId: '',
    title: '',
    subtitle: '',
    placement: 'explore_showcase' as CampaignPlacement,
    promoCode: '',
    ctaLabel: 'مشاهده پیشنهاد',
    budgetToman: 2000000,
    startsAt: '۱۴۰۵/۰۹/۰۱',
    endsAt: '۱۴۰۵/۱۰/۳۰',
  });

  const loadAllAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const statusRes = await apiRequest<{
        configured: boolean;
        authenticated: boolean;
        quickTestLoginEnabled?: boolean;
      }>('/api/admin/status', {
        useAdmin: true,
      });
      setAdminConfigured(statusRes.configured);
      setQuickTestEnabled(Boolean(statusRes.quickTestLoginEnabled));

      let isAuthed = statusRes.authenticated;
      // Seamless Test-Mode Auto-Login (automatically disabled in production when ADMIN_PASSCODE/DISABLE_QUICK_TEST_AUTH is set)
      if (!isAuthed && statusRes.quickTestLoginEnabled && !explicitLogout) {
        try {
          const quickRes = await apiRequest<{adminToken: string}>('/api/admin/quick-test-login', {
            method: 'POST',
          });
          setAdminToken(quickRes.adminToken);
          isAuthed = true;
        } catch {
          // Fall back cleanly to standard login screen
        }
      }

      setAdminAuthed(isAuthed);
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      const [ov, st, recRes, phRes, usrRes, prtRes, cmpRes, txRes, ordRes] = await Promise.all([
        apiRequest<{
          config: EcosystemConfig;
          pendingChefs: {id: string; name: string; city: string; specialty: string}[];
          analytics: PartnerAnalyticsSummary;
        }>('/api/admin/overview', {useAdmin: true}),
        apiRequest<{stats: AdminDashboardStats}>('/api/admin/stats', {useAdmin: true}),
        apiRequest<{recipes: Recipe[]}>('/api/admin/recipes', {useAdmin: true}),
        apiRequest<{photos: RecipePhoto[]}>('/api/admin/photos', {useAdmin: true}),
        apiRequest<{users: AdminUserRow[]}>('/api/admin/users', {useAdmin: true}),
        apiRequest<{partners: Partner[]}>('/api/admin/partners', {useAdmin: true}),
        apiRequest<{campaigns: SponsorCampaign[]}>('/api/admin/campaigns', {useAdmin: true}),
        apiRequest<{transactions: WalletTransaction[]}>('/api/admin/transactions', {useAdmin: true}),
        apiRequest<{orders: OrderRecord[]}>('/api/admin/orders', {useAdmin: true}),
      ]);

      setConfig(ov.config);
      setPendingChefs(ov.pendingChefs);
      setAnalytics(ov.analytics);
      setStats(st.stats);
      setRecipes(recRes.recipes);
      setPhotos(phRes.photos);
      setUsers(usrRes.users);
      setPartners(prtRes.partners);
      setCampaigns(cmpRes.campaigns);
      setTransactions(txRes.transactions);
      setOrders(ordRes.orders);
      if (prtRes.partners.length > 0) {
        setNewCampaign((prev) => (prev.partnerId ? prev : {...prev, partnerId: prtRes.partners[0].id}));
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بارگذاری داده‌های پنل مدیریت');
    } finally {
      setLoading(false);
    }
  }, [onNotify, explicitLogout]);

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  const handleQuickAdminTestLogin = async () => {
    setAuthError(null);
    setExplicitLogout(false);
    try {
      const res = await apiRequest<{adminToken: string; message?: string}>('/api/admin/quick-test-login', {
        method: 'POST',
      });
      setAdminToken(res.adminToken);
      setAdminAuthed(true);
      onNotify(res.message || 'ورود سریع آزمایشی به پنل مدیریت انجام شد.');
      loadAllAdminData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'ورود سریع ناموفق بود.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setExplicitLogout(false);
    try {
      const endpoint = adminConfigured ? '/api/admin/login' : '/api/admin/setup';
      const res = await apiRequest<{adminToken: string; message?: string}>(endpoint, {
        method: 'POST',
        body: JSON.stringify({password}),
      });
      setAdminToken(res.adminToken);
      setPassword('');
      setAdminAuthed(true);
      onNotify(res.message || 'به پنل مدیریت جامع لاقلی خوش آمدید.');
      loadAllAdminData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'ورود ناموفق بود.');
    }
  };

  const handleBulkImport = async () => {
    setBulkImporting(true);
    try {
      const parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) {
        throw new Error('ساختار JSON باید یک آرایه از دستورهای پخت ([ ... ]) باشد.');
      }
      const res = await apiRequest<{importedCount: number; skippedCount: number; errors: string[]}>(
        '/api/admin/recipes/bulk-import',
        {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify({recipes: parsed, defaultStatus: 'published'}),
        }
      );
      onNotify(
        `${toFaDigits(res.importedCount)} دستور پخت با موفقیت وارد شد${
          res.skippedCount > 0 ? ` (${toFaDigits(res.skippedCount)} مورد رد شد)` : ''
        }.`
      );
      setBulkOpen(false);
      onRefreshAppRecipes();
      loadAllAdminData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'فرمت JSON نامعتبر است.');
    } finally {
      setBulkImporting(false);
    }
  };

  const handleModeratePhoto = async (photoId: string, action: 'approve' | 'approve_cover' | 'reject') => {
    try {
      await apiRequest(`/api/admin/photos/${photoId}/moderate`, {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({action}),
      });
      onNotify(
        action === 'approve_cover'
          ? 'عکس تایید و به‌عنوان تصویر اصلی دستور پخت تنظیم شد (+پاداش جِم کاربر).'
          : action === 'approve'
            ? 'عکس در گالری کاربران تایید و منتشر شد.'
            : 'عکس رد شد.'
      );
      onRefreshAppRecipes();
      loadAllAdminData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بررسی عکس');
    }
  };

  const handleWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletTarget) return;
    const numericAmount = Number(walletAmount);
    if (!Number.isInteger(numericAmount) || numericAmount === 0) {
      onNotify('لطفاً مبلغ صحیح غیرصفر وارد کنید (مثبت برای شارژ، منفی برای کسر).');
      return;
    }
    try {
      if (walletTarget.type === 'user') {
        await apiRequest(`/api/admin/users/${walletTarget.id}/wallet`, {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify({currency: walletCurrency, amount: numericAmount, reason: walletReason}),
        });
      } else {
        await apiRequest(`/api/admin/partners/${walletTarget.id}/wallet`, {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify({amount: numericAmount, reason: walletReason}),
        });
      }
      onNotify('تراکنش مالی با موفقیت ثبت و موجودی به‌روزرسانی شد.');
      setWalletTarget(null);
      setWalletAmount('');
      setWalletReason('');
      loadAllAdminData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت تراکنش مالی');
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/partners', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify(newPartner),
      });
      onNotify('حساب تجاری همکار با موفقیت ایجاد شد.');
      setPartnerModalOpen(false);
      setNewPartner({
        name: '',
        roleType: 'food_brands',
        city: 'تهران',
        neighborhood: 'مرکزی',
        description: '',
        address: '',
        phone: '',
        tier: 'featured',
        promoCode: '',
        promoLabel: '',
        initialBalance: 0,
      });
      onRefreshAppConfig();
      loadAllAdminData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ایجاد همکار تجاری');
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/admin/campaigns', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify(newCampaign),
      });
      onNotify('کمپین اسپانسری با موفقیت ایجاد و فعال شد.');
      setCampaignModalOpen(false);
      onRefreshAppConfig();
      loadAllAdminData();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ایجاد کمپین');
    }
  };

  const handleSaveEcosystem = async () => {
    if (!config) return;
    try {
      await apiRequest('/api/admin/config', {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify(config),
      });
      onRefreshAppConfig();
      onNotify('تنظیمات برنامه‌پذیر اکوسیستم به‌صورت زنده اعمال شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات');
    }
  };

  // Unauthenticated Gate
  if (!adminAuthed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-md rounded-3xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-8 space-y-5 shadow-[0_20px_50px_-30px_rgba(28,27,24,0.2)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#B54B1F]/10 dark:bg-[#E29A6F]/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />
              </div>
              <div>
                <h1 className="text-lg font-bold">
                  {adminConfigured ? 'ورود به میز کار مدیریت لاقلی' : 'راه‌اندازی اولیه رمز مدیریت لاقلی'}
                </h1>
                <p className="text-xs text-[#615E55] dark:text-[#A9A497]">نسخه دسکتاپ و ریسپانسیو</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#615E55] dark:text-[#A9A497] leading-relaxed">
            {adminConfigured
              ? 'برای مدیریت دستورهای پخت و ورود دسته‌ای، تایید عکس‌های واقعی کاربران، شارژ کیف پول کاربری و تجاری، اسپانسرها و کنترل اکوسیستم وارد شوید.'
              : 'هنوز رمز مدیریت تعریف نشده است. یک رمز امن (حداقل ۶ کاراکتر) تعیین کنید تا دسترسی پنل مدیریت جامع فعال شود.'}
          </p>

          {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}

          {quickTestEnabled && (
            <button
              type="button"
              onClick={handleQuickAdminTestLogin}
              className="w-full min-h-[48px] rounded-full bg-[#0D0D0D] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] text-[#FFFFFF] text-sm font-semibold transition-all active:scale-[0.98]"
            >
              ورود سریع آزمایشی به پنل مدیریت (بدون رمز)
            </button>
          )}

          <input
            type="password"
            required
            minLength={6}
            placeholder="رمز عبور مدیریت"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-4 text-sm"
          />

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              className="flex-1 min-h-[48px] rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#141412] text-[#F9F8F4] text-sm font-semibold"
            >
              {adminConfigured ? 'ورود با رمز مدیریت' : 'ثبت رمز و فعال‌سازی پنل'}
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[48px] px-4 rounded-full border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium"
            >
              بازگشت
            </button>
          </div>
        </form>
      </div>
    );
  }

  const navItems: {id: AdminNavId; label: string; icon: typeof BarChart3; badge?: number}[] = [
    {id: 'overview', label: 'داشبورد و آمار', icon: BarChart3},
    {
      id: 'recipes',
      label: 'دستورهای پخت و ورود دسته‌ای',
      icon: BookOpen,
      badge: stats?.recipesWithoutPhoto || undefined,
    },
    {
      id: 'photos',
      label: 'مدیریت عکس‌های کاربران',
      icon: Camera,
      badge: stats?.pendingPhotosCount || undefined,
    },
    {id: 'users', label: 'کاربران و شارژ حساب کاربری', icon: Users},
    {
      id: 'partners',
      label: 'اصناف و شارژ حساب تجاری',
      icon: Store,
      badge: stats?.pendingPartnersCount || undefined,
    },
    {id: 'campaigns', label: 'اسپانسرها و تبلیغات', icon: Megaphone, badge: stats?.activeCampaignsCount || undefined},
    {id: 'frontend_ops', label: 'منوی روز، یخچال، جِم و نظرات', icon: Utensils},
    {id: 'ecosystem', label: 'اکوسیستم، سفارش‌ها و مالی', icon: Settings},
  ];

  const filteredRecipes = recipes.filter((r) => {
    if (recipeStatusFilter !== 'all' && r.status !== recipeStatusFilter) return false;
    const hasPhoto = Boolean(r.imageUrl && r.imageUrl.trim().length > 0);
    if (recipePhotoFilter === 'without' && hasPhoto) return false;
    if (recipePhotoFilter === 'with' && !hasPhoto) return false;
    if (recipeSearch.trim()) {
      const q = recipeSearch.trim().toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.authorName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredPhotos = photos.filter((p) => (photoStatusFilter === 'all' ? true : p.status === photoStatusFilter));
  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return u.name.toLowerCase().includes(q) || u.phone.includes(q) || u.city.toLowerCase().includes(q);
  });

  return (
    <div className="max-w-[1440px] mx-auto w-full">
      {/* Desktop-First Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E5E1D6] dark:border-[#2F2D27]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="منوی مدیریت"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden min-h-[42px] min-w-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs text-[#615E55] dark:text-[#A9A497]">
              <span>میز کار جامع مدیریت لاقلی</span>
              <span aria-hidden="true">·</span>
              <span>کنترل محتوا، عکس کاربران، مالی و اسپانسرها</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
              {navItems.find((n) => n.id === activeNav)?.label}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAllAdminData}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>
          <button
            type="button"
            onClick={onBackToApp}
            className="min-h-[42px] px-4 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] text-xs font-medium"
          >
            نمایش وب‌اپ کاربران
          </button>
          <button
            type="button"
            onClick={() => {
              setExplicitLogout(true);
              setAdminToken(null);
              setAdminAuthed(false);
              onNotify('از پنل مدیریت خارج شدید.');
            }}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs text-[#615E55] inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج مدیر</span>
          </button>
        </div>
      </div>

      {/* Desktop-First 2-Column Workspace (Sticky Sidebar + Wide Fluid Main Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RTL Right Sidebar */}
        <aside
          className={`${
            mobileMenuOpen ? 'block' : 'hidden'
          } lg:block lg:col-span-3 xl:col-span-2 lg:sticky lg:top-20 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-2.5 space-y-1`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full min-h-[44px] px-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                  active
                    ? 'bg-[#B54B1F] text-[#F9F8F4] dark:bg-[#E29A6F] dark:text-[#141412]'
                    : 'text-[#615E55] dark:text-[#A9A497] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA]'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums shrink-0 ${
                      active
                        ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#141412]'
                        : 'bg-[#A97222]/15 text-[#A97222] dark:text-[#D8A85B]'
                    }`}
                  >
                    {toFaDigits(item.badge)}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Workspace Canvas */}
        <div className="lg:col-span-9 xl:col-span-10 space-y-6 min-w-0">
          {loading && !stats && <AdminWorkspaceSkeleton />}

          {/* =========================================================
              1. OVERVIEW & ANALYTICS
          ========================================================= */}
          {activeNav === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
                <KpiCard
                  label="کل دستورهای پخت"
                  value={toFaDigits(stats.totalRecipes)}
                  hint={`${toFaDigits(stats.recipesWithoutPhoto)} دستور بدون عکس`}
                />
                <KpiCard
                  label="عکس‌های در صف تایید"
                  value={toFaDigits(stats.pendingPhotosCount)}
                  hint={`${toFaDigits(stats.approvedPhotosCount)} عکس واقعی تاییدشده`}
                  accent
                />
                <KpiCard
                  label="کاربران و سرآشپزها"
                  value={toFaDigits(stats.totalUsers)}
                  hint={`${toFaDigits(stats.verifiedChefsCount)} سرآشپز تاییدشده`}
                />
                <KpiCard
                  label="اصناف و کمپین فعال"
                  value={toFaDigits(stats.totalPartners)}
                  hint={`${toFaDigits(stats.activeCampaignsCount)} کمپین اسپانسری فعال`}
                />
                <KpiCard
                  label="مجموع کیف پول کاربران"
                  value={formatToman(stats.totalUserWalletToman)}
                  hint="تومان (قابل شارژ از بخش کاربران)"
                />
                <KpiCard
                  label="مجموع حساب تجاری اصناف"
                  value={formatToman(stats.totalPartnerWalletToman)}
                  hint="تومان (بودجه تبلیغات و اسپانسری)"
                />
                <KpiCard
                  label="سفارش‌های غذای روز"
                  value={toFaDigits(stats.totalOrdersCount)}
                  hint="سفره ادیتوریال لاقلی"
                />
                <KpiCard
                  label="تعاملات اسپانسری"
                  value={toFaDigits(
                    (analytics?.totalImpressions || 0) + (analytics?.totalAffiliateClicks || 0)
                  )}
                  hint={`${toFaDigits(analytics?.totalCouponCopies || 0)} کپی کد تخفیف`}
                />
              </div>

              {/* Actionable Quick Queues */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold">اقدامات فوری مدیریت</h2>
                    <button
                      type="button"
                      onClick={() => setBulkOpen(true)}
                      className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:underline"
                    >
                      + ورود دسته‌ای دستورها
                    </button>
                  </div>
                  <div className="space-y-2.5 text-sm">
                    <QuickRow
                      label="عکس‌های واقعی کاربران در انتظار بررسی"
                      count={stats.pendingPhotosCount}
                      actionLabel="بررسی و انتخاب تصویر اصلی"
                      onClick={() => {
                        setPhotoStatusFilter('pending');
                        setActiveNav('photos');
                      }}
                    />
                    <QuickRow
                      label="دستورهای پخت بدون عکس (آماده عکاسی کاربران)"
                      count={stats.recipesWithoutPhoto}
                      actionLabel="مشاهده فهرست"
                      onClick={() => {
                        setRecipePhotoFilter('without');
                        setActiveNav('recipes');
                      }}
                    />
                    <QuickRow
                      label="دستورهای ارسالی کاربران در انتظار انتشار"
                      count={stats.pendingRecipesCount}
                      actionLabel="بررسی دستورها"
                      onClick={() => {
                        setRecipeStatusFilter('pending');
                        setActiveNav('recipes');
                      }}
                    />
                    <QuickRow
                      label="کسب‌وکارهای در انتظار تایید یا Claim"
                      count={stats.pendingPartnersCount}
                      actionLabel="مدیریت اصناف"
                      onClick={() => setActiveNav('partners')}
                    />
                  </div>
                </div>

                {/* Pending Chef Verifications & Partner Analytics */}
                <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-4">
                  <h2 className="text-base font-bold">عملکرد اصناف و اسپانسرها</h2>
                  {analytics && analytics.byPartner.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right tabular-nums">
                        <thead>
                          <tr className="border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55]">
                            <th className="py-2 font-medium">نام همکار</th>
                            <th className="py-2 font-medium">نمایش</th>
                            <th className="py-2 font-medium">بازدید</th>
                            <th className="py-2 font-medium">کوپن</th>
                            <th className="py-2 font-medium">کلیک خرید</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E5E1D6]/60 dark:divide-[#2F2D27]">
                          {analytics.byPartner.slice(0, 6).map((row) => (
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
                  ) : (
                    <p className="text-xs text-[#615E55]">داده‌ای ثبت نشده است.</p>
                  )}

                  {pendingChefs.length > 0 && (
                    <div className="pt-3 border-t border-[#E5E1D6] dark:border-[#2F2D27] space-y-2">
                      <p className="text-xs font-semibold text-[#A97222]">درخواست‌های نشان سرآشپز تاییدشده</p>
                      {pendingChefs.map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                          <span>
                            {c.name} ({c.city}) — {c.specialty}
                          </span>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiRequest(`/api/admin/chefs/${c.id}/approve`, {method: 'POST', useAdmin: true});
                              onNotify(`نشان سرآشپز برای ${c.name} تایید شد.`);
                              loadAllAdminData();
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#B54B1F] text-white"
                          >
                            تایید نشان
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              2. RECIPES CMS + BULK IMPORT FOR THOUSANDS OF RECIPES
          ========================================================= */}
          {activeNav === 'recipes' && (
            <div className="space-y-5">
              {/* Top Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                  <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                    <Search className="w-4 h-4 text-[#615E55] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      placeholder="جست‌وجو در عنوان، دسته، شهر یا نویسنده..."
                      className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] pr-9 pl-3 text-xs"
                    />
                  </div>
                  <select
                    value={recipeStatusFilter}
                    onChange={(e) => setRecipeStatusFilter(e.target.value as 'all' | 'published' | 'pending')}
                    className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="published">منتشرشده</option>
                    <option value="pending">در انتظار تایید</option>
                  </select>
                  <select
                    value={recipePhotoFilter}
                    onChange={(e) => setRecipePhotoFilter(e.target.value as 'all' | 'without' | 'with')}
                    className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                  >
                    <option value="all">همه (با عکس و بدون عکس)</option>
                    <option value="without">فقط بدون عکس (نیازمند عکس کاربران)</option>
                    <option value="with">فقط دارای تصویر اصلی</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setBulkOpen(true)}
                    className="min-h-[42px] px-4 rounded-xl border border-[#B54B1F]/40 dark:border-[#E29A6F]/40 text-[#B54B1F] dark:text-[#E29A6F] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#B54B1F]/8"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>ورود دسته‌ای (هزاران دستور)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingRecipe('new')}
                    className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#141412] text-[#F9F8F4] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تولید دستور جدید</span>
                  </button>
                </div>
              </div>

              {/* Desktop Recipes Table */}
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-[#F9F8F4] dark:bg-[#141412] border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55] dark:text-[#A9A497]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">تصویر و عنوان دستور</th>
                        <th className="py-3.5 px-3 font-medium">دسته / منطقه</th>
                        <th className="py-3.5 px-3 font-medium">نویسنده</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت عکس</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت انتشار</th>
                        <th className="py-3.5 px-4 font-medium text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D6]/70 dark:divide-[#2F2D27]">
                      {filteredRecipes.map((rec) => {
                        const hasPhoto = Boolean(rec.imageUrl && rec.imageUrl.trim().length > 0);
                        return (
                          <tr
                            key={rec.id}
                            className="hover:bg-[#F9F8F4]/70 dark:hover:bg-[#141412]/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3 min-w-[240px]">
                                <div className="w-14 h-11 rounded-lg overflow-hidden border border-[#E5E1D6] dark:border-[#2F2D27] shrink-0">
                                  <EditorialImage
                                    src={rec.imageUrl}
                                    alt={rec.title}
                                    aspectClass="h-full"
                                    compactEmpty
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm truncate max-w-[280px]">{rec.title}</div>
                                  <div className="text-[11px] text-[#615E55] dark:text-[#A9A497] tabular-nums">
                                    {toFaDigits(rec.ingredients.length)} ماده · {toFaDigits(rec.steps.length)} مرحله
                                    {rec.isVip ? ` · ویژه (${toFaDigits(rec.vipGemCost)} جِم)` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div>{rec.category}</div>
                              <div className="text-[11px] text-[#615E55]">{rec.region}</div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">{rec.authorName}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {hasPhoto ? (
                                <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">
                                  دارای تصویر {rec.photoCreditName ? `(از ${rec.photoCreditName})` : ''}
                                </span>
                              ) : (
                                <span className="text-[#A97222] dark:text-[#D8A85B] font-medium">
                                  بدون عکس — منتظر کاربران
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={
                                  rec.status === 'published'
                                    ? 'text-[#B54B1F] dark:text-[#E29A6F] font-medium'
                                    : 'text-[#A97222] font-medium'
                                }
                              >
                                {rec.status === 'published' ? 'منتشرشده' : 'در انتظار تایید'}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-left">
                              <div className="inline-flex items-center gap-1.5">
                                {rec.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await apiRequest(`/api/admin/recipes/${rec.id}/approve`, {
                                        method: 'POST',
                                        useAdmin: true,
                                      });
                                      onNotify(`دستور «${rec.title}» منتشر شد.`);
                                      onRefreshAppRecipes();
                                      loadAllAdminData();
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#B54B1F] text-white text-[11px]"
                                  >
                                    انتشار
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label="ویرایش دستور"
                                  onClick={() => setEditingRecipe(rec)}
                                  className="p-2 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="حذف دستور"
                                  onClick={async () => {
                                    await apiRequest(`/api/admin/recipes/${rec.id}`, {
                                      method: 'DELETE',
                                      useAdmin: true,
                                    });
                                    onNotify(`دستور «${rec.title}» حذف شد.`);
                                    onRefreshAppRecipes();
                                    loadAllAdminData();
                                  }}
                                  className="p-2 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              3. COMMUNITY PHOTO MODERATION & COVER PROMOTION
          ========================================================= */}
          {activeNav === 'photos' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">تایید عکس‌های واقعی غذای پخته‌شده توسط کاربران</p>
                  <p className="text-xs text-[#615E55] dark:text-[#A9A497]">
                    با یک کلیک عکس واقعی کاربر را به‌عنوان تصویر اصلی دستور پخت تنظیم کنید تا نام او درج شود و پاداش جِم بگیرد.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      {id: 'pending', label: 'در انتظار بررسی'},
                      {id: 'approved', label: 'تاییدشده'},
                      {id: 'rejected', label: 'ردشده'},
                      {id: 'all', label: 'همه'},
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPhotoStatusFilter(tab.id)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-medium ${
                        photoStatusFilter === tab.id
                          ? 'bg-[#B54B1F] text-white dark:bg-[#E29A6F] dark:text-[#141412]'
                          : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPhotos.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-12 text-center space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto text-[#615E55]/50" />
                  <p className="text-sm font-medium">در این فیلتر عکسی برای نمایش وجود ندارد.</p>
                  <p className="text-xs text-[#615E55]">
                    وقتی کاربران از صفحه دستور پخت عکس واقعی غذای خود را آپلود کنند، اینجا نمایش داده می‌شود.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredPhotos.map((ph) => (
                    <div
                      key={ph.id}
                      className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[4/3] bg-[#F1EFE8] dark:bg-[#24231F] relative">
                          <img
                            src={ph.imageUrl}
                            alt={ph.recipeTitle || 'عکس ارسالی کاربر'}
                            className="w-full h-full object-cover"
                          />
                          {!ph.recipeHasCover && (
                            <span className="absolute top-3 right-3 rounded-lg bg-[#A97222] text-white px-2.5 py-1 text-[11px] font-medium">
                              دستور فاقد عکس اصلی!
                            </span>
                          )}
                          {ph.isCover && (
                            <span className="absolute top-3 left-3 rounded-lg bg-[#B54B1F] text-white px-2.5 py-1 text-[11px] font-medium">
                              تصویر اصلی فعلی
                            </span>
                          )}
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-[#615E55]">
                            <span>ارسالی از: {ph.userName}</span>
                            <span className="font-medium">
                              {ph.status === 'pending'
                                ? 'در انتظار بررسی'
                                : ph.status === 'approved'
                                  ? 'تاییدشده'
                                  : 'ردشده'}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold">{ph.recipeTitle || ph.recipeId}</h3>
                          {ph.caption && (
                            <p className="text-xs text-[#615E55] dark:text-[#A9A497] leading-relaxed">{ph.caption}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 pt-0 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleModeratePhoto(ph.id, 'approve_cover')}
                          className="w-full min-h-[40px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#141412] text-[#F9F8F4] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تایید و انتخاب به‌عنوان تصویر اصلی دستور</span>
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleModeratePhoto(ph.id, 'approve')}
                            className="min-h-[38px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]"
                          >
                            فقط تایید گالری
                          </button>
                          <button
                            type="button"
                            onClick={() => handleModeratePhoto(ph.id, 'reject')}
                            className="min-h-[38px] rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 text-xs font-medium inline-flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>رد عکس</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              4. USERS MANAGEMENT & USER WALLET (TOMAN & GEMS) TOP-UP
          ========================================================= */}
          {activeNav === 'users' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#615E55] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="جست‌وجوی کاربر با نام، شماره موبایل یا شهر..."
                    className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] pr-9 pl-3 text-xs"
                  />
                </div>
                <div className="text-xs text-[#615E55] tabular-nums">
                  مجموع کاربران: {toFaDigits(filteredUsers.length)} نفر
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right tabular-nums">
                    <thead className="bg-[#F9F8F4] dark:bg-[#141412] border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">کاربر و موبایل</th>
                        <th className="py-3.5 px-3 font-medium">نقش و نشان</th>
                        <th className="py-3.5 px-3 font-medium">کیف پول (تومان)</th>
                        <th className="py-3.5 px-3 font-medium">کیف جِم</th>
                        <th className="py-3.5 px-3 font-medium">مشارکت</th>
                        <th className="py-3.5 px-4 font-medium text-left">مدیریت و شارژ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D6]/70 dark:divide-[#2F2D27]">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className={u.isSuspended ? 'opacity-55' : ''}>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.isVerifiedChef && (
                                <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                              )}
                            </div>
                            <div className="text-[11px] text-[#615E55]" dir="ltr">
                              {toFaDigits(u.phone)} · {u.city}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <select
                              value={u.role}
                              onChange={async (e) => {
                                await apiRequest(`/api/admin/users/${u.id}`, {
                                  method: 'PATCH',
                                  useAdmin: true,
                                  body: JSON.stringify({role: e.target.value}),
                                });
                                onNotify(`نقش ${u.name} به‌روزرسانی شد.`);
                                loadAllAdminData();
                              }}
                              className="min-h-[34px] rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2 text-xs"
                            >
                              <option value="user">کاربر عادی</option>
                              <option value="chef">سرآشپز</option>
                              <option value="partner">حساب تجاری</option>
                              <option value="admin">مدیر</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#B54B1F] dark:text-[#E29A6F]">
                            {formatToman(u.walletBalance)}
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#A97222] dark:text-[#D8A85B]">
                            {toFaDigits(u.gems)} جِم
                          </td>
                          <td className="py-3.5 px-3 text-[#615E55]">
                            {toFaDigits(u.recipesCount)} دستور · {toFaDigits(u.photosCount)} عکس
                          </td>
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setWalletCurrency('toman');
                                  setWalletAmount('500000');
                                  setWalletReason('شارژ کیف پول کاربری توسط مدیریت');
                                  setWalletTarget({
                                    type: 'user',
                                    id: u.id,
                                    name: u.name,
                                    currentToman: u.walletBalance,
                                    currentGems: u.gems,
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#B54B1F] text-white text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <Wallet className="w-3.5 h-3.5" />
                                <span>شارژ حساب / جِم</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/admin/users/${u.id}`, {
                                    method: 'PATCH',
                                    useAdmin: true,
                                    body: JSON.stringify({isVerifiedChef: !u.isVerifiedChef}),
                                  });
                                  onNotify('وضعیت نشان سرآشپز تغییر یافت.');
                                  loadAllAdminData();
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-[11px]"
                              >
                                {u.isVerifiedChef ? 'لغو نشان' : 'تایید سرآشپز'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await apiRequest(`/api/admin/users/${u.id}`, {
                                    method: 'PATCH',
                                    useAdmin: true,
                                    body: JSON.stringify({isSuspended: !u.isSuspended}),
                                  });
                                  onNotify(u.isSuspended ? 'حساب کاربری فعال شد.' : 'حساب کاربری مسدود شد.');
                                  loadAllAdminData();
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-[11px] text-red-600"
                              >
                                {u.isSuspended ? 'رفع مسدودی' : 'مسدود'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              5. PARTNERS & COMMERCIAL ACCOUNT WALLET TOP-UP
          ========================================================= */}
          {activeNav === 'partners' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4">
                <div>
                  <h2 className="text-sm font-bold">مدیریت حساب‌های تجاری، اصناف و شارژ اعتبار تبلیغاتی</h2>
                  <p className="text-xs text-[#615E55]">
                    کنترل ۱۰ رسته صنعت غذا، ارتقا به اسپانسر، تایید درخواست مالکیت و شارژ کیف پول تجاری (تومان)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPartnerModalOpen(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت حساب تجاری جدید</span>
                </button>
              </div>

              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right tabular-nums">
                    <thead className="bg-[#F9F8F4] dark:bg-[#141412] border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">نام کسب‌وکار</th>
                        <th className="py-3.5 px-3 font-medium">رسته صنفی / شهر</th>
                        <th className="py-3.5 px-3 font-medium">سطح همکاری</th>
                        <th className="py-3.5 px-3 font-medium">حساب تجاری (تومان)</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت</th>
                        <th className="py-3.5 px-4 font-medium text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E1D6]/70 dark:divide-[#2F2D27]">
                      {partners.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.verified && <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />}
                            </div>
                            <div className="text-[11px] text-[#615E55]">
                              {p.promoCode ? `کد تخفیف: ${p.promoCode}` : p.phone}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div>{PARTNER_ROLE_LABELS[p.roleType]}</div>
                            <div className="text-[11px] text-[#615E55]">{p.city}</div>
                          </td>
                          <td className="py-3.5 px-3">
                            <select
                              value={p.tier}
                              onChange={async (e) => {
                                await apiRequest(`/api/admin/partners/${p.id}`, {
                                  method: 'PUT',
                                  useAdmin: true,
                                  body: JSON.stringify({tier: e.target.value}),
                                });
                                onNotify(`سطح همکاری ${p.name} به‌روزرسانی شد.`);
                                onRefreshAppConfig();
                                loadAllAdminData();
                              }}
                              className="min-h-[34px] rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2 text-xs"
                            >
                              <option value="free">رایگان (پایه)</option>
                              <option value="featured">برگزیده (Featured)</option>
                              <option value="sponsor">اسپانسر (Sponsor)</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-3 font-bold text-[#B54B1F] dark:text-[#E29A6F]">
                            {formatToman(p.businessBalance)}
                          </td>
                          <td className="py-3.5 px-3">
                            {p.status === 'pending' || p.claimStatus === 'pending' ? (
                              <span className="text-[#A97222] font-medium">در انتظار تایید</span>
                            ) : (
                              <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">تاییدشده</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-left whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setWalletAmount('2000000');
                                  setWalletReason('شارژ اعتبار تجاری کمپین اسپانسری');
                                  setWalletTarget({
                                    type: 'partner',
                                    id: p.id,
                                    name: p.name,
                                    currentToman: p.businessBalance,
                                  });
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[#B54B1F] text-white text-[11px] font-medium inline-flex items-center gap-1"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>شارژ حساب تجاری</span>
                              </button>
                              {(p.status === 'pending' || p.claimStatus === 'pending') && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await apiRequest(`/api/admin/partners/${p.id}/approve`, {
                                      method: 'POST',
                                      useAdmin: true,
                                    });
                                    onNotify(`کسب‌وکار ${p.name} تایید شد.`);
                                    onRefreshAppConfig();
                                    loadAllAdminData();
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border border-[#B54B1F] text-[#B54B1F] text-[11px]"
                                >
                                  تایید نهایی
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              6. SPONSORS & ADS CAMPAIGNS MANAGER
          ========================================================= */}
          {activeNav === 'campaigns' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4">
                <div>
                  <h2 className="text-sm font-bold">مدیریت اسپانسرها، جایگاه‌های تبلیغاتی و کمپین‌ها</h2>
                  <p className="text-xs text-[#615E55]">
                    کمپین‌های فعال به‌صورت ادیتوریال و بدون شلوغی در جایگاه تعیین‌شده وب‌اپ نمایش داده می‌شوند.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setCampaignModalOpen(true)}
                  className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>ساخت کمپین اسپانسری جدید</span>
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {campaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-[#615E55]">
                          <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F]">{camp.partnerName}</span>
                          <span>·</span>
                          <span>{PLACEMENT_LABELS[camp.placement]}</span>
                        </div>
                        <h3 className="text-base font-bold">{camp.title}</h3>
                        {camp.subtitle && <p className="text-xs text-[#615E55]">{camp.subtitle}</p>}
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          camp.status === 'active'
                            ? 'text-[#B54B1F] dark:text-[#E29A6F]'
                            : 'text-[#615E55]'
                        }`}
                      >
                        {camp.status === 'active' ? 'فعال' : camp.status === 'paused' ? 'متوقف' : 'پایان‌یافته'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#E5E1D6]/70 dark:border-[#2F2D27] text-xs tabular-nums">
                      <div>
                        <div className="text-[#615E55]">بودجه کل</div>
                        <div className="font-bold mt-0.5">{formatToman(camp.budgetToman)}</div>
                      </div>
                      <div>
                        <div className="text-[#615E55]">نمایش / کلیک</div>
                        <div className="font-bold mt-0.5">
                          {toFaDigits(camp.impressions)} / {toFaDigits(camp.clicks)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#615E55]">کد تخفیف</div>
                        <div className="font-bold font-mono mt-0.5" dir="ltr">
                          {camp.promoCode || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#615E55]">
                        بازه: {camp.startsAt || '—'} تا {camp.endsAt || '—'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const nextStatus = camp.status === 'active' ? 'paused' : 'active';
                            await apiRequest(`/api/admin/campaigns/${camp.id}`, {
                              method: 'PUT',
                              useAdmin: true,
                              body: JSON.stringify({status: nextStatus}),
                            });
                            onNotify(nextStatus === 'active' ? 'کمپین فعال شد.' : 'کمپین موقتاً متوقف شد.');
                            onRefreshAppConfig();
                            loadAllAdminData();
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] text-xs font-medium"
                        >
                          {camp.status === 'active' ? 'توقف موقت' : 'فعال‌سازی'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await apiRequest(`/api/admin/campaigns/${camp.id}`, {
                              method: 'DELETE',
                              useAdmin: true,
                            });
                            onNotify('کمپین حذف شد.');
                            onRefreshAppConfig();
                            loadAllAdminData();
                          }}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================
              7. PROGRAMMABLE ECOSYSTEM, DAILY ORDERS & FINANCIAL LEDGER
          ========================================================= */}
          {activeNav === 'ecosystem' && config && (
            <div className="space-y-6">
              {/* Programmable Controls */}
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold">کنترل برنامه‌پذیر جایگاه‌ها و ۱۰ نقش صنعت غذا</h2>
                    <p className="text-xs text-[#615E55]">اعمال زنده بدون نیاز به تغییر کد</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveEcosystem}
                    className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold"
                  >
                    ذخیره و اعمال زنده
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center justify-between rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5 cursor-pointer">
                    <span>نمایش تب مستقل بازارچه و اصناف</span>
                    <input
                      type="checkbox"
                      checked={config.marketplaceTabEnabled}
                      onChange={(e) => setConfig({...config, marketplaceTabEnabled: e.target.checked})}
                      className="w-4 h-4 accent-[#B54B1F]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5 cursor-pointer">
                    <span>ویترین همکاران و کمپین در صفحه کاوش</span>
                    <input
                      type="checkbox"
                      checked={config.exploreShowcaseEnabled}
                      onChange={(e) => setConfig({...config, exploreShowcaseEnabled: e.target.checked})}
                      className="w-4 h-4 accent-[#B54B1F]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5 cursor-pointer">
                    <span>پیوند زمینه‌ای مواد و تجهیزات در دستور پخت</span>
                    <input
                      type="checkbox"
                      checked={config.recipeContextEnabled}
                      onChange={(e) => setConfig({...config, recipeContextEnabled: e.target.checked})}
                      className="w-4 h-4 accent-[#B54B1F]"
                    />
                  </label>
                  <label className="flex items-center justify-between rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5 cursor-pointer">
                    <span>کارت سرویس ارسال فوری در لیست خرید</span>
                    <input
                      type="checkbox"
                      checked={config.shoppingDeliveryCardEnabled}
                      onChange={(e) => setConfig({...config, shoppingDeliveryCardEnabled: e.target.checked})}
                      className="w-4 h-4 accent-[#B54B1F]"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-[#615E55] mb-1">عنوان تب بازارچه</label>
                    <input
                      type="text"
                      value={config.marketplaceTitle}
                      onChange={(e) => setConfig({...config, marketplaceTitle: e.target.value})}
                      className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#615E55] mb-1">عنوان کمپین فعال کاوش</label>
                    <input
                      type="text"
                      value={config.activeCampaignTitle}
                      onChange={(e) => setConfig({...config, activeCampaignTitle: e.target.value})}
                      className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#615E55] mb-1">سقف کارت همکار در هر دستور</label>
                    <select
                      value={config.maxPartnerCardsPerRecipe}
                      onChange={(e) => setConfig({...config, maxPartnerCardsPerRecipe: Number(e.target.value)})}
                      className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
                    >
                      <option value={0}>۰ (خاموش)</option>
                      <option value={1}>۱ کارت (مینیمال پیشنهادی)</option>
                      <option value={2}>۲ کارت</option>
                      <option value={3}>۳ کارت</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {PARTNER_ROLES.map((r) => {
                    const enabled = config.enabledPartnerRoles.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setConfig({
                            ...config,
                            enabledPartnerRoles: enabled
                              ? config.enabledPartnerRoles.filter((id) => id !== r.id)
                              : [...config.enabledPartnerRoles, r.id],
                          })
                        }
                        className={`min-h-[40px] px-3 rounded-xl border text-[11px] flex items-center justify-between gap-1.5 ${
                          enabled
                            ? 'border-[#B54B1F] bg-[#B54B1F]/8 font-medium'
                            : 'border-[#E5E1D6] dark:border-[#2F2D27] opacity-55'
                        }`}
                      >
                        <span className="truncate">{r.shortLabel}</span>
                        {enabled && <Check className="w-3.5 h-3.5 text-[#B54B1F] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Daily Food Orders Management */}
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-4">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#B54B1F]" />
                  <span>مدیریت سفارش‌های غذای روز ({toFaDigits(orders.length)})</span>
                </h2>
                {orders.length === 0 ? (
                  <p className="text-xs text-[#615E55]">هنوز سفارشی ثبت نشده است.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right tabular-nums">
                      <thead className="border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55]">
                        <tr>
                          <th className="py-2 font-medium">کد پیگیری</th>
                          <th className="py-2 font-medium">مقصد / تلفن</th>
                          <th className="py-2 font-medium">مبلغ کل</th>
                          <th className="py-2 font-medium">وضعیت سفارش</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D6]/60 dark:divide-[#2F2D27]">
                        {orders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="py-2.5 font-mono font-bold" dir="ltr">
                              {ord.trackingCode}
                            </td>
                            <td className="py-2.5">
                              {ord.city}، {ord.neighborhood} ({toFaDigits(ord.phone)})
                            </td>
                            <td className="py-2.5 font-bold">{formatToman(ord.total)}</td>
                            <td className="py-2.5">
                              <select
                                value={ord.status}
                                onChange={async (e) => {
                                  await apiRequest(`/api/admin/orders/${ord.id}/status`, {
                                    method: 'PATCH',
                                    useAdmin: true,
                                    body: JSON.stringify({status: e.target.value}),
                                  });
                                  onNotify('وضعیت سفارش به‌روزرسانی شد.');
                                  loadAllAdminData();
                                }}
                                className="min-h-[34px] rounded-lg border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-2 text-xs"
                              >
                                {(Object.keys(ORDER_STATUS_LABELS) as OrderRecord['status'][]).map((st) => (
                                  <option key={st} value={st}>
                                    {ORDER_STATUS_LABELS[st]}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Financial Ledger (User + Commercial Top-ups) */}
              <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-5 space-y-4">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#B54B1F]" />
                  <span>دفتر کل تراکنش‌های شارژ کاربری و تجاری ({toFaDigits(transactions.length)})</span>
                </h2>
                {transactions.length === 0 ? (
                  <p className="text-xs text-[#615E55]">هنوز تراکنش شارژ دستی توسط مدیریت ثبت نشده است.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right tabular-nums">
                      <thead className="border-b border-[#E5E1D6] dark:border-[#2F2D27] text-[#615E55]">
                        <tr>
                          <th className="py-2 font-medium">نوع حساب</th>
                          <th className="py-2 font-medium">نام صاحب حساب</th>
                          <th className="py-2 font-medium">شرح</th>
                          <th className="py-2 font-medium">مبلغ</th>
                          <th className="py-2 font-medium">مانده پس از تراکنش</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E1D6]/60 dark:divide-[#2F2D27]">
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5">{tx.accountType === 'partner' ? 'حساب تجاری' : 'کاربر'}</td>
                            <td className="py-2.5 font-medium">{tx.accountName}</td>
                            <td className="py-2.5 text-[#615E55]">{tx.reason}</td>
                            <td
                              dir="ltr"
                              className={`py-2.5 font-bold ${
                                tx.amount >= 0 ? 'text-[#B54B1F] dark:text-[#E29A6F]' : 'text-red-600'
                              }`}
                            >
                              {tx.amount >= 0 ? '+' : ''}
                              {tx.currency === 'toman' ? formatToman(tx.amount) : `${toFaDigits(tx.amount)} جِم`}
                            </td>
                            <td className="py-2.5">
                              {tx.currency === 'toman'
                                ? formatToman(tx.balanceAfter)
                                : `${toFaDigits(tx.balanceAfter)} جِم`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =========================================================
              8. DAILY MENU, SMART FRIDGE/KITCHEN, GEM STORE & Q&A MODERATION
          ========================================================= */}
          {activeNav === 'frontend_ops' && (
            <AdminFrontendOpsPanel onRefreshAppConfig={onRefreshAppConfig} onNotify={onNotify} />
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: ADMIN RECIPE CREATE / EDIT CMS MODAL (PHOTO OPTIONAL)
      ===================================================================== */}
      {editingRecipe && (
        <AdminRecipeEditorModal
          initial={editingRecipe === 'new' ? null : editingRecipe}
          onClose={() => setEditingRecipe(null)}
          onSaved={() => {
            setEditingRecipe(null);
            onRefreshAppRecipes();
            loadAllAdminData();
          }}
          onNotify={onNotify}
        />
      )}

      {/* =====================================================================
          MODAL 2: BULK IMPORT THOUSANDS OF RECIPES (JSON / FILE)
      ===================================================================== */}
      {bulkOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">ورود دسته‌ای هزاران دستور پخت (بدون نیاز به عکس)</h2>
                <p className="text-xs text-[#615E55] mt-0.5">
                  فایل JSON خود را بارگذاری یا جای‌گذاری کنید (تا ۲٬۰۰۰ دستور در هر نوبت). دستورهای بدون عکس با طراحی تایپوگرافی ادیتوریال نمایش داده شده و منتظر ثبت عکس واقعی کاربران می‌مانند.
                </p>
              </div>
              <button type="button" onClick={() => setBulkOpen(false)} className="p-2 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="min-h-[40px] px-4 rounded-xl border border-dashed border-[#B54B1F]/50 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#F1EFE8] dark:hover:bg-[#24231F]">
                <Upload className="w-4 h-4 text-[#B54B1F]" />
                <span>انتخاب فایل JSON از سیستم</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    setBulkJson(text);
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => setBulkJson(SAMPLE_BULK_JSON)}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#F1EFE8] dark:bg-[#24231F] text-xs"
              >
                بارگذاری نمونه استاندارد (۲ دستور بدون عکس)
              </button>
            </div>

            <textarea
              rows={12}
              dir="ltr"
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3.5 text-xs font-mono"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={bulkImporting}
                onClick={handleBulkImport}
                className="min-h-[44px] px-6 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold disabled:opacity-40"
              >
                {bulkImporting ? 'در حال ثبت در دیتابیس...' : 'اجرای ورود دسته‌ای و انتشار'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: WALLET TOP-UP / DEDUCTION (USER TOMAN/GEM OR PARTNER TOMAN)
      ===================================================================== */}
      {walletTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleWalletSubmit}
            className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {walletTarget.type === 'user' ? 'شارژ / تعدیل حساب کاربری' : 'شارژ / تعدیل حساب تجاری'}
                </h2>
                <p className="text-xs text-[#615E55] mt-0.5">{walletTarget.name}</p>
              </div>
              <button type="button" onClick={() => setWalletTarget(null)} className="p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#F9F8F4] dark:bg-[#141412] p-3 text-xs flex items-center justify-between tabular-nums">
              <span>موجودی فعلی:</span>
              <span className="font-bold">
                {walletTarget.type === 'user'
                  ? `${formatToman(walletTarget.currentToman)} · ${toFaDigits(walletTarget.currentGems)} جِم`
                  : formatToman(walletTarget.currentToman)}
              </span>
            </div>

            {walletTarget.type === 'user' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWalletCurrency('toman')}
                  className={`min-h-[40px] rounded-xl text-xs font-medium ${
                    walletCurrency === 'toman'
                      ? 'bg-[#B54B1F] text-white'
                      : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55]'
                  }`}
                >
                  کیف پول (تومان)
                </button>
                <button
                  type="button"
                  onClick={() => setWalletCurrency('gem')}
                  className={`min-h-[40px] rounded-xl text-xs font-medium ${
                    walletCurrency === 'gem'
                      ? 'bg-[#A97222] text-white'
                      : 'bg-[#F1EFE8] dark:bg-[#24231F] text-[#615E55]'
                  }`}
                >
                  اعتبار جِم (Gem)
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#615E55] mb-1">
                مبلغ ({walletTarget.type === 'partner' || walletCurrency === 'toman' ? 'تومان' : 'جِم'} — برای کسر علامت منفی بزنید)
              </label>
              <input
                type="number"
                required
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs text-[#615E55] mb-1">شرح سند و علت تراکنش</label>
              <input
                type="text"
                required
                minLength={3}
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                placeholder="مثلاً واریز کارت‌به‌کارت بابت شارژ کمپین..."
                className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
            </div>

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-[#B54B1F] text-white text-sm font-semibold"
            >
              ثبت نهایی تراکنش در دفتر کل
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 4: CREATE NEW COMMERCIAL PARTNER
      ===================================================================== */}
      {partnerModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleCreatePartner}
            className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-4 my-6"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">ثبت حساب تجاری / صنف جدید</h2>
              <button type="button" onClick={() => setPartnerModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="نام برند یا کسب‌وکار"
                value={newPartner.name}
                onChange={(e) => setNewPartner({...newPartner, name: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
              <select
                value={newPartner.roleType}
                onChange={(e) => setNewPartner({...newPartner, roleType: e.target.value as PartnerRoleId})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              >
                {PARTNER_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="شهر"
                value={newPartner.city}
                onChange={(e) => setNewPartner({...newPartner, city: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="شماره تماس"
                value={newPartner.phone}
                onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
              <select
                value={newPartner.tier}
                onChange={(e) => setNewPartner({...newPartner, tier: e.target.value as 'free' | 'featured' | 'sponsor'})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              >
                <option value="free">سطح رایگان</option>
                <option value="featured">برگزیده</option>
                <option value="sponsor">اسپانسر</option>
              </select>
              <input
                type="number"
                min={0}
                placeholder="شارژ اولیه حساب تجاری (تومان)"
                value={newPartner.initialBalance || ''}
                onChange={(e) => setNewPartner({...newPartner, initialBalance: Number(e.target.value) || 0})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
              />
            </div>
            <input
              type="text"
              required
              placeholder="نشانی کامل"
              value={newPartner.address}
              onChange={(e) => setNewPartner({...newPartner, address: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
            />
            <textarea
              rows={2}
              required
              placeholder="معرفی کسب‌وکار..."
              value={newPartner.description}
              onChange={(e) => setNewPartner({...newPartner, description: e.target.value})}
              className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="کد تخفیف (اختیاری)"
                value={newPartner.promoCode}
                onChange={(e) => setNewPartner({...newPartner, promoCode: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="عنوان تخفیف (مثلاً ۱۵٪ تخفیف)"
                value={newPartner.promoLabel}
                onChange={(e) => setNewPartner({...newPartner, promoLabel: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
            </div>
            <button type="submit" className="w-full min-h-[46px] rounded-xl bg-[#B54B1F] text-white text-sm font-semibold">
              ثبت و انتشار حساب تجاری
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          MODAL 5: CREATE NEW SPONSOR CAMPAIGN
      ===================================================================== */}
      {campaignModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateCampaign}
            className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">ساخت کمپین اسپانسری و تبلیغاتی جدید</h2>
              <button type="button" onClick={() => setCampaignModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <select
              required
              value={newCampaign.partnerId}
              onChange={(e) => setNewCampaign({...newCampaign, partnerId: e.target.value})}
              className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatToman(p.businessBalance)})
                </option>
              ))}
            </select>

            <input
              type="text"
              required
              placeholder="تیتر ادیتوریال کمپین"
              value={newCampaign.title}
              onChange={(e) => setNewCampaign({...newCampaign, title: e.target.value})}
              className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
            />

            <input
              type="text"
              placeholder="توضیح کوتاه کمپین"
              value={newCampaign.subtitle}
              onChange={(e) => setNewCampaign({...newCampaign, subtitle: e.target.value})}
              className="w-full min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={newCampaign.placement}
                onChange={(e) => setNewCampaign({...newCampaign, placement: e.target.value as CampaignPlacement})}
                className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              >
                {(Object.keys(PLACEMENT_LABELS) as CampaignPlacement[]).map((pl) => (
                  <option key={pl} value={pl}>
                    {PLACEMENT_LABELS[pl]}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                placeholder="بودجه کمپین (تومان)"
                value={newCampaign.budgetToman}
                onChange={(e) => setNewCampaign({...newCampaign, budgetToman: Number(e.target.value) || 0})}
                className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="کد تخفیف (اختیاری)"
                value={newCampaign.promoCode}
                onChange={(e) => setNewCampaign({...newCampaign, promoCode: e.target.value})}
                className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="متن دکمه فراخوان (CTA)"
                value={newCampaign.ctaLabel}
                onChange={(e) => setNewCampaign({...newCampaign, ctaLabel: e.target.value})}
                className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
              />
            </div>

            <button type="submit" className="w-full min-h-[46px] rounded-xl bg-[#B54B1F] text-white text-sm font-semibold">
              انتشار کمپین اسپانسری
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// SUB-COMPONENTS
// =========================================================================
function KpiCard({label, value, hint, accent}: {label: string; value: string; hint: string; accent?: boolean}) {
  return (
    <div className="rounded-2xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#FFFFFF] dark:bg-[#1C1B18] p-4 space-y-1">
      <div className="text-xs text-[#615E55] dark:text-[#A9A497]">{label}</div>
      <div
        className={`text-xl sm:text-2xl font-extrabold ${
          accent ? 'text-[#A97222] dark:text-[#D8A85B]' : 'text-[#1C1B18] dark:text-[#F4F1EA]'
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#615E55] dark:text-[#A9A497]">{hint}</div>
    </div>
  );
}

function QuickRow({
  label,
  count,
  actionLabel,
  onClick,
}: {
  label: string;
  count: number;
  actionLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-[#E5E1D6]/70 dark:border-[#2F2D27]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-bold tabular-nums text-[#B54B1F] dark:text-[#E29A6F] min-w-[2rem]">
          {toFaDigits(count)}
        </span>
        <span className="text-xs truncate">{label}</span>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:underline whitespace-nowrap shrink-0"
      >
        {actionLabel}
      </button>
    </div>
  );
}

function AdminRecipeEditorModal({
  initial,
  onClose,
  onSaved,
  onNotify,
}: {
  initial: Recipe | null;
  onClose: () => void;
  onSaved: () => void;
  onNotify: (msg: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [subtitle, setSubtitle] = useState(initial?.subtitle || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [category, setCategory] = useState(initial?.category || 'ناهار و شام');
  const [region, setRegion] = useState(initial?.region || 'تهران');
  const [season, setSeason] = useState(initial?.season || 'چهارفصل');
  const [difficulty, setDifficulty] = useState<'آسان' | 'متوسط' | 'حرفه‌ای'>(initial?.difficulty || 'متوسط');
  const [prepMinutes, setPrepMinutes] = useState(initial?.prepMinutes || 20);
  const [cookMinutes, setCookMinutes] = useState(initial?.cookMinutes || 40);
  const [servings, setServings] = useState(initial?.servings || 4);
  const [isVip, setIsVip] = useState(Boolean(initial?.isVip));
  const [vipGemCost, setVipGemCost] = useState(initial?.vipGemCost || 40);
  const [status, setStatus] = useState<'published' | 'pending'>(initial?.status || 'published');
  const [ingredientsText, setIngredientsText] = useState(
    initial
      ? initial.ingredients.map((i) => `${i.name} | ${i.amount} | ${i.unit}`).join('\n')
      : 'برنج ایرانی | 3 | پیمانه\nپیاز | 2 | عدد\nزعفران دم‌کرده | 2 | قاشق غذاخوری'
  );
  const [stepsText, setStepsText] = useState(
    initial
      ? initial.steps.map((s) => s.instruction).join('\n')
      : 'پیاز را خلالی کرده و با حرارت ملایم طلایی کنید.\nمواد اصلی را افزوده و با ادویه تفت دهید و اجازه دهید جا بیفتد.'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const ingredients = ingredientsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, amt, unit] = line.split('|').map((s) => s.trim());
          return {name: name || line, amount: Number(amt) > 0 ? Number(amt) : 1, unit: unit || 'عدد'};
        });

      const steps = stepsText
        .split('\n')
        .map((line) => line.trim())
        .filter((l) => l.length >= 3)
        .map((instruction, idx) => ({order: idx + 1, instruction}));

      const payload = {
        title,
        subtitle,
        description,
        imageUrl,
        imageDataUrl: imageDataUrl || undefined,
        category,
        region,
        season,
        difficulty,
        prepMinutes: Number(prepMinutes) || 20,
        cookMinutes: Number(cookMinutes) || 40,
        servings: Number(servings) || 4,
        isVip,
        vipGemCost: isVip ? Number(vipGemCost) || 40 : 0,
        status,
        ingredients,
        steps,
      };

      if (initial) {
        await apiRequest(`/api/admin/recipes/${initial.id}`, {
          method: 'PUT',
          useAdmin: true,
          body: JSON.stringify(payload),
        });
        onNotify('دستور پخت با موفقیت ویرایش شد.');
      } else {
        await apiRequest('/api/admin/recipes', {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify(payload),
        });
        onNotify('دستور پخت جدید با موفقیت ایجاد و ثبت شد.');
      }
      onSaved();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره دستور پخت');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-3xl rounded-2xl bg-[#FFFFFF] dark:bg-[#1C1B18] border border-[#E5E1D6] dark:border-[#2F2D27] p-6 space-y-4 my-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {initial ? `ویرایش دستور: ${initial.title}` : 'تولید دستور پخت جدید (تصویر اختیاری)'}
          </h2>
          <button type="button" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            required
            placeholder="عنوان دستور پخت"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          />
          <input
            type="text"
            placeholder="زیرعنوان ادیتوریال"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className="min-h-[44px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          />
        </div>

        <textarea
          rows={2}
          placeholder="توضیح کامل غذا..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-xs"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          >
            <option value="ناهار و شام">ناهار و شام</option>
            <option value="پیش‌غذا و عصرانه">پیش‌غذا و عصرانه</option>
            <option value="وگان و گیاهی">وگان و گیاهی</option>
            <option value="پخت سریع">پخت سریع</option>
            <option value="رژیمی و سبک">رژیمی و سبک</option>
            <option value="غذای شمالی">غذای شمالی</option>
          </select>
          <input
            type="text"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="منطقه"
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          />
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
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
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          >
            <option value="آسان">آسان</option>
            <option value="متوسط">متوسط</option>
            <option value="حرفه‌ای">حرفه‌ای</option>
          </select>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          <input
            type="number"
            min={1}
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(Number(e.target.value))}
            placeholder="آماده‌سازی"
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
          />
          <input
            type="number"
            min={1}
            value={cookMinutes}
            onChange={(e) => setCookMinutes(Number(e.target.value))}
            placeholder="زمان پخت"
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
          />
          <input
            type="number"
            min={1}
            value={servings}
            onChange={(e) => setServings(Number(e.target.value))}
            placeholder="نفرات"
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'published' | 'pending')}
            className="min-h-[42px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs"
          >
            <option value="published">منتشرشده</option>
            <option value="pending">پیش‌نویس / در انتظار</option>
          </select>
          <label className="flex items-center gap-2 text-xs px-2">
            <input
              type="checkbox"
              checked={isVip}
              onChange={(e) => setIsVip(e.target.checked)}
              className="w-4 h-4 accent-[#A97222]"
            />
            <span>دستور ویژه (VIP)</span>
          </label>
        </div>

        {isVip && (
          <input
            type="number"
            min={10}
            value={vipGemCost}
            onChange={(e) => setVipGemCost(Number(e.target.value))}
            placeholder="هزینه بازگشایی (جِم)"
            className="w-48 min-h-[40px] rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] px-3 text-xs tabular-nums"
          />
        )}

        {/* Optional Cover Image (Leave Blank for Community Photos!) */}
        <div className="rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium">
              تصویر اصلی (اختیاری — خالی بگذارید تا کاربران عکس واقعی غذای پخته‌شده را ارسال کنند)
            </span>
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 rounded-lg border border-dashed border-[#B54B1F]/50 text-[11px] font-medium cursor-pointer inline-flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" />
                <span>آپلود از سیستم</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const dataUrl = await fileToCompressedDataUrl(file);
                    setImageDataUrl(dataUrl);
                    setImageUrl('');
                  }}
                />
              </label>
              {(imageUrl || imageDataUrl) && (
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl('');
                    setImageDataUrl('');
                  }}
                  className="text-[11px] text-red-600"
                >
                  حذف عکس (تبدیل به بدون عکس)
                </button>
              )}
            </div>
          </div>
          {(imageDataUrl || imageUrl) && (
            <img
              src={imageDataUrl || imageUrl}
              alt="پیش‌نمایش"
              className="w-36 h-24 object-cover rounded-lg border border-[#E5E1D6]"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#615E55] mb-1">
              مواد اولیه (هر خط: نام ماده | مقدار | واحد)
            </label>
            <textarea
              rows={6}
              required
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-xs leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-xs text-[#615E55] mb-1">مراحل پخت (هر مرحله در یک خط)</label>
            <textarea
              rows={6}
              required
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              className="w-full rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] bg-[#F9F8F4] dark:bg-[#141412] p-3 text-xs leading-relaxed"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-[#E5E1D6] dark:border-[#2F2D27] text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] px-6 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold disabled:opacity-40"
          >
            {saving ? 'در حال ذخیره...' : initial ? 'ذخیره تغییرات' : 'ایجاد و ثبت دستور'}
          </button>
        </div>
      </form>
    </div>
  );
}
