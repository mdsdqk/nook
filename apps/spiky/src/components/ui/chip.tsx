import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const chipVariants = cva(
  "inline-flex items-center justify-center rounded-full px-3 py-1 text-label-caps",
  {
    variants: {
      variant: {
        default: "bg-surface-container-highest text-on-surface",
        primary: "bg-primary/15 text-primary",
        secondary: "bg-secondary/15 text-secondary",
        tertiary: "bg-tertiary/15 text-tertiary",
        outline: "border border-outline-variant bg-transparent text-on-surface-variant",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof chipVariants> {}

export function Chip({ className, variant, ...props }: ChipProps) {
  return (
    <span className={cn(chipVariants({ variant, className }))} {...props} />
  );
}

export { chipVariants };
