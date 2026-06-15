'use client'

import { useRef, useState, type KeyboardEvent } from 'react'

interface Props {
  length?: number
  onComplete: (pin: string) => void
  disabled?: boolean
  error?: string | boolean
}

export function PinInput({ length = 6, onComplete, disabled, error }: Props) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  function handleChange(idx: number, char: string) {
    if (!/^\d$/.test(char) && char !== '') return
    const next = [...values]
    next[idx] = char
    setValues(next)

    if (char !== '' && idx < length - 1) {
      refs.current[idx + 1]?.focus()
    }

    if (next.every((v) => v !== '') && next.join('').length === length) {
      onComplete(next.join(''))
    }
  }

  function handleKeyDown(idx: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && values[idx] === '' && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      refs.current[idx - 1]?.focus()
    }
    if (e.key === 'ArrowRight' && idx < length - 1) {
      refs.current[idx + 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!text) return
    const next = Array(length).fill('')
    for (let i = 0; i < text.length; i++) {
      next[i] = text[i]
    }
    setValues(next)
    const focusIdx = Math.min(text.length, length - 1)
    refs.current[focusIdx]?.focus()
    if (next.every((v) => v !== '') && next.join('').length === length) {
      onComplete(next.join(''))
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2.5" onPaste={handlePaste}>
        {values.map((val, idx) => (
          <input
            key={idx}
            ref={(el) => { refs.current[idx] = el }}
            type="password"
            inputMode="numeric"
            maxLength={1}
            autoFocus={idx === 0}
            value={val}
            onChange={(e) => handleChange(idx, e.target.value)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            disabled={disabled}
            className={`w-10 h-12 text-center text-lg font-semibold rounded-lg border transition-all duration-150
              bg-input text-text-primary
              focus:outline-none focus:ring-2 focus:ring-accent-ring focus:border-accent
              disabled:opacity-40
              ${error ? 'border-error ring-1 ring-error/30' : val ? 'border-accent' : 'border-border'}`}
            aria-label={`Цифра ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
