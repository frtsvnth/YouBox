const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g
const MULTI_UNDERSCORE = /_+/g
const LEADING_TRAILING_DOT = /^\.+|\.+$/g
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function sanitizeFilename(name: string, extension: string): string {
  let base = name.trim()
  if (!base) return `download${extension}`

  base = base.replace(INVALID_CHARS, '_')
  base = base.replace(/\s+/g, '_')
  base = base.replace(MULTI_UNDERSCORE, '_')
  base = base.replace(LEADING_TRAILING_DOT, '')
  base = base.replace(RESERVED_NAMES, '_$1')

  if (!base) return `download${extension}`

  const maxLen = 120
  if (base.length > maxLen) {
    base = base.slice(0, maxLen).replace(/_+$/, '')
  }

  return `${base}${extension}`
}

export function safeDownloadFilename(title: string | null, ext: string): string {
  const fallbackTitle = 'download'
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`
  return sanitizeFilename(title ?? fallbackTitle, safeExt)
}
