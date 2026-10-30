import { forwardRef, type InputHTMLAttributes } from "react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Diff } from "./icons";

interface SignedNumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "value" | "onChange"
> {
  value: string;
  onValueChange: (value: string) => void;
  signToggleLabel: string;
}

/** Le clavier décimal mobile peut omettre « − ». Le signe reste une action
 * tactile, même avant de saisir le nombre ; le texte conserve alors « - ».
 * Les virgules sont normalisées pour les calculs existants avec parseFloat. */
export const SignedNumberInput = forwardRef<HTMLInputElement, SignedNumberInputProps>(
  function SignedNumberInput(
    { value, onValueChange, signToggleLabel, disabled, readOnly, ...rest },
    ref,
  ) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <Input
          {...rest}
          ref={ref}
          type="text"
          inputMode="decimal"
          value={value}
          disabled={disabled}
          readOnly={readOnly}
          onChange={(event) => {
            const next = event.target.value.replace(/,/g, ".").replace(/−/g, "-");
            if (/^-?\d*(?:\.\d*)?$/.test(next)) onValueChange(next);
          }}
        />
        <Button
          variant="subtle"
          aria-label={signToggleLabel}
          title={signToggleLabel}
          aria-pressed={value.startsWith("-")}
          disabled={disabled || readOnly}
          className="h-[var(--tv-form-control-height,44px)] w-11 shrink-0 px-0"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onValueChange(value.startsWith("-") ? value.slice(1) : `-${value}`)}
        >
          <Diff className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    );
  },
);
