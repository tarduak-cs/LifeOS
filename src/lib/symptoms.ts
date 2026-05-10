import { supabase } from './supabase'

export type Symptom = {
  id: string
  name: string
}

export type SymptomLogMap = Record<string, Record<string, number>>
// e.g. { "2026-05-09": { "uuid-1": 3, "uuid-2": 0 } }

// ============ SYMPTOMS (the items) ============

export async function loadSymptoms(): Promise<Symptom[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('symptoms')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('loadSymptoms error:', error)
    return []
  }

  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name }))
}

// Save the entire list (delete + re-insert).
// Symptoms don't auto-seed — users add their own.
export async function saveSymptoms(items: Symptom[]): Promise<Symptom[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return items

  await supabase.from('symptoms').delete().eq('user_id', user.id)

  if (items.length === 0) return []
  const rows = items.map(item => ({
    user_id: user.id,
    name: item.name,
  }))
  const { data, error } = await supabase
    .from('symptoms')
    .insert(rows)
    .select('*')

  if (error) {
    console.error('saveSymptoms error:', error)
    return items
  }
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name }))
}

// ============ SYMPTOM LOGS (severity per day) ============

export async function loadSymptomLogs(): Promise<SymptomLogMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('symptom_logs')
    .select('date, symptom_id, severity')
    .eq('user_id', user.id)

  if (error) {
    console.error('loadSymptomLogs error:', error)
    return {}
  }

  const map: SymptomLogMap = {}
  for (const row of (data ?? []) as any[]) {
    if (!map[row.date]) map[row.date] = {}
    map[row.date][row.symptom_id] = row.severity
  }
  return map
}

export async function saveSymptomLogsForDate(
  date: string,
  log: Record<string, number>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('symptom_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('date', date)

  const entries = Object.entries(log)
  if (entries.length === 0) return

  const rows = entries.map(([symptom_id, severity]) => ({
    user_id: user.id,
    date,
    symptom_id,
    severity,
  }))

  const { error } = await supabase
    .from('symptom_logs')
    .insert(rows)

  if (error) console.error('saveSymptomLogsForDate error:', error)
}