import { ComponentLoader } from './core/ComponentLoader.js';
import { Router } from './core/Router.js';
import { PerformanceMonitor } from './core/PerformanceMonitor.js';
import { ErrorBoundary } from './core/ErrorBoundary.js';

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
    window.FlowweRx = {};
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