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
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;

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

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "m-auto w-[min(100%-2rem,28rem)] rounded-lg border border-white/10 bg-surface-container-low p-0 text-on-surface shadow-2xl backdrop:bg-black/60 open:flex open:flex-col",
        className,
      )}
      onClose={() => {
        // Avoid setState storms if Fast Refresh tears the dialog down.
        if (dialogRef.current?.isConnected) {
          onOpenChangeRef.current(false);
        }
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onOpenChangeRef.current(false);
        }
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-title-md font-medium text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-body-sm text-on-surface/60">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Close"
          onClick={() => onOpenChangeRef.current(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
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
        "mt-stack-md flex flex-wrap items-center justify-end gap-2",
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
