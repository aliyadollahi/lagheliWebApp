import type {AdminPermission, DynamicRoleDefinition, SystemAdminRole, UserRole} from './types.ts';

export const SYSTEM_ADMIN_ROLES: SystemAdminRole[] = [
  'senior_admin',
  'editor',
  'marketing_manager',
  'finance_manager',
];

// Backward-compatible alias
export const ADMIN_ROLES = SYSTEM_ADMIN_ROLES;

export const ALL_ADMIN_PERMISSIONS: AdminPermission[] = [
  'dashboard.view',
  'content.recipes',
  'content.photos',
  'content.qa',
  'content.kitchen',
  'content.chefs',
  'ads.manage',
  'app.layout',
  'finance.partners',
  'finance.campaigns',
  'finance.wallets',
  'users.view',
  'users.manage',
  'ecosystem.manage',
  'rbac.manage',
];

export const USER_ROLE_LABELS: Record<string, string> = {
  user: 'کاربر عادی',
  chef: 'سرآشپز',
  partner: 'برند همکار',
  editor: 'ادیتور تحریریه',
  marketing_manager: 'مدیر توسعه بازار و تبلیغات',
  finance_manager: 'مدیر مالی',
  senior_admin: 'مدیر ارشد',
  admin: 'مدیر ارشد',
};

export const ADMIN_ROLE_META: Record<
  SystemAdminRole,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
    highlights: string[];
  }
> = {
  senior_admin: {
    label: 'مدیر ارشد',
    shortLabel: 'مدیر ارشد',
    description: 'دسترسی کامل به تمام بخش‌های سوپرپنل، کنترل زنده چیدمان اپ، تبلیغات بومی و ماتریس دسترسی پویا.',
    badgeClass:
      'bg-[#B54B1F]/12 text-[#B54B1F] dark:bg-[#E29A6F]/15 dark:text-[#E29A6F] border border-[#B54B1F]/25 dark:border-[#E29A6F]/30',
    highlights: [
      'ساخت نقش‌های جدید و ویرایش ماتریس مجوزهای هر بخش',
      'کنترل زنده بخش‌ها، تیترها و هارمونی تبلیغات در اپ کاربر',
      'نظارت کامل بر تحریریه، برندهای همکار، مالی و ممیزی امنیت',
    ],
  },
  editor: {
    label: 'ادیتور تحریریه',
    shortLabel: 'ادیتور',
    description: 'مسئول تولید و کنترل نسخه دستورپخت‌ها، تایید عکس‌های کاربران، آشپزخانه هوشمند و پرسش‌وپاسخ.',
    badgeClass:
      'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
    highlights: [
      'ویرایش، پیش‌نمایش و تایید نسخه‌های پیش‌نویس دستورپخت‌ها',
      'پایش پیشنهاددهنده هوشمند تحریریه و تکمیل خلأهای محتوایی',
      'مدیریت عکس‌های ارسالی، جایگزین‌های آشپزخانه و پرسش‌وپاسخ',
    ],
  },
  marketing_manager: {
    label: 'مدیر توسعه بازار و تبلیغات',
    shortLabel: 'توسعه بازار',
    description: 'مسئول معماری تبلیغات بومی، معرفی برندهای همکار، نرخ تعامل و هارمونی نمایش در اپلیکیشن کاربر.',
    badgeClass:
      'bg-sky-500/12 text-sky-800 dark:text-sky-300 border border-sky-500/25',
    highlights: [
      'طراحی و انتشار تبلیغات متنی درون‌مواد، کلیکی و داستان برند',
      'مدیریت صفحه برندهای همکار و تحلیل نمایش و کلیک واقعی',
      'کنترل سقف نمایش و هارمونی تبلیغات در چیدمان اپلیکیشن',
    ],
  },
  finance_manager: {
    label: 'مدیر مالی',
    shortLabel: 'مدیر مالی',
    description: 'مسئول کیف پول تجاری برندهای همکار، بودجه کمپین‌ها، تراکنش‌ها و دفتر کل مالی لاقلی.',
    badgeClass:
      'bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/25',
    highlights: [
      'شارژ و تعدیل حساب تجاری برندهای همکار و کیف جِم کاربران',
      'پایش بودجه کمپین‌های تبلیغاتی و دفتر کل تراکنش‌ها',
      'مشاهده گزارش‌های مالی بدون دسترسی به ویرایش تحریریه یا امنیت',
    ],
  },
};

export const ROLE_PERMISSIONS: Record<SystemAdminRole, AdminPermission[]> = {
  senior_admin: [
    'dashboard.view',
    'content.recipes',
    'content.photos',
    'content.qa',
    'content.kitchen',
    'content.chefs',
    'ads.manage',
    'app.layout',
    'finance.wallets',
    'finance.partners',
    'finance.campaigns',
    'users.view',
    'users.manage',
    'rbac.manage',
    'ecosystem.manage',
  ],
  editor: [
    'dashboard.view',
    'content.recipes',
    'content.photos',
    'content.qa',
    'content.kitchen',
    'content.chefs',
  ],
  marketing_manager: [
    'dashboard.view',
    'ads.manage',
    'app.layout',
    'finance.partners',
    'finance.campaigns',
    'ecosystem.manage',
  ],
  finance_manager: [
    'dashboard.view',
    'finance.wallets',
    'finance.partners',
    'finance.campaigns',
    'users.view',
  ],
};

