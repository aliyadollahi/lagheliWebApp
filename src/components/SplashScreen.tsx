import {useEffect} from 'react';
import {AnimatePresence, motion} from 'motion/react';

interface SplashScreenProps {
  visible: boolean;
  onComplete: () => void;
}

export function SplashScreen({visible, onComplete}: SplashScreenProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 2350);
    return () => window.clearTimeout(timer);
  }, [visible, onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="dialog"
          aria-label="صفحه ورود لاقلی"
          initial={{opacity: 1}}
          exit={{opacity: 0, transition: {duration: 0.45, ease: [0.16, 1, 0.3, 1]}}}
          onClick={onComplete}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F9F8F4] dark:bg-[#141412] px-6 select-none cursor-pointer"
        >
          <div className="flex flex-col items-center max-w-sm text-center">
            {/* Minimalist Cast-Iron Skillet (Lagheli) + Golden Egg Emblem */}
            <motion.div
              initial={{scale: 0.92, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
              className="relative w-56 h-56 flex items-center justify-center"
            >
              <svg
                viewBox="0 0 280 280"
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                {/* Gentle warm steam wisps rising above the skillet */}
                <motion.path
                  d="M108 64 C104 52, 114 44, 110 32"
                  stroke="#A97222"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 6}}
                  animate={{pathLength: 1, opacity: [0, 0.75, 0.35], y: -6}}
                  transition={{duration: 1.5, delay: 0.65, ease: 'easeOut'}}
                />
                <motion.path
                  d="M126 56 C122 42, 134 32, 128 18"
                  stroke="#A97222"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 8}}
                  animate={{pathLength: 1, opacity: [0, 0.9, 0.45], y: -7}}
                  transition={{duration: 1.6, delay: 0.75, ease: 'easeOut'}}
                />
                <motion.path
                  d="M144 64 C140 52, 150 44, 146 32"
                  stroke="#A97222"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 6}}
                  animate={{pathLength: 1, opacity: [0, 0.7, 0.3], y: -6}}
                  transition={{duration: 1.5, delay: 0.85, ease: 'easeOut'}}
                />

                {/* Soft surface contact shadow */}
                <ellipse
                  cx="126"
                  cy="226"
                  rx="68"
                  ry="8"
                  className="fill-[#1C1B18]/10 dark:fill-black/40"
                />

                {/* Skillet Handle (Lagheli) */}
                <motion.g
                  initial={{opacity: 0, x: -12}}
                  animate={{opacity: 1, x: 0}}
                  transition={{duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1]}}
                >
                  <path
                    d="M192 146 L260 146"
                    className="stroke-[#1C1B18] dark:stroke-[#E5E1D6]"
                    strokeWidth="15"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="252"
                    cy="146"
                    r="3.6"
                    className="fill-[#F9F8F4] dark:fill-[#141412]"
                  />
                </motion.g>

                {/* Cast-Iron Frying Pan Outer Rim & Inner Base */}
                <motion.g
                  initial={{scale: 0.9, opacity: 0}}
                  animate={{scale: 1, opacity: 1}}
                  transition={{duration: 0.55, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '126px 146px'}}
                >
                  {/* Pour spouts on cast-iron rim */}
                  <circle
                    cx="126"
                    cy="146"
                    r="72"
                    className="fill-[#1C1B18] dark:fill-[#262521] stroke-[#3F523B] dark:stroke-[#8EA888]"
                    strokeWidth="3"
                  />
                  <circle
                    cx="126"
                    cy="146"
                    r="62"
                    className="fill-[#252420] dark:fill-[#181715]"
                  />
                  <circle
                    cx="126"
                    cy="146"
                    r="58"
                    stroke="#F9F8F4"
                    strokeOpacity="0.1"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </motion.g>

                {/* Egg White settling organically inside the pan */}
                <motion.path
                  d="M90 132 C86 108, 108 94, 130 98 C154 102, 174 114, 171 140 C168 166, 155 188, 127 189 C99 190, 94 156, 90 132 Z"
                  fill="#FAF8F2"
                  stroke="#E8E2D4"
                  strokeWidth="1.5"
                  initial={{scale: 0.35, opacity: 0}}
                  animate={{scale: 1, opacity: 1}}
                  transition={{duration: 0.6, delay: 0.35, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '128px 145px'}}
                />

                {/* Golden Saffron Yolk (symbol of simple, nourishing food) */}
                <motion.g
                  initial={{scale: 0, opacity: 0}}
                  animate={{scale: 1, opacity: 1}}
                  transition={{duration: 0.45, delay: 0.58, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '130px 143px'}}
                >
                  <circle cx="130" cy="143" r="20" fill="#D4942A" />
                  <circle cx="130" cy="143" r="16" fill="#E3A73C" />
                  <circle cx="123" cy="136" r="4.5" fill="#FDF3DC" fillOpacity="0.85" />
                </motion.g>
              </svg>
            </motion.div>

            {/* Editorial Persian Wordmark */}
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.55, delay: 0.55, ease: [0.16, 1, 0.3, 1]}}
              className="mt-2 space-y-2"
            >
              <h1 className="text-4xl font-bold tracking-tight text-[#1C1B18] dark:text-[#F4F1EA]">
                لاقلی
              </h1>
              <p className="text-sm text-[#615E55] dark:text-[#A9A497] leading-relaxed">
                سادگیِ اصیل، در هر وعده
              </p>
            </motion.div>

            {/* Subtle editorial progress hairline */}
            <div className="mt-8 w-28 h-[2px] bg-[#E5E1D6] dark:bg-[#2F2D27] overflow-hidden rounded-full">
              <motion.div
                initial={{scaleX: 0}}
                animate={{scaleX: 1}}
                transition={{duration: 2.1, ease: [0.16, 1, 0.3, 1]}}
                style={{transformOrigin: 'right'}}
                className="h-full bg-[#3F523B] dark:bg-[#8EA888]"
              />
            </div>

            <button
              type="button"
              onClick={onComplete}
              className="mt-6 text-xs text-[#615E55] dark:text-[#A9A497] hover:text-[#1C1B18] dark:hover:text-[#F4F1EA] transition-colors min-h-[44px] px-4"
            >
              ورود به لاقلی
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
