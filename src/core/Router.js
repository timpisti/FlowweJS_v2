import { AnimationController } from './AnimationController.js';

let isDebug = false;
export function setDebugRouter(value) { isDebug = value; }

export class Router {
  constructor({ componentLoader }) {
    this.componentLoader = componentLoader;
    this.routes = this.prepareRoutes(window.FlowweJSConfig.routes || []);
    this.contentContainer = document.getElementById('app');
    this.currentRoute = null;
    this.currentParams = null;
    this.componentCache = new Map();
    this.animationController = new AnimationController();
    this.debounceDelay = 50;
    this.debounceTimer = null;
    this.basePath = this.resolveBasePath();
    this.navigationController = null; // AbortController for in-flight route transitions
  }

  resolveBasePath() {
    const baseUrl = window.FlowweJSConfig.baseUrl || '/';
    // Explicit domain root — no base path to strip
    if (baseUrl === '/') {
      return '';
    }
    // Relative — auto-detect from current URL for sub-path deployments
    if (baseUrl === './') {
      const path = window.location.pathname;
      return path.endsWith('/') ? path.replace(/\/$/, '') : path.substring(0, path.lastIndexOf('/'));
    }
    // Explicit base path
    return baseUrl.replace(/\/$/, '');
  }

  prepareRoutes(routes) {
    return routes.map(route => ({
      ...route,
      regex: this.pathToRegex(route.path),
      params: this.getRouteParams(route.path)
    })).sort((a, b) => b.path.length - a.path.length); // Sort by path specificity
  }

  pathToRegex(path) {
    // First extract :param tokens, then escape special regex chars in remaining static segments
    const escaped = path.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp('^' + escaped.replace(/:\w+/g, '([^\\/]+)') + '$');
  }

  getRouteParams(path) {
    return path.match(/:(\w+)/g)?.map(param => param.substring(1)) || [];
  }

