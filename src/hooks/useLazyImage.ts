import {useEffect, useRef, useState} from 'react';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
  addEventListener?: (type: 'change', listener: () => void) => void;
  removeEventListener?: (type: 'change', listener: () => void) => void;
}

function getNetworkDataSaverMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as Navigator & {connection?: NetworkInformationLike}).connection;
  if (!conn) return false;
  return Boolean(conn.saveData || conn.effectiveType === 'slow-2g');
}

interface UseLazyImageOptions {
  src: string;
  priority?: boolean;
  rootMargin?: string;
}

/**
 * Viewport-aware Lazy Loading + Network Data-Saver hook.
 * Defers network requests until images approach the viewport (220px margin),
 * respects browser Save-Data / slow-2g signals, and resets state cleanly on src change.
 */
export function useLazyImage({src, priority = false, rootMargin = '220px 0px'}: UseLazyImageOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dataSaver, setDataSaver] = useState<boolean>(() => getNetworkDataSaverMode());
  const [manualLoadAllowed, setManualLoadAllowed] = useState(false);
  const [inView, setInView] = useState<boolean>(priority);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Listen to dynamic connection changes (e.g. toggling Save-Data or switching Wi-Fi -> 2G)
  useEffect(() => {
    const conn = (navigator as Navigator & {connection?: NetworkInformationLike}).connection;
    if (!conn?.addEventListener) return;
    const onChange = () => setDataSaver(getNetworkDataSaverMode());
    conn.addEventListener('change', onChange);
    return () => conn.removeEventListener?.('change', onChange);
  }, []);

  // Reset image load/error flags whenever src changes
  useEffect(() => {
    setLoaded(false);
    setFailed(false);
    setManualLoadAllowed(false);
    if (priority) {
      setInView(true);
    }
  }, [src, priority]);

  // Observe viewport intersection for non-priority images
  useEffect(() => {
    if (priority || inView) return;
    const node = containerRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      {rootMargin, threshold: 0.01}
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [priority, inView, rootMargin]);

  const deferredByDataSaver = Boolean(!priority && dataSaver && !manualLoadAllowed);
  const shouldLoad = Boolean(src && src.trim().length > 0 && !failed && inView && !deferredByDataSaver);

  return {
    containerRef,
    shouldLoad,
    loaded,
    failed,
    deferredByDataSaver,
    allowManualLoad: () => {
      setManualLoadAllowed(true);
      setInView(true);
    },
    onLoad: () => setLoaded(true),
    onError: () => setFailed(true),
  };
}
