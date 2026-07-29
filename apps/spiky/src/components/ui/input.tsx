import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input">
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded border border-white/8 bg-surface-container-lowest px-3 py-2 text-body-base text-on-surface transition-all duration-200",
        "placeholder:text-on-surface/40",
        "focus-visible:outline-none focus-visible:border-primary/50 focus-visible:shadow-[0_0_16px_rgb(208_188_255_/_0.2)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
