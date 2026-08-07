import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ShellBrand,
  ShellNavLinks,
  ShellUserFooter,
} from "@/components/shell-nav";
import { easeOutFast } from "@/lib/motion";

type MobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function lockScroll() {
  const html = document.documentElement;
  html.dataset.drawerScrollLock = "1";
  html.style.overflow = "hidden";
}

function unlockScroll() {
  const html = document.documentElement;
  if (html.dataset.drawerScrollLock) {
    delete html.dataset.drawerScrollLock;
    html.style.overflow = "";
  }
}

function getFocusable(container: HTMLElement) {
  return [
    ...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ].filter(
    (el) =>
      !el.hasAttribute("disabled") &&
      el.getAttribute("aria-hidden") !== "true" &&
      el.tabIndex !== -1,
  );
}

export function MobileNavDrawer({
  open,
  onOpenChange,
  triggerRef,
}: MobileNavDrawerProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const wasOpenRef = useRef(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuOpenRef = useRef(userMenuOpen);
  userMenuOpenRef.current = userMenuOpen;

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        unlockScroll();
        triggerRef.current?.focus();
      }
      wasOpenRef.current = false;
      setUserMenuOpen(false);
      return;
    }

    wasOpenRef.current = true;
    lockScroll();

    const panel = panelRef.current;
    const focusable = panel ? getFocusable(panel) : [];
    focusable[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (userMenuOpenRef.current) return;
        event.preventDefault();
        onOpenChange(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const items = getFocusable(panelRef.current);
      if (items.length === 0) return;

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      unlockScroll();
    };
  }, [open, onOpenChange, triggerRef]);

  return (
    // Stable id for aria-controls even while the animated panel is unmounted.
    <div id="mobile-nav-drawer" className="md:hidden">
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-40" role="presentation">
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/60"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={easeOutFast}
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="absolute inset-y-0 left-0 flex w-60 max-w-[min(15rem,85vw)] flex-col overflow-hidden border-r border-white/5 bg-surface-container-low pt-[env(safe-area-inset-top)] shadow-2xl"
              initial={reduceMotion ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={easeOutFast}
            >
              <h2 id={titleId} className="sr-only">
                Main navigation
              </h2>
              <ShellBrand />
              <ShellNavLinks onNavigate={() => onOpenChange(false)} />
              <ShellUserFooter
                onNavigate={() => onOpenChange(false)}
                onUserMenuOpenChange={setUserMenuOpen}
              />
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
