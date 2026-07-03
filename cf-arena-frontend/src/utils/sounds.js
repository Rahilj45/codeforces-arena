export const playSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq, type, duration, vol, startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;

    switch (type) {
      case 'start':
        // Dramatic 3-2-1 Go sound (just the 'Go' part)
        playTone(440, 'square', 0.1, 0.1, now);
        playTone(880, 'square', 0.4, 0.1, now + 0.1);
        break;
      case 'countdown':
        // Short beep
        playTone(440, 'sine', 0.2, 0.1, now);
        break;
      case 'solve_own':
        // Happy ding
        playTone(523.25, 'sine', 0.1, 0.1, now); // C5
        playTone(659.25, 'sine', 0.2, 0.1, now + 0.1); // E5
        playTone(783.99, 'sine', 0.4, 0.1, now + 0.2); // G5
        break;
      case 'solve_opp':
        // Low thump
        playTone(150, 'triangle', 0.2, 0.2, now);
        playTone(100, 'triangle', 0.3, 0.2, now + 0.1);
        break;
      case 'time_up':
        // Long alarm
        playTone(300, 'sawtooth', 0.3, 0.1, now);
        playTone(300, 'sawtooth', 0.3, 0.1, now + 0.4);
        playTone(300, 'sawtooth', 0.3, 0.1, now + 0.8);
        break;
      case 'win':
        // Victory fanfare
        playTone(440, 'square', 0.2, 0.1, now);
        playTone(554.37, 'square', 0.2, 0.1, now + 0.2);
        playTone(659.25, 'square', 0.2, 0.1, now + 0.4);
        playTone(880, 'square', 0.6, 0.1, now + 0.6);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("Audio API error:", e);
  }
};
