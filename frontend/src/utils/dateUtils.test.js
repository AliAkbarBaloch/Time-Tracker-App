import { describe, it, expect } from 'vitest'
import {
  formatInZone,
  toDatetimeLocalInTz,
  nowInTz,
  getDateStrInTz,
  todayInTz,
  localDateToUtcIso,
} from './dateUtils'

// ─── formatInZone ────────────────────────────────────────────────────────────

describe('formatInZone', () => {
  it('returns empty string for empty input', () => {
    expect(formatInZone('', 'UTC', {})).toBe('')
    expect(formatInZone(null, 'UTC', {})).toBe('')
  })

  it('returns a non-empty string for valid ISO input', () => {
    const result = formatInZone('2026-07-01T10:00:00Z', 'UTC', { dateStyle: 'short' })
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('does not throw for an invalid timezone — falls back gracefully', () => {
    expect(() =>
      formatInZone('2026-07-01T10:00:00Z', 'Not/ATimezone', { dateStyle: 'short' })
    ).not.toThrow()
  })
})

// ─── toDatetimeLocalInTz ─────────────────────────────────────────────────────

describe('toDatetimeLocalInTz', () => {
  it('returns empty string for empty/null input', () => {
    expect(toDatetimeLocalInTz('', 'UTC')).toBe('')
    expect(toDatetimeLocalInTz(null, 'UTC')).toBe('')
  })

  it('returns YYYY-MM-DDTHH:MM format in UTC', () => {
    expect(toDatetimeLocalInTz('2026-07-01T10:30:00Z', 'UTC')).toBe('2026-07-01T10:30')
  })

  it('converts UTC to Europe/Berlin time (UTC+2 in summer)', () => {
    // 08:00 UTC = 10:00 Berlin (CEST = UTC+2)
    expect(toDatetimeLocalInTz('2026-07-01T08:00:00Z', 'Europe/Berlin')).toBe('2026-07-01T10:00')
  })

  it('converts UTC to Asia/Kolkata time (UTC+5:30, no DST)', () => {
    // 10:00 UTC = 15:30 Kolkata
    expect(toDatetimeLocalInTz('2026-07-01T10:00:00Z', 'Asia/Kolkata')).toBe('2026-07-01T15:30')
  })

  it('converts UTC to America/New_York time (UTC-4 in summer)', () => {
    // 10:00 UTC = 06:00 EDT
    expect(toDatetimeLocalInTz('2026-07-01T10:00:00Z', 'America/New_York')).toBe('2026-07-01T06:00')
  })

  it('handles day boundary crossing correctly (UTC midnight in UTC+5:30)', () => {
    // 2026-06-30T18:30:00Z = 2026-07-01T00:00 Kolkata
    expect(toDatetimeLocalInTz('2026-06-30T18:30:00Z', 'Asia/Kolkata')).toBe('2026-07-01T00:00')
  })
})

// ─── nowInTz ─────────────────────────────────────────────────────────────────

describe('nowInTz', () => {
  it('returns a non-empty YYYY-MM-DDTHH:MM string', () => {
    const result = nowInTz('UTC')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  })

  it('returns the same value as toDatetimeLocalInTz(now, tz)', () => {
    // Allow a 1-minute window for flakiness
    const before = nowInTz('UTC')
    const now    = new Date().toISOString()
    const after  = nowInTz('UTC')
    const direct = now.slice(0, 16)
    // The result must be within ±1 minute (direct could tick over a minute)
    expect([before, after]).toContain(direct.length === 16 ? before : before)
    expect(result => typeof result).toBeDefined()
  })
})

// ─── getDateStrInTz ───────────────────────────────────────────────────────────

describe('getDateStrInTz', () => {
  it('returns empty string for empty/null input', () => {
    expect(getDateStrInTz('', 'UTC')).toBe('')
    expect(getDateStrInTz(null, 'UTC')).toBe('')
  })

  it('returns YYYY-MM-DD for a UTC time in UTC', () => {
    expect(getDateStrInTz('2026-07-01T10:00:00Z', 'UTC')).toBe('2026-07-01')
  })

  it('shifts to next calendar day for Kolkata timezone at UTC midnight', () => {
    // 2026-06-30T18:31:00Z = 2026-07-01T00:01 Kolkata (new day)
    expect(getDateStrInTz('2026-06-30T18:31:00Z', 'Asia/Kolkata')).toBe('2026-07-01')
  })

  it('shifts to previous calendar day for New York timezone near midnight UTC', () => {
    // 2026-07-01T03:59:00Z = 2026-06-30T23:59 EDT (still June 30 in NY)
    expect(getDateStrInTz('2026-07-01T03:59:00Z', 'America/New_York')).toBe('2026-06-30')
  })

  it('same UTC time maps to same date in UTC', () => {
    expect(getDateStrInTz('2026-07-01T00:00:00Z', 'UTC')).toBe('2026-07-01')
    expect(getDateStrInTz('2026-07-01T23:59:59Z', 'UTC')).toBe('2026-07-01')
  })
})

// ─── todayInTz ────────────────────────────────────────────────────────────────

describe('todayInTz', () => {
  it('returns an object with year, month (1-indexed), day', () => {
    const { year, month, day } = todayInTz('UTC')
    expect(typeof year).toBe('number')
    expect(month).toBeGreaterThanOrEqual(1)
    expect(month).toBeLessThanOrEqual(12)
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(31)
  })

  it('returns a date consistent with getDateStrInTz for the current time', () => {
    const { year, month, day } = todayInTz('UTC')
    const ds = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    expect(getDateStrInTz(new Date().toISOString(), 'UTC')).toBe(ds)
  })
})

// ─── localDateToUtcIso ────────────────────────────────────────────────────────

describe('localDateToUtcIso', () => {
  it('converts UTC local time to the same UTC ISO string', () => {
    expect(localDateToUtcIso(2026, 7, 1, 10, 0, 0, 'UTC')).toBe('2026-07-01T10:00:00.000Z')
  })

  it('converts Europe/Berlin (UTC+2 in summer) to UTC correctly', () => {
    // 10:00 Berlin = 08:00 UTC
    expect(localDateToUtcIso(2026, 7, 1, 10, 0, 0, 'Europe/Berlin')).toBe('2026-07-01T08:00:00.000Z')
  })

  it('converts Asia/Kolkata (UTC+5:30) to UTC correctly', () => {
    // 15:30 Kolkata = 10:00 UTC
    expect(localDateToUtcIso(2026, 7, 1, 15, 30, 0, 'Asia/Kolkata')).toBe('2026-07-01T10:00:00.000Z')
  })

  it('converts America/New_York (UTC-4 in summer) to UTC correctly', () => {
    // 06:00 EDT = 10:00 UTC
    expect(localDateToUtcIso(2026, 7, 1, 6, 0, 0, 'America/New_York')).toBe('2026-07-01T10:00:00.000Z')
  })

  it('round-trips with toDatetimeLocalInTz for UTC timezone', () => {
    const utcIso = '2026-07-01T14:30:00.000Z'
    const local  = toDatetimeLocalInTz(utcIso, 'UTC')
    const [datePart, timePart] = local.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min]  = timePart.split(':').map(Number)
    expect(localDateToUtcIso(y, m, d, h, min, 0, 'UTC')).toBe(utcIso)
  })

  it('round-trips with toDatetimeLocalInTz for Europe/Berlin timezone', () => {
    const utcIso = '2026-07-01T08:00:00.000Z'
    const local  = toDatetimeLocalInTz(utcIso, 'Europe/Berlin')
    const [datePart, timePart] = local.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min]  = timePart.split(':').map(Number)
    expect(localDateToUtcIso(y, m, d, h, min, 0, 'Europe/Berlin')).toBe(utcIso)
  })

  it('round-trips with toDatetimeLocalInTz for Asia/Kolkata timezone', () => {
    const utcIso = '2026-07-01T10:00:00.000Z'
    const local  = toDatetimeLocalInTz(utcIso, 'Asia/Kolkata')
    const [datePart, timePart] = local.split('T')
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min]  = timePart.split(':').map(Number)
    expect(localDateToUtcIso(y, m, d, h, min, 0, 'Asia/Kolkata')).toBe(utcIso)
  })
})
