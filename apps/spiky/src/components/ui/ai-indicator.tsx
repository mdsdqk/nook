import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const aiIndicatorVariants = cva("relative inline-flex items-center gap-2", {
  variants: {
    variant: {
      orb: "",
      border: "rounded-lg p-px",
    },
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    variant: "orb",
    size: "md",
  },
});

const orbSize = {
  sm: "h-2 w-2",
  md: "h-3 w-3",
  lg: "h-4 w-4",
} as const;

export interface AiIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof aiIndicatorVariants> {
  label?: string;
  children?: React.ReactNode;
}

export function AiIndicator({
  className,
  variant = "orb",
  size = "md",
  label,
  children,
  ...props
}: AiIndicatorProps) {
  const resolvedSize = size ?? "md";

  if (variant === "border") {
    return (
      <div
        className={cn(
          "relative rounded-lg p-px",
          "bg-linear-to-br from-primary via-tertiary to-secondary",
          "animate-pulse",
          className,
        )}
        {...props}
      >
        <div className="rounded-[calc(var(--radius-lg)-1px)] bg-surface-container-low p-stack-md">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(aiIndicatorVariants({ variant, size }), className)}
      {...props}
    >
      <span className="relative flex">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60",
            orbSize[resolvedSize],
          )}
        />
        <span
          className={cn(
            "relative inline-flex rounded-full bg-linear-to-br from-primary to-tertiary",
            orbSize[resolvedSize],
          )}
        />
      </span>
      {label ? (
        <span className="text-label-caps text-primary">{label}</span>
      ) : null}
      {children}
    </div>
  );
}

export { aiIndicatorVariants };
