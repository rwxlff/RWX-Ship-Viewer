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