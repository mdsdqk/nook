import type { Transition, Variants } from "motion/react";

/** Soft defaults; Motion respects prefers-reduced-motion when configured via ReducedMotionConfig. */
export const easeOutSoft: Transition = {
  duration: 0.28,
  ease: [0.22, 1, 0.36, 1],
};

export const easeOutFast: Transition = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 2 },
};
