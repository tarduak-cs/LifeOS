import { supabase } from './supabase'

export type FeedbackType = 'bug' | 'idea' | 'other'

export type Feedback = {
  type: FeedbackType
  message: string
  url?: string
}

export async function submitFeedback(feedback: Feedback): Promise<{ ok: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not logged in' }

  const { error } = await supabase
    .from('feedback')
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      type: feedback.type,
      message: feedback.message,
      url: feedback.url ?? null,
    })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}