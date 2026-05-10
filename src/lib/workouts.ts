import { supabase } from './supabase'

// UI shape: keyed by date.
// Each day's workout has exercises, each exercise has sets [{reps, weight}].
export type ExerciseSet = { reps: string | number; weight: string | number }
export type Exercise = { id: string; name: string; sets: ExerciseSet[] }
export type Workout = { exercises: Exercise[]; notes?: string; programId?: string }
export type WorkoutMap = Record<string, Workout>

export type PR = { weight: number; reps: number; date: string }
export type PRMap = Record<string, PR>  // keyed by exercise name

// ============ WORKOUTS + EXERCISES ============

// Load all workouts and their exercises in one go.
export async function loadWorkouts(): Promise<WorkoutMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  // Fetch workouts
  const { data: workouts, error: wErr } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', user.id)

  if (wErr) {
    console.error('loadWorkouts error:', wErr)
    return {}
  }

  // Fetch all exercises across all those workouts
  const { data: exercises, error: eErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (eErr) {
    console.error('loadExercises error:', eErr)
    return {}
  }

  const exercisesByWorkout: Record<string, Exercise[]> = {}
  for (const ex of (exercises ?? []) as any[]) {
    if (!exercisesByWorkout[ex.workout_id]) exercisesByWorkout[ex.workout_id] = []
    exercisesByWorkout[ex.workout_id].push({
      id: ex.id,
      name: ex.name,
      sets: ex.sets ?? [],
    })
  }

  const map: WorkoutMap = {}
  for (const w of (workouts ?? []) as any[]) {
    map[w.date] = {
      exercises: exercisesByWorkout[w.id] ?? [],
      notes: w.notes ?? '',
    }
  }
  return map
}

// Save (full sync) a single day's workout. We delete the existing workout for
// that day and re-insert with its exercises.
export async function saveWorkoutForDate(date: string, workout: Workout): Promise<Workout> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return workout

  // Delete any existing workout for this date (cascades to exercises)
  await supabase.from('workouts').delete().eq('user_id', user.id).eq('date', date)

  // Insert workout
  const { data: workoutRow, error: wErr } = await supabase
    .from('workouts')
    .insert({
      user_id: user.id,
      date,
      notes: workout.notes || null,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (wErr || !workoutRow) {
    console.error('saveWorkoutForDate error:', wErr)
    return workout
  }

  if (!workout.exercises || workout.exercises.length === 0) {
    return { ...workout, exercises: [] }
  }

  // Insert exercises
  const exerciseRows = workout.exercises.map((ex, i) => ({
    workout_id: workoutRow.id,
    user_id: user.id,
    name: ex.name || '',
    sets: ex.sets || [],
    position: i,
  }))

  const { data: insertedExercises, error: eErr } = await supabase
    .from('exercises')
    .insert(exerciseRows)
    .select('*')

  if (eErr) {
    console.error('save exercises error:', eErr)
    return workout
  }

  // Return updated workout with proper UUIDs
  return {
    notes: workout.notes,
    exercises: ((insertedExercises ?? []) as any[]).map(r => ({
      id: r.id,
      name: r.name,
      sets: r.sets ?? [],
    })),
  }
}

// ============ PRs ============

export async function loadPRs(): Promise<PRMap> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}

  const { data, error } = await supabase
    .from('prs')
    .select('exercise_name, weight, reps, date')
    .eq('user_id', user.id)

  if (error) {
    console.error('loadPRs error:', error)
    return {}
  }

  const map: PRMap = {}
  for (const row of (data ?? []) as any[]) {
    map[row.exercise_name] = {
      weight: Number(row.weight),
      reps: row.reps,
      date: row.date,
    }
  }
  return map
}

export async function savePR(exerciseName: string, pr: PR): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('prs')
    .upsert(
      {
        user_id: user.id,
        exercise_name: exerciseName,
        weight: pr.weight,
        reps: pr.reps,
        date: pr.date,
      },
      { onConflict: 'user_id,exercise_name' }
    )

  if (error) console.error('savePR error:', error)
}

// ============ PROGRAMS ============

export type Program = {
  id: string
  name: string
  exercises: { name: string; targetSets?: number; targetReps?: number }[]
}

export async function loadPrograms(): Promise<Program[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('loadPrograms error:', error)
    return []
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    exercises: r.exercises ?? [],
  }))
}

export async function savePrograms(programs: Program[]): Promise<Program[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return programs

  await supabase.from('programs').delete().eq('user_id', user.id)

  if (programs.length === 0) return []

  const rows = programs.map(p => ({
    user_id: user.id,
    name: p.name,
    exercises: p.exercises,
    updated_at: new Date().toISOString(),
  }))

  const { data, error } = await supabase
    .from('programs')
    .insert(rows)
    .select('*')

  if (error) {
    console.error('savePrograms error:', error)
    return programs
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    exercises: r.exercises ?? [],
  }))
}
export async function deletePR(exerciseName: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('prs')
    .delete()
    .eq('user_id', user.id)
    .eq('exercise_name', exerciseName)

  if (error) console.error('deletePR error:', error)
}