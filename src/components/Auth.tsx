import { useState } from 'react'
import { supabase } from '../lib/supabase'
import CircadianBackground from './CircadianBackground'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) setMessage(error.message)
      else setMessage('Account created.')
    }

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) setMessage(error.message)
      else setMessage('Logged in.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-zinc-100 font-sans">
      <CircadianBackground />

      <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-md border border-zinc-800/60 rounded-2xl p-8">
        {/* App name */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">LifeOS</h1>
          <div className="text-xs text-zinc-500 mt-1">your life, tracked</div>
        </div>

        {/* Tagline */}
        <div className="text-sm md:text-base text-zinc-300 leading-relaxed text-center mt-6 mb-8">
          <p className="m-0">A calm space for your body and mind.</p>
          <p className="m-0">Health metrics, daily intention, and patterns over time.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-email"
              className="text-xs uppercase tracking-wide text-zinc-400 font-medium"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/60 rounded-md px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="auth-password"
              className="text-xs uppercase tracking-wide text-zinc-400 font-medium"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/60 rounded-md px-3 py-2.5 text-zinc-100 outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600/30 border border-teal-500/40 text-teal-200 rounded-md py-2.5 font-medium hover:bg-teal-600/40 disabled:opacity-60"
          >
            {loading ? 'Loading...' : mode === 'login' ? 'Login' : 'Sign Up'}
          </button>

          {message && <p className="text-xs text-red-400 mt-2 text-center m-0">{message}</p>}
        </form>

        {/* Mode toggle */}
        <div className="text-xs text-zinc-400 text-center mt-4">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-zinc-300 hover:text-zinc-200 underline underline-offset-2"
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800/50 pt-4 mt-6 text-center">
          <div className="text-xs text-zinc-500">Built by Tardu Akinci</div>
          <a
            href="https://github.com/tarduak-cs/LifeOS"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-zinc-400 hover:text-zinc-200 underline-offset-2 hover:underline"
          >
            github.com/tarduak-cs/LifeOS
          </a>
        </div>
      </div>
    </div>
  )
}
