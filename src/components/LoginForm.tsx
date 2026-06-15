'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PinInput } from './PinInput'

export function LoginForm() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handlePinComplete = useCallback(async (pin: string) => {
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push('/')
        return
      }

      if (res.status === 429) {
        const until = data.lockoutUntil
        if (until) {
          const minutes = Math.ceil((until * 1000 - Date.now()) / 60000)
          setError(`Слишком много попыток. Повторите через ${minutes} мин`)
        } else {
          setError('Слишком много попыток. Попробуйте позже')
        }
        return
      }

      if (data.remainingAttempts !== undefined) {
        const rem = data.remainingAttempts
        if (rem <= 1) {
          setError(`Неверный PIN. Последняя попытка`)
        } else {
          setError(`Неверный PIN. Осталось ${rem} попыток`)
        }
      } else {
        setError('Неверный PIN')
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setLoading(false)
    }
  }, [router])

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <PinInput
        length={6}
        onComplete={handlePinComplete}
        disabled={loading}
        error={error || undefined}
      />
      {error && (
        <p className="text-xs text-error text-center max-w-[240px] leading-relaxed">
          {error}
        </p>
      )}
      {loading && (
        <p className="text-xs text-text-tertiary">Проверка...</p>
      )}
    </div>
  )
}
