// uex-api.js - Gerenciador de API UEX Corp com cache

(function() {
  'use strict';

  const UEX_API_URL = 'https://api.uexcorp.uk/2.0/vehicles';
  const UEX_PRICES_API_URL = 'https://api.uexcorp.uk/2.0/vehicles_prices';
  const UEX_AUEC_PRICES_API_URL = 'https://api.uexcorp.uk/2.0/vehicles_purchases_prices_all';
  const CACHE_KEY = 'rwx_uex_vehicles_cache';
  const CACHE_PRICES_KEY = 'rwx_uex_prices_cache';
  const CACHE_AUEC_PRICES_KEY = 'rwx_uex_auec_prices_cache';
  const CACHE_DURATION_24H = 24 * 60 * 60 * 1000; // 24 horas
  const CACHE_DURATION_2MIN = 2 * 60 * 1000; // 2 minutos

  // Classe para gerenciar o cache
  class UEXCache {
    constructor(cacheKey, duration) {
      this.cacheKey = cacheKey;
      this.duration = duration;
      this.data = null;
      this.timestamp = null;
      this.loadFromStorage();
    }

    loadFromStorage() {
      try {
        const cached = localStorage.getItem(this.cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          this.data = parsed.data;
          this.timestamp = parsed.timestamp;
        }
      } catch (e) {
        console.warn('Error loading cache:', e);
      }
    }

    saveToStorage() {
      try {
        const cacheData = {
          data: this.data,
          timestamp: this.timestamp
        };
        localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
      } catch (e) {
        console.warn('Error saving cache:', e);
      }
    }

    isValid() {
      if (!this.data || !this.timestamp) return false;
      const now = Date.now();
      const age = now - this.timestamp;
      return age < this.duration;
    }

    get() {
      if (this.isValid()) {
        console.log('Using cache for', this.cacheKey, '(valid for', Math.round((this.duration - (Date.now() - this.timestamp)) / 1000), 'seconds)');
        return this.data;
      }
      return null;
    }

    set(data) {
      this.data = data;
      this.timestamp = Date.now();
      this.saveToStorage();
    }

    clear() {
      this.data = null;
      this.timestamp = null;
      localStorage.removeItem(this.cacheKey);
    }
  }

  // API Principal
  class UEXVehiclesAPI {
    constructor() {
      this.vehiclesCache = new UEXCache(CACHE_KEY, CACHE_DURATION_24H);
      this.pricesCache = new UEXCache(CACHE_PRICES_KEY, CACHE_DURATION_2MIN);
      this.auecPricesCache = new UEXCache(CACHE_AUEC_PRICES_KEY, CACHE_DURATION_24H);
      this.vehiclesMap = null;
      this.pricesMap = null;
      this.auecPricesMap = null;
      this.auecPricesListMap = null;
    }

    // Buscar dados da API de veículos
    async fetchFromAPI() {
      try {
        console.log('🌐 Fetching vehicle data from UEX Corp API...');
        
        const response = await fetch(UEX_API_URL);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (json.status !== 'ok' || !json.data) {
          throw new Error('Invalid response from UEX API');
        }

        console.log(`✅ ${json.data.length} vehicles loaded from UEX API`);
        return json.data;

      } catch (error) {
        console.error('❌ Error fetching UEX data:', error);
        return null;
      }
    }

    // Buscar preços USD da API UEX
    async fetchPricesFromAPI() {
      try {
        console.log('💰 Fetching USD prices from UEX Corp API...');
        
        const response = await fetch(UEX_PRICES_API_URL);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (json.status !== 'ok' || !json.data) {
          throw new Error('Invalid response from UEX Prices API');
        }

        console.log(`✅ ${json.data.length} USD prices loaded from UEX API`);
        return json.data;

      } catch (error) {
        console.error('❌ Error fetching USD prices:', error);
        return null;
      }
    }

    // Buscar preços aUEC da API UEX
    async fetchAUECPricesFromAPI() {
      try {
        console.log('💰 Fetching aUEC prices from UEX Corp API...');
        
        const response = await fetch(UEX_AUEC_PRICES_API_URL);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();

        if (json.status !== 'ok' || !json.data) {
          throw new Error('Invalid response from UEX aUEC Prices API');
        }

        console.log(`✅ ${json.data.length} aUEC prices loaded from UEX API`);
        return json.data;

      } catch (error) {
        console.error('❌ Error fetching aUEC prices:', error);
        return null;
      }
    }

    // Obter dados de veículos (com cache)
    async getVehicles() {
      const cached = this.vehiclesCache.get();
      if (cached) {
        this.buildVehiclesMap(cached);
        return cached;
      }

      const vehicles = await this.fetchFromAPI();
      
      if (vehicles) {
        this.vehiclesCache.set(vehicles);
        this.buildVehiclesMap(vehicles);
        return vehicles;
      }

      return [];
    }

    // Obter preços USD (com cache)
    async getPrices() {
      const cached = this.pricesCache.get();
      if (cached) {
        this.buildPricesMap(cached);
        return cached;
      }

      const prices = await this.fetchPricesFromAPI();
      
      if (prices) {
        this.pricesCache.set(prices);
        this.buildPricesMap(prices);
        return prices;
      }

      return [];
    }

    // Obter preços aUEC (com cache)
    async getAUECPrices() {
      const cached = this.auecPricesCache.get();
      if (cached) {
        this.buildAUECPricesMap(cached);
        return cached;
      }

      const prices = await this.fetchAUECPricesFromAPI();
      
      if (prices) {
        this.auecPricesCache.set(prices);
        this.buildAUECPricesMap(prices);
        return prices;
      }

      return [];
    }

    // Construir mapa de veículos por nome
    buildVehiclesMap(vehicles) {
      this.vehiclesMap = new Map();
      
      vehicles.forEach(vehicle => {
        const key = vehicle.name.toLowerCase();
        this.vehiclesMap.set(key, vehicle);
      });

      console.log('📋 Vehicles map built:', this.vehiclesMap.size, 'vehicles');
    }

    // Construir mapa de preços USD por nome do veículo
    buildPricesMap(prices) {
      this.pricesMap = new Map();
      
      prices.forEach(price => {
        // Filtrar apenas USD
        if (price.currency !== 'USD') {
          return;
        }

        const key = price.vehicle_name.toLowerCase();
        this.pricesMap.set(key, {
          msrp: price.price || null,
          warbond: price.price_warbond || null,
          currency: price.currency || 'USD',
          on_sale: price.on_sale || 0,
          on_sale_warbond: price.on_sale_warbond || 0
        });
      });

      console.log('💰 USD prices map built:', this.pricesMap.size, 'vehicles with USD price');
    }

    // Construir mapa de preços aUEC por nome do veículo
    buildAUECPricesMap(prices) {
      this.auecPricesMap = new Map();
      this.auecPricesListMap = new Map(); // Mapa com TODOS os terminais
      
      prices.forEach(price => {
        const key = price.vehicle_name.toLowerCase();
        
        // Para tabela principal - pegar o menor preço
        const existing = this.auecPricesMap.get(key);
        if (!existing || price.price_buy < existing.price) {
          this.auecPricesMap.set(key, {
            price: price.price_buy || null,
            terminal: price.terminal_name || null
          });
        }

        // Para tabela de detalhes - guardar TODOS os terminais
        if (!this.auecPricesListMap.has(key)) {
          this.auecPricesListMap.set(key, []);
        }
        this.auecPricesListMap.get(key).push({
          terminal: price.terminal_name || 'Unknown',
          price: price.price_buy || 0
        });
      });

      console.log('💰 aUEC prices map built:', this.auecPricesMap.size, 'vehicles with aUEC price');
      console.log('📋 aUEC locations map built:', this.auecPricesListMap.size, 'vehicles with locations');
    }

    // Obter dados de um veículo específico pelo nome
    getVehicleByName(shipName) {
      if (!this.vehiclesMap) return null;

      const normalized = shipName.toLowerCase().trim();
      
      if (this.vehiclesMap.has(normalized)) {
        return this.vehiclesMap.get(normalized);
      }

      const parts = normalized.split(' ');
      for (const part of parts) {
        if (this.vehiclesMap.has(part)) {
          return this.vehiclesMap.get(part);
        }
      }

      const lastPart = parts[parts.length - 1];
      if (this.vehiclesMap.has(lastPart)) {
        return this.vehiclesMap.get(lastPart);
      }

      return null;
    }

    // Obter preço USD de um veículo específico pelo nome
    getPriceByName(shipName) {
      if (!this.pricesMap) return null;

      const normalized = shipName.toLowerCase().trim();
      
      if (this.pricesMap.has(normalized)) {
        return this.pricesMap.get(normalized);
      }

      for (const [key, value] of this.pricesMap.entries()) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return value;
        }
      }

      const parts = normalized.split(' ').filter(p => p.length > 2);
      for (const part of parts) {
        for (const [key, value] of this.pricesMap.entries()) {
          if (key.includes(part)) {
            return value;
          }
        }
      }

      return null;
    }

    // Obter preço aUEC de um veículo específico pelo nome
    getAUECPriceByName(shipName) {
      if (!this.auecPricesMap) return null;

      const normalized = shipName.toLowerCase().trim();
      
      if (this.auecPricesMap.has(normalized)) {
        return this.auecPricesMap.get(normalized);
      }

      for (const [key, value] of this.auecPricesMap.entries()) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return value;
        }
      }

      const parts = normalized.split(' ').filter(p => p.length > 2);
      for (const part of parts) {
        for (const [key, value] of this.auecPricesMap.entries()) {
          if (key.includes(part)) {
            return value;
          }
        }
      }

      return null;
    }

    // Obter TODOS os locais de compra aUEC de uma nave
    getAUECLocationsByName(shipName) {
      if (!this.auecPricesListMap) return [];

      const normalized = shipName.toLowerCase().trim();
      
      // Tentar match exato
      if (this.auecPricesListMap.has(normalized)) {
        return this.auecPricesListMap.get(normalized);
      }

      // Tentar match parcial
      for (const [key, value] of this.auecPricesListMap.entries()) {
        if (key.includes(normalized) || normalized.includes(key)) {
          return value;
        }
      }

      // Tentar match por palavras
      const parts = normalized.split(' ').filter(p => p.length > 2);
      for (const part of parts) {
        for (const [key, value] of this.auecPricesListMap.entries()) {
          if (key.includes(part)) {
            return value;
          }
        }
      }

      return [];
    }

    // Formatar container sizes
    formatContainerSizes(containerSizes) {
      if (!containerSizes || containerSizes === '') return '-';
      
      const sizes = containerSizes.split(',').map(s => s.trim());
      
      const sizeNames = {
        '1': '1 SCU',
        '2': '2 SCU', 
        '4': '4 SCU',
        '8': '8 SCU',
        '16': '16 SCU',
        '32': '32 SCU',
        '64': '64 SCU'
      };

      return sizes.map(s => sizeNames[s] || `${s} SCU`).join(', ');
    }

    // Formatar pad type com tamanhos completos
    formatPadType(padType) {
      if (!padType || padType === '') return '-';
      
      const padSizes = {
        'XXS': 'Tiny [ XXS ]<br>12 × 16 × 6 m',
        'XS': 'Extra Small [ XS ]<br>24 × 32 × 12 m',
        'S': 'Small [ S ]<br>48 × 48 × 16 m',
        'M': 'Medium [ M ]<br>56 × 88 × 18 m',
        'L': 'Large [ L ]<br>72 × 128 × 36 m',
        'XL': 'Extra Large [ XL ]<br>160 × 272 × 64 m'
      };

      const upperPad = padType.toString().trim().toUpperCase();
      return padSizes[upperPad] || padType;
    }

    // Formatar preço aUEC
    formatAUECPrice(auecPrice) {
      if (!auecPrice || auecPrice === 0) return '-';
      return auecPrice.toLocaleString('en-US');
    }

    // Limpar cache manualmente
    clearCache() {
      this.vehiclesCache.clear();
      this.pricesCache.clear();
      this.auecPricesCache.clear();
      this.vehiclesMap = null;
      this.pricesMap = null;
      this.auecPricesMap = null;
      this.auecPricesListMap = null;
      
      console.log('UEX cache cleared (vehicles + USD prices + aUEC prices)');
    }
  }

  // Exportar API globalmente
  window.UEXVehiclesAPI = UEXVehiclesAPI;

  console.log('✅ UEX Vehicles API loaded');

})();