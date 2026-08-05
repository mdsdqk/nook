import { motion, useReducedMotion } from "motion/react";
import { easeOutSoft } from "@/lib/motion";
import { cn } from "@/lib/utils";

type AuthBusyProps = {
  message?: string;
  /** When set, show a Sign out control (e.g. stuck Google handoff). */
  onSignOut?: () => void;
  /** Fill the viewport (auth gates) vs only the content pane (shell Suspense). */
  fullScreen?: boolean;
};

export function AuthBusy({
  message = "Signing you in…",
  onSignOut,
  fullScreen = true,
}: AuthBusyProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-4 text-center",
        fullScreen ? "min-h-screen" : "min-h-0 flex-1 py-16",
      )}
    >
      <motion.div
        className="relative flex h-12 w-12 items-center justify-center"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={easeOutSoft}
      >
        {reduceMotion ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl bg-primary/20"
          />
        ) : (
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-xl bg-primary/20"
            animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary-container text-title-md font-semibold text-white">
          N
        </div>
      </motion.div>
      <motion.div
        className="flex flex-col items-center gap-2"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...easeOutSoft, delay: reduceMotion ? 0 : 0.06 }}
      >
        <p className="text-body-sm text-on-surface/70">{message}</p>
        <span
          aria-hidden
          className="h-1 w-16 overflow-hidden rounded-full bg-white/10"
        >
          <span className="block h-full w-1/2 rounded-full bg-primary/60 motion-safe:animate-[auth-busy-slide_1.1s_ease-in-out_infinite]" />
        </span>
        {onSignOut ? (
          <button
            type="button"
            className="mt-2 text-body-sm text-on-surface/50 underline-offset-2 hover:text-on-surface/70 hover:underline"
            onClick={onSignOut}
          >
            Sign out
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}
