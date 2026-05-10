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
  // Keep the last non-idle text rendered while opacity fades out, so the
  // transition is visible. transition-all also smooths the color shift
  // when status flips from "saving" to "saved" without a remount.
  const [shownText, setShownText] = useState(' ')
  const [shownColor, setShownColor] = useState('text-zinc-500')

  useEffect(() => {
    if (status === 'saving') {
      setShownText('Saving…')
      setShownColor('text-zinc-500')
    } else if (status === 'saved') {
      setShownText('Saved ✓')
      setShownColor('text-teal-400')
    }
  }, [status])

  return (
    <div
      className={`text-xs transition-all duration-300 ease-out ${shownColor} ${status === 'idle' ? 'opacity-0' : 'opacity-100'}`}
    >
      {shownText}
    </div>
  )
}