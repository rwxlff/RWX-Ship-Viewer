// timer.js - Executive Hangar Timer

document.addEventListener('DOMContentLoaded', () => {
  // Constantes exatas (Atualizado 12/06/2026)
  const CYCLE_DRIFT_MS     = 226;
  const DESIGN_ONLINE_MS   = 65  * 60 * 1000;
  const DESIGN_OFFLINE_MS  = 120 * 60 * 1000;
  const DESIGN_CYCLE_MS    = DESIGN_ONLINE_MS + DESIGN_OFFLINE_MS;
  const CYCLE_DURATION     = DESIGN_CYCLE_MS + CYCLE_DRIFT_MS;
  const OPEN_DURATION      = Math.round(CYCLE_DURATION * DESIGN_ONLINE_MS / DESIGN_CYCLE_MS);
  const CLOSE_DURATION     = CYCLE_DURATION - OPEN_DURATION;

  // Ponto de referência
  const INITIAL_OPEN_TIME  = new Date('2026-06-12T21:58:00.833-04:00').getTime();
  const ADJUSTMENT_KEY     = 'rwx_hangar_timer_adjustment';

  // Thresholds das luzes
  const GREEN_THRESHOLDS = [12/65, 24/65, 36/65, 48/65, 60/65]; // luzes apagam no OPEN
  const RED_THRESHOLDS   = [1/5,   2/5,   3/5,   4/5,   1];     // luzes acendem no CLOSED
  
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
  
  // savedAdjustment aplicado diretamente no now() dentro do updateTimer

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
    const now = Date.now() + savedAdjustment;
    const elapsed = (now - INITIAL_OPEN_TIME) % CYCLE_DURATION;
    const timeInCycle = elapsed < 0 ? CYCLE_DURATION + elapsed : elapsed;

    lights.forEach(l => l.className = "light");

    let remaining;
    let status;

    if (timeInCycle < OPEN_DURATION) {
      // OPEN: luzes verdes apagando conforme thresholds
      remaining = OPEN_DURATION - timeInCycle;
      const progress = timeInCycle / OPEN_DURATION;
      const litCount = GREEN_THRESHOLDS.filter(t => progress < t).length;
      // Próxima mudança de luz
      const nextThreshold = GREEN_THRESHOLDS.find(t => progress < t);
      const nextLightMs = nextThreshold ? (nextThreshold * OPEN_DURATION) - timeInCycle : 0;
      lights.forEach((l, i) => {
        if (i < litCount) l.classList.add("green");
      });
      status = `<span class="open">Hangar Open</span><br>Closes in ${formatTime(remaining)}<br><span class="next-light">Next light in ${formatTime(nextLightMs)}</span>`;
    } else {
      // CLOSED: luzes vermelhas acendendo conforme thresholds
      remaining = CYCLE_DURATION - timeInCycle;
      const offlineElapsed = timeInCycle - OPEN_DURATION;
      const progress = offlineElapsed / CLOSE_DURATION;
      const colors = ['green','green','green','green','empty'].slice(); // padrão
      // Aplicar threshold do OFFLINE
      if      (progress < 1/5) { /* all red */     lights.forEach(l => l.classList.add("red")); }
      else if (progress < 2/5) { lights[0].classList.add("green"); [1,2,3,4].forEach(i => lights[i].classList.add("red")); }
      else if (progress < 3/5) { [0,1].forEach(i => lights[i].classList.add("green")); [2,3,4].forEach(i => lights[i].classList.add("red")); }
      else if (progress < 4/5) { [0,1,2].forEach(i => lights[i].classList.add("green")); [3,4].forEach(i => lights[i].classList.add("red")); }
      else                     { [0,1,2,3].forEach(i => lights[i].classList.add("green")); lights[4].classList.add("red"); }
      // Próxima mudança de luz
      const nextThreshold = RED_THRESHOLDS.find(t => progress < t);
      const nextLightMs = nextThreshold ? (nextThreshold * CLOSE_DURATION) - offlineElapsed : 0;
      status = `<span class="closed">Hangar Closed</span><br>Opens in ${formatTime(remaining)}<br><span class="next-light">Next light in ${formatTime(nextLightMs)}</span>`;
    }

    mainTimerEl.textContent = formatTime(remaining);
    statusTextEl.innerHTML = status;
  }
  
  function syncToOpen() {
    // Calcular o ajuste para que agora seja exatamente o início do OPEN
    // (ignorando segundos para maior precisão do clique)
    const nowMs = Date.now();
    const nowSec = nowMs - (nowMs % 60000); // truncar segundos
    const newAdjustment = INITIAL_OPEN_TIME - nowSec;
    // Ajuste é a diferença para que timeInCycle = 0 (início do OPEN)
    const elapsed = (nowSec - INITIAL_OPEN_TIME) % CYCLE_DURATION;
    const timeInCycle = elapsed < 0 ? CYCLE_DURATION + elapsed : elapsed;
    savedAdjustment = -timeInCycle;

    try {
      localStorage.setItem(ADJUSTMENT_KEY, savedAdjustment.toString());
    } catch (e) {
      console.warn('Error saving sync adjustment:', e);
    }

    updateResetButton();
    updateTimer();
  }

  function resetTime() {
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
      resetBtn.textContent = `Reset (${sign}${minutes}min)`;
    }
  }

  document.getElementById('syncBtn').addEventListener('click', syncToOpen);
  document.getElementById('resetBtn').addEventListener('click', resetTime);

  updateResetButton();
  updateTimer();
  setInterval(updateTimer, 1000);
});