import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Menu } from "lucide-react";
import {
  ShellBrand,
  ShellNavLinks,
  ShellUserFooter,
} from "@/components/shell-nav";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { easeOutFast, fadeIn } from "@/lib/motion";

const PAGE_TITLES: Record<string, string> = {
  "/money": "Money",
  "/assistants": "Assistants",
  "/settings": "Settings",
  "/dashboard": "Dashboard",
};

function pageTitle(pathname: string) {
  const match = Object.entries(PAGE_TITLES).find(
    ([path]) => pathname === path || pathname.startsWith(`${path}/`),
  );
  return match?.[1] ?? "Nook";
}

const MD_QUERY = "(min-width: 768px)";

export function AppShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const title = pageTitle(location.pathname);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    function onChange() {
      if (mq.matches) setDrawerOpen(false);
    }
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-on-surface">
      <aside className="hidden w-60 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-surface-container-low md:flex">
        <ShellBrand />
        <ShellNavLinks />
        <ShellUserFooter />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Keep chrome outside inert so the menu control stays operable. */}
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-white/5 px-page pt-[env(safe-area-inset-top)] md:hidden">
          <button
            ref={menuButtonRef}
            type="button"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-on-surface hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <h1 className="min-w-0 truncate text-title-md font-medium text-white">
            {title}
          </h1>
        </header>

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          inert={drawerOpen ? true : undefined}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              variants={fadeIn}
              initial={reduceMotion ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={easeOutFast}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <MobileNavDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        triggerRef={menuButtonRef}
      />
    </div>
  );
}
