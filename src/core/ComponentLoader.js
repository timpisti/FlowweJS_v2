import { PerformanceMonitor } from './PerformanceMonitor.js';

export class ComponentLoader {
  constructor() {
    this.loadedComponents = new Set();
    this.loadingPromises = new Map();
    this.loadingTimers = new Map();
  }

  async loadComponent(componentName, targetElement = null) {
    PerformanceMonitor.markStart(`load-${componentName}`);
    console.log(`Attempting to load component: ${componentName}`);
    if (this.loadedComponents.has(componentName)) {
      console.log(`Component ${componentName} already loaded, skipping`);
      PerformanceMonitor.markEnd(`load-${componentName}`);
      PerformanceMonitor.logMeasure(`load-${componentName}`);
      return;
    }

    if (this.loadingPromises.has(componentName)) {
      console.log(`Component ${componentName} is already loading, waiting...`);
      return this.loadingPromises.get(componentName);
    }

    const { componentFetchUrl } = window.FlowweJSConfig;
    const componentUrl = new URL(`${componentFetchUrl}/${componentName}/${componentName}.js`, window.location.origin).href;

    this.setupLoadingIndicator(componentName, targetElement);

    const loadPromise = (async () => {
      try {
        console.log(`Importing component from URL: ${componentUrl}`);
        const module = await import(/* webpackIgnore: true */ componentUrl);
        this.loadedComponents.add(componentName);
        console.log(`Component ${componentName} loaded successfully`);
        await this.checkForNestedComponents(componentName);
        return module;
      } catch (error) {
        console.error(`Failed to load component ${componentName}:`, error);
        throw error;
      } finally {
        this.loadingPromises.delete(componentName);
        this.hideLoadingIndicator(componentName);
        PerformanceMonitor.markEnd(`load-${componentName}`);
        PerformanceMonitor.logMeasure(`load-${componentName}`);
      }
    })();

    this.loadingPromises.set(componentName, loadPromise);
    return loadPromise;
  }

  setupLoadingIndicator(componentName, targetElement) {
    this.loadingTimers.set(componentName, setTimeout(() => {
      this.showLoadingIndicator(componentName, targetElement);
    }, 1000)); // 1 second delay
  }

  showLoadingIndicator(componentName, targetElement) {
    const element = document.createElement('div');
    element.id = `loading-${componentName}`;
    element.textContent = `Loading ${componentName}...`;
    element.style.cssText = 'background: rgba(0,0,0,0.5); color: white; padding: 10px; border-radius: 5px; margin: 10px 0;';
    
    if (targetElement) {
      targetElement.insertAdjacentElement('afterbegin', element);
    } else {
      const customElement = document.querySelector(componentName);
      if (customElement) {
        customElement.insertAdjacentElement('beforebegin', element);
      } else {
        document.body.appendChild(element);
      }
    }
  }

  hideLoadingIndicator(componentName) {
    clearTimeout(this.loadingTimers.get(componentName));
    this.loadingTimers.delete(componentName);
    
    const element = document.getElementById(`loading-${componentName}`);
    if (element) {
      element.remove();
    }
  }


  async checkForNestedComponents(componentName) {
    console.log(`Checking for nested components in ${componentName}`);
    const elements = Array.from(document.getElementsByTagName(componentName));
    await Promise.all(elements.map(element => this.handleAddedNode(element.shadowRoot)));
  }

  observeDOM(targetNode) {
    console.log('Setting up MutationObserver');
    const config = { childList: true, subtree: true };
    const observer = new MutationObserver((mutationsList) => {
      const addedNodes = mutationsList.flatMap(mutation => 
        Array.from(mutation.addedNodes).filter(node => node.nodeType === Node.ELEMENT_NODE)
      );
      Promise.all(addedNodes.map(node => this.handleAddedNode(node))).catch(console.error);
    });

    observer.observe(targetNode, config);
    
    // Initial scan of the existing DOM
    this.handleAddedNode(targetNode);
  }

  async handleAddedNode(node) {
    if (!node) return;

    console.log(`Handling node: ${node.tagName || 'shadowRoot'}`);
    const loadPromises = [];

    if (node.tagName && node.tagName.includes('-')) {
      loadPromises.push(this.loadComponent(node.tagName.toLowerCase()));
    }

    const children = Array.from(node.children || node.childNodes);
    loadPromises.push(...children
      .filter(child => child.nodeType === Node.ELEMENT_NODE)
      .map(child => this.handleAddedNode(child)));

    if (node.shadowRoot) {
      loadPromises.push(this.handleAddedNode(node.shadowRoot));
    }

    await Promise.all(loadPromises);
  }
}