import {Camera, ImageDown} from 'lucide-react';
import {useLazyImage} from '../hooks/useLazyImage.ts';

interface EditorialImageProps {
  src: string;
  alt: string;
  aspectClass?: string;
  className?: string;
  priority?: boolean;
  category?: string;
  photoCreditName?: string | null;
  compactEmpty?: boolean;
  sizes?: string;
}

export function EditorialImage({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
  className = '',
  priority = false,
  category,
  photoCreditName,
  compactEmpty = false,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: EditorialImageProps) {
  const {
    containerRef,
    shouldLoad,
    loaded,
    failed,
    deferredByDataSaver,
    allowManualLoad,
    onLoad,
    onError,
  } = useLazyImage({src, priority});

  const hasValidSrc = Boolean(src && src.trim().length > 0 && !failed);

  if (!hasValidSrc) {
    return (
      <div
        role="img"
        aria-label={`${alt} — در انتظار اولین عکس واقعی کاربران`}
        className={`${aspectClass} ${className} relative w-full overflow-hidden bg-gradient-to-br from-[#F5F1E7] via-[#EFEAE0] to-[#E5DEC9] dark:from-[#23211C] dark:via-[#1D1B17] dark:to-[#171612] flex flex-col items-center justify-center p-5 text-center select-none`}
      >
        {/* Fine Editorial Architectural Inner Frame */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 rounded-xl border border-[#1C1B18]/10 dark:border-[#F4F1EA]/10"
        />

        {/* Subtle Minimalist Skillet Monogram */}
        <svg
          viewBox="0 0 80 48"
          aria-hidden="true"
          className={`${compactEmpty ? 'w-11 h-7 mb-2' : 'w-14 h-9 mb-3'} text-[#B54B1F]/60 dark:text-[#E29A6F]/60`}
        >
          <circle cx="28" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="28" cy="24" r="11" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.45" />
          <path d="M45 24 L74 24" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="28" cy="24" r="4" fill="#A97222" fillOpacity="0.55" />
        </svg>

        {category && !compactEmpty && (
          <span className="text-[11px] tracking-wide text-[#615E55] dark:text-[#A9A497] mb-1">
            {category}
          </span>
        )}

        <span
          className={`${
            compactEmpty ? 'text-xs' : 'text-sm sm:text-base'
          } font-bold text-[#1C1B18] dark:text-[#F4F1EA] line-clamp-2 max-w-[22ch] leading-snug`}
        >
          {alt}
        </span>

        {!compactEmpty && (
          <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-[#B54B1F] dark:text-[#E29A6F]">
            <Camera className="w-3.5 h-3.5" />
            <span>در انتظار اولین عکس واقعی از آشپزخانه شما</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${aspectClass} relative w-full overflow-hidden bg-[#EFECE4] dark:bg-[#22211D] ${className}`}
    >
      {/* Data-Saver Mode Tap-to-Load Placeholder */}
      {deferredByDataSaver ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 p-4 text-center bg-gradient-to-br from-[#F5F2EA] to-[#EAE5D9] dark:from-[#23211C] dark:to-[#191815]">
          <span className="text-xs font-medium text-[#59564E] dark:text-[#BDB8AC] line-clamp-1 max-w-[24ch]">
            {alt}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              allowManualLoad();
            }}
            className="min-h-[38px] px-4 rounded-full bg-[#111110]/85 dark:bg-[#F4F1EA]/90 text-[#FFFFFF] dark:text-[#111110] text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <ImageDown className="w-3.5 h-3.5" />
            <span>نمایش تصویر (صرفه‌جویی دیتا)</span>
          </button>
        </div>
      ) : (
        <>
          {/* Soft Editorial Loading Skeleton (Zero CLS) */}
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#F2EFE7] via-[#EAE5D8] to-[#F2EFE7] dark:from-[#24231F] dark:via-[#2C2A24] dark:to-[#24231F] animate-pulse motion-reduce:animate-none"
            />
          )}

          {shouldLoad && (
            <img
              src={src}
              alt={alt}
              sizes={sizes}
              loading={priority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={priority ? 'high' : 'low'}
              referrerPolicy="no-referrer"
              onLoad={onLoad}
              onError={onError}
              className={`w-full h-full object-cover transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.03] ${
                loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.015]'
              }`}
            />
          )}
        </>
      )}

      {photoCreditName && (
        <div className="absolute bottom-2.5 right-2.5 rounded-full bg-[#141412]/72 backdrop-blur-md border border-white/10 px-3 py-1 text-[11px] text-[#F9F8F4] flex items-center gap-1.5">
          <Camera className="w-3 h-3 text-[#D8A85B]" />
          <span>عکس واقعی از {photoCreditName}</span>
        </div>
      )}
    </div>
  );
}
