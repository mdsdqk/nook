import { useEffect, useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { api } from "@nook/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { useAuth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { easeOutSoft, fadeUp } from "@/lib/motion";

type SettingsSectionId =
  | "profile"
  | "connected"
  | "api-keys"
  | "ai-providers"
  | "statement-providers";

const sections: {
  id: SettingsSectionId;
  label: string;
  live?: boolean;
}[] = [
  { id: "profile", label: "Profile", live: true },
  { id: "connected", label: "Connected accounts" },
  { id: "api-keys", label: "API keys" },
  { id: "ai-providers", label: "AI providers" },
  { id: "statement-providers", label: "Statement providers" },
];

export function SettingsPage() {
  const [active, setActive] = useState<SettingsSectionId>("profile");
  const navId = useId();
  const reduceMotion = useReducedMotion();

  return (
    <>
      <header className="flex h-14 shrink-0 items-center border-b border-white/5 px-container">
        <h1 className="text-title-md font-medium text-white">Settings</h1>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <nav
          id={navId}
          aria-label="Settings sections"
          className="hidden w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-white/5 px-3 py-stack-md sm:flex"
        >
          {sections.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActive(section.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-body-sm transition-colors",
                active === section.id
                  ? "bg-primary/10 text-primary"
                  : "text-on-surface/60 hover:bg-white/5 hover:text-on-surface",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{section.label}</span>
              {!section.live ? (
                <Chip
                  variant="outline"
                  className="px-1 py-0 text-[8px] leading-3.5 tracking-wide text-on-surface/35"
                >
                  Soon
                </Chip>
              ) : null}
            </button>
          ))}
        </nav>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-container py-stack-md">
          <div className="mb-stack-md flex gap-1 overflow-x-auto sm:hidden">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-body-sm transition-colors",
                  active === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-on-surface/60 hover:bg-white/5",
                )}
              >
                {section.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active}
              variants={fadeUp}
              initial={reduceMotion ? false : "initial"}
              animate="animate"
              exit="exit"
              transition={easeOutSoft}
            >
              {active === "profile" ? <ProfileSection /> : null}
              {active === "connected" ? (
                <ComingSoonSection
                  title="Connected accounts"
                  description="Link or unlink Google and manage OAuth permissions."
                />
              ) : null}
              {active === "api-keys" ? (
                <ComingSoonSection
                  title="API keys"
                  description="Create and revoke personal access tokens for the CLI and integrations."
                />
              ) : null}
              {active === "ai-providers" ? (
                <ComingSoonSection
                  title="AI providers"
                  description="Configure model providers used by Intelligence features."
                />
              ) : null}
              {active === "statement-providers" ? (
                <ComingSoonSection
                  title="Statement providers"
                  description="Connect banks and statement sources for automated imports."
                />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

function ComingSoonSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="max-w-xl">
      <div className="flex items-center gap-2">
        <h2 className="text-title-md font-medium text-white">{title}</h2>
        <Chip
          variant="outline"
          className="px-1 py-0 text-[8px] leading-3.5 tracking-wide text-on-surface/35"
        >
          Coming soon
        </Chip>
      </div>
      <p className="mt-2 text-body-sm text-on-surface/55">{description}</p>
      <div className="mt-6 rounded-md border border-dashed border-white/10 px-4 py-8 text-center text-body-sm text-on-surface/40">
        This section is not available yet.
      </div>
    </section>
  );
}

function ProfileSection() {
  const { session } = useAuth();
  const updateProfile = useMutation(api.users.updateProfile);
  const [name, setName] = useState(session?.name ?? "");
  const [username, setUsername] = useState(session?.username ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setName(session?.name ?? "");
    setUsername(session?.username ?? "");
  }, [session?.name, session?.username]);

  const hasUsername = Boolean(session?.username?.trim());
  const dirty =
    name.trim() !== (session?.name ?? "").trim() ||
    username.trim().toLowerCase() !==
      (session?.username ?? "").trim().toLowerCase();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const nextName = name.trim();
    const nextUsername = username.trim().toLowerCase();
    const previousName = session?.name ?? "";
    const previousUsername = session?.username;

    if (nextName.length < 1) {
      setError("Name is required");
      return;
    }
    if (hasUsername && nextUsername.length === 0) {
      setError("Username is required");
      return;
    }
    if (nextUsername.length > 0 && nextUsername.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!dirty) {
      return;
    }

    setPending(true);

    const convexArgs: {
      name: string;
      username?: string;
    } = { name: nextName };
    if (nextUsername.length > 0) {
      convexArgs.username = nextUsername;
    }

    try {
      // Convex first (source of truth for Spiky UI), then Better Auth.
      await updateProfile(convexArgs);

      const baPayload: { name: string; username?: string } = {
        name: nextName,
      };
      if (nextUsername.length > 0) {
        baPayload.username = nextUsername;
      }

      const baResult = await authClient.updateUser(baPayload);
      if (baResult.error) {
        await updateProfile({
          name: previousName,
          username:
            previousUsername !== undefined && previousUsername !== ""
              ? previousUsername
              : null,
        });
        throw new Error(
          baResult.error.message ??
            "Could not sync account provider; profile restored",
        );
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="max-w-xl">
      <h2 className="text-title-md font-medium text-white">Profile</h2>
      <p className="mt-1 text-body-sm text-on-surface/55">
        Your name and username appear across Nook. Email is managed by your
        sign-in provider.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-label-caps text-on-surface-variant">Name</span>
          <Input
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSuccess(false);
            }}
            disabled={pending}
            required
            maxLength={100}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-label-caps text-on-surface-variant">
            Username
          </span>
          <Input
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setSuccess(false);
            }}
            disabled={pending}
            required={hasUsername}
            minLength={hasUsername ? 3 : undefined}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            title="Letters, numbers, and underscores only"
            placeholder="yourname"
          />
          <span className="text-label-caps text-on-surface/40">
            {hasUsername
              ? "Required. Letters, numbers, and underscores."
              : "Optional for Google-only accounts. Letters, numbers, underscores."}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-label-caps text-on-surface-variant">Email</span>
          <Input
            name="email"
            type="email"
            value={session?.email ?? ""}
            disabled
            readOnly
          />
        </label>

        {error ? (
          <motion.p
            className="text-body-sm text-error"
            role="alert"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutSoft}
          >
            {error}
          </motion.p>
        ) : null}
        {success ? (
          <motion.p
            className="text-body-sm text-secondary"
            role="status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={easeOutSoft}
          >
            Profile saved.
          </motion.p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}
