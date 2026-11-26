import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Gavel,
  Heart,
  History,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Utensils,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {apiRequest, getAdminToken, setAdminToken} from '../lib/api.ts';
import {
  behaviorObserverSubject,
  getAnonymizedBehaviorAggregates,
  loadPassiveAffinityCategories,
} from '../lib/behaviorTracker.ts';
import {fileToCompressedDataUrl} from '../lib/imageUpload.ts';
import {
  PARTNER_ROLES,
  PARTNER_ROLE_LABELS,
  formatToman,
  toFaDigits,
} from '../shared/persianEngine.ts';
import {
  DEFAULT_DYNAMIC_ROLES,
  getRoleAclMatrixSummary,
  getRoleBadgeClass,
  getRoleLabel,
  hasAdminPermission,
  normalizeAdminRole,
} from '../shared/rbac.ts';
import type {
  AdminBehavioralChartsReportPayload,
  AdminDashboardStats,
  AdminEditorialInsightsReport,
  AdminPermission,
  AdminRole,
  AdminUserRow,
  AnonymizedBehaviorAggregateStore,
  CampaignPlacement,
  DynamicRoleDefinition,
  EcosystemConfig,
  ExecutiveBehavioralReportPayload,
  NativeAdUnit,
  Partner,
  PartnerAnalyticsSummary,
  PartnerRoleId,
  PendingRecipeDraftItem,
  RbacAuditLog,
  Recipe,
  RecipePhoto,
  RecipeVersionSnapshot,
  SponsorCampaign,
  WalletTransaction,
} from '../shared/types.ts';
import {AdminAdMarketplacePanel} from './AdminAdMarketplacePanel.tsx';
import {AdminBehavioralChartsPanel} from './AdminBehavioralChartsPanel.tsx';
import {AdminBehavioralIntelligencePanel} from './AdminBehavioralIntelligencePanel.tsx';
import {AdminDynamicAppControlPanel} from './AdminDynamicAppControlPanel.tsx';
import {AdminEditorialInsightsPanel} from './AdminEditorialInsightsPanel.tsx';
import {AdminFrontendOpsPanel} from './AdminFrontendOpsPanel.tsx';
import {AdminNativeAdsPanel} from './AdminNativeAdsPanel.tsx';
import {AdminRbacPanel} from './AdminRbacPanel.tsx';
import {AdminRecipeVersionModal, EditorialSnapshotPreview} from './AdminRecipeVersionModal.tsx';
import {EditorialImage} from './EditorialImage.tsx';
import {AdminWorkspaceSkeleton} from './EditorialSkeletons.tsx';

type AdminNavId =
  | 'overview'
  | 'advanced_analytics'
  | 'behavior_reports'
  | 'behavioral_intel'
  | 'app_control'
  | 'native_ads'
  | 'ad_market'
  | 'recipes'
  | 'photos'
  | 'users'
  | 'partners'
  | 'campaigns'
  | 'frontend_ops'
  | 'ecosystem'
  | 'rbac';

type AdminNavDomain = 'overview' | 'content' | 'advertising' | 'financial_reporting' | 'system';

interface AdminTabRbacPolicy {
  domain: AdminNavDomain;
  requiredAnyPermissions: AdminPermission[];
  requireSeniorAdmin?: boolean;
}

const ADMIN_NAV_DOMAIN_ORDER: AdminNavDomain[] = [
  'overview',
  'content',
  'advertising',
  'financial_reporting',
  'system',
];

const ADMIN_NAV_DOMAIN_LABELS: Record<AdminNavDomain, string> = {
  overview: 'نمای کلی و تحلیل',
  content: 'بخش محتوا',
  advertising: 'بخش تبلیغات',
  financial_reporting: 'بخش گزارش‌های مالی',
  system: 'سیستم و کنترل دسترسی',
};

const ADMIN_TAB_RBAC_POLICIES: Record<AdminNavId, AdminTabRbacPolicy> = {
  overview: {domain: 'overview', requiredAnyPermissions: ['dashboard.view']},
  advanced_analytics: {
    domain: 'overview',
    requiredAnyPermissions: ['dashboard.view'],
    requireSeniorAdmin: true,
  },
  behavior_reports: {domain: 'overview', requiredAnyPermissions: ['dashboard.view']},
  recipes: {domain: 'content', requiredAnyPermissions: ['content.recipes']},
  photos: {domain: 'content', requiredAnyPermissions: ['content.photos']},
  frontend_ops: {domain: 'content', requiredAnyPermissions: ['content.kitchen', 'content.qa']},
  native_ads: {domain: 'advertising', requiredAnyPermissions: ['ads.manage']},
  ad_market: {domain: 'advertising', requiredAnyPermissions: ['ads.manage']},
  partners: {domain: 'advertising', requiredAnyPermissions: ['ads.manage']},
  campaigns: {domain: 'advertising', requiredAnyPermissions: ['ads.manage']},
  ecosystem: {domain: 'financial_reporting', requiredAnyPermissions: ['finance.reports', 'finance.wallets']},
  users: {domain: 'financial_reporting', requiredAnyPermissions: ['users.view']},
  behavioral_intel: {
    domain: 'system',
    requiredAnyPermissions: ['dashboard.view'],
    requireSeniorAdmin: true,
  },
  app_control: {domain: 'system', requiredAnyPermissions: ['app.layout', 'ecosystem.manage']},
  rbac: {domain: 'system', requiredAnyPermissions: ['rbac.manage']},
};

interface FinancialReportSummary {
  generatedAt: string;
  partnerWalletTotalToman: number;
  userWalletTotalToman: number;
  approvedAdBidsRevenueToman: number;
  pendingAuctionBidsVolumeToman: number;
  activeCampaignBudgetToman: number;
  transactionsCount: number;
}

interface AdminDashboardProps {
  onRefreshAppConfig: () => void;
  onRefreshAppRecipes: () => void;
  onBackToApp: () => void;
  onNotify: (msg: string) => void;
}

