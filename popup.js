// popup.js - Script do popup da extensão

document.addEventListener('DOMContentLoaded', () => {
  const openViewerBtn = document.getElementById('openViewer');
  const openRSIBtn = document.getElementById('openRSI');
  const toggleButton = document.getElementById('toggleButton');
  const BUTTON_STATE_KEY = 'rwx_floating_button_enabled';

  console.log('Toggle button element:', toggleButton);

  const statusButton = document.getElementById('statusButton');
  const statusContainer = document.querySelector('.status');
  const statusIndicator = document.querySelector('.status-indicator');

  function updateStatus(isEnabled) {
    if (isEnabled) {
      statusButton.textContent = 'Floating button active and ready';
      statusContainer.style.background = 'rgba(76, 175, 80, 0.1)';
      statusContainer.style.borderColor = 'rgba(76, 175, 80, 0.3)';
      statusIndicator.style.background = '#4caf50';
    } else {
      statusButton.textContent = 'Floating button disabled and hidden';
      statusContainer.style.background = 'transparent';
      statusContainer.style.borderColor = 'rgba(64, 169, 255, 0.3)';
      statusIndicator.style.background = '#6b8da6';
    }
  }

  const positionCorner = document.getElementById('positionCorner');
  const positionX = document.getElementById('positionX');
  const positionY = document.getElementById('positionY');

  // Carregar posição salva
  chrome.storage.local.get(['rwx_button_position'], (result) => {
    const position = result.rwx_button_position || {
      corner: 'bottom-right',
      x: 20,
      y: 45
    };
    
    positionCorner.value = position.corner;
    positionX.value = position.x;
    positionY.value = position.y;
  });

  // Salvar e aplicar posição
  async function savePosition() {
    const position = {
      corner: positionCorner.value,
      x: parseInt(positionX.value) || 20,
      y: parseInt(positionY.value) || 45
    };
    
    await chrome.storage.local.set({ rwx_button_position: position });
    console.log('Position saved:', position);
    
    // Enviar para todas as abas
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateButtonPosition',
          position: position
        });
      } catch (error) {
        // Ignora erros
      }
    }
  }

  positionCorner.addEventListener('change', savePosition);
  positionX.addEventListener('change', savePosition);
  positionY.addEventListener('change', savePosition);

  // Carregar estado salvo
  chrome.storage.local.get([BUTTON_STATE_KEY], (result) => {
    console.log('Storage result:', result);
    const isEnabled = result[BUTTON_STATE_KEY] !== false; // true por padrão
    toggleButton.checked = isEnabled;
    updateStatus(isEnabled);
    console.log('Toggle button checked:', isEnabled);
  });

  // Salvar estado e atualizar botão em todas as abas
  toggleButton.addEventListener('change', async () => {
    const isEnabled = toggleButton.checked;
    console.log('Toggle changed to:', isEnabled);
    updateStatus(isEnabled);
    
    try {
      // Salvar no storage
      await chrome.storage.local.set({ [BUTTON_STATE_KEY]: isEnabled });
      console.log('State saved successfully');
      
      // Enviar mensagem para todas as abas
      const tabs = await chrome.tabs.query({});
      console.log('Found tabs:', tabs.length);
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'toggleFloatingButton',
            enabled: isEnabled
          });
          console.log('Message sent to tab:', tab.id, tab.url);
        } catch (error) {
          console.log('Could not send to tab:', tab.id, error.message);
        }
      }
    } catch (error) {
      console.error('Error in toggle handler:', error);
    }
  });

  // Abrir o Ship Viewer
  openViewerBtn.addEventListener('click', async () => {
    console.log('Open Ship Viewer button clicked');
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);

      // Se já estiver no site da RSI, apenas injeta o viewer
      if (tab && tab.url && tab.url.includes('robertsspaceindustries.com')) {
        console.log('Already on RSI site, injecting viewer...');
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: openShipViewer
        });
        
        console.log('Viewer injected successfully');
        window.close();
      } else {
        console.log('Not on RSI site, creating new tab...');
        
        // Se não estiver, abre uma nova aba e injeta o viewer
        const newTab = await chrome.tabs.create({
          url: 'https://robertsspaceindustries.com/?rwx_open_viewer=true'
        });

        console.log('New tab created:', newTab.id);

        // Aguarda a página carregar e injeta o viewer
        const listener = (tabId, info) => {
          console.log('Tab updated:', tabId, info.status);
          
          if (tabId === newTab.id && info.status === 'complete') {
            console.log('Tab loaded, injecting viewer...');
            
            chrome.scripting.executeScript({
              target: { tabId: newTab.id },
              func: openShipViewer
            }).then(() => {
              console.log('Viewer injected in new tab');
            }).catch(err => {
              console.error('Error injecting viewer:', err);
            });
            
            chrome.tabs.onUpdated.removeListener(listener);
          }
        };
        
        chrome.tabs.onUpdated.addListener(listener);
        
        // Timeout de segurança
        setTimeout(() => {
          chrome.tabs.onUpdated.removeListener(listener);
        }, 30000);
        
        window.close();
      }
    } catch (error) {
      console.error('Error opening Ship Viewer:', error);
      alert('Error opening Ship Viewer: ' + error.message);
    }
  });

  // Abrir o site da RSI
  openRSIBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://robertsspaceindustries.com/en/pledge'
    });
    window.close();
  });

  // Keybind selector
  const keybindSelect = document.getElementById('keybindSelect');
  const KEYBIND_KEY = 'rwx_keybind_key';

  // Carregar keybind salvo
  chrome.storage.local.get([KEYBIND_KEY], (result) => {
    const savedKey = result[KEYBIND_KEY] || 'S';
    keybindSelect.value = savedKey;
  });

  // Salvar e aplicar keybind
  keybindSelect.addEventListener('change', async () => {
    const selectedKey = keybindSelect.value;
    
    await chrome.storage.local.set({ [KEYBIND_KEY]: selectedKey });
    console.log('Keybind updated to: Ctrl+Shift+' + selectedKey);
    
    // Enviar para todas as abas
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'updateKeybind',
          key: selectedKey
        });
      } catch (error) {
        // Ignora erros
      }
    }
  });

  document.getElementById("donateBtn").addEventListener("click", () => {
    window.open(
      "https://donate.stripe.com/fZuaEZeAFev7dfQbv883C00",
      "_blank",
      "noopener,noreferrer"
    );
  });

});

// Função que será injetada na página para abrir/toggle o viewer
function openShipViewer() {
  // Clicar no botão flutuante que já existe na página (toggle automático)
  const button = document.getElementById('rwx-ship-viewer-button');
  
  if (button) {
    button.click();
    console.log('Clicked floating button to toggle viewer');
  } else {
    // Se o botão não existir ainda, aguardar e tentar toggle via API
    let attempts = 0;
    const maxAttempts = 40;
    
    const checkAndToggle = () => {
      if (window.RWXShipViewer && typeof window.RWXShipViewer.toggle === 'function') {
        window.RWXShipViewer.toggle();
        console.log('Toggled viewer via API after', attempts, 'attempts');
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(checkAndToggle, 250);
      } else {
        console.warn('Viewer not found after', maxAttempts, 'attempts');
      }
    };
    
    checkAndToggle();
  }
}