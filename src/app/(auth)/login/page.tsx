'use client'

import { ThemeProvider } from '@/lib/theme-context'
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <ThemeProvider>
      <div className="flex flex-1 items-center justify-center p-4 min-h-screen">
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M15 15l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-semibold text-text-primary">YouBox</h1>
            <p className="text-sm text-text-tertiary mt-1">Введите PIN для входа</p>
          </div>
          <LoginForm />
        </div>
      </div>
    </ThemeProvider>
  )
}
