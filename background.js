// background.js - Script de background para bypass CORS

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchLoanerMatrix') {
    fetch('https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix')
      .then(response => response.text())
      .then(html => {
        sendResponse({ success: true, html: html });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Mantém o canal aberto para resposta assíncrona
  }
});

// Comando global de teclado (funciona em qualquer site)
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-ship-viewer') {
    console.log('🎯 Global keyboard shortcut triggered:', command);
    
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const currentTab = tabs[0];
      
      if (!currentTab) {
        console.warn('No active tab found');
        return;
      }
      
      const isRSISite = currentTab.url && currentTab.url.includes('robertsspaceindustries.com');
      
      if (isRSISite) {
        // Já está no RSI, enviar mensagem para toggle
        console.log('📍 On RSI site, toggling viewer');
        try {
          await chrome.tabs.sendMessage(currentTab.id, { 
            action: 'toggleViewer' 
          });
        } catch (error) {
          console.warn('Could not send message to tab:', error);
        }
      } else {
        // Não está no RSI, abrir nova aba
        console.log('🌐 Not on RSI site, opening new tab');
        chrome.tabs.create({
          url: 'https://robertsspaceindustries.com?rwx_open_viewer=true'
        });
      }
    });
  }
});