import {useEffect, useRef} from 'react';
import {ArrowUpLeft} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {buildTrackedAdUrl} from '../shared/nativeAdEngine.ts';
import type {FlagshipSponsorship, Partner} from '../shared/types.ts';

interface FlagshipSponsorProps {
  sponsorship: FlagshipSponsorship | null;
  enabled?: boolean;
  partners?: Partner[];
  onOpenPartner?: (partner: Partner) => void;
}

function useFlagshipImpression(sponsorshipId?: string) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    sentRef.current = false;
  }, [sponsorshipId]);

  useEffect(() => {
    if (!sponsorshipId || !ref.current || sentRef.current) return;
    const send = () => {
      if (sentRef.current) return;
      sentRef.current = true;
      apiRequest(`/api/ads/flagship/${sponsorshipId}/event`, {
        method: 'POST',
        body: JSON.stringify({type: 'impression'}),
      }).catch(() => {});
    };

    if (typeof IntersectionObserver === 'undefined') {
      send();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          send();
          observer.disconnect();
        }
      },
      {threshold: 0.4}
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [sponsorshipId]);

  return ref;
}

/**
 * Ultra-slim, serene top sponsorship strip ("قدرت گرفته از ...") rendered above the header.
 * Intentionally non-sticky so it never encroaches on the mobile viewport sticky budget.
 */
export function FlagshipTopStrip({
  sponsorship,
  enabled = true,
  partners = [],
  onOpenPartner,
}: FlagshipSponsorProps) {
  const stripRef = useFlagshipImpression(enabled ? sponsorship?.id : undefined);

  if (!enabled || !sponsorship || sponsorship.status !== 'active') return null;

  const trackedUrl = buildTrackedAdUrl(
    sponsorship.targetUrl,
    'lagheli',
    'flagship_top',
    sponsorship.utmCampaign || `powered_by_${sponsorship.duration}`
  );
  const linkedPartner = partners.find((p) => p.id === sponsorship.partnerId);

  const handleTrackClick = () => {
    apiRequest(`/api/ads/flagship/${sponsorship.id}/event`, {
      method: 'POST',
      body: JSON.stringify({type: 'click'}),
    }).catch(() => {});
    if (linkedPartner && onOpenPartner) {
      onOpenPartner(linkedPartner);
    }
  };

  return (
    <div
      ref={stripRef}
      role="region"
      aria-label={`حامی ویژه لاقلی: ${sponsorship.partnerName}`}
      className="w-full border-b border-[#E6E6E3]/80 dark:border-[#1E1E1C] bg-[#F3F2EE] dark:bg-[#111110]"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4 text-[11px] sm:text-xs text-[#52524E] dark:text-[#A3A39E]">
        <div className="flex items-center gap-2 min-w-0 truncate">
          <span className="text-[#787872] dark:text-[#84847E] whitespace-nowrap shrink-0">قدرت گرفته از</span>
          <strong className="font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA] whitespace-nowrap shrink-0">
            {sponsorship.partnerName}
          </strong>
          {sponsorship.tagline && (
            <>
              <span aria-hidden="true" className="hidden sm:inline opacity-40">
                ·
              </span>
              <span className="hidden sm:inline truncate">{sponsorship.tagline}</span>
            </>
          )}
        </div>

        {linkedPartner && onOpenPartner ? (
          <button
            type="button"
            onClick={handleTrackClick}
            className="inline-flex items-center gap-1 font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline whitespace-nowrap shrink-0"
          >
            <span>{sponsorship.ctaLabel || 'آشنایی با حامی'}</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </button>
        ) : trackedUrl ? (
          <a
            href={trackedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleTrackClick}
            className="inline-flex items-center gap-1 font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline whitespace-nowrap shrink-0"
          >
            <span>{sponsorship.ctaLabel || 'آشنایی با حامی'}</span>
            <ArrowUpLeft className="w-3.5 h-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Quiet editorial footer carrying the matching "قدرت گرفته از ..." flagship signature across all pages.
 */
export function FlagshipFooterBand({
  sponsorship,
  enabled = true,
  partners = [],
  onOpenPartner,
}: FlagshipSponsorProps) {
  const trackedUrl = sponsorship
    ? buildTrackedAdUrl(
        sponsorship.targetUrl,
        'lagheli',
        'flagship_footer',
        sponsorship.utmCampaign || `powered_by_${sponsorship.duration}`
      )
    : undefined;
  const linkedPartner = sponsorship ? partners.find((p) => p.id === sponsorship.partnerId) : undefined;

  const handleClick = () => {
    if (!sponsorship) return;
    apiRequest(`/api/ads/flagship/${sponsorship.id}/event`, {
      method: 'POST',
      body: JSON.stringify({type: 'click'}),
    }).catch(() => {});
    if (linkedPartner && onOpenPartner) {
      onOpenPartner(linkedPartner);
    }
  };

  return (
    <footer className="mt-12 border-t border-[#E6E6E3] dark:border-[#1E1E1C] bg-[#FFFFFF] dark:bg-[#0F0F0E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#6B6B66] dark:text-[#989892]">
        <div className="space-y-1">
          <p className="font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">
            لاقلی — مرجع آرام و دقیق دستورپخت ایرانی
          </p>
          <p className="text-[11px] text-[#7A7A74] dark:text-[#84847E]">
            تمام دستورها با مقیاس هوشمند نفرات و همراهی برندهای منتخب تحریریه گردآوری شده‌اند.
          </p>
        </div>

        {enabled && sponsorship && sponsorship.status === 'active' && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-[#7A7A74] dark:text-[#84847E]">
              قدرت گرفته از{' '}
              <strong className="font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
                {sponsorship.partnerName}
              </strong>
            </span>
            {linkedPartner && onOpenPartner ? (
              <button
                type="button"
                onClick={handleClick}
                className="font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>{sponsorship.ctaLabel || 'آشنایی با حامی'}</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </button>
            ) : trackedUrl ? (
              <a
                href={trackedUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className="font-semibold text-[#B54B1F] dark:text-[#E29A6F] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>{sponsorship.ctaLabel || 'آشنایی با حامی'}</span>
                <ArrowUpLeft className="w-3.5 h-3.5" />
              </a>
            ) : null}
          </div>
        )}
      </div>
    </footer>
  );
}
