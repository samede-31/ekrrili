import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-[#e2e8e3] bg-white shadow-[0_10px_35px_-24px_rgba(22,50,35,0.28)]", className)} {...props} />;
}
