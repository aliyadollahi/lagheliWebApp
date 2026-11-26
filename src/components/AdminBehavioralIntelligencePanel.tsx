import {useCallback, useEffect, useState} from 'react';
import {
  Activity,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Flame,
  Gavel,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {
  ApprovedExecutiveInsightReport,
  ExecutiveBehavioralReportPayload,
} from '../shared/types.ts';

interface AdminBehavioralIntelligencePanelProps {
  onNotify: (msg: string) => void;
}

type IntelTab = 'overview' | 'attention' | 'affinities' | 'loyalty' | 'exports';

const AUDIENCE_SCOPE_LABELS: Record<ApprovedExecutiveInsightReport['audienceScope'], string> = {
  brands: 'گزارش برای برندها و شرکت‌ها',
  institutions: 'گزارش برای نهادها و پژوهش بازار',
  special_auctions: 'سیگنال تقاضا برای مزایده‌های خاص',
};

const VERDICT_META: Record<
  'high_attention' | 'moderate' | 'fast_skip',
  {label: string; tone: string}
> = {
  high_attention: {
    label: 'نقطه توجه طلایی',
    tone: 'text-[#15803D] dark:text-[#4ADE80]',
  },
  moderate: {
    label: 'توجه متعادل',
    tone: 'text-[#8C5B12] dark:text-[#ECC06E]',
  },
  fast_skip: {
    label: 'عبور سریع کاربر',
    tone: 'text-[#B91C1C] dark:text-[#F87171]',
  },
};

function formatDurationFa(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${toFaDigits(s)} ثانیه`;
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${toFaDigits(mins)} دقیقه و ${toFaDigits(rem)} ثانیه` : `${toFaDigits(mins)} دقیقه`;
}

export function AdminBehavioralIntelligencePanel({onNotify}: AdminBehavioralIntelligencePanelProps) {
  const [data, setData] = useState<ExecutiveBehavioralReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<IntelTab>('overview');

  // Anonymized Executive Report Builder state
  const [reportTitle, setReportTitle] = useState('گزارش رفتار و نقاط توجه مخاطبان لاقلی');
  const [audienceScope, setAudienceScope] =
    useState<ApprovedExecutiveInsightReport['audienceScope']>('special_auctions');
  const [publishToAuctions, setPublishToAuctions] = useState(true);
  const [creatingReport, setCreatingReport] = useState(false);

  const loadIntelligence = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest<ExecutiveBehavioralReportPayload>(
        '/api/admin/behavioral-intelligence',
        {useAdmin: true}
      );
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری اتاق هوش رفتاری ناموفق بود.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntelligence();
  }, [loadIntelligence]);

  const handleCreateApprovedReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTitle.trim()) return;
    setCreatingReport(true);
    try {
      const res = await apiRequest<{reports: ApprovedExecutiveInsightReport[]}>(
        '/api/admin/behavioral-intelligence/reports',
        {
          method: 'POST',
          useAdmin: true,
          body: JSON.stringify({
            title: reportTitle.trim(),
            audienceScope,
            publishedToAuctions: publishToAuctions,
          }),
        }
      );
      setData((prev) => (prev ? {...prev, approvedReports: res.reports} : prev));
      onNotify('گزارش تجمیعی بدون هویت توسط مدیر ارشد تایید و ثبت شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'خطا در ثبت گزارش تجمیعی.');
    } finally {
      setCreatingReport(false);
    }
  };

  const handleToggleAuctionPublish = async (report: ApprovedExecutiveInsightReport) => {
    try {
      const res = await apiRequest<{reports: ApprovedExecutiveInsightReport[]}>(
        `/api/admin/behavioral-intelligence/reports/${report.id}`,
        {
          method: 'PUT',
          useAdmin: true,
          body: JSON.stringify({publishedToAuctions: !report.publishedToAuctions}),
        }
      );
      setData((prev) => (prev ? {...prev, approvedReports: res.reports} : prev));
      onNotify(
        !report.publishedToAuctions
          ? 'شاخص تجمیعی در اتاق مزایده هوشمند برندها منتشر شد.'
          : 'انتشار این شاخص در اتاق مزایده متوقف شد.'
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'تغییر وضعیت انتشار ناموفق بود.');
    }
  };

  const handleDeleteReport = async (id: string) => {
    try {
      const res = await apiRequest<{reports: ApprovedExecutiveInsightReport[]}>(
        `/api/admin/behavioral-intelligence/reports/${id}`,
        {method: 'DELETE', useAdmin: true}
      );
      setData((prev) => (prev ? {...prev, approvedReports: res.reports} : prev));
      onNotify('گزارش تجمیعی حذف شد.');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'حذف گزارش ناموفق بود.');
    }
  };

  const handleDownloadReportCsv = (report: ApprovedExecutiveInsightReport) => {
    const rows = [
      ['عنوان گزارش', report.title],
      ['دامنه مخاطب', AUDIENCE_SCOPE_LABELS[report.audienceScope]],
      ['تاییدکننده', report.approvedBy],
      ['تعداد نشست تحلیل‌شده', String(report.summary.totalSessionsAnalyzed)],
      ['سهم موبایل (درصد)', String(report.summary.mobileSharePercent)],
      ['بازه ساعت اوج', report.summary.peakHourRange],
      ['میانگین مکث نشست (ثانیه)', String(report.summary.avgDwellSeconds)],
      ['طولانی‌ترین نشست (دقیقه)', String(report.summary.longestSessionMinutes)],
      ['نرخ رسیدن به عمق ۷۵٪ اسکرول (درصد)', String(report.summary.scroll75ReachPercent)],
      ['سهم کاربران دارای رژیم غذایی مشخص (درصد)', String(report.summary.dietaryRestrictionSharePercent)],
      ['بهترین نقطه توجه', report.summary.bestAttentionSlot],
      ['قالب پیشنهادی تبلیغ', report.summary.recommendedAdFormat],
    ];
    const csv = '\uFEFF' + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lagheli-anonymized-report-${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('فایل گزارش تجمیعی بدون هویت (CSV) آماده دانلود شد.');
  };

  const handleDownloadReportJson = (report: ApprovedExecutiveInsightReport) => {
    const safePayload = {
      reportId: report.id,
      title: report.title,
      audienceScope: report.audienceScope,
      approvedBy: report.approvedBy,
      generatedAt: report.createdAt,
      privacyNotice: 'گزارش کاملاً تجمیعی و بدون اطلاعات هویتی افراد (تاییدشده در سوپرپنل مدیر ارشد لاقلی)',
      aggregateMetrics: report.summary,
    };
    const blob = new Blob([JSON.stringify(safePayload, null, 2)], {type: 'application/json;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lagheli-anonymized-report-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onNotify('فایل استاندارد گزارش (JSON) دانلود شد.');
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center text-xs text-[#6B6B66] dark:text-[#A3A39E]">
        در حال تحلیل نشست‌های رفتاری، الگوی توجه و شاخص‌های وفاداری کاربران...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-8 text-center space-y-3">
        <p className="text-sm font-bold text-[#B91C1C] dark:text-[#F87171]">
          {error || 'امکان دریافت داده‌های هوش رفتاری وجود ندارد.'}
        </p>
        <button
          type="button"
          onClick={loadIntelligence}
          className="min-h-[40px] px-4 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  const maxHourVisits = Math.max(1, ...data.temporal.hourlyHeatmap.map((h) => h.visits));

  return (
    <div className="space-y-6">
      {/* Executive Command Header */}
      <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#A97222] dark:text-[#D8A85B]">
            دسترسی انحصاری مدیر ارشد سیستم · داده‌های خام غیرقابل‌مشاهده برای برندها و کاربران
          </div>
          <h2 className="text-lg font-extrabold">
            اتاق هوش رفتاری، شناخت عمیق کاربر و هدف‌گیری ایمن اکوسیستم
          </h2>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            پایش واقعی دستگاه، زمان حضور، عمق اسکرول، عبور سریع، علاقه‌مندی‌های خاموش و حفاظت قطعی رژیمی برای تصمیم‌گیری کلان و گزارش‌دهی تجمیعی.
          </p>
        </div>

        <button
          type="button"
          onClick={loadIntelligence}
          disabled={loading}
          className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2A2A27] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap self-start lg:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی تحلیل زنده</span>
        </button>
      </section>

      {/* Top Executive KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-6 gap-3 tabular-nums">
        {[
          {
            label: 'نشست‌های تحلیل‌شده',
            value: toFaDigits(data.overview.totalTrackedSessions),
            hint: `${toFaDigits(data.overview.uniqueSubjectsCount)} مخاطب یکتا`,
          },
          {
            label: 'میانگین حضور هر نشست',
            value: formatDurationFa(data.overview.avgSessionDurationSeconds),
            hint: `اوج حضور: ${data.temporal.peakWindowLabel}`,
          },
          {
            label: 'طولانی‌ترین بازه پیوسته',
            value: formatDurationFa(data.overview.longestSessionSeconds),
            hint: 'بیشترین غرق‌شدن در دستورپخت',
          },
          {
            label: 'نرخ بازگشت مخاطب',
            value: `${toFaDigits(data.overview.returningRatePercent)}٪`,
            hint: `${toFaDigits(data.overview.totalEventsRecorded)} رویداد رفتاری`,
          },
          {
            label: 'تبلیغ ناسازگار مسدودشده',
            value: toFaDigits(data.overview.dietSafeBlockedAdsCount),
            hint: 'حفاظت قطعی رژیم کاربران',
          },
          {
            label: 'آمادگی تخمینی اشتراک',
            value: `${toFaDigits(data.loyaltyAndSubscriptionRadar.subscriptionReadinessPercent)}٪`,
            hint: 'فاز رصد پیش از طرح مستقل',
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-4 space-y-1"
          >
            <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{kpi.label}</p>
            <p className="text-lg font-extrabold">{kpi.value}</p>
            <p className="text-[11px] text-[#7A7A74] dark:text-[#84847E] truncate">{kpi.hint}</p>
          </div>
        ))}
      </section>

      {/* Segmented Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#E6E6E3] dark:border-[#282825] pb-3">
        {[
          {id: 'overview' as IntelTab, label: 'دستگاه‌ها و محیط کاربری', icon: Smartphone},
          {id: 'attention' as IntelTab, label: 'زمان اوج، اسکرول و نقاط پرش', icon: Activity},
          {id: 'affinities' as IntelTab, label: 'علاقه‌مندی خاموش و حفاظت رژیمی', icon: ShieldCheck},
          {id: 'loyalty' as IntelTab, label: 'وفاداری و رادار اشتراک', icon: Flame},
          {id: 'exports' as IntelTab, label: 'گزارش تجمیعی برای برندها و مزایده', icon: FileSpreadsheet},
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                active
                  ? 'bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B]'
                  : 'bg-[#FFFFFF] dark:bg-[#151514] border border-[#E6E6E3] dark:border-[#282825] text-[#5C5C58] dark:text-[#A3A39E]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: DEVICES & ENVIRONMENT */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold">تفکیک نوع دستگاه کاربران</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                تعیین قالب استاندارد بنرها و تراکم نمایش برای موبایل، تبلت و دسکتاپ
              </p>
            </div>
            <div className="space-y-3 tabular-nums">
              {data.devices.byType.map((d) => (
                <div key={d.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{d.label}</span>
                    <span className="text-[#5C5C58] dark:text-[#A3A39E]">
                      {toFaDigits(d.count)} نشست · <strong>{toFaDigits(d.percent)}٪</strong>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#EFEFED] dark:bg-[#232320] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#A97222] dark:bg-[#D8A85B]"
                      style={{width: `${Math.max(4, d.percent)}%`}}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E6E6E3] dark:border-[#282825] text-xs tabular-nums">
              <div>
                <span className="text-[#6B6B66] dark:text-[#989892] block">نصب‌شده به‌صورت وب‌اپ (PWA)</span>
                <strong className="text-base font-extrabold">{toFaDigits(data.devices.pwaSharePercent)}٪</strong>
              </div>
              <div>
                <span className="text-[#6B6B66] dark:text-[#989892] block">استفاده از حالت تاریک</span>
                <strong className="text-base font-extrabold">{toFaDigits(data.devices.darkThemeSharePercent)}٪</strong>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold">سیستم‌عامل و روزهای مراجعه</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                شناخت دقیق سهم اندروید، آیفون و دسکتاپ در کنار رفتار وسط هفته در برابر آخر هفته
              </p>
            </div>
            <div className="space-y-2.5 tabular-nums">
              {data.devices.byOs.map((os) => (
                <div key={os.key} className="flex items-center justify-between text-xs py-1.5 border-b border-[#EFEFED] dark:border-[#222220] last:border-0">
                  <span className="font-semibold">{os.label}</span>
                  <span className="text-[#5C5C58] dark:text-[#A3A39E]">
                    {toFaDigits(os.count)} نشست ({toFaDigits(os.percent)}٪)
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E6E6E3] dark:border-[#282825] text-xs tabular-nums">
              <div>
                <span className="text-[#6B6B66] dark:text-[#989892] block">روزهای عادی هفته</span>
                <strong className="text-base font-extrabold">{toFaDigits(data.temporal.weekdayVsWeekend.weekdayPercent)}٪</strong>
              </div>
              <div>
                <span className="text-[#6B6B66] dark:text-[#989892] block">پنج‌شنبه و جمعه (پخت مجلسی)</span>
                <strong className="text-base font-extrabold">{toFaDigits(data.temporal.weekdayVsWeekend.weekendPercent)}٪</strong>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: TEMPORAL HEATMAP & ATTENTION PHYSICS (SCROLL + FAST SKIP) */}
      {tab === 'attention' && (
        <div className="space-y-5">
          {/* 24-Hour Peak Visit Heatmap */}
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
                  <span>نقشه ساعتی مراجعه کاربران (۲۴ ساعت شبانه‌روز)</span>
                </h3>
                <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                  بیشترین تراکم مراجعه و مکث در بازه <strong>{data.temporal.peakWindowLabel}</strong> ثبت شده است.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 tabular-nums">
              {data.temporal.hourlyHeatmap.map((h) => {
                const intensity = h.visits / maxHourVisits;
                const barHeight = Math.max(12, Math.round(intensity * 64));
                return (
                  <div
                    key={h.hour}
                    title={`ساعت ${h.label}: ${toFaDigits(h.visits)} مراجعه · میانگین ${formatDurationFa(h.avgDwellSeconds)}`}
                    className="rounded-xl border border-[#EFEFED] dark:border-[#242422] bg-[#FAF9F7] dark:bg-[#10100F] p-2 flex flex-col items-center justify-end gap-1.5 h-24"
                  >
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        className={`w-3.5 rounded-t-md transition-all ${
                          intensity >= 0.7
                            ? 'bg-[#B54B1F] dark:bg-[#E29A6F]'
                            : intensity >= 0.35
                              ? 'bg-[#A97222] dark:bg-[#D8A85B]'
                              : 'bg-[#D8D6CF] dark:bg-[#32322E]'
                        }`}
                        style={{height: `${barHeight}px`}}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-[#5C5C58] dark:text-[#A3A39E]">
                      {toFaDigits(String(h.hour).padStart(2, '0'))}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Scroll Depth Funnel */}
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="space-y-0.5">
              <h3 className="text-sm font-extrabold">قیف عمق اسکرول کاربران</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                نشان می‌دهد چند درصد از نشست‌ها تا میانه و انتهای صفحه پیش می‌روند تا جایگاه تبلیغ دقیقاً در ناحیه دید واقعی قرار گیرد.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 tabular-nums">
              {data.attentionPhysics.scrollFunnel.map((s) => (
                <div
                  key={s.depth}
                  className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] p-4 space-y-2"
                >
                  <p className="text-xs font-bold">{s.label}</p>
                  <p className="text-2xl font-extrabold text-[#A97222] dark:text-[#D8A85B]">
                    {toFaDigits(s.reachPercent)}٪
                  </p>
                  <div className="h-1.5 rounded-full bg-[#E6E6E3] dark:bg-[#262624] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#A97222] dark:bg-[#D8A85B]"
                      style={{width: `${s.reachPercent}%`}}
                    />
                  </div>
                  <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
                    {toFaDigits(s.sessionsCount)} نشست به این عمق رسیده‌اند
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section Attention & Fast-Skip Matrix */}
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
            <div className="p-5 border-b border-[#E6E6E3] dark:border-[#282825]">
              <h3 className="text-sm font-extrabold">ماتریس نقاط مکث، کلیک و عبور سریع از بخش‌ها</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                بخش‌هایی که کاربر سریع از آن‌ها می‌گذرد در برابر نقاطی که مکث عمیق و کلیک واقعی ثبت می‌شود
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#F9F8F6] dark:bg-[#191917] text-[#6B6B66] dark:text-[#989892] border-b border-[#E6E6E3] dark:border-[#282825]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">بخش اپلیکیشن</th>
                    <th className="py-3 px-4 font-semibold text-left">میانگین مکث</th>
                    <th className="py-3 px-4 font-semibold text-left">نرخ عبور سریع</th>
                    <th className="py-3 px-4 font-semibold text-left">نرخ تعامل</th>
                    <th className="py-3 px-4 font-semibold">وضعیت توجه</th>
                    <th className="py-3 px-4 font-semibold">جایگاه پیشنهادی تبلیغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E3] dark:divide-[#282825] tabular-nums">
                  {data.attentionPhysics.sectionZones.map((zone) => {
                    const verdict = VERDICT_META[zone.attentionVerdict];
                    return (
                      <tr key={zone.sectionKey} className="hover:bg-[#FAF9F7] dark:hover:bg-[#181816]">
                        <td className="py-3 px-4 font-bold">{zone.sectionLabel}</td>
                        <td className="py-3 px-4 text-left font-semibold">
                          {formatDurationFa(zone.avgDwellSeconds)}
                        </td>
                        <td className="py-3 px-4 text-left">{toFaDigits(zone.fastSkipPercent)}٪</td>
                        <td className="py-3 px-4 text-left">{toFaDigits(zone.interactionRatePercent)}٪</td>
                        <td className={`py-3 px-4 font-bold ${verdict.tone}`}>{verdict.label}</td>
                        <td className="py-3 px-4 text-[#5C5C58] dark:text-[#A3A39E] max-w-xs">
                          {zone.recommendedAdPlacement}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: PASSIVE AFFINITIES & DIET-SAFE HARD-BLOCKING */}
      {tab === 'affinities' && (
        <div className="space-y-5">
          {/* Diet-Safe Guardrail Audit */}
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                  <span>سپر قطعی حفاظت رژیمی در نمایش تبلیغات و رستوران‌ها</span>
                </h3>
                <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                  موتور هدف‌گیری هر تبلیغ ناسازگار (مانند گوشت، سوسیس یا لبنیات برای کاربران وگان) را پیش از نمایش به‌طور قطعی مسدود می‌کند.
                </p>
              </div>
              <div className="text-xs font-bold text-[#15803D] dark:text-[#4ADE80] tabular-nums">
                {toFaDigits(data.dietarySafety.strictExclusionEnabledSubjects)} پروفایل دارای فیلتر رژیمی ·{' '}
                {toFaDigits(data.dietarySafety.hardBlockedIncompatibleViews)} نمایش ناسازگار مسدودشده
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#E6E6E3] dark:border-[#282825]">
              <div className="space-y-2.5 tabular-nums">
                <p className="text-xs font-bold text-[#5C5C58] dark:text-[#A3A39E]">سهم رژیم‌های ثبت‌شده کاربران</p>
                {data.dietarySafety.dietBreakdown.length === 0 ? (
                  <p className="text-xs text-[#7A7A74]">هنوز رژیم خاصی ثبت نشده است.</p>
                ) : (
                  data.dietarySafety.dietBreakdown.map((d) => (
                    <div key={d.dietId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold">{d.label}</span>
                        <span>
                          {toFaDigits(d.count)} نفر ({toFaDigits(d.percent)}٪)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EFEFED] dark:bg-[#232320] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#15803D] dark:bg-[#4ADE80]"
                          style={{width: `${Math.max(5, d.percent)}%`}}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2.5 tabular-nums">
                <p className="text-xs font-bold text-[#5C5C58] dark:text-[#A3A39E]">
                  پرتکرارترین مواد حذف‌شده توسط کاربران (برای منع نمایش تبلیغ)
                </p>
                <div className="divide-y divide-[#EFEFED] dark:divide-[#222220] text-xs">
                  {data.dietarySafety.topExcludedKeywords.map((kw) => (
                    <div key={kw.keyword} className="py-2 flex items-center justify-between">
                      <span className="font-semibold">{kw.keyword}</span>
                      <span className="text-[#6B6B66] dark:text-[#989892]">{toFaDigits(kw.count)} کاربر حذف کرده‌اند</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Passive Favorites (Without Like or Follow) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-3">
              <h3 className="text-sm font-extrabold inline-flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
                <span>محبوب‌ترین دستورپخت‌ها بر اساس بازدید خاموش و مکث</span>
              </h3>
              <div className="divide-y divide-[#EFEFED] dark:divide-[#222220] text-xs tabular-nums">
                {data.passiveAffinities.topRecipes.map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{r.label}</p>
                      <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">
                        دسته {r.category} · {toFaDigits(r.cookStarts)} شروع آشپزی
                      </p>
                    </div>
                    <div className="text-left shrink-0">
                      <p className="font-extrabold">{toFaDigits(r.passiveViews)} بازدید</p>
                      <p className="text-[11px] text-[#7A7A74]">{formatDurationFa(r.avgDwellSeconds)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
              <div className="space-y-2.5">
                <h3 className="text-sm font-extrabold">برندهای مورد توجه (حتی بدون دنبال‌کردن)</h3>
                <div className="divide-y divide-[#EFEFED] dark:divide-[#222220] text-xs tabular-nums">
                  {data.passiveAffinities.topBrands.map((b) => (
                    <div key={b.id} className="py-2 flex items-center justify-between">
                      <span className="font-bold">{b.label}</span>
                      <span className="text-[#5C5C58] dark:text-[#A3A39E]">
                        {toFaDigits(b.passiveViews)} بازدید صفحه · {toFaDigits(b.clicks)} کلیک
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 pt-3 border-t border-[#E6E6E3] dark:border-[#282825]">
                <h3 className="text-sm font-extrabold">رستوران‌ها و کافه‌های پربازدید</h3>
                <div className="divide-y divide-[#EFEFED] dark:divide-[#222220] text-xs tabular-nums">
                  {data.passiveAffinities.topVenues.map((v) => (
                    <div key={v.id} className="py-2 flex items-center justify-between">
                      <span className="font-bold">{v.label}</span>
                      <span className="text-[#5C5C58] dark:text-[#A3A39E]">{toFaDigits(v.passiveViews)} بازدید مکانی</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* TAB 4: LOYALTY, COOKING PARTICIPATION & SUBSCRIPTION READINESS RADAR */}
      {tab === 'loyalty' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <p className="text-xs font-bold text-[#A97222] dark:text-[#D8A85B]">
                  رادار آمادگی اشتراک (فاز تحلیل داده پیش از طراحی طرح مستقل اشتراک)
                </p>
                <h3 className="text-base font-extrabold">
                  سنجش وفاداری آشپزی، مشارکت واقعی و ظرفیت بالقوه اشتراک کاربری
                </h3>
                <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                  {data.loyaltyAndSubscriptionRadar.nextPhaseNote}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center tabular-nums shrink-0">
                <div>
                  <span className="text-[11px] text-[#6B6B66] block">امتیاز وفاداری</span>
                  <strong className="text-xl font-extrabold">
                    {toFaDigits(data.loyaltyAndSubscriptionRadar.averageLoyaltyScore)} از ۱۰۰
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B66] block">آشپزی فعال</span>
                  <strong className="text-xl font-extrabold">
                    {toFaDigits(data.loyaltyAndSubscriptionRadar.activeCookingRatioPercent)}٪
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B6B66] block">آماده اشتراک</span>
                  <strong className="text-xl font-extrabold text-[#15803D] dark:text-[#4ADE80]">
                    {toFaDigits(data.loyaltyAndSubscriptionRadar.subscriptionReadinessPercent)}٪
                  </strong>
                </div>
              </div>
            </div>

            {/* Personas Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-[#E6E6E3] dark:border-[#282825] tabular-nums">
              {data.loyaltyAndSubscriptionRadar.personas.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FAF9F7] dark:bg-[#10100F] p-4 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">{p.label}</span>
                    <span className="text-xs font-bold text-[#A97222] dark:text-[#D8A85B]">
                      {toFaDigits(p.sharePercent)}٪ ({toFaDigits(p.usersCount)} نفر)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">{p.description}</p>
                  <p className="text-[11px] font-semibold text-[#6B6B66] dark:text-[#989892]">
                    تناسب برای اشتراک آینده:{' '}
                    {p.subscriptionFit === 'high'
                      ? 'بسیار بالا (هدف اصلی)'
                      : p.subscriptionFit === 'medium'
                        ? 'متوسط (با بسته فصلی)'
                        : 'مناسب درآمدزایی تبلیغاتی بومی'}
                  </p>
                </div>
              ))}
            </div>

            {/* Future Subscription Value Signals */}
            <div className="space-y-3 pt-3 border-t border-[#E6E6E3] dark:border-[#282825]">
              <h4 className="text-xs font-extrabold inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#A97222] dark:text-[#D8A85B]" />
                <span>ستون‌های ارزشی پیشنهادی برای طرح مستقل آینده اشتراک</span>
              </h4>
              <div className="space-y-2.5 tabular-nums">
                {data.loyaltyAndSubscriptionRadar.futureValueSignals.map((sig) => (
                  <div key={sig.featureLabel} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{sig.featureLabel}</span>
                      <span className="font-extrabold text-[#A97222] dark:text-[#D8A85B]">
                        کشش تقاضا: {toFaDigits(sig.demandScorePercent)}٪
                      </span>
                    </div>
                    <p className="text-[11px] text-[#6B6B66] dark:text-[#989892]">{sig.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: ANONYMIZED EXECUTIVE REPORT GENERATOR & AUCTION DEMAND PUBLISH */}
      {tab === 'exports' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleCreateApprovedReport}
            className="lg:col-span-5 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] p-5 space-y-4"
          >
            <div className="space-y-1">
              <h3 className="text-sm font-extrabold">صدور گزارش تجمیعی بدون هویت با تایید مدیر ارشد</h3>
              <p className="text-xs text-[#6B6B66] dark:text-[#989892] leading-relaxed">
                این گزارش هیچ‌گونه نام، شماره تماس یا شناسه فردی ندارد و صرفاً شاخص‌های درصدی و جمعی را برای برندها، نهادها یا مزایده‌های خاص تولید می‌کند.
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">عنوان رسمی گزارش</span>
              <input
                type="text"
                required
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">مخاطب هدف گزارش</span>
              <select
                value={audienceScope}
                onChange={(e) =>
                  setAudienceScope(e.target.value as ApprovedExecutiveInsightReport['audienceScope'])
                }
                className="w-full min-h-[42px] rounded-xl border border-[#E6E6E3] dark:border-[#282825] bg-[#F9F8F6] dark:bg-[#10100F] px-3 text-xs"
              >
                <option value="special_auctions">سیگنال تقاضا برای اتاق مزایده هوشمند برندها</option>
                <option value="brands">ارائه تحلیلی به برندها و شرکت‌های همکار</option>
                <option value="institutions">گزارش کلان برای نهادها و پژوهش‌های بازار غذا</option>
              </select>
            </label>

            <label className="flex items-center gap-2.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={publishToAuctions}
                onChange={(e) => setPublishToAuctions(e.target.checked)}
                className="w-4 h-4 accent-[#A97222]"
              />
              <span>انتشار خلاصه تجمیعی در پنل «مزایده هوشمند» برندها</span>
            </label>

            <button
              type="submit"
              disabled={creatingReport}
              className="w-full min-h-[44px] rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-white dark:text-[#0B0B0B] text-xs font-bold disabled:opacity-50"
            >
              {creatingReport ? 'در حال ثبت گزارش...' : 'تایید و تولید گزارش بدون هویت'}
            </button>
          </form>

          <section className="lg:col-span-7 rounded-2xl border border-[#E6E6E3] dark:border-[#282825] bg-[#FFFFFF] dark:bg-[#151514] overflow-hidden">
            <div className="p-5 border-b border-[#E6E6E3] dark:border-[#282825] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold">بایگانی گزارش‌های تاییدشده مدیر ارشد</h3>
                <p className="text-xs text-[#6B6B66] dark:text-[#989892]">
                  قابل دانلود در قالب CSV / JSON یا انتشار کنترل‌شده در اتاق مزایده هوشمند
                </p>
              </div>
              <Users className="w-4 h-4 text-[#A97222] dark:text-[#D8A85B]" />
            </div>

            {data.approvedReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B6B66] dark:text-[#989892]">
                هنوز گزارش تجمیعی تاییدشده‌ای تولید نشده است.
              </div>
            ) : (
              <div className="divide-y divide-[#E6E6E3] dark:divide-[#282825]">
                {data.approvedReports.map((rep) => (
                  <div key={rep.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
                          {AUDIENCE_SCOPE_LABELS[rep.audienceScope]} · تاییدشده توسط {rep.approvedBy}
                        </p>
                        <h4 className="text-sm font-extrabold">{rep.title}</h4>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleAuctionPublish(rep)}
                          className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap ${
                            rep.publishedToAuctions
                              ? 'border-[#15803D] text-[#15803D] dark:text-[#4ADE80]'
                              : 'border-[#E6E6E3] dark:border-[#2A2A27] text-[#5C5C58] dark:text-[#A3A39E]'
                          }`}
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          <span>{rep.publishedToAuctions ? 'منتشر در مزایده' : 'انتشار در مزایده'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadReportCsv(rep)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#2A2A27] text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadReportJson(rep)}
                          className="min-h-[34px] px-2.5 rounded-lg border border-[#E6E6E3] dark:border-[#2A2A27] text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>JSON</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(rep.id)}
                          aria-label="حذف گزارش"
                          className="min-h-[34px] px-2 rounded-lg border border-[#E6E6E3] dark:border-[#2A2A27] text-[#B91C1C] dark:text-[#F87171]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[#5C5C58] dark:text-[#A3A39E] tabular-nums">
                      <div>
                        سهم موبایل: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{toFaDigits(rep.summary.mobileSharePercent)}٪</strong>
                      </div>
                      <div>
                        ساعت اوج: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{rep.summary.peakHourRange}</strong>
                      </div>
                      <div>
                        عمق ۷۵٪ اسکرول: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{toFaDigits(rep.summary.scroll75ReachPercent)}٪</strong>
                      </div>
                      <div>
                        رژیم فعال: <strong className="text-[#0D0D0D] dark:text-[#FAFAFA]">{toFaDigits(rep.summary.dietaryRestrictionSharePercent)}٪</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
