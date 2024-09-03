import { ComponentLoader } from './core/ComponentLoader.js';
import { Router } from './core/Router.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';
import { ErrorBoundary } from './core/ErrorBoundary.js';
import { Subject } from 'rxjs';

class FlowweJS {
  constructor() {
    this.componentLoader = new ComponentLoader();
    this.router = new Router(this.componentLoader);
    this.initFlowweRx();
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
      await Promise.all(preloadComponents.map(component => this.componentLoader.loadComponent(component)));
    }
  }
}

if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    const app = new FlowweJS();
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
      // You might want to display a user-friendly error message here
    });
  });
} else {
  window.addEventListener('DOMContentLoaded', () => {
    const app = new FlowweJS();
    app.init().catch(error => {
      console.error('Failed to initialize app:', error);
      // You might want to display a user-friendly error message here
    });
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
		  const registration = await navigator.serviceWorker.register('/service-worker.js').then(registration => {
		  registration.addEventListener('updatefound', () => {
			const installingWorker = registration.installing;
			if (installingWorker) {
			  installingWorker.onstatechange = function() {
				switch (this.state) {
				  case 'installed':
					if (navigator.serviceWorker.controller) {
					  console.log('New or updated content is available.');
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
		})
		.catch(error => {
		  console.error('Error during service worker registration:', error);
		});
	} catch (error) {
      console.error('Upload Service Worker registration failed:', error);
    }
  });
}
