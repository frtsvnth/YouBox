'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineSpinner } from '@/components/ui/Spinner'
import { JobCard } from './JobCard'
import type { Job } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onJobClick?: (job: Job) => void
  onJobDelete?: (id: string) => void
  onJobReRun?: (job: Job) => void
  onJobRetry?: (id: string) => void
}

export function HistoryPanel({ open, onClose, onJobClick, onJobDelete, onJobReRun, onJobRetry }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const mountedRef = useRef(true)

  const fetchHistory = useCallback(async () => {
    if (!open) return
    setLoading(true)
    try {
      const res = await fetch('/api/jobs?status=all')
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setJobs((data.jobs as Job[]).sort((a, b) => b.created_at - a.created_at))
      }
    } catch {
      /* silent */
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [open])

  useEffect(() => {
    mountedRef.current = true
    if (open) {
      const id = setTimeout(fetchHistory, 0)
      return () => {
        mountedRef.current = false
        clearTimeout(id)
      }
    }
    return () => { mountedRef.current = false }
  }, [open, fetchHistory])

  const ready = jobs.filter(j => j.status === 'ready')
  const failed = jobs.filter(j => j.status === 'failed')
  const expired = jobs.filter(j => j.status === 'expired')
  const other = jobs.filter(j => !['ready', 'failed', 'expired'].includes(j.status))

  return (
    <Drawer open={open} onClose={onClose} title="История задач">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <InlineSpinner label="Загрузка истории..." />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon="history"
          title="История пуста"
          description="Завершённые задачи будут отображаться здесь"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {other.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Активные
              </h3>
              <div className="flex flex-col gap-1.5">
                {other.map((job) => (
                  <JobCard key={job.id} job={job} onClick={onJobClick} onDelete={onJobDelete} compact />
                ))}
              </div>
            </section>
          )}
          {ready.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Готово
              </h3>
              <div className="flex flex-col gap-1.5">
                {ready.map((job) => (
                  <JobCard key={job.id} job={job} onClick={onJobClick} onReRun={onJobReRun} onDelete={onJobDelete} compact />
                ))}
              </div>
            </section>
          )}
          {failed.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Ошибки
              </h3>
              <div className="flex flex-col gap-1.5">
                {failed.map((job) => (
                  <JobCard key={job.id} job={job} onClick={onJobClick} onRetry={onJobRetry} onDelete={onJobDelete} compact />
                ))}
              </div>
            </section>
          )}
          {expired.length > 0 && (
            <section>
              <h3 className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mb-2">
                Истекшие
              </h3>
              <div className="flex flex-col gap-1.5">
                {expired.map((job) => (
                  <JobCard key={job.id} job={job} onClick={onJobClick} onDelete={onJobDelete} compact />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Drawer>
  )
}
