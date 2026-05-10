import { useEffect, useState } from 'react'

// SaveIndicator: shows "Saving..." while a save is in progress,
// then "Saved ✓" briefly, then fades to nothing.
//
// Usage: pass in a value that changes when something is saved (e.g. a counter
// you increment after each save call). The indicator lights up on each change.
//
// Or: pass `status` directly to control it ("idle" | "saving" | "saved").

type Status = 'idle' | 'saving' | 'saved'

export function useSaveStatus() {
  const [status, setStatus] = useState<Status>('idle')

  // After "saved", auto-fade to "idle" after 1.5s
  useEffect(() => {
    if (status !== 'saved') return
    const t = setTimeout(() => setStatus('idle'), 1500)
    return () => clearTimeout(t)
  }, [status])

  return [status, setStatus] as const
}

export function SaveIndicator({ status }: { status: Status }) {
  if (status === 'idle') {
    return <div className="text-xs text-zinc-700 transition-opacity">&nbsp;</div>
  }
  if (status === 'saving') {
    return <div className="text-xs text-zinc-500 transition-opacity">Saving…</div>
  }
  return <div className="text-xs text-teal-400 transition-opacity">Saved ✓</div>
}