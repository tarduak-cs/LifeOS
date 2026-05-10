// Parser for Oura's daily summary CSV export.
// Got via cloud.ouraring.com → Trends → Download → CSV.
//
// Oura's column names vary by app version, so we auto-detect by matching
// common variations of each header name.
//
// Outputs rows ready to upsert into health_logs.

import { supabase } from '../supabase'
import type { HealthLogEntry } from '../health'

export type OuraParseResult = {
  imported: number
  skipped: number
  total: number
  error?: string
}

// Robust CSV line splitter (handles quoted fields with commas)
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out
}

// Find column index by trying multiple header name variations
function findColumn(headers: string[], variants: string[]): number {
  const normalized = headers.map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
  for (const v of variants) {
    const target = v.toLowerCase().replace(/[^a-z0-9]/g, '')
    const idx = normalized.indexOf(target)
    if (idx !== -1) return idx
  }
  return -1
}

// Parse Oura time string. Oura usually outputs ISO format like
// "2026-05-09T23:30:00+00:00" or just "2026-05-09".
function parseDate(str: string): string | null {
  if (!str) return null
  // Handle "YYYY-MM-DD" directly
  const dateOnly = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`
  return null
}

// Convert Oura's "HH:MM" or ISO timestamp to "HH:MM"
function parseTime(str: string): string | null {
  if (!str) return null
  // ISO timestamp: "2026-05-09T23:30:00+00:00" → "23:30"
  const isoMatch = str.match(/T(\d{2}):(\d{2})/)
  if (isoMatch) return `${isoMatch[1]}:${isoMatch[2]}`
  // Just "HH:MM" or "HH:MM:SS"
  const timeMatch = str.match(/^(\d{2}):(\d{2})/)
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`
  return null
}

export function parseOuraCsv(csvText: string): {
  rows: { date: string; entry: HealthLogEntry }[]
  total: number
  skipped: number
} {
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], total: 0, skipped: 0 }

  const headers = splitCsvLine(lines[0])

  const idx = {
    date: findColumn(headers, ['date', 'day', 'summarydate']),
    sleepDuration: findColumn(headers, ['totalsleepduration', 'sleepduration', 'totalsleep', 'asleeptime']),
    rhr: findColumn(headers, ['averagerestingheartrate', 'restingheartrate', 'lowestrestingheartrate']),
    rhrLow: findColumn(headers, ['lowestrestingheartrate', 'minimumheartrate']),
    hrv: findColumn(headers, ['averagehrv', 'hrv', 'averagehrvbalance']),
    bedtimeStart: findColumn(headers, ['bedtimestart', 'sleepstart', 'sleeponset']),
    bedtimeEnd: findColumn(headers, ['bedtimeend', 'sleepend', 'wakeuptime', 'wakeonset']),
  }

  if (idx.date === -1) {
    return { rows: [], total: 0, skipped: 0 }
  }

  const byDate: Record<string, { entry: HealthLogEntry; score: number }> = {}
  let total = 0
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    total++
    const cols = splitCsvLine(lines[i])
    const date = parseDate(cols[idx.date])
    if (!date) {
      skipped++
      continue
    }

    const entry: HealthLogEntry = {}
    let score = 0

    // Sleep duration: Oura provides in SECONDS — convert to hours
    if (idx.sleepDuration !== -1 && cols[idx.sleepDuration]) {
      const seconds = Number(cols[idx.sleepDuration])
      if (!isNaN(seconds) && seconds > 0) {
        // If value is huge it's seconds, if smaller maybe minutes, if tiny it's hours
        let hours: number
        if (seconds > 10000) hours = seconds / 3600        // seconds
        else if (seconds > 60) hours = seconds / 60         // minutes
        else hours = seconds                                 // already hours
        entry.sleepHours = Math.round(hours * 10) / 10
        score++
      }
    }

    // RHR: prefer average, fall back to lowest
    let rhrValue: number | null = null
    if (idx.rhr !== -1 && cols[idx.rhr]) {
      const v = Number(cols[idx.rhr])
      if (!isNaN(v) && v > 0) rhrValue = v
    }
    if (rhrValue === null && idx.rhrLow !== -1 && cols[idx.rhrLow]) {
      const v = Number(cols[idx.rhrLow])
      if (!isNaN(v) && v > 0) rhrValue = v
    }
    if (rhrValue !== null) {
      entry.rhr = Math.round(rhrValue)
      score++
    }

    // HRV
    if (idx.hrv !== -1 && cols[idx.hrv]) {
      const v = Number(cols[idx.hrv])
      if (!isNaN(v) && v > 0) {
        entry.hrv = Math.round(v)
        score++
      }
    }

    // Bedtime / wake time
    if (idx.bedtimeStart !== -1 && cols[idx.bedtimeStart]) {
      const t = parseTime(cols[idx.bedtimeStart])
      if (t) {
        entry.sleepTime = t
        score++
      }
    }
    if (idx.bedtimeEnd !== -1 && cols[idx.bedtimeEnd]) {
      const t = parseTime(cols[idx.bedtimeEnd])
      if (t) {
        entry.wakeTime = t
        score++
      }
    }

    if (score === 0) {
      skipped++
      continue
    }

    // If multiple rows for same date, keep the more complete one
    if (byDate[date] && byDate[date].score >= score) continue
    byDate[date] = { entry, score }
  }

  return {
    rows: Object.entries(byDate).map(([date, v]) => ({ date, entry: v.entry })),
    total,
    skipped,
  }
}

export async function importOuraCsv(csvText: string): Promise<OuraParseResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imported: 0, skipped: 0, total: 0, error: 'Not logged in' }

  const { rows, total, skipped } = parseOuraCsv(csvText)
  if (rows.length === 0) {
    return {
      imported: 0,
      skipped,
      total,
      error: 'No usable rows found. Make sure you exported from cloud.ouraring.com → Trends → Download.',
    }
  }

  // Fetch existing rows to merge (don't overwrite mood/energy/notes)
  const dates = rows.map(r => r.date)
  const { data: existing } = await supabase
    .from('health_logs')
    .select('*')
    .eq('user_id', user.id)
    .in('date', dates)

  const existingMap: Record<string, any> = {}
  for (const row of (existing ?? []) as any[]) {
    existingMap[row.date] = row
  }

  const payload = rows.map(({ date, entry }) => {
    const ex = existingMap[date] || {}
    return {
      user_id: user.id,
      date,
      sleep_time: entry.sleepTime ?? ex.sleep_time ?? null,
      wake_time: entry.wakeTime ?? ex.wake_time ?? null,
      sleep_hours: entry.sleepHours ?? ex.sleep_hours ?? null,
      rhr: entry.rhr ?? ex.rhr ?? null,
      hrv: entry.hrv ?? ex.hrv ?? null,
      mood: ex.mood ?? null,
      energy: ex.energy ?? null,
      weight: ex.weight ?? null,
      notes: ex.notes ?? null,
      updated_at: new Date().toISOString(),
    }
  })

  // Chunked upsert (Supabase has request size limits)
  const CHUNK = 500
  let imported = 0
  for (let i = 0; i < payload.length; i += CHUNK) {
    const slice = payload.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('health_logs')
      .upsert(slice, { onConflict: 'user_id,date' })
    if (error) {
      return { imported, skipped, total, error: error.message }
    }
    imported += slice.length
  }

  return { imported, skipped, total }
}