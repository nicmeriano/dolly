import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  displayValue?: string;
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(
  ({ className, label, displayValue, ...props }, ref) => {
    return (
      <div className="space-y-1">
        {(label || displayValue) && (
          <div className="flex items-center justify-between">
            {label && <label className="text-xs text-muted-foreground">{label}</label>}
            {displayValue && <span className="text-xs text-muted-foreground">{displayValue}</span>}
          </div>
        )}
        <input
          ref={ref}
          type="range"
          className={cn(
            "w-full h-1.5 rounded-full bg-secondary appearance-none cursor-pointer",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
Slider.displayName = "Slider";
