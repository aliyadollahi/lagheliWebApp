import {useEffect, useMemo, useRef, useState} from 'react';
import {ArrowUpLeft, LocateFixed, MapPin, Phone, UtensilsCrossed} from 'lucide-react';
import {apiRequest} from '../lib/api.ts';
import {buildTrackedAdUrl, matchNearbyVenuesForRecipe} from '../shared/nativeAdEngine.ts';
import {toFaDigits} from '../shared/persianEngine.ts';
import type {LocalVenueSuggestion, LocalVenueType, Partner, Recipe} from '../shared/types.ts';

interface NearbyVenueCardProps {
  recipe: Recipe;
  venues: LocalVenueSuggestion[];
  defaultCity?: string;
  defaultNeighborhood?: string;
  partners?: Partner[];
  onOpenPartner?: (partner: Partner) => void;
  onNotify?: (msg: string) => void;
}

const IRAN_CITIES = ['تهران', 'رشت', 'شیراز', 'اصفهان', 'مشهد'];

const VENUE_TYPE_LABELS: Record<LocalVenueType, string> = {
  restaurant: 'رستوران',
  cafe: 'کافه',
  fastfood: 'فست‌فود',
};

export function NearbyVenueCard({
  recipe,
  venues,
  defaultCity = 'تهران',
  defaultNeighborhood = '',
  partners = [],
  onOpenPartner,
  onNotify,
}: NearbyVenueCardProps) {
  const [city, setCity] = useState(defaultCity || 'تهران');
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood || '');
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
  const [locating, setLocating] = useState(false);
  const trackedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (defaultCity) setCity(defaultCity);
  }, [defaultCity]);

  useEffect(() => {
    if (defaultNeighborhood) setNeighborhood(defaultNeighborhood);
  }, [defaultNeighborhood]);

  const matches = useMemo(
    () =>
      matchNearbyVenuesForRecipe(
        recipe,
        venues,
        {
          city,
          neighborhood,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        },
        3
      ),
    [recipe, venues, city, neighborhood, coords]
  );

  // Non-blocking impression tracking once per visible matched venue
  useEffect(() => {
    for (const m of matches) {
      if (trackedIdsRef.current.has(m.venue.id)) continue;
      trackedIdsRef.current.add(m.venue.id);
      apiRequest(`/api/ads/nearby-venues/${m.venue.id}/event`, {
        method: 'POST',
        body: JSON.stringify({type: 'impression'}),
      }).catch(() => {});
    }
  }, [matches]);

  const handleRequestGeolocation = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onNotify?.('مرورگر شما از مکان‌یابی پشتیبانی نمی‌کند؛ می‌توانید شهر و محله را دستی انتخاب کنید.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({lat: pos.coords.latitude, lng: pos.coords.longitude});
        setLocating(false);
        onNotify?.('موقعیت تقریبی شما دریافت شد و نزدیک‌ترین گزینه‌ها مرتب شدند.');
      },
      () => {
        setLocating(false);
        onNotify?.('دسترسی مکان‌یابی تایید نشد؛ فهرست بر اساس شهر و محله انتخابی نمایش داده می‌شود.');
      },
      {enableHighAccuracy: false, timeout: 6000, maximumAge: 300_000}
    );
  };

  const handleVenueClick = (venue: LocalVenueSuggestion) => {
    apiRequest(`/api/ads/nearby-venues/${venue.id}/event`, {
      method: 'POST',
      body: JSON.stringify({type: 'click'}),
    }).catch(() => {});

    const linkedPartner = venue.partnerId ? partners.find((p) => p.id === venue.partnerId) : undefined;
    if (linkedPartner && onOpenPartner) {
      onOpenPartner(linkedPartner);
    }
  };

  if (venues.length === 0) return null;

  return (
    <section
      aria-label="رستوران‌ها و کافه‌های نزدیک سروکننده این غذا"
      className="rounded-2xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FAF9F7] dark:bg-[#141413] p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] text-[#7A7A74] dark:text-[#989892]">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[#B54B1F]" />
            <span>پیشنهاد مکانی همکاران</span>
            <span aria-hidden="true">·</span>
            <span>بر اساس موقعیت شما</span>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-[#0D0D0D] dark:text-[#FAFAFA]">
            حوصله پختش رو نداری؟ در نزدیک‌ترین رستوران و کافه امتحانش کن
          </h3>
          <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E]">
            مجموعه‌های تاییدشده‌ای که همین غذا یا نوشیدنی را در محدوده شما سرو می‌کنند.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRequestGeolocation}
          disabled={locating}
          className="min-h-[40px] px-3.5 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] bg-[#FFFFFF] dark:bg-[#1B1B19] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-60"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[#B54B1F]" />
          <span>{locating ? 'در حال مکان‌یابی...' : coords ? 'بروزرسانی مکان' : 'مکان‌یابی نزدیک‌ترین‌ها'}</span>
        </button>
      </div>

      {/* Manual City & Neighborhood Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="flex items-center gap-2 rounded-xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#111110] px-3 min-h-[42px]">
          <MapPin className="w-3.5 h-3.5 text-[#7A7A74] shrink-0" />
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            aria-label="انتخاب شهر"
            className="w-full bg-transparent text-xs font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] outline-none"
          >
            {IRAN_CITIES.map((c) => (
              <option key={c} value={c} className="bg-white dark:bg-[#141413]">
                شهر: {c}
              </option>
            ))}
          </select>
        </label>

        <input
          type="text"
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="نام محله شما (مثلاً ونک، جردن، گلسار)"
          aria-label="محله شما"
          className="rounded-xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#111110] px-3.5 min-h-[42px] text-xs text-[#0D0D0D] dark:text-[#FAFAFA] placeholder:text-[#8E8E89] outline-none focus:border-[#0D0D0D] dark:focus:border-[#FAFAFA]"
        />
      </div>

      {matches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#DFDFDC] dark:border-[#2A2A27] p-4 text-xs text-[#6B6B66] dark:text-[#989892]">
          در حال حاضر رستوران یا کافه تاییدشده‌ای برای این غذا در شهر «{city}» ثبت نشده است؛ با تغییر شهر می‌توانید گزینه‌های دیگر را ببینید.
        </div>
      ) : (
        <div className="divide-y divide-[#E6E6E3] dark:divide-[#242422] rounded-xl border border-[#E6E6E3] dark:border-[#262624] bg-[#FFFFFF] dark:bg-[#111110]">
          {matches.map(({venue, distanceKm, matchedDishLabel, matchReason}) => {
            const trackedMenuUrl = buildTrackedAdUrl(
              venue.menuUrl,
              'lagheli',
              'nearby_venue',
              venue.utmCampaign || `venue_${venue.id}`
            );
            const hasPartnerProfile = Boolean(venue.partnerId && partners.some((p) => p.id === venue.partnerId));

            return (
              <div
                key={venue.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#7A7A74] dark:text-[#989892]">
                    <span>{VENUE_TYPE_LABELS[venue.venueType]}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {venue.city}، {venue.neighborhood}
                    </span>
                    {distanceKm !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#0D0D0D] dark:text-[#FAFAFA] tabular-nums">
                          {toFaDigits(String(distanceKm))} کیلومتر
                        </span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="text-[#B54B1F] dark:text-[#E29A6F] font-medium">
                      سرو {matchedDishLabel}
                    </span>
                  </div>

                  <p className="text-sm font-bold text-[#0D0D0D] dark:text-[#FAFAFA]">{venue.name}</p>
                  <p className="text-xs text-[#5C5C58] dark:text-[#A3A39E] leading-relaxed">
                    {venue.deliveryNote || venue.address || matchReason}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {venue.phone && (
                    <a
                      href={`tel:${venue.phone.replace(/[^0-9+]/g, '')}`}
                      onClick={() => handleVenueClick(venue)}
                      className="min-h-[40px] px-3 rounded-xl border border-[#E6E6E3] dark:border-[#2C2C29] text-xs font-semibold text-[#52524E] dark:text-[#D4D4CE] hover:border-[#0D0D0D] dark:hover:border-[#FAFAFA] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span className="tabular-nums">{toFaDigits(venue.phone)}</span>
                    </a>
                  )}

                  {trackedMenuUrl ? (
                    <a
                      href={trackedMenuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleVenueClick(venue)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
                    >
                      <span>مشاهده منو</span>
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </a>
                  ) : hasPartnerProfile ? (
                    <button
                      type="button"
                      onClick={() => handleVenueClick(venue)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#0D0D0D] dark:bg-[#FAFAFA] text-[#FFFFFF] dark:text-[#0B0B0B] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
                    >
                      <span>صفحه رستوران</span>
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
