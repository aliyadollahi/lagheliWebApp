import {useState} from 'react';
import {UtensilsCrossed} from 'lucide-react';

interface EditorialImageProps {
  src: string;
  alt: string;
  aspectClass?: string;
  className?: string;
  priority?: boolean;
}

export function EditorialImage({
  src,
  alt,
  aspectClass = 'aspect-[4/3]',
  className = '',
  priority = false,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${aspectClass} ${className} w-full bg-[#F1EFE8] dark:bg-[#24231F] flex flex-col items-center justify-center gap-2 text-[#615E55] dark:text-[#A9A497] p-6 text-center`}
      >
        <UtensilsCrossed className="w-7 h-7 opacity-60" strokeWidth={1.5} />
        <span className="text-xs font-medium line-clamp-2 max-w-[20ch]">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`${aspectClass} w-full overflow-hidden bg-[#F1EFE8] dark:bg-[#24231F] ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
      />
    </div>
  );
}
