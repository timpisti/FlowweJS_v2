import { PerformanceMonitor } from './PerformanceMonitor.js';

let isDebug = false;
export function setDebugLoader(value) { isDebug = value; }
const FETCH_TIMEOUT_MS = 15000; // 15 second timeout for component fetches

export class ComponentLoader {
  constructor() {
    this.loadedComponents = new Set();
    this.loadingPromises = new Map();
    this.loadingTimers = new Map();
    this.externalSourceMap = new Map();
    this.integrityManifest = null;
  }

  async loadIntegrityManifest() {
    if (this.integrityManifest !== null) return;
    try {
      const baseUrl = document.baseURI || window.location.href;
      const manifestUrl = new URL('./components.json', baseUrl).href;
      const response = await fetch(manifestUrl);
      if (response.ok) {
        this.integrityManifest = await response.json();
        if (isDebug) console.log('Loaded component integrity manifest');
      } else {
        this.integrityManifest = {}; // No manifest — skip integrity checks
      }
    } catch (e) {
      this.integrityManifest = {}; // No manifest available
    }
  }

  async verifyIntegrity(componentName, code) {
    await this.loadIntegrityManifest();
    const expectedHash = this.integrityManifest[componentName];
    if (!expectedHash) return true; // No hash in manifest — allow (backwards compatible)

    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (hashHex !== expectedHash) {
      console.error(`Integrity check failed for ${componentName}: expected ${expectedHash}, got ${hashHex}`);
      return false;
    }
    return true;
  }

  async loadComponent(componentName, targetElement = null) {
    PerformanceMonitor.markStart(`load-${componentName}`);
    if (isDebug) console.log(`Attempting to load component: ${componentName}`);

    if (this.loadedComponents.has(componentName)) {
      if (isDebug) console.log(`Component ${componentName} already loaded, skipping`);
      PerformanceMonitor.markEnd(`load-${componentName}`);
      PerformanceMonitor.logMeasure(`load-${componentName}`);
      return;
    }

    if (this.loadingPromises.has(componentName)) {
      if (isDebug) console.log(`Component ${componentName} is already loading, waiting...`);
      return this.loadingPromises.get(componentName);
    }

    // Check if component has a custom fetch URL
    const element = document.querySelector(componentName);
    const fetchURL = element?.getAttribute('fetchURL');

    if (fetchURL) {
      // Only treat as external source if it's an absolute URL
      try {
        const url = new URL(fetchURL);
        if (!this.isAllowedDomain(url.hostname)) {
          throw new Error(`Domain ${url.hostname} is not in the allowed list`);
        }
        this.externalSourceMap.set(componentName, url.href);
      } catch (e) {
        // Relative path (e.g. "components/") — not an external source, ignore for JS loading.
        // The component itself handles its own template/CSS fetching via this attribute.
      }
    }

    this.setupLoadingIndicator(componentName, targetElement);

    const loadPromise = (async () => {
      try {
        // Use external URL if specified, otherwise fallback to default
        const baseUrl = document.baseURI || window.location.href;
        const componentUrl = this.externalSourceMap.get(componentName) ||
          new URL(`${window.FlowweJSConfig.componentFetchUrl}/${componentName}/${componentName}.js`, baseUrl).href;

        if (isDebug) console.log(`Importing component from URL: ${componentUrl}`);

        // Fetch with timeout via AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const headers = new Headers({
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/javascript'
        });

        let response;
        try {
          response = await fetch(componentUrl, { headers, signal: controller.signal });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch component: ${response.statusText}`);
        }

        // Validate the response content type — accept any JS-related MIME or skip for same-origin
        const contentType = response.headers.get('content-type') || '';
        const isSameOrigin = new URL(componentUrl).origin === window.location.origin;
        if (!isSameOrigin && !contentType.match(/javascript|ecmascript|text\/plain/i)) {
          throw new Error(`Invalid content type for component: ${contentType}`);
        }

        // Get the code as text first for validation
        const code = await response.text();

        // SRI integrity check (if manifest exists)
        if (!await this.verifyIntegrity(componentName, code)) {
          throw new Error(`Component integrity verification failed for: ${componentName}`);
        }

        // Basic pattern validation of the component code
        if (!this.validateComponentCode(code)) {
          throw new Error('Component code validation failed');
        }

        let module;
        if (isSameOrigin) {
          // Same-origin: import directly from the URL — CSP-clean, no blob needed.
          // The browser serves this from HTTP cache (already fetched above).
          module = await import(/* webpackIgnore: true */ componentUrl);
        } else {
          // Cross-origin: use validated blob URL as sandbox
          const blob = new Blob([code], { type: 'application/javascript' });
          const blobUrl = URL.createObjectURL(blob);
          try {
            module = await import(/* webpackIgnore: true */ blobUrl);
          } finally {
            URL.revokeObjectURL(blobUrl);
          }
        }

        this.loadedComponents.add(componentName);
        if (isDebug) console.log(`Component ${componentName} loaded successfully`);
        await this.checkForNestedComponents(componentName);
        return module;
      } catch (error) {
        if (error.name === 'AbortError') {
          console.error(`Component ${componentName} fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
        } else {
          console.error(`Failed to load component ${componentName}:`, error);
        }
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
    const dangerousPatterns = [
      /\beval\s*\(/,
      /\(\s*0\s*,\s*eval\s*\)/,
      /\bFunction\s*\(/,
      /document\.write/,
      /<script\b[^>]*>([\s\S]*?)<\/script>/,
      /setTimeout\s*\(\s*['"`]/,
      /setInterval\s*\(\s*['"`]/,
      /\bimport\s*\(/,
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
    if (isDebug) console.log(`Checking for nested components in ${componentName}`);
    const elements = Array.from(document.getElementsByTagName(componentName));
    await Promise.all(elements.map(element => this.handleAddedNode(element.shadowRoot)));
  }

  observeDOM(targetNode) {
    if (isDebug) console.log('Setting up MutationObserver');
    const config = { childList: true, subtree: true };
    const observer = new MutationObserver((mutationsList) => {
      // Collect custom elements from added nodes AND their descendants
      const customElements = new Set();
      mutationsList.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.tagName && node.tagName.includes('-')) {
            customElements.add(node.tagName.toLowerCase());
          }
          if (node.querySelectorAll) {
            node.querySelectorAll('*').forEach(child => {
              if (child.tagName && child.tagName.includes('-')) {
                customElements.add(child.tagName.toLowerCase());
              }
            });
          }
        });
      });
      if (customElements.size > 0) {
        Promise.all([...customElements].map(tag => this.loadComponent(tag))).catch(console.error);
      }
    });

    observer.observe(targetNode, config);

    // Initial scan of the existing DOM — only custom elements
    this.scanForCustomElements(targetNode);
  }

  scanForCustomElements(node) {
    if (!node) return;

    if (node.tagName && node.tagName.includes('-')) {
      this.loadComponent(node.tagName.toLowerCase()).catch(console.error);
    }

    // Scan children
    const children = node.children || node.childNodes;
    for (let i = 0; i < children.length; i++) {
      if (children[i].nodeType === Node.ELEMENT_NODE) {
        this.scanForCustomElements(children[i]);
      }
    }

    // Scan shadow DOM
    if (node.shadowRoot) {
      this.scanForCustomElements(node.shadowRoot);
    }
  }

  // Keep handleAddedNode for checkForNestedComponents (shadow DOM scanning)
  async handleAddedNode(node) {
    if (!node) return;
    this.scanForCustomElements(node);
  }
}
