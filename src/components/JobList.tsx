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

type Section = 'active' | 'attention' | 'ready'

const SECTION_ORDER: Section[] = ['active', 'attention', 'ready']

const SECTION_CONFIG: Record<Section, { label: string; desc: string }> = {
  active: { label: 'Активные', desc: 'Задачи в работе' },
  attention: { label: 'Требуют внимания', desc: 'Завершились с ошибкой' },
  ready: { label: 'Готово', desc: 'Можно скачать' },
}

function groupJobs(jobs: Job[]): Record<Section, Job[]> {
  const groups: Record<Section, Job[]> = {
    active: [],
    attention: [],
    ready: [],
  }

  for (const job of jobs) {
    if (job.status === 'failed') {
      groups.attention.push(job)
    } else if (job.status === 'ready') {
      groups.ready.push(job)
    } else {
      groups.active.push(job)
    }
  }

  groups.active.sort((a, b) => b.updated_at - a.updated_at)
  groups.attention.sort((a, b) => b.updated_at - a.updated_at)
  groups.ready.sort((a, b) => (b.ready_at ?? b.updated_at) - (a.ready_at ?? a.updated_at))

  return groups
}

export function JobList({ refreshKey = 0, onJobClick, onJobRetry, onJobReRun, onActiveCount }: Props) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)
  const prevActiveCountRef = useRef(0)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs?status=active')
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setJobs(data.jobs)
        setLoading(false)
        setError('')

        const activeCount = (data.jobs as Job[]).filter(
          j => ['queued', 'downloading', 'extracting', 'muxing'].includes(j.status)
        ).length
        if (onActiveCount) onActiveCount(activeCount)

        const prevActive = prevActiveCountRef.current
        prevActiveCountRef.current = activeCount

        const hadReadyJob = (data.jobs as Job[]).some(
          j => j.status === 'ready' && j.ready_at && (Date.now() / 1000 - j.ready_at) < 10
        )

        if (prevActive > 0 && activeCount === 0 && hadReadyJob && listRef.current) {
          listRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
        <InlineSpinner label="Загрузка задач…" />
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

  const groups = groupJobs(jobs)
  const visibleSections = SECTION_ORDER.filter(s => groups[s].length > 0)

  if (visibleSections.length === 0) {
    return (
      <EmptyState
        icon="download"
        title="Нет задач"
        description="Вставьте ссылку на видео и нажмите «Показать варианты», чтобы начать"
      />
    )
  }

  return (
    <div ref={listRef} className="flex flex-col gap-3">
      {visibleSections.map((section) => {
        const sectionJobs = groups[section]
        const config = SECTION_CONFIG[section]
        const isLast = section === visibleSections[visibleSections.length - 1]

        return (
          <div key={section} className={isLast ? '' : 'pb-2 border-b border-border/50'}>
            <div className="flex items-center gap-2 px-0.5 mb-2">
              <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                {config.label}
              </span>
              <span className="text-[10px] text-text-tertiary/60 tabular-nums">
                {sectionJobs.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {sectionJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onClick={onJobClick}
                  onRetry={onJobRetry}
                  onReRun={onJobReRun}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