  debouncedHandleRoute() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.handleRoute().catch(error => {
        console.error('Error in route handling:', error);
        this.renderNotFound();
      });
    }, this.debounceDelay);
  }

  async init() {
    if (isDebug) console.log('Initializing Router');
    window.addEventListener('popstate', () => this.debouncedHandleRoute());
    this.setupLinkInterception();
    await this.handleRoute(); // Initial route — direct, not debounced
  }

  setupLinkInterception() {
    if (isDebug) console.log('Setting up link interception');
    document.body.addEventListener('click', this.handleClick.bind(this), { capture: true, passive: false });

    // Pre-fetch components on hover for near-instant navigation
    this.prefetchedComponents = new Set();
    this.hoverTimer = null;
    document.body.addEventListener('mouseover', this.handleHover.bind(this), { passive: true });
  }

  handleHover(e) {
    const anchor = e.composedPath().find(el => el.tagName === 'A');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/')) return;

    // Debounce — only prefetch after 65ms of sustained hover
    clearTimeout(this.hoverTimer);
    this.hoverTimer = setTimeout(() => {
      const { route } = this.findMatchingRoute(href);
      if (route && !this.prefetchedComponents.has(route.component) && !customElements.get(route.component)) {
        if (isDebug) console.log(`Prefetching component on hover: ${route.component}`);
        this.prefetchedComponents.add(route.component);
        this.loadComponent(route.component).catch(() => {
          this.prefetchedComponents.delete(route.component);
        });
      }
    }, 65);
  }

  handleClick(e) {
    // Don't intercept modifier clicks (open in new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const anchor = e.composedPath().find(el => el.tagName === 'A');
    if (!anchor) return;

    // Don't intercept links with target, download, or non-path hrefs
    if (anchor.hasAttribute('target') || anchor.hasAttribute('download')) return;

    const href = anchor.getAttribute('href');
    if (href && href.startsWith('/')) {
      if (isDebug) console.log(`Intercepted click on link: ${href}`);
      e.preventDefault();
      this.navigateTo(href);
    }
  }

  async navigateTo(url, immediate = false) {
    const fullUrl = this.basePath + url;
    if (isDebug) console.log(`Navigating to: ${fullUrl}`);
    history.pushState(null, null, fullUrl);
    if (immediate) {
      await this.handleRoute();
    } else {
      this.debouncedHandleRoute();
    }
  }

  async handleRoute() {
    // Cancel any in-flight route transition
    if (this.navigationController) {
      this.navigationController.abort();
      this.animationController.cancel();
    }
    this.navigationController = new AbortController();
    const signal = this.navigationController.signal;

    const fullPath = window.location.pathname;
    const path = this.basePath && fullPath.startsWith(this.basePath)
      ? fullPath.slice(this.basePath.length) || '/'
      : fullPath;
    if (isDebug) console.log(`Handling route: ${path}`);

    const { route, params } = this.findMatchingRoute(path);

    if (!route) {
      if (isDebug) console.log('No matching route found, rendering 404');
      await this.renderNotFound();
      return;
    }

    if (isDebug) {
      console.log(`Found matching route: ${JSON.stringify(route)}`);
      console.log(`Route params: ${JSON.stringify(params)}`);
    }

    // Same route and same params — nothing to do
    if (route === this.currentRoute && JSON.stringify(params) === JSON.stringify(this.currentParams)) {
      return;
    }

    // Check if navigation was cancelled before proceeding
    if (signal.aborted) return;

    if (route === this.currentRoute) {
      // Same route, different params
      this.currentParams = params;
      const cached = this.componentCache.get(route.component);
      if (cached && typeof cached.update === 'function') {
        // Component supports update — update in place
        if (isDebug) console.log('Route parameters changed, updating component');
        await this.updateComponent(params);
      } else {
        // No update() — delete cache and do a full re-render
        if (isDebug) console.log('Component has no update(), re-rendering');
        this.componentCache.delete(route.component);
        await this.renderComponent(route.component, params, signal);
      }
    } else {
      // Different route — full render
      this.currentRoute = route;
      this.currentParams = params;
      await this.renderComponent(route.component, params, signal);
    }
  }

  async updateComponent(params) {
    const component = this.componentCache.get(this.currentRoute.component);
    if (component) {
      Object.entries(params).forEach(([key, value]) => {
        component.setAttribute(key, value);
      });

      if (typeof component.update === 'function') {
        await component.update(params);
      }
    }
  }

  findMatchingRoute(path) {
    for (const route of this.routes) {
      const match = path.match(route.regex);
      if (match) {
        const params = {};
        route.params.forEach((param, index) => {
          params[param] = match[index + 1];
        });
        return { route, params };
      }
    }
    return { route: null, params: {} };
  }

  async renderComponent(componentName, params, signal) {
    if (isDebug) console.log(`Rendering component: ${componentName}`);
    const oldComponents = Array.from(this.contentContainer.children);
    const route = this.routes.find(r => r.component === componentName);
    const needsWait = route && route.waitForData;

    // Prepare the new component
    let component = this.componentCache.get(componentName);

    if (!component) {
      if (!customElements.get(componentName)) {
        await this.loadComponent(componentName);
      }
      if (signal && signal.aborted) return;
      component = document.createElement(componentName);
      this.componentCache.set(componentName, component);
    }

    Object.entries(params).forEach(([key, value]) => {
      component.setAttribute(key, value);
    });

    if (typeof component.update === 'function') {
      await component.update(params);
    } else {
      const newComponent = document.createElement(componentName);
      Object.entries(params).forEach(([key, value]) => {
        newComponent.setAttribute(key, value);
      });
      component = newComponent;
      this.componentCache.set(componentName, component);
    }

    if (signal && signal.aborted) return;

    if (needsWait) {
      // Gray out old content while data loads — old content stays visible
      oldComponents.forEach(el => {
        el.style.transition = 'opacity 0.2s ease-out';
        el.style.opacity = '0.4';
        el.style.pointerEvents = 'none';
      });

      // Append hidden to trigger connectedCallback and start data fetching
      component.setAttribute('data-wait-for-ready', '');
      component.style.display = 'none';
      this.contentContainer.appendChild(component);

      // Wait for component-ready event (with timeout)
      await new Promise(resolve => {
        const timeout = setTimeout(resolve, 10000);
        component.addEventListener('component-ready', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });

      // Remove so AnimationController doesn't double-wait
      component.removeAttribute('data-wait-for-ready');

      if (signal && signal.aborted) {
        component.remove();
        return;
      }

      // Wait for images while component is still hidden and old content visible (grayed)
      // Browsers fetch <img src> even when display:none, so images are already downloading
      await this.waitForImages(component, 5000);

      if (signal && signal.aborted) {
        component.remove();
        return;
      }
    }

    // Now run the animation transition
    const newComponentsCallback = async () => {
      if (signal && signal.aborted) return [];

      if (needsWait) {
        // Data + images ready — remove grayed-out old content, show new
        oldComponents.forEach(el => el.remove());
        component.style.display = '';
      } else {
        // Non-waitForData: standard immediate swap
        await new Promise(resolve => requestAnimationFrame(resolve));
        this.contentContainer.innerHTML = '';
        this.contentContainer.appendChild(component);
      }

      await new Promise(resolve => requestAnimationFrame(resolve));
      return [component];
    };

    await this.animationController.animateRouteTransition(oldComponents, newComponentsCallback, {
      skipNativeTransition: needsWait
    });
  }

  waitForImages(component, timeoutMs = 5000) {
    const images = component.querySelectorAll('img');
    if (images.length === 0) return Promise.resolve();

    return new Promise(resolve => {
      const timeout = setTimeout(resolve, timeoutMs);
      let remaining = 0;

      images.forEach(img => {
        if (!img.complete && img.src) {
          remaining++;
          const done = () => {
            remaining--;
            if (remaining <= 0) {
              clearTimeout(timeout);
              resolve();
            }
          };
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }
      });

      // All images already loaded
      if (remaining === 0) {
        clearTimeout(timeout);
        resolve();
      }
    });
  }

  async loadComponent(componentName) {
    try {
      if (this.componentLoader) {
        return await this.componentLoader.loadComponent(componentName);
      } else {
        const module = await import(/* webpackIgnore: true */ `${window.FlowweJSConfig.componentFetchUrl}/${componentName}/${componentName}.js`);
        if (isDebug) console.log(`Component ${componentName} loaded successfully`);
        return module;
      }
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      throw error;
    }
  }

  async renderNotFound() {
    if (isDebug) console.log('Rendering 404 page');
    const oldComponents = Array.from(this.contentContainer.children);

    const newComponentsCallback = async () => {
      let notFoundComponent;
      const notFoundRoute = this.routes.find(route => route.path === '/404');

      if (notFoundRoute) {
        if (!customElements.get(notFoundRoute.component)) {
          await this.loadComponent(notFoundRoute.component);
        }
        notFoundComponent = document.createElement(notFoundRoute.component);
      } else {
        notFoundComponent = document.createElement('div');
        notFoundComponent.innerHTML = '<h1>404 - Page Not Found</h1>';
      }

      this.contentContainer.innerHTML = '';
      this.contentContainer.appendChild(notFoundComponent);
      return [notFoundComponent];
    };

    await this.animationController.animateRouteTransition(oldComponents, newComponentsCallback);
  }
}
