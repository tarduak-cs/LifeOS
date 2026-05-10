import { supabase } from './supabase'

export type Profile = {
  name?: string
  health_weight_unit?: 'kg' | 'lbs'
  gym_weight_unit?: 'kg' | 'lbs'
}

export async function loadProfile(): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { name: '' }

  const { data, error } = await supabase
    .from('profiles')
    .select('name, health_weight_unit, gym_weight_unit')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('loadProfile error:', error)
    return { name: '' }
  }

  return {
    name: data?.name ?? '',
    health_weight_unit: (data?.health_weight_unit as 'kg' | 'lbs') ?? 'kg',
    gym_weight_unit: (data?.gym_weight_unit as 'kg' | 'lbs') ?? 'lbs',
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('profiles')
    .update({
      name: profile.name ?? '',
      health_weight_unit: profile.health_weight_unit ?? 'kg',
      gym_weight_unit: profile.gym_weight_unit ?? 'lbs',
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) console.error('saveProfile error:', error)
}