import {useCallback, useEffect, useState} from 'react';
import {ChefHat, MessageSquare, Trash2} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import {hasAdminPermission} from '../shared/rbac.ts';
import type {
  AdminPermission,
  AdminQuestionRow,
  AdminRole,
  CustomSubstitutionRule,
  DynamicRoleDefinition,
  KitchenConfig,
} from '../shared/types.ts';
import {AdminWorkspaceSkeleton} from './EditorialSkeletons.tsx';

interface AdminFrontendOpsPanelProps {
  adminRole: AdminRole;
  aclRoles?: DynamicRoleDefinition[];
  permissions?: AdminPermission[];
  onRefreshAppConfig: () => void;
  onNotify: (msg: string) => void;
}

type SubTab = 'kitchen' | 'qa';

export function AdminFrontendOpsPanel({
  adminRole,
  aclRoles,
  permissions,
  onRefreshAppConfig,
  onNotify,
}: AdminFrontendOpsPanelProps) {
  const canEditKitchen = hasAdminPermission(adminRole, 'content.kitchen', aclRoles, permissions);
  const canModerateQa = hasAdminPermission(adminRole, 'content.qa', aclRoles, permissions);

  const defaultTab: SubTab = canEditKitchen ? 'kitchen' : 'qa';
  const [subTab, setSubTab] = useState<SubTab>(defaultTab);
  const [loading, setLoading] = useState(false);

  // Smart Kitchen / Fridge & Custom Substitutions
  const [kitchenConfig, setKitchenConfig] = useState<KitchenConfig>({
    quickFridgeItems: [],
    quickSubQueries: [],
    customSubstitutions: [],
  });
  const [newFridgeItem, setNewFridgeItem] = useState('');
  const [newSubQuery, setNewSubQuery] = useState('');
  const [newSubRule, setNewSubRule] = useState({
    ingredient: '',
    substitute: '',
    ratio: '۱ به ۱',
    compatibility: 88,
    flavorNote: '',
    isVegan: false,
  });

  // Q&A Moderation
  const [questions, setQuestions] = useState<AdminQuestionRow[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const tasks: Promise<void>[] = [];
      if (canEditKitchen) {
        tasks.push(
          apiRequest<{kitchenConfig: KitchenConfig}>('/api/admin/kitchen-config', {useAdmin: true}).then(
            (kitchenRes) => setKitchenConfig(kitchenRes.kitchenConfig)
          )
        );
      }
      if (canModerateQa) {
        tasks.push(
          apiRequest<{questions: AdminQuestionRow[]}>('/api/admin/questions', {useAdmin: true}).then((qaRes) =>
            setQuestions(qaRes.questions)
          )
        );
      }
      await Promise.all(tasks);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در دریافت داده‌های مدیریتی');
    } finally {
      setLoading(false);
    }
  }, [onNotify, canEditKitchen, canModerateQa]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveKitchenConfig = async (next: KitchenConfig, msg = 'تنظیمات آشپزخانه هوشمند ذخیره شد.') => {
    try {
      const res = await apiRequest<{kitchenConfig: KitchenConfig}>(
        '/api/admin/kitchen-config',
        {method: 'PUT', body: JSON.stringify(next), useAdmin: true}
      );
      setKitchenConfig(res.kitchenConfig);
      onRefreshAppConfig();
      onNotify(msg);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ذخیره تنظیمات یخچال');
    }
  };

  const handleAddFridgeItem = () => {
    const clean = newFridgeItem.trim();
    if (!clean || kitchenConfig.quickFridgeItems.includes(clean)) return;
    setNewFridgeItem('');
    saveKitchenConfig({...kitchenConfig, quickFridgeItems: [...kitchenConfig.quickFridgeItems, clean]});
  };

  const handleAddSubQuery = () => {
    const clean = newSubQuery.trim();
    if (!clean || kitchenConfig.quickSubQueries.includes(clean)) return;
    setNewSubQuery('');
    saveKitchenConfig({...kitchenConfig, quickSubQueries: [...kitchenConfig.quickSubQueries, clean]});
  };

  const handleAddCustomSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubRule.ingredient.trim() || !newSubRule.substitute.trim() || !newSubRule.flavorNote.trim()) return;
    const rule: CustomSubstitutionRule = {
      id: `sub-${Date.now()}`,
      ingredient: newSubRule.ingredient.trim(),
      substitute: newSubRule.substitute.trim(),
      ratio: newSubRule.ratio.trim() || '۱ به ۱',
      compatibility: Number(newSubRule.compatibility) || 85,
      flavorNote: newSubRule.flavorNote.trim(),
      isVegan: newSubRule.isVegan,
    };
    setNewSubRule({ingredient: '', substitute: '', ratio: '۱ به ۱', compatibility: 88, flavorNote: '', isVegan: false});
    saveKitchenConfig(
      {...kitchenConfig, customSubstitutions: [rule, ...kitchenConfig.customSubstitutions]},
      'قانون جایگزین سفارشی اضافه شد.'
    );
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await apiRequest(`/api/admin/questions/${id}`, {method: 'DELETE', useAdmin: true});
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      onNotify('پرسش و پاسخ‌های مرتبط با آن حذف شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف پرسش');
    }
  };

  const handleDeleteAnswer = async (questionId: string, answerId: string) => {
    try {
      await apiRequest(`/api/admin/answers/${answerId}`, {method: 'DELETE', useAdmin: true});
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? {...q, answers: q.answers.filter((a) => a.id !== answerId)} : q))
      );
      onNotify('پاسخ انتخاب‌شده حذف شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در حذف پاسخ');
    }
  };

  const tabs: {id: SubTab; label: string; icon: typeof ChefHat; count?: number; visible: boolean}[] = [
    {
      id: 'kitchen',
      label: 'یخچال‌گردی و جایگزین مواد',
      icon: ChefHat,
      count: kitchenConfig.quickFridgeItems.length,
      visible: canEditKitchen,
    },
    {
      id: 'qa',
      label: 'نظارت پرسش‌وپاسخ‌ها',
      icon: MessageSquare,
      count: questions.length,
      visible: canModerateQa,
    },
  ];

  const visibleTabs = tabs.filter((t) => t.visible);
  const effectiveSubTab = visibleTabs.some((t) => t.id === subTab) ? subTab : visibleTabs[0]?.id || 'kitchen';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E6E6E3] dark:border-[#282825] pb-4">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          const active = effectiveSubTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                  : 'border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="text-[11px] opacity-75 tabular-nums">({toFaDigits(t.count)})</span>
              )}
            </button>
          );
        })}
      </div>

      {loading && kitchenConfig.quickFridgeItems.length === 0 && questions.length === 0 ? (
        <AdminWorkspaceSkeleton />
      ) : null}

      {effectiveSubTab === 'kitchen' && canEditKitchen && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Fridge Ingredients */}
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">مواد پیشنهادی سریع بخش یخچال‌گردی</h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  این اقلام در صفحه «آشپزخانه هوشمند» برای انتخاب سریع کاربران نمایش داده می‌شوند.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFridgeItem}
                  onChange={(e) => setNewFridgeItem(e.target.value)}
                  placeholder="افزودن ماده جدید (مثلاً کدو حلوایی)"
                  className="flex-1 min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddFridgeItem}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-medium"
                >
                  افزودن
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {kitchenConfig.quickFridgeItems.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 py-1.5 text-xs"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`حذف ${item}`}
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          quickFridgeItems: kitchenConfig.quickFridgeItems.filter((x) => x !== item),
                        })
                      }
                      className="text-[#5C5C58] hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Substitution Queries */}
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-bold">پیشنهادهای سریع موتور جایگزین مواد</h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                  مواد پرتقاضایی که کاربران با یک کلیک جایگزین آن‌ها را جست‌وجو می‌کنند.
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubQuery}
                  onChange={(e) => setNewSubQuery(e.target.value)}
                  placeholder="مثلاً خامه صبحانه"
                  className="flex-1 min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSubQuery}
                  className="min-h-[40px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-medium"
                >
                  افزودن
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {kitchenConfig.quickSubQueries.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 py-1.5 text-xs"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      aria-label={`حذف ${item}`}
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          quickSubQueries: kitchenConfig.quickSubQueries.filter((x) => x !== item),
                        })
                      }
                      className="text-[#5C5C58] hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Substitutions Rules */}
          <form
            onSubmit={handleAddCustomSub}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <h3 className="text-sm font-bold">افزودن قانون جایگزین سفارشی سرآشپز</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                placeholder="ماده اصلی (مثلاً خامه)"
                value={newSubRule.ingredient}
                onChange={(e) => setNewSubRule({...newSubRule, ingredient: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                required
                placeholder="جایگزین (مثلاً شیر + کره)"
                value={newSubRule.substitute}
                onChange={(e) => setNewSubRule({...newSubRule, substitute: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="text"
                placeholder="نسبت جایگزینی"
                value={newSubRule.ratio}
                onChange={(e) => setNewSubRule({...newSubRule, ratio: e.target.value})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <input
                type="number"
                min={10}
                max={100}
                placeholder="درصد سازگاری"
                value={newSubRule.compatibility}
                onChange={(e) => setNewSubRule({...newSubRule, compatibility: Number(e.target.value)})}
                className="min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs tabular-nums"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                required
                placeholder="توضیح طعم و بافت جایگزین برای کاربر..."
                value={newSubRule.flavorNote}
                onChange={(e) => setNewSubRule({...newSubRule, flavorNote: e.target.value})}
                className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
              />
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={newSubRule.isVegan}
                  onChange={(e) => setNewSubRule({...newSubRule, isVegan: e.target.checked})}
                  className="w-4 h-4 accent-[#B54B1F]"
                />
                <span>گیاهی</span>
              </label>
              <button
                type="submit"
                className="min-h-[40px] px-4 rounded-xl bg-[#111110] dark:bg-[#FAFAFA] text-white dark:text-[#111110] text-xs font-semibold"
              >
                ثبت جایگزین
              </button>
            </div>

            {kitchenConfig.customSubstitutions.length > 0 && (
              <div className="pt-3 border-t border-[#E6E6E3] dark:border-[#282825] space-y-2">
                {kitchenConfig.customSubstitutions.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 py-2.5 text-xs"
                  >
                    <div>
                      <span className="font-bold">{rule.ingredient}</span> ←{' '}
                      <span className="text-[#B54B1F] dark:text-[#E29A6F] font-semibold">{rule.substitute}</span> (
                      {rule.ratio} · {toFaDigits(rule.compatibility)}٪) — {rule.flavorNote}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        saveKitchenConfig({
                          ...kitchenConfig,
                          customSubstitutions: kitchenConfig.customSubstitutions.filter((r) => r.id !== rule.id),
                        })
                      }
                      className="text-red-600 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </form>
        </div>
      )}

      {effectiveSubTab === 'qa' && canModerateQa && (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center text-xs text-[#5C5C58]">
              هنوز پرسشی از سوی کاربران ثبت نشده است.
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                      دستور: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{q.recipeTitle}</strong> · پرسشگر:{' '}
                      {q.authorName}
                    </div>
                    <p className="text-sm font-semibold">{q.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="min-h-[36px] px-3 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 text-xs inline-flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف پرسش</span>
                  </button>
                </div>

                {q.answers.length > 0 && (
                  <div className="pt-3 border-t border-[#E6E6E3]/70 dark:border-[#282825] space-y-2">
                    {q.answers.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3.5 py-2.5 text-xs"
                      >
                        <div className="space-y-0.5">
                          <span className="font-semibold">{a.authorName}</span>
                          {a.isBest && (
                            <span className="text-[#B54B1F] dark:text-[#E29A6F] mr-1.5">· بهترین پاسخ</span>
                          )}
                          <p className="text-[#5C5C58] dark:text-[#A3A39E]">{a.body}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnswer(q.id, a.id)}
                          aria-label="حذف پاسخ"
                          className="text-red-600 shrink-0 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
