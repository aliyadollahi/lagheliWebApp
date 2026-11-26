import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  BarChart3,
  Clock,
  Download,
  MousePointerClick,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {
  behaviorObserverSubject,
  getAnonymizedBehaviorAggregates,
} from '../lib/behaviorTracker.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {
  AdminBehavioralChartsReportPayload,
  AnonymizedBehaviorAggregateStore,
} from '../shared/types.ts';

interface AdminBehavioralChartsPanelProps {
  onNotify: (msg: string) => void;
}

type RecipeMetricKey = 'views' | 'avgDwellSeconds' | 'cookStarts';
type HourlyChartMode = 'visits_interactions' | 'avg_dwell';
type TableSortKey = 'views' | 'avgDwellSeconds' | 'avgScrollDepthPercent' | 'avgClickIntervalSec';

function formatDurationFa(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${toFaDigits(s)} ثانیه`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0
    ? `${toFaDigits(mins)} دقیقه و ${toFaDigits(rem)} ثانیه`
    : `${toFaDigits(mins)} دقیقه`;
}

function formatMsAsSecondsFa(ms: number): string {
  if (ms <= 0) return '۰ ثانیه';
  const sec = (ms / 1000).toFixed(1).replace(/\.0$/, '');
  return `${toFaDigits(sec)} ثانیه`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    dataKey?: string;
    color?: string;
    payload?: Record<string, unknown>;
  }[];
  label?: string;
}

function RecipePopularityTooltip({active, payload}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | AdminBehavioralChartsReportPayload['recipePopularity'][number]
    | undefined;
  if (!row) return null;

  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3.5 py-2.5 text-xs shadow-sm space-y-1.5 tabular-nums max-w-[240px]"
    >
      <p className="font-extrabold text-[#111110] dark:text-[#F5F5F3] leading-snug">{row.title}</p>
      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">دسته {row.category}</p>
      <div className="pt-1 border-t border-[#EFEFED] dark:border-[#262623] space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">بازدید دستورپخت</span>
          <strong className="font-bold">{toFaDigits(row.views)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">میانگین ماندگاری</span>
          <strong className="font-bold">{formatDurationFa(row.avgDwellSeconds)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">شروع آشپزی</span>
          <strong className="font-bold">{toFaDigits(row.cookStarts)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">عمق اسکرول</span>
          <strong className="font-bold">{toFaDigits(row.avgScrollDepthPercent)}٪</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">فاصله میانگین کلیک</span>
          <strong className="font-bold">{toFaDigits(row.avgClickIntervalSec)} ثانیه</strong>
        </div>
      </div>
    </div>
  );
}

function PeakHoursTooltip({active, payload, label}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload as
    | AdminBehavioralChartsReportPayload['peakHours'][number]
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
          <span className="text-[#6B6B66] dark:text-[#989892]">نشست‌های فعال</span>
          <strong className="font-bold text-[#A97222] dark:text-[#D8A85B]">
            {toFaDigits(row.visits)}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">تعامل ثبت‌شده</span>
          <strong className="font-bold text-[#B54B1F] dark:text-[#E29A6F]">
            {toFaDigits(row.interactions)}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#6B6B66] dark:text-[#989892]">میانگین ماندگاری</span>
          <strong className="font-bold">{formatDurationFa(row.avgDwellSeconds)}</strong>
        </div>
      </div>
    </div>
  );
}

function SimpleDistributionTooltip({
  active,
  payload,
  unitLabel,
}: CustomTooltipProps & {unitLabel: string}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const row = item?.payload as Record<string, unknown> | undefined;
  return (
    <div
      dir="rtl"
      className="rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#171715] px-3 py-2 text-xs shadow-sm space-y-1 tabular-nums"
    >
      <p className="font-bold text-[#111110] dark:text-[#F5F5F3]">{String(row?.label || '')}</p>
      {typeof row?.description === 'string' && (
        <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{row.description}</p>
      )}
      <p className="text-[11px] font-bold text-[#A97222] dark:text-[#D8A85B]">
        {toFaDigits(Number(item?.value || 0))} {unitLabel}
      </p>
    </div>
  );
}

export function AdminBehavioralChartsPanel({onNotify}: AdminBehavioralChartsPanelProps) {
  const [report, setReport] = useState<AdminBehavioralChartsReportPayload | null>(null);
  const [localAggregate, setLocalAggregate] = useState<AnonymizedBehaviorAggregateStore>(() =>
    getAnonymizedBehaviorAggregates()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [recipeMetric, setRecipeMetric] = useState<RecipeMetricKey>('views');
  const [hourlyMode, setHourlyMode] = useState<HourlyChartMode>('visits_interactions');
  const [tableSort, setTableSort] = useState<TableSortKey>('views');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<AdminBehavioralChartsReportPayload>(
        '/api/admin/behavioral-reports/charts',
        {useAdmin: true}
      );
      setReport(payload);
      setLocalAggregate(getAnonymizedBehaviorAggregates());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری گزارش نموداری رفتار کاربران ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReport();
    return behaviorObserverSubject.subscribe((_ev, agg) => {
      setLocalAggregate(agg);
    });
  }, [loadReport]);

  const categories = useMemo(() => {
    if (!report) return [];
    return Array.from(new Set(report.recipePopularity.map((r) => r.category).filter(Boolean)));
  }, [report]);

  const filteredRecipes = useMemo(() => {
    if (!report) return [];
    const base =
      selectedCategory === 'all'
        ? report.recipePopularity
        : report.recipePopularity.filter((r) => r.category === selectedCategory);
    return [...base].sort((a, b) => b[recipeMetric] - a[recipeMetric]);
  }, [report, selectedCategory, recipeMetric]);

  const sortedTableRows = useMemo(() => {
    return [...filteredRecipes].sort((a, b) => b[tableSort] - a[tableSort]);
  }, [filteredRecipes, tableSort]);

  const handleExportAnonymizedJson = () => {
    if (!report) return;
    const bundle = {
      exportedAt: new Date().toISOString(),
      privacyNotice:
        'گزارش کاملاً تجمیعی و بدون اطلاعات هویتی افراد (مبتنی بر الگوی Observer رفتار کاربران لاقلی)',
      serverAggregates: report,
      localObserverAggregates: localAggregate,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lagheli-behavioral-charts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('فایل تجمیعی بدون هویت نمودارهای رفتاری دانلود شد.');
  };

  if (loading && !report) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({length: 5}).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] animate-pulse" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center space-y-3">
        <p className="text-sm font-bold text-[#B91C1C] dark:text-[#F87171]">
          {error || 'امکان دریافت گزارش‌های نموداری وجود ندارد.'}
        </p>
        <button
          type="button"
          onClick={loadReport}
          className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold whitespace-nowrap"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  const recipeMetricLabel: Record<RecipeMetricKey, string> = {
    views: 'تعداد بازدید',
    avgDwellSeconds: 'میانگین ماندگاری (ثانیه)',
    cookStarts: 'شروع آشپزی',
  };

  const localRecipesObservedCount = Object.keys(localAggregate.recipes).length;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#A97222] dark:text-[#D8A85B]">
            گزارش تحلیلی رفتار کاربران · تجمیعی و کاملاً بدون هویت
          </div>
          <h2 className="text-lg font-extrabold text-balance">
            نمودارهای محبوبیت دستورپخت‌ها، زمان‌های پربازدید و الگوی تعامل
          </h2>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            استخراج‌شده از زمان ماندگاری روی دستورپخت، عمق اسکرول و فواصل کلیک کاربران در تمامی نشست‌ها.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadReport}
            disabled={loading}
            className="min-h-[40px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:border-[#A97222] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>بروزرسانی داده</span>
          </button>
          <button
            type="button"
            onClick={handleExportAnonymizedJson}
            className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی تجمیعی JSON</span>
          </button>
        </div>
      </section>

      {/* 5-Card Executive KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 tabular-nums">
        {[
          {
            label: 'بازدید کل دستورپخت‌ها',
            value: toFaDigits(report.summary.totalRecipeViews),
            meta: `${toFaDigits(report.summary.totalSessions)} نشست تحلیل‌شده`,
          },
          {
            label: 'میانگین ماندگاری دستور',
            value: formatDurationFa(report.summary.avgRecipeDwellSeconds),
            meta: 'زمان واقعی مطالعه دستورپخت',
          },
          {
            label: 'پربازدیدترین ساعت شبانه‌روز',
            value: report.summary.peakHourLabel,
            meta: `بازه اوج ${report.summary.peakWindowLabel}`,
          },
          {
            label: 'میانگین عمق اسکرول',
            value: `${toFaDigits(report.summary.avgScrollDepthPercent)}٪`,
            meta: 'پیشروی در متن و مراحل پخت',
          },
          {
            label: 'میانگین فاصله بین کلیک‌ها',
            value: formatMsAsSecondsFa(report.summary.avgClickIntervalMs),
            meta:
              localRecipesObservedCount > 0
                ? `${toFaDigits(localRecipesObservedCount)} دستور رصدشده در این مرورگر`
                : 'ریتم تعامل در صفحه دستورپخت',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1"
          >
            <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{kpi.label}</p>
            <p className="text-lg font-extrabold">{kpi.value}</p>
            <p className="text-[11px] text-[#7A7A74] dark:text-[#84847E] truncate">{kpi.meta}</p>
          </div>
        ))}
      </section>

      {/* CHART 1: RECIPE POPULARITY BAR CHART */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>نمودار محبوبیت دستورپخت‌ها</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              مقایسه پربازدیدترین دستورها بر اساس {recipeMetricLabel[recipeMetric]} · ستون برجسته نشان‌دهنده رتبه اول است
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Metric Segmented Control */}
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B]">
              {(
                [
                  {key: 'views' as RecipeMetricKey, label: 'بازدید'},
                  {key: 'avgDwellSeconds' as RecipeMetricKey, label: 'ماندگاری'},
                  {key: 'cookStarts' as RecipeMetricKey, label: 'شروع پخت'},
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setRecipeMetric(m.key)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    recipeMetric === m.key
                      ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                      : 'text-[#5C5C58] dark:text-[#A3A39E] hover:text-[#111110] dark:hover:text-[#FAFAFA]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Category Filter Buttons */}
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
              همه دسته‌ها ({toFaDigits(report.recipePopularity.length)})
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

        {filteredRecipes.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6B6B66] dark:text-[#989892]">
            داده‌ای برای این دسته ثبت نشده است. با مشاهده دستورپخت‌ها توسط کاربران، نمودار به‌صورت خودکار تکمیل می‌شود.
          </div>
        ) : (
          <div className="h-[320px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={filteredRecipes}
                margin={{top: 12, right: 16, left: 4, bottom: 32}}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
                <XAxis
                  dataKey="shortTitle"
                  tick={{fontSize: 11, fill: '#73736D'}}
                  interval={0}
                  angle={-16}
                  textAnchor="end"
                  height={56}
                  axisLine={{stroke: 'rgba(128,128,120,0.22)'}}
                  tickLine={false}
                />
                <YAxis
                  tick={{fontSize: 11, fill: '#73736D'}}
                  tickFormatter={(v) => toFaDigits(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  content={<RecipePopularityTooltip />}
                  cursor={{fill: 'rgba(169, 114, 34, 0.08)'}}
                />
                <Bar dataKey={recipeMetric} radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {filteredRecipes.map((entry, idx) => (
                    <Cell
                      key={entry.id}
                      fill={idx === 0 ? '#B54B1F' : idx === 1 ? '#A97222' : '#C99649'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* CHART 2: 24-HOUR PEAK VISIT TIMES (AREA + LINE COMPOSED CHART) */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>نمودار زمان‌های پربازدید شبانه‌روز (۲۴ ساعته)</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              نقطه اوج حضور ساعت <strong>{report.summary.peakHourLabel}</strong> · پررفت‌وآمدترین بازه سه‌ساعته:{' '}
              <strong>{report.summary.peakWindowLabel}</strong>
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F4F3EF] dark:bg-[#1E1E1B] self-start lg:self-center">
            <button
              type="button"
              onClick={() => setHourlyMode('visits_interactions')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                hourlyMode === 'visits_interactions'
                  ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                  : 'text-[#5C5C58] dark:text-[#A3A39E]'
              }`}
            >
              بازدید و تعامل ساعتی
            </button>
            <button
              type="button"
              onClick={() => setHourlyMode('avg_dwell')}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                hourlyMode === 'avg_dwell'
                  ? 'bg-[#FFFFFF] dark:bg-[#0D0D0D] text-[#111110] dark:text-[#FAFAFA] shadow-xs'
                  : 'text-[#5C5C58] dark:text-[#A3A39E]'
              }`}
            >
              میانگین ماندگاری ساعتی
            </button>
          </div>
        </div>

        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={report.peakHours} margin={{top: 16, right: 16, left: 4, bottom: 8}}>
              <defs>
                <linearGradient id="lagheliSaffronArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A97222" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#A97222" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="lagheliForestArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#15803D" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#15803D" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(128,128,120,0.18)" />
              <XAxis
                dataKey="label"
                tick={{fontSize: 11, fill: '#73736D'}}
                interval={1}
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
              <Tooltip content={<PeakHoursTooltip />} />
              <ReferenceLine
                x={report.summary.peakHourLabel}
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
              {hourlyMode === 'visits_interactions' ? (
                <>
                  <Area
                    type="monotone"
                    dataKey="visits"
                    name="بازدید"
                    stroke="#A97222"
                    strokeWidth={2.4}
                    fill="url(#lagheliSaffronArea)"
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
                  fill="url(#lagheliForestArea)"
                  activeDot={{r: 5, fill: '#15803D'}}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Clean Unboxed Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-[#5C5C58] dark:text-[#A3A39E] pt-1 border-t border-[#EFEFED] dark:border-[#242422]">
          {hourlyMode === 'visits_interactions' ? (
            <>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-1.5 rounded-sm bg-[#A97222]" />
                <span>تعداد نشست‌های فعال در هر ساعت</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="w-3 h-0.5 bg-[#B54B1F]" />
                <span>مجموع تعامل‌های رفتاری (مطالعه، کلیک، پخت)</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="w-3 h-1.5 rounded-sm bg-[#15803D]" />
              <span>میانگین مدت ماندگاری کاربران بر حسب ثانیه</span>
            </span>
          )}
        </div>
      </section>

      {/* CHARTS 3 & 4: SCROLL DEPTH & CLICK INTERVAL RHYTHM (2-COLUMN BALANCED SPLIT) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-stretch">
        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4 flex flex-col">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <ScrollText className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>توزیع عمق اسکرول در دستورپخت‌ها</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              درصد نشست‌هایی که از ابتدای دستور تا مراحل پایانی پخت پیش رفته‌اند
            </p>
          </div>
          <div className="h-[240px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.scrollDepthDistribution}
                margin={{top: 10, right: 12, left: 0, bottom: 6}}
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
                  content={<SimpleDistributionTooltip unitLabel="درصد نشست‌ها" />}
                  cursor={{fill: 'rgba(169, 114, 34, 0.08)'}}
                />
                <Bar dataKey="reachPercent" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {report.scrollDepthDistribution.map((entry) => (
                    <Cell
                      key={entry.depth}
                      fill={entry.depth >= 75 ? '#15803D' : '#A97222'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4 flex flex-col">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <MousePointerClick className="w-4 h-4 text-[#B54B1F] dark:text-[#E29A6F]" />
              <span>ریتم فواصل کلیک کاربران (Observer)</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              تفکیک سرعت تعامل از اسکن سریع مواد تا همراهی مرحله‌به‌مرحله در آشپزخانه
            </p>
          </div>
          <div className="h-[240px] w-full flex-1" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={report.clickIntervalDistribution}
                margin={{top: 10, right: 12, left: 0, bottom: 6}}
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
                  tick={{fontSize: 11, fill: '#73736D'}}
                  tickFormatter={(v) => `${toFaDigits(Number(v))}٪`}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  content={<SimpleDistributionTooltip unitLabel="درصد تعامل‌ها" />}
                  cursor={{fill: 'rgba(181, 75, 31, 0.08)'}}
                />
                <Bar dataKey="sharePercent" radius={[6, 6, 0, 0]} maxBarSize={48}>
                  {report.clickIntervalDistribution.map((entry, idx) => (
                    <Cell
                      key={entry.bucketKey}
                      fill={idx === 1 ? '#B54B1F' : idx === 2 ? '#A97222' : '#73736D'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* HIGH-DENSITY COMPARISON TABLE */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
        <div className="p-5 border-b border-[#E6E6E3] dark:border-[#282825] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
              <span>جدول تفصیلی شاخص‌های رفتاری دستورپخت‌ها</span>
            </h3>
            <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
              نمایش دقیق ماندگاری، عمق اسکرول و ریتم کلیک برای هر دستور بدون نگهداری اطلاعات هویتی کاربران
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#6B6B66] dark:text-[#989892] whitespace-nowrap">مرتب‌سازی:</span>
            <select
              value={tableSort}
              onChange={(e) => setTableSort(e.target.value as TableSortKey)}
              className="min-h-[36px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] px-2.5 text-xs font-semibold"
            >
              <option value="views">بیشترین بازدید</option>
              <option value="avgDwellSeconds">بیشترین ماندگاری</option>
              <option value="avgScrollDepthPercent">بیشترین عمق اسکرول</option>
              <option value="avgClickIntervalSec">بیشترین فاصله کلیک</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#F9F8F6] dark:bg-[#191917] text-[#6B6B66] dark:text-[#989892] border-b border-[#E6E6E3] dark:border-[#282825]">
              <tr>
                <th className="py-3 px-4 font-semibold">دستورپخت</th>
                <th className="py-3 px-4 font-semibold text-left">بازدید</th>
                <th className="py-3 px-4 font-semibold text-left">میانگین ماندگاری</th>
                <th className="py-3 px-4 font-semibold text-left">عمق اسکرول</th>
                <th className="py-3 px-4 font-semibold text-left">فاصله میانگین کلیک</th>
                <th className="py-3 px-4 font-semibold text-left">شروع آشپزی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E6E3] dark:divide-[#282825] tabular-nums">
              {sortedTableRows.map((row) => (
                <tr key={row.id} className="hover:bg-[#FAF9F7] dark:hover:bg-[#181816]">
                  <td className="py-3 px-4">
                    <div className="font-bold text-[#111110] dark:text-[#F5F5F3]">{row.title}</div>
                    <div className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
                      {row.category} · امتیاز محبوبیت {toFaDigits(row.popularityScore)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-left font-extrabold">{toFaDigits(row.views)}</td>
                  <td className="py-3 px-4 text-left font-semibold">
                    {formatDurationFa(row.avgDwellSeconds)}
                  </td>
                  <td className="py-3 px-4 text-left">{toFaDigits(row.avgScrollDepthPercent)}٪</td>
                  <td className="py-3 px-4 text-left">{toFaDigits(row.avgClickIntervalSec)} ثانیه</td>
                  <td className="py-3 px-4 text-left font-semibold text-[#15803D] dark:text-[#4ADE80]">
                    {toFaDigits(row.cookStarts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
