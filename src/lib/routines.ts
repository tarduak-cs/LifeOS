import { supabase } from './supabase'

export type RoutineItem = { id: string; text: string; position?: number }
export type RoutineCompletion = {
  morning?: string[]
  night?: string[]
  skipReasons?: Record<string, string>
}

const DEFAULT_MORNING = [
  'Drink water (hydration)',
  'Make bed',
  'Walk / get morning sunlight',
  'Stretch / mobility',
  'Yoga',
  'Meditation',
  'Log health metrics',
  'Review day plan',
]

const DEFAULT_NIGHT = [
  'Brush + skincare',
  'Read 10 min',
  'Journal entry',
  'Plan tomorrow',
  'Lights out by 11pm',
  'Phone away by 10pm',
]

export async function loadRoutineItems(): Promise<{ morning: RoutineItem[]; night: RoutineItem[] }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { morning: [], night: [] }

  const { data, error } = await supabase
    .from('routine_items')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (error) {
    console.error('loadRoutineItems error:', error)
    return { morning: [], night: [] }
  }

  let morning: RoutineItem[] = (data ?? []).filter((r: any) => r.type === 'morning').map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
  let night: RoutineItem[] = (data ?? []).filter((r: any) => r.type === 'night').map((r: any) => ({ id: r.id, text: r.text, position: r.position }))

  if (morning.length === 0) {
    const rows = DEFAULT_MORNING.map((text, i) => ({ user_id: user.id, type: 'morning', text, position: i }))
    const { data: seeded } = await supabase.from('routine_items').insert(rows).select('*')
    morning = (seeded ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
  }
  if (night.length === 0) {
    const rows = DEFAULT_NIGHT.map((text, i) => ({ user_id: user.id, type: 'night', text, position: i }))
    const { data: seeded } = await supabase.from('routine_items').insert(rows).select('*')
    night = (seeded ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
  }

  return { morning, night }
}

export async function saveRoutineItems(type: 'morning' | 'night', items: RoutineItem[]): Promise<RoutineItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return items

  await supabase.from('routine_items').delete().eq('user_id', user.id).eq('type', type)
  if (items.length === 0) return []

  const rows = items.map((item, i) => ({
    user_id: user.id,
    type,
    text: item.text,
    position: i,
  }))
  const { data, error } = await supabase.from('routine_items').insert(rows).select('*')
  if (error) {
    console.error('saveRoutineItems error:', error)
    return items
  }
  return (data ?? []).map((r: any) => ({ id: r.id, text: r.text, position: r.position }))
}

export async function loadRoutineCompletions(): Promise<Record<string, RoutineCompletion>> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('routine_completions')
    .select('date, routine_item_id, type, skip_reasons')
    .eq('user_id', user.id)

  if (error) {
    console.error('loadRoutineCompletions error:', error)
    return {}
  }

  const map: Record<string, RoutineCompletion> = {}
  for (const row of (data ?? []) as any[]) {
    if (!map[row.date]) {
      map[row.date] = { morning: [], night: [], skipReasons: {} }
    }
    if (row.type === 'morning' && row.routine_item_id) {
      map[row.date].morning!.push(row.routine_item_id)
    }
    if (row.type === 'night' && row.routine_item_id) {
      map[row.date].night!.push(row.routine_item_id)
    }
    if (row.skip_reasons && typeof row.skip_reasons === 'object' && !Array.isArray(row.skip_reasons)) {
      map[row.date].skipReasons = { ...map[row.date].skipReasons, ...row.skip_reasons }
    }
  }
  return map
}

export async function saveRoutineCompletionsForDate(
  date: string,
  morning: string[],
  night: string[],
  skipReasons: Record<string, string> = {}
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('routine_completions').delete().eq('user_id', user.id).eq('date', date)

  const rows: any[] = []
  for (const id of morning) rows.push({ user_id: user.id, date, routine_item_id: id, type: 'morning', skip_reasons: {} })
  for (const id of night) rows.push({ user_id: user.id, date, routine_item_id: id, type: 'night', skip_reasons: {} })

  if (Object.keys(skipReasons).length > 0 && rows.length > 0) {
    rows[0].skip_reasons = skipReasons
  } else if (Object.keys(skipReasons).length > 0 && rows.length === 0) {
    rows.push({ user_id: user.id, date, routine_item_id: null, type: 'skip_meta', skip_reasons: skipReasons })
  }

  if (rows.length === 0) return

  const { error } = await supabase.from('routine_completions').insert(rows)
  if (error) console.error('saveRoutineCompletionsForDate error:', error)
}