import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** When false, ignore backdrop / Escape / X close. Default true. */
  dismissible?: boolean;
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  dismissible = true,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const dismissibleRef = React.useRef(dismissible);
  dismissibleRef.current = dismissible;

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;

    const syncOpenState = () => {
      try {
        if (open && !el.open) {
          el.showModal();
        } else if (!open && el.open) {
          el.close();
        }
      } catch {
        // Native <dialog> can throw during HMR remounts when the element
        // is detached from the document.
      }
    };

    syncOpenState();

    return () => {
      if (el.open) {
        try {
          el.close();
        } catch {
          // Ignore close errors on unmount / Fast Refresh.
        }
      }
    };
  }, [open]);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el || !open) return;

    function onCancel(event: Event) {
      if (!dismissibleRef.current) {
        event.preventDefault();
      }
    }

    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [open]);

  function requestClose() {
    if (!dismissibleRef.current) return;
    onOpenChangeRef.current(false);
  }

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        // Width/height only here — never set bare display utilities.
        // `open:flex` is appended last so caller className cannot revive the
        // closed-dialog paint bug via a stray `flex`.
        "m-auto max-h-[min(100dvh-2rem,100%)] w-[min(100%-2rem,28rem)] overflow-hidden rounded-lg border border-white/10 bg-surface-container-low p-0 text-on-surface shadow-2xl backdrop:bg-black/60",
        className,
        "open:flex open:flex-col",
      )}
      onClose={() => {
        if (!dismissibleRef.current) {
          // Re-open if something forced a close while locked.
          const el = dialogRef.current;
          if (el && open && el.isConnected && !el.open) {
            try {
              el.showModal();
            } catch {
              // ignore
            }
          }
          return;
        }
        if (dialogRef.current?.isConnected) {
          onOpenChangeRef.current(false);
        }
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          requestClose();
        }
      }}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-title-md font-medium text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-body-sm text-on-surface/60">{description}</p>
          ) : null}
        </div>
        {dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={requestClose}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <span className="sr-only">Dialog is busy and cannot be closed</span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
        {children}
      </div>
    </dialog>
  );
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Stick to the dialog scrollport so actions stay reachable on short viewports.
        "sticky bottom-0 z-10 -mx-5 -mb-4 mt-stack-md flex flex-wrap items-center justify-end gap-2 border-t border-white/5 bg-surface-container-low px-5 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-label-caps text-on-surface/50",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-10 w-full cursor-pointer rounded border border-white/8 bg-surface-container-lowest px-3 py-2 text-body-base text-on-surface transition-all duration-200",
        "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-[0_0_16px_rgb(208_188_255_/_0.2)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-20 w-full rounded border border-white/8 bg-surface-container-lowest px-3 py-2 text-body-base text-on-surface transition-all duration-200",
        "placeholder:text-on-surface/40",
        "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-[0_0_16px_rgb(208_188_255_/_0.2)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
