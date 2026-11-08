import { useEffect, useState } from 'react'

/**
 * 专注计时器。
 *
 * 用「结束时间点」而不是每秒减一：浏览器在后台标签页会把 setInterval
 * 节流到每分钟甚至更久，按 tick 累计会严重走慢；同时切回前台时立即校准。
 */
export function useFocusTimer() {
  const [duration, setDuration] = useState(25 * 60)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [endAt, setEndAt] = useState<number | null>(null)

  useEffect(() => {
    if (!running || endAt === null) return

    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) {
        setRunning(false)
        setEndAt(null)
      }
    }

    tick()
    const timer = window.setInterval(tick, 250)
    // 后台切回前台时 setInterval 可能刚被节流，立刻按真实时间校准一次
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [running, endAt])

  function reset(nextDuration = duration) {
    setRunning(false)
    setEndAt(null)
    setDuration(nextDuration)
    setSecondsLeft(nextDuration)
  }

  function toggle() {
    if (running) {
      // 暂停：先按真实时间结算，再清掉结束时间点
      if (endAt !== null) {
        setSecondsLeft(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)))
      }
      setRunning(false)
      setEndAt(null)
      return
    }
    const base = secondsLeft === 0 ? duration : secondsLeft
    setSecondsLeft(base)
    setEndAt(Date.now() + base * 1000)
    setRunning(true)
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
