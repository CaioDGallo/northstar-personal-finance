"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  formatCentsAsBRL,
  digitsToCents,
  centsToDigits,
  parseCurrencyToCents,
} from "@/lib/utils"

const MAX_CENTS = 99_999_999_999 // 999,999,999.99

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: number // cents
  onChange: (cents: number) => void
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChange,
      className,
      onFocus,
      onBlur,
      disabled,
      id,
      name,
      required,
      placeholder,
      autoComplete,
      ...props
    },
    ref
  ) => {
    // Internal digit string state (e.g., "001999" for 19.99)
    const [digits, setDigits] = React.useState(() => centsToDigits(value))
    const inputRef = React.useRef<HTMLInputElement>(null)

    // Sync internal state when value prop changes
    React.useEffect(() => {
      setDigits(centsToDigits(value))
    }, [value])

    // Merge refs
    React.useImperativeHandle(ref, () => inputRef.current!)

    const displayValue = React.useMemo(() => {
      const cents = digitsToCents(digits)
      return `R$ ${formatCentsAsBRL(cents)}`
    }, [digits])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Allow digits
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault()
        const newDigits = digits + e.key
        const newCents = digitsToCents(newDigits)

        if (newCents <= MAX_CENTS) {
          setDigits(newDigits)
          onChange(newCents)
        }
        return
      }

      // Allow Backspace/Delete to remove last digit
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault()
        const newDigits = digits.slice(0, -1) || "0"
        const newCents = digitsToCents(newDigits)
        setDigits(newDigits)
        onChange(newCents)
        return
      }

      // Allow tab, enter, escape for navigation
      if (["Tab", "Enter", "Escape"].includes(e.key)) {
        return
      }

      // Allow Ctrl/Cmd shortcuts (copy, paste, select all)
      if (e.ctrlKey || e.metaKey) {
        return
      }

      // Block all other keys
      e.preventDefault()
    }

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      const pastedText = e.clipboardData.getData("text")
      const parsedCents = parseCurrencyToCents(pastedText)

      if (parsedCents !== null && parsedCents >= 0 && parsedCents <= MAX_CENTS) {
        const newDigits = centsToDigits(parsedCents)
        setDigits(newDigits)
        onChange(parsedCents)
      }
    }

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      onFocus?.(e)
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      onBlur?.(e)
    }

    // Prevent selection/cursor movement since input is append-only
    const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement
      // Keep cursor at end
      target.selectionStart = target.value.length
      target.selectionEnd = target.value.length
    }

    const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
      const target = e.target as HTMLInputElement
      // Move cursor to end on click
      target.selectionStart = target.value.length
      target.selectionEnd = target.value.length
    }

    return (
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={() => {}} // Controlled via onKeyDown
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSelect={handleSelect}
        onClick={handleClick}
        disabled={disabled}
        id={id}
        name={name}
        required={required}
        placeholder={placeholder || "R$ 0,00…"}
        autoComplete={autoComplete || "off"}
        data-slot="input"
        className={cn(
          "dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-none border bg-transparent px-2.5 py-1 text-base sm:text-xs transition-colors focus-visible:ring-1 aria-invalid:ring-1 placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    )
  }
)

CurrencyInput.displayName = "CurrencyInput"

// Variant for use inside InputGroup
const CurrencyInputGroupInput = React.forwardRef<
  HTMLInputElement,
  CurrencyInputProps
>(({ className, ...props }, ref) => {
  return (
    <CurrencyInput
      ref={ref}
      data-slot="input-group-control"
      className={cn(
        "rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent flex-1",
        className
      )}
      {...props}
    />
  )
})

CurrencyInputGroupInput.displayName = "CurrencyInputGroupInput"

export { CurrencyInput, CurrencyInputGroupInput }
