import { ComponentLoader } from './core/ComponentLoader.js';
import { Router } from './core/Router.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';
import { ErrorBoundary } from './core/ErrorBoundary.js';
import { setDebugRouter } from './core/Router.js';
import { setDebugLoader } from './core/ComponentLoader.js';
import { setDebugAnimation } from './core/AnimationController.js';
import { Subject } from 'rxjs';

class FlowweJS {
  constructor() {
    this.componentLoader = new ComponentLoader();
    this.router = new Router({ componentLoader: this.componentLoader });
    this.initFlowweRx();
    this.setupServiceWorkerVersioning();
  }

  setupServiceWorkerVersioning() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'GET_VERSION') {
          event.ports[0].postMessage(window.FlowweJSConfig?.version || null);
        } else if (event.data.type === 'CACHE_INVALIDATED') {
          if (window.FlowweJSConfig?.performanceMonitoring) {
            console.log(`Cache invalidated: Version changed from ${event.data.oldVersion} to ${event.data.newVersion}`);
          }
          window.dispatchEvent(new CustomEvent('flowwe-version-changed', {
            detail: {
              oldVersion: event.data.oldVersion,
              newVersion: event.data.newVersion
            }
          }));
        }
      });
    }
  }

  async init() {
    // Bind debug flag once — avoids repeated window.FlowweJSConfig lookups in hot paths
    const debugEnabled = !!window.FlowweJSConfig?.performanceMonitoring;
    setDebugRouter(debugEnabled);
    setDebugLoader(debugEnabled);
    setDebugAnimation(debugEnabled);

    PerformanceMonitor.markStart('app-init');
    ErrorBoundary.init();
    this.initSharedStyles();
    this.insertModulePreloads();
    this.componentLoader.observeDOM(document.body);
    await this.loadPreloadComponents();
    await this.router.init();
    PerformanceMonitor.markEnd('app-init');
    PerformanceMonitor.logMeasure('app-init');
  }

  initSharedStyles() {
    // Collect document-level stylesheets into Constructable CSSStyleSheet objects
    // so Shadow DOM components can adopt them via adoptedStyleSheets
    if (!('adoptedStyleSheets' in Document.prototype)) return;

    const shared = [];
    for (const sheet of document.styleSheets) {
      try {
        const css = new CSSStyleSheet();
        const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
        css.replaceSync(rules);
        shared.push(css);
      } catch (e) {
        // Cross-origin stylesheets (e.g., CDN) can't be read via cssRules.
        // Fetch the href and create a sheet from the text content.
        if (sheet.href) {
          this.fetchAndRegisterSheet(sheet.href, shared);
        }
      }
    }
    window.FlowweSharedStyles = shared;
  }

  async fetchAndRegisterSheet(href, sharedArray) {
    try {
      const response = await fetch(href);
      if (!response.ok) return;
      const text = await response.text();
      const css = new CSSStyleSheet();
      css.replaceSync(text);
      sharedArray.push(css);
    } catch (e) {
      // Silently skip unreachable stylesheets
    }
  }

  initFlowweRx() {
    const FlowweRX = new Subject();
    window.FlowweRx = FlowweRX;
  }

  insertModulePreloads() {
    const { preloadComponents, componentFetchUrl } = window.FlowweJSConfig;
    if (preloadComponents && Array.isArray(preloadComponents)) {
      const head = document.head;
      preloadComponents.forEach(component => {
        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = new URL(`${componentFetchUrl}/${component}/${component}.js`, document.baseURI).href;
        head.appendChild(link);
      });
    }
  }

  async loadPreloadComponents() {
    const { preloadComponents } = window.FlowweJSConfig;
    if (preloadComponents && Array.isArray(preloadComponents)) {
      await Promise.all(preloadComponents.map(component =>
        this.componentLoader.loadComponent(component)));
    }
  }
}

if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    const app = new FlowweJS();
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
    });
  });
} else {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new FlowweJS();
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
    });
  });
}

// Helper to send config to an active service worker
function sendConfigToWorker(worker) {
  if (!worker || !window.FlowweJSConfig) return;
  if (window.FlowweJSConfig.version) {
    worker.postMessage({ type: 'SET_VERSION', version: window.FlowweJSConfig.version });
  }
  if (window.FlowweJSConfig.httpCacheStrategy) {
    worker.postMessage({ type: 'SET_CACHE_STRATEGY', strategy: window.FlowweJSConfig.httpCacheStrategy });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Register with explicit scope covering the base path
      const swUrl = new URL('./service-worker.js', document.baseURI).href;
      const scope = new URL('./', document.baseURI).href;
      const registration = await navigator.serviceWorker.register(swUrl, { scope });

      // Send config to already-active worker
      if (registration.active) {
        sendConfigToWorker(registration.active);
      }

      // Send config when a new worker activates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              sendConfigToWorker(newWorker);
            }
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                if (window.FlowweJSConfig?.performanceMonitoring) {
                  console.log('New or updated content is available.');
                }
                window.dispatchEvent(new CustomEvent('flowwe-update-available'));
              }
            }
            if (newWorker.state === 'redundant') {
              console.error('The installing service worker became redundant.');
            }
          });
        }
      });

      // Also handle controller change (e.g., hard refresh activating new SW)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (navigator.serviceWorker.controller) {
          sendConfigToWorker(navigator.serviceWorker.controller);
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}
