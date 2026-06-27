// timer.js - Executive Hangar Timer

document.addEventListener('DOMContentLoaded', () => {
  // Constantes exatas (Atualizado 27/06/2026)
  const DESIGN_ONLINE_MS    = 65  * 60 * 1000;
  const DESIGN_OFFLINE_MS   = 120 * 60 * 1000;
  const DESIGN_CYCLE_MS     = DESIGN_ONLINE_MS + DESIGN_OFFLINE_MS;
  let CYCLE_DURATION        = DESIGN_CYCLE_MS + 266;
  let OPEN_DURATION         = Math.round(CYCLE_DURATION * DESIGN_ONLINE_MS / DESIGN_CYCLE_MS);
  let CLOSE_DURATION        = CYCLE_DURATION - OPEN_DURATION;

  const CONFIG_URL          = 'https://raw.githubusercontent.com/rwxlff/RWX-Ship-Viewer/refs/heads/main/hangar-config.json';
  const CONFIG_KEY          = 'rwx_hangar_config_cache';
  const CONFIG_TIME_KEY     = 'rwx_hangar_config_cache_time';
  const CACHE_DURATION      = 30 * 60 * 1000; // 30 minutos

  // Ponto de referência (fallback enquanto não carrega do GitHub)
  let INITIAL_OPEN_TIME = new Date('2026-06-12T21:58:00.833-04:00').getTime();

  // Thresholds das luzes
  const GREEN_THRESHOLDS    = [12/65, 24/65, 36/65, 48/65, 60/65]; // luzes apagam no OPEN
  const RED_THRESHOLDS      = [1/5,   2/5,   3/5,   4/5,   1];     // luzes acendem no CLOSED

  const lights              = document.querySelectorAll(".light");
  const mainTimerEl         = document.getElementById("mainTimer");
  const statusTextEl        = document.getElementById("statusText");

  // Carregar config do GitHub (com cache de 30min)
  async function loadConfig() {
    try {
      const cachedTime = localStorage.getItem(CONFIG_TIME_KEY);
      const cachedData = localStorage.getItem(CONFIG_KEY);
      const now = Date.now();

      // Usar cache se válido
      if (cachedTime && cachedData && (now - parseInt(cachedTime)) < CACHE_DURATION) {
        const config = JSON.parse(cachedData);
        INITIAL_OPEN_TIME = new Date(config.initial_open_time).getTime();
        CYCLE_DURATION    = DESIGN_CYCLE_MS + (config.cycle_drift_ms ?? 266);
        OPEN_DURATION     = Math.round(CYCLE_DURATION * DESIGN_ONLINE_MS / DESIGN_CYCLE_MS);
        CLOSE_DURATION    = CYCLE_DURATION - OPEN_DURATION;
        updateTimerInfo(config, true);
        return;
      }

      // Buscar do GitHub
      const response = await fetch(CONFIG_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const config = await response.json();
      // Capturar data de modificação do arquivo no GitHub
      const lastModified = response.headers.get('Last-Modified');
      if (lastModified) config._last_modified = lastModified;

      INITIAL_OPEN_TIME = new Date(config.initial_open_time).getTime();
      CYCLE_DURATION    = DESIGN_CYCLE_MS + (config.cycle_drift_ms ?? 226);
      OPEN_DURATION     = Math.round(CYCLE_DURATION * DESIGN_ONLINE_MS / DESIGN_CYCLE_MS);
      CLOSE_DURATION    = CYCLE_DURATION - OPEN_DURATION;
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      localStorage.setItem(CONFIG_TIME_KEY, now.toString());
      updateTimerInfo(config, false);

    } catch (e) {
      console.warn('Error loading hangar config, using fallback:', e);
      updateTimerInfo(null, false);
    }
  }

  function updateTimerInfo(config, fromCache) {
    const el = document.getElementById('timerPatch');
    if (!el) return;
    if (!config) {
      el.textContent = 'Config unavailable — using fallback';
      return;
    }
    const dateStr = config._last_modified
      ? new Date(config._last_modified).toISOString().slice(0, 10)
      : config.initial_open_time.slice(0, 10);
    el.textContent = `${config.patch} · calibrated ${dateStr}`;
  }

  function formatTime(ms) {
    const t = Math.floor(ms / 1000);
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }

  function updateTimer() {
    const now = Date.now();
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

  // Carregar config e iniciar timer
  loadConfig().then(() => {
    updateTimer();
    setInterval(updateTimer, 1000);
  });
});