const PLACEMENT_LABELS: Record<CampaignPlacement, string> = {
  explore_showcase: 'ویترین صفحه کاوش',
  recipe_context: 'کارت زمینه‌ای دستور پخت',
  shopping_delivery: 'همراه لیست خرید',
  marketplace_banner: 'بنر صفحه برندهای همکار',
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
  const [activeRole, setActiveRole] = useState<AdminRole>('senior_admin');
  const [activePermissions, setActivePermissions] = useState<AdminPermission[]>([]);
  const [aclRoles, setAclRoles] = useState<DynamicRoleDefinition[]>(DEFAULT_DYNAMIC_ROLES);
  const [actorName, setActorName] = useState<string>('مدیر ارشد سیستم');
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
  const [nativeAds, setNativeAds] = useState<NativeAdUnit[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialReportSummary | null>(null);
  const [rbacAuditLogs, setRbacAuditLogs] = useState<RbacAuditLog[]>([]);
  const [pendingDrafts, setPendingDrafts] = useState<PendingRecipeDraftItem[]>([]);
  const [editorialInsights, setEditorialInsights] = useState<AdminEditorialInsightsReport | null>(null);
  const [insightsDays, setInsightsDays] = useState<number>(30);
  const insightsDaysRef = useRef<number>(30);
  insightsDaysRef.current = insightsDays;
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [recipesSubTab, setRecipesSubTab] = useState<'catalog' | 'insights'>('catalog');
  const [pendingChefs, setPendingChefs] = useState<{id: string; name: string; city: string; specialty: string}[]>([]);

  // Filters
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeStatusFilter, setRecipeStatusFilter] = useState<'all' | 'published' | 'pending' | 'has_draft'>('all');
  const [recipePhotoFilter, setRecipePhotoFilter] = useState<'all' | 'without' | 'with'>('all');
  const [photoStatusFilter, setPhotoStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [userSearch, setUserSearch] = useState('');

  // Modals: Recipe Editor / Version Control Preview / Bulk Import / Wallet Top-up / Partner Create / Campaign Create
  const [editingRecipe, setEditingRecipe] = useState<Recipe | 'new' | null>(null);
  const [draftSeedTitle, setDraftSeedTitle] = useState('');
  const [versionModalTarget, setVersionModalTarget] = useState<{recipeId: string; versionId?: string | null} | null>(
    null
  );
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
        role?: AdminRole | null;
        permissions?: AdminPermission[];
        roles?: DynamicRoleDefinition[];
        actorName?: string | null;
      }>('/api/admin/status', {
        useAdmin: true,
      });
      setAdminConfigured(statusRes.configured);
      setQuickTestEnabled(Boolean(statusRes.quickTestLoginEnabled));
      const knownRoles =
        Array.isArray(statusRes.roles) && statusRes.roles.length > 0 ? statusRes.roles : DEFAULT_DYNAMIC_ROLES;
      setAclRoles(knownRoles);

      let isAuthed = statusRes.authenticated;
      let resolvedRole: AdminRole = statusRes.role || 'senior_admin';
      let resolvedPerms: AdminPermission[] = statusRes.permissions || [];
      let resolvedActor = statusRes.actorName || 'مدیر ارشد سیستم';

      // Seamless Test-Mode Auto-Login (automatically disabled in production when ADMIN_PASSCODE/DISABLE_QUICK_TEST_AUTH is set)
      if (!isAuthed && statusRes.quickTestLoginEnabled && !explicitLogout) {
        try {
          const quickRes = await apiRequest<{
            adminToken: string;
            role: AdminRole;
            permissions?: AdminPermission[];
            actorName: string;
          }>('/api/admin/quick-test-login', {
            method: 'POST',
            body: JSON.stringify({role: 'senior_admin'}),
          });
          setAdminToken(quickRes.adminToken);
          isAuthed = true;
          resolvedRole = quickRes.role || 'senior_admin';
          resolvedPerms = quickRes.permissions || [];
          resolvedActor = quickRes.actorName || 'مدیر ارشد سیستم';
        } catch {
          // Fall back cleanly to standard login screen
        }
      }

      setAdminAuthed(isAuthed);
      if (!isAuthed) {
        setLoading(false);
        return;
      }

      setActiveRole(resolvedRole);
      setActivePermissions(resolvedPerms);
      setActorName(resolvedActor);

      const checkPerm = (perm: AdminPermission) =>
        hasAdminPermission(resolvedRole, perm, knownRoles, resolvedPerms);

      // Permission-aware parallel fetching (never calls endpoints disallowed for the active role)
      const tasks: Promise<void>[] = [
        apiRequest<{
          config: EcosystemConfig;
          pendingChefs: {id: string; name: string; city: string; specialty: string}[];
          analytics: PartnerAnalyticsSummary;
        }>('/api/admin/overview', {useAdmin: true}).then((ov) => {
          setConfig(ov.config);
          setPendingChefs(ov.pendingChefs);
          setAnalytics(ov.analytics);
        }),
        apiRequest<{stats: AdminDashboardStats}>('/api/admin/stats', {useAdmin: true}).then((st) => {
          setStats(st.stats);
        }),
      ];

      if (checkPerm('content.recipes')) {
        tasks.push(
          apiRequest<{recipes: Recipe[]}>('/api/admin/recipes', {useAdmin: true}).then((r) => setRecipes(r.recipes)),
          apiRequest<{drafts: PendingRecipeDraftItem[]}>('/api/admin/recipe-drafts', {useAdmin: true}).then((d) =>
            setPendingDrafts(d.drafts)
          ),
          apiRequest<{report: AdminEditorialInsightsReport}>(
            `/api/admin/editorial-insights?days=${insightsDaysRef.current}`,
            {
              useAdmin: true,
            }
          ).then((ins) => setEditorialInsights(ins.report))
        );
      } else {
        setRecipes([]);
        setPendingDrafts([]);
        setEditorialInsights(null);
      }

      if (checkPerm('content.photos')) {
        tasks.push(
          apiRequest<{photos: RecipePhoto[]}>('/api/admin/photos', {useAdmin: true}).then((p) => setPhotos(p.photos))
        );
      } else {
        setPhotos([]);
      }

      if (checkPerm('users.view')) {
        tasks.push(
          apiRequest<{users: AdminUserRow[]}>('/api/admin/users', {useAdmin: true}).then((u) => setUsers(u.users))
        );
      } else {
        setUsers([]);
      }

      if (checkPerm('finance.partners') || checkPerm('ads.manage')) {
        tasks.push(
          apiRequest<{partners: Partner[]}>('/api/admin/partners', {useAdmin: true})
            .then((prtRes) => {
              setPartners(prtRes.partners);
              if (prtRes.partners.length > 0) {
                setNewCampaign((prev) => (prev.partnerId ? prev : {...prev, partnerId: prtRes.partners[0].id}));
              }
            })
            .catch(() => {})
        );
      } else {
        setPartners([]);
      }

      if (checkPerm('ads.manage')) {
        tasks.push(
          apiRequest<{nativeAds: NativeAdUnit[]}>('/api/admin/native-ads', {useAdmin: true}).then((res) =>
            setNativeAds(res.nativeAds || [])
          )
        );
      } else {
        setNativeAds([]);
      }

      if (checkPerm('finance.campaigns')) {
        tasks.push(
          apiRequest<{campaigns: SponsorCampaign[]}>('/api/admin/campaigns', {useAdmin: true}).then((c) =>
            setCampaigns(c.campaigns)
          )
        );
      } else {
        setCampaigns([]);
      }

      if (checkPerm('finance.reports') || checkPerm('finance.wallets')) {
        tasks.push(
          apiRequest<{transactions: WalletTransaction[]}>('/api/admin/transactions', {useAdmin: true}).then((t) =>
            setTransactions(t.transactions)
          )
        );
        if (checkPerm('finance.reports')) {
          tasks.push(
            apiRequest<FinancialReportSummary>('/api/admin/financial-reports/summary', {useAdmin: true})
              .then((summary) => setFinancialSummary(summary))
              .catch(() => setFinancialSummary(null))
          );
        } else {
          setFinancialSummary(null);
        }
      } else {
        setTransactions([]);
        setFinancialSummary(null);
      }

      if (checkPerm('rbac.manage')) {
        tasks.push(
          apiRequest<{logs: RbacAuditLog[]}>('/api/admin/rbac/audit', {useAdmin: true}).then((a) =>
            setRbacAuditLogs(a.logs)
          ),
          apiRequest<{roles: DynamicRoleDefinition[]}>('/api/admin/acl/roles', {useAdmin: true}).then((r) => {
            if (Array.isArray(r.roles) && r.roles.length > 0) setAclRoles(r.roles);
          })
        );
      } else {
        setRbacAuditLogs([]);
      }

      await Promise.all(tasks);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در بارگذاری داده‌های پنل مدیریت');
    } finally {
      setLoading(false);
    }
  }, [onNotify, explicitLogout]);

  const refreshEditorialInsights = useCallback(
    async (targetDays = insightsDays) => {
      setInsightsLoading(true);
      try {
        const res = await apiRequest<{report: AdminEditorialInsightsReport}>(
          `/api/admin/editorial-insights?days=${targetDays}`,
          {useAdmin: true}
        );
        setEditorialInsights(res.report);
      } catch (err) {
        onNotify(err instanceof Error ? err.message : 'خطا در تحلیل ترندهای جستجو');
      } finally {
        setInsightsLoading(false);
      }
    },
    [insightsDays, onNotify]
  );

  useEffect(() => {
    loadAllAdminData();
  }, [loadAllAdminData]);

  const handleQuickAdminTestLogin = async (role: AdminRole = 'senior_admin') => {
    setAuthError(null);
    setExplicitLogout(false);
    try {
      const res = await apiRequest<{
        adminToken: string;
        role: AdminRole;
        permissions?: AdminPermission[];
        actorName: string;
        message?: string;
      }>('/api/admin/quick-test-login', {
        method: 'POST',
        body: JSON.stringify({role}),
      });
      setAdminToken(res.adminToken);
      setActiveRole(res.role);
      setActivePermissions(res.permissions || []);
      setActorName(res.actorName);
      setActiveNav('overview');
      setAdminAuthed(true);
      onNotify(res.message || `ورود آزمایشی با نقش «${getRoleLabel(role, aclRoles)}» انجام شد.`);
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
      const res = await apiRequest<{
        adminToken: string;
        role?: AdminRole;
        actorName?: string;
        message?: string;
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({password}),
      });
      setAdminToken(res.adminToken);
      setActiveRole(res.role || 'senior_admin');
      setActorName(res.actorName || 'مدیر ارشد سیستم');
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

  // RBAC enforcement hook: must execute unconditionally before early returns
  useEffect(() => {
    if (!adminAuthed) return;
    const policy = ADMIN_TAB_RBAC_POLICIES[activeNav];
    const allowed =
      Boolean(policy) &&
      (!policy.requireSeniorAdmin || activeRole === 'senior_admin') &&
      policy.requiredAnyPermissions.some((perm) =>
        hasAdminPermission(activeRole, perm, aclRoles, activePermissions)
      );
    if (!allowed) {
      setActiveNav('overview');
    }
    if (!hasAdminPermission(activeRole, 'content.recipes', aclRoles, activePermissions)) {
      setEditingRecipe(null);
      setVersionModalTarget(null);
      setBulkOpen(false);
    }
    if (!hasAdminPermission(activeRole, 'finance.wallets', aclRoles, activePermissions)) {
      setWalletTarget(null);
    }
    if (!hasAdminPermission(activeRole, 'ads.manage', aclRoles, activePermissions)) {
      setPartnerModalOpen(false);
      setCampaignModalOpen(false);
    }
  }, [adminAuthed, activeNav, activeRole, aclRoles, activePermissions]);

  // Unauthenticated Gate
  if (!adminAuthed) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <form
          onSubmit={handleAdminLogin}
          className="w-full max-w-md rounded-3xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 space-y-5 shadow-[0_20px_50px_-30px_rgba(28,27,24,0.2)]"
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
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">نسخه دسکتاپ و ریسپانسیو</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            {adminConfigured
              ? 'برای مدیریت دستورهای پخت و ورود دسته‌ای، تایید عکس‌های واقعی کاربران، شارژ کیف پول کاربری و تجاری، اسپانسرها و کنترل اکوسیستم وارد شوید.'
              : 'هنوز رمز مدیریت تعریف نشده است. یک رمز امن (حداقل ۶ کاراکتر) تعیین کنید تا دسترسی پنل مدیریت جامع فعال شود.'}
          </p>

          {authError && <p className="text-xs text-red-600 font-medium">{authError}</p>}

          {quickTestEnabled && (
            <div className="space-y-2 pt-1">
              <div className="text-[11px] font-semibold text-[#5C5C58] dark:text-[#A3A39E]">
                ورود سریع آزمایشی بر اساس نقش مدیریتی:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {aclRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleQuickAdminTestLogin(r.id)}
                    className={`min-h-[42px] px-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] ${
                      r.id === 'senior_admin'
                        ? 'bg-[#0D0D0D] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:text-[#0B0B0B] text-[#FFFFFF]'
                        : 'border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] hover:border-[#B54B1F]'
                    }`}
                  >
                    {r.shortLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input
            type="password"
            required
            minLength={6}
            placeholder="رمز عبور مدیریت"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[48px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-4 text-sm"
          />

          <div className="flex items-center gap-2.5">
            <button
              type="submit"
              className="flex-1 min-h-[48px] rounded-full bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-sm font-semibold"
            >
              {adminConfigured ? 'ورود با رمز مدیریت' : 'ثبت رمز و فعال‌سازی پنل'}
            </button>
            <button
              type="button"
              onClick={onBackToApp}
              className="min-h-[48px] px-4 rounded-full border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium"
            >
              بازگشت
            </button>
          </div>
        </form>
      </div>
    );
  }

  const can = (perm: AdminPermission) => hasAdminPermission(activeRole, perm, aclRoles, activePermissions);

  const canAccessTab = (tabId: AdminNavId): boolean => {
    const policy = ADMIN_TAB_RBAC_POLICIES[tabId];
    if (!policy) return false;
    if (policy.requireSeniorAdmin && activeRole !== 'senior_admin') return false;
    return policy.requiredAnyPermissions.some((perm) => can(perm));
  };

  const staffMembersCount = users.filter((u) => normalizeAdminRole(u.role, aclRoles) !== null).length;
  const activeNativeAdsCount = nativeAds.filter((a) => a.status === 'active').length;
  const totalNativeAdImpressions = nativeAds.reduce((sum, a) => sum + (a.impressions || 0), 0);
  const totalNativeAdClicks = nativeAds.reduce((sum, a) => sum + (a.clicks || 0), 0);

  const allNavItems: {
    id: AdminNavId;
    domain: AdminNavDomain;
    label: string;
    icon: typeof BarChart3;
    badge?: number;
    visible: boolean;
  }[] = [
    {
      id: 'overview',
      domain: 'overview',
      label: 'داشبورد و آمار',
      icon: BarChart3,
      visible: canAccessTab('overview'),
    },
    {
      id: 'advanced_analytics',
      domain: 'overview',
      label: 'تحلیل رفتاری پیشرفته',
      icon: Activity,
      visible: canAccessTab('advanced_analytics'),
    },
    {
      id: 'behavior_reports',
      domain: 'overview',
      label: 'گزارش نموداری رفتار کاربران',
      icon: BarChart3,
      visible: canAccessTab('behavior_reports'),
    },
    {
      id: 'recipes',
      domain: 'content',
      label: 'دستورهای پخت و کنترل نسخه',
      icon: BookOpen,
      badge:
        (stats?.pendingDraftVersionsCount || 0) > 0
          ? stats?.pendingDraftVersionsCount
          : stats?.recipesWithoutPhoto || undefined,
      visible: canAccessTab('recipes'),
    },
    {
      id: 'photos',
      domain: 'content',
      label: 'مدیریت عکس‌های کاربران',
      icon: Camera,
      badge: stats?.pendingPhotosCount || undefined,
      visible: canAccessTab('photos'),
    },
    {
      id: 'frontend_ops',
      domain: 'content',
      label: 'یخچال هوشمند و پرسش‌وپاسخ',
      icon: Utensils,
      visible: canAccessTab('frontend_ops'),
    },
    {
      id: 'native_ads',
      domain: 'advertising',
      label: 'استودیو تبلیغات بومی',
      icon: Megaphone,
      badge: activeNativeAdsCount || undefined,
      visible: canAccessTab('native_ads'),
    },
    {
      id: 'ad_market',
      domain: 'advertising',
      label: 'مزایده، حامی ویژه و پنل برندها',
      icon: Gavel,
      visible: canAccessTab('ad_market'),
    },
    {
      id: 'partners',
      domain: 'advertising',
      label: 'برندهای همکار و اصناف',
      icon: Store,
      badge: stats?.pendingPartnersCount || undefined,
      visible: canAccessTab('partners'),
    },
    {
      id: 'campaigns',
      domain: 'advertising',
      label: 'کمپین‌های ویژه برندها',
      icon: Sparkles,
      badge: stats?.activeCampaignsCount || undefined,
      visible: canAccessTab('campaigns'),
    },
    {
      id: 'ecosystem',
      domain: 'financial_reporting',
      label: 'گزارش‌های مالی و دفتر کل',
      icon: Wallet,
      visible: canAccessTab('ecosystem'),
    },
    {
      id: 'users',
      domain: 'financial_reporting',
      label: can('users.manage') ? 'کاربران و سرآشپزها' : 'کیف جِم کاربران',
      icon: Users,
      visible: canAccessTab('users'),
    },
    {
      id: 'behavioral_intel',
      domain: 'system',
      label: 'هوش رفتاری و شناخت کاربر',
      icon: TrendingUp,
      visible: canAccessTab('behavioral_intel'),
    },
    {
      id: 'app_control',
      domain: 'system',
      label: 'کنترل داینامیک اپ کاربر',
      icon: LayoutGrid,
      visible: canAccessTab('app_control'),
    },
    {
      id: 'rbac',
      domain: 'system',
      label: 'ماتریس دسترسی پویا و نقش‌ها',
      icon: ShieldCheck,
      badge: staffMembersCount || undefined,
      visible: canAccessTab('rbac'),
    },
  ];

  const navItems = allNavItems.filter((item) => item.visible);
  const navGroups = ADMIN_NAV_DOMAIN_ORDER.map((domain) => ({
    domain,
    label: ADMIN_NAV_DOMAIN_LABELS[domain],
    items: navItems.filter((item) => item.domain === domain),
  })).filter((g) => g.items.length > 0);
  const currentNav: AdminNavId = navItems.some((n) => n.id === activeNav) ? activeNav : 'overview';
  const activeRoleDomainDecisions = getRoleAclMatrixSummary(activeRole, aclRoles, activePermissions);

  const filteredRecipes = recipes.filter((r) => {
    if (recipeStatusFilter === 'has_draft') {
      if ((r.pendingDraftsCount || 0) === 0 && r.status !== 'pending') return false;
    } else if (recipeStatusFilter !== 'all' && r.status !== recipeStatusFilter) {
      return false;
    }
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
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[#E6E6E3] dark:border-[#282825]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="منوی مدیریت"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden min-h-[42px] min-w-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
              <span>سوپرپنل ایزوله مدیریت لاقلی</span>
              <span aria-hidden="true">·</span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${getRoleBadgeClass(activeRole)}`}>
                {getRoleLabel(activeRole, aclRoles)}
              </span>
              <span className="hidden sm:inline text-[11px]">({actorName})</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5">
              {navItems.find((n) => n.id === currentNav)?.label}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickTestEnabled && (
            <div
              role="group"
              aria-label="تغییر سریع نقش آزمایشی"
              className="inline-flex flex-wrap items-center rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-1 gap-1"
            >
              {aclRoles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleQuickAdminTestLogin(r.id)}
                  className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    activeRole === r.id
                      ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                      : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {r.shortLabel}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={loadAllAdminData}
            className="min-h-[42px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>
          <button
            type="button"
            onClick={onBackToApp}
            className="min-h-[42px] px-4 rounded-xl bg-[#EFEFED] dark:bg-[#20201E] text-xs font-medium"
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
            className="min-h-[42px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs text-[#5C5C58] inline-flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج مدیر</span>
          </button>
        </div>
      </div>

      {/* Desktop-First 2-Column Workspace (Sticky Sidebar + Wide Fluid Main Canvas) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* RTL Right Sidebar — Filtered Strictly by RBAC Role & Domain */}
        <aside
          className={`${
            mobileMenuOpen ? 'block' : 'hidden'
          } lg:block lg:col-span-3 xl:col-span-2 lg:sticky lg:top-20 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-2.5 space-y-3`}
        >
          {navGroups.map((group) => (
            <div key={group.domain} className="space-y-1">
              <p className="px-3 pt-1 text-[10px] font-bold text-[#7A7A74] dark:text-[#8E8E88]">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = currentNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[42px] px-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-[#B54B1F] text-[#FAFAFA] dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                        : 'text-[#5C5C58] dark:text-[#A3A39E] hover:bg-[#EFEFED] dark:hover:bg-[#20201E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
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
                            ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#0B0B0B]'
                            : 'bg-[#A97222]/15 text-[#A97222] dark:text-[#D8A85B]'
                        }`}
                      >
                        {toFaDigits(item.badge)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>

        {/* Main Workspace Canvas */}
        <div className="lg:col-span-9 xl:col-span-10 space-y-6 min-w-0">
          {loading && !stats && <AdminWorkspaceSkeleton />}

          {/* =========================================================
              1. OVERVIEW & ANALYTICS (ROLE-FILTERED METRICS)
          ========================================================= */}
          {currentNav === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tabular-nums">
                {canAccessTab('recipes') && (
                  <KpiCard
                    label="کل دستورهای پخت"
                    value={toFaDigits(stats.totalRecipes)}
                    hint={`${toFaDigits(stats.recipesWithoutPhoto)} دستور بدون عکس`}
                  />
                )}
                {canAccessTab('photos') && (
                  <KpiCard
                    label="عکس‌های در صف تایید"
                    value={toFaDigits(stats.pendingPhotosCount)}
                    hint={`${toFaDigits(stats.approvedPhotosCount)} عکس واقعی تاییدشده`}
                    accent
                  />
                )}
                {can('users.view') && (
                  <KpiCard
                    label="کاربران و سرآشپزها"
                    value={toFaDigits(stats.totalUsers)}
                    hint={`${toFaDigits(stats.verifiedChefsCount)} سرآشپز تاییدشده`}
                  />
                )}
                {canAccessTab('native_ads') && (
                  <KpiCard
                    label="واحدهای تبلیغ بومی فعال"
                    value={toFaDigits(activeNativeAdsCount)}
                    hint={`${toFaDigits(totalNativeAdImpressions)} نمایش · ${toFaDigits(totalNativeAdClicks)} کلیک`}
                  />
                )}
                {(canAccessTab('partners') || canAccessTab('campaigns')) && (
                  <KpiCard
                    label="اصناف و کمپین فعال"
                    value={toFaDigits(stats.totalPartners)}
                    hint={`${toFaDigits(stats.activeCampaignsCount)} کمپین اسپانسری فعال`}
                  />
                )}
                {canAccessTab('ecosystem') && (
                  <KpiCard
                    label="مجموع کیف پول کاربران"
                    value={formatToman(stats.totalUserWalletToman)}
                    hint="تومان (قابل مدیریت در بخش مالی)"
                  />
                )}
                {canAccessTab('ecosystem') && (
                  <KpiCard
                    label="مجموع حساب تجاری برندها"
                    value={formatToman(stats.totalPartnerWalletToman)}
                    hint="تومان (اعتبار تبلیغات و مزایده)"
                    accent
                  />
                )}
                {canAccessTab('ecosystem') && financialSummary && (
                  <KpiCard
                    label="درآمد مزایده‌های تاییدشده"
                    value={formatToman(financialSummary.approvedAdBidsRevenueToman)}
                    hint={`${formatToman(financialSummary.pendingAuctionBidsVolumeToman)} تومان پیشنهاد در جریان`}
                  />
                )}
                {canAccessTab('campaigns') && (
                  <KpiCard
                    label="تعاملات برندهای همکار"
                    value={toFaDigits(
                      (analytics?.totalImpressions || 0) + (analytics?.totalAffiliateClicks || 0)
                    )}
                    hint={`${toFaDigits(analytics?.totalProfileOpens || 0)} بازدید صفحه برند`}
                  />
                )}
              </div>

              {/* Actionable Quick Queues */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold">اقدامات فوری مدیریت</h2>
                    {can('content.recipes') && (
                      <button
                        type="button"
                        onClick={() => setBulkOpen(true)}
                        className="text-xs font-medium text-[#B54B1F] dark:text-[#E29A6F] hover:underline"
                      >
                        + ورود دسته‌ای دستورها
                      </button>
                    )}
                  </div>
                  <div className="space-y-2.5 text-sm">
                    {can('content.photos') && (
                      <QuickRow
                        label="عکس‌های واقعی کاربران در انتظار بررسی"
                        count={stats.pendingPhotosCount}
                        actionLabel="بررسی و انتخاب تصویر اصلی"
                        onClick={() => {
                          setPhotoStatusFilter('pending');
                          setActiveNav('photos');
                        }}
                      />
                    )}
                    {can('content.recipes') && (
                      <QuickRow
                        label="دستورهای پخت بدون عکس (آماده عکاسی کاربران)"
                        count={stats.recipesWithoutPhoto}
                        actionLabel="مشاهده فهرست"
                        onClick={() => {
                          setRecipePhotoFilter('without');
                          setActiveNav('recipes');
                        }}
                      />
                    )}
                    {can('content.recipes') && (
                      <QuickRow
                        label="پیش‌نویس‌های دستورپخت در انتظار پیش‌نمایش و تایید"
                        count={stats.pendingDraftVersionsCount}
                        actionLabel="بررسی و تایید پیش‌نویس‌ها"
                        onClick={() => {
                          setRecipeStatusFilter('has_draft');
                          setActiveNav('recipes');
                        }}
                      />
                    )}
                    {can('content.recipes') && (
                      <QuickRow
                        label="دستورهای ارسالی کاربران در انتظار انتشار"
                        count={stats.pendingRecipesCount}
                        actionLabel="بررسی دستورها"
                        onClick={() => {
                          setRecipeStatusFilter('pending');
                          setActiveNav('recipes');
                        }}
                      />
                    )}
                    {canAccessTab('partners') && (
                      <QuickRow
                        label="کسب‌وکارهای در انتظار تایید یا مالکیت"
                        count={stats.pendingPartnersCount}
                        actionLabel="مدیریت اصناف"
                        onClick={() => setActiveNav('partners')}
                      />
                    )}
                    {canAccessTab('ecosystem') && (
                      <QuickRow
                        label="تراکنش‌های ثبت‌شده در گزارش مالی و دفتر کل"
                        count={transactions.length}
                        actionLabel="مشاهده گزارش‌های مالی"
                        onClick={() => setActiveNav('ecosystem')}
                      />
                    )}
                    {canAccessTab('advanced_analytics') && (
                      <QuickRow
                        label="تحلیل رفتاری پیشرفته (ماندگاری، نرخ اسکرول، علایق و ساعات اوج)"
                        count={stats.totalRecipes}
                        actionLabel="مشاهده نمودارهای پیشرفته"
                        onClick={() => setActiveNav('advanced_analytics')}
                      />
                    )}
                    {canAccessTab('rbac') && (
                      <QuickRow
                        label="اعضای تیم مدیریت دارای سطح دسترسی فعال"
                        count={staffMembersCount}
                        actionLabel="مدیریت نقش‌ها"
                        onClick={() => setActiveNav('rbac')}
                      />
                    )}
                  </div>
                </div>

                {/* Role RBAC Scope & Partner Analytics */}
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
                  <h2 className="text-base font-bold">
                    {canAccessTab('partners') ? 'عملکرد اصناف و محدوده دسترسی نقش' : 'محدوده دسترسی نقش فعلی (RBAC)'}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs pb-3 border-b border-[#E6E6E3] dark:border-[#282825]">
                    {activeRoleDomainDecisions.map((d) => (
                      <div key={d.sectionId} className="space-y-0.5">
                        <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{d.sectionTitle}</p>
                        <p
                          className={`font-extrabold ${
                            d.accessLevel === 'full'
                              ? 'text-[#15803D] dark:text-[#4ADE80]'
                              : d.accessLevel === 'read_only'
                                ? 'text-[#8C5B12] dark:text-[#ECC06E]'
                                : 'text-[#B91C1C] dark:text-[#F87171]'
                          }`}
                        >
                          {d.accessLabel}
                        </p>
                      </div>
                    ))}
                  </div>
                  {canAccessTab('partners') ? (
                    analytics && analytics.byPartner.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-right tabular-nums">
                          <thead>
                            <tr className="border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                              <th className="py-2 font-medium">نام همکار</th>
                              <th className="py-2 font-medium">نمایش</th>
                              <th className="py-2 font-medium">بازدید</th>
                              <th className="py-2 font-medium">کوپن</th>
                              <th className="py-2 font-medium">کلیک خرید</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
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
                      <p className="text-xs text-[#5C5C58]">داده‌ای ثبت نشده است.</p>
                    )
                  ) : (
                    <div className="space-y-2 text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                      <p className="leading-relaxed">
                        {aclRoles.find((r) => r.id === activeRole)?.description ||
                          'دسترسی‌های این نقش از طریق ماتریس دسترسی پویا تنظیم شده است.'}
                      </p>
                      <ul className="space-y-1.5 pt-1">
                        {navItems
                          .filter((item) => item.id !== 'overview')
                          .slice(0, 5)
                          .map((item) => (
                            <li key={item.id} className="flex items-center gap-1.5 text-[#0D0D0D] dark:text-[#FAFAFA]">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />
                              <span>{item.label}</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {can('content.chefs') && pendingChefs.length > 0 && (
                    <div className="pt-3 border-t border-[#E6E6E3] dark:border-[#282825] space-y-2">
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

              {/* Smart Editorial Recommendations Spotlight */}
              {can('content.recipes') && editorialInsights && editorialInsights.recommendations.length > 0 && (
                <div className="rounded-2xl border border-[#B54B1F]/25 dark:border-[#E29A6F]/25 bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#B54B1F]/10 dark:bg-[#E29A6F]/15 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                      </div>
                      <div>
                        <h2 className="text-sm sm:text-base font-extrabold">
                          پیشنهادهای هوشمند بازبینی (بر اساس ترندهای جستجوی کاربران)
                        </h2>
                        <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                          {toFaDigits(editorialInsights.totalSearchesAnalyzed)} جستجو تحلیل شد ·{' '}
                          {toFaDigits(editorialInsights.recommendations.length)} دستور نیازمند توجه ·{' '}
                          {toFaDigits(editorialInsights.contentGaps.length)} ترند بدون دستورپخت
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecipesSubTab('insights');
                        setActiveNav('recipes');
                      }}
                      className="min-h-[38px] px-4 rounded-xl bg-[#111110] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:text-[#111110] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>مشاهده کامل تحلیل و ترندها</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {editorialInsights.recommendations.slice(0, 3).map((recItem) => (
                      <div
                        key={recItem.recipe.id}
                        className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2 text-[10px] tabular-nums">
                            <span className="px-2 py-0.5 rounded-md bg-[#B54B1F]/12 text-[#B54B1F] dark:text-[#E29A6F] font-bold">
                              اولویت {toFaDigits(recItem.priorityScore)} از ۱۰۰
                            </span>
                            {recItem.searchHits > 0 && (
                              <span className="text-[#5C5C58] font-semibold">
                                {toFaDigits(recItem.searchHits)} جستجوی مرتبط
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-extrabold truncate">{recItem.recipe.title}</div>
                          <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] line-clamp-2 leading-relaxed">
                            {recItem.reasons[0]?.label}: {recItem.reasons[0]?.detail}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (recItem.recommendedAction === 'review_draft') {
                              setVersionModalTarget({recipeId: recItem.recipe.id});
                            } else if (recItem.recommendedAction === 'moderate_photo') {
                              setPhotoStatusFilter('pending');
                              setActiveNav('photos');
                            } else if (recItem.recommendedAction === 'answer_qa') {
                              setActiveNav('frontend_ops');
                            } else {
                              setDraftSeedTitle('');
                              setEditingRecipe(recItem.recipe);
                            }
                          }}
                          className="w-full min-h-[34px] rounded-lg bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-[11px] font-semibold"
                        >
                          {recItem.recommendedActionLabel}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              2. RECIPES CMS + VERSION CONTROL + SMART RECOMMENDATIONS
          ========================================================= */}
          {currentNav === 'recipes' && canAccessTab('recipes') && (
            <div className="space-y-5">
              {/* Recipes Workspace Sub-Tab Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setRecipesSubTab('catalog')}
                    className={`min-h-[38px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                      recipesSubTab === 'catalog'
                        ? 'bg-[#B54B1F] text-white dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                        : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>فهرست دستورها و کنترل نسخه</span>
                    {pendingDrafts.length > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                          recipesSubTab === 'catalog'
                            ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#0B0B0B]'
                            : 'bg-[#A97222]/15 text-[#8A5A14] dark:text-[#E8C483]'
                        }`}
                      >
                        {toFaDigits(pendingDrafts.length)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecipesSubTab('insights')}
                    className={`min-h-[38px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                      recipesSubTab === 'insights'
                        ? 'bg-[#B54B1F] text-white dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                        : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#0D0D0D] dark:hover:text-[#FAFAFA]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>پیشنهاددهنده هوشمند و ترند جستجو</span>
                    {editorialInsights && editorialInsights.recommendations.length > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] tabular-nums ${
                          recipesSubTab === 'insights'
                            ? 'bg-white/20 text-white dark:bg-black/20 dark:text-[#0B0B0B]'
                            : 'bg-[#B54B1F]/12 text-[#B54B1F] dark:text-[#E29A6F]'
                        }`}
                      >
                        {toFaDigits(editorialInsights.recommendations.length)}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {recipesSubTab === 'insights' ? (
                <AdminEditorialInsightsPanel
                  report={editorialInsights}
                  loading={insightsLoading}
                  days={insightsDays}
                  onChangeDays={(d) => {
                    setInsightsDays(d);
                    refreshEditorialInsights(d);
                  }}
                  onRefresh={() => refreshEditorialInsights(insightsDays)}
                  onEditRecipeAsDraft={(rec) => {
                    setDraftSeedTitle('');
                    setEditingRecipe(rec);
                  }}
                  onOpenVersions={(recipeId) => setVersionModalTarget({recipeId})}
                  onOpenPhotoModeration={() => {
                    setPhotoStatusFilter('pending');
                    setActiveNav('photos');
                  }}
                  onOpenQaModeration={() => setActiveNav('frontend_ops')}
                  onCreateRecipeFromTrend={(trendQuery) => {
                    setDraftSeedTitle(trendQuery);
                    setEditingRecipe('new');
                  }}
                />
              ) : (
                <>
              {/* Pending Drafts Review Queue */}
              {pendingDrafts.length > 0 && (
                <div className="rounded-2xl border border-[#A97222]/35 bg-[#A97222]/[0.06] dark:bg-[#D8A85B]/[0.08] p-4 sm:p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-[#A97222] dark:text-[#E8C483]" />
                      <h2 className="text-sm font-extrabold text-[#7C5010] dark:text-[#E8C483]">
                        صف پیش‌نویس‌های در انتظار پیش‌نمایش و تایید نهایی ({toFaDigits(pendingDrafts.length)})
                      </h2>
                    </div>
                    <span className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
                      نسخه فعال فعلی تا زمان تایید شما تغییری نمی‌کند.
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {pendingDrafts.map((dr) => (
                      <div
                        key={dr.versionId}
                        className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-3.5 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold truncate">{dr.recipeTitle}</span>
                            <span className="px-2 py-0.5 rounded-md bg-[#A97222]/15 text-[#8A5A14] dark:text-[#E8C483] text-[10px] font-bold shrink-0 tabular-nums">
                              نسخه {toFaDigits(dr.versionNumber)}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] line-clamp-2 leading-relaxed">
                            {dr.changeSummary || 'پیش‌نویس آماده بررسی'}
                          </p>
                          <div className="text-[10px] text-[#5C5C58]">ثبت توسط: {dr.createdByName}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setVersionModalTarget({recipeId: dr.recipeId, versionId: dr.versionId})}
                          className="w-full min-h-[36px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>پیش‌نمایش، مقایسه و تایید</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full sm:w-auto">
                  <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
                    <Search className="w-4 h-4 text-[#5C5C58] absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      placeholder="جست‌وجو در عنوان، دسته، شهر یا نویسنده..."
                      className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] pr-9 pl-3 text-xs"
                    />
                  </div>
                  <select
                    value={recipeStatusFilter}
                    onChange={(e) =>
                      setRecipeStatusFilter(e.target.value as 'all' | 'published' | 'pending' | 'has_draft')
                    }
                    className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                  >
                    <option value="all">همه وضعیت‌ها</option>
                    <option value="has_draft">دارای پیش‌نویس آماده بررسی</option>
                    <option value="published">منتشرشده</option>
                    <option value="pending">در انتظار تایید</option>
                  </select>
                  <select
                    value={recipePhotoFilter}
                    onChange={(e) => setRecipePhotoFilter(e.target.value as 'all' | 'without' | 'with')}
                    className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                    className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تولید دستور جدید</span>
                  </button>
                </div>
              </div>

              {/* Desktop Recipes Table */}
              <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-[#F6F6F5] dark:bg-[#0B0B0B] border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">تصویر و عنوان دستور</th>
                        <th className="py-3.5 px-3 font-medium">دسته / منطقه</th>
                        <th className="py-3.5 px-3 font-medium">نویسنده</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت عکس</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت و نسخه</th>
                        <th className="py-3.5 px-4 font-medium text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825]">
                      {filteredRecipes.map((rec) => {
                        const hasPhoto = Boolean(rec.imageUrl && rec.imageUrl.trim().length > 0);
                        const hasDrafts = (rec.pendingDraftsCount || 0) > 0;
                        return (
                          <tr
                            key={rec.id}
                            className="hover:bg-[#F6F6F5]/70 dark:hover:bg-[#0B0B0B]/50 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3 min-w-[240px]">
                                <div className="w-14 h-11 rounded-lg overflow-hidden border border-[#E6E6E3] dark:border-[#282825] shrink-0">
                                  <EditorialImage
                                    src={rec.imageUrl}
                                    alt={rec.title}
                                    aspectClass="h-full"
                                    compactEmpty
                                  />
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-sm truncate max-w-[280px]">{rec.title}</div>
                                  <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                                    {toFaDigits(rec.ingredients.length)} ماده · {toFaDigits(rec.steps.length)} مرحله
                                    {rec.isVip ? ` · ویژه (${toFaDigits(rec.vipGemCost)} جِم)` : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div>{rec.category}</div>
                              <div className="text-[11px] text-[#5C5C58]">{rec.region}</div>
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
                              <div className="flex flex-col gap-1 items-start">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={
                                      rec.status === 'published'
                                        ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                                        : 'text-[#A97222] font-semibold'
                                    }
                                  >
                                    {rec.status === 'published' ? 'منتشرشده' : 'پیش‌نویس اولیه'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-[#EFEFED] dark:bg-[#232320] text-[#5C5C58] dark:text-[#A3A39E] text-[10px] font-bold tabular-nums">
                                    نسخه {toFaDigits(rec.latestVersionNumber || 1)}
                                  </span>
                                </div>
                                {hasDrafts && (
                                  <button
                                    type="button"
                                    onClick={() => setVersionModalTarget({recipeId: rec.id})}
                                    className="px-2 py-0.5 rounded-md bg-[#A97222]/15 text-[#8A5A14] dark:text-[#E8C483] text-[10px] font-bold hover:underline tabular-nums"
                                  >
                                    {toFaDigits(rec.pendingDraftsCount || 0)} پیش‌نویس در انتظار تایید
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap text-left">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  title="تاریخچه نسخه‌ها و پیش‌نمایش"
                                  onClick={() => setVersionModalTarget({recipeId: rec.id})}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors ${
                                    hasDrafts
                                      ? 'bg-[#A97222] text-white hover:bg-[#8E5E1B]'
                                      : 'border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]'
                                  }`}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{hasDrafts ? 'بررسی پیش‌نویس' : 'نسخه‌ها'}</span>
                                </button>
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
                                    className="px-2.5 py-1.5 rounded-lg bg-[#B54B1F] text-white text-[11px] font-semibold"
                                  >
                                    انتشار
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-label="ویرایش دستور"
                                  onClick={() => setEditingRecipe(rec)}
                                  className="p-2 rounded-lg border border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
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
                                  className="p-2 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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
                </>
              )}
            </div>
          )}

          {/* =========================================================
              3. COMMUNITY PHOTO MODERATION & COVER PROMOTION
          ========================================================= */}
          {currentNav === 'photos' && canAccessTab('photos') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                <div className="space-y-0.5">
                  <p className="text-sm font-bold">تایید عکس‌های واقعی غذای پخته‌شده توسط کاربران</p>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
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
                          ? 'bg-[#B54B1F] text-white dark:bg-[#E29A6F] dark:text-[#0B0B0B]'
                          : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredPhotos.length === 0 ? (
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-12 text-center space-y-2">
                  <ImageIcon className="w-8 h-8 mx-auto text-[#5C5C58]/50" />
                  <p className="text-sm font-medium">در این فیلتر عکسی برای نمایش وجود ندارد.</p>
                  <p className="text-xs text-[#5C5C58]">
                    وقتی کاربران از صفحه دستور پخت عکس واقعی غذای خود را آپلود کنند، اینجا نمایش داده می‌شود.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredPhotos.map((ph) => (
                    <div
                      key={ph.id}
                      className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="aspect-[4/3] bg-[#EFEFED] dark:bg-[#20201E] relative">
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
                          <div className="flex items-center justify-between text-xs text-[#5C5C58]">
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
                            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{ph.caption}</p>
                          )}
                        </div>
                      </div>

                      <div className="p-4 pt-0 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => handleModeratePhoto(ph.id, 'approve_cover')}
                          className="w-full min-h-[40px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-[#FAFAFA] text-xs font-medium inline-flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تایید و انتخاب به‌عنوان تصویر اصلی دستور</span>
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleModeratePhoto(ph.id, 'approve')}
                            className="min-h-[38px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
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
          {currentNav === 'users' && canAccessTab('users') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-[#5C5C58] absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="جست‌وجوی کاربر با نام، شماره موبایل یا شهر..."
                    className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] pr-9 pl-3 text-xs"
                  />
                </div>
                <div className="flex items-center gap-3 text-xs text-[#5C5C58] tabular-nums">
                  <span>مجموع کاربران: {toFaDigits(filteredUsers.length)} نفر</span>
                  {can('rbac.manage') && (
                    <button
                      type="button"
                      onClick={() => setActiveNav('rbac')}
                      className="min-h-[36px] px-3 rounded-xl border border-[#B54B1F]/35 text-[#B54B1F] dark:text-[#E29A6F] font-semibold inline-flex items-center gap-1.5 hover:bg-[#B54B1F]/8"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>کنسول سطوح دسترسی</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right tabular-nums">
                    <thead className="bg-[#F6F6F5] dark:bg-[#0B0B0B] border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">کاربر و موبایل</th>
                        <th className="py-3.5 px-3 font-medium">نقش و سطح دسترسی</th>
                        <th className="py-3.5 px-3 font-medium">کیف پول (تومان)</th>
                        <th className="py-3.5 px-3 font-medium">کیف جِم</th>
                        <th className="py-3.5 px-3 font-medium">مشارکت</th>
                        <th className="py-3.5 px-4 font-medium text-left">مدیریت و شارژ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825]">
                      {filteredUsers.map((u) => {
                        const adminNorm = normalizeAdminRole(u.role, aclRoles);
                        const selectRoleValue = u.role === 'admin' ? 'senior_admin' : u.role;
                        return (
                          <tr key={u.id} className={u.isSuspended ? 'opacity-55' : ''}>
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-sm flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {u.isVerifiedChef && (
                                  <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                                )}
                              </div>
                              <div className="text-[11px] text-[#5C5C58]" dir="ltr">
                                {toFaDigits(u.phone)} · {u.city}
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              {can('rbac.manage') ? (
                                <select
                                  value={selectRoleValue}
                                  onChange={async (e) => {
                                    try {
                                      await apiRequest(`/api/admin/users/${u.id}`, {
                                        method: 'PATCH',
                                        useAdmin: true,
                                        body: JSON.stringify({
                                          role: e.target.value,
                                          roleNote: 'بروزرسانی از جدول کاربران',
                                        }),
                                      });
                                      onNotify(
                                        `نقش ${u.name} به «${getRoleLabel(e.target.value, aclRoles)}» به‌روزرسانی شد.`
                                      );
                                      loadAllAdminData();
                                    } catch (err) {
                                      onNotify(err instanceof Error ? err.message : 'خطا در تغییر نقش کاربر');
                                    }
                                  }}
                                  className="min-h-[34px] rounded-lg border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-2 text-xs"
                                >
                                  <option value="user">کاربر عادی</option>
                                  <option value="chef">سرآشپز</option>
                                  <option value="partner">برند همکار</option>
                                  {aclRoles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                    adminNorm
                                      ? getRoleBadgeClass(adminNorm)
                                      : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                                  }`}
                                >
                                  {getRoleLabel(u.role, aclRoles)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 font-bold text-[#B54B1F] dark:text-[#E29A6F]">
                              {formatToman(u.walletBalance)}
                            </td>
                            <td className="py-3.5 px-3 font-bold text-[#A97222] dark:text-[#D8A85B]">
                              {toFaDigits(u.gems)} جِم
                            </td>
                            <td className="py-3.5 px-3 text-[#5C5C58]">
                              {toFaDigits(u.recipesCount)} دستور · {toFaDigits(u.photosCount)} عکس
                            </td>
                            <td className="py-3.5 px-4 text-left whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {can('finance.wallets') && (
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
                                )}
                                {can('users.manage') && (
                                  <>
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
                                      className="px-2.5 py-1.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-[11px]"
                                    >
                                      {u.isVerifiedChef ? 'لغو نشان' : 'تایید سرآشپز'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await apiRequest(`/api/admin/users/${u.id}`, {
                                            method: 'PATCH',
                                            useAdmin: true,
                                            body: JSON.stringify({isSuspended: !u.isSuspended}),
                                          });
                                          onNotify(u.isSuspended ? 'حساب کاربری فعال شد.' : 'حساب کاربری مسدود شد.');
                                          loadAllAdminData();
                                        } catch (err) {
                                          onNotify(err instanceof Error ? err.message : 'خطا در تغییر وضعیت حساب');
                                        }
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-[11px] text-red-600"
                                    >
                                      {u.isSuspended ? 'رفع مسدودی' : 'مسدود'}
                                    </button>
                                  </>
                                )}
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
              5. PARTNERS & COMMERCIAL ACCOUNT WALLET TOP-UP
          ========================================================= */}
          {currentNav === 'partners' && canAccessTab('partners') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                <div>
                  <h2 className="text-sm font-bold">مدیریت حساب‌های تجاری، اصناف و شارژ اعتبار تبلیغاتی</h2>
                  <p className="text-xs text-[#5C5C58]">
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

              <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right tabular-nums">
                    <thead className="bg-[#F6F6F5] dark:bg-[#0B0B0B] border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                      <tr>
                        <th className="py-3.5 px-4 font-medium">نام کسب‌وکار</th>
                        <th className="py-3.5 px-3 font-medium">رسته صنفی / شهر</th>
                        <th className="py-3.5 px-3 font-medium">سطح همکاری</th>
                        <th className="py-3.5 px-3 font-medium">حساب تجاری (تومان)</th>
                        <th className="py-3.5 px-3 font-medium">وضعیت</th>
                        <th className="py-3.5 px-4 font-medium text-left">عملیات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825]">
                      {partners.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-sm flex items-center gap-1.5">
                              <span>{p.name}</span>
                              {p.verified && <BadgeCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />}
                            </div>
                            <div className="text-[11px] text-[#5C5C58]">
                              {p.promoCode ? `کد تخفیف: ${p.promoCode}` : p.phone}
                            </div>
                          </td>
                          <td className="py-3.5 px-3">
                            <div>{PARTNER_ROLE_LABELS[p.roleType]}</div>
                            <div className="text-[11px] text-[#5C5C58]">{p.city}</div>
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
                              className="min-h-[34px] rounded-lg border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-2 text-xs"
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
          {currentNav === 'campaigns' && canAccessTab('campaigns') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4">
                <div>
                  <h2 className="text-sm font-bold">مدیریت اسپانسرها، جایگاه‌های تبلیغاتی و کمپین‌ها</h2>
                  <p className="text-xs text-[#5C5C58]">
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
                    className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-[#5C5C58]">
                          <span className="font-semibold text-[#B54B1F] dark:text-[#E29A6F]">{camp.partnerName}</span>
                          <span>·</span>
                          <span>{PLACEMENT_LABELS[camp.placement]}</span>
                        </div>
                        <h3 className="text-base font-bold">{camp.title}</h3>
                        {camp.subtitle && <p className="text-xs text-[#5C5C58]">{camp.subtitle}</p>}
                      </div>
                      <span
                        className={`text-xs font-semibold shrink-0 ${
                          camp.status === 'active'
                            ? 'text-[#B54B1F] dark:text-[#E29A6F]'
                            : 'text-[#5C5C58]'
                        }`}
                      >
                        {camp.status === 'active' ? 'فعال' : camp.status === 'paused' ? 'متوقف' : 'پایان‌یافته'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 py-3 border-y border-[#E6E6E3]/70 dark:border-[#282825] text-xs tabular-nums">
                      <div>
                        <div className="text-[#5C5C58]">بودجه کل</div>
                        <div className="font-bold mt-0.5">{formatToman(camp.budgetToman)}</div>
                      </div>
                      <div>
                        <div className="text-[#5C5C58]">نمایش / کلیک</div>
                        <div className="font-bold mt-0.5">
                          {toFaDigits(camp.impressions)} / {toFaDigits(camp.clicks)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[#5C5C58]">کد تخفیف</div>
                        <div className="font-bold font-mono mt-0.5" dir="ltr">
                          {camp.promoCode || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[#5C5C58]">
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
                          className="px-3 py-1.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium"
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
              6B. LIVE DYNAMIC APP CONTROL CENTER
          ========================================================= */}
          {currentNav === 'app_control' && canAccessTab('app_control') && config && (
            <AdminDynamicAppControlPanel
              config={config}
              onChangeConfig={setConfig}
              onSave={handleSaveEcosystem}
            />
          )}

          {/* =========================================================
              6C. MULTI-FORMAT NATIVE AD STUDIO
          ========================================================= */}
          {currentNav === 'native_ads' && canAccessTab('native_ads') && (
            <AdminNativeAdsPanel
              nativeAds={nativeAds}
              partners={partners}
              disclosureLabel={config?.adHarmony?.disclosureLabel}
              onRefresh={() => {
                onRefreshAppConfig();
                loadAllAdminData();
              }}
              onNotify={onNotify}
            />
          )}

          {/* =========================================================
              6D. AD MARKETPLACE, AUCTIONS, FLAGSHIP & ADVERTISER PORTAL CONTROL
          ========================================================= */}
          {currentNav === 'advanced_analytics' && canAccessTab('advanced_analytics') && (
            <AdvancedBehavioralAnalyticsPanel onNotify={onNotify} />
          )}

          {currentNav === 'behavior_reports' && canAccessTab('behavior_reports') && (
            <AdminBehavioralChartsPanel onNotify={onNotify} />
          )}

          {currentNav === 'behavioral_intel' && canAccessTab('behavioral_intel') && (
            <AdminBehavioralIntelligencePanel onNotify={onNotify} />
          )}

          {currentNav === 'ad_market' && canAccessTab('ad_market') && (
            <AdminAdMarketplacePanel
              partners={partners}
              onRefreshAppConfig={() => {
                onRefreshAppConfig();
                loadAllAdminData();
              }}
              onNotify={onNotify}
            />
          )}

          {/* =========================================================
              7. FINANCIAL REPORTING & LEDGER (FINANCE MANAGER & SENIOR ADMIN ONLY)
          ========================================================= */}
          {currentNav === 'ecosystem' && canAccessTab('ecosystem') && (
            <div className="space-y-6">
              {financialSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
                  <KpiCard
                    label="مجموع حساب تجاری برندها"
                    value={formatToman(financialSummary.partnerWalletTotalToman)}
                    hint="تومان · موجودی کل اصناف و برندها"
                    accent
                  />
                  <KpiCard
                    label="درآمد مزایده‌های تاییدشده"
                    value={formatToman(financialSummary.approvedAdBidsRevenueToman)}
                    hint="تومان · جایگاه‌های تبلیغاتی تاییدشده"
                  />
                  <KpiCard
                    label="حجم پیشنهادهای مزایده فعال"
                    value={formatToman(financialSummary.pendingAuctionBidsVolumeToman)}
                    hint="تومان · در انتظار بررسی و نهایی‌سازی"
                  />
                  <KpiCard
                    label="بودجه کمپین‌های فعال"
                    value={formatToman(financialSummary.activeCampaignBudgetToman)}
                    hint={`${toFaDigits(financialSummary.transactionsCount)} تراکنش ثبت‌شده`}
                  />
                </div>
              )}

              {can('finance.wallets') && partners.length > 0 && (
                <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
                  <div>
                    <h2 className="text-base font-bold inline-flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
                      <span>مانده حساب تجاری برندهای همکار و شارژ کیف پول</span>
                    </h2>
                    <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
                      مدیریت مالی و تعدیل اعتبار تبلیغاتی برندها بدون نیاز به دسترسی به تنظیمات تبلیغات
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right tabular-nums">
                      <thead className="border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                        <tr>
                          <th className="py-2 font-medium">نام برند / کسب‌وکار</th>
                          <th className="py-2 font-medium">رسته و شهر</th>
                          <th className="py-2 font-medium">مانده حساب تجاری</th>
                          <th className="py-2 font-medium text-left">عملیات مالی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
                        {partners.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2.5 font-bold">{p.name}</td>
                            <td className="py-2.5 text-[#5C5C58] dark:text-[#A3A39E]">
                              {PARTNER_ROLE_LABELS[p.roleType]} · {p.city}
                            </td>
                            <td className="py-2.5 font-extrabold text-[#A97222] dark:text-[#D8A85B]">
                              {formatToman(p.businessBalance)} تومان
                            </td>
                            <td className="py-2.5 text-left">
                              <button
                                type="button"
                                onClick={() => {
                                  setWalletCurrency('toman');
                                  setWalletAmount('');
                                  setWalletReason('شارژ اعتبار تجاری از بخش مالی');
                                  setWalletTarget({
                                    type: 'partner',
                                    id: p.id,
                                    name: p.name,
                                    currentToman: p.businessBalance,
                                  });
                                }}
                                className="min-h-[34px] px-3 rounded-lg bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>شارژ یا تعدیل</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
                <h2 className="text-base font-bold inline-flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#B54B1F]" />
                  <span>دفتر کل تراکنش‌های شارژ کاربری و حساب تجاری برندها ({toFaDigits(transactions.length)})</span>
                </h2>
                {transactions.length === 0 ? (
                  <p className="text-xs text-[#5C5C58]">هنوز تراکنش شارژ دستی توسط مدیریت ثبت نشده است.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right tabular-nums">
                      <thead className="border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                        <tr>
                          <th className="py-2 font-medium">نوع حساب</th>
                          <th className="py-2 font-medium">نام صاحب حساب</th>
                          <th className="py-2 font-medium">شرح</th>
                          <th className="py-2 font-medium">ثبت‌کننده</th>
                          <th className="py-2 font-medium">مبلغ</th>
                          <th className="py-2 font-medium">مانده پس از تراکنش</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
                        {transactions.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5">{tx.accountType === 'partner' ? 'حساب تجاری' : 'کاربر'}</td>
                            <td className="py-2.5 font-medium">{tx.accountName}</td>
                            <td className="py-2.5 text-[#5C5C58]">{tx.reason}</td>
                            <td className="py-2.5 text-[11px] text-[#5C5C58]">{tx.createdBy}</td>
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
              8. SMART KITCHEN / SUBSTITUTIONS & Q&A MODERATION
          ========================================================= */}
          {currentNav === 'frontend_ops' && canAccessTab('frontend_ops') && (
            <AdminFrontendOpsPanel
              adminRole={activeRole}
              aclRoles={aclRoles}
              permissions={activePermissions}
              onRefreshAppConfig={onRefreshAppConfig}
              onNotify={onNotify}
            />
          )}

          {/* =========================================================
              9. DYNAMIC ACCESS CONTROL LIST (ACL) CONSOLE
          ========================================================= */}
          {currentNav === 'rbac' && canAccessTab('rbac') && (
            <AdminRbacPanel
              users={users}
              aclRoles={aclRoles}
              auditLogs={rbacAuditLogs}
              onRefresh={loadAllAdminData}
              onNotify={onNotify}
            />
          )}
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: ADMIN RECIPE CREATE / EDIT CMS MODAL (DRAFT + LIVE PREVIEW)
      ===================================================================== */}
      {editingRecipe && can('content.recipes') && (
        <AdminRecipeEditorModal
          initial={editingRecipe === 'new' ? null : editingRecipe}
          prefillTitle={editingRecipe === 'new' ? draftSeedTitle : ''}
          onClose={() => {
            setEditingRecipe(null);
            setDraftSeedTitle('');
          }}
          onSaved={(savedDraftTarget) => {
            setEditingRecipe(null);
            setDraftSeedTitle('');
            onRefreshAppRecipes();
            loadAllAdminData();
            if (savedDraftTarget) {
              setVersionModalTarget(savedDraftTarget);
            }
          }}
          onNotify={onNotify}
        />
      )}

      {/* =====================================================================
          MODAL 1B: RECIPE VERSION CONTROL, PREVIEW & APPROVAL MODAL
      ===================================================================== */}
      {versionModalTarget && can('content.recipes') && (
        <AdminRecipeVersionModal
          recipeId={versionModalTarget.recipeId}
          initialVersionId={versionModalTarget.versionId}
          onClose={() => setVersionModalTarget(null)}
          onChanged={() => {
            onRefreshAppRecipes();
            loadAllAdminData();
          }}
          onEditAsDraft={(rec) => setEditingRecipe(rec)}
          onNotify={onNotify}
        />
      )}

      {/* =====================================================================
          MODAL 2: BULK IMPORT THOUSANDS OF RECIPES (JSON / FILE)
      ===================================================================== */}
      {bulkOpen && can('content.recipes') && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="w-full max-w-3xl rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">ورود دسته‌ای هزاران دستور پخت (بدون نیاز به عکس)</h2>
                <p className="text-xs text-[#5C5C58] mt-0.5">
                  فایل JSON خود را بارگذاری یا جای‌گذاری کنید (تا ۲٬۰۰۰ دستور در هر نوبت). دستورهای بدون عکس با طراحی تایپوگرافی ادیتوریال نمایش داده شده و منتظر ثبت عکس واقعی کاربران می‌مانند.
                </p>
              </div>
              <button type="button" onClick={() => setBulkOpen(false)} className="p-2 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="min-h-[40px] px-4 rounded-xl border border-dashed border-[#B54B1F]/50 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#EFEFED] dark:hover:bg-[#20201E]">
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
                className="min-h-[40px] px-3.5 rounded-xl bg-[#EFEFED] dark:bg-[#20201E] text-xs"
              >
                بارگذاری نمونه استاندارد (۲ دستور بدون عکس)
              </button>
            </div>

            <textarea
              rows={12}
              dir="ltr"
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3.5 text-xs font-mono"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs"
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
      {walletTarget && can('finance.wallets') && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleWalletSubmit}
            className="w-full max-w-md rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold">
                  {walletTarget.type === 'user' ? 'شارژ / تعدیل حساب کاربری' : 'شارژ / تعدیل حساب تجاری'}
                </h2>
                <p className="text-xs text-[#5C5C58] mt-0.5">{walletTarget.name}</p>
              </div>
              <button type="button" onClick={() => setWalletTarget(null)} className="p-1.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs flex items-center justify-between tabular-nums">
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
                      : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58]'
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
                      : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58]'
                  }`}
                >
                  اعتبار جِم (Gem)
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs text-[#5C5C58] mb-1">
                مبلغ ({walletTarget.type === 'partner' || walletCurrency === 'toman' ? 'تومان' : 'جِم'} — برای کسر علامت منفی بزنید)
              </label>
              <input
                type="number"
                required
                value={walletAmount}
                onChange={(e) => setWalletAmount(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs text-[#5C5C58] mb-1">شرح سند و علت تراکنش</label>
              <input
                type="text"
                required
                minLength={3}
                value={walletReason}
                onChange={(e) => setWalletReason(e.target.value)}
                placeholder="مثلاً واریز کارت‌به‌کارت بابت شارژ کمپین..."
                className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
      {partnerModalOpen && canAccessTab('partners') && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <form
            onSubmit={handleCreatePartner}
            className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4 my-6"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <select
                value={newPartner.roleType}
                onChange={(e) => setNewPartner({...newPartner, roleType: e.target.value as PartnerRoleId})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="شماره تماس"
                value={newPartner.phone}
                onChange={(e) => setNewPartner({...newPartner, phone: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <select
                value={newPartner.tier}
                onChange={(e) => setNewPartner({...newPartner, tier: e.target.value as 'free' | 'featured' | 'sponsor'})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
            </div>
            <input
              type="text"
              required
              placeholder="نشانی کامل"
              value={newPartner.address}
              onChange={(e) => setNewPartner({...newPartner, address: e.target.value})}
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            />
            <textarea
              rows={2}
              required
              placeholder="معرفی کسب‌وکار..."
              value={newPartner.description}
              onChange={(e) => setNewPartner({...newPartner, description: e.target.value})}
              className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="کد تخفیف (اختیاری)"
                value={newPartner.promoCode}
                onChange={(e) => setNewPartner({...newPartner, promoCode: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="عنوان تخفیف (مثلاً ۱۵٪ تخفیف)"
                value={newPartner.promoLabel}
                onChange={(e) => setNewPartner({...newPartner, promoLabel: e.target.value})}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
      {campaignModalOpen && canAccessTab('campaigns') && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleCreateCampaign}
            className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4"
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
              className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
              className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            />

            <input
              type="text"
              placeholder="توضیح کوتاه کمپین"
              value={newCampaign.subtitle}
              onChange={(e) => setNewCampaign({...newCampaign, subtitle: e.target.value})}
              className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            />

            <div className="grid grid-cols-2 gap-3">
              <select
                value={newCampaign.placement}
                onChange={(e) => setNewCampaign({...newCampaign, placement: e.target.value as CampaignPlacement})}
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="کد تخفیف (اختیاری)"
                value={newCampaign.promoCode}
                onChange={(e) => setNewCampaign({...newCampaign, promoCode: e.target.value})}
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="متن دکمه فراخوان (CTA)"
                value={newCampaign.ctaLabel}
                onChange={(e) => setNewCampaign({...newCampaign, ctaLabel: e.target.value})}
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
    <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
      <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">{label}</div>
      <div
        className={`text-xl sm:text-2xl font-extrabold ${
          accent ? 'text-[#A97222] dark:text-[#D8A85B]' : 'text-[#0D0D0D] dark:text-[#FAFAFA]'
        }`}
      >
        {value}
      </div>
      <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">{hint}</div>
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
    <div className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0 border-[#E6E6E3]/70 dark:border-[#282825]">
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
  prefillTitle,
  onClose,
  onSaved,
  onNotify,
}: {
  initial: Recipe | null;
  prefillTitle?: string;
  onClose: () => void;
  onSaved: (openVersionTarget?: {recipeId: string; versionId?: string | null}) => void;
  onNotify: (msg: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title || prefillTitle || '');
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
  const [status, setStatus] = useState<'published' | 'pending'>(initial ? initial.status : 'pending');
  const [changeSummary, setChangeSummary] = useState(
    !initial && prefillTitle ? `تولید دستورپخت جدید بر اساس ترند جستجوی «${prefillTitle}»` : ''
  );
  const [previewOpen, setPreviewOpen] = useState(false);
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

  const buildParsedPayload = (overrideStatus?: 'published' | 'pending') => {
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

    return {
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
      status: overrideStatus || status,
      changeSummary: changeSummary.trim(),
      ingredients,
      steps,
    };
  };

  const previewSnapshot = (): RecipeVersionSnapshot => {
    const p = buildParsedPayload();
    return {
      title: p.title.trim() || 'عنوان دستور پخت',
      subtitle: p.subtitle.trim() || `${p.category} · ${p.region}`,
      description: p.description.trim(),
      imageUrl: imageDataUrl || p.imageUrl,
      category: p.category,
      region: p.region,
      season: p.season,
      mealType: initial?.mealType || 'ناهار',
      dietTags: initial?.dietTags || ['سنتی'],
      prepMinutes: p.prepMinutes,
      cookMinutes: p.cookMinutes,
      servings: p.servings,
      difficulty: p.difficulty,
      nutrition: initial?.nutrition || {calories: 420, protein: 18, carbs: 45, fat: 14, fiber: 5},
      isVip: p.isVip,
      vipGemCost: p.vipGemCost,
      ingredients: p.ingredients,
      steps: p.steps,
      tools: initial?.tools || [],
    };
  };

  const submitWithMode = async (mode: 'draft' | 'publish') => {
    setSaving(true);
    try {
      const payload = buildParsedPayload(mode === 'publish' ? 'published' : 'pending');
      if (initial) {
        if (mode === 'draft') {
          const res = await apiRequest<{version: {id: string; versionNumber: number}}>(
            `/api/admin/recipes/${initial.id}/drafts`,
            {
              method: 'POST',
              useAdmin: true,
              body: JSON.stringify(payload),
            }
          );
          onNotify(
            `پیش‌نویس نسخه ${toFaDigits(res.version.versionNumber)} ثبت شد؛ اکنون می‌توانید آن را پیش‌نمایش و تایید کنید.`
          );
          onSaved({recipeId: initial.id, versionId: res.version.id});
        } else {
          await apiRequest(`/api/admin/recipes/${initial.id}`, {
            method: 'PUT',
            useAdmin: true,
            body: JSON.stringify(payload),
          });
          onNotify('نسخه جدید دستور پخت به‌طور مستقیم منتشر و در تاریخچه ثبت شد.');
          onSaved();
        }
      } else {
        const res = await apiRequest<{recipe: Recipe}>('/api/admin/recipes', {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify(payload),
        });
        if (mode === 'draft') {
          onNotify('پیش‌نویس دستور پخت جدید ایجاد شد؛ آماده پیش‌نمایش و تایید نهایی است.');
          onSaved({recipeId: res.recipe.id});
        } else {
          onNotify('دستور پخت جدید با موفقیت ایجاد و منتشر شد.');
          onSaved();
        }
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره دستور پخت');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitWithMode(initial ? 'draft' : status === 'published' ? 'publish' : 'draft');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <form
        onSubmit={handleSave}
        className="w-full max-w-3xl rounded-2xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] p-6 space-y-4 my-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            {initial ? `ویرایش و ثبت نسخه جدید: ${initial.title}` : 'تولید دستور پخت جدید (پیش‌نویس یا انتشار)'}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen((v) => !v)}
              className={`min-h-[36px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 ${
                previewOpen
                  ? 'border-[#B54B1F] bg-[#B54B1F]/10 text-[#B54B1F] dark:text-[#E29A6F]'
                  : 'border-[#E6E6E3] dark:border-[#282825] hover:bg-[#EFEFED] dark:hover:bg-[#20201E]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{previewOpen ? 'بازگشت به فرم ویرایش' : 'پیش‌نمایش زنده (Preview)'}</span>
            </button>
            <button type="button" onClick={onClose} aria-label="بستن">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {previewOpen ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#A97222]/30 bg-[#A97222]/8 px-3.5 py-2.5 text-xs text-[#7C5010] dark:text-[#E8C483]">
              این پیش‌نمایش زنده تغییرات فعلی فرم است. با ثبت به‌عنوان پیش‌نویس، نسخه جدید بدون تغییر در صفحه عمومی کاربران در صف تایید ذخیره می‌شود.
            </div>
            <EditorialSnapshotPreview snapshot={previewSnapshot()} authorName={initial?.authorName || 'تحریریه لاقلی'} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="عنوان دستور پخت"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="زیرعنوان ادیتوریال"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
            </div>

            <textarea
              rows={2}
              placeholder="توضیح کامل غذا..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs"
            />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <select
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
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
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <input
                type="number"
                min={1}
                value={cookMinutes}
                onChange={(e) => setCookMinutes(Number(e.target.value))}
                placeholder="زمان پخت"
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <input
                type="number"
                min={1}
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                placeholder="نفرات"
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'published' | 'pending')}
                className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              >
                <option value="pending">پیش‌نویس / در انتظار تایید</option>
                <option value="published">منتشرشده</option>
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
                className="w-48 min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
            )}

            {/* Optional Cover Image (Leave Blank for Community Photos!) */}
            <div className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] p-3.5 space-y-2">
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
                  className="w-36 h-24 object-cover rounded-lg border border-[#E6E6E3]"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-[#5C5C58] mb-1">
                  مواد اولیه (هر خط: نام ماده | مقدار | واحد)
                </label>
                <textarea
                  rows={6}
                  required
                  value={ingredientsText}
                  onChange={(e) => setIngredientsText(e.target.value)}
                  className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs leading-relaxed"
                />
              </div>
              <div>
                <label className="block text-xs text-[#5C5C58] mb-1">مراحل پخت (هر مرحله در یک خط)</label>
                <textarea
                  rows={6}
                  required
                  value={stepsText}
                  onChange={(e) => setStepsText(e.target.value)}
                  className="w-full rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 text-xs leading-relaxed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#5C5C58] mb-1">
                یادداشت تغییرات این نسخه (برای ثبت در تاریخچه کنترل نسخه)
              </label>
              <input
                type="text"
                maxLength={220}
                placeholder="مثلاً: اصلاح مقدار زعفران و افزودن نکته دم‌کشی روی حرارت ملایم"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#E6E6E3]/70 dark:border-[#282825]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs"
          >
            انصراف
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submitWithMode('publish')}
            className="min-h-[44px] px-4 rounded-xl border border-[#B54B1F]/40 dark:border-[#E29A6F]/40 text-[#B54B1F] dark:text-[#E29A6F] text-xs font-semibold hover:bg-[#B54B1F]/8 disabled:opacity-40"
          >
            {saving ? 'در حال ثبت...' : initial ? 'انتشار مستقیم نسخه جدید' : 'ایجاد و انتشار فوری'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => submitWithMode('draft')}
            className="min-h-[44px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-xs font-bold disabled:opacity-40"
          >
            {saving
              ? 'در حال ذخیره...'
              : initial
                ? 'ذخیره به‌عنوان پیش‌نویس و پیش‌نمایش'
                : 'ثبت پیش‌نویس برای بررسی'}
          </button>
        </div>
      </form>
    </div>
  );
}

// =============================================================================
// SENIOR ADMIN ADVANCED BEHAVIORAL ANALYTICS PANEL (RECHARTS + BEHAVIORTRACKER)
// =============================================================================

type AdvancedRecipeMetric = 'views' | 'avgDwellSeconds' | 'popularityScore';
type AdvancedTimeWindow = 'all' | 'morning_noon' | 'evening_night';
type AdvancedHourlyMetric = 'traffic' | 'dwell';
type AdvancedInterestChartView = 'radar' | 'donut';
type AdvancedScrollPanelView = 'funnel' | 'sections';
type AdvancedDataScope = 'merged' | 'server' | 'local';
type AdvancedTableSortKey = 'popularityScore' | 'avgDwellSeconds' | 'avgScrollDepthPercent' | 'views';

interface MergedRecipeAnalyticsRow {
  id: string;
  title: string;
  shortTitle: string;
  category: string;
  views: number;
  avgDwellSeconds: number;
  avgScrollDepthPercent: number;
  avgClickIntervalSec: number;
  cookStarts: number;
  popularityScore: number;
  sourceLabel: string;
}

interface InterestChartDatum {
  category: string;
  views: number;
  avgDwellSeconds: number;
  sharePercent: number;
  affinityIndex: number;
  color: string;
}

const INTEREST_PALETTE = ['#B54B1F', '#A97222', '#15803D', '#C99649', '#57534E', '#7C2D12'];

function formatAnalyticsDurationFa(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${toFaDigits(safe)} ثانیه`;
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return rem > 0
    ? `${toFaDigits(mins)} دقیقه و ${toFaDigits(rem)} ثانیه`
    : `${toFaDigits(mins)} دقیقه`;
}

function truncatePersianLabel(label: string, max = 18): string {
  const clean = label.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

interface AnalyticsTooltipProps {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    dataKey?: string;
    payload?: Record<string, unknown>;
  }[];
  label?: string;
}

function AdvancedRecipeTooltip({active, payload}: AnalyticsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as MergedRecipeAnalyticsRow | undefined;
  if (!row) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3.5 py-2.5 text-xs shadow-sm space-y-1.5 tabular-nums max-w-[250px]"
    >
      <p className="font-extrabold text-[#111110] dark:text-[#F5F5F3] leading-snug">{row.title}</p>
      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
        {row.category} · {row.sourceLabel}
      </p>
      <div className="pt-1 border-t border-[#EFEFED] dark:border-[#262623] space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">بازدید</span>
          <strong className="font-bold">{toFaDigits(row.views)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">میانگین ماندگاری</span>
          <strong className="font-bold text-[#A97222] dark:text-[#D8A85B]">
            {formatAnalyticsDurationFa(row.avgDwellSeconds)}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">نرخ اسکرول</span>
          <strong className="font-bold text-[#15803D] dark:text-[#4ADE80]">
            {toFaDigits(row.avgScrollDepthPercent)}٪
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">شروع آشپزی</span>
          <strong className="font-bold">{toFaDigits(row.cookStarts)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">شاخص محبوبیت</span>
          <strong className="font-bold text-[#B54B1F] dark:text-[#E29A6F]">
            {toFaDigits(row.popularityScore)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function AdvancedPeakHourTooltip({active, payload, label}: AnalyticsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | {label: string; visits: number; interactions: number; avgDwellSeconds: number}
    | undefined;
  if (!row) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3.5 py-2.5 text-xs shadow-sm space-y-1.5 tabular-nums"
    >
      <p className="font-extrabold text-[#111110] dark:text-[#F5F5F3]">ساعت {label || row.label}</p>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">بازدید نشست‌ها</span>
          <strong className="font-bold text-[#A97222] dark:text-[#D8A85B]">
            {toFaDigits(row.visits)}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">تعامل رفتاری</span>
          <strong className="font-bold text-[#B54B1F] dark:text-[#E29A6F]">
            {toFaDigits(row.interactions)}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">میانگین ماندگاری</span>
          <strong className="font-bold text-[#15803D] dark:text-[#4ADE80]">
            {formatAnalyticsDurationFa(row.avgDwellSeconds)}
          </strong>
        </div>
      </div>
    </div>
  );
}

function AdvancedInterestTooltip({active, payload}: AnalyticsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as InterestChartDatum | undefined;
  if (!row) return null;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3.5 py-2.5 text-xs shadow-sm space-y-1 tabular-nums"
    >
      <p className="font-extrabold text-[#111110] dark:text-[#F5F5F3]">{row.category}</p>
      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
        سهم علاقه: <strong className="text-[#B54B1F] dark:text-[#E29A6F]">{toFaDigits(row.sharePercent)}٪</strong>
      </p>
      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
        بازدید تجمیعی: <strong className="text-[#111110] dark:text-[#F5F5F3]">{toFaDigits(row.views)}</strong>
      </p>
      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
        میانگین ماندگاری: <strong className="text-[#15803D] dark:text-[#4ADE80]">{formatAnalyticsDurationFa(row.avgDwellSeconds)}</strong>
      </p>
    </div>
  );
}

function AdvancedScrollTooltip({active, payload}: AnalyticsTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as Record<string, unknown> | undefined;
  if (!row) return null;
  const label = String(row.label || row.sectionLabel || '');
  const primaryValue = Number(payload[0]?.value || 0);
  const isSection = Boolean(row.sectionLabel);
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3.5 py-2.5 text-xs shadow-sm space-y-1 tabular-nums"
    >
      <p className="font-extrabold text-[#111110] dark:text-[#F5F5F3]">{label}</p>
      {isSection ? (
        <>
          <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
            میانگین ماندگاری: <strong className="text-[#A97222] dark:text-[#D8A85B]">{formatAnalyticsDurationFa(primaryValue)}</strong>
          </p>
          <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
            نرخ عبور سریع: <strong className="text-[#B54B1F] dark:text-[#E29A6F]">{toFaDigits(Number(row.fastSkipPercent || 0))}٪</strong>
          </p>
        </>
      ) : (
        <>
          <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
            نرخ دستیابی نشست‌ها: <strong className="text-[#15803D] dark:text-[#4ADE80]">{toFaDigits(primaryValue)}٪</strong>
          </p>
          <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
            تعداد نشست: <strong className="text-[#111110] dark:text-[#F5F5F3]">{toFaDigits(Number(row.sessionsCount || 0))}</strong>
          </p>
        </>
      )}
    </div>
  );
}

function AdvancedBehavioralAnalyticsPanel({onNotify}: {onNotify: (msg: string) => void}) {
  const [chartsReport, setChartsReport] = useState<AdminBehavioralChartsReportPayload | null>(null);
  const [execReport, setExecReport] = useState<ExecutiveBehavioralReportPayload | null>(null);
  const [localAggregate, setLocalAggregate] = useState<AnonymizedBehaviorAggregateStore>(() =>
    getAnonymizedBehaviorAggregates()
  );
  const [passiveCategories, setPassiveCategories] = useState<string[]>(() =>
    loadPassiveAffinityCategories()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dataScope, setDataScope] = useState<AdvancedDataScope>('merged');
  const [recipeMetric, setRecipeMetric] = useState<AdvancedRecipeMetric>('views');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeWindow, setTimeWindow] = useState<AdvancedTimeWindow>('all');
  const [hourlyMetric, setHourlyMetric] = useState<AdvancedHourlyMetric>('traffic');
  const [interestView, setInterestView] = useState<AdvancedInterestChartView>('radar');
  const [scrollPanelView, setScrollPanelView] = useState<AdvancedScrollPanelView>('funnel');
  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState<AdvancedTableSortKey>('popularityScore');

  const fetchExecutiveTelemetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chartsData, executiveData] = await Promise.all([
        apiRequest<AdminBehavioralChartsReportPayload>('/api/admin/behavioral-reports/charts', {
          useAdmin: true,
        }),
        apiRequest<ExecutiveBehavioralReportPayload>('/api/admin/behavioral-intelligence', {
          useAdmin: true,
        }),
      ]);
      setChartsReport(chartsData);
      setExecReport(executiveData);
      setLocalAggregate(getAnonymizedBehaviorAggregates());
      setPassiveCategories(loadPassiveAffinityCategories());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'دریافت داده‌های پنل تحلیل رفتاری پیشرفته برای مدیر ارشد ناموفق بود.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExecutiveTelemetry();
    const unsubscribe = behaviorObserverSubject.subscribe((_ev, snapshot) => {
      setLocalAggregate(snapshot);
      setPassiveCategories(loadPassiveAffinityCategories());
    });
    return unsubscribe;
  }, [fetchExecutiveTelemetry]);

  const mergedRecipes = useMemo<MergedRecipeAnalyticsRow[]>(() => {
    const map = new Map<string, MergedRecipeAnalyticsRow>();

    if (dataScope !== 'local' && chartsReport) {
      for (const item of chartsReport.recipePopularity) {
        map.set(item.id, {
          id: item.id,
          title: item.title,
          shortTitle: truncatePersianLabel(item.title, 18),
          category: item.category || 'عمومی',
          views: item.views,
          avgDwellSeconds: item.avgDwellSeconds,
          avgScrollDepthPercent: item.avgScrollDepthPercent,
          avgClickIntervalSec: item.avgClickIntervalSec,
          cookStarts: item.cookStarts,
          popularityScore: item.popularityScore,
          sourceLabel: 'تجمیع سرور',
        });
      }
    }

    if (dataScope !== 'server') {
      const localList = Object.values(localAggregate.recipes);
      for (const bucket of localList) {
        const existing = map.get(bucket.recipeId);
        const localClickSec =
          bucket.avgClickIntervalMs > 0
            ? Number((bucket.avgClickIntervalMs / 1000).toFixed(1))
            : 5.2;
        if (existing) {
          const totalViews = existing.views + bucket.visitsCount;
          const weightedDwell = Math.round(
            (existing.avgDwellSeconds * existing.views +
              bucket.avgDwellSeconds * bucket.visitsCount) /
              Math.max(1, totalViews)
          );
          const weightedScroll = Math.round(
            (existing.avgScrollDepthPercent * existing.views +
              bucket.avgScrollDepthPercent * bucket.visitsCount) /
              Math.max(1, totalViews)
          );
          map.set(bucket.recipeId, {
            ...existing,
            views: totalViews,
            avgDwellSeconds: weightedDwell,
            avgScrollDepthPercent: weightedScroll,
            popularityScore: Math.round(
              totalViews * 14 +
                existing.cookStarts * 22 +
                weightedDwell * 0.12 +
                weightedScroll * 0.25
            ),
            sourceLabel: 'سرور + رصدگر زنده',
          });
        } else {
          map.set(bucket.recipeId, {
            id: bucket.recipeId,
            title: bucket.recipeTitle,
            shortTitle: truncatePersianLabel(bucket.recipeTitle, 18),
            category: bucket.category || 'عمومی',
            views: bucket.visitsCount,
            avgDwellSeconds: bucket.avgDwellSeconds,
            avgScrollDepthPercent: bucket.avgScrollDepthPercent,
            avgClickIntervalSec: localClickSec,
            cookStarts: 0,
            popularityScore: Math.round(
              bucket.visitsCount * 14 +
                bucket.avgDwellSeconds * 0.12 +
                bucket.avgScrollDepthPercent * 0.25
            ),
            sourceLabel: 'رصدگر محلی مرورگر',
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.popularityScore - a.popularityScore);
  }, [chartsReport, localAggregate, dataScope]);

  const categories = useMemo(
    () => Array.from(new Set(mergedRecipes.map((r) => r.category).filter(Boolean))),
    [mergedRecipes]
  );

  const filteredChartRecipes = useMemo(() => {
    const base =
      selectedCategory === 'all'
        ? mergedRecipes
        : mergedRecipes.filter((r) => r.category === selectedCategory);
    return [...base].sort((a, b) => b[recipeMetric] - a[recipeMetric]).slice(0, 10);
  }, [mergedRecipes, selectedCategory, recipeMetric]);

  const hourlyData = useMemo(() => {
    const base = Array.from({length: 24}, (_, hour) => {
      const serverRow = chartsReport?.peakHours.find((h) => h.hour === hour);
      const localHits = Number(localAggregate.hourlyVisitCounts[hour] || 0);
      const visits =
        dataScope === 'local'
          ? localHits
          : dataScope === 'server'
            ? serverRow?.visits || 0
            : (serverRow?.visits || 0) + localHits;
      return {
        hour,
        label: `${toFaDigits(String(hour).padStart(2, '0'))}:۰۰`,
        visits,
        interactions: dataScope === 'local' ? localHits : serverRow?.interactions || 0,
        avgDwellSeconds:
          dataScope === 'local'
            ? localHits > 0
              ? localAggregate.globalAvgDwellSeconds
              : 0
            : serverRow?.avgDwellSeconds || 0,
      };
    });

    if (timeWindow === 'morning_noon') {
      return base.filter((b) => b.hour >= 6 && b.hour <= 15);
    }
    if (timeWindow === 'evening_night') {
      return base.filter((b) => b.hour >= 15 && b.hour <= 23);
    }
    return base;
  }, [chartsReport, localAggregate, dataScope, timeWindow]);

  const peakHourPoint = useMemo(() => {
    let best = hourlyData[0] || {hour: 19, label: '۱۹:۰۰', visits: 0};
    for (const row of hourlyData) {
      if (row.visits > best.visits) best = row;
    }
    return best;
  }, [hourlyData]);

  const interestChartData = useMemo<InterestChartDatum[]>(() => {
    const catMap = new Map<string, {views: number; dwellWeighted: number; affinityBonus: number}>();

    if (dataScope !== 'local' && chartsReport) {
      for (const c of chartsReport.categoryPopularity) {
        catMap.set(c.category, {
          views: c.views,
          dwellWeighted: c.avgDwellSeconds * Math.max(1, c.views),
          affinityBonus: 0,
        });
      }
    }

    if (dataScope !== 'server') {
      for (const rec of Object.values(localAggregate.recipes)) {
        const key = rec.category || 'عمومی';
        const prev = catMap.get(key) || {views: 0, dwellWeighted: 0, affinityBonus: 0};
        prev.views += rec.visitsCount;
        prev.dwellWeighted += rec.avgDwellSeconds * Math.max(1, rec.visitsCount);
        prev.affinityBonus += 12;
        catMap.set(key, prev);
      }
      passiveCategories.forEach((cat, idx) => {
        const prev = catMap.get(cat) || {views: 1, dwellWeighted: 90, affinityBonus: 0};
        prev.affinityBonus += Math.max(6, 20 - idx * 4);
        catMap.set(cat, prev);
      });
    }

    const entries = Array.from(catMap.entries());
    const totalViews = Math.max(
      1,
      entries.reduce((sum, [, val]) => sum + val.views, 0)
    );

    return entries
      .map(([category, st], idx) => {
        const avgDwell = st.views > 0 ? Math.round(st.dwellWeighted / st.views) : 0;
        const sharePercent = Math.round((st.views / totalViews) * 100);
        const affinityIndex = Math.min(
          100,
          Math.round(sharePercent * 1.35 + Math.min(28, avgDwell / 8) + st.affinityBonus)
        );
        return {
          category,
          views: st.views,
          avgDwellSeconds: avgDwell,
          sharePercent,
          affinityIndex,
          color: INTEREST_PALETTE[idx % INTEREST_PALETTE.length],
        };
      })
      .sort((a, b) => b.views - a.views || b.affinityIndex - a.affinityIndex)
      .slice(0, 6);
  }, [chartsReport, localAggregate, passiveCategories, dataScope]);

  const filteredTableRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    const rows = q
      ? mergedRecipes.filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.sourceLabel.toLowerCase().includes(q)
        )
      : mergedRecipes;
    return [...rows].sort((a, b) => b[tableSort] - a[tableSort]);
  }, [mergedRecipes, tableSearch, tableSort]);

  const handleExportAdvancedJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      scope: dataScope,
      privacyNotice:
        'گزارش تجمیعی تحلیل رفتاری پیشرفته مدیر ارشد — بدون اطلاعات هویتی افراد (مبتنی بر behaviorTracker)',
      summary: chartsReport?.summary || null,
      recipeTrends: mergedRecipes,
      peakHours: hourlyData,
      interests: interestChartData,
      scrollFunnel: chartsReport?.scrollDepthDistribution || [],
      localObserverAggregates: localAggregate,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lagheli-executive-behavioral-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('فایل JSON تحلیل رفتاری پیشرفته با موفقیت دانلود شد.');
  };

  if (loading && !chartsReport) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({length: 5}).map((_, idx) => (
            <div
              key={idx}
              className="h-24 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse"
            />
          ))}
        </div>
        <div className="h-[340px] rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="h-[280px] rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse" />
          <div className="h-[280px] rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !chartsReport) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center space-y-3">
        <p className="text-sm font-bold text-[#B91C1C] dark:text-[#F87171]">
          {error || 'امکان بارگذاری داده‌های تحلیل رفتاری پیشرفته وجود ندارد.'}
        </p>
        <button
          type="button"
          onClick={fetchExecutiveTelemetry}
          className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold whitespace-nowrap"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  const deepScrollReach =
    chartsReport.scrollDepthDistribution.find((s) => s.depth === 75)?.reachPercent || 0;
  const topInterest = interestChartData[0];
  const localRecipeCount = Object.keys(localAggregate.recipes).length;
  const displayedAvgDwell =
    dataScope === 'local'
      ? localAggregate.globalAvgDwellSeconds
      : chartsReport.summary.avgRecipeDwellSeconds;
  const displayedAvgScroll =
    dataScope === 'local'
      ? localAggregate.globalAvgScrollDepthPercent
      : chartsReport.summary.avgScrollDepthPercent;

  const metricAxisLabel: Record<AdvancedRecipeMetric, string> = {
    views: 'تعداد بازدید',
    avgDwellSeconds: 'میانگین ماندگاری (ثانیه)',
    popularityScore: 'شاخص محبوبیت',
  };

  return (
    <div className="space-y-6">
      {/* Executive Header Bar */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#A97222] dark:text-[#D8A85B]">
            ویژه مدیران ارشد · رصدگر زنده behaviorTracker · آمار تجمیعی بدون هویت
          </div>
          <h2 className="text-lg font-extrabold text-balance">
            پنل تحلیل رفتاری پیشرفته: ماندگاری، نرخ اسکرول، علایق و ساعات اوج
          </h2>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            ترکیب هوشمند داده‌های تجمیعی سرور با رصدگر رفتاری مرورگر برای کشف روند محبوبیت دستورپخت‌ها، عمق مطالعه و زمان‌های پربازدید کاربران.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Data Source Scope Segmented Control */}
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
            {(
              [
                {id: 'merged' as AdvancedDataScope, label: 'تجمیع کل'},
                {id: 'server' as AdvancedDataScope, label: 'سرور'},
                {id: 'local' as AdvancedDataScope, label: 'رصدگر زنده'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDataScope(opt.id)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  dataScope === opt.id
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={fetchExecutiveTelemetry}
            disabled={loading}
            className="min-h-[40px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:border-[#A97222] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی</span>
          </button>

          <button
            type="button"
            onClick={handleExportAdvancedJson}
            className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی JSON</span>
          </button>
        </div>
      </section>

      {/* 5-Card Executive KPI Strip (Single-Elevation, Tabular Numerals, Zero Pills) */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
        {[
          {
            label: 'میانگین زمان ماندگاری',
            value: formatAnalyticsDurationFa(displayedAvgDwell),
            meta: execReport
              ? `طولانی‌ترین نشست: ${formatAnalyticsDurationFa(execReport.overview.longestSessionSeconds)}`
              : 'مکث واقعی روی دستورپخت',
          },
          {
            label: 'میانگین نرخ اسکرول',
            value: `${toFaDigits(displayedAvgScroll)}٪`,
            meta: `${toFaDigits(deepScrollReach)}٪ رسیدن به عمق ۷۵٪+`,
          },
          {
            label: 'پربازدیدترین ساعت شبانه‌روز',
            value: peakHourPoint.label,
            meta: `بازه اوج: ${chartsReport.summary.peakWindowLabel}`,
          },
          {
            label: 'پرطرفدارترین حوزه علاقه',
            value: topInterest ? topInterest.category : 'در حال گردآوری',
            meta: topInterest
              ? `${toFaDigits(topInterest.sharePercent)}٪ از کل توجه کاربران`
              : 'بر اساس علایق رفتاری کاربران',
          },
          {
            label: 'نشست‌ها و رصدهای ثبت‌شده',
            value: toFaDigits(
              chartsReport.summary.totalSessions + localAggregate.totalObservedSessions
            ),
            meta: `${toFaDigits(chartsReport.summary.totalRecipeViews)} بازدید سرور · ${toFaDigits(localRecipeCount)} رصد محلی`,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1"
          >
            <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{kpi.label}</p>
            <p className="text-lg font-extrabold truncate">{kpi.value}</p>
            <p className="text-[11px] text-[#7A7A74] dark:text-[#84847E] truncate">{kpi.meta}</p>
          </div>
        ))}
      </section>

      {/* CHART 1: RECIPE POPULARITY TRENDS (DUAL-AXIS COMPOSED CHART: METRIC BAR + SCROLL RATE LINE) */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <span>روند محبوبیت دستورپخت‌ها: همبستگی ماندگاری و نرخ اسکرول</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              ستون‌ها نشان‌دهنده {metricAxisLabel[recipeMetric]} و خط سبز نشان‌دهنده میانگین نرخ اسکرول (٪) هر دستورپخت است.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B] self-start xl:self-center">
            {(
              [
                {key: 'views' as AdvancedRecipeMetric, label: 'بازدید و اسکرول'},
                {key: 'avgDwellSeconds' as AdvancedRecipeMetric, label: 'ماندگاری و اسکرول'},
                {key: 'popularityScore' as AdvancedRecipeMetric, label: 'شاخص محبوبیت'},
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setRecipeMetric(opt.key)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  recipeMetric === opt.key
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B]'
                  : 'border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
              }`}
            >
              همه دسته‌ها ({toFaDigits(mergedRecipes.length)})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  selectedCategory === cat
                    ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B]'
                    : 'border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {filteredChartRecipes.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <p className="text-xs font-semibold text-[#5C5C58] dark:text-[#A3A39E]">
              در دامنه انتخاب‌شده هنوز رصدی برای دستورپخت ثبت نشده است.
            </p>
            {dataScope === 'local' && (
              <button
                type="button"
                onClick={() => setDataScope('merged')}
                className="min-h-[36px] px-3.5 rounded-lg border border-[#E6E6E3] dark:border-[#282825] text-xs font-bold"
              >
                نمایش تجمیع کل سرور و رصدگر زنده
              </button>
            )}
          </div>
        ) : (
          <div className="h-[340px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={filteredChartRecipes}
                margin={{top: 14, right: 16, left: 6, bottom: 36}}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
                <XAxis
                  dataKey="shortTitle"
                  tick={{fontSize: 11, fill: '#73736D'}}
                  interval={0}
                  angle={-16}
                  textAnchor="end"
                  height={60}
                  axisLine={{stroke: 'rgba(128,128,120,0.22)'}}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{fontSize: 11, fill: '#73736D'}}
                  tickFormatter={(v) => toFaDigits(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={{fontSize: 11, fill: '#15803D'}}
                  tickFormatter={(v) => `${toFaDigits(Number(v))}٪`}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  content={<AdvancedRecipeTooltip />}
                  cursor={{fill: 'rgba(169, 114, 34, 0.08)'}}
                />
                <Bar yAxisId="left" dataKey={recipeMetric} radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {filteredChartRecipes.map((entry, idx) => (
                    <Cell
                      key={entry.id}
                      fill={idx === 0 ? '#B54B1F' : idx === 1 ? '#A97222' : '#C99649'}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="avgScrollDepthPercent"
                  name="نرخ اسکرول (٪)"
                  stroke="#15803D"
                  strokeWidth={2.4}
                  dot={{r: 4, fill: '#15803D', strokeWidth: 0}}
                  activeDot={{r: 6, fill: '#15803D'}}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-5 text-xs text-[#5C5C58] dark:text-[#A3A39E] pt-2 border-t border-[#EFEFED] dark:border-[#242422]">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-2 rounded-xs bg-[#B54B1F]" />
            <span>رتبه اول ({metricAxisLabel[recipeMetric]})</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-2 rounded-xs bg-[#C99649]" />
            <span>سایر دستورهای پربازدید</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-0.5 bg-[#15803D]" />
            <span>نرخ میانگین اسکرول روی دستورپخت (محور سمت راست · درصد)</span>
          </span>
        </div>
      </section>

      {/* CHART 2: 24-HOUR PEAK VISIT TIMES & HOURLY DWELL CURVE */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>تحلیل زمان‌های پربازدید و الگوی ماندگاری در شبانه‌روز</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              نقطه اوج در بازه انتخابی: ساعت <strong>{peakHourPoint.label}</strong> · پنجره طلایی شبانه‌روز:{' '}
              <strong>{chartsReport.summary.peakWindowLabel}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
              {(
                [
                  {id: 'all' as AdvancedTimeWindow, label: '۲۴ ساعته'},
                  {id: 'morning_noon' as AdvancedTimeWindow, label: 'صبح و ظهر'},
                  {id: 'evening_night' as AdvancedTimeWindow, label: 'عصر و شب'},
                ] as const
              ).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setTimeWindow(w.id)}
                  className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    timeWindow === w.id
                      ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                      : 'text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
              <button
                type="button"
                onClick={() => setHourlyMetric('traffic')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  hourlyMetric === 'traffic'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                بازدید و تعامل
              </button>
              <button
                type="button"
                onClick={() => setHourlyMetric('dwell')}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  hourlyMetric === 'dwell'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                ماندگاری ساعتی
              </button>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyData} margin={{top: 16, right: 16, left: 4, bottom: 8}}>
              <defs>
                <linearGradient id="advSaffronArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A97222" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#A97222" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="advEmeraldArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#15803D" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#15803D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
              <XAxis
                dataKey="label"
                tick={{fontSize: 11, fill: '#73736D'}}
                interval={timeWindow === 'all' ? 1 : 0}
                axisLine={{stroke: 'rgba(128,128,120,0.22)'}}
                tickLine={false}
              />
              <YAxis
                tick={{fontSize: 11, fill: '#73736D'}}
                tickFormatter={(v) => toFaDigits(Number(v))}
                axisLine={false}
                tickLine={false}
                width={42}
              />
              <Tooltip content={<AdvancedPeakHourTooltip />} />
              {peakHourPoint.visits > 0 && (
                <ReferenceLine
                  x={peakHourPoint.label}
                  stroke="#B54B1F"
                  strokeDasharray="4 4"
                  label={{
                    value: 'اوج',
                    position: 'top',
                    fill: '#B54B1F',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                />
              )}
              {hourlyMetric === 'traffic' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="visits"
                    name="بازدید"
                    stroke="#A97222"
                    strokeWidth={2.4}
                    fill="url(#advSaffronArea)"
                    activeDot={{r: 5, fill: '#A97222'}}
                  />
                  <Line
                    type="monotone"
                    dataKey="interactions"
                    name="تعامل"
                    stroke="#B54B1F"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{r: 4, fill: '#B54B1F'}}
                  />
                </>
              ) : (
                <Area
                  type="monotone"
                  dataKey="avgDwellSeconds"
                  name="میانگین ماندگاری (ثانیه)"
                  stroke="#15803D"
                  strokeWidth={2.4}
                  fill="url(#advEmeraldArea)"
                  activeDot={{r: 5, fill: '#15803D'}}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-[#5C5C58] dark:text-[#A3A39E] pt-2 border-t border-[#EFEFED] dark:border-[#242422]">
          <div className="flex flex-wrap items-center gap-5">
            {hourlyMetric === 'traffic' ? (
              <>
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-1.5 rounded-xs bg-[#A97222]" />
                  <span>حجم بازدید ساعتی</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="w-3 h-0.5 bg-[#B54B1F]" />
                  <span>تعامل‌های رفتاری (مطالعه، اسکرول، پخت)</span>
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-xs bg-[#15803D]" />
                <span>میانگین ماندگاری کاربران در هر ساعت (ثانیه)</span>
              </span>
            )}
          </div>
          {execReport && (
            <span className="tabular-nums">
              روزهای کاری {toFaDigits(execReport.temporal.weekdayVsWeekend.weekdayPercent)}٪ · آخر هفته{' '}
              {toFaDigits(execReport.temporal.weekdayVsWeekend.weekendPercent)}٪
            </span>
          )}
        </div>
      </section>

      {/* CHARTS 3 & 4: USER INTERESTS (RADAR/DONUT) & SCROLL RATE / SECTION DWELL (2-COL BALANCED) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        {/* CHART 3: USER INTERESTS & PASSIVE AFFINITIES */}
        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
                <span>نقشه علایق و ذائقه کاربران (behaviorTracker)</span>
              </h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                استخراج علایق واقعی از بازدید خاموش دسته‌ها، ماندگاری و فیلترهای رژیمی
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
              <button
                type="button"
                onClick={() => setInterestView('radar')}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  interestView === 'radar'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                رادار علایق
              </button>
              <button
                type="button"
                onClick={() => setInterestView('donut')}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  interestView === 'donut'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                سهم درصدی
              </button>
            </div>
          </div>

          {interestChartData.length === 0 ? (
            <div className="h-[260px] flex items-center justify-center text-xs text-[#6B6B66] dark:text-[#989892]">
              هنوز داده کافی برای ترسیم نقشه علایق ثبت نشده است.
            </div>
          ) : (
            <div className="h-[260px] w-full flex-1" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                {interestView === 'radar' ? (
                  <RadarChart cx="50%" cy="50%" outerRadius="72%" data={interestChartData}>
                    <PolarGrid stroke="rgba(128,128,120,0.22)" />
                    <PolarAngleAxis dataKey="category" tick={{fontSize: 11, fill: '#73736D'}} />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{fontSize: 10, fill: '#8A8A84'}}
                      tickFormatter={(v) => toFaDigits(Number(v))}
                    />
                    <Tooltip content={<AdvancedInterestTooltip />} />
                    <Radar
                      name="شاخص علاقه"
                      dataKey="affinityIndex"
                      stroke="#B54B1F"
                      strokeWidth={2}
                      fill="#A97222"
                      fillOpacity={0.28}
                    />
                  </RadarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={interestChartData}
                      dataKey="views"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={92}
                      paddingAngle={3}
                    >
                      {interestChartData.map((entry) => (
                        <Cell key={entry.category} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<AdvancedInterestTooltip />} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}

          {/* Clean Unboxed Interest Breakdown & Passive Affinities */}
          <div className="pt-3 border-t border-[#EFEFED] dark:border-[#242422] space-y-2.5 text-xs tabular-nums">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
              {interestChartData.map((item) => (
                <div key={item.category} className="flex items-center justify-between gap-2 min-w-0">
                  <span className="inline-flex items-center gap-1.5 truncate text-[#5C5C58] dark:text-[#A3A39E]">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{backgroundColor: item.color}}
                    />
                    <span className="truncate">{item.category}</span>
                  </span>
                  <strong className="font-bold shrink-0">{toFaDigits(item.sharePercent)}٪</strong>
                </div>
              ))}
            </div>

            {execReport && execReport.passiveAffinities.topVenues.length > 0 && (
              <div className="pt-2 border-t border-[#EFEFED] dark:border-[#242422] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B6B66] dark:text-[#989892]">
                <span className="font-bold text-[#111110] dark:text-[#F5F5F3]">علاقه‌مندی‌های خاموش برتر:</span>
                {execReport.passiveAffinities.topVenues.slice(0, 3).map((v, idx) => (
                  <span key={v.id}>
                    {idx > 0 && '· '}
                    {v.label} ({toFaDigits(v.passiveViews)} مشاهده)
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* CHART 4: SCROLL RATE FUNNEL & SECTION DWELL DEPTH */}
        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
                <ScrollText className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>
                  {scrollPanelView === 'funnel'
                    ? 'قیف نرخ اسکرول و عمق مطالعه دستورپخت'
                    : 'زمان ماندگاری کاربران در بخش‌های اپلیکیشن'}
                </span>
              </h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                {scrollPanelView === 'funnel'
                  ? 'درصد نشست‌هایی که تا هر آستانه اسکرول (۲۵٪ تا ۱۰۰٪) پیشروی کرده‌اند'
                  : 'مقایسه میانگین مکث (ثانیه) و نرخ عبور سریع در نواحی مختلف رابط کاربری'}
              </p>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
              <button
                type="button"
                onClick={() => setScrollPanelView('funnel')}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  scrollPanelView === 'funnel'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                نرخ اسکرول
              </button>
              <button
                type="button"
                onClick={() => setScrollPanelView('sections')}
                className={`min-h-[32px] px-2.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                  scrollPanelView === 'sections'
                    ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                ماندگاری بخش‌ها
              </button>
            </div>
          </div>

          <div className="h-[260px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              {scrollPanelView === 'funnel' ? (
                <BarChart
                  data={chartsReport.scrollDepthDistribution}
                  margin={{top: 10, right: 12, left: 0, bottom: 8}}
                  barCategoryGap="28%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
                  <XAxis
                    dataKey="label"
                    tick={{fontSize: 11, fill: '#73736D'}}
                    axisLine={{stroke: 'rgba(128,128,120,0.22)'}}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{fontSize: 11, fill: '#73736D'}}
                    tickFormatter={(v) => `${toFaDigits(Number(v))}٪`}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    content={<AdvancedScrollTooltip />}
                    cursor={{fill: 'rgba(21, 128, 61, 0.08)'}}
                  />
                  <Bar dataKey="reachPercent" radius={[6, 6, 0, 0]} maxBarSize={52}>
                    {chartsReport.scrollDepthDistribution.map((entry) => (
                      <Cell
                        key={entry.depth}
                        fill={entry.depth >= 75 ? '#15803D' : entry.depth >= 50 ? '#A97222' : '#C99649'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <BarChart
                  data={(execReport?.attentionPhysics.sectionZones || []).slice(0, 6)}
                  margin={{top: 10, right: 12, left: 0, bottom: 26}}
                  barCategoryGap="26%"
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
                  <XAxis
                    dataKey="sectionLabel"
                    tick={{fontSize: 10, fill: '#73736D'}}
                    interval={0}
                    angle={-14}
                    textAnchor="end"
                    height={52}
                    axisLine={{stroke: 'rgba(128,128,120,0.22)'}}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{fontSize: 11, fill: '#73736D'}}
                    tickFormatter={(v) => `${toFaDigits(Number(v))}ث`}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  <Tooltip
                    content={<AdvancedScrollTooltip />}
                    cursor={{fill: 'rgba(169, 114, 34, 0.08)'}}
                  />
                  <Bar dataKey="avgDwellSeconds" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {(execReport?.attentionPhysics.sectionZones || []).slice(0, 6).map((z, idx) => (
                      <Cell
                        key={z.sectionKey}
                        fill={idx === 0 ? '#B54B1F' : z.fastSkipPercent <= 30 ? '#15803D' : '#A97222'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-[#EFEFED] dark:border-[#242422] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B6B66] dark:text-[#989892] tabular-nums">
            <span>
              میانگین فاصله کلیک: <strong className="text-[#111110] dark:text-[#F5F5F3]">{toFaDigits((chartsReport.summary.avgClickIntervalMs / 1000).toFixed(1))} ثانیه</strong>
            </span>
            {execReport && (
              <span>
                پربازده‌ترین بخش توجه:{' '}
                <strong className="text-[#15803D] dark:text-[#4ADE80]">
                  {execReport.attentionPhysics.sectionZones[0]?.sectionLabel || 'صفحه دستورپخت'}
                </strong>
              </span>
            )}
          </div>
        </section>
      </div>

      {/* HIGH-DENSITY SEARCHABLE & SORTABLE RECIPE BEHAVIORAL MATRIX */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
        <div className="p-5 border-b border-[#E6E6E3] dark:border-[#282825] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>ماتریس جامع شاخص‌های رفتاری دستورپخت‌ها</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              مقایسه دقیق بازدید، زمان ماندگاری، نرخ اسکرول و امتیاز محبوبیت در تمامی نشست‌های رصدشده
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#7A7A74] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="جستجوی دستور یا دسته..."
                className="min-h-[36px] w-48 sm:w-56 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] pr-8 pl-3 text-xs"
              />
            </div>

            <select
              value={tableSort}
              onChange={(e) => setTableSort(e.target.value as AdvancedTableSortKey)}
              className="min-h-[36px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] px-2.5 text-xs font-semibold"
            >
              <option value="popularityScore">مرتب‌سازی: امتیاز محبوبیت</option>
              <option value="avgDwellSeconds">مرتب‌سازی: زمان ماندگاری</option>
              <option value="avgScrollDepthPercent">مرتب‌سازی: نرخ اسکرول</option>
              <option value="views">مرتب‌سازی: تعداد بازدید</option>
            </select>
          </div>
        </div>

        {filteredTableRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B6B66] dark:text-[#989892]">
            موردی منطبق با جستجوی شما یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#F9F8F6] dark:bg-[#191917] text-[#6B6B66] dark:text-[#989892] border-b border-[#E6E6E3] dark:border-[#282825]">
                <tr>
                  <th className="py-3 px-4 font-semibold">دستورپخت و دسته</th>
                  <th className="py-3 px-4 font-semibold text-left">بازدید</th>
                  <th className="py-3 px-4 font-semibold text-left">میانگین ماندگاری</th>
                  <th className="py-3 px-4 font-semibold text-left">نرخ اسکرول</th>
                  <th className="py-3 px-4 font-semibold text-left">شروع پخت</th>
                  <th className="py-3 px-4 font-semibold text-left">شاخص محبوبیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E3] dark:divide-[#282825] tabular-nums">
                {filteredTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#FAF9F7] dark:hover:bg-[#181816]">
                    <td className="py-3 px-4">
                      <div className="font-bold text-[#111110] dark:text-[#F5F5F3]">{row.title}</div>
                      <div className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
                        {row.category} · {row.sourceLabel}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-left font-bold">{toFaDigits(row.views)}</td>
                    <td className="py-3 px-4 text-left font-semibold">
                      {formatAnalyticsDurationFa(row.avgDwellSeconds)}
                    </td>
                    <td className="py-3 px-4 text-left">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-[#EFEFED] dark:bg-[#262623] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, row.avgScrollDepthPercent)}%`,
                              backgroundColor:
                                row.avgScrollDepthPercent >= 75 ? '#15803D' : '#A97222',
                            }}
                          />
                        </div>
                        <span className="font-semibold">{toFaDigits(row.avgScrollDepthPercent)}٪</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-left font-semibold text-[#15803D] dark:text-[#4ADE80]">
                      {toFaDigits(row.cookStarts)}
                    </td>
                    <td className="py-3 px-4 text-left font-extrabold text-[#B54B1F] dark:text-[#E29A6F]">
                      {toFaDigits(row.popularityScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

