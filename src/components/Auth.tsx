import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: '#09090b',
      color: 'white'
    }}>
      <form
        onSubmit={handleSubmit}
        style={{
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 24,
          background: '#18181b',
          borderRadius: 16
        }}
      >
        <h1>
          {mode === 'login' ? 'Login' : 'Create Account'}
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ padding: 12 }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{ padding: 12 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: 12,
            background: '#14b8a6',
            border: 'none',
            borderRadius: 8,
            color: 'black',
            fontWeight: 'bold'
          }}
        >
          {loading
            ? 'Loading...'
            : mode === 'login'
            ? 'Login'
            : 'Sign Up'}
        </button>

        <button
          type="button"
          onClick={() =>
            setMode(mode === 'login' ? 'signup' : 'login')
          }
        >
          {mode === 'login'
            ? 'Need account?'
            : 'Already have account?'}
        </button>

        {message && <p>{message}</p>}
      </form>
    </div>
  )
}