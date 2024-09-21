import { AnimationController } from './AnimationController.js';

export class Router {
  constructor(config) {
    this.config = config;
    this.routes = this.prepareRoutes(config.routes || window.FlowweJSConfig.routes);
    this.contentContainer = document.getElementById('app');
    this.currentRoute = null;
    this.currentParams = null;
    this.componentCache = new Map();
    this.componentLoader = config.componentLoader;
    this.animationController = new AnimationController();
    this.debounceDelay = 50; // milliseconds
    this.debounceTimer = null;
  }

  prepareRoutes(routes) {
    return routes.map(route => ({
      ...route,
      regex: this.pathToRegex(route.path),
      params: this.getRouteParams(route.path)
    })).sort((a, b) => b.path.length - a.path.length); // Sort by path specificity
  }

  pathToRegex(path) {
    return new RegExp('^' + path.replace(/\//g, '\\/').replace(/:\w+/g, '([^\\/]+)') + '$');
  }

  getRouteParams(path) {
    return path.match(/:(\w+)/g)?.map(param => param.substring(1)) || [];
  }

  _debounce(func, delay) {
    return (...args) => {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => func.apply(this, args), delay);
    };
  }

  _debouncedHandleRoute = this._debounce(() => {
    this.handleRoute().catch(error => {
      console.error('Error in route handling:', error);
      this.renderNotFound();
    });
  }, this.debounceDelay);

  async init() {
    console.log('Initializing Router');
    window.addEventListener('popstate', () => this._debouncedHandleRoute());
    this.setupLinkInterception();
    await this._debouncedHandleRoute(); // Initial route handling
  }

  setupLinkInterception() {
    console.log('Setting up link interception');
    document.body.addEventListener('click', this.handleClick.bind(this), { capture: true, passive: false });
  }

  handleClick(e) {
    const anchor = e.composedPath().find(el => el.tagName === 'A');
    if (anchor && anchor.getAttribute('href')?.startsWith('/')) {
      console.log(`Intercepted click on link: ${anchor.getAttribute('href')}`);
      e.preventDefault();
      this.navigateTo(anchor.getAttribute('href'));
    }
  }

  async navigateTo(url, immediate = false) {
    console.log(`Navigating to: ${url}`);
    history.pushState(null, null, url);
    if (immediate) {
      await this.handleRoute();
    } else {
      await this._debouncedHandleRoute();
    }
  }

  async handleRoute() {
    const path = window.location.pathname;
    console.log(`Handling route: ${path}`);

    const { route, params } = this.findMatchingRoute(path);

    if (route) {
      console.log(`Found matching route: ${JSON.stringify(route)}`);
      console.log(`Route params: ${JSON.stringify(params)}`);

      const shouldUpdateComponent = 
        route !== this.currentRoute || 
        JSON.stringify(params) !== JSON.stringify(this.currentParams);

      if (shouldUpdateComponent) {
        this.currentRoute = route;
        this.currentParams = params;
        await this.renderComponent(route.component, params);
      } else {
        console.log('Route parameters changed, updating component');
        await this.updateComponent(params);
      }
    } else {
      console.log('No matching route found, rendering 404');
      await this.renderNotFound();
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

  async renderComponent(componentName, params) {
    console.log(`Rendering component: ${componentName}`);
    const oldComponents = Array.from(this.contentContainer.children);

    const newComponentsCallback = async () => {
      let component = this.componentCache.get(componentName);

      if (!component) {
        if (!customElements.get(componentName)) {
          await this.loadComponent(componentName);
        }
        component = document.createElement(componentName);
        this.componentCache.set(componentName, component);
      }

      Object.entries(params).forEach(([key, value]) => {
        component.setAttribute(key, value);
      });

      const route = this.routes.find(r => r.component === componentName);
      if (route && route.waitForData) {
        console.log('Route:: wait for ready add:', route);
        component.setAttribute('data-wait-for-ready', '');
      }

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

      await new Promise(resolve => requestAnimationFrame(resolve));

      this.contentContainer.innerHTML = '';
      this.contentContainer.appendChild(component);

      await new Promise(resolve => requestAnimationFrame(resolve));

      return [component];
    };

    await this.animationController.animateRouteTransition(oldComponents, newComponentsCallback);
  }

  async loadComponent(componentName) {
    try {
      if (this.componentLoader) {
        return await this.componentLoader.loadComponent(componentName);
      } else {
        const module = await import(/* webpackIgnore: true */ `${window.FlowweJSConfig.componentFetchUrl}/${componentName}/${componentName}.js`);
        console.log(`Component ${componentName} loaded successfully`);
        return module;
      }
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);
      throw error;
    }
  }

  async renderNotFound() {
    console.log('Rendering 404 page');
    const oldComponents = Array.from(this.contentContainer.children);
    
    const newComponentsCallback = async () => {
      let notFoundComponent;
      const notFoundRoute = this.routes.find(route => route.path === '/404');
      
      if (notFoundRoute) {
        notFoundComponent = await this.loadComponent(notFoundRoute.component);
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