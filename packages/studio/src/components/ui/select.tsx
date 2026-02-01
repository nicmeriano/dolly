import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {label && (
          <label className="text-xs text-muted-foreground">{label}</label>
        )}
        <select
          ref={ref}
          className={cn(
            "flex h-8 w-full rounded-md border border-input bg-secondary px-3 py-1 text-sm",
            "focus:outline-none focus:ring-1 focus:ring-ring",
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);
Select.displayName = "Select";
