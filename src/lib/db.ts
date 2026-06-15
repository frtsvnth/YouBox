import Database from 'better-sqlite3'
import { env } from './env'
import fs from 'node:fs'
import path from 'node:path'

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db
  const dbDir = path.dirname(env.DB_PATH())
  fs.mkdirSync(dbDir, { recursive: true })
  _db = new Database(env.DB_PATH())
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  runMigrations(_db)
  return _db
}

const MIGRATIONS: string[] = [
  // v1: initial schema
  `
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id            TEXT PRIMARY KEY,
      url           TEXT NOT NULL,
      format        TEXT NOT NULL DEFAULT 'mp4',
      status        TEXT NOT NULL DEFAULT 'created'
                    CHECK(status IN ('created','extracting','queued','downloading','muxing','ready','failed','expired')),
      title         TEXT,
      filename      TEXT,
      filesize      INTEGER,
      error_message TEXT,
      progress      REAL DEFAULT 0,
      created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at    INTEGER NOT NULL DEFAULT (unixepoch()),
      ready_at      INTEGER,
      expires_at    INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
  `,
  // v2: login_attempts, mode column, playlist fields
  `
    CREATE TABLE IF NOT EXISTS login_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      attempted_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_at ON login_attempts(attempted_at);
    ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'video';
    ALTER TABLE jobs ADD COLUMN playlist_index INTEGER;
    ALTER TABLE jobs ADD COLUMN playlist_size INTEGER;
  `,
  // v3: format_id
  `
    ALTER TABLE jobs ADD COLUMN format_id TEXT;
  `,
  // v4: progress details, current_stage
  `
    ALTER TABLE jobs ADD COLUMN progress_downloaded INTEGER;
    ALTER TABLE jobs ADD COLUMN progress_total INTEGER;
    ALTER TABLE jobs ADD COLUMN progress_speed REAL;
    ALTER TABLE jobs ADD COLUMN progress_eta INTEGER;
    ALTER TABLE jobs ADD COLUMN current_stage TEXT DEFAULT '';
  `,
]

function runMigrations(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number

  for (let v = currentVersion; v < MIGRATIONS.length; v++) {
    const migration = MIGRATIONS[v]
    if (!migration) continue

    db.exec(migration)
    db.pragma(`user_version = ${v + 1}`)
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}
