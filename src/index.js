import { ComponentLoader } from './core/ComponentLoader.js';
import { Router } from './core/Router.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';
import { ErrorBoundary } from './core/ErrorBoundary.js';
import { Subject, BehaviorSubject } from 'rxjs';

class FlowweJS {
  constructor() {
    this.componentLoader = new ComponentLoader();
    this.router = new Router(this.componentLoader);
    this.initFlowweRx();
    this.setupServiceWorkerVersioning();
  }

  setupServiceWorkerVersioning() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'GET_VERSION') {
          event.ports[0].postMessage(window.FlowweJSConfig?.version || null);
        } else if (event.data.type === 'CACHE_INVALIDATED') {
          console.log(`Cache invalidated: Version changed from ${event.data.oldVersion} to ${event.data.newVersion}`);
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
    PerformanceMonitor.markStart('app-init');
    ErrorBoundary.init();
    this.insertModulePreloads();
    this.componentLoader.observeDOM(document.body);
    await this.loadPreloadComponents();
    this.router.init();
    PerformanceMonitor.markEnd('app-init');
    PerformanceMonitor.logMeasure('app-init');
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
        link.href = new URL(`${componentFetchUrl}/${component}/${component}.js`, window.location.origin).href;
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      
      registration.addEventListener('activate', () => {
        if (window.FlowweJSConfig?.version) {
          registration.active.postMessage({
            type: 'SET_VERSION',
            version: window.FlowweJSConfig.version
          });
        }
      });

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = function() {
            switch (this.state) {
              case 'installed':
                if (navigator.serviceWorker.controller) {
                  console.log('New or updated content is available.');
                  window.dispatchEvent(new CustomEvent('flowwe-update-available'));
                } else {
                  console.log('Content is now available offline!');
                }
                break;
              case 'redundant':
                console.error('The installing service worker became redundant.');
                break;
            }
          };
        }
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}