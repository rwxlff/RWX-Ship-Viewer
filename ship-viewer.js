// ship-viewer.js - Script principal do RWX Ship Viewer

(function () {
  'use strict';

  console.log('🚀 RWX Ship Viewer v2.1 loading...');

  // Listener para mensagens do content script (atalho de teclado)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'OPEN_SHIP_VIEWER' && event.data.source === 'rwx-extension') {
      console.log('📨 Received message to toggle viewer');
      
      // Verificar se está no site RSI
      const isRSISite = window.location.hostname.includes('robertsspaceindustries.com');
      
      if (!isRSISite) {
        console.log('🌐 Not on RSI site, opening in new tab...');
        window.open('https://robertsspaceindustries.com?rwx_open_viewer=true', '_blank');
        return;
      }
      
      // Está no site RSI, toggle viewer
      const tryToggle = () => {
        if (window.RWXShipViewer && typeof window.RWXShipViewer.toggle === 'function') {
          window.RWXShipViewer.toggle();
          console.log('✅ Viewer toggled via keyboard shortcut');
          return true;
        }
        return false;
      };
      
      if (!tryToggle()) {
        setTimeout(() => {
          if (tryToggle()) {
            console.log('✅ Viewer toggled after delay');
          } else {
            console.warn('⚠️ Could not toggle viewer - not loaded yet');
          }
        }, 100);
      }
    }
    
  });

  const API_SHIP_MATRIX = 'https://robertsspaceindustries.com/ship-matrix/index';
  const API_GRAPHQL = 'https://robertsspaceindustries.com/pledge-store/api/upgrade/graphql';
  const CACHE_SHIP_MATRIX_KEY = 'rwx_ship_matrix_cache';
  const CACHE_LOANER_MATRIX_KEY = 'rwx_loaner_matrix_cache';
  const CACHE_DURATION_24H = 24 * 60 * 60 * 1000;

  function getCache(key, duration) {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        const age = Date.now() - parsed.timestamp;
        if (age < duration) {
          console.log(`Using cache for ${key} (valid for ${Math.round((duration - age) / 1000)} seconds)`);
          return parsed.data;
        }
      }
    } catch (e) {
      console.warn('Error loading cache:', e);
    }
    return null;
  }

  function setCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Error saving cache:', e);
    }
  }

  // Loaner Matrix - buscar dinamicamente
  let loanerMatrix = null;

  async function fetchLoanerMatrix() {
    if (loanerMatrix) return loanerMatrix;
    
    // Tentar cache primeiro
    const cached = getCache(CACHE_LOANER_MATRIX_KEY, CACHE_DURATION_24H);
    if (cached) {
      loanerMatrix = cached;
      return loanerMatrix;
    }
    
    try {
      console.log('Fetching Loaner Matrix...');
      
      // Usar postMessage para comunicar com content script
      const html = await new Promise((resolve, reject) => {
        const messageHandler = (event) => {
          if (event.data.type === 'LOANER_MATRIX_RESPONSE') {
            window.removeEventListener('message', messageHandler);
            if (event.data.success) {
              resolve(event.data.html);
            } else {
              reject(new Error(event.data.error || 'Failed to fetch'));
            }
          }
        };
        
        window.addEventListener('message', messageHandler);
        window.postMessage({ type: 'FETCH_LOANER_MATRIX' }, '*');
        
        // Timeout de 10 segundos
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Timeout fetching loaner matrix'));
        }, 10000);
      });
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      loanerMatrix = {};
      
      // Procurar todas as tabelas
      const tables = doc.querySelectorAll('table');
      let targetTable = null;
      
      for (const table of tables) {
        const headers = table.querySelectorAll('th');
        const headerText = Array.from(headers).map(h => h.textContent.trim().toUpperCase());
        if (headerText.includes('YOUR SHIP') && headerText.includes('OUR LOANER(S)')) {
          targetTable = table;
          break;
        }
      }
      
      if (!targetTable) {
        console.warn('Loaner matrix table not found');
        return loanerMatrix;
      }
      
      const rows = targetTable.querySelectorAll('tbody tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 2) {
          const shipName = cells[0].textContent.trim();
          const loanersText = cells[1].textContent.trim();
          
          // Processar loaners
          const loaners = loanersText
            .replace(/\n/g, ',')
            .replace(/\sand\s/gi, ',')
            .split(',')
            .map(l => l.trim())
            .filter(l => l && l.length > 0 && l !== 'N/A');
          
          if (loaners.length > 0) {
            loanerMatrix[shipName.toLowerCase()] = loaners;
          }
        }
      });
      
      console.log('Loaner Matrix loaded:', Object.keys(loanerMatrix).length, 'ships');
      setCache(CACHE_LOANER_MATRIX_KEY, loanerMatrix);
      return loanerMatrix;
      
    } catch (error) {
      console.error('Error fetching loaner matrix:', error);
      loanerMatrix = {};
      return loanerMatrix;
    }
  }

  function getLoanersForShip(shipName) {
    if (!loanerMatrix) return [];
    
    const normalized = shipName.toLowerCase().trim();
    
    // Tentar match exato
    if (loanerMatrix[normalized]) {
      return loanerMatrix[normalized];
    }
    
    // Tentar match parcial
    for (const [key, value] of Object.entries(loanerMatrix)) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return value;
      }
    }
    
    return [];
  }

  /* ================= INICIALIZAR UEX API ================= */
  
  let uexAPI = null;
  let uexVehiclesData = null;

  async function initUEXAPI() {
    try {
      if (typeof window.UEXVehiclesAPI === 'undefined') {
        console.warn('⚠️ UEX API not available');
        return false;
      }

      uexAPI = new window.UEXVehiclesAPI();
      uexVehiclesData = await uexAPI.getVehicles();
      
      console.log('✅ UEX API initialized:', uexVehiclesData.length, 'vehicles');
      return true;
    } catch (e) {
      console.error('❌ Error initializing UEX API:', e);
      return false;
    }
  }

  /* ================= UTIL ================= */

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function formatPrice(cents, currency = 'USD') {
    if (cents === null || cents === undefined) return '-';
    const dollars = cents / 100;
    
    const rates = {
      'USD': { rate: 1, symbol: '$', suffix: 'USD' },
      'EUR': { rate: 0.92, symbol: '€', suffix: 'EUR' },
      'GBP': { rate: 0.79, symbol: '£', suffix: 'GBP' }
    };
    
    const curr = rates[currency] || rates.USD;
    const converted = dollars * curr.rate;
    return `${curr.symbol}${converted.toFixed(2)} ${curr.suffix}`;
  }

  /* ================= BOTÃO (FUNCIONA EM QUALQUER SITE) ================= */

  const button = document.createElement('button');
  button.id = 'rwx-ship-viewer-button';

  // Criar SVG diretamente em JavaScript
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '36');
  svg.setAttribute('height', '36');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.style.display = 'block';

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', '#40a9ff');
  path.setAttribute('d', 'M11.26 1a.5.5 0 0 0-.494.423l-.406 2.513a.5.5 0 0 1-.306.386l-1.426.585a.505.505 0 0 0-.304.555l.32 1.804a.5.5 0 0 1-.247.523L2.258 11.21a.506.506 0 0 0-.088.82l2.017 1.791c.121.108.286.15.444.114l2.763-.638a.502.502 0 0 1 .61.543l-.862 8.603c-.058.578.74.78.961.244L8.88 20.8a.5.5 0 0 1 .463-.31h5.314a.5.5 0 0 1 .463.31l.777 1.887c.22.536 1.02.334.961-.244l-.862-8.603a.502.502 0 0 1 .61-.543l2.763.638a.5.5 0 0 0 .444-.114l2.017-1.792a.506.506 0 0 0-.088-.82L15.603 7.79a.5.5 0 0 1-.247-.523l.32-1.804a.505.505 0 0 0-.304-.555l-1.426-.585a.5.5 0 0 1-.306-.386l-.406-2.513A.5.5 0 0 0 12.74 1zm1.97 13.968c.24 0 .446.171.492.408l.525 2.727c.06.312-.177.6-.492.6h-3.51a.503.503 0 0 1-.492-.6l.525-2.727a.5.5 0 0 1 .492-.408z');

  svg.appendChild(path);
  button.appendChild(svg);

  Object.assign(button.style, {
    position: 'fixed',
    zIndex: '999999',
    height: "48px",
    width: "48px",
    padding: '5px 3px 3px',
    background: '#143A52',
    color: '#fff',
    border: '2px solid rgba(111, 178, 220, 0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 4px 12px rgba(0,0,0,.5)',
    transition: 'all 0.3s',
    display: 'flex',
    alignItems: 'normal',
    justifyContent: 'center'
  });

  button.onmouseenter = () => {
    button.style.background = '#1E577B';
    button.style.transform = 'scale(1.05)';
  };
  button.onmouseleave = () => {
    button.style.background = '#143A52';
    button.style.transform = 'scale(1)';
  };

  // Verificar se o botão já existe antes de adicionar
  const existingButton = document.getElementById('rwx-ship-viewer-button');
  if (!existingButton) {
    document.body.appendChild(button);
    console.log('✅ Floating button created');
  } else {
    console.log('⚠️ Floating button already exists, skipping creation');
  }

  // Listener para toggle e posição do botão via postMessage
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'INIT_BUTTON_STATE') {
      const btn = document.getElementById('rwx-ship-viewer-button');
      if (btn && event.data.enabled !== undefined) {
        btn.style.display = event.data.enabled ? 'flex' : 'none';
        console.log('📍 Initial button state set:', event.data.enabled);
      }
    }

    if (event.data.type === 'TOGGLE_FLOATING_BUTTON') {
      const enabled = event.data.enabled;
      button.style.display = enabled ? 'flex' : 'none';
      console.log('Floating button visibility changed:', enabled);
    }
    
    if (event.data.type === 'UPDATE_BUTTON_POSITION') {
      const position = event.data.position;
      
      // Limpar posições anteriores
      button.style.top = '';
      button.style.bottom = '';
      button.style.left = '';
      button.style.right = '';
      
      // Aplicar nova posição
      switch(position.corner) {
        case 'bottom-right':
          button.style.bottom = `${position.y}px`;
          button.style.right = `${position.x}px`;
          break;
        case 'bottom-left':
          button.style.bottom = `${position.y}px`;
          button.style.left = `${position.x}px`;
          break;
        case 'top-right':
          button.style.top = `${position.y}px`;
          button.style.right = `${position.x}px`;
          break;
        case 'top-left':
          button.style.top = `${position.y}px`;
          button.style.left = `${position.x}px`;
          break;
      }
      
      console.log('Button position updated:', position);
    }
  });

  /* ================= MODAL ================= */

  const overlay = document.createElement('div');
  overlay.id = 'rwx-modal-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0, 15, 26, 0.50)',
    zIndex: '99998',
    display: 'none',
    backdropFilter: 'blur(2px)'
  });

  const modal = document.createElement('div');
  modal.id = 'rwx-modal-container';
  Object.assign(modal.style, {
    position: 'absolute',
    top: '3%',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '1200px',
    height: '90%',
    background: 'url(https://cdn.robertsspaceindustries.com/static/orion/images/store/asset-background-variant-2.png), linear-gradient(45deg, #0a1e2e 0%, #0d2438 100%)', // Gradiente azul RSI
    color: '#e0f3ff',
    borderRadius: '4px',
    padding: '20px',
    overflow: 'hidden',
    fontFamily: '"Electrolize", Arial, sans-serif',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(64, 169, 255, 0.3)',
    border: '1px solid rgba(64, 169, 255, 0.1)',
    backgroundRepeat: 'no-repeat, no-repeat',
    backgroundSize: 'cover, cover',
    backgroundPosition: 'center, center',
    backgroundBlendMode: 'screen'
  });

  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
    paddingBottom: '15px',
    borderBottom: '2px solid rgba(64, 169, 255, 0.4)'
  });

  const title = document.createElement('h2');
  title.innerHTML = '<img src="https://cdn.robertsspaceindustries.com/orion-v3/icons/vehicle-8c461392.svg" style="width:32px; height:32px; vertical-align:middle; margin-right:10px; filter: brightness(0) saturate(100%) invert(65%) sepia(16%) saturate(1249%) hue-rotate(155deg) brightness(93%) contrast(90%);" />RWX Ship Viewer';
  title.style.margin = '0';
  title.style.color = '#40a9ff';
  title.style.textShadow = '0 0 10px rgba(64, 169, 255, 0.5)';
  title.style.fontWeight = 'bold';
  title.style.display = 'flex';
  title.style.alignItems = 'center';

  const controls = document.createElement('div');
  controls.style.display = 'flex';
  controls.style.gap = '10px';
  controls.style.alignItems = 'center';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✖';
  Object.assign(closeBtn.style, {
    background: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)',
    color: '#fff',
    border: '1px solid rgba(198, 40, 40, 0.5)',
    fontSize: '18px',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(198, 40, 40, 0.3)'
  });

  closeBtn.onmouseenter = () => {
    closeBtn.style.background = 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)';
    closeBtn.style.boxShadow = '0 4px 12px rgba(198, 40, 40, 0.5)';
  };
  closeBtn.onmouseleave = () => {
    closeBtn.style.background = 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)';
    closeBtn.style.boxShadow = '0 2px 8px rgba(198, 40, 40, 0.3)';
  };

  controls.appendChild(closeBtn);
  header.appendChild(title);
  header.appendChild(controls);

  const content = document.createElement('div');
  Object.assign(content.style, {
    height: 'calc(100% - 30px)',
    overflow: 'hidden',
    position: 'relative'
  });

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ========== PROTEÇÃO DE ESTILOS ==========
  const protectionStyleId = 'rwx-protection-styles';
  const oldProtectionStyle = document.getElementById(protectionStyleId);
  if (oldProtectionStyle) oldProtectionStyle.remove();

  const protectionStyle = document.createElement('style');
  protectionStyle.id = protectionStyleId;
  protectionStyle.textContent = `
    #rwx-modal-overlay {
      font-family: "Electrolize", Arial, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.5 !important;
      letter-spacing: normal !important;
      text-transform: none !important;
    }

    #rwx-modal-overlay *:not(h4):not(h5) {
      font-family: inherit !important;
      letter-spacing: normal !important;
      text-transform: none !important;
    }

    #rwx-modal-overlay h1,
    #rwx-modal-overlay h2,
    #rwx-modal-overlay h3,
    #rwx-modal-overlay h4,
    #rwx-modal-overlay h5,
    #rwx-modal-overlay h6,
    #rwx-modal-overlay p,
    #rwx-modal-overlay span,
    #rwx-modal-overlay div,
    #rwx-modal-overlay label,
    #rwx-modal-overlay td,
    #rwx-modal-overlay th,
    #rwx-modal-overlay input,
    #rwx-modal-overlay select,
    #rwx-modal-overlay button,
    #rwx-modal-overlay a {
      text-transform: none !important;
      vertical-align: middle !important;
    }

    #rwx-modal-overlay h2 {
      font-size: 18px !important;
    }

    #rwx-modal-overlay h4 {
      font-size: 15px !important;
      font-family: univia-pro, arial, sans-serif !important;
      color: #ffffff !important;
    }

    #rwx-modal-overlay h5 {
      font-size: 12px !important;
    }

    #rwx-modal-overlay p,
    #rwx-modal-overlay span,
    #rwx-modal-overlay div,
    #rwx-modal-overlay label,
    #rwx-modal-overlay td,
    #rwx-modal-overlay th {
      font-size: 12px !important;
    }

    #rwx-modal-overlay input,
    #rwx-modal-overlay select,
    #rwx-modal-overlay button {
      font-size: 12px !important;
    }

    #rwx-modal-overlay table {
      font-size: 12px !important;
    }

    #rwx-modal-overlay strong,
    #rwx-modal-overlay b {
      font-weight: bold !important;
    }

    #rwx-modal-overlay a {
      text-decoration: none !important;
    }

    #rwx-modal-overlay option {
      background: #0f3552 !important;
      color: #fff !important;
      padding: 8px !important;
      font-size: 11px !important;
    }

    #rwx-modal-overlay option:hover {
      background: #1a4a6f !important;
      color: #40a9ff !important;
    }

    #rwx-modal-overlay option:checked {
      background: #40a9ff !important;
      color: #fff !important;
    } 
  `;

  document.head.appendChild(protectionStyle);

  // Função para fechar o viewer
  const closeViewer = () => {
    overlay.style.display = 'none';
    console.log('❌ Viewer closed');
  };

  // Função para abrir o viewer
  const openViewer = () => {
    overlay.style.display = 'block';
    console.log('✅ Viewer opened');
  };

  // Função toggle
  const toggleViewer = () => {
    if (overlay.style.display === 'block') {
      closeViewer();
    } else {
      openViewer();
    }
  };

  closeBtn.onclick = closeViewer;
  overlay.onclick = (e) => {
    if (e.target === overlay) closeViewer();
  };

  // Fechar com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.style.display === 'block') {
      e.preventDefault();
      closeViewer();
      console.log('❌ Viewer closed with ESC key');
    }
  });

  const btn = document.getElementById('rwx-ship-viewer-button');
  if (btn) {
    btn.onclick = () => {
      console.log('Button clicked');
      
      // Verificar se está no site RSI
      const isRSISite = window.location.hostname.includes('robertsspaceindustries.com');
      
      if (isRSISite) {
        // Está no site RSI, toggle viewer
        console.log('Toggling viewer on RSI site');
        window.RWXShipViewer.toggle();
      } else {
        // Não está no site RSI, abre em nova aba
        console.log('Not on RSI site, opening in new tab');
        
        // Abrir site RSI em nova aba
        window.open('https://robertsspaceindustries.com?rwx_open_viewer=true', '_blank');
      }
    };
    console.log('Button event listener added');
  }

  /* ================= BUSCAR PREÇOS DA UEX API ================= */

  async function fetchPricesUEX() {
    try {
      if (!uexAPI) {
        console.warn('⚠️ UEX API não disponível para buscar preços');
        return null;
      }

      console.log('💰 Buscando preços da UEX API...');
      
      // Buscar preços da API UEX
      await uexAPI.getPrices();
      
      if (!uexAPI.pricesMap || uexAPI.pricesMap.size === 0) {
        console.warn('⚠️ Nenhum preço encontrado na UEX API');
        return null;
      }

      // Converter para o formato esperado pelo código existente
      const pricesMap = {};
      
      allShips.forEach(ship => {
        const priceData = uexAPI.getPriceByName(ship.name);
        
        if (priceData) {
          pricesMap[ship.name] = {
            msrp: priceData.msrp ? priceData.msrp * 100 : null, // Converter $ para cents
            warbond: priceData.warbond ? priceData.warbond * 100 : null,
            standard: null // Não temos mais "Standard", só MSRP
          };
        }
      });

      console.log('✅ Preços UEX carregados:', Object.keys(pricesMap).length, 'naves com preço');
      return pricesMap;
      
    } catch (e) {
      console.error('❌ Erro ao buscar preços UEX:', e);
      return null;
    }
  }

  /* ================= BUSCAR PREÇOS (OPCIONAL) ================= */

  async function fetchPrices() {
    try {
      console.log('💰 Trying to retrieve prices via GraphQL...');

      const res = await fetch(API_GRAPHQL, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Accept': '*/*',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payloadPrices)
      });

      if (!res.ok) {
        console.warn('⚠️ GraphQL is unavailable (token expired)');
        return null;
      }

      const json = await res.json();

      if (!json?.[0]?.data?.ships) {
        console.warn('⚠️ Price data not found.');
        return null;
      }

      const pricesMap = {};
      json[0].data.ships.forEach(ship => {
        pricesMap[ship.name] = {
          msrp: ship.msrp || null,
          standard: ship.skus?.find(sku => sku.title === 'Standard Edition')?.price || null,
          warbond: ship.skus?.find(sku => sku.title === 'Warbond Edition')?.price || null
        };
      });

      console.log('✅ Prices loaded:', Object.keys(pricesMap).length, 'ships');
      return pricesMap;
    } catch (e) {
      console.warn('⚠️ Error when searching for prices:', e.message);
      return null;
    }
  }

  /* ================= BUSCAR PREÇOS aUEC DA UEX API ================= */

  async function fetchAUECPricesUEX() {
    try {
      if (!uexAPI) {
        console.warn('⚠️ UEX API not available for aUEC prices');
        return null;
      }

      console.log('💰 Fetching aUEC prices from UEX API...');
      
      // Buscar preços aUEC da API UEX
      await uexAPI.getAUECPrices();
      
      if (!uexAPI.auecPricesMap || uexAPI.auecPricesMap.size === 0) {
        console.warn('⚠️ No aUEC prices found in UEX API');
        return null;
      }

      // Converter para o formato esperado pelo código existente
      const auecPricesMap = {};
      
      allShips.forEach(ship => {
        const priceData = uexAPI.getAUECPriceByName(ship.name);
        
        if (priceData && priceData.price) {
          auecPricesMap[ship.name] = priceData.price;
        }
      });

      console.log('✅ aUEC prices loaded:', Object.keys(auecPricesMap).length, 'ships with aUEC price');
      return auecPricesMap;
      
    } catch (e) {
      console.error('❌ Error fetching aUEC prices:', e);
      return null;
    }
  }

  /* ================= RENDER ================= */

  let allShips = [];
  let pricesData = null;
  let auecPricesData = null;
  let currentSort = { column: 'name', ascending: true };
  let showOnlyFavorites = false;

  // Configurações persistentes
  const SETTINGS_KEY = 'rwx_viewer_settings';

  function saveSettings() {
    try {
      const settings = {
        searchText: document.getElementById('search-input')?.value || '',
        manufacturerFilter: document.getElementById('filter-manufacturer')?.value || '',
        typeFilter: document.getElementById('filter-type')?.value || '',
        statusFilter: document.getElementById('filter-status')?.value || '',
        currencyFilter: document.getElementById('filter-currency')?.value || 'USD',
        showOnlyFavorites: showOnlyFavorites,
        currentSort: currentSort,
        timestamp: Date.now()
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Error saving settings:', e);
    }
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Error loading settings:', e);
    }
    return null;
  }

  let favoriteShips = new Set();

  // Carregar favoritos do localStorage
  try {
    const saved = localStorage.getItem('rwx_favorite_ships');
    if (saved) {
      favoriteShips = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.warn('Error loading favorites:', e);
  }

  function saveFavorites() {
    try {
      localStorage.setItem('rwx_favorite_ships', JSON.stringify([...favoriteShips]));
    } catch (e) {
      console.warn('Error saving favorites:', e);
    }
  }

  function toggleFavorite(shipName) {
    if (favoriteShips.has(shipName)) {
      favoriteShips.delete(shipName);
    } else {
      favoriteShips.add(shipName);
    }
    saveFavorites();
  }

  function sortShips(ships, column, ascending) {
    const sorted = [...ships].sort((a, b) => {
      let aVal, bVal;

      switch (column) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'manufacturer':
          aVal = a.manufacturer?.name || '';
          bVal = b.manufacturer?.name || '';
          break;
        case 'type':
          aVal = a.type || '';
          bVal = b.type || '';
          break;
        case 'status':
          aVal = a.production_status || '';
          bVal = b.production_status || '';
          break;
        case 'cargo':
          aVal = a.cargocapacity || 0;
          bVal = b.cargocapacity || 0;
          break;
        case 'crew':
          aVal = a.max_crew || 0;
          bVal = b.max_crew || 0;
          break;
        case 'auec':
          // Validar preços antes de ordenar
          const validateAUEC = (ship) => {
            const auec = auecPricesData?.[ship.name];
            const msrp = pricesData?.[ship.name]?.msrp;
            if (!auec) return 0;
            if (msrp && (msrp / 100 * 1000 > auec)) return 0;
            return auec;
          };
          aVal = validateAUEC(a);
          bVal = validateAUEC(b);
          break;
        case 'msrp':
          aVal = pricesData?.[a.name]?.msrp || 0;
          bVal = pricesData?.[b.name]?.msrp || 0;
          break;
        case 'warbond':
          aVal = pricesData?.[a.name]?.warbond || 0;
          bVal = pricesData?.[b.name]?.warbond || 0;
          break;
        case 'savings':
          const aMsrp = pricesData?.[a.name]?.msrp || 0;
          const aWar = pricesData?.[a.name]?.warbond || 0;
          const bMsrp = pricesData?.[b.name]?.msrp || 0;
          const bWar = pricesData?.[b.name]?.warbond || 0;
          aVal = (aMsrp && aWar && aMsrp > aWar) ? aMsrp - aWar : 0;
          bVal = (bMsrp && bWar && bMsrp > bWar) ? bMsrp - bWar : 0;
          break;
        default:
          return 0;
      }

      if (typeof aVal === 'string') {
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return ascending ? aVal - bVal : bVal - aVal;
      }
    });

    return sorted;
  }

  function getUniqueValues(ships, field) {
    const values = new Set();
    ships.forEach(ship => {
      let value;
      if (field === 'manufacturer') {
        value = ship.manufacturer?.name;
      } else if (field === 'type') {
        value = ship.type;
      } else if (field === 'status') {
        value = ship.production_status;
      }
      if (value) values.add(value);
    });
    return Array.from(values).sort();
  }

  function capitalizeFirstLetter(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  function formatStatus(status) {
    if (!status) return '-';
    return status.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  function convertSizeToNumber(size) {
    if (!size || size === '-') return size;
    
    const sizeMap = {
      'S': '1',
      'I': '1',
      'M': '2',
      'II': '2',
      'L': '3',
      'III': '3',
      'XL': '4',
      'IV': '4',
      'XXL': '5',
      'V': '5'
    };
    
    const upperSize = size.toString().trim().toUpperCase();
    return sizeMap[upperSize] || size;
  }

  function renderShips(ships) {
    content.innerHTML = '';

    if (ships.length === 0) {
      content.innerHTML = '<p style="text-align:center; color:#888; margin-top:50px;">No ship found.</p>';
      return;
    }

    const statsContainer = document.createElement('div');
    Object.assign(statsContainer.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px',
      gap: '5px'
    });

    const stats = document.createElement('div');
    stats.innerHTML = `<p style="color:#88c0d0; margin:0; font-weight:500;"><b style="color:#40a9ff;">${ships.length}</b> ships found</p>`;

    const filters = document.createElement('div');
    Object.assign(filters.style, {
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    });

    const favBtn = document.createElement('button');
    favBtn.innerHTML = '★';
    favBtn.title = 'Show favorites';
    Object.assign(favBtn.style, {
      padding: '6px 12px',
      background: 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)',
      color: '#88c0d0',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '18px',
      cursor: 'pointer',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      transition: 'all 0.3s',
      lineHeight: '1'
    });

    favBtn.onmouseenter = () => {
      if (!showOnlyFavorites) {
        favBtn.style.background = 'linear-gradient(135deg, #2a4a62 0%, #1f3848 100%)';
        favBtn.style.borderColor = '#40a9ff';
        favBtn.style.boxShadow = '0 0 8px rgba(64, 169, 255, 0.4)';
      } else {
        favBtn.style.transform = 'scale(1.05)';
      }
    };
    favBtn.onmouseleave = () => {
      if (!showOnlyFavorites) {
        favBtn.style.background = 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)';
        favBtn.style.borderColor = 'rgba(64, 169, 255, 0.3)';
        favBtn.style.boxShadow = 'none';
      } else {
        favBtn.style.transform = 'scale(1)';
      }
    };

    favBtn.onclick = () => {
      showOnlyFavorites = !showOnlyFavorites;
      if (showOnlyFavorites) {
        favBtn.style.background = 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)';
        favBtn.style.borderColor = '#ffa726';
        favBtn.style.color = '#fff';
        favBtn.title = 'Show all ships';
      } else {
        favBtn.style.background = 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)';
        favBtn.style.borderColor = 'rgba(64, 169, 255, 0.3)';
        favBtn.style.color = '#88c0d0';
        favBtn.title = 'Show favorites';
      }
      saveSettings();
      applyFilters();
    };

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search for ship, manufacturer, or type...';
    searchInput.id = 'search-input';
    Object.assign(searchInput.style, {
      padding: '6px 10px',
      background: 'rgba(16, 32, 48, 0.6)',
      color: '#e0f3ff',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      width: '220px',
      transition: 'all 0.3s'
    });

    searchInput.onfocus = () => {
      searchInput.style.borderColor = '#40a9ff';
      searchInput.style.boxShadow = '0 0 8px rgba(64, 169, 255, 0.4)';
    };
    searchInput.onblur = () => {
      searchInput.style.borderColor = 'rgba(64, 169, 255, 0.3)';
      searchInput.style.boxShadow = 'none';
    };

    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    Object.assign(clearBtn.style, {
      padding: '6px 12px',
      background: 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)',
      color: '#88c0d0',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      cursor: 'pointer',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      transition: 'all 0.3s'
    });

    clearBtn.onmouseenter = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #2a4a62 0%, #1f3848 100%)';
      clearBtn.style.borderColor = '#40a9ff';
      clearBtn.style.boxShadow = '0 0 8px rgba(64, 169, 255, 0.4)';
    };
    clearBtn.onmouseleave = () => {
      clearBtn.style.background = 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)';
      clearBtn.style.borderColor = 'rgba(64, 169, 255, 0.3)';
      clearBtn.style.boxShadow = 'none';
    };

    const manufacturers = getUniqueValues(allShips, 'manufacturer');
    const types = getUniqueValues(allShips, 'type');
    const statuses = getUniqueValues(allShips, 'status');

    const manufacturerLabel = document.createElement('label');
    manufacturerLabel.textContent = 'Manufacturer: ';
    manufacturerLabel.style.color = '#88c0d0';
    manufacturerLabel.style.fontSize = '12px';
    manufacturerLabel.style.fontWeight = '500';

    const manufacturerSelect = document.createElement('select');
    manufacturerSelect.id = 'filter-manufacturer';
    Object.assign(manufacturerSelect.style, {
      padding: '4px 8px',
      background: 'rgba(16, 32, 48, 0.6)',
      color: '#e0f3ff',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s'
    });
    manufacturerSelect.innerHTML = '<option value="">All</option>' +
      manufacturers.map(m => `<option value="${m}">${m}</option>`).join('');

    manufacturerSelect.onfocus = () => manufacturerSelect.style.borderColor = '#40a9ff';
    manufacturerSelect.onblur = () => manufacturerSelect.style.borderColor = 'rgba(64, 169, 255, 0.3)';

    const typeLabel = document.createElement('label');
    typeLabel.textContent = 'Type: ';
    typeLabel.style.color = '#88c0d0';
    typeLabel.style.fontSize = '12px';
    typeLabel.style.fontWeight = '500';

    const typeSelect = document.createElement('select');
    typeSelect.id = 'filter-type';
    Object.assign(typeSelect.style, {
      padding: '4px 8px',
      background: 'rgba(16, 32, 48, 0.6)',
      color: '#e0f3ff',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s'
    });
    typeSelect.innerHTML = '<option value="">All</option>' +
      types.map(t => `<option value="${t}">${capitalizeFirstLetter(t)}</option>`).join('');

    typeSelect.onfocus = () => typeSelect.style.borderColor = '#40a9ff';
    typeSelect.onblur = () => typeSelect.style.borderColor = 'rgba(64, 169, 255, 0.3)';

    const statusLabel = document.createElement('label');
    statusLabel.textContent = 'Status: ';
    statusLabel.style.color = '#88c0d0';
    statusLabel.style.fontSize = '12px';
    statusLabel.style.fontWeight = '500';

    const statusSelect = document.createElement('select');
    statusSelect.id = 'filter-status';
    Object.assign(statusSelect.style, {
      padding: '4px 8px',
      background: 'rgba(16, 32, 48, 0.6)',
      color: '#e0f3ff',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s'
    });
    statusSelect.innerHTML = '<option value="">All</option>' +
      statuses.map(s => `<option value="${s}">${formatStatus(s)}</option>`).join('');

    statusSelect.onfocus = () => statusSelect.style.borderColor = '#40a9ff';
    statusSelect.onblur = () => statusSelect.style.borderColor = 'rgba(64, 169, 255, 0.3)';

    const currencyLabel = document.createElement('label');
    currencyLabel.textContent = 'Currency: ';
    currencyLabel.style.color = '#88c0d0';
    currencyLabel.style.fontSize = '12px';
    currencyLabel.style.fontWeight = '500';

    const currencySelect = document.createElement('select');
    currencySelect.id = 'filter-currency';
    Object.assign(currencySelect.style, {
      padding: '4px 8px',
      background: 'rgba(16, 32, 48, 0.6)',
      color: '#e0f3ff',
      border: '1px solid rgba(64, 169, 255, 0.3)',
      borderRadius: '4px',
      fontSize: '12px',
      outline: 'none',
      cursor: 'pointer',
      transition: 'all 0.3s'
    });
    currencySelect.innerHTML = '<option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>';

    currencySelect.onfocus = () => currencySelect.style.borderColor = '#40a9ff';
    currencySelect.onblur = () => currencySelect.style.borderColor = 'rgba(64, 169, 255, 0.3)';

    filters.appendChild(favBtn);
    filters.appendChild(searchInput);
    filters.appendChild(clearBtn);
    filters.appendChild(manufacturerLabel);
    filters.appendChild(manufacturerSelect);
    filters.appendChild(typeLabel);
    filters.appendChild(typeSelect);
    filters.appendChild(statusLabel);
    filters.appendChild(statusSelect);
    filters.appendChild(currencyLabel);
    filters.appendChild(currencySelect);

    statsContainer.appendChild(stats);
    statsContainer.appendChild(filters);
    content.appendChild(statsContainer);

    const tableContainer = document.createElement('div');
    tableContainer.className = 'rwx-table-container';
    tableContainer.id = 'rwx-scrollable-table';
    Object.assign(tableContainer.style, {
      maxHeight: 'calc(100vh - 180px)',
      overflow: 'auto',
      position: 'relative'
    });

    const scrollbarStyleId = 'rwx-scrollbar-styles';
    const oldStyle = document.getElementById(scrollbarStyleId);
    if (oldStyle) oldStyle.remove();

    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.id = scrollbarStyleId;
    scrollbarStyle.textContent = `
      .rwx-table-container::-webkit-scrollbar,
      #rwx-scrollable-table::-webkit-scrollbar {
        width: 12px !important;
        height: 12px !important;
      }

      .rwx-table-container::-webkit-scrollbar-track,
      #rwx-scrollable-table::-webkit-scrollbar-track {
        background: #0a1e2e !important;
        border-radius: 6px !important;
        border: 1px solid rgba(64, 169, 255, 0.2) !important;
      }

      .rwx-table-container::-webkit-scrollbar-thumb,
      #rwx-scrollable-table::-webkit-scrollbar-thumb {
        background: #1a4a6f !important;
        border-radius: 6px !important;
        border: 1px solid rgba(64, 169, 255, 0.4) !important;
        box-shadow: inset 0 0 6px rgba(64, 169, 255, 0.3) !important;
      }

      .rwx-table-container::-webkit-scrollbar-thumb:hover,
      #rwx-scrollable-table::-webkit-scrollbar-thumb:hover {
        background: #2a5a7f !important;
        border-color: #40a9ff !important;
        box-shadow: inset 0 0 10px rgba(64, 169, 255, 0.5) !important;
      }

      .rwx-table-container::-webkit-scrollbar-thumb:active,
      #rwx-scrollable-table::-webkit-scrollbar-thumb:active {
        background: #0f3552 !important;
      }

      .rwx-table-container::-webkit-scrollbar-corner,
      #rwx-scrollable-table::-webkit-scrollbar-corner {
        background: #0a1e2e !important;
      }

      .rwx-table-container,
      #rwx-scrollable-table {
        scrollbar-width: thin !important;
        scrollbar-color: #1a4a6f #0a1e2e !important;
      }
    `;

    document.head.appendChild(scrollbarStyle);

    const table = document.createElement('table');
    Object.assign(table.style, {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '12px'
    });

    const thead = document.createElement('thead');
    Object.assign(thead.style, {
      position: 'sticky',
      top: '0',
      zIndex: '10',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
    });

    thead.innerHTML = `
      <tr style="background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); color:#e0f3ff;">
        <th style="padding:8px; text-align:center; border-radius:3px 0 0 0; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); width:10px;">★</th>
        <th style="padding:8px; text-align:left; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%);"></th>
        <th style="padding:8px; text-align:left; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="name">
          Name <span class="sort-indicator">▲</span>
        </th>
        <th style="padding:8px; text-align:left; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="manufacturer">
          Manufacturer <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:left; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="type">
          Type <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:center; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="status">
          Status <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:center; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="cargo">
          Cargo <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:center; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="crew">
          Crew <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:right; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2); white-space: nowrap;" data-sort="auec">
          Price [ aUEC ] <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:right; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2); white-space: nowrap;" data-sort="msrp" id="price-header">
          Price [ USD ] <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:right; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="warbond">
          Warbond <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:right; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); cursor:pointer; user-select:none; border-right:1px solid rgba(64, 169, 255, 0.2);" data-sort="savings">
          Savings <span class="sort-indicator"></span>
        </th>
        <th style="padding:8px; text-align:center; border-radius:0 3px 0 0; position:sticky; top:0; background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%);">Link</th>
      </tr>
    `;
    table.appendChild(thead);

    const headers = thead.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
      header.addEventListener('click', () => {
        const column = header.getAttribute('data-sort');

        if (currentSort.column === column) {
          currentSort.ascending = !currentSort.ascending;
        } else {
          currentSort.column = column;
          currentSort.ascending = true;
        }

        headers.forEach(h => {
          const indicator = h.querySelector('.sort-indicator');
          if (h === header) {
            indicator.textContent = currentSort.ascending ? '▲' : '▼';
          } else {
            indicator.textContent = '';
          }
        });

        saveSettings();
        applyFilters();
      });
    });

    const tbody = document.createElement('tbody');

    function renderShipsTable(shipsToRender, tbodyElement) {
      tbodyElement.innerHTML = '';

      function createDetailsRow(ship, parentIndex) {
        const detailsRow = document.createElement('tr');
        detailsRow.classList.add('details-row');
        Object.assign(detailsRow.style, {
          background: 'rgba(10, 30, 46, 0.8)',
          borderBottom: '2px solid rgba(64, 169, 255, 0.3)'
        });

        const detailsCell = document.createElement('td');
        detailsCell.colSpan = 13;
        detailsCell.style.padding = '10px';

        const detailsContainer = document.createElement('div');
        detailsContainer.style.display = 'flex';
        detailsContainer.style.flexDirection = 'column';
        detailsContainer.style.gap = '5px';

        // Adicionar animação
        if (!document.getElementById('rwx-details-animation')) {
          const style = document.createElement('style');
          style.id = 'rwx-details-animation';
          style.textContent = `
            @keyframes slideDown {
              from {
                opacity: 0;
                transform: translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `;
          document.head.appendChild(style);
        }

        detailsContainer.style.animation = 'slideDown 0.3s ease-out';

        // ========== GRID DE ESPECIFICAÇÕES ==========
        const specsGrid = document.createElement('div');
        Object.assign(specsGrid.style, {
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          fontSize: '11px',
          lineHeight: '1.6',
          background: 'rgba(16, 32, 48, 0.3)',
          padding: '10px 15px',
          borderRadius: '4px',
          border: '1px solid rgba(64, 169, 255, 0.15)',
          width: '250px',
          margin: '0 auto'
        });

        const specs = [
          //['ID', ship.id],
          //['Chassis ID', ship.chassis_id],
          ['Type', capitalizeFirstLetter(ship.type)],
          ['Size', capitalizeFirstLetter(ship.size)],
          ['Focus', ship.focus],
          ['Status', formatStatus(ship.production_status)],
          ['Length', ship.length ? `${ship.length}m` : '-'],
          ['Beam', ship.beam ? `${ship.beam}m` : '-'],
          ['Height', ship.height ? `${ship.height}m` : '-'],
          ['Mass', ship.mass ? `${ship.mass.toLocaleString()} kg` : '-'],
          ['Min Crew', ship.min_crew || '-'],
          ['Max Crew', ship.max_crew || '-'],
          ['Cargo Capacity', ship.cargocapacity ? `${ship.cargocapacity} SCU` : '-'],
          ['SCM Speed', ship.scm_speed ? `${ship.scm_speed} m/s` : '-'],
          ['Max Speed', ship.max_speed ? `${ship.max_speed} m/s` : '-'],
          ['AFT Speed', ship.afterburner_speed ? `${ship.afterburner_speed} m/s` : '-'],
          ['X-Axis Acceleration', ship.xaxis_acceleration ? `${ship.xaxis_acceleration} m/s²` : '-'],
          ['Y-Axis Acceleration', ship.yaxis_acceleration ? `${ship.yaxis_acceleration} m/s²` : '-'],
          ['Z-Axis Acceleration', ship.zaxis_acceleration ? `${ship.zaxis_acceleration} m/s²` : '-'],
          ['Acceleration Main', ship.acceleration_main ? `${ship.acceleration_main} m/s²` : '-'],
          ['Acceleration Retro', ship.acceleration_retro ? `${ship.acceleration_retro} m/s²` : '-'],
          ['Pitch Max', ship.pitch_max ? `${ship.pitch_max}°/s` : '-'],
          ['Yaw Max', ship.yaw_max ? `${ship.yaw_max}°/s` : '-'],
          ['Roll Max', ship.roll_max ? `${ship.roll_max}°/s` : '-'],
          ['Hull HP', ship.hull_hp ? ship.hull_hp.toLocaleString() : '-'],
          ['Shield HP', ship.shield_hp ? ship.shield_hp.toLocaleString() : '-'],
          ['Quantum Fuel', ship.quantum_fuel_tanks ? `${ship.quantum_fuel_tanks.toLocaleString()} L` : '-'],
          ['Hydrogen Fuel', ship.hydrogen_fuel_tanks ? `${ship.hydrogen_fuel_tanks.toLocaleString()} L` : '-'],
          ['Container Sizes', getContainerSizes(ship.name)],
          ['Hangar', getPadType(ship.name)]
        ];

        specs.forEach(([label, value]) => {
          if (value && value !== '-') {
            const item = document.createElement('div');
            Object.assign(item.style, {
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              borderBottom: '1px solid rgba(64, 169, 255, 0.1)',
              paddingBottom: '3px',
              paddingTop: '3px'
            });
            
            // Criar elementos separadamente para permitir HTML no value
            const labelSpan = document.createElement('span');
            labelSpan.style.color = '#6b8da6';
            labelSpan.style.textAlign = 'right';
            labelSpan.style.minWidth = '90px';
            labelSpan.textContent = label + ':';
            
            const valueSpan = document.createElement('span');
            valueSpan.style.color = '#d0e7f5';
            valueSpan.style.fontWeight = '500';
            valueSpan.style.textAlign = 'left';
            valueSpan.style.minWidth = '150px';
            valueSpan.style.lineHeight = '1.4';
            valueSpan.innerHTML = value; // Usar innerHTML para permitir <br>
            
            item.appendChild(labelSpan);
            item.appendChild(valueSpan);
            specsGrid.appendChild(item);
          }
        });

        // Remover última borda
        const lastItem = specsGrid.lastElementChild;
        if (lastItem) lastItem.style.borderBottom = 'none';

        // ========== MODIFIED INFO (topo, alinhado à direita) ==========
        if (ship.time_modified || ship['time_modified.unfiltered']) {
          const modifiedInfo = document.createElement('div');
          Object.assign(modifiedInfo.style, {
            textAlign: 'right',
            color: '#6b8da6',
            fontSize: '11px',
            fontStyle: 'italic'
          });
          
          const timeText = ship.time_modified || '-';
          const dateText = ship['time_modified.unfiltered'] || '';
          
          modifiedInfo.innerHTML = `Modified: ${timeText} ${dateText ? ` [ ${dateText} ]` : ''}`;
          
          detailsContainer.appendChild(modifiedInfo);
        }

        // ========== PRODUCTION NOTE (se existir) ==========
        if (ship.production_note) {
          const productionNoteSection = document.createElement('div');
          Object.assign(productionNoteSection.style, {
            background: 'rgba(255, 152, 0, 0.15)',
            border: '1px solid rgba(255, 152, 0, 0.3)',
            borderLeft: '3px solid #ff9800',
            borderRadius: '6px',
            padding: '12px 15px',
            marginBottom: '12px'
          });
          
          productionNoteSection.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 16px;">⚠️</span>
              <h4 style="margin: 0; color: #ff9800; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                Production Note
              </h4>
            </div>
            <p style="color: #ffd699; font-size: 11px; line-height: 1.5; margin: 0;">
              ${ship.production_note}
            </p>
          `;
          
          detailsContainer.appendChild(productionNoteSection);
        }

        // ========== DESCRIÇÃO (CARD) ==========
        let descriptionHtml = '';
        if (ship.description) {
          descriptionHtml = `
            <div style="background: rgba(16, 32, 48, 0.5); border-radius: 6px; padding: 12px; border-left: 3px solid #40a9ff;">
              <h4 style="margin: 0 0 8px 0; color: #40a9ff; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                Description
              </h4>
              <p style="color: #d0e7f5; font-size: 12px; line-height: 1.6; margin: 0;">${ship.description}</p>
            </div>
          `;
        }

        detailsContainer.appendChild(specsGrid);

        // ==========================================

        // Função para formatar nomes de terminais
        function formatTerminalName(terminal) {
          if (!terminal) return 'Unknown';
          
          // Mapeamento de padrões usando regex
          const patterns = [
            // New Deal (Lorville)
            { regex: /^New Deal.*Lorville$/i, format: 'Lorville ≫ New Deal' },
            
            // Astro Armada (Area18)
            { regex: /^Astro Armada$/i, format: 'Area18 ≫ Astro Armada' },
            
            // New Deal Crusader / Crusader Showroom / Orison
            { regex: /New Deal.*Crusader|Crusader.*Showroom|Orison/i, format: 'Orison ≫ Showroom' },
            
            // Buy and Fly (Ruin Station) - todas as variações
            { regex: /Buy.*Fly.*(Ruin|Checkmate|Orbituary)/i, format: 'Ruin Station ≫ Buy and Fly' },
            
            // Teach's (Levski)
            { regex: /Teach'?s.*Levski|Levski.*Teach'?s/i, format: "Levski ≫ Teach's Ship Shop" }
          ];
          
          // Tentar encontrar padrão correspondente
          for (const pattern of patterns) {
            if (pattern.regex.test(terminal)) {
              return pattern.format;
            }
          }
          
          // Se não encontrou padrão, retornar original
          return terminal;
        }

        // Validar se deve mostrar aUEC (mesma validação)
        const shouldShowAUEC = (() => {
          const auec = auecPricesData?.[ship.name];
          const msrp = pricesData?.[ship.name]?.msrp;
          if (!auec) return false;
          if (msrp && (msrp / 100 * 1000 > auec)) return false;
          return true;
        })();

        // ========== TABELA DE LOCAIS DE COMPRA aUEC ==========
        let buyLocationsHtml = '';
        if (uexAPI && shouldShowAUEC) {
          const locations = uexAPI.getAUECLocationsByName(ship.name);
          
          if (locations && locations.length > 0) {
            // Ordenar por preço (menor para maior)
            const sortedLocations = [...locations].sort((a, b) => a.price - b.price);
            
            // Construir linhas da tabela
            const locationRows = sortedLocations.map((loc, index) => {
              const priceFormatted = loc.price ? loc.price.toLocaleString('en-US') : '-';
              const bgColor = index % 2 === 0 ? 'rgba(16, 32, 48, 0.4)' : 'rgba(10, 22, 34, 0.4)';
              const terminalFormatted = formatTerminalName(loc.terminal); // ← FORMATAÇÃO APLICADA
              
              return `
                <tr style="background: ${bgColor};">
                  <td style="padding: 8px; color: #d0e7f5; font-size: 11px; border-bottom: 1px solid rgba(64, 169, 255, 0.1);">
                    ${terminalFormatted}
                  </td>
                  <td style="padding: 8px; color: #88c0d0; font-size: 11px; font-weight: bold; text-align: right; border-bottom: 1px solid rgba(64, 169, 255, 0.1);">
                    ${priceFormatted}
                  </td>
                </tr>
              `;
            }).join('');
            
            buyLocationsHtml = `
              <div style="background: rgba(16, 32, 48, 0.5); border-radius: 6px; padding: 12px; border-left: 3px solid #4caf50; margin-top: 12px;">
                <h4 style="margin: 0 0 10px 0; color: #4caf50; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                  Buy Locations (${sortedLocations.length})
                </h4>
                <table style="width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%);">
                      <th style="padding: 8px; color: #e0f3ff; font-size: 11px; text-align: left; border-bottom: 2px solid rgba(64, 169, 255, 0.3);">
                        Location
                      </th>
                      <th style="padding: 8px; color: #e0f3ff; font-size: 11px; text-align: right; border-bottom: 2px solid rgba(64, 169, 255, 0.3);">
                        Price [ aUEC ]
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    ${locationRows}
                  </tbody>
                </table>
              </div>
            `;
          }
        }

        // ========== FUNÇÃO PARA RENDERIZAR COMPONENTES ==========
        const renderComponentGroup = (title, components, icon = '') => {
          if (!components || components.length === 0) return '';

          const componentsHtml = components.map(comp => {
            const details = [];
            const name = comp.name || '';
            
            if (comp.manufacturer) details.push(`Manufacturer: ${comp.manufacturer}`);
            if (comp.component_size) details.push(`Component Size: ${convertSizeToNumber(comp.component_size)}`);
            if (comp.size) details.push(`Size: ${convertSizeToNumber(comp.size)}`);
            if (comp.quantity) details.push(`Qty: ${comp.quantity}`);
            if (comp.mounts) details.push(`Mounts: ${comp.mounts}`);
            if (comp.details) details.push(`Details: ${comp.details}`);

            const detailsText = details.length > 0 ? ': ' + details.join(' / ') : '';

            return `<div style="padding: 6px 10px; background: rgba(16, 32, 48, 0.4); border-radius: 4px; font-size: 11px; line-height: 1.5; color: #d0e7f5;">
              <strong style="color: #5AABD2;">${name}</strong>${detailsText}
            </div>`;
          }).join('');

          return `
            <div style="margin-top: 10px;">
              <h5 style="margin: 0 0 8px 0; color: #40a9ff; font-size: 12px; font-weight: bold;">
                ${icon} <span style="vertical-align: baseline !important; color: #ffffff;">${components.length}x</span> ${title}
              </h5>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 6px;">
                ${componentsHtml}
              </div>
            </div>
          `;
        };

        // ========== COMPONENTES - RSIAvionic ==========
        let avionicsHtml = '';
        if (ship.compiled && ship.compiled.RSIAvionic) {
          const avionic = ship.compiled.RSIAvionic;
          let allComponents = '';

          if (avionic.radar) allComponents += renderComponentGroup('Radar', avionic.radar, '');
          if (avionic.computers) allComponents += renderComponentGroup('Computers', avionic.computers, '');
          if (avionic.power_plants) allComponents += renderComponentGroup('Power Plants', avionic.power_plants, '');
          if (avionic.coolers) allComponents += renderComponentGroup('Coolers', avionic.coolers, '');
          if (avionic.shield_generators) allComponents += renderComponentGroup('Shield Generators', avionic.shield_generators, '');

          if (allComponents) {
            avionicsHtml = `
              <div style="padding: 10px; max-width: 260px;">
                <h4 style="margin: 0 0 10px 0; color: #40a9ff; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                  Avionics
                </h4>
                ${allComponents}
              </div>
            `;
          }
        }

        // ========== COMPONENTES - RSIPropulsion ==========
        let propulsionHtml = '';
        if (ship.compiled && ship.compiled.RSIPropulsion) {
          const propulsion = ship.compiled.RSIPropulsion;
          let allComponents = '';

          if (propulsion.fuel_intakes) allComponents += renderComponentGroup('Fuel Intakes', propulsion.fuel_intakes, '');
          if (propulsion.fuel_tanks) allComponents += renderComponentGroup('Fuel Tanks', propulsion.fuel_tanks, '');
          if (propulsion.quantum_drives) allComponents += renderComponentGroup('Quantum Drives', propulsion.quantum_drives, '');
          if (propulsion.jump_modules) allComponents += renderComponentGroup('Jump Modules', propulsion.jump_modules, '');
          if (propulsion.quantum_fuel_tanks) allComponents += renderComponentGroup('Quantum Fuel Tanks', propulsion.quantum_fuel_tanks, '');
          if (propulsion.main_thrusters) allComponents += renderComponentGroup('Main Thrusters', propulsion.main_thrusters, '');
          if (propulsion.maneuvering_thrusters) allComponents += renderComponentGroup('Maneuvering Thrusters', propulsion.maneuvering_thrusters, '');

          if (allComponents) {
            propulsionHtml = `
              <div style="padding: 10px; max-width: 260px;">
                <h4 style="margin: 0 0 10px 0; color: #40a9ff; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                  Propulsion
                </h4>
                ${allComponents}
              </div>
            `;
          }
        }

        // ========== COMPONENTES - RSIWeapon ==========
        let weaponsHtml = '';
        if (ship.compiled && ship.compiled.RSIWeapon) {
          const weapons = ship.compiled.RSIWeapon;
          let allComponents = '';

          if (weapons.weapons) allComponents += renderComponentGroup('Weapons', weapons.weapons, '');
          if (weapons.turrets) allComponents += renderComponentGroup('Turrets', weapons.turrets, '');
          if (weapons.missiles) allComponents += renderComponentGroup('Missiles', weapons.missiles, '');

          if (allComponents) {
            weaponsHtml = `
              <div style="padding: 10px; max-width: 260px;">
                <h4 style="margin: 0 0 10px 0; color: #40a9ff; font-size: 13px; font-weight: bold; text-transform: uppercase;">
                  Weapons
                </h4>
                ${allComponents}
              </div>
            `;
          }
        }

        // ========== MEDIA GALLERY (PHOTOS + VIDEO) ==========
        function isValidImageUrl(url) {
          try {
            const u = new URL(url);
            if (!u.hostname || u.hostname.length < 4) return false;
            if (!u.pathname || u.pathname === '/') return false;
            return /\.(png|jpe?g|webp|gif)$/i.test(u.pathname);
          } catch {
            return false;
          }
        }

        let photos = [];
        let videoUrl = null;

        // Tentar buscar fotos e vídeo da UEX API
        if (uexAPI) {
          const uexData = uexAPI.getVehicleByName(ship.name);
          if (uexData) {
            // Processar fotos
            if (uexData.url_photos) {
              const rawPhotos = uexData.url_photos.split(',').map(url => url.trim()).filter(Boolean);
              
              photos = rawPhotos.map(rawUrl => {
                if (!rawUrl) return null;
                let url = rawUrl;
                url = url.replace(/["']/g, '').replace(/%22/g, '');
                url = url.replace(/\\\//g, '/');
                url = url.replace(/^\[+/, '').replace(/\]+$/, '');
                url = url.replace(/^(https?:)?\/+/i, '');
                url = url.replace(/\/{2,}/g, '/');
                url = 'https://' + url;
                if (!isValidImageUrl(url)) return null;
                return url;
              }).filter(Boolean);
            }
            
            // Processar vídeo
            if (uexData.url_video) {
              let rawVideo = uexData.url_video.trim();
              if (rawVideo) {
                rawVideo = rawVideo.replace(/["']/g, '').replace(/%22/g, '');
                rawVideo = rawVideo.replace(/\\\//g, '/');
                
                // Extrair ID do YouTube
                let youtubeId = null;
                const patterns = [
                  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
                  /^([a-zA-Z0-9_-]{11})$/
                ];
                
                for (const pattern of patterns) {
                  const match = rawVideo.match(pattern);
                  if (match) {
                    youtubeId = match[1];
                    break;
                  }
                }
                
                if (youtubeId) {
                  videoUrl = `https://www.youtube.com/embed/${youtubeId}`;
                }
              }
            }
          }
        }

        // Fallback para media do Ship Matrix
        if (photos.length === 0) {
          const mediaPhotos = ship.media?.filter(m => m.images?.source || m.source_url);
          if (mediaPhotos && mediaPhotos.length > 0) {
            photos = mediaPhotos.map(m => m.images?.source || m.source_url).filter(Boolean);
          }
        }

        // Mostrar Media Gallery se houver fotos OU vídeo
        if (photos.length > 0 || videoUrl) {
          const mediaGalleryContainer = document.createElement('div');
          Object.assign(mediaGalleryContainer.style, {
            background: 'rgba(16, 32, 48, 0.5)',
            borderRadius: '6px',
            padding: '12px',
            borderLeft: '3px solid #40a9ff',
            marginBottom: '12px',
            width: '1140px'
          });
          
          const mediaTitle = document.createElement('h4');
          Object.assign(mediaTitle.style, {
            margin: '0 0 10px 0',
            color: '#40a9ff',
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          });
          mediaTitle.textContent = 'Media Gallery';
          
          // Tabs (abas)
          const tabsContainer = document.createElement('div');
          Object.assign(tabsContainer.style, {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '10px',
            borderBottom: '1px solid rgba(64, 169, 255, 0.3)',
            paddingBottom: '8px'
          });

          // Container dos botões de tabs
          const tabButtonsContainer = document.createElement('div');
          Object.assign(tabButtonsContainer.style, {
            display: 'flex',
            gap: '10px'
          });

          // Container dos links
          const linksContainer = document.createElement('div');
          Object.assign(linksContainer.style, {
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          });

          const linksLabel = document.createElement('span');
          linksLabel.textContent = 'Links: ';
          Object.assign(linksLabel.style, {
            color: '#88c0d0',
            fontSize: '12px',
            fontWeight: '500'
          });
          linksContainer.appendChild(linksLabel);

          // Buscar URLs da UEX API
          let urlStore = null;
          let urlBrochure = null;
          let urlHotsite = null;

          if (uexAPI) {
            const uexData = uexAPI.getVehicleByName(ship.name);
            if (uexData) {
              urlStore = uexData.url_store || null;
              urlBrochure = uexData.url_brochure || null;
              urlHotsite = uexData.url_hotsite || null;
            }
          }

          // Criar botões de links
          const createLinkButton = (text, url) => {
            if (!url) return null;
            
            const btn = document.createElement('a');
            btn.textContent = text;
            btn.href = url;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            Object.assign(btn.style, {
              padding: '6px 12px',
              background: 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)',
              color: '#88c0d0',
              border: '1px solid rgba(64, 169, 255, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textDecoration: 'none',
              display: 'inline-block'
            });
            
            btn.onmouseenter = () => {
              btn.style.background = 'linear-gradient(135deg, #2a4a62 0%, #1f3848 100%)';
              btn.style.borderColor = '#40a9ff';
              btn.style.boxShadow = '0 0 8px rgba(64, 169, 255, 0.4)';
              btn.style.color = '#fff';
            };
            btn.onmouseleave = () => {
              btn.style.background = 'linear-gradient(135deg, #1a3a52 0%, #0f2838 100%)';
              btn.style.borderColor = 'rgba(64, 169, 255, 0.3)';
              btn.style.boxShadow = 'none';
              btn.style.color = '#88c0d0';
            };
            
            return btn;
          };

          const storeBtn = createLinkButton('Store', urlStore);
          const brochureBtn = createLinkButton('Brochure', urlBrochure);
          const hotsiteBtn = createLinkButton('Hotsite', urlHotsite);

          if (storeBtn) linksContainer.appendChild(storeBtn);
          if (brochureBtn) linksContainer.appendChild(brochureBtn);
          if (hotsiteBtn) linksContainer.appendChild(hotsiteBtn);

          // Ocultar container de links se não houver nenhum link
          if (!storeBtn && !brochureBtn && !hotsiteBtn) {
            linksContainer.style.display = 'none';
          }
          
          const photosTab = document.createElement('button');
          photosTab.textContent = `Photos (${photos.length})`;
          Object.assign(photosTab.style, {
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #1a4a6f 0%, #0f3552 100%)',
            color: '#fff',
            border: '1px solid #40a9ff',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s'
          });
          
          const videoTab = document.createElement('button');
          videoTab.textContent = 'Video';
          Object.assign(videoTab.style, {
            padding: '8px 16px',
            background: 'rgba(16, 32, 48, 0.6)',
            color: '#88c0d0',
            border: '1px solid rgba(64, 169, 255, 0.3)',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s',
            display: videoUrl ? 'block' : 'none'
          });
          
          // Conteúdo das abas
          const photosContent = document.createElement('div');
          photosContent.style.display = 'block';
          
          const videoContent = document.createElement('div');
          videoContent.style.display = 'none';
          
          // Função para alternar abas
          function switchTab(showPhotos) {
            if (showPhotos) {
              photosTab.style.background = 'linear-gradient(135deg, #1a4a6f 0%, #0f3552 100%)';
              photosTab.style.borderColor = '#40a9ff';
              photosTab.style.color = '#fff';
              videoTab.style.background = 'rgba(16, 32, 48, 0.6)';
              videoTab.style.borderColor = 'rgba(64, 169, 255, 0.3)';
              videoTab.style.color = '#88c0d0';
              photosContent.style.display = 'block';
              videoContent.style.display = 'none';
            } else {
              videoTab.style.background = 'linear-gradient(135deg, #1a4a6f 0%, #0f3552 100%)';
              videoTab.style.borderColor = '#40a9ff';
              videoTab.style.color = '#fff';
              photosTab.style.background = 'rgba(16, 32, 48, 0.6)';
              photosTab.style.borderColor = 'rgba(64, 169, 255, 0.3)';
              photosTab.style.color = '#88c0d0';
              photosContent.style.display = 'none';
              videoContent.style.display = 'block';
            }
          }
          
          photosTab.onclick = () => switchTab(true);
          videoTab.onclick = () => switchTab(false);
          
          // ========== PHOTOS CONTENT ==========
          if (photos.length > 0) {
            const galleryWrapper = document.createElement('div');
            Object.assign(galleryWrapper.style, {
              position: 'relative',
              width: '100%',
              height: '400px',
              overflow: 'hidden',
              borderRadius: '4px',
              border: '1px solid rgba(64, 169, 255, 0.2)',
              background: '#0a1e2e'
            });
            
            let currentPhotoIndex = 0;
            const mainPhoto = document.createElement('img');
            mainPhoto.src = photos[0];
            Object.assign(mainPhoto.style, {
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              transition: 'opacity 0.3s'
            });
            
            mainPhoto.onerror = () => {
              mainPhoto.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22400%22%3E%3Crect fill=%22%23102030%22 width=%22800%22 height=%22400%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2340a9ff%22 font-size=%2218%22%3EImage unavailable%3C/text%3E%3C/svg%3E';
            };
            
            const counter = document.createElement('div');
            Object.assign(counter.style, {
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(15, 44, 62, 0.9)',
              color: '#fff',
              padding: '5px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: 'bold',
              zIndex: '2'
            });
            counter.textContent = `1 / ${photos.length}`;
            
            const prevBtn = document.createElement('button');
            prevBtn.innerHTML = '‹';
            Object.assign(prevBtn.style, {
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 44, 62, 0.9)',
              color: '#fff',
              border: '1px solid rgba(64, 169, 255, 0.5)',
              borderRadius: '4px',
              fontSize: '32px',
              width: '50px',
              height: '50px',
              cursor: 'pointer',
              zIndex: '2',
              transition: 'all 0.3s',
              display: photos.length > 1 ? 'block' : 'none'
            });
            
            prevBtn.onmouseenter = () => {
              prevBtn.style.background = 'rgba(64, 169, 255, 0.8)';
              prevBtn.style.borderColor = '#40a9ff';
            };
            prevBtn.onmouseleave = () => {
              prevBtn.style.background = 'rgba(15, 44, 62, 0.9)';
              prevBtn.style.borderColor = 'rgba(64, 169, 255, 0.5)';
            };
            
            prevBtn.onclick = (e) => {
              e.stopPropagation();
              currentPhotoIndex = (currentPhotoIndex - 1 + photos.length) % photos.length;
              mainPhoto.style.opacity = '0';
              setTimeout(() => {
                mainPhoto.src = photos[currentPhotoIndex];
                mainPhoto.style.opacity = '1';
                counter.textContent = `${currentPhotoIndex + 1} / ${photos.length}`;
                
                // Atualizar borda das thumbnails e scroll
                const thumbs = photosContent.querySelectorAll('img[style*="width: 80px"]');
                thumbs.forEach((t, i) => {
                  t.style.border = i === currentPhotoIndex ? '2px solid #40a9ff' : '2px solid rgba(64, 169, 255, 0.2)';
                });

                // Scroll automático para miniatura selecionada
                if (thumbs[currentPhotoIndex]) {
                  thumbs[currentPhotoIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                  });
                }
              }, 150);
            };
            
            const nextBtn = document.createElement('button');
            nextBtn.innerHTML = '›';
            Object.assign(nextBtn.style, {
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(15, 44, 62, 0.9)',
              color: '#fff',
              border: '1px solid rgba(64, 169, 255, 0.5)',
              borderRadius: '4px',
              fontSize: '32px',
              width: '50px',
              height: '50px',
              cursor: 'pointer',
              zIndex: '2',
              transition: 'all 0.3s',
              display: photos.length > 1 ? 'block' : 'none'
            });
            
            nextBtn.onmouseenter = () => {
              nextBtn.style.background = 'rgba(64, 169, 255, 0.8)';
              nextBtn.style.borderColor = '#40a9ff';
            };
            nextBtn.onmouseleave = () => {
              nextBtn.style.background = 'rgba(15, 44, 62, 0.9)';
              nextBtn.style.borderColor = 'rgba(64, 169, 255, 0.5)';
            };
            
            nextBtn.onclick = (e) => {
              e.stopPropagation();
              currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
              mainPhoto.style.opacity = '0';
              setTimeout(() => {
                mainPhoto.src = photos[currentPhotoIndex];
                mainPhoto.style.opacity = '1';
                counter.textContent = `${currentPhotoIndex + 1} / ${photos.length}`;
                
                // Atualizar borda das thumbnails e scroll
                const thumbs = photosContent.querySelectorAll('img[style*="width: 80px"]');
                thumbs.forEach((t, i) => {
                  t.style.border = i === currentPhotoIndex ? '2px solid #40a9ff' : '2px solid rgba(64, 169, 255, 0.2)';
                });

                // Scroll automático para miniatura selecionada
                if (thumbs[currentPhotoIndex]) {
                  thumbs[currentPhotoIndex].scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                  });
                }
              }, 150);
            };
            
            galleryWrapper.appendChild(mainPhoto);
            galleryWrapper.appendChild(counter);
            galleryWrapper.appendChild(prevBtn);
            galleryWrapper.appendChild(nextBtn);
            
            // Thumbnails
            if (photos.length > 1) {
              const thumbsContainer = document.createElement('div');
              Object.assign(thumbsContainer.style, {
                display: 'flex',
                gap: '8px',
                marginTop: '10px',
                overflowX: 'auto',
                padding: '5px 0'
              });
              
              photos.forEach((photoUrl, index) => {
                const thumb = document.createElement('img');
                thumb.src = photoUrl;
                Object.assign(thumb.style, {
                  width: '80px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: index === 0 ? '2px solid #40a9ff' : '2px solid rgba(64, 169, 255, 0.2)',
                  transition: 'all 0.3s',
                  flexShrink: '0'
                });
                
                thumb.onerror = () => {
                  thumb.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2260%22%3E%3Crect fill=%22%23102030%22 width=%2280%22 height=%2260%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2340a9ff%22 font-size=%228%22%3EX%3C/text%3E%3C/svg%3E';
                };
                
                thumb.onclick = () => {
                  currentPhotoIndex = index;
                  mainPhoto.style.opacity = '0';
                  setTimeout(() => {
                    mainPhoto.src = photos[currentPhotoIndex];
                    mainPhoto.style.opacity = '1';
                    counter.textContent = `${currentPhotoIndex + 1} / ${photos.length}`;
                    
                    thumbsContainer.querySelectorAll('img').forEach((t, i) => {
                      t.style.border = i === index ? '2px solid #40a9ff' : '2px solid rgba(64, 169, 255, 0.2)';
                    });
                  }, 150);
                };
                
                thumb.onmouseenter = () => {
                  if (index !== currentPhotoIndex) {
                    thumb.style.borderColor = '#40a9ff';
                    thumb.style.transform = 'scale(1.05)';
                  }
                };
                thumb.onmouseleave = () => {
                  if (index !== currentPhotoIndex) {
                    thumb.style.borderColor = 'rgba(64, 169, 255, 0.2)';
                    thumb.style.transform = 'scale(1)';
                  }
                };
                
                thumbsContainer.appendChild(thumb);
              });
              
              photosContent.appendChild(galleryWrapper);
              photosContent.appendChild(thumbsContainer);
            } else {
              photosContent.appendChild(galleryWrapper);
            }
          }
          
          // ========== VIDEO CONTENT ==========
          if (videoUrl) {
            const videoWrapper = document.createElement('div');
            Object.assign(videoWrapper.style, {
              position: 'relative',
              width: '100%',
              paddingBottom: '56.25%', // 16:9 aspect ratio
              height: '0',
              overflow: 'hidden',
              borderRadius: '4px',
              border: '1px solid rgba(64, 169, 255, 0.2)'
            });
            
            const iframe = document.createElement('iframe');
            iframe.src = videoUrl;
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allowfullscreen', 'true');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            Object.assign(iframe.style, {
              position: 'absolute',
              top: '0',
              left: '0',
              width: '100%',
              height: '100%'
            });
            
            videoWrapper.appendChild(iframe);
            videoContent.appendChild(videoWrapper);
          }
          
          // Montar estrutura
          mediaGalleryContainer.appendChild(mediaTitle);
          tabButtonsContainer.appendChild(photosTab);
          tabButtonsContainer.appendChild(videoTab);
          tabsContainer.appendChild(tabButtonsContainer);
          tabsContainer.appendChild(linksContainer);
          mediaGalleryContainer.appendChild(tabsContainer);
          mediaGalleryContainer.appendChild(photosContent);
          mediaGalleryContainer.appendChild(videoContent);
          
          detailsContainer.appendChild(mediaGalleryContainer);
        }

        // ========== DESCRIÇÃO PRIMEIRO (se existir) ==========
        if (descriptionHtml) {
          const descriptionContainer = document.createElement('div');
          descriptionContainer.innerHTML = descriptionHtml;
          detailsContainer.appendChild(descriptionContainer);
        }

        // ========== BUY LOCATIONS (se existir) ==========
        if (buyLocationsHtml) {
          const buyLocationsContainer = document.createElement('div');
          buyLocationsContainer.innerHTML = buyLocationsHtml;
          detailsContainer.appendChild(buyLocationsContainer);
        }

        // ========== LOANERS ==========
        const loaners = getLoanersForShip(ship.name);

        if (loaners.length > 0) {
          const loanersContainer = document.createElement('div');
          Object.assign(loanersContainer.style, {
            background: 'rgba(16, 32, 48, 0.5)',
            borderRadius: '6px',
            padding: '12px',
            borderLeft: '3px solid #ffa726',
            marginTop: '12px'
          });
          
          const loanersTitle = document.createElement('h4');
          Object.assign(loanersTitle.style, {
            margin: '0 0 10px 0',
            color: '#ffa726',
            fontSize: '13px',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          });
          loanersTitle.textContent = `Loaners (${loaners.length})`;
          
          const loanersGrid = document.createElement('div');
          Object.assign(loanersGrid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '8px'
          });
          
          loaners.forEach(loaner => {
            const loanerItem = document.createElement('div');
            Object.assign(loanerItem.style, {
              padding: '8px 12px',
              background: 'rgba(255, 167, 38, 0.1)',
              border: '1px solid rgba(255, 167, 38, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '500',
              color: '#ffd699',
              textAlign: 'center',
              transition: 'all 0.3s',
              cursor: 'default'
            });
            loanerItem.textContent = loaner;
            
            loanerItem.onmouseenter = () => {
              loanerItem.style.background = 'rgba(255, 167, 38, 0.2)';
              loanerItem.style.borderColor = '#ffa726';
              loanerItem.style.transform = 'translateY(-2px)';
              loanerItem.style.boxShadow = '0 4px 8px rgba(255, 167, 38, 0.3)';
            };
            loanerItem.onmouseleave = () => {
              loanerItem.style.background = 'rgba(255, 167, 38, 0.1)';
              loanerItem.style.borderColor = 'rgba(255, 167, 38, 0.3)';
              loanerItem.style.transform = 'translateY(0)';
              loanerItem.style.boxShadow = 'none';
            };
            
            loanersGrid.appendChild(loanerItem);
          });
          
          loanersContainer.appendChild(loanersTitle);
          loanersContainer.appendChild(loanersGrid);
          detailsContainer.appendChild(loanersContainer);
        }

        // ========== MONTAGEM FINAL - SPECS À ESQUERDA, COMPONENTES À DIREITA ==========

        // Container principal com specs + componentes lado a lado
        const mainContentGrid = document.createElement('div');
        Object.assign(mainContentGrid.style, {
          display: 'flex',
          gap: '15px',
          marginTop: '12px',
          alignItems: 'flex-start'
        });

        // Adicionar specs à esquerda
        specsGrid.style.margin = '0'; // Remover centralização
        mainContentGrid.appendChild(specsGrid);

        // Container dos componentes à direita
        const componentsWrapper = document.createElement('div');
        Object.assign(componentsWrapper.style, {
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        });

        if (avionicsHtml || propulsionHtml || weaponsHtml) {
          const componentsArray = [weaponsHtml, propulsionHtml, avionicsHtml].filter(c => c);
          const componentCount = componentsArray.length;
          
          const componentsGrid = document.createElement('div');
          Object.assign(componentsGrid.style, {
            display: 'grid',
            gridTemplateColumns: `repeat(${componentCount}, 1fr)`,
            gap: '12px'
          });
          
          componentsGrid.innerHTML = componentsArray.join('');
          componentsWrapper.appendChild(componentsGrid);
        }

        mainContentGrid.appendChild(componentsWrapper);
        detailsContainer.appendChild(mainContentGrid);

        detailsCell.appendChild(detailsContainer);
        detailsRow.appendChild(detailsCell);

        return detailsRow;
      }

      shipsToRender.forEach((ship, index) => {
        const tr = document.createElement('tr');
        Object.assign(tr.style, {
          background: index % 2 === 0 ? 'rgba(16, 32, 48, 0.3)' : 'rgba(10, 22, 34, 0.5)',
          borderBottom: '1px solid rgba(64, 169, 255, 0.15)',
          transition: 'all 0.2s',
          height: '40px'
        });

        tr.onmouseenter = () => {
          if (!tr.classList.contains('expanded')) {
            tr.style.background = 'rgba(64, 169, 255, 0.15)';
            tr.style.borderColor = 'rgba(64, 169, 255, 0.4)';
          }
        };
        tr.onmouseleave = () => {
          if (!tr.classList.contains('expanded')) {
            tr.style.background = index % 2 === 0 ? 'rgba(16, 32, 48, 0.3)' : 'rgba(10, 22, 34, 0.5)';
            tr.style.borderColor = 'rgba(64, 169, 255, 0.15)';
          }
        };

        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
          // Evitar expandir quando clicar no link "Go"
          if (e.target.tagName === 'A' || e.target.closest('a')) {
            return;
          }

          const existingDetails = tr.nextElementSibling;
          
          if (existingDetails && existingDetails.classList.contains('details-row')) {
            // Recolher
            existingDetails.remove();
            tr.classList.remove('expanded');
            tr.style.background = index % 2 === 0 ? 'rgba(16, 32, 48, 0.3)' : 'rgba(10, 22, 34, 0.5)';
            tr.style.borderColor = 'rgba(64, 169, 255, 0.15)';
          } else {
            // Expandir
            const detailsRow = createDetailsRow(ship, index);
            tr.after(detailsRow);
            tr.classList.add('expanded');
            tr.style.background = 'rgba(64, 169, 255, 0.2)';
            tr.style.borderColor = 'rgba(64, 169, 255, 0.5)';
          }
        };

        const imgUrl = ship.media?.[0]?.images?.store_small || '';

        // Buscar preço aUEC
        const auecPrice = auecPricesData?.[ship.name];

        // Buscar preços
        const msrpPrice = pricesData?.[ship.name]?.msrp;

        // Validar preço aUEC - não mostrar se USD*1000 > aUEC
        let auecFormatted = '-';
        let auecPriceValid = false;
        if (auecPrice && msrpPrice) {
          const usdInCents = msrpPrice;
          const usdValue = usdInCents / 100;
          if (usdValue * 1000 <= auecPrice) {
            auecFormatted = auecPrice.toLocaleString('en-US');
            auecPriceValid = true;
          }
        } else if (auecPrice) {
          auecFormatted = auecPrice.toLocaleString('en-US');
          auecPriceValid = true;
        }

        const standardPrice = pricesData?.[ship.name]?.standard;
        const warbondPrice = pricesData?.[ship.name]?.warbond;

        const selectedCurrency = currencySelect.value;
        const msrpFormatted = msrpPrice ? formatPrice(msrpPrice, selectedCurrency) : '-';
        const standardFormatted = standardPrice ? formatPrice(standardPrice, selectedCurrency) : '-';
        const warbondFormatted = warbondPrice ? formatPrice(warbondPrice, selectedCurrency) : '-';

        // Calcular economia (Savings) - MSRP vs Warbond
        let savingsFormatted = '-';
        let savingsColor = '#888';
        if (msrpPrice && warbondPrice && msrpPrice > warbondPrice) {
          const savings = msrpPrice - warbondPrice;
          savingsFormatted = formatPrice(savings, selectedCurrency);
          savingsColor = '#2ea043';
        }

        // Status badge color
        let statusColor = '#40a9ff';
        if (ship.production_status === 'flight-ready') statusColor = '#4caf50';
        else if (ship.production_status === 'in-concept') statusColor = '#607d8b';
        else if (ship.production_status === 'in-production') statusColor = '#ff9800';

        const isFavorite = favoriteShips.has(ship.name);

        tr.innerHTML = `
          <td style="padding:6px; text-align:center; border-right:1px solid rgba(64, 169, 255, 0.1);">
            <button class="fav-star" data-ship="${ship.name}" style="background:none; border:none; color:${isFavorite ? '#ffa726' : '#3a5a6f'}; font-size:20px; cursor:pointer; padding:0; line-height:1; transition:all 0.2s;">★</button>
          </td>
          <td style="padding:6px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            <img src="${imgUrl}"
                 style="width:60px; height:40px; object-fit:cover; border-radius:4px; display:block; border:1px solid rgba(64, 169, 255, 0.2);"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22%3E%3Crect fill=%22%23102030%22 width=%2260%22 height=%2240%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%2340a9ff%22 font-size=%229%22%3E--%3C/text%3E%3C/svg%3E'" />
          </td>
          <td style="padding:6px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            <div style="font-weight:bold; color:#40a9ff; font-size:13px;">${ship.name}</div>
            <div style="color:#88c0d0; font-size:10px;">${ship.focus || '-'}</div>
          </td>
          <td style="padding:6px; color:#d0e7f5; font-size:12px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            ${ship.manufacturer?.name || '-'}
          </td>
          <td style="padding:6px; color:#d0e7f5; font-size:12px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            ${capitalizeFirstLetter(ship.type) || '-'}
          </td>
          <td style="padding:6px; text-align:center; border-right:1px solid rgba(64, 169, 255, 0.1);">
            <span style="background:${statusColor}; color:#fff; padding:3px 6px; border-radius:3px; font-size:10px; font-weight:bold; white-space:nowrap; display:inline-block; box-shadow:0 2px 4px rgba(0,0,0,0.3);">
              ${formatStatus(ship.production_status)}
            </span>
          </td>
          <td style="padding:6px; text-align:center; color:#88c0d0; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            ${ship.cargocapacity || '-'}
          </td>
          <td style="padding:6px; text-align:center; color:#88c0d0; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            ${ship.max_crew || '-'}
          </td>
          <td style="padding:6px; text-align:right; color:#88c0d0; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1);">
            ${auecFormatted}
          </td>
          <td style="padding:6px; text-align:right; color:#ffa726; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1); white-space: nowrap;">
            ${msrpFormatted}
          </td>
          <td style="padding:6px; text-align:right; color:#4caf50; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1); white-space: nowrap;">
            ${warbondFormatted}
          </td>
          <td style="padding:6px; text-align:right; color:${savingsColor === '#2ea043' ? '#4caf50' : savingsColor}; font-weight:bold; font-size:11px; border-right:1px solid rgba(64, 169, 255, 0.1); white-space: nowrap;">
            ${savingsFormatted}
          </td>
          <td style="padding:6px; text-align:center;">
            <a href="https://robertsspaceindustries.com${ship.url}" target="_blank"
               style="display:inline-block; padding:4px 10px; background:linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%); color:#40a9ff; text-decoration:none; border-radius:3px; font-size:10px; font-weight:bold; border:1px solid rgba(64, 169, 255, 0.3); transition:all 0.3s;"
               onmouseover="this.style.background='linear-gradient(135deg, #2a5a7f 0%, #1f4562 100%)'; this.style.boxShadow='0 0 8px rgba(64, 169, 255, 0.4)'"
               onmouseout="this.style.background='linear-gradient(180deg, #1a4a6f 0%, #0f3552 100%)'; this.style.boxShadow='none'">
              Go
            </a>
          </td>
        `;

        tbodyElement.appendChild(tr);

        // Event listener para estrela de favorito
        const favStar = tr.querySelector('.fav-star');
        if (favStar) {
          favStar.addEventListener('click', (e) => {
            e.stopPropagation();
            const shipName = favStar.getAttribute('data-ship');
            toggleFavorite(shipName);
            
            const isFav = favoriteShips.has(shipName);
            favStar.style.color = isFav ? '#ffa726' : '#3a5a6f';
            
            if (showOnlyFavorites && !isFav) {
              applyFilters();
            }
          });
          
          favStar.onmouseenter = () => {
            favStar.style.transform = 'scale(1.3)';
          };
          favStar.onmouseleave = () => {
            favStar.style.transform = 'scale(1)';
          };
        }

      });
    }

    const initialSorted = sortShips(ships, currentSort.column, currentSort.ascending);
    renderShipsTable(initialSorted, tbody);

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    content.appendChild(tableContainer);

    const applyFilters = () => {
      const searchTerm = searchInput.value.toLowerCase();
      const manufacturerFilter = manufacturerSelect.value;
      const typeFilter = typeSelect.value;
      const statusFilter = statusSelect.value;

      const filtered = allShips.filter(ship => {
        const matchSearch = !searchTerm ||
          ship.name.toLowerCase().includes(searchTerm) ||
          ship.manufacturer?.name.toLowerCase().includes(searchTerm) ||
          ship.type?.toLowerCase().includes(searchTerm) ||
          ship.focus?.toLowerCase().includes(searchTerm);
        const matchManufacturer = !manufacturerFilter || ship.manufacturer?.name === manufacturerFilter;
        const matchType = !typeFilter || ship.type === typeFilter;
        const matchStatus = !statusFilter || ship.production_status === statusFilter;
        const matchFavorite = !showOnlyFavorites || favoriteShips.has(ship.name);
        return matchSearch && matchManufacturer && matchType && matchStatus && matchFavorite;
      });

      stats.innerHTML = `<p style="color:#88c0d0; margin:0; font-weight:500;"><b style="color:#40a9ff;">${filtered.length}</b> ships found</p>`;

      const sorted = sortShips(filtered, currentSort.column, currentSort.ascending);
      renderShipsTable(sorted, tbody);
    };

    clearBtn.onclick = () => {
      searchInput.value = '';
      manufacturerSelect.value = '';
      typeSelect.value = '';
      statusSelect.value = '';
      saveSettings();
      applyFilters();
    };

    searchInput.addEventListener('input', () => {
      applyFilters();
      saveSettings();
    });
    manufacturerSelect.addEventListener('change', () => {
      applyFilters();
      saveSettings();
    });
    typeSelect.addEventListener('change', () => {
      applyFilters();
      saveSettings();
    });
    statusSelect.addEventListener('change', () => {
      applyFilters();
      saveSettings();
    });
    currencySelect.addEventListener('change', () => {
      // Atualizar header da coluna de preço
      const priceHeader = document.querySelector('#price-header');
      if (priceHeader) {
        const indicator = priceHeader.querySelector('.sort-indicator');
        const indicatorText = indicator ? indicator.textContent : '';
        priceHeader.innerHTML = `Price [ ${currencySelect.value} ] <span class="sort-indicator">${indicatorText}</span>`;
      }
      
      saveSettings();
      applyFilters();
    });

    // Restaurar configurações salvas
    const savedSettings = loadSettings();
    if (savedSettings) {
      // Restaurar filtros
      if (savedSettings.searchText) searchInput.value = savedSettings.searchText;
      if (savedSettings.manufacturerFilter) manufacturerSelect.value = savedSettings.manufacturerFilter;
      if (savedSettings.typeFilter) typeSelect.value = savedSettings.typeFilter;
      if (savedSettings.statusFilter) statusSelect.value = savedSettings.statusFilter;
      if (savedSettings.currencyFilter) {
        currencySelect.value = savedSettings.currencyFilter;
        // Atualizar header
        const priceHeader = document.querySelector('#price-header');
        if (priceHeader) {
          const indicator = priceHeader.querySelector('.sort-indicator');
          const indicatorText = indicator ? indicator.textContent : '';
          priceHeader.innerHTML = `Price [ ${savedSettings.currencyFilter} ] <span class="sort-indicator">${indicatorText}</span>`;
        }
      }
      
      // Restaurar favoritos
      if (savedSettings.showOnlyFavorites) {
        showOnlyFavorites = true;
        favBtn.style.background = 'linear-gradient(135deg, #ffa726 0%, #f57c00 100%)';
        favBtn.style.borderColor = '#ffa726';
        favBtn.style.color = '#fff';
        favBtn.title = 'Show all ships';
      }
      
      // Restaurar ordenação
      if (savedSettings.currentSort) {
        currentSort = savedSettings.currentSort;
        
        // Atualizar indicadores visuais
        headers.forEach(h => {
          const indicator = h.querySelector('.sort-indicator');
          if (h.getAttribute('data-sort') === currentSort.column) {
            indicator.textContent = currentSort.ascending ? '▲' : '▼';
          } else {
            indicator.textContent = '';
          }
        });
      }
      
      // Aplicar filtros restaurados
      applyFilters();
    }

    // Focar e selecionar o campo de busca após renderizar
    setTimeout(() => {
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        console.log('✅ Search input focused and selected');
      }
    }, 100);

  }

  // Função auxiliar para obter container sizes
  function getContainerSizes(shipName) {
    if (!uexAPI || !shipName) return '-';
    
    const vehicleData = uexAPI.getVehicleByName(shipName);
    
    if (!vehicleData || !vehicleData.container_sizes) {
      return '-';
    }

    return uexAPI.formatContainerSizes(vehicleData.container_sizes);
  }

  function getPadType(shipName) {
    if (!uexAPI || !shipName) return '-';
    
    const vehicleData = uexAPI.getVehicleByName(shipName);
    
    if (!vehicleData || !vehicleData.pad_type) {
      return '-';
    }

    return uexAPI.formatPadType(vehicleData.pad_type);
  }

  /* ================= LOAD SHIPS (MODIFICADO) ================= */

  async function loadShips() {
    overlay.style.display = 'block';
    content.innerHTML = '<p style="text-align:center; margin-top:50px;">Initializing...</p>';

    // Verificar se pode fazer fetch (evitar CORS em sites externos)
    const canFetchDirectly = window.location.hostname.includes('robertsspaceindustries.com');
    
    if (!canFetchDirectly) {
      console.log('Not on RSI site, using cached data only or showing warning');
    }

    try {
      // Inicializar UEX API primeiro
      content.innerHTML = '<p style="text-align:center; margin-top:50px;">Loading UEX Corp data...</p>';
      await initUEXAPI();

      console.log('Searching for data from Ship Matrix...');
      content.innerHTML = '<p style="text-align:center; margin-top:50px;">Loading ships...</p>';

      // Buscar dados principais (Ship Matrix) - verificar cache primeiro
      const cachedShipMatrix = getCache(CACHE_SHIP_MATRIX_KEY, CACHE_DURATION_24H);

      if (cachedShipMatrix) {
        allShips = cachedShipMatrix;
        console.log(`${allShips.length} ships loaded from cache`);
      } else if (!canFetchDirectly) {
        // Não está no RSI e não tem cache
        throw new Error('Ship data not available. Please open the extension on robertsspaceindustries.com first to load the data.');
      } else {
        const resMatrix = await fetch(API_SHIP_MATRIX);

        if (!resMatrix.ok) {
          throw new Error(`Error searching for Ship Matrix: ${resMatrix.status}`);
        }

        const jsonMatrix = await resMatrix.json();

        if (!jsonMatrix?.data) {
          throw new Error('Ship Matrix data not found.');
        }

        allShips = jsonMatrix.data;
        setCache(CACHE_SHIP_MATRIX_KEY, allShips);
        console.log(`${allShips.length} ships loaded from Ship Matrix`);
      }

      console.log(`✅ ${allShips.length} ships loaded with Ship Matrix`);

      // Buscar preços da UEX API (USD)
      if (canFetchDirectly) {
        content.innerHTML = '<p style="text-align:center; margin-top:50px;">Fetching USD prices...</p>';
        pricesData = await fetchPricesUEX();
      } else {
        console.log('Skipping USD prices fetch (not on RSI site)');
      }

      if (!pricesData) {
        console.log('⚠️ USD prices not available');
      }

      // Buscar preços aUEC
      if (canFetchDirectly) {
        content.innerHTML = '<p style="text-align:center; margin-top:50px;">Fetching aUEC prices...</p>';
        auecPricesData = await fetchAUECPricesUEX();
      } else {
        console.log('Skipping aUEC prices fetch (not on RSI site)');
      }

      // Buscar Loaner Matrix
      if (canFetchDirectly) {
        content.innerHTML = '<p style="text-align:center; margin-top:50px;">Loading Loaner Matrix...</p>';
        await fetchLoanerMatrix();
      } else {
        console.log('Skipping Loaner Matrix fetch (not on RSI site)');
      }

      if (!auecPricesData) {
        console.log('⚠️ aUEC prices not available');
      }

      renderShips(allShips);

      // Focar campo de busca após carregar
      setTimeout(() => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          console.log('✅ Search input focused and selected');
        }
      }, 100);

    } catch (e) {
      console.error('❌ Erro:', e);
      content.innerHTML = `
        <div style="text-align:center; margin-top:50px; padding:20px;">
          <h3 style="color:#dc3545;">⚠️ Error</h3>
          <p style="color:#888; margin:20px 0; white-space:pre-wrap;">${e.message}</p>
          <div style="margin-top:30px; padding:20px; background:#161b22; border-radius:8px; text-align:left; font-size:13px;">
            <p style="color:#1e90ff; font-weight:bold; margin-bottom:10px;">💡 Try:</p>
            <ol style="color:#888; margin:0; padding-left:20px; line-height:1.8;">
              <li>Reload page (F5)</li>
              <li>Check your internet connection</li>
              <li>Try again in a few moments</li>
            </ol>
          </div>
        </div>
      `;
    }
  }

  /* ================= API PÚBLICA ================= */

  window.RWXShipViewer = {
    open: () => {
      if (overlay.style.display === 'block') {
        console.log('⚠️ Viewer already open');
        return;
      }
      loadShips();
    },
    close: closeViewer,
    toggle: () => {
      if (overlay.style.display === 'block') {
        closeViewer();
      } else {
        loadShips();
      }
    },
    clearUEXCache: () => {
      if (uexAPI) {
        uexAPI.clearCache();
        console.log('✅ UEX cache is clear');
      }
    },
    getUEXData: (shipName) => {
      if (uexAPI) {
        return uexAPI.getVehicleByName(shipName);
      }
      return null;
    }
  };

  console.log('RWX Ship Viewer v2.1 loaded successfully!');
  console.log('Available commands:');
  console.log('  - window.RWXShipViewer.open() - Open viewer');
  console.log('  - window.RWXShipViewer.close() - Close viewer');
  console.log('  - window.RWXShipViewer.clearUEXCache() - Clear UEX cache');
  console.log('  - window.RWXShipViewer.getUEXData("100i") - Get UEX data from a ship');

  // Auto-abrir o viewer se veio de outra página (via URL parameter)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldAutoOpen = urlParams.get('rwx_open_viewer');
    
    if (shouldAutoOpen === 'true') {
      console.log('Auto-opening viewer from URL parameter');
      
      // Tentar abrir múltiplas vezes até conseguir
      let attempts = 0;
      const maxAttempts = 10;
      
      const tryOpen = () => {
        if (window.RWXShipViewer && typeof window.RWXShipViewer.open === 'function') {
          window.RWXShipViewer.open();
          
          // Limpar o parâmetro da URL sem recarregar a página
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          
          console.log('Viewer opened successfully from URL parameter');
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(tryOpen, 500);
        } else {
          console.warn('Could not open viewer after', maxAttempts, 'attempts');
        }
      };
      
      setTimeout(tryOpen, 1000);
    }
  } catch (e) {
    console.warn('Could not check URL parameter:', e);
  }

})();