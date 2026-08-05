import { useEffect, useId, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  LayoutDashboard,
  Wallet,
  PieChart,
  CreditCard,
  Sparkles,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Chip } from "@/components/ui/chip";
import { easeOutFast, fadeIn, scaleIn } from "@/lib/motion";

type NavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
  badge?: string;
};

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Money", to: "/money", icon: Wallet },
  { label: "Wealth", icon: PieChart },
  { label: "Debt", icon: CreditCard },
  { label: "Intelligence", icon: Sparkles, badge: "AI" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function AppShell() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    // Navigate immediately; RequireAuth also redirects once the session
    // clears. Don't wait on signOut — that left /dashboard mounted until
    // Convex reconnect finished and made the login screen flash/reload.
    void logout();
    navigate("/login", { replace: true });
  }

  const displayName = session?.name ?? session?.email ?? "User";

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-on-surface">
      <aside className="flex w-60 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-surface-container-low">
        <div className="flex shrink-0 items-center gap-3 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-body-sm font-semibold text-white">
            N
          </div>
          <span className="text-title-md font-medium text-white">Nook</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3" aria-label="Main">
          {navItems.map((item) => {
            const Icon = item.icon;
            const label = (
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span
                    className={cn(
                      "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
                      item.to
                        ? "bg-primary/20 text-primary"
                        : "bg-primary/10 text-primary/60",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </span>
            );
            const comingSoon = !item.to ? (
              <motion.span
                className="ml-auto shrink-0"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={easeOutFast}
              >
                <Chip
                  variant="outline"
                  className="px-1 py-0 text-[8px] leading-3.5 tracking-wide text-on-surface/35"
                >
                  Coming soon
                </Chip>
              </motion.span>
            ) : null;

            if (item.to) {
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-body-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-on-surface/70 hover:bg-white/5 hover:text-on-surface",
                    )
                  }
                >
                  {label}
                </NavLink>
              );
            }

            return (
              <span
                key={item.label}
                className="flex w-full cursor-default items-center gap-2 rounded-md px-3 py-2.5 text-body-sm text-on-surface/40"
                aria-disabled="true"
              >
                {label}
                {comingSoon}
              </span>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 border-t border-white/5 px-3 py-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                "mb-1 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-body-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface/70 hover:bg-white/5 hover:text-on-surface",
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" aria-hidden />
            Settings
          </NavLink>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-body-sm font-medium text-on-secondary-container">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-medium text-white">
                  {displayName}
                </span>
                <span className="block truncate text-label-caps text-on-surface/40">
                  {session?.email}
                </span>
              </span>
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  id={menuId}
                  role="menu"
                  className="glass-float absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-md"
                  variants={scaleIn}
                  initial={reduceMotion ? false : "initial"}
                  animate="animate"
                  exit="exit"
                  transition={easeOutFast}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-body-sm text-on-surface hover:bg-white/5"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Log out
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
  );
}
