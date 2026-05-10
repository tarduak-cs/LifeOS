import { supabase } from './supabase'

// Shape used by the React UI: object keyed by date string ("2026-05-09")
export type HealthLogEntry = {
  sleepTime?: string
  wakeTime?: string
  sleepHours?: number
  rhr?: number
  hrv?: number
  mood?: number
  energy?: number
  weight?: number
  notes?: string
}

export type HealthLogMap = Record<string, HealthLogEntry>

// Shape stored in the database (snake_case columns, time fields are 'HH:MM:SS')
type HealthLogRow = {
  date: string
  sleep_time: string | null
  wake_time: string | null
  sleep_hours: number | null
  rhr: number | null
  hrv: number | null
  mood: number | null
  energy: number | null
  weight: number | null
  notes: string | null
}

// Convert a DB row to the UI's entry shape (drop nulls, rename fields).
function rowToEntry(row: HealthLogRow): HealthLogEntry {
  const e: HealthLogEntry = {}
  if (row.sleep_time) e.sleepTime = row.sleep_time.slice(0, 5)  // 'HH:MM:SS' -> 'HH:MM'
  if (row.wake_time) e.wakeTime = row.wake_time.slice(0, 5)
  if (row.sleep_hours !== null) e.sleepHours = Number(row.sleep_hours)
  if (row.rhr !== null) e.rhr = row.rhr
  if (row.hrv !== null) e.hrv = row.hrv
  if (row.mood !== null) e.mood = row.mood
  if (row.energy !== null) e.energy = row.energy
  if (row.weight !== null) e.weight = Number(row.weight)
  if (row.notes) e.notes = row.notes
  return e
}

// Load every health log for the current user, return as a date-keyed map.
export async function loadHealthLogs(): Promise<HealthLogMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('health_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    console.error('loadHealthLogs error:', error)
    return {}
  }

  const map: HealthLogMap = {}
  for (const row of (data ?? []) as HealthLogRow[]) {
    map[row.date] = rowToEntry(row)
  }
  return map
}

// Save (upsert) a single day's health log.
// We upsert because the user might log the same day multiple times.
export async function saveHealthLog(date: string, entry: HealthLogEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const row = {
    user_id: user.id,
    date,
    sleep_time: entry.sleepTime || null,
    wake_time: entry.wakeTime || null,
    sleep_hours: entry.sleepHours ?? null,
    rhr: entry.rhr ?? null,
    hrv: entry.hrv ?? null,
    mood: entry.mood ?? null,
    energy: entry.energy ?? null,
    weight: entry.weight ?? null,
    notes: entry.notes || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('health_logs')
    .upsert(row, { onConflict: 'user_id,date' })

  if (error) console.error('saveHealthLog error:', error)
}