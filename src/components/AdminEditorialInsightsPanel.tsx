import {useMemo, useState} from 'react';
import {
  AlertTriangle,
  ArrowUpLeft,
  Camera,
  CheckCircle2,
  Eye,
  Flame,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdminEditorialInsightsReport,
  EditorialPriorityLevel,
  EditorialRecipeRecommendation,
  Recipe,
} from '../shared/types.ts';
import {EditorialImage} from './EditorialImage.tsx';

interface AdminEditorialInsightsPanelProps {
  report: AdminEditorialInsightsReport | null;
  loading: boolean;
  days: number;
  onChangeDays: (days: number) => void;
  onRefresh: () => void;
  onEditRecipeAsDraft: (recipe: Recipe) => void;
  onOpenVersions: (recipeId: string) => void;
  onOpenPhotoModeration: () => void;
  onOpenQaModeration: () => void;
  onCreateRecipeFromTrend: (trendQuery: string) => void;
}

const PRIORITY_META: Record<
  EditorialPriorityLevel,
  {label: string; badgeClass: string; barClass: string}
> = {
  critical: {
    label: 'اولویت فوری',
    badgeClass: 'bg-red-500/12 text-red-700 dark:bg-red-500/20 dark:text-red-300',
    barClass: 'bg-red-600 dark:bg-red-400',
  },
  high: {
    label: 'اولویت بالا',
    badgeClass: 'bg-[#A97222]/15 text-[#8A5A14] dark:bg-[#D8A85B]/20 dark:text-[#E8C483]',
    barClass: 'bg-[#A97222] dark:bg-[#D8A85B]',
  },
  medium: {
    label: 'پیشنهاد بهبود',
    badgeClass: 'bg-[#B54B1F]/12 text-[#B54B1F] dark:bg-[#E29A6F]/15 dark:text-[#E29A6F]',
    barClass: 'bg-[#B54B1F] dark:bg-[#E29A6F]',
  },
};

const SOURCE_LABELS = {
  search: 'جستجوی دستور',
  fridge: 'یخچال هوشمند',
  mixed: 'جستجو و یخچال',
} as const;

