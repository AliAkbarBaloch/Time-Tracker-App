/**
 * US-025 — Timezone-aware date formatting utilities.
 *
 * All timestamps are stored as UTC.  These helpers convert UTC ISO strings
 * to the user's preferred IANA timezone for display and for datetime-local inputs.
 * No external libraries are required — everything uses the built-in Intl API.
 */

/**
 * Format a UTC ISO string using Intl.DateTimeFormat in the given IANA timezone.
 *
 * @param {string}  isoStr   - UTC ISO-8601 string
 * @param {string}  timezone - IANA timezone identifier (e.g. "Europe/Berlin")
 * @param {object}  options  - Intl.DateTimeFormat options (timeZone is overridden)
 * @returns {string} Formatted date/time string
 */
export function formatInZone(isoStr, timezone, options = {}) {
  if (!isoStr) return ''
  try {
    return new Intl.DateTimeFormat('default', { timeZone: timezone, ...options })
      .format(new Date(isoStr))
  } catch {
    // Fall back to browser's local time if the timezone is somehow invalid
    return new Intl.DateTimeFormat('default', options).format(new Date(isoStr))
  }
}

/**
 * Convert a UTC ISO string to the "YYYY-MM-DDTHH:MM" value required by
 * <input type="datetime-local">, expressed in the given timezone.
 *
 * @param {string} isoStr   - UTC ISO-8601 string
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} e.g. "2026-07-01T14:30"
 */
export function toDatetimeLocalInTz(isoStr, timezone) {
  if (!isoStr) return ''
  try {
    // en-CA locale gives YYYY-MM-DD date format, which is what datetime-local needs
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(isoStr)).map(({ type, value }) => [type, value])
    )
    // hour can be "24" in some environments at midnight; treat as "00"
    const hour = parts.hour === '24' ? '00' : parts.hour
    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
  } catch {
    // Fallback: format in browser's local timezone
    const d = new Date(isoStr)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

/**
 * Return the current time formatted as a datetime-local value in the given timezone.
 * Used to pre-fill task start/end time inputs with "now" in the user's zone.
 *
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} e.g. "2026-07-01T14:30"
 */
export function nowInTz(timezone) {
  return toDatetimeLocalInTz(new Date().toISOString(), timezone)
}

/**
 * Return the calendar date string "YYYY-MM-DD" for a UTC ISO timestamp
 * interpreted in the given timezone.
 *
 * This replaces the browser-locale-dependent `getLocalDateStr()` pattern
 * used in OverviewPage.
 *
 * @param {string} isoStr   - UTC ISO-8601 string
 * @param {string} timezone - IANA timezone identifier
 * @returns {string} e.g. "2026-07-01"
 */
export function getDateStrInTz(isoStr, timezone) {
  if (!isoStr) return ''
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
    })
    return formatter.format(new Date(isoStr))
  } catch {
    const d = new Date(isoStr)
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
}

/**
 * Get the "today" {year, month (1-indexed), day} in the given timezone.
 *
 * @param {string} timezone - IANA timezone identifier
 * @returns {{ year: number, month: number, day: number }}
 */
export function todayInTz(timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, parseInt(value)]))
  return { year: p.year, month: p.month, day: p.day }
}

/**
 * Convert a "naive" local date in the given IANA timezone to a UTC ISO string.
 *
 * Algorithm: treat the local time as if it were UTC (naive), measure the offset
 * the timezone would show for that UTC instant, then adjust by the offset.
 * One iteration is accurate for all standard and DST transitions.
 *
 * @param {number} year      - full year (e.g. 2026)
 * @param {number} month     - 1-indexed month (1=Jan, 12=Dec)
 * @param {number} day       - day of month
 * @param {number} hour      - hour (0-23)
 * @param {number} minute    - minute
 * @param {number} second    - second
 * @param {string} timezone  - IANA timezone identifier
 * @returns {string} UTC ISO-8601 string
 */
export function localDateToUtcIso(year, month, day, hour, minute, second, timezone) {
  try {
    // Start with a naive "UTC" interpretation of the local time
    const naive = Date.UTC(year, month - 1, day, hour, minute, second)

    // Measure what the target timezone shows for this naive UTC value
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    })
    const raw = Object.fromEntries(
      formatter.formatToParts(new Date(naive)).map(p => [p.type, parseInt(p.value)])
    )
    const shownHour = raw.hour === 24 ? 0 : raw.hour
    const shown = Date.UTC(raw.year, raw.month - 1, raw.day, shownHour, raw.minute, raw.second)

    // offset = naive - shown  (positive when tz is ahead of UTC)
    return new Date(naive + (naive - shown)).toISOString()
  } catch {
    // Fallback: treat local time as UTC (UTC timezone)
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString()
  }
}
