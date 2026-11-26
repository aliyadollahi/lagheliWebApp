import type {
  AclAccessLevel,
  AclActionCapability,
  AdminAclSectionId,
  AdminAclSectionPolicy,
  AdminPermission,
  CoreRbacRoleId,
  DynamicRoleDefinition,
  RoleSectionAccessDecision,
  SystemAdminRole,
  UserRole,
} from './types.ts';

export const SYSTEM_ADMIN_ROLES: SystemAdminRole[] = [
  'senior_admin',
  'editor',
  'finance_manager',
  'marketing_manager',
];

export const CORE_RBAC_ROLES: CoreRbacRoleId[] = ['editor', 'finance_manager', 'senior_admin'];

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
  'finance.reports',
  'finance.wallets',
  'finance.partners',
  'finance.campaigns',
  'users.view',
  'users.manage',
  'ecosystem.manage',
  'rbac.manage',
];

export const USER_ROLE_LABELS: Record<string, string> = {
  user: 'کاربر عادی',
  chef: 'سرآشپز',
  partner: 'برند همکار',
  editor: 'ادیتور',
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
    description:
      'دسترسی کامل به هر سه حوزه «محتوا»، «تبلیغات» و «گزارش‌گیری مالی» به همراه مدیریت ماتریس ACL و امنیت سوپرپنل.',
    badgeClass:
      'bg-[#B54B1F]/12 text-[#B54B1F] dark:bg-[#E29A6F]/15 dark:text-[#E29A6F] border border-[#B54B1F]/25 dark:border-[#E29A6F]/30',
    highlights: [
      'کنترل کامل بر محتوا، تبلیغات بومی، مزایده‌ها و گزارش‌گیری مالی',
      'مدیریت نقش‌های کاربری (RBAC) و ویرایش زنده ماتریس دسترسی ACL',
      'دسترسی انحصاری به اتاق هوش رفتاری و کنترل زنده چیدمان اپ کاربر',
    ],
  },
  editor: {
    label: 'ادیتور',
    shortLabel: 'ادیتور',
    description:
      'دسترسی تخصصی به بخش «محتوا» شامل دستورپخت‌ها، کنترل نسخه، عکس‌های کاربران، آشپزخانه هوشمند و پرسش‌وپاسخ (بدون دسترسی به تبلیغات و مالی).',
    badgeClass:
      'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25',
    highlights: [
      'ایجاد، ویرایش و تایید دستورپخت‌ها و عکس‌های ارسالی کاربران',
      'مدیریت جایگزین‌های آشپزخانه هوشمند، پرسش‌وپاسخ و نشان سرآشپزها',
      'عدم دسترسی به بخش تبلیغات، مزایده و گزارش‌گیری مالی',
    ],
  },
  finance_manager: {
    label: 'مدیر مالی',
    shortLabel: 'مدیر مالی',
    description:
      'دسترسی کامل به بخش «گزارش‌گیری مالی»، دفتر کل تراکنش‌ها و کیف پول تجاری برندها (بدون دسترسی به ویرایش محتوا یا انتشار تبلیغات).',
    badgeClass:
      'bg-amber-500/12 text-amber-800 dark:text-amber-300 border border-amber-500/25',
    highlights: [
      'گزارش‌گیری مالی، پایش درآمد مزایده‌ها و دفتر کل تراکنش‌ها',
      'مدیریت حساب تجاری برندهای همکار، بودجه کمپین‌ها و شارژ کیف پول',
      'عدم دسترسی به ویرایش دستورپخت‌ها، محتوای تحریریه یا مدیریت تبلیغات',
    ],
  },
  marketing_manager: {
    label: 'مدیر توسعه بازار و تبلیغات',
    shortLabel: 'توسعه بازار',
    description:
      'مسئول بخش «تبلیغات» شامل استودیو تبلیغات بومی، مزایده جایگاه‌ها، معرفی برندهای همکار و هارمونی نمایش تبلیغ.',
    badgeClass:
      'bg-sky-500/12 text-sky-800 dark:text-sky-300 border border-sky-500/25',
    highlights: [
      'طراحی و انتشار تبلیغات متنی درون‌مواد، کلیکی و بنر تحریریه‌ای',
      'مدیریت مزایده جایگاه‌ها، صفحه برندهای همکار و کمپین‌ها',
      'کنترل سقف نمایش تبلیغ در چیدمان اپ بدون دسترسی به دفتر کل مالی',
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
    'finance.reports',
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
  finance_manager: [
    'dashboard.view',
    'finance.reports',
    'finance.wallets',
    'finance.partners',
    'finance.campaigns',
    'users.view',
  ],
  marketing_manager: [
    'dashboard.view',
    'ads.manage',
    'app.layout',
    'finance.partners',
    'finance.campaigns',
    'ecosystem.manage',
  ],
};

// =============================================================================
// STRUCTURED 3-PILLAR ACL SECTION POLICIES (CONTENT / ADVERTISING / FINANCIAL)
// =============================================================================

export const ADMIN_ACL_SECTION_ORDER: AdminAclSectionId[] = [
  'content',
  'advertising',
  'financial_reporting',
];

export const ADMIN_ACL_SECTIONS: Record<AdminAclSectionId, AdminAclSectionPolicy> = {
  content: {
    sectionId: 'content',
    title: 'محتوا',
    subtitle: 'دستورپخت‌ها، کنترل نسخه تحریریه، عکس‌های کاربران، آشپزخانه هوشمند و پرسش‌وپاسخ',
    primaryPermissions: [
      'content.recipes',
      'content.photos',
      'content.kitchen',
      'content.qa',
      'content.chefs',
    ],
    readOnlyPermissions: [],
    guardedRoutes: [
      '/api/admin/recipes',
      '/api/admin/photos',
      '/api/admin/kitchen',
      '/api/admin/questions',
      '/api/admin/chefs',
    ],
  },
  advertising: {
    sectionId: 'advertising',
    title: 'تبلیغات',
    subtitle: 'استودیو تبلیغات بومی (متنی، کلیکی، بنری)، مزایده جایگاه‌ها، حامی ویژه و کمپین‌ها',
    primaryPermissions: ['ads.manage'],
    readOnlyPermissions: ['finance.campaigns', 'finance.partners'],
    guardedRoutes: [
      '/api/admin/native-ads',
      '/api/admin/ad-slots',
      '/api/admin/ad-bids',
      '/api/admin/flagship',
      '/api/admin/local-venues',
      '/api/admin/campaigns',
    ],
  },
  financial_reporting: {
    sectionId: 'financial_reporting',
    title: 'گزارش‌گیری مالی',
    subtitle: 'گزارش تجمیعی درآمد و بودجه، دفتر کل تراکنش‌ها و مدیریت کیف پول تجاری برندها',
    primaryPermissions: ['finance.reports', 'finance.wallets'],
    readOnlyPermissions: [],
    guardedRoutes: [
      '/api/admin/financial-reports/summary',
      '/api/admin/transactions',
      '/api/admin/partners/:id/wallet',
      '/api/admin/users/:id/wallet',
    ],
  },
};

export const CORE_RBAC_SECTION_POLICIES: Record<
  CoreRbacRoleId,
  Record<
    AdminAclSectionId,
    {
      accessLevel: AclAccessLevel;
      allowedActions: AclActionCapability[];
      summary: string;
    }
  >
> = {
  editor: {
    content: {
      accessLevel: 'full',
      allowedActions: ['view', 'create', 'edit', 'approve'],
      summary: 'دسترسی کامل به تولید، ویرایش و تایید دستورپخت‌ها، عکس‌ها و پرسش‌وپاسخ',
    },
    advertising: {
      accessLevel: 'none',
      allowedActions: [],
      summary: 'مسدود؛ ادیتور دسترسی به مدیریت تبلیغات و مزایده‌ها ندارد',
    },
    financial_reporting: {
      accessLevel: 'none',
      allowedActions: [],
      summary: 'مسدود؛ گزارش‌های مالی و دفتر کل خارج از حوزه ادیتور است',
    },
  },
  finance_manager: {
    content: {
      accessLevel: 'none',
      allowedActions: [],
      summary: 'مسدود؛ مدیر مالی مجوز تغییر در دستورپخت‌ها و تحریریه ندارد',
    },
    advertising: {
      accessLevel: 'read_only',
      allowedActions: ['view'],
      summary: 'مشاهده بودجه کمپین‌ها و حساب برندها بدون مجوز انتشار یا تغییر تبلیغات',
    },
    financial_reporting: {
      accessLevel: 'full',
      allowedActions: ['view', 'create', 'edit', 'approve', 'export'],
      summary: 'دسترسی کامل به گزارش‌گیری مالی، تراکنش‌ها و تعدیل کیف پول تجاری',
    },
  },
  senior_admin: {
    content: {
      accessLevel: 'full',
      allowedActions: ['view', 'create', 'edit', 'approve', 'delete'],
      summary: 'دسترسی کامل به تمام بخش‌های محتوا، کنترل نسخه و تایید نهایی',
    },
    advertising: {
      accessLevel: 'full',
      allowedActions: ['view', 'create', 'edit', 'approve', 'delete'],
      summary: 'دسترسی کامل به استودیو تبلیغات بومی، مزایده‌ها و اسپانسرشیپ',
    },
    financial_reporting: {
      accessLevel: 'full',
      allowedActions: ['view', 'create', 'edit', 'approve', 'export', 'delete'],
      summary: 'دسترسی کامل به گزارش‌گیری مالی، دفتر کل، ممیزی و مدیریت ACL',
    },
  },
};

export const ACL_ACCESS_LEVEL_LABELS: Record<AclAccessLevel, string> = {
  full: 'دسترسی کامل',
  read_only: 'مشاهده و پایش محدود',
  none: 'مسدود',
};

export const ACL_ACTION_LABELS: Record<AclActionCapability, string> = {
  view: 'مشاهده',
  create: 'ایجاد',
  edit: 'ویرایش',
  approve: 'تایید',
  export: 'خروجی گزارش',
  delete: 'حذف',
};

export const DEFAULT_DYNAMIC_ROLES: DynamicRoleDefinition[] = SYSTEM_ADMIN_ROLES.map((id) => ({
  id,
  label: ADMIN_ROLE_META[id].label,
  shortLabel: ADMIN_ROLE_META[id].shortLabel,
  description: ADMIN_ROLE_META[id].description,
  permissions: [...ROLE_PERMISSIONS[id]],
  isSystem: true,
}));

export type PermissionMatrixGroup =
  | 'محتوا'
  | 'تبلیغات'
  | 'گزارش‌گیری مالی'
  | 'پیکربندی و امنیت ACL';

export const PERMISSION_MATRIX_ROWS: {
  id: AdminPermission;
  label: string;
  group: PermissionMatrixGroup;
  sectionId?: AdminAclSectionId;
}[] = [
  {
    id: 'content.recipes',
    label: 'دستورپخت‌ها، کنترل نسخه و پیشنهاددهنده هوشمند',
    group: 'محتوا',
    sectionId: 'content',
  },
  {
    id: 'content.photos',
    label: 'تایید عکس‌های کاربران و انتخاب تصویر جلد',
    group: 'محتوا',
    sectionId: 'content',
  },
  {
    id: 'content.kitchen',
    label: 'تنظیمات یخچال هوشمند و جایگزین‌های مواد',
    group: 'محتوا',
    sectionId: 'content',
  },
  {
    id: 'content.qa',
    label: 'نظارت بر پرسش‌وپاسخ کاربران',
    group: 'محتوا',
    sectionId: 'content',
  },
  {
    id: 'content.chefs',
    label: 'تایید نشان سرآشپزها',
    group: 'محتوا',
    sectionId: 'content',
  },
  {
    id: 'ads.manage',
    label: 'استودیو تبلیغات بومی، مزایده جایگاه‌ها و حامی ویژه',
    group: 'تبلیغات',
    sectionId: 'advertising',
  },
  {
    id: 'finance.partners',
    label: 'مدیریت برندهای همکار و اصناف تبلیغاتی',
    group: 'تبلیغات',
    sectionId: 'advertising',
  },
  {
    id: 'finance.campaigns',
    label: 'مدیریت کمپین‌ها و پایش بودجه تبلیغاتی',
    group: 'تبلیغات',
    sectionId: 'advertising',
  },
  {
    id: 'finance.reports',
    label: 'گزارش‌گیری مالی، درآمد مزایده‌ها و خروجی مالی',
    group: 'گزارش‌گیری مالی',
    sectionId: 'financial_reporting',
  },
  {
    id: 'finance.wallets',
    label: 'دفتر کل تراکنش‌ها و شارژ حساب تجاری و کیف پول',
    group: 'گزارش‌گیری مالی',
    sectionId: 'financial_reporting',
  },
  {
    id: 'app.layout',
    label: 'کنترل داینامیک بخش‌ها، تیترها و هارمونی اپ کاربر',
    group: 'پیکربندی و امنیت ACL',
  },
  {
    id: 'ecosystem.manage',
    label: 'تنظیمات کلان اکوسیستم و دسته‌بندی‌ها',
    group: 'پیکربندی و امنیت ACL',
  },
  {
    id: 'users.view',
    label: 'مشاهده فهرست کاربران و سرآشپزها',
    group: 'پیکربندی و امنیت ACL',
  },
  {
    id: 'users.manage',
    label: 'مسدودسازی و مدیریت حساب کاربران',
    group: 'پیکربندی و امنیت ACL',
  },
  {
    id: 'rbac.manage',
    label: 'ماتریس کنترل دسترسی پویا (ACL) و تعریف نقش',
    group: 'پیکربندی و امنیت ACL',
  },
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
        return Array.from(
          new Set<AdminPermission>([...found.permissions, 'dashboard.view', 'rbac.manage', 'finance.reports'])
        );
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

export function evaluateRoleSectionAccess(
  role: string | null | undefined,
  sectionId: AdminAclSectionId,
  dynamicRoles?: DynamicRoleDefinition[],
  explicitPermissions?: AdminPermission[]
): RoleSectionAccessDecision {
  const policy = ADMIN_ACL_SECTIONS[sectionId];
  const effectivePerms =
    explicitPermissions && explicitPermissions.length > 0
      ? explicitPermissions
      : getRolePermissions(role, dynamicRoles);

  const allChecked = Array.from(
    new Set<AdminPermission>([...policy.primaryPermissions, ...policy.readOnlyPermissions])
  );
  const grantedPrimary = policy.primaryPermissions.filter((p) => effectivePerms.includes(p));
  const grantedReadOnly = policy.readOnlyPermissions.filter((p) => effectivePerms.includes(p));
  const grantedAll = allChecked.filter((p) => effectivePerms.includes(p));

  let accessLevel: AclAccessLevel = 'none';
  if (grantedPrimary.length > 0) {
    accessLevel = 'full';
  } else if (grantedReadOnly.length > 0) {
    accessLevel = 'read_only';
  }

  const normalized = role === 'admin' ? 'senior_admin' : role;
  const preset =
    normalized && (normalized === 'editor' || normalized === 'finance_manager' || normalized === 'senior_admin')
      ? CORE_RBAC_SECTION_POLICIES[normalized][sectionId]
      : null;

  let allowedActions: AclActionCapability[] = [];
  if (accessLevel === 'full') {
    allowedActions =
      preset && preset.accessLevel === 'full'
        ? preset.allowedActions
        : sectionId === 'financial_reporting'
          ? ['view', 'create', 'edit', 'export']
          : ['view', 'create', 'edit', 'approve'];
  } else if (accessLevel === 'read_only') {
    allowedActions = ['view'];
  }

  let summary: string;
  if (preset && preset.accessLevel === accessLevel) {
    summary = preset.summary;
  } else if (accessLevel === 'full') {
    summary = `دسترسی عملیاتی فعال بر بخش «${policy.title}» (${grantedAll.length} از ${allChecked.length} مجوز).`;
  } else if (accessLevel === 'read_only') {
    summary = `دسترسی مشاهده محدود روی داده‌های مرتبط با «${policy.title}» بدون مجوز انتشار.`;
  } else {
    summary = `مسدود؛ این نقش مجوز ورود به بخش «${policy.title}» را ندارد.`;
  }

  return {
    sectionId,
    sectionTitle: policy.title,
    accessLevel,
    accessLabel: ACL_ACCESS_LEVEL_LABELS[accessLevel],
    allowedActions,
    grantedPermissions: grantedAll,
    totalSectionPermissions: allChecked.length,
    summary,
  };
}

export function getRoleAclMatrixSummary(
  role: string | null | undefined,
  dynamicRoles?: DynamicRoleDefinition[],
  explicitPermissions?: AdminPermission[]
): RoleSectionAccessDecision[] {
  return ADMIN_ACL_SECTION_ORDER.map((sectionId) =>
    evaluateRoleSectionAccess(role, sectionId, dynamicRoles, explicitPermissions)
  );
}

export function canAccessAdminSection(
  role: string | null | undefined,
  sectionId: AdminAclSectionId,
  dynamicRoles?: DynamicRoleDefinition[],
  explicitPermissions?: AdminPermission[]
): boolean {
  const decision = evaluateRoleSectionAccess(role, sectionId, dynamicRoles, explicitPermissions);
  return decision.accessLevel !== 'none';
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
