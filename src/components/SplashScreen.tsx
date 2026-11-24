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
    }, 2950);
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
            {/* Choreographed Cast-Iron Skillet (Lagheli) + Rotating Handle + Cracking Egg + Saffron Steam */}
            <motion.div
              initial={{scale: 0.94, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              transition={{duration: 0.45, ease: [0.16, 1, 0.3, 1]}}
              className="relative w-60 h-60 flex items-center justify-center"
            >
              <svg
                viewBox="0 0 280 280"
                className="w-full h-full overflow-visible"
                aria-hidden="true"
              >
                {/* Soft surface contact shadow */}
                <motion.ellipse
                  cx="126"
                  cy="228"
                  rx="68"
                  ry="8"
                  className="fill-[#1C1B18]/10 dark:fill-black/40"
                  initial={{scaleX: 0.7, opacity: 0}}
                  animate={{scaleX: 1, opacity: 1}}
                  transition={{duration: 0.65, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '126px 228px'}}
                />

                {/* Rotating Cast-Iron Skillet + Handle Group (pivots around pan center during load) */}
                <motion.g
                  initial={{rotate: -52, scale: 0.9, opacity: 0}}
                  animate={{rotate: [-52, 7, 0], scale: 1, opacity: 1}}
                  transition={{
                    rotate: {duration: 0.95, times: [0, 0.72, 1], ease: [0.22, 1, 0.36, 1]},
                    scale: {duration: 0.55, ease: [0.16, 1, 0.3, 1]},
                    opacity: {duration: 0.4},
                  }}
                  style={{transformOrigin: '126px 146px'}}
                >
                  {/* Skillet Handle with Brass Rivet Detail */}
                  <path
                    d="M192 146 L260 146"
                    className="stroke-[#1C1B18] dark:stroke-[#E5E1D6]"
                    strokeWidth="15"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="206"
                    cy="146"
                    r="2.4"
                    fill="#D4942A"
                    fillOpacity="0.85"
                  />
                  <circle
                    cx="252"
                    cy="146"
                    r="3.6"
                    className="fill-[#F9F8F4] dark:fill-[#141412]"
                  />

                  {/* Cast-Iron Frying Pan Outer Rim & Inner Base */}
                  <circle
                    cx="126"
                    cy="146"
                    r="72"
                    className="fill-[#1C1B18] dark:fill-[#262521] stroke-[#B54B1F] dark:stroke-[#E29A6F]"
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

                {/* Subtle sizzle heat ring inside pan as egg lands */}
                <motion.circle
                  cx="128"
                  cy="146"
                  r="42"
                  fill="none"
                  stroke="#D4942A"
                  strokeWidth="1.6"
                  initial={{scale: 0.35, opacity: 0}}
                  animate={{scale: [0.35, 1.12, 1.28], opacity: [0, 0.45, 0]}}
                  transition={{duration: 0.8, delay: 1.05, ease: 'easeOut'}}
                  style={{transformOrigin: '128px 146px'}}
                />

                {/* Egg White blooming gently inside the hot pan after crack */}
                <motion.path
                  d="M90 132 C86 108, 108 94, 130 98 C154 102, 174 114, 171 140 C168 166, 155 188, 127 189 C99 190, 94 156, 90 132 Z"
                  fill="#FAF8F2"
                  stroke="#E8E2D4"
                  strokeWidth="1.5"
                  initial={{scale: 0.15, opacity: 0}}
                  animate={{scale: [0.15, 1.04, 1], opacity: [0, 1, 1]}}
                  transition={{duration: 0.65, delay: 0.98, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '128px 145px'}}
                />

                {/* Golden Saffron Yolk dropping softly from cracked shell into center */}
                <motion.g
                  initial={{scale: 0.2, y: -26, opacity: 0}}
                  animate={{scale: [0.2, 1.08, 1], y: [-26, 2, 0], opacity: [0, 1, 1]}}
                  transition={{duration: 0.55, delay: 1.05, ease: [0.16, 1, 0.3, 1]}}
                  style={{transformOrigin: '130px 143px'}}
                >
                  <circle cx="130" cy="143" r="20" fill="#D4942A" />
                  <circle cx="130" cy="143" r="16" fill="#E3A73C" />
                  <circle cx="123" cy="136" r="4.5" fill="#FDF3DC" fillOpacity="0.88" />
                </motion.g>

                {/* Editorial Cracking Egg Shells (descend above pan, split neatly, lift & fade) */}
                <motion.g
                  initial={{y: -48, opacity: 0}}
                  animate={{y: [-48, -10, -10, -24], opacity: [0, 1, 1, 0]}}
                  transition={{
                    duration: 0.85,
                    delay: 0.45,
                    times: [0, 0.38, 0.72, 1],
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  {/* Left Shell Half */}
                  <motion.path
                    d="M128 84 C112 85, 102 100, 102 115 C102 128, 113 136, 128 136 L124 122 L130 111 L125 99 Z"
                    fill="#F3EDE0"
                    stroke="#CBBFA8"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    initial={{x: 0, rotate: 0}}
                    animate={{x: [0, 0, -22], rotate: [0, -4, -30]}}
                    transition={{
                      duration: 0.7,
                      delay: 0.7,
                      times: [0, 0.22, 1],
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{transformOrigin: '126px 88px'}}
                  />

                  {/* Right Shell Half */}
                  <motion.path
                    d="M128 84 C144 85, 154 100, 154 115 C154 128, 143 136, 128 136 L124 122 L130 111 L125 99 Z"
                    fill="#ECE4D3"
                    stroke="#CBBFA8"
                    strokeWidth="1.6"
                    strokeLinejoin="round"
                    initial={{x: 0, rotate: 0}}
                    animate={{x: [0, 0, 22], rotate: [0, 4, 30]}}
                    transition={{
                      duration: 0.7,
                      delay: 0.7,
                      times: [0, 0.22, 1],
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{transformOrigin: '130px 88px'}}
                  />

                  {/* Delicate golden crack spark at split point */}
                  <motion.path
                    d="M128 96 L125 107 L131 116 L126 126"
                    fill="none"
                    stroke="#A97222"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{pathLength: 0, opacity: 0}}
                    animate={{pathLength: [0, 1, 1], opacity: [0, 1, 0]}}
                    transition={{duration: 0.35, delay: 0.72, ease: 'easeOut'}}
                  />
                </motion.g>

                {/* Gentle warm saffron steam wisps rising above the cooked egg */}
                <motion.path
                  d="M108 64 C104 52, 114 44, 110 32"
                  stroke="#A97222"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 8}}
                  animate={{pathLength: 1, opacity: [0, 0.8, 0.35], y: -8}}
                  transition={{duration: 1.5, delay: 1.25, ease: 'easeOut'}}
                />
                <motion.path
                  d="M126 56 C122 42, 134 32, 128 18"
                  stroke="#A97222"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 10}}
                  animate={{pathLength: 1, opacity: [0, 0.92, 0.45], y: -9}}
                  transition={{duration: 1.6, delay: 1.35, ease: 'easeOut'}}
                />
                <motion.path
                  d="M144 64 C140 52, 150 44, 146 32"
                  stroke="#A97222"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  fill="none"
                  initial={{pathLength: 0, opacity: 0, y: 8}}
                  animate={{pathLength: 1, opacity: [0, 0.75, 0.3], y: -8}}
                  transition={{duration: 1.5, delay: 1.45, ease: 'easeOut'}}
                />
              </svg>
            </motion.div>

            {/* Editorial Persian Wordmark */}
            <motion.div
              initial={{opacity: 0, y: 10}}
              animate={{opacity: 1, y: 0}}
              transition={{duration: 0.55, delay: 0.85, ease: [0.16, 1, 0.3, 1]}}
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
                transition={{duration: 2.65, ease: [0.16, 1, 0.3, 1]}}
                style={{transformOrigin: 'right'}}
                className="h-full bg-[#B54B1F] dark:bg-[#E29A6F]"
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
