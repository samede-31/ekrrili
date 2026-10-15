import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#17734e] text-white hover:bg-[#10583b]",
        outline: "border border-[#dbe4dd] bg-white text-[#23352a] hover:bg-[#f2f6f3]",
        ghost: "text-[#52645a] hover:bg-[#edf3ee]",
        destructive: "bg-red-700 text-white hover:bg-red-800",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        icon: "h-10 w-10",
        small: "min-h-9 px-3 py-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
