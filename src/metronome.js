/**
 * Web Audio metronome.
 *
 * Clicks are synthesised, so there is no audio file to load and nothing to go
 * out of sync: beats are scheduled ahead on the audio clock while a timer just
 * tops the queue up. Nothing here needs a network.
 */

const LOOKAHEAD_MS = 25
const SCHEDULE_AHEAD = 0.12

export function createMetronome({ onBeat } = {}) {
  let context = null
  let timer = null
  let nextBeatTime = 0
  let beat = 0
  let interval = 0.5

  const click = (time, accent) => {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = accent ? 1600 : 1000
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.32, time + 0.001)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.055)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(time)
    oscillator.stop(time + 0.06)
  }

  const schedule = () => {
    while (nextBeatTime < context.currentTime + SCHEDULE_AHEAD) {
      const accent = beat % 4 === 0
      click(nextBeatTime, accent)
      if (onBeat) {
        const delay = Math.max(0, (nextBeatTime - context.currentTime) * 1000)
        const index = beat
        setTimeout(() => onBeat(index), delay)
      }
      nextBeatTime += interval
      beat += 1
    }
  }

  return {
    async start(bpm) {
      const tempo = Number(bpm)
      if (!Number.isFinite(tempo) || tempo <= 0) return false
      if (!context) {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (!Ctx) return false
        context = new Ctx()
      }
      // iOS starts contexts suspended; the tap that got us here unlocks it.
      if (context.state === 'suspended') await context.resume()
      interval = 60 / tempo
      beat = 0
      nextBeatTime = context.currentTime + 0.06
      schedule()
      timer = setInterval(schedule, LOOKAHEAD_MS)
      return true
    },
    stop() {
      clearInterval(timer)
      timer = null
      if (context && context.state === 'running') context.suspend()
    },
    close() {
      clearInterval(timer)
      timer = null
      context?.close?.()
      context = null
    },
  }
}
