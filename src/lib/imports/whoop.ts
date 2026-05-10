// Parser for Whoop's physiological_cycles.csv export.
// Pulls only RHR, HRV, sleep duration, sleep time, wake time.
// Outputs rows ready to upsert into the health_logs table.

import { supabase } from '../supabase'
import type { HealthLogEntry } from '../health'

// Expected columns in Whoop's physiological_cycles.csv:
//   Cycle start time         e.g. "2026-05-08 22:11:08"
//   Cycle timezone           e.g. "UTC-04:00"
//   Resting heart rate (bpm)
//   Heart rate variability (ms)
//   Sleep onset              e.g. "2026-05-08 22:11:08"
//   Wake onset               e.g. "2026-05-09 07:59:39"
//   Asleep duration (min)

export type WhoopParseResult = {
  imported: number
  skipped: number
  total: number
  error?: string
}

type WhoopRow = {
  date: string                    // YYYY-MM-DD in local time
  entry: HealthLogEntry
  dataScore: number               // how filled in is this row (we keep the best one per day)
}

// Parse the timezone offset string Whoop uses ("UTC-04:00" or "UTC+05:30")
// into total minutes. Returns 0 if unparseable.
function parseTimezoneOffset(tz: string): number {
  if (!tz) return 0
  const match = tz.match(/UTC([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const sign = match[1] === '+' ? 1 : -1
  const hours = parseInt(match[2], 10)
  const minutes = parseInt(match[3], 10)
  return sign * (hours * 60 + minutes)
}

// Take a Whoop timestamp like "2026-05-08 22:11:08" plus a timezone offset
// in minutes, and return a Date object representing that local moment.
function parseWhoopTime(timestamp: string, tzOffsetMinutes: number): Date | null {
  if (!timestamp) return null
  // Whoop timestamps are in the cycle's local time but written without offset.
  // Treat them as UTC, then we have the right "wall clock" reading already.
  const d = new Date(timestamp.replace(' ', 'T') + 'Z')
  if (isNaN(d.getTime())) return null
  return d
}

// Format a Date's UTC parts as YYYY-MM-DD (since we treated the time as UTC,
// the UTC parts ARE the local parts).
function formatLocalDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Format a Date's UTC parts as HH:MM (local wall-clock time).
function formatLocalTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, '0')
  const m = String(d.getUTCMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

// Robust CSV line splitter — handles fields wrapped in double quotes that
// contain commas. Whoop doesn't currently use quoted fields but it's safer.
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

// Parse a Whoop physiological_cycles.csv into one row per LOCAL DATE.
// If multiple cycles share a date (rare), keep the one with the most data.
export function parseWhoopCsv(csvText: string): { rows: WhoopRow[]; total: number; skipped: number } {
  const lines = csvText.trim().split(/\r?\n/)
  if (lines.length < 2) return { rows: [], total: 0, skipped: 0 }

  const headers = splitCsvLine(lines[0]).map(h => h.trim())

  const findIdx = (...names: string[]) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.toLowerCase() === n.toLowerCase())
      if (i !== -1) return i
    }
    return -1
  }

  const idx = {
    cycleStart: findIdx('Cycle start time'),
    timezone: findIdx('Cycle timezone'),
    rhr: findIdx('Resting heart rate (bpm)'),
    hrv: findIdx('Heart rate variability (ms)'),
    sleepOnset: findIdx('Sleep onset'),
    wakeOnset: findIdx('Wake onset'),
    sleepDur: findIdx('Asleep duration (min)'),
  }

  if (idx.cycleStart === -1) {
    return { rows: [], total: 0, skipped: 0 }
  }

  const byDate: Record<string, WhoopRow> = {}
  let total = 0
  let skipped = 0

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    total++
    const cols = splitCsvLine(lines[i])

    const cycleStartStr = cols[idx.cycleStart]
    const tzStr = idx.timezone !== -1 ? cols[idx.timezone] : ''
    const tzOffset = parseTimezoneOffset(tzStr)

    const cycleStart = parseWhoopTime(cycleStartStr, tzOffset)
    if (!cycleStart) { skipped++; continue }

    const date = formatLocalDate(cycleStart)

    const entry: HealthLogEntry = {}
    let dataScore = 0

    if (idx.rhr !== -1 && cols[idx.rhr] && !isNaN(Number(cols[idx.rhr]))) {
      entry.rhr = Math.round(Number(cols[idx.rhr]))
      dataScore++
    }
    if (idx.hrv !== -1 && cols[idx.hrv] && !isNaN(Number(cols[idx.hrv]))) {
      entry.hrv = Math.round(Number(cols[idx.hrv]))
      dataScore++
    }
    if (idx.sleepDur !== -1 && cols[idx.sleepDur] && !isNaN(Number(cols[idx.sleepDur]))) {
      entry.sleepHours = Math.round((Number(cols[idx.sleepDur]) / 60) * 10) / 10
      dataScore++
    }
    if (idx.sleepOnset !== -1 && cols[idx.sleepOnset]) {
      const t = parseWhoopTime(cols[idx.sleepOnset], tzOffset)
      if (t) { entry.sleepTime = formatLocalTime(t); dataScore++ }
    }
    if (idx.wakeOnset !== -1 && cols[idx.wakeOnset]) {
      const t = parseWhoopTime(cols[idx.wakeOnset], tzOffset)
      if (t) { entry.wakeTime = formatLocalTime(t); dataScore++ }
    }

    // Skip rows with no useful data
    if (dataScore === 0) { skipped++; continue }

    // If we already have an entry for this date, keep the one with more data
    if (byDate[date] && byDate[date].dataScore >= dataScore) continue
    byDate[date] = { date, entry, dataScore }
  }

  return { rows: Object.values(byDate), total, skipped }
}

// Import Whoop CSV into Supabase health_logs.
// Merges with existing rows (so manually-logged mood/energy/notes survive).
export async function importWhoopCsv(csvText: string): Promise<WhoopParseResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { imported: 0, skipped: 0, total: 0, error: 'Not logged in' }

  const { rows, total, skipped } = parseWhoopCsv(csvText)
  if (rows.length === 0) {
    return { imported: 0, skipped, total, error: 'No usable rows found in CSV' }
  }

  // Fetch existing health_logs for these dates so we don't blow away
  // mood/energy/notes/weight that the user already entered manually.
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

  // Build the upsert payload — keep existing fields, overwrite Whoop ones.
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

  // Supabase has a default 1000-row limit per request, so chunk.
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