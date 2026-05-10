import { supabase } from './supabase'

export type Behavior = {
  id: string
  text: string
  position: number
}

export type BehaviorLogMap = Record<string, Record<string, boolean>>
// e.g. { "2026-05-09": { "uuid-1": true, "uuid-2": false } }

const DEFAULT_BEHAVIOR_TEXTS = [
  'Caffeine after 2pm',
  'Alcohol',
  'Screens in bed',
  'Late meal',
  'High stress day',
]

// ============ BEHAVIORS (the items) ============

export async function loadBehaviors(): Promise<Behavior[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('behaviors')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) {
    console.error('loadBehaviors error:', error)
    return []
  }

  let items: Behavior[] = (data ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))

  // Auto-seed defaults if empty
  if (items.length === 0) {
    const rows = DEFAULT_BEHAVIOR_TEXTS.map((text, i) => ({
      user_id: user.id,
      text,
      position: i,
    }))
    const { data: seeded, error: seedErr } = await supabase
      .from('behaviors')
      .insert(rows)
      .select('*')
    if (seedErr) {
      console.error('seed behaviors error:', seedErr)
      return []
    }
    items = (seeded ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
  }

  return items
}

// Save the entire list (delete + re-insert).
export async function saveBehaviors(items: Behavior[]): Promise<Behavior[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return items

  await supabase.from('behaviors').delete().eq('user_id', user.id)

  if (items.length === 0) return []
  const rows = items.map((item, i) => ({
    user_id: user.id,
    text: item.text,
    position: i,
  }))
  const { data, error } = await supabase
    .from('behaviors')
    .insert(rows)
    .select('*')

  if (error) {
    console.error('saveBehaviors error:', error)
    return items
  }
  return (data ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
}

// ============ BEHAVIOR LOGS (the daily yes/no answers) ============

export async function loadBehaviorLogs(): Promise<BehaviorLogMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('behavior_logs')
    .select('date, behavior_id, value')
    .eq('user_id', user.id)

  if (error) {
    console.error('loadBehaviorLogs error:', error)
    return {}
  }

  const map: BehaviorLogMap = {}
  for (const row of (data ?? []) as any[]) {
    if (!map[row.date]) map[row.date] = {}
    map[row.date][row.behavior_id] = row.value
  }
  return map
}

// Save behavior logs for a single day. We replace all entries for that user/date.
export async function saveBehaviorLogsForDate(
  date: string,
  log: Record<string, boolean>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Delete existing for this user/date
  await supabase
    .from('behavior_logs')
    .delete()
    .eq('user_id', user.id)
    .eq('date', date)

  const entries = Object.entries(log)
  if (entries.length === 0) return

  const rows = entries.map(([behavior_id, value]) => ({
    user_id: user.id,
    date,
    behavior_id,
    value,
  }))

  const { error } = await supabase
    .from('behavior_logs')
    .insert(rows)

  if (error) console.error('saveBehaviorLogsForDate error:', error)
}