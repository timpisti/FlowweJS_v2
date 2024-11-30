import { PerformanceMonitor } from './PerformanceMonitor.js';

export class ComponentLoader {
  constructor() {
    this.loadedComponents = new Set();
    this.loadingPromises = new Map();
    this.loadingTimers = new Map();
    this.externalSourceMap = new Map();
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

    // Check if component has a custom fetch URL
    const element = document.querySelector(componentName);
    const fetchURL = element?.getAttribute('fetchURL');
    
    if (fetchURL) {
      // Validate and sanitize the URL
      try {
        const url = new URL(fetchURL);
        if (!this.isAllowedDomain(url.hostname)) {
          throw new Error(`Domain ${url.hostname} is not in the allowed list`);
        }
        this.externalSourceMap.set(componentName, url.href);
      } catch (error) {
        console.error(`Invalid fetchURL for component ${componentName}:`, error);
        throw error;
      }
    }

    this.setupLoadingIndicator(componentName, targetElement);

    const loadPromise = (async () => {
      try {
        // Use external URL if specified, otherwise fallback to default
        const componentUrl = this.externalSourceMap.get(componentName) || 
          new URL(`${window.FlowweJSConfig.componentFetchUrl}/${componentName}/${componentName}.js`, window.location.origin).href;

        console.log(`Importing component from URL: ${componentUrl}`);
        
        // Add security headers for the fetch
        const headers = new Headers({
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/javascript'
        });

        // First fetch the component code to validate it
        const response = await fetch(componentUrl, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch component: ${response.statusText}`);
        }

        // Validate the response content type
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('javascript')) {
          throw new Error('Invalid content type for component');
        }

        // Get the code as text first for validation
        const code = await response.text();
        
        // Basic validation of the component code
        if (!this.validateComponentCode(code)) {
          throw new Error('Component code validation failed');
        }

        // Create a blob URL for the validated code
        const blob = new Blob([code], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);

        try {
          const module = await import(/* webpackIgnore: true */ blobUrl);
          this.loadedComponents.add(componentName);
          console.log(`Component ${componentName} loaded successfully`);
          await this.checkForNestedComponents(componentName);
          return module;
        } finally {
          // Clean up the blob URL
          URL.revokeObjectURL(blobUrl);
        }
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

  validateComponentCode(code) {
    // Basic security validation
    const dangerousPatterns = [
      /eval\s*\(/,
      /document\.write/,
      /<script\b[^>]*>([\s\S]*?)<\/script>/,
      /Function\s*\(/
    ];

    return !dangerousPatterns.some(pattern => pattern.test(code));
  }

  isAllowedDomain(hostname) {
    // Get allowed domains from configuration or use defaults
    const allowedDomains = window.FlowweJSConfig.allowedExternalDomains || [];
    return allowedDomains.includes(hostname);
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