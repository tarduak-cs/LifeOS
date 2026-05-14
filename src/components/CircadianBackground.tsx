import { useEffect, useState } from 'react'

// ============ CIRCADIAN BACKGROUND ============
// Fixed full-viewport landscape photo behind the entire app. Five images mapped
// to time-of-day; all five stay mounted so we get a true 2-second cross-fade
// via opacity when the hour boundary crosses. Soft overlay sits on top of the
// photo; per-card backdrop-blur handles text readability above that.
const CIRCADIAN_IMAGES = {
  dawn: '/backgrounds/dawn.jpg',
  morning: '/backgrounds/morning.jpg',
  afternoon: '/backgrounds/afternoon.jpg',
  evening: '/backgrounds/evening.jpg',
  night: '/backgrounds/night.jpg',
} as const
type CircadianMode = keyof typeof CIRCADIAN_IMAGES

function modeForHour(h: number): CircadianMode {
  if (h >= 5 && h < 8) return 'dawn'
  if (h >= 8 && h < 12) return 'morning'
  if (h >= 12 && h < 17) return 'afternoon'
  if (h >= 17 && h < 20) return 'evening'
  return 'night'
}

export default function CircadianBackground() {
  const [hour, setHour] = useState(() => new Date().getHours())

  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    Object.values(CIRCADIAN_IMAGES).forEach(src => {
      const img = new Image()
      img.src = src
    })
  }, [])

  const currentMode = modeForHour(hour)

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
      {(Object.entries(CIRCADIAN_IMAGES) as [CircadianMode, string][]).map(([mode, src]) => (
        <div
          key={mode}
          className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
          style={{
            backgroundImage: `url(${src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: mode === currentMode ? 1 : 0,
          }}
        />
      ))}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(9, 9, 11, 0.35) 0%, rgba(9, 9, 11, 0.45) 50%, rgba(9, 9, 11, 0.55) 100%)',
        }}
      />
    </div>
  )
}