export const DEFAULT_DYNAMIC_ROLES: DynamicRoleDefinition[] = SYSTEM_ADMIN_ROLES.map((id) => ({
  id,
  label: ADMIN_ROLE_META[id].label,
  shortLabel: ADMIN_ROLE_META[id].shortLabel,
  description: ADMIN_ROLE_META[id].description,
  permissions: [...ROLE_PERMISSIONS[id]],
  isSystem: true,
}));

export const PERMISSION_MATRIX_ROWS: {
  id: AdminPermission;
  label: string;
  group: 'تحریریه و محتوا' | 'تبلیغات بومی و برندینگ' | 'پیکربندی زنده و امنیت';
}[] = [
  {id: 'content.recipes', label: 'دستورپخت‌ها، کنترل نسخه و پیشنهاددهنده هوشمند', group: 'تحریریه و محتوا'},
  {id: 'content.photos', label: 'تایید عکس‌های کاربران و انتخاب جلد', group: 'تحریریه و محتوا'},
  {id: 'content.kitchen', label: 'تنظیمات یخچال هوشمند و جایگزین‌ها', group: 'تحریریه و محتوا'},
  {id: 'content.qa', label: 'نظارت بر پرسش‌وپاسخ کاربران', group: 'تحریریه و محتوا'},
  {id: 'content.chefs', label: 'تایید نشان سرآشپزها', group: 'تحریریه و محتوا'},
  {id: 'ads.manage', label: 'استودیو تبلیغات بومی (متنی، کلیکی، بنری، زمینه‌ای)', group: 'تبلیغات بومی و برندینگ'},
  {id: 'finance.partners', label: 'مدیریت برندهای همکار و اصناف', group: 'تبلیغات بومی و برندینگ'},
  {id: 'finance.campaigns', label: 'مدیریت کمپین‌ها و گزارش تعامل برندها', group: 'تبلیغات بومی و برندینگ'},
  {id: 'finance.wallets', label: 'حساب تجاری همکاران و دفتر کل مالی', group: 'تبلیغات بومی و برندینگ'},
  {id: 'app.layout', label: 'کنترل داینامیک بخش‌ها، تیترها و هارمونی اپ کاربر', group: 'پیکربندی زنده و امنیت'},
  {id: 'ecosystem.manage', label: 'تنظیمات کلان اکوسیستم و دسته‌بندی‌ها', group: 'پیکربندی زنده و امنیت'},
  {id: 'users.view', label: 'مشاهده فهرست کاربران و سرآشپزها', group: 'پیکربندی زنده و امنیت'},
  {id: 'users.manage', label: 'مسدودسازی و مدیریت حساب کاربران', group: 'پیکربندی زنده و امنیت'},
  {id: 'rbac.manage', label: 'ماتریس کنترل دسترسی پویا (ACL) و تعریف نقش', group: 'پیکربندی زنده و امنیت'},
];

export function isSystemAdminRole(role: string | null | undefined): role is SystemAdminRole {
  return Boolean(role && SYSTEM_ADMIN_ROLES.includes(role as SystemAdminRole));
}

export function normalizeAdminRole(
  role: string | null | undefined,
  dynamicRoles?: DynamicRoleDefinition[]
): string | null {
  if (!role) return null;
  if (role === 'admin' || role === 'senior_admin') return 'senior_admin';
  if (isSystemAdminRole(role)) return role;
  if (dynamicRoles && dynamicRoles.some((r) => r.id === role)) return role;
  return null;
}

export function isAdminRole(role: string | null | undefined, dynamicRoles?: DynamicRoleDefinition[]): boolean {
  return normalizeAdminRole(role, dynamicRoles) !== null;
}

export function getRolePermissions(
  role: string | null | undefined,
  dynamicRoles?: DynamicRoleDefinition[]
): AdminPermission[] {
  if (!role) return [];
  const normalized = role === 'admin' ? 'senior_admin' : role;
  if (dynamicRoles && dynamicRoles.length > 0) {
    const found = dynamicRoles.find((r) => r.id === normalized);
    if (found) {
      if (normalized === 'senior_admin') {
        return Array.from(new Set<AdminPermission>([...found.permissions, 'dashboard.view', 'rbac.manage']));
      }
      return found.permissions;
    }
  }
  if (isSystemAdminRole(normalized)) {
    return ROLE_PERMISSIONS[normalized];
  }
  return [];
}

export function hasAdminPermission(
  role: string | null | undefined,
  permission: AdminPermission,
  dynamicRoles?: DynamicRoleDefinition[],
  explicitPermissions?: AdminPermission[]
): boolean {
  if (explicitPermissions && explicitPermissions.length > 0) {
    return explicitPermissions.includes(permission);
  }
  return getRolePermissions(role, dynamicRoles).includes(permission);
}

export function getRoleLabel(role: UserRole | string, dynamicRoles?: DynamicRoleDefinition[]): string {
  const normalized = role === 'admin' ? 'senior_admin' : role;
  const custom = dynamicRoles?.find((r) => r.id === normalized);
  if (custom) return custom.label;
  return USER_ROLE_LABELS[normalized] || 'کاربر عادی';
}

export function getRoleBadgeClass(role: string): string {
  const normalized = role === 'admin' ? 'senior_admin' : role;
  if (isSystemAdminRole(normalized)) {
    return ADMIN_ROLE_META[normalized].badgeClass;
  }
  return 'bg-violet-500/12 text-violet-800 dark:text-violet-300 border border-violet-500/25';
}
