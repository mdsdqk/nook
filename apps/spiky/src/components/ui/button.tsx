import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:scale-[0.97] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        primary:
          "bg-linear-to-r from-primary-container to-tertiary-container text-white shadow-[0_0_20px_rgb(208_188_255_/_0.2)] hover:brightness-110",
        secondary:
          "border border-white/15 bg-transparent text-on-surface hover:border-white/30 hover:bg-white/5",
        ghost: "bg-transparent text-on-surface-variant hover:bg-white/5 hover:text-on-surface",
      },
      size: {
        default: "h-10 px-5 text-body-sm",
        sm: "h-8 rounded px-3 text-body-sm",
        lg: "h-12 rounded-md px-6 text-body-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
