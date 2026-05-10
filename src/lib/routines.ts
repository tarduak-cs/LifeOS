import { supabase } from './supabase'

// ============ TYPES ============
export type RoutineItem = {
  id: string          // uuid from supabase
  text: string
  position: number
}

export type RoutineCompletionMap = Record<string, { morning: string[]; night: string[] }>

// ============ DEFAULTS (seeded on first login) ============
const DEFAULT_MORNING_TEXTS = [
  'Drink water (hydration)',
  'Make bed',
  'Walk / fresh air',
  'Stretch / mobility',
  'Yoga',
  'Meditation',
  'Log health metrics',
  'Review day plan',
]

const DEFAULT_NIGHT_TEXTS = [
  'Phone away by 10pm',
  'Brush + skincare',
  'Read 10 min',
  'Journal entry',
  'Plan tomorrow',
  'Lights out by 11pm',
]

// ============ ROUTINE ITEMS ============

// Load morning + night items. If user has zero items of a type, seeds defaults.
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

  let morning = (data ?? []).filter(r => r.type === 'morning').map(toItem)
  let night = (data ?? []).filter(r => r.type === 'night').map(toItem)

  // Auto-seed defaults if user has none of a type
  if (morning.length === 0) {
    morning = await seedDefaults(user.id, 'morning', DEFAULT_MORNING_TEXTS)
  }
  if (night.length === 0) {
    night = await seedDefaults(user.id, 'night', DEFAULT_NIGHT_TEXTS)
  }

  return { morning, night }
}

function toItem(r: any): RoutineItem {
  return { id: r.id, text: r.text, position: r.position }
}

async function seedDefaults(userId: string, type: 'morning' | 'night', texts: string[]): Promise<RoutineItem[]> {
  const rows = texts.map((text, i) => ({
    user_id: userId,
    type,
    text,
    position: i,
  }))
  const { data, error } = await supabase
    .from('routine_items')
    .insert(rows)
    .select('*')

  if (error) {
    console.error(`seedDefaults ${type} error:`, error)
    return []
  }
  return (data ?? []).map(toItem)
}

// Save the entire list (full sync — wipes user's items of this type and re-inserts).
// Simpler than diffing; routines are small (max ~20 items).
export async function saveRoutineItems(type: 'morning' | 'night', items: RoutineItem[]): Promise<RoutineItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return items

  // Delete all existing items of this type
  await supabase
    .from('routine_items')
    .delete()
    .eq('user_id', user.id)
    .eq('type', type)

  // Re-insert with fresh positions
  if (items.length === 0) return []
  const rows = items.map((item, i) => ({
    user_id: user.id,
    type,
    text: item.text,
    position: i,
  }))
  const { data, error } = await supabase
    .from('routine_items')
    .insert(rows)
    .select('*')

  if (error) {
    console.error('saveRoutineItems error:', error)
    return items
  }
  return (data ?? []).map(toItem)
}

// ============ ROUTINE COMPLETIONS ============

// Load all completions for the current user, keyed by date.
export async function loadRoutineCompletions(): Promise<RoutineCompletionMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Need to join routine_completions with routine_items to know type.
  const { data, error } = await supabase
    .from('routine_completions')
    .select('date, routine_item_id, routine_items!inner(type)')
    .eq('user_id', user.id)

  if (error) {
    console.error('loadRoutineCompletions error:', error)
    return {}
  }

  const map: RoutineCompletionMap = {}
  for (const row of (data ?? []) as any[]) {
    const date = row.date
    const type = row.routine_items.type as 'morning' | 'night'
    if (!map[date]) map[date] = { morning: [], night: [] }
    map[date][type].push(row.routine_item_id)
  }
  return map
}

// Save completions for a single day (full sync for that day).
export async function saveRoutineCompletionsForDate(
  date: string,
  morningIds: string[],
  nightIds: string[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // Delete all completions for this user/date
  await supabase
    .from('routine_completions')
    .delete()
    .eq('user_id', user.id)
    .eq('date', date)

  const allIds = [...morningIds, ...nightIds]
  if (allIds.length === 0) return

  const rows = allIds.map(id => ({
    user_id: user.id,
    date,
    routine_item_id: id,
  }))

  const { error } = await supabase
    .from('routine_completions')
    .insert(rows)

  if (error) console.error('saveRoutineCompletionsForDate error:', error)
}