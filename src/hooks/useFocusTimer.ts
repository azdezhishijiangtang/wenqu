import { useEffect, useState } from 'react'

export function useFocusTimer() {
  const [duration, setDuration] = useState(25 * 60)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [running])

  function reset(nextDuration = duration) {
    setRunning(false)
    setDuration(nextDuration)
    setSecondsLeft(nextDuration)
  }

  function toggle() {
    if (secondsLeft === 0) {
      setSecondsLeft(duration)
    }
    setRunning((current) => !current)
  }

  return {
    secondsLeft,
    duration,
    running,
    toggle,
    reset,
    progress: duration === 0 ? 0 : ((duration - secondsLeft) / duration) * 100,
  }
}
