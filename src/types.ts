export type JobStatus =
  | 'created' | 'extracting' | 'queued' | 'downloading' | 'muxing'
  | 'ready' | 'failed' | 'expired'

export type OutputFormat = 'mp4' | 'mp3' | 'webm'

export type DownloadMode = 'video' | 'audio' | 'playlist'

export interface Job {
  id: string
  url: string
  format: OutputFormat
  mode: DownloadMode
  status: JobStatus
  title: string | null
  filename: string | null
  filesize: number | null
  error_message: string | null
  progress: number
  progress_downloaded: number | null
  progress_total: number | null
  progress_speed: number | null
  progress_eta: number | null
  current_stage: string
  created_at: number
  updated_at: number
  ready_at: number | null
  expires_at: number | null
  playlist_index: number | null
  playlist_size: number | null
  format_id: string | null
}

export interface Session {
  id: string
  created_at: number
  expires_at: number
}

export interface FormatInfo {
  format_id: string
  ext: string
  resolution: string | null
  filesize: number | null
  format_note: string | null
  vcodec: string
  acodec: string
  fps: number | null
  tbr: number | null
}

export interface ExtractedEntry {
  id: string
  title: string
  duration: number | null
  url: string
  thumbnail: string | null
}

export interface ExtractedMetadata {
  id: string
  title: string
  duration: number | null
  webpage_url: string
  thumbnail: string | null
  uploader: string | null
  upload_date: string | null
  formats: FormatInfo[]
  is_playlist: boolean
  playlist_count: number | null
  entries: ExtractedEntry[] | null
  extractor: string
  extractor_key: string
}

export interface ExtractRequest {
  url: string
}

export interface CreateJobRequest {
  url: string
  format: OutputFormat
  mode?: DownloadMode
  format_id?: string
  playlist_max?: number
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error'
  app: { uptime: number }
  ytDlp: { available: boolean; version: string | null }
  ffmpeg: { available: boolean; version: string | null }
  cookiesFile: { available: boolean; path: string | null }
  database: { available: boolean; jobCount: number }
}

export interface LoginResponse {
  ok: boolean
  remainingAttempts?: number
  lockoutUntil?: number | null
}

export interface SessionResponse {
  authenticated: boolean
  sessionId?: string
  createdAt?: number
  expiresAt?: number
}

export interface ExtractResponse {
  metadata: ExtractedMetadata
}

export interface ApiError {
  error: string
  code?: string
  details?: string
}
