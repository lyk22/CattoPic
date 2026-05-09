/**
 * Last-used upload form settings (compression, expiry, tags).
 * Single-file and ZIP flows share the same keys.
 */

export type UploadOutputFormat = 'webp' | 'avif' | 'both'

export interface UploadCompressionPrefs {
  compressionQuality: number
  compressionMaxWidth: number
  preserveAnimation: boolean
  outputFormat: UploadOutputFormat
}

export interface UploadSessionPrefs extends UploadCompressionPrefs {
  expiryMinutes: number
  selectedTags: string[]
}

const LS_QUALITY = 'cattopic_upload_quality'
const LS_MAX_WIDTH = 'cattopic_upload_max_width'
const LS_PRESERVE_ANIM = 'cattopic_upload_preserve_animation'
const LS_OUTPUT_FORMAT = 'cattopic_upload_output_format'
const LS_EXPIRY = 'cattopic_upload_expiry_minutes'
const LS_TAGS = 'cattopic_upload_tags'

const SESSION_DEFAULTS: UploadSessionPrefs = {
  compressionQuality: 90,
  compressionMaxWidth: 0,
  preserveAnimation: true,
  outputFormat: 'both',
  expiryMinutes: 0,
  selectedTags: [],
}

function parseTagsJson(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((t): t is string => typeof t === 'string' && t.length > 0 && t.length <= 128)
  } catch {
    return []
  }
}

/** Full upload form (compression + expiry + tags). */
export function loadUploadSessionPrefs(): UploadSessionPrefs {
  if (typeof window === 'undefined') {
    return { ...SESSION_DEFAULTS }
  }
  try {
    let compressionQuality = SESSION_DEFAULTS.compressionQuality
    const q = localStorage.getItem(LS_QUALITY)
    if (q != null) {
      const n = Number(q)
      if (Number.isFinite(n) && n >= 1 && n <= 100) compressionQuality = n
    }

    let compressionMaxWidth = SESSION_DEFAULTS.compressionMaxWidth
    const w = localStorage.getItem(LS_MAX_WIDTH)
    if (w != null) {
      const n = Number(w)
      if (Number.isFinite(n) && n >= 0 && n <= 8192) compressionMaxWidth = Math.trunc(n)
    }

    let preserveAnimation = SESSION_DEFAULTS.preserveAnimation
    const pa = localStorage.getItem(LS_PRESERVE_ANIM)
    if (pa === 'true' || pa === 'false') preserveAnimation = pa === 'true'

    let outputFormat = SESSION_DEFAULTS.outputFormat
    const fmt = localStorage.getItem(LS_OUTPUT_FORMAT)
    if (fmt === 'webp' || fmt === 'avif' || fmt === 'both') outputFormat = fmt

    let expiryMinutes = SESSION_DEFAULTS.expiryMinutes
    const ex = localStorage.getItem(LS_EXPIRY)
    if (ex != null) {
      const n = Number(ex)
      if (Number.isFinite(n) && n >= 0 && n <= 365 * 24 * 60) expiryMinutes = Math.trunc(n)
    }

    const selectedTags = parseTagsJson(localStorage.getItem(LS_TAGS))

    return {
      compressionQuality,
      compressionMaxWidth,
      preserveAnimation,
      outputFormat,
      expiryMinutes,
      selectedTags,
    }
  } catch {
    return { ...SESSION_DEFAULTS }
  }
}

export function persistUploadSessionPrefs(prefs: UploadSessionPrefs): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(LS_QUALITY, String(prefs.compressionQuality))
    localStorage.setItem(LS_MAX_WIDTH, String(prefs.compressionMaxWidth))
    localStorage.setItem(LS_PRESERVE_ANIM, String(prefs.preserveAnimation))
    localStorage.setItem(LS_OUTPUT_FORMAT, prefs.outputFormat)
    localStorage.setItem(LS_EXPIRY, String(prefs.expiryMinutes))
    localStorage.setItem(LS_TAGS, JSON.stringify(prefs.selectedTags.slice(0, 50)))
  } catch {
    // ignore quota / private mode
  }
}

export function loadUploadCompressionPrefs(): UploadCompressionPrefs {
  const s = loadUploadSessionPrefs()
  return {
    compressionQuality: s.compressionQuality,
    compressionMaxWidth: s.compressionMaxWidth,
    preserveAnimation: s.preserveAnimation,
    outputFormat: s.outputFormat,
  }
}

export function persistUploadCompressionPrefs(prefs: UploadCompressionPrefs): void {
  const cur = loadUploadSessionPrefs()
  persistUploadSessionPrefs({ ...cur, ...prefs })
}
