// timer.js - Executive Hangar Timer

document.addEventListener('DOMContentLoaded', () => {
  const RED_PHASE   = 120 * 60 * 1000;
  const GREEN_PHASE =  60 * 60 * 1000;
  const BLACK_PHASE =   5 * 60 * 1000;
  const TOTAL_CYCLE = RED_PHASE + GREEN_PHASE + BLACK_PHASE;

  const BASE_CYCLE_START = new Date("2026-01-01T02:28:21Z").getTime();
  const ADJUSTMENT_KEY = 'rwx_hangar_timer_adjustment';
  
  // Carregar ajuste salvo
  let savedAdjustment = 0;
  try {
    const saved = localStorage.getItem(ADJUSTMENT_KEY);
    if (saved) {
      savedAdjustment = parseInt(saved, 10) || 0;
    }
  } catch (e) {
    console.warn('Error loading timer adjustment:', e);
  }
  
  let cycleStart = BASE_CYCLE_START + savedAdjustment;

  const lights = document.querySelectorAll(".light");
  const mainTimerEl = document.getElementById("mainTimer");
  const statusTextEl = document.getElementById("statusText");

  function formatTime(ms) {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  function updateTimer() {
    const now = Date.now();
    let elapsed = (now - cycleStart) % TOTAL_CYCLE;
    
    if (elapsed < 0) {
      elapsed = TOTAL_CYCLE + elapsed;
    }

    lights.forEach(l => l.className = "light");

    let remaining;
    let status;
    let mainTimer;

    if (elapsed < RED_PHASE) {
      remaining = RED_PHASE - elapsed;
      const greenLights = Math.floor(elapsed / (RED_PHASE / 5));
      lights.forEach((l, i) => {
        l.classList.add(i < greenLights ? "green" : "red");
      });
      mainTimer = remaining + GREEN_PHASE + BLACK_PHASE;
      status = `<span class="closed">Hangar Closed</span><br>Opens in ${formatTime(remaining)}`;
    } else if (elapsed < RED_PHASE + GREEN_PHASE) {
      remaining = (RED_PHASE + GREEN_PHASE) - elapsed;
      const greenElapsed = elapsed - RED_PHASE;
      const lightsOff = Math.floor(greenElapsed / (GREEN_PHASE / 5));
      for (let i = 0; i < 5 - lightsOff; i++) {
        lights[i].classList.add("green");
      }
      mainTimer = remaining + BLACK_PHASE;
      status = `<span class="open">Hangar Open</span><br>Closes in ${formatTime(remaining)}`;
    } else {
      remaining = TOTAL_CYCLE - elapsed;
      mainTimer = remaining;
      status = `<span class="resetting">Resetting...</span><br>${formatTime(remaining)}`;
    }

    mainTimerEl.textContent = formatTime(mainTimer);
    statusTextEl.innerHTML = status;
  }

  function adjustTime(minutes) {
    const adjustment = minutes * 60 * 1000;
    cycleStart += adjustment;
    savedAdjustment += adjustment;
    
    // Salvar ajuste
    try {
      localStorage.setItem(ADJUSTMENT_KEY, savedAdjustment.toString());
    } catch (e) {
      console.warn('Error saving timer adjustment:', e);
    }
    
    updateResetButton();
    updateTimer();
  }

  function resetTime() {
    cycleStart = BASE_CYCLE_START;
    savedAdjustment = 0;
    
    // Limpar ajuste salvo
    try {
      localStorage.removeItem(ADJUSTMENT_KEY);
    } catch (e) {
      console.warn('Error clearing timer adjustment:', e);
    }
    
    updateResetButton();
    updateTimer();
  }

  function updateResetButton() {
    const resetBtn = document.getElementById('resetBtn');
    const minutes = Math.round(savedAdjustment / 60000);
    
    if (minutes === 0) {
      resetBtn.textContent = 'Reset';
    } else {
      const sign = minutes > 0 ? '+' : '';
      resetBtn.textContent = `Reset (${sign}${minutes})`;
    }
  }

  document.getElementById('minusBtn').addEventListener('click', () => adjustTime(-5));
  document.getElementById('plusBtn').addEventListener('click', () => adjustTime(5));
  document.getElementById('resetBtn').addEventListener('click', resetTime);

  updateResetButton();
  updateTimer();
  setInterval(updateTimer, 1000);
});