import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  GitCompare,
  History,
  Pencil,
  RotateCcw,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {Recipe, RecipeVersion, RecipeVersionSnapshot, RecipeVersionStatus} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

interface AdminRecipeVersionModalProps {
  recipeId: string;
  initialVersionId?: string | null;
  onClose: () => void;
  onChanged: () => void;
  onEditAsDraft: (recipe: Recipe) => void;
  onNotify: (msg: string) => void;
}

const VERSION_STATUS_META: Record<
  RecipeVersionStatus,
  {label: string; badgeClass: string; bannerClass: string; bannerText: string}
> = {
  draft: {
    label: 'پیش‌نویس در انتظار تایید',
    badgeClass: 'bg-[#A97222]/15 text-[#8A5A14] dark:bg-[#D8A85B]/20 dark:text-[#E8C483]',
    bannerClass: 'border-[#A97222]/35 bg-[#A97222]/8 text-[#7C5010] dark:text-[#E8C483]',
    bannerText: 'این نسخه هنوز برای کاربران منتشر نشده است. پس از بررسی دقیق می‌توانید آن را تایید و جایگزین نسخه فعال کنید.',
  },
  published: {
    label: 'نسخه فعال در سایت',
    badgeClass: 'bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
    bannerClass: 'border-emerald-600/30 bg-emerald-600/8 text-emerald-800 dark:text-emerald-300',
    bannerText: 'این نسخه هم‌اکنون به‌صورت زنده در وب‌اپ لاقلی برای تمام کاربران نمایش داده می‌شود.',
  },
  archived: {
    label: 'آرشیو شده',
    badgeClass: 'bg-[#EFEFED] text-[#5C5C58] dark:bg-[#232320] dark:text-[#A3A39E]',
    bannerClass: 'border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] text-[#5C5C58] dark:text-[#A3A39E]',
    bannerText: 'این نسخه پیش‌تر منتشر شده و اکنون در آرشیو قرار دارد. در صورت نیاز می‌توانید آن را مجدداً بازگردانی کنید.',
  },
  rejected: {
    label: 'ردشده',
    badgeClass: 'bg-red-500/12 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    bannerClass: 'border-red-500/30 bg-red-500/8 text-red-700 dark:text-red-300',
    bannerText: 'این پیش‌نویس در بررسی قبلی رد شده است؛ همچنان می‌توانید محتوای آن را مشاهده یا در صورت صلاحدید منتشر کنید.',
  },
};

function formatPersianDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface DiffField {
  label: string;
  before: string;
  after: string;
}

function buildSnapshotDiff(live: RecipeVersionSnapshot, candidate: RecipeVersionSnapshot): DiffField[] {
  const diffs: DiffField[] = [];
  const compare = (label: string, a: string, b: string) => {
    if (a.trim() !== b.trim()) {
      diffs.push({label, before: a.trim() || '—', after: b.trim() || '—'});
    }
  };

  compare('عنوان دستور پخت', live.title, candidate.title);
  compare('زیرعنوان ادیتوریال', live.subtitle, candidate.subtitle);
  compare('توضیحات کامل', live.description, candidate.description);
  compare('دسته‌بندی', live.category, candidate.category);
  compare('منطقه', live.region, candidate.region);
  compare('فصل', live.season, candidate.season);
  compare('سطح دشواری', live.difficulty, candidate.difficulty);
  compare(
    'زمان آماده‌سازی و پخت',
    `${toFaDigits(live.prepMinutes)} + ${toFaDigits(live.cookMinutes)} دقیقه`,
    `${toFaDigits(candidate.prepMinutes)} + ${toFaDigits(candidate.cookMinutes)} دقیقه`
  );
  compare('تعداد نفرات', `${toFaDigits(live.servings)} نفر`, `${toFaDigits(candidate.servings)} نفر`);
  compare(
    'دسترسی ویژه (VIP)',
    live.isVip ? `ویژه (${toFaDigits(live.vipGemCost)} جِم)` : 'عمومی',
    candidate.isVip ? `ویژه (${toFaDigits(candidate.vipGemCost)} جِم)` : 'عمومی'
  );
  compare(
    'تصویر اصلی',
    live.imageUrl ? 'دارای تصویر ثبت‌شده' : 'بدون تصویر',
    candidate.imageUrl ? (candidate.imageUrl === live.imageUrl ? 'دارای تصویر ثبت‌شده' : 'تصویر جدید انتخاب شده') : 'بدون تصویر'
  );

  const liveIngs = live.ingredients.map((i) => `${i.name} (${toFaDigits(i.amount)} ${i.unit})`).join('، ');
  const candIngs = candidate.ingredients.map((i) => `${i.name} (${toFaDigits(i.amount)} ${i.unit})`).join('، ');
  compare('فهرست مواد اولیه', liveIngs, candIngs);

  const liveSteps = live.steps.map((s, idx) => `${toFaDigits(idx + 1)}. ${s.instruction}`).join('\n');
  const candSteps = candidate.steps.map((s, idx) => `${toFaDigits(idx + 1)}. ${s.instruction}`).join('\n');
  compare('مراحل پخت', liveSteps, candSteps);

  return diffs;
}