export function AdminEditorialInsightsPanel({
  report,
  loading,
  days,
  onChangeDays,
  onRefresh,
  onEditRecipeAsDraft,
  onOpenVersions,
  onOpenPhotoModeration,
  onOpenQaModeration,
  onCreateRecipeFromTrend,
}: AdminEditorialInsightsPanelProps) {
  const [priorityFilter, setPriorityFilter] = useState<'all' | EditorialPriorityLevel>('all');
  const [reasonFilter, setReasonFilter] = useState<'all' | 'photo' | 'draft' | 'quality'>('all');

  const filteredRecs = useMemo(() => {
    if (!report) return [];
    return report.recommendations.filter((item) => {
      if (priorityFilter !== 'all' && item.priorityLevel !== priorityFilter) return false;
      if (reasonFilter === 'photo') {
        return item.reasons.some((r) => r.code === 'missing_cover_photo' || r.code === 'pending_community_photo');
      }
      if (reasonFilter === 'draft') {
        return item.reasons.some((r) => r.code === 'pending_draft_review' || r.code === 'pending_publication');
      }
      if (reasonFilter === 'quality') {
        return item.reasons.some(
          (r) =>
            r.code === 'thin_steps_or_timers' ||
            r.code === 'missing_tools_or_tags' ||
            r.code === 'unsolved_questions'
        );
      }
      return true;
    });
  }, [report, priorityFilter, reasonFilter]);

  const urgentCount = useMemo(
    () => (report ? report.recommendations.filter((r) => r.priorityLevel === 'critical' || r.priorityLevel === 'high').length : 0),
    [report]
  );

  const maxTrendSearch = useMemo(
    () => Math.max(1, ...(report?.trendingQueries.map((t) => t.searchCount) || [1])),
    [report]
  );

  const handlePrimaryAction = (item: EditorialRecipeRecommendation) => {
    if (item.recommendedAction === 'review_draft') {
      onOpenVersions(item.recipe.id);
      return;
    }
    if (item.recommendedAction === 'moderate_photo') {
      onOpenPhotoModeration();
      return;
    }
    if (item.recommendedAction === 'answer_qa') {
      onOpenQaModeration();
      return;
    }
    onEditRecipeAsDraft(item.recipe);
  };

  if (loading && !report) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-12 text-center text-sm text-[#5C5C58]">
        در حال تحلیل ترندهای جستجو و امتیازدهی دستورپخت‌ها...
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-10 text-center space-y-3">
        <p className="text-sm font-semibold">گزارش پیشنهاددهنده هوشمند در دسترس نیست.</p>
        <button
          type="button"
          onClick={onRefresh}
          className="min-h-[40px] px-4 rounded-xl bg-[#B54B1F] text-white text-xs font-semibold"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Control Bar */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#B54B1F]/12 dark:bg-[#E29A6F]/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[#B54B1F] dark:text-[#E29A6F]" />
          </div>
          <div className="space-y-0.5">
            <h2 className="text-base font-extrabold">پیشنهاددهنده هوشمند تحریریه (بر پایه ترندهای جستجو)</h2>
            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              تطبیق خودکار جستجوهای کاربران و یخچال هوشمند با دستورپخت‌ها برای شناسایی موارد محبوبِ نیازمند عکس، تکمیل مراحل یا تایید نسخه.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="بازه زمانی تحلیل ترند"
            className="inline-flex items-center rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] p-1 gap-1"
          >
            {[
              {d: 7, label: '۷ روز اخیر'},
              {d: 30, label: '۳۰ روز اخیر'},
              {d: 90, label: '۹۰ روز اخیر'},
            ].map((opt) => (
              <button
                key={opt.d}
                type="button"
                onClick={() => onChangeDays(opt.d)}
                className={`min-h-[32px] px-3 rounded-lg text-[11px] font-semibold transition-colors ${
                  days === opt.d
                    ? 'bg-[#111110] text-white dark:bg-[#FAFAFA] dark:text-[#111110]'
                    : 'text-[#5C5C58] dark:text-[#A3A39E]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="min-h-[38px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#282825] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحلیل مجدد</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 tabular-nums">
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">جستجوهای تحلیل‌شده</div>
          <div className="text-2xl font-extrabold">{toFaDigits(report.totalSearchesAnalyzed)}</div>
          <div className="text-[11px] text-[#5C5C58]">{toFaDigits(report.uniqueTrendingQueries)} عبارت کلیدی یکتا</div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">دستورهای نیازمند توجه</div>
          <div className="text-2xl font-extrabold text-[#B54B1F] dark:text-[#E29A6F]">
            {toFaDigits(report.recommendations.length)}
          </div>
          <div className="text-[11px] text-[#A97222] dark:text-[#E8C483]">
            {toFaDigits(urgentCount)} مورد با اولویت فوری یا بالا
          </div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1">
          <div className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">شکاف محتوایی (بدون نتیجه)</div>
          <div className="text-2xl font-extrabold text-[#A97222] dark:text-[#E8C483]">
            {toFaDigits(report.contentGaps.length)}
          </div>
          <div className="text-[11px] text-[#5C5C58]">فرصت تولید دستورپخت پرتقاضا</div>
        </div>
        <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            <span>سلامت آرشیو دستورها</span>
            <span className="font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
              {toFaDigits(report.catalogHealthScore)}٪
            </span>
          </div>
          <div className="h-2 rounded-full bg-[#EFEFED] dark:bg-[#242421] overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 transition-all"
              style={{width: `${Math.min(100, Math.max(8, report.catalogHealthScore))}%`}}
            />
          </div>
          <div className="text-[11px] text-[#5C5C58]">بر اساس پوشش عکس، تایمر و پاسخ‌گویی</div>
        </div>
      </div>

      {/* Section A: Recommended Recipes Needing Attention */}
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
            <h3 className="text-sm sm:text-base font-extrabold">
              دستورپخت‌های محبوب نیازمند بازبینی ({toFaDigits(filteredRecs.length)})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as 'all' | EditorialPriorityLevel)}
              className="min-h-[36px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            >
              <option value="all">همه سطوح اولویت</option>
              <option value="critical">فقط اولویت فوری</option>
              <option value="high">فقط اولویت بالا</option>
              <option value="medium">پیشنهاد بهبود</option>
            </select>
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value as 'all' | 'photo' | 'draft' | 'quality')}
              className="min-h-[36px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F6F6F5] dark:bg-[#0B0B0B] px-3 text-xs"
            >
              <option value="all">همه دلایل بازبینی</option>
              <option value="photo">نیازمند تصویر یا تایید عکس</option>
              <option value="draft">پیش‌نویس / انتشار</option>
              <option value="quality">کیفیت مراحل و پرسش‌ها</option>
            </select>
          </div>
        </div>

        {filteredRecs.length === 0 ? (
          <div className="rounded-2xl bg-[#F6F6F5] dark:bg-[#0B0B0B] p-10 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
            <p className="text-sm font-bold">در این فیلتر، دستورپخت نیازمند بازبینی وجود ندارد.</p>
            <p className="text-xs text-[#5C5C58]">کیفیت دستورپخت‌های این بخش در وضعیت مطلوب قرار دارد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {filteredRecs.map((item) => {
              const pMeta = PRIORITY_META[item.priorityLevel];
              return (
                <div
                  key={item.recipe.id}
                  className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#111110] p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Card Header */}
                    <div className="flex items-start gap-3">
                      <div className="w-20 h-16 rounded-xl overflow-hidden border border-[#E6E6E3] dark:border-[#282825] shrink-0">
                        <EditorialImage
                          src={item.recipe.imageUrl}
                          alt={item.recipe.title}
                          aspectClass="h-full"
                          compactEmpty
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${pMeta.badgeClass}`}>
                            {pMeta.label} · امتیاز {toFaDigits(item.priorityScore)} از ۱۰۰
                          </span>
                          <span className="text-[10px] text-[#5C5C58] dark:text-[#A3A39E]">
                            {item.recipe.category} · {item.costTier}
                          </span>
                        </div>
                        <h4 className="text-sm font-extrabold truncate">{item.recipe.title}</h4>
                        <div className="h-1.5 rounded-full bg-[#E6E6E3] dark:bg-[#282825] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pMeta.barClass}`}
                            style={{width: `${Math.min(100, item.priorityScore)}%`}}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Matched Search Trends & Engagement Strip */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] tabular-nums">
                      {item.searchHits > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#181816] border border-[#E6E6E3] dark:border-[#282825] font-semibold text-[#B54B1F] dark:text-[#E29A6F]">
                          <TrendingUp className="w-3 h-3" />
                          <span>{toFaDigits(item.searchHits)} جستجوی مرتبط</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FFFFFF] dark:bg-[#181816] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58]">
                          <Flame className="w-3 h-3" />
                          <span>پیشنهاد بهبود کیفیت</span>
                        </span>
                      )}
                      {item.matchedTrends.slice(0, 3).map((mt) => (
                        <span
                          key={mt.query}
                          className="px-2 py-1 rounded-lg bg-[#EFEFED] dark:bg-[#20201E] text-[#0D0D0D] dark:text-[#FAFAFA]"
                        >
                          «{mt.query}» ({toFaDigits(mt.count)})
                        </span>
                      ))}
                      {item.unsolvedQuestionsCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/12 text-amber-800 dark:text-amber-300">
                          <MessageSquare className="w-3 h-3" />
                          <span>{toFaDigits(item.unsolvedQuestionsCount)} پرسش باز</span>
                        </span>
                      )}
                    </div>

                    {/* Actionable Attention Reasons */}
                    <ul className="space-y-1.5 text-xs">
                      {item.reasons.map((r) => (
                        <li
                          key={r.code}
                          className="rounded-xl bg-[#FFFFFF] dark:bg-[#161614] border border-[#E6E6E3]/80 dark:border-[#282825] px-3 py-2 space-y-0.5"
                        >
                          <div className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{r.label}</div>
                          <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{r.detail}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Action Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E6E6E3]/70 dark:border-[#282825]">
                    <button
                      type="button"
                      onClick={() => handlePrimaryAction(item)}
                      className="flex-1 min-h-[38px] px-3.5 rounded-xl bg-[#B54B1F] hover:bg-[#963B15] dark:bg-[#E29A6F] dark:text-[#0B0B0B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                    >
                      {item.recommendedAction === 'moderate_photo' ? (
                        <Camera className="w-3.5 h-3.5" />
                      ) : item.recommendedAction === 'review_draft' ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <Pencil className="w-3.5 h-3.5" />
                      )}
                      <span>{item.recommendedActionLabel}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenVersions(item.recipe.id)}
                      className="min-h-[38px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] text-xs font-medium inline-flex items-center gap-1 hover:bg-[#EFEFED] dark:hover:bg-[#20201E]"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>نسخه‌ها</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section B: Trending Searches & Content Gaps */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trending Queries */}
        <div className="lg:col-span-7 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <h3 className="text-sm font-extrabold">ترندهای داغ جستجوی کاربران</h3>
            </div>
            <span className="text-[11px] text-[#5C5C58]">نرمال‌سازی هوشمند فارسی</span>
          </div>

          {report.trendingQueries.length === 0 ? (
            <p className="text-xs text-[#5C5C58] py-6 text-center">هنوز جستجویی در این بازه ثبت نشده است.</p>
          ) : (
            <div className="space-y-2.5 tabular-nums">
              {report.trendingQueries.slice(0, 10).map((tr) => {
                const widthPct = Math.max(10, Math.round((tr.searchCount / maxTrendSearch) * 100));
                const isGap = tr.matchedRecipesCount === 0;
                return (
                  <div key={tr.normalizedQuery} className="space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold truncate">{tr.query}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#EFEFED] dark:bg-[#232320] text-[10px] text-[#5C5C58] dark:text-[#A3A39E]">
                          {SOURCE_LABELS[tr.source]}
                        </span>
                        <span className="hidden sm:inline text-[10px] text-[#5C5C58]">{tr.category}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[11px]">
                        <span className={isGap ? 'text-red-600 dark:text-red-400 font-bold' : 'text-emerald-700 dark:text-emerald-400'}>
                          {isGap ? 'بدون دستور!' : `${toFaDigits(tr.matchedRecipesCount)} دستور`}
                        </span>
                        <span className="font-extrabold">{toFaDigits(tr.searchCount)} جستجو</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-[#F6F6F5] dark:bg-[#0B0B0B] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          isGap ? 'bg-[#A97222] dark:bg-[#D8A85B]' : 'bg-[#B54B1F] dark:bg-[#E29A6F]'
                        }`}
                        style={{width: `${widthPct}%`}}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Gaps (Zero-Result Trends) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#A97222]/35 bg-[#A97222]/[0.05] dark:bg-[#D8A85B]/[0.07] p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#A97222] dark:text-[#E8C483]" />
              <h3 className="text-sm font-extrabold text-[#7C5010] dark:text-[#E8C483]">
                فرصت‌های تولید محتوا (ترندهای بدون دستورپخت)
              </h3>
            </div>
            <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              کاربران این غذاها را جستجو کرده‌اند اما هنوز دستور منتشرشده‌ای در آرشیو لاقلی ندارد. با یک کلیک پیش‌نویس بسازید.
            </p>
          </div>

          {report.contentGaps.length === 0 ? (
            <div className="rounded-xl bg-[#FFFFFF] dark:bg-[#151514] p-6 text-center text-xs text-[#5C5C58]">
              تمام ترندهای پرجستجوی فعلی در آرشیو پوشش داده شده‌اند.
            </div>
          ) : (
            <div className="space-y-2.5">
              {report.contentGaps.map((gap) => (
                <div
                  key={gap.normalizedQuery}
                  className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-xs font-extrabold truncate">{gap.query}</div>
                    <div className="text-[11px] text-[#5C5C58] tabular-nums">
                      {toFaDigits(gap.searchCount)} جستجو · دسته پیشنهادی: {gap.category}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateRecipeFromTrend(gap.query)}
                    className="min-h-[34px] px-3 rounded-xl bg-[#111110] hover:bg-[#242422] dark:bg-[#FAFAFA] dark:text-[#111110] text-white text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>تولید پیش‌نویس</span>
                    <ArrowUpLeft className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
