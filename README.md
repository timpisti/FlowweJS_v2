# FlowweJS

FlowweJS is a lightweight, modular JavaScript framework designed for building efficient and dynamic web applications - as a part of [Flow web ecosystem](https://flowwe.4i.hu). It focuses on component-based architecture, smooth routing, native like user experience with animations, and performance optimization.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
  - [Basic Setup](#basic-setup)
  - [Creating Components](#creating-components)
  - [Routing](#routing)
  - [Performance Monitoring](#performance-monitoring)
  - [Error Handling](#error-handling)
- [Advanced Features](#advanced-features)
  - [Animations](#animations)
  - [Service Worker](#service-worker)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Component-based Architecture**: Build your application using reusable, encapsulated components.
- **Dynamic Routing**: Smooth, client-side routing with support for nested routes and parameters.
- **Lazy Loading**: Load components on-demand to improve initial load times.
- **Performance Monitoring**: Built-in tools to measure and optimize your application's performance.
- **Error Boundary**: Catch and handle errors gracefully to improve user experience, and manage in enterprise environment.
- **Animation Support**: Easily add smooth transitions between route changes.
- **Service Worker Integration**: Improve load times with intelligent caching.
- **Loading indicator for slow load**: To avoid early application leaveing for limited network users.
- **Component preloading**: To smooth user experinece.
- **Intersection Observer**: To minimize image network traffic
  
## Installation

1. Clone the FlowweJS repository:
   ```
   git clone [https://github.com/timpisti/flowwejs_v2.git](https://github.com/timpisti/FlowweJS_v2.git)
   ```

2. Navigate to the project directory:
   ```
   cd flowwejs
   ```

3. Install dependencies:
   ```
   npm install
   ```

## Usage

To use FlowweJS in your project, include the following script tag in your HTML file:

```html
<script type="module" src="path/to/flowwejs/bundle.js"></script>
```

## Building

Run the build script:
   ```
   npm run build
   ```


### Performance Monitoring

Use the `PerformanceMonitor` to measure the performance of your application in developement mode:

```javascript
import { PerformanceMonitor } from './path/to/flowwejs/PerformanceMonitor.js';

PerformanceMonitor.markStart('operation-name');
// ... perform operation
PerformanceMonitor.markEnd('operation-name');
PerformanceMonitor.logMeasure('operation-name');
```

### Error Handling

FlowweJS includes a global error boundary. To use it in your components in developement mode:

```javascript
import { ErrorBoundary } from './path/to/flowwejs/ErrorBoundary.js';

try {
    // Your component logic here
} catch (error) {
    ErrorBoundary.handleError({ error });
}
```

## You can build your own version, but the base build contain every neccesarry fuunction to run in production.

### Basic Setup

1. Create an `index.html` file with a basic structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FlowweJS App</title>
  <script>
    //For this example
    tailwind.config = {
      darkMode: 'class'
    };  
    window.FlowweJSConfig = {
      baseUrl: '/',
      componentFetchUrl: '/components',
      apiUrl: '',  //YOUR apiURL
      routes: [
		{ path: '/', component: 'article-list-page' },
		{ path: '/articles/:id', component: 'article-page' },
		{ path: '/authors', component: 'authors-list-page' },
		{ path: '/author/:id', component: 'author-page' },
    { path: '/404', component: 'notfound-page' }
      ],
    preloadComponents: ['flowwejs-nav'], //Component list for preloading
	performanceMonitoring: true,          // Disable perfmon
	errorDisplaying: true,                // Disable error message
	defaultAnimationSpeed: 500,          
	useViewTransition: true,
	useIntersectionObserver: true,
	intersectionThreshold: 0.1,
	intersectionRootMargin: '0px',
	useServiceWorker: true,
	httpCacheStrategy: 'cache-first'	  // cache-first or network-first 
    };
  </script>
</head>
<body>
    <div id="app"></div>

</body>
</html>
```

2. Configure your application by setting up `window.FlowweJSConfig` from the example:

```javascript
window.FlowweJSConfig = {
    componentFetchUrl: '/components',
    routes: [
        { path: '/', component: 'home-page' },
        { path: '/about', component: 'about-page' },
        { path: '/users/:id', component: 'user-profile' }
    ],
    preloadComponents: ['header-component', 'footer-component']
};
```

### Creating Components

Create your components as custom elements. Here's an example of a simple component:

```javascript
// components/home-page/home-page.js
class HomePage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadowRoot.innerHTML = `
            <h1>Welcome to FlowweJS</h1>
            <p>This is the home page.</p>
        `;
    }
}

customElements.define('home-page', HomePage);
```

### Routing

FlowweJS handles routing automatically based on your configuration. To create links, use regular `<a>` tags:

```html
<a href="/">Home</a>
<a href="/about">About</a>
<a href="/users/123">User Profile</a>
```

## Advanced Features

### Animations

To add animations between route changes, use the `data-animate` attribute in your components or elements:

data-animate="[contentID],[enter effect name],[enter effect duration in ms],[enter effect delay in ms],[exit effect name],[exit effect duration]"

```html
<div data-animate="myanimateddiv,fade,300,50,scale,300">
    <!-- Your component content -->
</div>
```
```
You can use in <div>,<img> and text content <p>,<h1>,<h2>, etc
```
### Service Worker

FlowweJS includes a service worker for performance optimization, component (and image) caching. To use it, register the service worker in your main JavaScript file:

```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}
```

## Differences and upgrades from Flowwe-JS v1

- Enterprise environment ready setup
- Get rid of mandatory naming scheme
- Animation
- Safer and better component cache, preloading
- Performance optimalisation

## Contributing

We welcome contributions to FlowweJS! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

FlowweJS is open-source software licensed under the [MIT license](LICENSE).