export function AdminRecipeVersionModal({
  recipeId,
  initialVersionId,
  onClose,
  onChanged,
  onEditAsDraft,
  onNotify,
}: AdminRecipeVersionModalProps) {
  const [liveRecipe, setLiveRecipe] = useState<Recipe | null>(null);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(initialVersionId || null);
  const [viewMode, setViewMode] = useState<'preview' | 'diff'>('preview');
  const [reviewNote, setReviewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{recipe: Recipe; versions: RecipeVersion[]}>(
        `/api/admin/recipes/${recipeId}/versions`,
        {useAdmin: true}
      );
      setLiveRecipe(res.recipe);
      setVersions(res.versions);
      setSelectedId((prev) => {
        if (prev && res.versions.some((v) => v.id === prev)) return prev;
        if (initialVersionId && res.versions.some((v) => v.id === initialVersionId)) return initialVersionId;
        const firstDraft = res.versions.find((v) => v.status === 'draft');
        return firstDraft ? firstDraft.id : res.versions[0]?.id || null;
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در دریافت تاریخچه نسخه‌ها');
    } finally {
      setLoading(false);
    }
  }, [recipeId, initialVersionId, onNotify]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedId) || versions[0] || null,
    [versions, selectedId]
  );

  const liveSnapshot = useMemo<RecipeVersionSnapshot | null>(() => {
    const publishedVer = versions.find((v) => v.status === 'published');
    if (publishedVer) return publishedVer.snapshot;
    if (!liveRecipe) return null;
    return {
      title: liveRecipe.title,
      subtitle: liveRecipe.subtitle,
      description: liveRecipe.description,
      imageUrl: liveRecipe.imageUrl,
      category: liveRecipe.category,
      region: liveRecipe.region,
      season: liveRecipe.season,
      mealType: liveRecipe.mealType,
      dietTags: liveRecipe.dietTags,
      prepMinutes: liveRecipe.prepMinutes,
      cookMinutes: liveRecipe.cookMinutes,
      servings: liveRecipe.servings,
      difficulty: liveRecipe.difficulty,
      nutrition: liveRecipe.nutrition,
      isVip: liveRecipe.isVip,
      vipGemCost: liveRecipe.vipGemCost,
      ingredients: liveRecipe.ingredients,
      steps: liveRecipe.steps,
      tools: liveRecipe.tools,
    };
  }, [versions, liveRecipe]);

  const diffRows = useMemo(() => {
    if (!liveSnapshot || !selectedVersion) return [];
    return buildSnapshotDiff(liveSnapshot, selectedVersion.snapshot);
  }, [liveSnapshot, selectedVersion]);

  const handleApprove = async () => {
    if (!selectedVersion) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/recipes/${recipeId}/versions/${selectedVersion.id}/approve`, {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({reviewNote}),
      });
      onNotify(
        selectedVersion.status === 'draft'
          ? `پیش‌نویس نسخه ${toFaDigits(selectedVersion.versionNumber)} با موفقیت تایید و منتشر شد.`
          : `نسخه ${toFaDigits(selectedVersion.versionNumber)} بازگردانی و به‌عنوان نسخه فعال منتشر شد.`
      );
      setReviewNote('');
      await fetchVersions();
      onChanged();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در تایید و انتشار نسخه');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVersion) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/admin/recipes/${recipeId}/versions/${selectedVersion.id}/reject`, {
        method: 'POST',
        useAdmin: true,
        body: JSON.stringify({reviewNote}),
      });
      onNotify(`پیش‌نویس نسخه ${toFaDigits(selectedVersion.versionNumber)} رد شد و نسخه فعال تغییری نکرد.`);
      setReviewNote('');
      await fetchVersions();
      onChanged();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در رد پیش‌نویس');
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = versions.filter((v) => v.status === 'draft').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="کنترل نسخه و پیش‌نمایش دستور پخت"
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div className="w-full max-w-6xl rounded-3xl bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#B54B1F]/12 dark:bg-[#E29A6F]/15 flex items-center justify-center shrink-0">
              <History className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold truncate">
                  کنترل نسخه و پیش‌نمایش: {liveRecipe?.title || 'در حال بارگذاری...'}
                </h2>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#A97222]/15 text-[#8A5A14] dark:text-[#E8C483] text-[11px] font-bold shrink-0">
                    {toFaDigits(pendingCount)} پیش‌نویس آماده تایید
                  </span>
                )}
              </div>
              <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
                پیش‌نویس‌ها را پیش از انتشار نهایی با ظاهر واقعی کاربران بررسی و با نسخه فعال مقایسه کنید.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {liveRecipe && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditAsDraft(liveRecipe);
                }}
                className="min-h-[38px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-xs font-semibold inline-flex items-center gap-1.5 hover:border-[#B54B1F]"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>ثبت پیش‌نویس جدید</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="بستن پنجره کنترل نسخه"
              className="w-9 h-9 rounded-xl border border-[#E6E6E3] dark:border-[#282825] flex items-center justify-center hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main 2-Column Body */}
        {loading ? (
          <div className="p-12 text-center text-sm text-[#5C5C58]">در حال بارگذاری نسخه‌ها...</div>
        ) : !selectedVersion ? (
          <div className="p-12 text-center text-sm text-[#5C5C58]">نسخه‌ای برای این دستور پخت ثبت نشده است.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-hidden">
            {/* Version Timeline List */}
            <aside className="lg:col-span-4 xl:col-span-3 border-b lg:border-b-0 lg:border-l border-[#E6E6E3] dark:border-[#282825] overflow-y-auto p-4 space-y-2.5 bg-[#FAF9F7] dark:bg-[#10100F] max-h-[240px] lg:max-h-none">
              <div className="flex items-center justify-between text-xs font-bold text-[#5C5C58] dark:text-[#A3A39E] px-1">
                <span>تاریخچه نسخه‌ها ({toFaDigits(versions.length)})</span>
                <span>جدیدترین بالا</span>
              </div>
              {versions.map((ver) => {
                const active = ver.id === selectedVersion.id;
                const meta = VERSION_STATUS_META[ver.status];
                return (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setSelectedId(ver.id)}
                    className={`w-full text-right rounded-2xl border p-3.5 transition-all space-y-1.5 ${
                      active
                        ? 'border-[#B54B1F] dark:border-[#E29A6F] bg-[#FFFFFF] dark:bg-[#1A1917] shadow-xs'
                        : 'border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF]/70 dark:bg-[#151514]/70 hover:bg-[#FFFFFF] dark:hover:bg-[#151514]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold tabular-nums">
                        نسخه {toFaDigits(ver.versionNumber)}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#0D0D0D] dark:text-[#FAFAFA] line-clamp-2 leading-relaxed">
                      {ver.changeSummary || 'بدون یادداشت تغییر'}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[10px] text-[#5C5C58] dark:text-[#A3A39E] pt-0.5">
                      <span className="truncate">{ver.createdByName}</span>
                      <span className="shrink-0 tabular-nums">{formatPersianDateTime(ver.createdAt)}</span>
                    </div>
                  </button>
                );
              })}
            </aside>

            {/* Preview & Diff Stage */}
            <div className="lg:col-span-8 xl:col-span-9 flex flex-col min-h-0 overflow-hidden">
              {/* Stage Sub-toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-[#E6E6E3] dark:border-[#282825]">
                <div className="inline-flex items-center rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('preview')}
                    className={`min-h-[34px] px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      viewMode === 'preview'
                        ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                        : 'text-[#5C5C58] dark:text-[#A3A39E]'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>پیش‌نمایش نهایی (Preview)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('diff')}
                    className={`min-h-[34px] px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                      viewMode === 'diff'
                        ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                        : 'text-[#5C5C58] dark:text-[#A3A39E]'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>مقایسه تغییرات</span>
                    {selectedVersion.status !== 'published' && diffRows.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-[#B54B1F] text-white text-[10px] tabular-nums">
                        {toFaDigits(diffRows.length)}
                      </span>
                    )}
                  </button>
                </div>

                <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                  ثبت‌کننده: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{selectedVersion.createdByName}</strong>
                  {selectedVersion.reviewedByName && (
                    <>
                      {' · '}بررسی‌کننده:{' '}
                      <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{selectedVersion.reviewedByName}</strong>
                    </>
                  )}
                </div>
              </div>

              {/* Scrollable Content Stage */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Status Banner */}
                <div
                  className={`rounded-2xl border px-4 py-3 text-xs leading-relaxed flex flex-wrap items-center justify-between gap-2 ${
                    VERSION_STATUS_META[selectedVersion.status].bannerClass
                  }`}
                >
                  <span>{VERSION_STATUS_META[selectedVersion.status].bannerText}</span>
                  {selectedVersion.reviewNote && (
                    <span className="font-semibold">یادداشت بررسی: «{selectedVersion.reviewNote}»</span>
                  )}
                </div>

                {viewMode === 'preview' ? (
                  <EditorialSnapshotPreview snapshot={selectedVersion.snapshot} authorName={liveRecipe?.authorName || selectedVersion.createdByName} />
                ) : (
                  <div className="space-y-3">
                    {selectedVersion.status === 'published' ? (
                      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] p-8 text-center text-xs text-[#5C5C58]">
                        این نسخه همان نسخه فعال و منتشرشده فعلی در سایت است؛ برای مشاهده تفاوت‌ها، یکی از پیش‌نویس‌ها یا نسخه‌های آرشیوشده را انتخاب کنید.
                      </div>
                    ) : diffRows.length === 0 ? (
                      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] p-8 text-center text-xs text-[#5C5C58]">
                        تفاوت محتوایی بین این نسخه و نسخه فعال فعلی ثبت نشده است.
                      </div>
                    ) : (
                      diffRows.map((d) => (
                        <div
                          key={d.label}
                          className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] overflow-hidden"
                        >
                          <div className="px-4 py-2 bg-[#F6F6F5] dark:bg-[#0B0B0B] border-b border-[#E6E6E3] dark:border-[#282825] text-xs font-bold">
                            {d.label}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-[#E6E6E3] dark:divide-[#282825] text-xs">
                            <div className="p-3.5 bg-red-500/[0.04] space-y-1">
                              <div className="text-[10px] font-bold text-red-700 dark:text-red-300">نسخه فعال فعلی</div>
                              <p className="whitespace-pre-line leading-relaxed text-[#5C5C58] dark:text-[#A3A39E]">
                                {d.before}
                              </p>
                            </div>
                            <div className="p-3.5 bg-emerald-500/[0.05] space-y-1">
                              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                نسخه {toFaDigits(selectedVersion.versionNumber)} (انتخاب‌شده)
                              </div>
                              <p className="whitespace-pre-line leading-relaxed text-[#0D0D0D] dark:text-[#FAFAFA]">
                                {d.after}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Sticky Review & Approval Action Footer */}
              <div className="px-5 py-4 border-t border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] flex flex-wrap items-center justify-between gap-3">
                {selectedVersion.status === 'draft' ? (
                  <>
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="یادداشت تایید یا دلیل رد پیش‌نویس (اختیاری)..."
                      className="flex-1 min-w-[200px] min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-3.5 text-xs"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleReject}
                        className="min-h-[42px] px-4 rounded-xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>رد پیش‌نویس</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleApprove}
                        className="min-h-[42px] px-5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{submitting ? 'در حال انتشار...' : 'تایید و انتشار نهایی نسخه'}</span>
                      </button>
                    </div>
                  </>
                ) : selectedVersion.status === 'published' ? (
                  <div className="w-full flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>نسخه {toFaDigits(selectedVersion.versionNumber)} اکنون نسخه زنده و منتشرشده است.</span>
                    </div>
                    {liveRecipe && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onEditAsDraft(liveRecipe);
                        }}
                        className="min-h-[40px] px-4 rounded-xl bg-[#111110] dark:bg-[#FAFAFA] text-white dark:text-[#111110] text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>ویرایش به‌عنوان پیش‌نویس جدید</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="text"
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="یادداشت بازگردانی به این نسخه (اختیاری)..."
                      className="flex-1 min-w-[200px] min-h-[40px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] px-3.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleApprove}
                      className="min-h-[40px] px-4 rounded-xl bg-[#111110] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:text-[#111110] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{submitting ? 'در حال بازگردانی...' : 'بازگردانی و انتشار این نسخه'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EditorialSnapshotPreview({
  snapshot,
  authorName,
}: {
  snapshot: RecipeVersionSnapshot;
  authorName: string;
}) {
  return (
    <article className="rounded-3xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#141413] overflow-hidden shadow-xs">
      {/* Hero Image + Overlay Badges */}
      <div className="relative aspect-[16/8] sm:aspect-[21/9] bg-[#EFEFED] dark:bg-[#1D1D1A]">
        <EditorialImage src={snapshot.imageUrl} alt={snapshot.title} aspectClass="h-full" />
        <div className="absolute top-3 right-3 flex flex-wrap items-center gap-1.5">
          <span className="px-2.5 py-1 rounded-lg bg-black/70 text-white text-[11px] font-medium backdrop-blur-xs">
            {snapshot.category} · {snapshot.region}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/90 text-[#111110] text-[11px] font-semibold">
            {snapshot.difficulty}
          </span>
          {snapshot.isVip && (
            <span className="px-2.5 py-1 rounded-lg bg-[#A97222] text-white text-[11px] font-bold inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>ویژه ({toFaDigits(snapshot.vipGemCost)} جِم)</span>
            </span>
          )}
        </div>
      </div>

      {/* Editorial Body */}
      <div className="p-5 sm:p-6 space-y-6">
        <div className="space-y-2">
          <div className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E]">
            نویسنده: {authorName} · فصل {snapshot.season} · وعده {snapshot.mealType}
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0D0D0D] dark:text-[#FAFAFA]">
            {snapshot.title}
          </h3>
          {snapshot.subtitle && (
            <p className="text-sm text-[#B54B1F] dark:text-[#E29A6F] font-medium">{snapshot.subtitle}</p>
          )}
          {snapshot.description && (
            <p className="text-xs sm:text-sm text-[#5C5C58] dark:text-[#A3A39E] leading-7 pt-1">
              {snapshot.description}
            </p>
          )}
        </div>

        {/* Key Recipe Specs Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
          <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />
            <div>
              <div className="text-[10px] text-[#5C5C58]">آماده‌سازی</div>
              <div className="text-xs font-bold">{toFaDigits(snapshot.prepMinutes)} دقیقه</div>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-[#A97222] shrink-0" />
            <div>
              <div className="text-[10px] text-[#5C5C58]">زمان پخت</div>
              <div className="text-xs font-bold">{toFaDigits(snapshot.cookMinutes)} دقیقه</div>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-[#5C5C58] shrink-0" />
            <div>
              <div className="text-[10px] text-[#5C5C58]">تعداد نفرات</div>
              <div className="text-xs font-bold">{toFaDigits(snapshot.servings)} نفر</div>
            </div>
          </div>
          <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3 flex items-center gap-2.5">
            <Flame className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F] shrink-0" />
            <div>
              <div className="text-[10px] text-[#5C5C58]">انرژی هر پرس</div>
              <div className="text-xs font-bold">{toFaDigits(snapshot.nutrition.calories)} کالری</div>
            </div>
          </div>
        </div>

        {/* Ingredients + Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-2 border-t border-[#E6E6E3] dark:border-[#282825]">
          <div className="md:col-span-5 space-y-3">
            <h4 className="text-sm font-extrabold">
              مواد اولیه ({toFaDigits(snapshot.ingredients.length)} قلم)
            </h4>
            <ul className="divide-y divide-[#E6E6E3]/70 dark:divide-[#282825] text-xs">
              {snapshot.ingredients.map((ing, idx) => (
                <li key={`${ing.name}-${idx}`} className="py-2 flex items-center justify-between gap-2">
                  <span className="font-medium text-[#0D0D0D] dark:text-[#FAFAFA]">{ing.name}</span>
                  <span className="text-[#5C5C58] dark:text-[#A3A39E] tabular-nums shrink-0">
                    {toFaDigits(ing.amount)} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-7 space-y-3">
            <h4 className="text-sm font-extrabold">
              مراحل پخت ({toFaDigits(snapshot.steps.length)} مرحله)
            </h4>
            <ol className="space-y-3">
              {snapshot.steps.map((st, idx) => (
                <li
                  key={`${st.order}-${idx}`}
                  className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-3.5 text-xs leading-6 flex items-start gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-[#B54B1F] dark:bg-[#E29A6F] text-white dark:text-[#0B0B0B] font-bold text-[11px] flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                    {toFaDigits(idx + 1)}
                  </span>
                  <div className="space-y-1 flex-1">
                    <p className="text-[#0D0D0D] dark:text-[#FAFAFA]">{st.instruction}</p>
                    {st.timerMinutes && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#B54B1F] dark:text-[#E29A6F] tabular-nums">
                        <Clock className="w-3 h-3" />
                        <span>زمان تقریبی: {toFaDigits(st.timerMinutes)} دقیقه</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </article>
  );
}
