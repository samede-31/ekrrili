import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const controlStyles =
  "w-full rounded-xl border border-[#dbe4dd] bg-white px-4 text-sm text-[#17231d] shadow-sm transition placeholder:text-[#9aa69e] focus:border-[#17734e] focus:outline-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlStyles, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(controlStyles, "min-h-32 resize-y py-3 leading-6", className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(controlStyles, "h-12", className)} {...props} />;
}

export function FieldLabel({
  children,
  htmlFor,
  required,
}: {
  children: React.ReactNode;
  htmlFor: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[#26372d]">
      {children}
      {required && <span className="ms-1 text-[#c24b42]">*</span>}
    </label>
  );
}
