'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { JobCard } from './JobCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineSpinner } from '@/components/ui/Spinner'
import type { Job } from '@/types'

interface Props {
  refreshKey?: number
  onJobClick?: (job: Job) => void
  onJobRetry?: (id: string) => void
  onJobReRun?: (job: Job) => void
  onActiveCount?: (count: number) => void
}

export function JobList({ refreshKey = 0, onJobClick, onJobRetry, onJobReRun, onActiveCount }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?status=active')
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setJobs(data.jobs)
        setLoading(false)
        setError('')
        if (onActiveCount) {
          onActiveCount((data.jobs as Job[]).filter(j => ['queued', 'downloading', 'extracting', 'muxing'].includes(j.status)).length)
        }
      }
    } catch {
      if (mountedRef.current) {
        setLoading(false)
        setError('Не удалось загрузить задачи')
      }
    }
  }, [onActiveCount])

  useEffect(() => {
    mountedRef.current = true
    const id = setTimeout(fetchJobs, 0)
    const interval = setInterval(fetchJobs, 2000)
    return () => {
      mountedRef.current = false
      clearTimeout(id)
      clearInterval(interval)
    }
  }, [fetchJobs, refreshKey])

  async function handleCancel(id: string) {
    try {
      await fetch(`/api/jobs/${id}/cancel`, { method: 'POST' })
      fetchJobs()
    } catch { /* silent */ }
  }

  const activeJobs = jobs.filter(j => ['created', 'extracting', 'queued', 'downloading', 'muxing', 'failed'].includes(j.status))
  const recentReady = jobs.filter(j => j.status === 'ready').slice(0, 3)

  if (error) {
    return (
      <EmptyState
        icon="error"
        title="Ошибка загрузки"
        description={error}
      />
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <InlineSpinner label="Загрузка задач..." />
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        icon="download"
        title="Нет задач"
        description="Вставьте ссылку на видео и нажмите «Показать варианты», чтобы начать"
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {activeJobs.length > 0 && (
        <div>
          {activeJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onCancel={handleCancel}
              onClick={onJobClick}
              onRetry={onJobRetry}
            />
          ))}
        </div>
      )}
      {recentReady.length > 0 && activeJobs.length > 0 && (
        <div className="text-[11px] font-medium text-text-tertiary uppercase tracking-wider mt-2 mb-1">
          Последние готовые
        </div>
      )}
      {recentReady.length > 0 && (
        <div className="flex flex-col gap-2">
          {recentReady.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onClick={onJobClick}
              onReRun={onJobReRun}
              compact
            />
          ))}
        </div>
      )}
    </div>
  )
}
