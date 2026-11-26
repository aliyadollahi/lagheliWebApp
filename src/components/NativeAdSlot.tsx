import {useEffect, useRef} from 'react';
import {ArrowUpLeft} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {buildTrackedAdUrl} from '../shared/nativeAdEngine.ts';
import type {NativeAdUnit, Partner} from '../shared/types.ts';

interface NativeAdSlotProps {
  ad: NativeAdUnit;
  disclosureLabel?: string;
  partners?: Partner[];
  onOpenPartner?: (partner: Partner) => void;
  className?: string;
}

export function NativeAdSlot({
  ad,
  disclosureLabel = 'همکار منتخب لاقلی',
  partners = [],
  onOpenPartner,
  className = '',
}: NativeAdSlotProps) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const impressionSentRef = useRef(false);

  useEffect(() => {
    impressionSentRef.current = false;
  }, [ad.id]);

  useEffect(() => {
    const el = slotRef.current;
    if (!el || impressionSentRef.current) return;

    const sendImpression = () => {
      if (impressionSentRef.current) return;
      impressionSentRef.current = true;
      apiRequest(`/api/native-ads/${ad.id}/event`, {
        method: 'POST',
        body: JSON.stringify({type: 'impression'}),
      }).catch(() => {});
    };

    if (typeof IntersectionObserver === 'undefined') {
      sendImpression();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          sendImpression();
          observer.disconnect();
        }
      },
      {threshold: 0.35}
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ad.id]);

  const trackedExternalUrl = buildTrackedAdUrl(
    ad.targetUrl,
    ad.utmSource || 'lagheli',
    ad.utmMedium || ad.mediaType || ad.format,
    ad.utmCampaign || `ad_${ad.id}`
  );
  const linkedPartner = partners.find((p) => p.id === ad.partnerId);
  // Prioritize direct tracked UTM link for explicit click/banner campaigns with targetUrl; otherwise open in-app partner sheet
  const preferExternalLink = Boolean(trackedExternalUrl && (ad.mediaType === 'click' || ad.utmCampaign || !linkedPartner));
  const externalSafeUrl = preferExternalLink ? trackedExternalUrl : undefined;

  const handleTrackClick = () => {
    apiRequest(`/api/native-ads/${ad.id}/event`, {
      method: 'POST',
      body: JSON.stringify({type: 'click'}),
    }).catch(() => {});
  };

  const handleClick = () => {
    handleTrackClick();
    if (!preferExternalLink && linkedPartner && onOpenPartner) {
      onOpenPartner(linkedPartner);
      return;
    }
    if (trackedExternalUrl) {
      window.location.assign(trackedExternalUrl);
    } else if (linkedPartner && onOpenPartner) {
      onOpenPartner(linkedPartner);
    }
  };

  // Format 1: Ultra-subtle 1-line inline text or click whisper right beneath a matching recipe ingredient
  if (ad.format === 'inline_ingredient') {
    return (
      <div
        ref={slotRef}
        className={`mt-1.5 pt-1.5 border-t border-[#E6E6E3]/60 dark:border-[#242422] flex flex-wrap items-center justify-between gap-2 text-[11px] leading-relaxed ${className}`}
      >
        <div className="min-w-0 text-[#5C5C58] dark:text-[#A3A39E]">
          <span className="text-[#8E8E89] dark:text-[#787872]">{disclosureLabel}</span>
          <span aria-hidden="true" className="mx-1.5 opacity-50">
            ·
          </span>
          <span className="font-semibold text-[#1A1A18] dark:text-[#EDEDEB]">{ad.title}</span>
          {ad.subtitle && (
            <>
              <span aria-hidden="true" className="mx-1.5 opacity-50">
                —
              </span>
              <span>{ad.subtitle}</span>
            </>
          )}
        </div>
        {externalSafeUrl ? (
          <a
            href={externalSafeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="text-[11px] font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline inline-flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>{ad.ctaLabel}</span>
            <ArrowUpLeft className="w-3 h-3" />
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="text-[11px] font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline inline-flex items-center gap-0.5 whitespace-nowrap shrink-0"
          >
            <span>{ad.ctaLabel}</span>
            <ArrowUpLeft className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // Format 2: Calm contextual note inside Recipe Tools or Substitution section
  if (ad.format === 'contextual_tool') {
    return (
      <div
        ref={slotRef}
        className={`rounded-2xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FAF9F7] dark:bg-[#141413] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
      >
        <div className="space-y-1 min-w-0">
          <div className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
            <span>{disclosureLabel}</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>{ad.partnerName}</span>
          </div>
          <p className="text-xs sm:text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{ad.title}</p>
          {(ad.editorialCopy || ad.subtitle) && (
            <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
              {ad.editorialCopy || ad.subtitle}
            </p>
          )}
        </div>
        {externalSafeUrl ? (
          <a
            href={externalSafeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#1B1B19] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>{ad.ctaLabel}</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            className="min-h-[40px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#1B1B19] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <span>{ad.ctaLabel}</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Format 3: Editorial Brand Story Card harmonizing seamlessly inside the recipe grid
  if (ad.format === 'feed_editorial_story') {
    return (
      <article
        ref={slotRef}
        aria-label={`یادداشت برند همکار: ${ad.title}`}
        className={`col-span-full rounded-2xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#141413] p-5 sm:p-6 transition-colors ${className}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="text-xs text-[#7A7A74] dark:text-[#989892]">
              <span>{disclosureLabel}</span>
              <span aria-hidden="true" className="mx-2">
                ·
              </span>
              <span>{ad.partnerName}</span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] leading-snug text-balance">
              {ad.title}
            </h3>
            {ad.subtitle && (
              <p className="text-xs font-medium text-[#5C5C58] dark:text-[#A3A39E]">{ad.subtitle}</p>
            )}
            {ad.editorialCopy && (
              <p className="text-xs sm:text-sm text-[#4A4A46] dark:text-[#B5B5B0] leading-relaxed">
                {ad.editorialCopy}
              </p>
            )}
          </div>

          {externalSafeUrl ? (
            <a
              href={externalSafeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleClick}
              className="min-h-[44px] px-5 rounded-xl border border-[#0D0D0D] dark:border-[#FAFAFA] text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#0D0D0D] hover:text-[#FFFFFF] dark:hover:bg-[#FAFAFA] dark:hover:text-[#0B0B0B] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>{ad.ctaLabel}</span>
              <ArrowUpLeft className="w-4 h-4" />
            </a>
          ) : (
            <button
              type="button"
              onClick={handleClick}
              className="min-h-[44px] px-5 rounded-xl border border-[#0D0D0D] dark:border-[#FAFAFA] text-[#0D0D0D] dark:text-[#FAFAFA] hover:bg-[#0D0D0D] hover:text-[#FFFFFF] dark:hover:bg-[#FAFAFA] dark:hover:text-[#0B0B0B] text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <span>{ad.ctaLabel}</span>
              <ArrowUpLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </article>
    );
  }

  // Format 4: Quiet Pantry / Fridge / Shopping List Companion Strip
  return (
    <aside
      ref={slotRef}
      aria-label={`پیشنهاد همکار: ${ad.title}`}
      className={`rounded-2xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#141413] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
    >
      <div className="space-y-1 min-w-0">
        <div className="text-[11px] text-[#7A7A74] dark:text-[#989892]">
          <span>{disclosureLabel}</span>
          <span aria-hidden="true" className="mx-1.5">
            ·
          </span>
          <span>{ad.partnerName}</span>
        </div>
        <h3 className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{ad.title}</h3>
        {(ad.editorialCopy || ad.subtitle) && (
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
            {ad.editorialCopy || ad.subtitle}
          </p>
        )}
      </div>

      {externalSafeUrl ? (
        <a
          href={externalSafeUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
          className="min-h-[42px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <span>{ad.ctaLabel}</span>
          <ArrowUpLeft className="w-3.5 h-3.5" />
        </a>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="min-h-[42px] px-4 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
        >
          <span>{ad.ctaLabel}</span>
          <ArrowUpLeft className="w-3.5 h-3.5" />
        </button>
      )}
    </aside>
  );
}
