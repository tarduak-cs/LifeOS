import { supabase } from './supabase'

// Shape used by the React UI: object keyed by date string ("2026-05-09")
export type JournalEntry = {
  text?: string
  mood?: number
}

export type JournalMap = Record<string, JournalEntry>

type JournalRow = {
  date: string
  text: string | null
  mood: number | null
}

// Load every journal entry for the current user, return as a date-keyed map.
export async function loadJournal(): Promise<JournalMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('journal_entries')
    .select('date, text, mood')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (error) {
    console.error('loadJournal error:', error)
    return {}
  }

  const map: JournalMap = {}
  for (const row of (data ?? []) as JournalRow[]) {
    const entry: JournalEntry = {}
    if (row.text) entry.text = row.text
    if (row.mood !== null) entry.mood = row.mood
    map[row.date] = entry
  }
  return map
}

// Save (upsert) a single day's journal entry.
export async function saveJournalEntry(date: string, entry: JournalEntry): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const row = {
    user_id: user.id,
    date,
    text: entry.text || null,
    mood: entry.mood ?? null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('journal_entries')
    .upsert(row, { onConflict: 'user_id,date' })

  if (error) console.error('saveJournalEntry error:', error)
}