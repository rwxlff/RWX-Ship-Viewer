// content.js - Injeção do script principal na página

(function() {
  'use strict';

  // Evita injeção duplicada
  if (window.rwxShipViewerInjected) {
    return;
  }
  window.rwxShipViewerInjected = true;

  console.log('🚀 RWX Ship Viewer Extension: Injecting scripts...');

  // Injetar UEX API primeiro
  const uexScript = document.createElement('script');
  uexScript.src = chrome.runtime.getURL('uex-api.js');
  
  uexScript.onload = function() {
    console.log('✅ UEX API loaded');
    
    // Depois injetar o script principal
    const mainScript = document.createElement('script');
    mainScript.src = chrome.runtime.getURL('ship-viewer.js');
    mainScript.onload = function() {
      this.remove();
      console.log('✅ RWX Ship Viewer Extension: All scripts loaded successfully!');

      // Carregar estado inicial do botão E ENVIAR IMEDIATAMENTE
      chrome.storage.local.get(['rwx_floating_button_enabled'], (result) => {
        const isEnabled = result.rwx_floating_button_enabled !== false; // true por padrão
        
        console.log('Initial button state:', isEnabled);
        
        // Enviar estado inicial múltiplas vezes para garantir
        const sendState = () => {
          window.postMessage({
            type: 'INIT_BUTTON_STATE',
            enabled: isEnabled
          }, '*');
        };
        
        // Enviar imediatamente
        sendState();
        
        // Enviar novamente após delays para garantir que o script já carregou
        setTimeout(sendState, 100);
        setTimeout(sendState, 500);
        setTimeout(sendState, 1000);
      });

      // Carregar posição inicial
      chrome.storage.local.get(['rwx_button_position'], (result) => {
        const position = result.rwx_button_position || {
          corner: 'bottom-right',
          x: 20,
          y: 45
        };
        
        const sendPosition = () => {
          window.postMessage({
            type: 'UPDATE_BUTTON_POSITION',
            position: position
          }, '*');
        };
        
        sendPosition();
        setTimeout(sendPosition, 100);
        setTimeout(sendPosition, 500);
      });
    };
    mainScript.onerror = function() {
      console.error('❌ RWX Ship Viewer Extension: Failed to load main script');
    };
    (document.head || document.documentElement).appendChild(mainScript);
  };

  uexScript.onerror = function() {
    console.error('❌ RWX Ship Viewer Extension: Failed to load UEX API');
  };
  (document.head || document.documentElement).appendChild(uexScript);

  // Listener para mensagens do ship-viewer.js
  window.addEventListener('message', async (event) => {
    // Apenas aceitar mensagens da mesma origem
    if (event.source !== window) return;
    
    if (event.data.type === 'FETCH_LOANER_MATRIX') {
      try {
        const response = await chrome.runtime.sendMessage({ action: 'fetchLoanerMatrix' });
        window.postMessage({
          type: 'LOANER_MATRIX_RESPONSE',
          success: response.success,
          html: response.html,
          error: response.error
        }, '*');
      } catch (error) {
        window.postMessage({
          type: 'LOANER_MATRIX_RESPONSE',
          success: false,
          error: error.message
        }, '*');
      }
    }
  });

  // Atalho de teclado configurável
  let keybindKey = 'S'; // Padrão

  // Carregar keybind salvo
  chrome.storage.local.get(['rwx_keybind_key'], (result) => {
    keybindKey = result.rwx_keybind_key || 'S';
    console.log('Keybind loaded:', 'Ctrl+Shift+' + keybindKey);
  });

  // Listener para atualização de keybind
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleFloatingButton') {
      window.postMessage({
        type: 'TOGGLE_FLOATING_BUTTON',
        enabled: message.enabled
      }, '*');
      console.log('Toggle message sent to page:', message.enabled);
    }
    
    if (message.action === 'updateButtonPosition') {
      window.postMessage({
        type: 'UPDATE_BUTTON_POSITION',
        position: message.position
      }, '*');
      console.log('Position message sent to page:', message.position);
    }
    
    if (message.action === 'updateKeybind') {
      keybindKey = message.key;
      console.log('Keybind updated to: Ctrl+Shift+' + keybindKey);
    }
  });

  // Atalho de teclado: Ctrl+Shift+[Key]
  document.addEventListener('keydown', (e) => {
    // Verificar se a tecla pressionada corresponde ao keybind configurado
    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === keybindKey.toUpperCase()) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log('Keyboard shortcut detected: Ctrl+Shift+' + keybindKey);
      
      // Enviar mensagem para a página abrir o viewer
      window.postMessage({
        type: 'OPEN_SHIP_VIEWER',
        source: 'rwx-extension'
      }, '*');
    }
  }, true);

  // Listener para mostrar/ocultar botão flutuante
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleFloatingButton') {
      window.postMessage({
        type: 'TOGGLE_FLOATING_BUTTON',
        enabled: message.enabled
      }, '*');
      console.log('Toggle message sent to page:', message.enabled);
    }
    
    if (message.action === 'updateButtonPosition') {
      window.postMessage({
        type: 'UPDATE_BUTTON_POSITION',
        position: message.position
      }, '*');
      console.log('Position message sent to page:', message.position);
    }
  });

  console.log('Keyboard shortcut registered: Ctrl+Shift+S');

})();