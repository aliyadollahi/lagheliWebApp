import {useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  History,
  KeyRound,
  Lock,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import {
  DEFAULT_DYNAMIC_ROLES,
  PERMISSION_MATRIX_ROWS,
  getRoleBadgeClass,
  getRoleLabel,
  normalizeAdminRole,
} from '../shared/rbac.ts';
import type {
  AdminPermission,
  AdminUserRow,
  DynamicRoleDefinition,
  RbacAuditLog,
} from '../shared/types.ts';

interface AdminRbacPanelProps {
  users: AdminUserRow[];
  aclRoles: DynamicRoleDefinition[];
  auditLogs: RbacAuditLog[];
  onRefresh: () => void;
  onNotify: (msg: string) => void;
}

const PUBLIC_ROLES: {value: string; label: string}[] = [
  {value: 'chef', label: 'سرآشپز'},
  {value: 'partner', label: 'برند همکار'},
  {value: 'user', label: 'کاربر عادی (لغو دسترسی مدیریت)'},
];

const SENIOR_LOCKED_PERMS: AdminPermission[] = ['dashboard.view', 'rbac.manage', 'app.layout', 'ecosystem.manage'];

function formatAuditTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return toFaDigits(iso.slice(0, 16).replace('T', ' '));
  }
}

export function AdminRbacPanel({
  users,
  aclRoles,
  auditLogs,
  onRefresh,
  onNotify,
}: AdminRbacPanelProps) {
  const effectiveRoles = aclRoles.length > 0 ? aclRoles : DEFAULT_DYNAMIC_ROLES;

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('editor');
  const [assignNote, setAssignNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [staffFilter, setStaffFilter] = useState<string>('all_staff');
  const [searchQuery, setSearchQuery] = useState('');

  // Dynamic ACL Matrix editable draft state: roleId -> Set<AdminPermission>
  const [draftMatrix, setDraftMatrix] = useState<Record<string, AdminPermission[]>>({});
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  // Create custom role state
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleShort, setNewRoleShort] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePerms, setNewRolePerms] = useState<AdminPermission[]>(['dashboard.view', 'content.recipes']);
  const [creatingRole, setCreatingRole] = useState(false);

  useEffect(() => {
    const initial: Record<string, AdminPermission[]> = {};
    for (const r of effectiveRoles) {
      initial[r.id] = [...r.permissions];
    }
    setDraftMatrix(initial);
  }, [effectiveRoles]);

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of effectiveRoles) counts[r.id] = 0;
    for (const u of users) {
      const normalized = normalizeAdminRole(u.role, effectiveRoles);
      if (normalized && counts[normalized] !== undefined) {
        counts[normalized] += 1;
      }
    }
    return counts;
  }, [users, effectiveRoles]);

  const filteredDirectory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      const norm = normalizeAdminRole(u.role, effectiveRoles);
      if (staffFilter === 'all_staff' && !norm) return false;
      if (staffFilter !== 'all_staff' && staffFilter !== 'all_users' && norm !== staffFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        getRoleLabel(u.role, effectiveRoles).toLowerCase().includes(q)
      );
    });
  }, [users, staffFilter, searchQuery, effectiveRoles]);

  const dirtyRoleIds = useMemo(() => {
    const dirty: string[] = [];
    for (const r of effectiveRoles) {
      const orig = [...r.permissions].sort().join(',');
      const draft = [...(draftMatrix[r.id] || r.permissions)].sort().join(',');
      if (orig !== draft) dirty.push(r.id);
    }
    return dirty;
  }, [effectiveRoles, draftMatrix]);

  const toggleMatrixPermission = (roleId: string, perm: AdminPermission) => {
    if (roleId === 'senior_admin' && SENIOR_LOCKED_PERMS.includes(perm)) {
      onNotify('مجوزهای کلیدی مدیر ارشد برای حفظ امنیت پنل قابل غیرفعال‌سازی نیست.');
      return;
    }
    setDraftMatrix((prev) => {
      const current = prev[roleId] || [];
      const exists = current.includes(perm);
      const next = exists ? current.filter((p) => p !== perm) : [...current, perm];
      return {...prev, [roleId]: Array.from(new Set<AdminPermission>(['dashboard.view', ...next]))};
    });
  };

  const handleSaveRolePermissions = async (role: DynamicRoleDefinition) => {
    const nextPerms = draftMatrix[role.id] || role.permissions;
    setSavingRoleId(role.id);
    try {
      await apiRequest(`/api/admin/acl/roles/${role.id}`, {
        method: 'PUT',
        useAdmin: true,
        body: JSON.stringify({
          label: role.label,
          shortLabel: role.shortLabel,
          description: role.description,
          permissions: nextPerms,
        }),
      });
      onNotify(`مجوزهای نقش «${role.label}» به‌صورت زنده ذخیره و اعمال شد.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره مجوزهای نقش');
    } finally {
      setSavingRoleId(null);
    }
  };

  const handleCreateCustomRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleLabel.trim()) return;
    setCreatingRole(true);
    try {
      await apiRequest('/api/admin/acl/roles', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({
          label: newRoleLabel.trim(),
          shortLabel: newRoleShort.trim() || newRoleLabel.trim(),
          description: newRoleDesc.trim(),
          permissions: Array.from(new Set<AdminPermission>(['dashboard.view', ...newRolePerms])),
        }),
      });
      onNotify(`نقش سفارشی «${newRoleLabel.trim()}» با موفقیت ساخته شد.`);
      setNewRoleLabel('');
      setNewRoleShort('');
      setNewRoleDesc('');
      setNewRolePerms(['dashboard.view', 'content.recipes']);
      setShowCreateRole(false);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ساخت نقش جدید');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteCustomRole = async (role: DynamicRoleDefinition) => {
    if (role.isSystem) return;
    try {
      await apiRequest(`/api/admin/acl/roles/${role.id}`, {
        method: 'DELETE',
        useAdmin: true,
      });
      onNotify(`نقش سفارشی «${role.label}» حذف شد.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف نقش');
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      onNotify('لطفاً ابتدا کاربر مورد نظر را انتخاب کنید.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/admin/rbac/assign', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({
          userId: selectedUserId,
          role: selectedRole,
          note: assignNote.trim(),
        }),
      });
      const targetUser = users.find((u) => u.id === selectedUserId);
      onNotify(
        `نقش «${getRoleLabel(selectedRole, effectiveRoles)}» با موفقیت برای ${targetUser?.name || 'کاربر'} ثبت شد.`
      );
      setAssignNote('');
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت سطح دسترسی');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRoleChange = async (user: AdminUserRow, nextRole: string) => {
    try {
      await apiRequest('/api/admin/rbac/assign', {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({
          userId: user.id,
          role: nextRole,
          note: 'بروزرسانی سریع نقش از جدول تیم مدیریت',
        }),
      });
      onNotify(`سطح دسترسی ${user.name} به «${getRoleLabel(nextRole, effectiveRoles)}» تغییر یافت.`);
      onRefresh();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تغییر نقش کاربر');
    }
  };

  const selectedUserObj = users.find((u) => u.id === selectedUserId) || null;

  return (
    <div className="space-y-6">
      {/* 1. Dynamic Roles Summary & Create Role Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">نقش‌های فعال ماتریس دسترسی پویا ({toFaDigits(effectiveRoles.length)})</h2>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            علاوه بر نقش‌های پایه، می‌توانید نقش‌های سفارشی بسازید و مجوز هر بخش را زنده روشن یا خاموش کنید.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateRole((v) => !v)}
          className="min-h-[42px] px-4 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>ساخت نقش سفارشی جدید</span>
        </button>
      </div>

      {/* Create Custom Role Form */}
      {showCreateRole && (
        <form
          onSubmit={handleCreateCustomRole}
          className="rounded-2xl border border-[#B54B1F]/35 dark:border-[#E29A6F]/35 bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
        >
          <h3 className="text-sm font-bold">تعریف نقش سفارشی جدید در ماتریس دسترسی</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <input
              type="text"
              required
              maxLength={60}
              value={newRoleLabel}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              placeholder="عنوان نقش (مثلاً: ناظر عکس‌ها و کیفیت)"
              className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
            <input
              type="text"
              maxLength={28}
              value={newRoleShort}
              onChange={(e) => setNewRoleShort(e.target.value)}
              placeholder="عنوان کوتاه (مثلاً: ناظر عکس)"
              className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
            <input
              type="text"
              maxLength={160}
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
              placeholder="شرح کوتاه مسئولیت این نقش..."
              className="min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">مجوزهای این نقش:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {PERMISSION_MATRIX_ROWS.map((row) => {
                const checked = newRolePerms.includes(row.id);
                return (
                  <label
                    key={row.id}
                    className="flex items-center gap-2 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5]/60 dark:bg-[#0B0B0B]/60 px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setNewRolePerms((prev) =>
                          prev.includes(row.id) ? prev.filter((p) => p !== row.id) : [...prev, row.id]
                        )
                      }
                      className="w-4 h-4 accent-[#B54B1F]"
                    />
                    <span className="truncate">{row.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateRole(false)}
              className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={creatingRole}
              className="min-h-[40px] px-5 rounded-xl bg-[#B54B1F] text-white text-xs font-bold disabled:opacity-45"
            >
              {creatingRole ? 'در حال ایجاد...' : 'ثبت نقش جدید'}
            </button>
          </div>
        </form>
      )}

      {/* Role Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {effectiveRoles.map((role) => (
          <div
            key={role.id}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 flex flex-col justify-between gap-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getRoleBadgeClass(role.id)}`}>
                  {role.label}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold tabular-nums text-[#5C5C58] dark:text-[#A3A39E]">
                    {toFaDigits(roleCounts[role.id] || 0)} عضو
                  </span>
                  {!role.isSystem && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomRole(role)}
                      aria-label={`حذف نقش ${role.label}`}
                      className="p-1 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                {role.description || 'نقش سفارشی با مجوزهای اختصاصی در ماتریس زیر.'}
              </p>
            </div>
            <div className="pt-2.5 border-t border-[#E6E6E3]/70 dark:border-[#282825] text-[11px] text-[#5C5C58] dark:text-[#A3A39E] flex items-center justify-between tabular-nums">
              <span>{role.isSystem ? 'نقش پایه سیستم' : 'نقش سفارشی'}</span>
              <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA]">
                {toFaDigits((draftMatrix[role.id] || role.permissions).length)} مجوز فعال
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Interactive Dynamic ACL Permission Matrix */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold inline-flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <span>ماتریس تعاملی مجوزهای سمت سرور (قابل ویرایش زنده)</span>
            </h2>
            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] mt-0.5">
              با تیک‌زدن هر خانه و ذخیره نقش، دسترسی همان بخش در رابط کاربری و مسیرهای سرور بلافاصله به‌روزرسانی می‌شود.
            </p>
          </div>

          {dirtyRoleIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {dirtyRoleIds.map((rid) => {
                const role = effectiveRoles.find((r) => r.id === rid);
                if (!role) return null;
                return (
                  <button
                    key={rid}
                    type="button"
                    disabled={savingRoleId === rid}
                    onClick={() => handleSaveRolePermissions(role)}
                    className="min-h-[38px] px-3.5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] text-white text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {savingRoleId === rid ? 'در حال ذخیره...' : `ذخیره مجوزهای «${role.shortLabel}»`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#F6F6F5] dark:bg-[#0B0B0B] border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]">
              <tr>
                <th className="py-3 px-3 font-medium">حوزه عملیاتی</th>
                <th className="py-3 px-3 font-medium">بخش / مجوز</th>
                {effectiveRoles.map((role) => (
                  <th key={role.id} className="py-3 px-3 font-bold text-center whitespace-nowrap">
                    {role.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
              {PERMISSION_MATRIX_ROWS.map((row) => (
                <tr key={row.id} className="hover:bg-[#F6F6F5]/60 dark:hover:bg-[#0B0B0B]/40">
                  <td className="py-2.5 px-3 text-[11px] text-[#5C5C58] dark:text-[#A3A39E] whitespace-nowrap">
                    {row.group}
                  </td>
                  <td className="py-2.5 px-3 font-medium">{row.label}</td>
                  {effectiveRoles.map((role) => {
                    const currentPerms = draftMatrix[role.id] || role.permissions;
                    const allowed = currentPerms.includes(row.id);
                    const locked = role.id === 'senior_admin' && SENIOR_LOCKED_PERMS.includes(row.id);
                    return (
                      <td key={role.id} className="py-2.5 px-3 text-center">
                        <label
                          className={`inline-flex items-center justify-center gap-1.5 min-h-[32px] px-2.5 rounded-lg cursor-pointer transition-colors ${
                            allowed
                              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-semibold'
                              : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#7A7A74]'
                          } ${locked ? 'opacity-80 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={allowed}
                            disabled={locked}
                            onChange={() => toggleMatrixPermission(role.id, row.id)}
                            className="w-3.5 h-3.5 accent-[#B54B1F]"
                          />
                          <span className="text-[11px]">{allowed ? 'مجاز' : 'مسدود'}</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Role Assignment Console + Staff Directory */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Role Assignment Form */}
        <form
          onSubmit={handleAssignSubmit}
          className="xl:col-span-5 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#B54B1F]/10 dark:bg-[#E29A6F]/15 flex items-center justify-center shrink-0">
              <KeyRound className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
            </div>
            <div>
              <h2 className="text-sm font-bold">تخصیص نقش مدیریتی به اعضای تیم</h2>
              <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
                تغییر نقش بلافاصله اعمال و در تاریخچه امنیتی ثبت می‌شود.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">
              انتخاب کاربر
            </label>
            <select
              required
              value={selectedUserId}
              onChange={(e) => {
                const uid = e.target.value;
                setSelectedUserId(uid);
                const found = users.find((u) => u.id === uid);
                if (found) {
                  setSelectedRole(found.role === 'admin' ? 'senior_admin' : found.role);
                }
              }}
              className="w-full min-h-[44px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            >
              <option value="">یک کاربر را انتخاب کنید...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} — {toFaDigits(u.phone)} ({getRoleLabel(u.role, effectiveRoles)})
                </option>
              ))}
            </select>
          </div>

          {selectedUserObj && (
            <div className="rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#5C5C58] dark:text-[#A3A39E]">نقش فعلی {selectedUserObj.name}:</span>
              <span className="font-bold">{getRoleLabel(selectedUserObj.role, effectiveRoles)}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">
              نقش جدید
            </label>
            <div className="grid grid-cols-1 gap-2">
              {effectiveRoles.map((role) => {
                const active = selectedRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full text-right rounded-xl border px-3.5 py-2.5 text-xs transition-colors flex items-center justify-between gap-2 ${
                      active
                        ? 'border-[#B54B1F] dark:border-[#E29A6F] bg-[#B54B1F]/8 dark:bg-[#E29A6F]/12 font-bold'
                        : 'border-[#E6E6E3] dark:border-[#282825] hover:bg-[#F6F6F5] dark:hover:bg-[#1E1E1C]'
                    }`}
                  >
                    <span>{role.label}</span>
                    {active && <ShieldCheck className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />}
                  </button>
                );
              })}

              <select
                value={PUBLIC_ROLES.some((r) => r.value === selectedRole) ? selectedRole : ''}
                onChange={(e) => {
                  if (e.target.value) setSelectedRole(e.target.value);
                }}
                className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs text-[#5C5C58] dark:text-[#A3A39E]"
              >
                <option value="">یا بازگرداندن به نقش‌های غیرمدیریتی...</option>
                {PUBLIC_ROLES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">
              توضیح و علت تغییر (ثبت در گزارش امنیتی)
            </label>
            <input
              type="text"
              maxLength={180}
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="مثلاً: تخصیص دسترسی توسعه بازار برای مدیریت تبلیغات بومی"
              className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={saving || !selectedUserId}
            className="w-full min-h-[46px] rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-xs font-bold transition-colors disabled:opacity-45 inline-flex items-center justify-center gap-2"
          >
            <UserCog className="w-4 h-4" />
            <span>{saving ? 'در حال ثبت سطح دسترسی...' : 'ثبت و اعمال فوری نقش'}</span>
          </button>
        </form>

        {/* Staff & Users Role Directory */}
        <div className="xl:col-span-7 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <h2 className="text-sm font-bold">اعضای تیم مدیریت و کاربران</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStaffFilter('all_staff')}
                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                  staffFilter === 'all_staff'
                    ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                    : 'bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                همه مدیران
              </button>
              {effectiveRoles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setStaffFilter(r.id)}
                  className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                    staffFilter === r.id
                      ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                      : 'bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]'
                  }`}
                >
                  {r.shortLabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setStaffFilter('all_users')}
                className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                  staffFilter === 'all_users'
                    ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                    : 'bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                کل کاربران
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#5C5C58] absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جست‌وجو بر اساس نام، شماره موبایل یا نقش..."
              className="w-full min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] pr-9 pl-3 text-xs"
            />
          </div>

          {filteredDirectory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E6E6E3] dark:border-[#282825] p-8 text-center space-y-1.5">
              <p className="text-xs font-semibold">کاربری با این نقش یافت نشد.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right tabular-nums">
                <thead className="border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]">
                  <tr>
                    <th className="py-2.5 font-medium">نام و موبایل</th>
                    <th className="py-2.5 font-medium">نقش فعلی</th>
                    <th className="py-2.5 font-medium text-left">تغییر سریع نقش</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
                  {filteredDirectory.map((u) => {
                    const adminNorm = normalizeAdminRole(u.role, effectiveRoles);
                    const normalizedSelectValue = u.role === 'admin' ? 'senior_admin' : u.role;
                    return (
                      <tr key={u.id} className={u.isSuspended ? 'opacity-55' : ''}>
                        <td className="py-3">
                          <div className="font-bold text-xs">{u.name}</div>
                          <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]" dir="ltr">
                            {toFaDigits(u.phone)} · {u.city}
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                              adminNorm
                                ? getRoleBadgeClass(adminNorm)
                                : 'bg-[#EFEFED] dark:bg-[#20201E] text-[#5C5C58] dark:text-[#A3A39E]'
                            }`}
                          >
                            {getRoleLabel(u.role, effectiveRoles)}
                          </span>
                        </td>
                        <td className="py-3 text-left">
                          <select
                            aria-label={`تغییر نقش ${u.name}`}
                            value={normalizedSelectValue}
                            onChange={(e) => handleQuickRoleChange(u, e.target.value)}
                            className="min-h-[34px] rounded-lg border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-2 text-[11px]"
                          >
                            {PUBLIC_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                            {effectiveRoles.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 4. Audit Trail */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        <h2 className="text-sm font-bold inline-flex items-center gap-2">
          <History className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
          <span>تاریخچه امنیتی تغییرات دسترسی و نقش‌ها ({toFaDigits(auditLogs.length)})</span>
        </h2>

        {auditLogs.length === 0 ? (
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            هنوز تغییر دسترسی ثبت نشده است. هر تغییر نقش یا ویرایش ماتریس به‌صورت خودکار اینجا ثبت می‌شود.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right tabular-nums">
              <thead className="border-b border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]">
                <tr>
                  <th className="py-2 font-medium">موضوع / کاربر هدف</th>
                  <th className="py-2 font-medium">تغییر وضعیت</th>
                  <th className="py-2 font-medium">انجام‌دهنده</th>
                  <th className="py-2 font-medium">توضیح</th>
                  <th className="py-2 font-medium">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E3]/60 dark:divide-[#282825]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 font-semibold">{log.targetUserName}</td>
                    <td className="py-2.5 whitespace-nowrap">
                      <span className="text-[#5C5C58] dark:text-[#A3A39E]">
                        {getRoleLabel(log.previousRole, effectiveRoles)}
                      </span>
                      <span className="mx-1.5 text-[#B54B1F] dark:text-[#E29A6F]">←</span>
                      <span className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
                        {getRoleLabel(log.newRole, effectiveRoles)}
                      </span>
                    </td>
                    <td className="py-2.5 text-[#5C5C58] dark:text-[#A3A39E]">{log.actorName}</td>
                    <td className="py-2.5 text-[#5C5C58] dark:text-[#A3A39E] max-w-[260px] truncate">{log.note}</td>
                    <td className="py-2.5 text-[11px] text-[#5C5C58] dark:text-[#A3A39E] whitespace-nowrap">
                      {formatAuditTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
