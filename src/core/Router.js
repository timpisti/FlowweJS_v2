import { AnimationController } from './AnimationController.js';

export class Router {
  constructor(config) {
    this.config = config;
    this.routes = config.routes || window.FlowweJSConfig.routes;
    this.contentContainer = document.getElementById('app');
    this.currentRoute = null;
    this.currentParams = null;
    this.componentCache = new Map();
    this.componentLoader = config.componentLoader;
  }

  async init() {
    console.log('Initializing Router');
    this.animationController = new AnimationController();
    
    window.addEventListener('popstate', () => this.handleRoute());
    this.setupLinkInterception();
    this.handleRoute();
  }

  setupLinkInterception() {
    console.log('Setting up link interception');
    document.body.addEventListener('click', this.handleClick.bind(this), { capture: true, passive: false });
  }

  handleClick(e) {
    const anchor = e.composedPath().find(el => el.tagName === 'A');
    if (anchor) {
      const href = anchor.getAttribute('href');
      if (href?.startsWith('/')) {
        console.log(`Intercepted click on link: ${href}`);
        e.preventDefault();
        this.navigateTo(href);
      }
    }
  }

  async navigateTo(url) {
    console.log(`Navigating to: ${url}`);
    history.pushState(null, null, url);
    await this.handleRoute();
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
      // Update component with new params
      Object.entries(params).forEach(([key, value]) => {
        component.setAttribute(key, value);
      });
      // If the component has an update method, call it
      if (typeof component.update === 'function') {
        await component.update(params);
      }
    }
  }

  findMatchingRoute(path) {
    const urlPathSegments = path.split('/').filter(Boolean);

    for (const route of this.routes) {
      const routePathSegments = route.path.split('/').filter(Boolean);

      if (routePathSegments.length !== urlPathSegments.length) {
        continue;
      }

      const params = {};
      const match = routePathSegments.every((routeSegment, i) => {
        if (routeSegment.startsWith(':')) {
          params[routeSegment.slice(1)] = urlPathSegments[i];
          return true;
        }
        return routeSegment === urlPathSegments[i];
      });

      if (match) {
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
    
    // Update component with new params
    Object.entries(params).forEach(([key, value]) => {
      component.setAttribute(key, value);
    });
    
    // If the component has an update method, call it
    if (typeof component.update === 'function') {
      await component.update(params);
    } else {
      // If there's no update method, recreate the component
      const newComponent = document.createElement(componentName);
      Object.entries(params).forEach(([key, value]) => {
        newComponent.setAttribute(key, value);
      });
      component = newComponent;
      this.componentCache.set(componentName, component);
    }
    
    // Clear the container and append the component
    this.contentContainer.innerHTML = '';
    this.contentContainer.appendChild(component);
    
    // Force a render of the component
    await new Promise(resolve => requestAnimationFrame(resolve));
    return [component];
  };
  
  await this.animationController.animateRouteTransition(oldComponents, newComponentsCallback);
}
  async loadComponent(componentName) {
    if (this.componentLoader) {
      return this.componentLoader.loadComponent(componentName);
    } else {
      return new Promise((resolve, reject) => {
        import(/* webpackIgnore: true */ `/components/${componentName}/${componentName}.js`)
          .then(() => {
            console.log(`Component ${componentName} loaded successfully`);
            resolve();
          })
          .catch(error => {
            console.error(`Failed to load component ${componentName}:`, error);
            reject(error);
          });
      });
    }
  }

  async renderNotFound() {
    console.log('Rendering 404 page');
    const oldComponents = Array.from(this.contentContainer.children);
    
    const newComponentsCallback = async () => {
      const notFoundContent = document.createElement('div');
      notFoundContent.innerHTML = '<h1>404 - Page Not Found</h1>';
      this.contentContainer.innerHTML = '';
      this.contentContainer.appendChild(notFoundContent);
      return [notFoundContent];
    };

    await this.animationController.animateRouteTransition(oldComponents, newComponentsCallback);
  }
}