import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const store = await cookies()
  const session = store.get('youbox-session')

  if (!session?.value) {
    redirect('/login')
  }

  return <>{children}</>
}
