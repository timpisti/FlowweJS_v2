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
- **Service Worker Integration**: Improve load times with intelligent caching & versioning.
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
    <base href="./" />
    <title>FlowweJS App</title>
  <script>
    //For this example
    tailwind.config = {
      darkMode: 'class'
    };
    window.FlowweJSConfig = {
      baseUrl: './',
      componentFetchUrl: 'https://yourdomain.com/components', //to use local components use './components'
      apiUrl: '',  //YOUR apiURL
	  allowedExternalDomains: ['yourdomain.com','trustedotherdomain.com'], // For external component loading security
	  version: '2.3.0', // your version, if changed, the service worker cache will automatically flush.
      routes: [
		{ path: '/', component: 'article-list-page' },
		{ path: '/articles/:id', component: 'article-page', waitForData: true}, //for dynamic contents
		{ path: '/:id', component: 'article-page', waitForData: true},  //Optionally for better SEO		
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
		{ path: '/:id', component: 'content-page' }, //better SEO for main content without controller name in the route
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
		
		this.dispatchEvent(new CustomEvent('component-ready')); //put this when all the data ready to display
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

FlowweJS includes a service worker for performance optimization, component (and image) caching. The service worker have an automatic version change detection - the cache will flush on every version change and weekly. To use it, register the service worker in your main JavaScript file:

```javascript
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js');
}
```

## v2.5.0 — Upgrade Notes

### Breaking Changes

- **Template expressions**: The template engine no longer uses `new Function()` for evaluating expressions. Templates that relied on arbitrary JavaScript inside `{{expression}}` or `@if(condition)` must be simplified. Supported syntax:
  - Property paths: `{{item.title}}`, `{{data.nested.value}}`
  - Comparisons: `@if(count > 0)`, `@if(status === 'active')`
  - Logical operators: `&&`, `||`, `!`
  - Literals: strings (`'hello'`), numbers, `true`, `false`, `null`
  - Arithmetic or method calls (e.g., `{{price * qty}}`, `{{items.filter(...)}}`) are **no longer supported**.
- **Service worker cache keys** changed from hash-based to full URL. Existing browser caches will not match after upgrade — users should clear site data or bump the `version` in `FlowweJSConfig` to trigger automatic cache invalidation.
- **Relative paths**: `componentFetchUrl` default changed from `/components` to `./components`. A `<base href="./">` tag is now added to `index.html`. This enables deployment under any URL path (not just domain root), but if your components rely on absolute `/` paths, update them to `./` or set an explicit absolute `componentFetchUrl`.

### Security Fixes

- **Removed `new Function()` code injection** in template engine — template expressions are now evaluated through a safe property resolver and condition parser.
- **HTML escaping**: Added global `window.escapeHtml()` utility. All built-in components now escape user-facing text to prevent XSS when rendering dynamic data via `innerHTML`.
- **Expanded component code validation**: `ComponentLoader` now additionally blocks `setTimeout`/`setInterval` with string arguments, indirect `eval` (`(0, eval)()`), and dynamic `import()` in loaded component code.

### Bug Fixes

- **Router constructor**: Fixed wiring so `ComponentLoader` security validation (domain whitelist, dangerous pattern checks, blob URL sandboxing) is actually used. Previously, a constructor mismatch caused the Router to bypass `ComponentLoader` entirely and load components via raw dynamic import.
- **Initial route handling**: `Router.init()` now directly awaits the first route render instead of firing it through a debounce (which returned `undefined`, not a Promise). The `app-init` performance timing now correctly includes initial route rendering.
- **Route change detection**: Fixed three-way branch logic — same route + same params is now a no-op (previously triggered an unnecessary `updateComponent` call). Same route + different params triggers an in-place update. Different route triggers a full render.
- **Position animation completion**: `AnimationController.animateElement()` now returns a Promise that resolves after the CSS transition completes. Previously it returned immediately, causing `Promise.all` in `animateComponents` to resolve before position animations finished.
- **Service worker `CACHE_INVALIDATED` message**: The `oldVersion` field now correctly contains the previous version. Previously, `currentVersion` was overwritten before sending the message, so `oldVersion` and `newVersion` were identical.
- **Service worker cache strategy**: The `httpCacheStrategy` config option (`'cache-first'` or `'network-first'`) is now sent to the service worker via `SET_CACHE_STRATEGY` message. Previously, the service worker read strategy from a request header that was never set, defaulting to `'network-first'` regardless of config.
- **Footer `loadConfig` ReferenceError**: `fetchURL` was a local variable in `connectedCallback` but referenced in `loadConfig`. Now stored as `this.fetchURL` instance property.
- **Author page hardcoded animation IDs**: `data-animate` values were hardcoded to `author-1-image` / `author-1-name` regardless of which author was displayed. Now uses `author-${author.id}-image`.
- **404 route rendering**: `renderNotFound` now properly creates a DOM element via `document.createElement()` instead of trying to append a module object.

### Improvements

- **Sub-path deployment support**: Router auto-detects the base path from the URL and strips it before matching routes. `navigateTo()` prepends the base path when pushing history state. The framework now works correctly when deployed under any directory (e.g., `/app/dist/`), not just domain root.
- **Component lifecycle cleanup**: `FlowwejsFooter` now implements `disconnectedCallback` to unsubscribe from RxJS, preventing memory leaks during SPA navigation.
- **Duplicate image event handlers fixed**: `AnimationController.waitForImagesToLoad` previously set both `img.onload` and `addEventListener('load', ...)`, calling `resolve()` twice. Now uses a single listener with `{ once: true }`.
- **Dead code removed**: duplicate variable declarations in footer, unused `getTemporaryAuthor()` method in author-page, orphaned `</common-image>` closing tags, duplicate `activate` event listener in service worker, unused `simpleHash` function.
- **`notfound-page` component**: Added the missing 404 page component that was referenced in the default route config but never existed.
- **Rapid navigation race condition fix**: New navigations now cancel any in-flight route transition. An `AbortController` signal is checked at multiple async boundaries (component load, animation) so stale transitions don't overwrite the new route's content.
- **AnimationController `cancel()` no longer permanent**: `isCancelled` is reset to `false` at the start of each new transition. Previously, once cancelled, the controller was permanently broken.
- **Component fetch timeout**: `ComponentLoader` now aborts fetches after 15 seconds (configurable via `FETCH_TIMEOUT_MS`) instead of hanging indefinitely on stalled servers.
- **Relaxed content-type validation**: Same-origin component fetches skip MIME type checks. Cross-origin fetches now accept `text/plain` in addition to JavaScript MIME types, fixing compatibility with default Apache configurations.
- **MutationObserver performance**: The observer callback no longer recursively walks the entire subtree for every DOM mutation. Since `subtree: true` already reports deeply-nested additions individually, only directly-added custom elements are processed. Initial DOM scan uses a separate one-time recursive scan.
- **Conditional debug logging**: All ~60 `console.log` calls in core framework modules are now gated behind `FlowweJSConfig.performanceMonitoring`. Set to `false` in production for zero logging overhead. Errors always log regardless of this setting.
- **ErrorBoundary visual feedback**: When `FlowweJSConfig.errorDisplaying` is `true`, unhandled errors now show a dismissible red banner at the bottom of the screen (auto-dismisses after 8 seconds) instead of only logging to the console.
- **Service worker `getStoredVersion` timeout**: The version retrieval from the client now times out after 3 seconds instead of hanging forever if the client doesn't respond (e.g., frozen tab, mid-load page).
- **Service worker scope fix**: The service worker is now registered with an explicit `scope` derived from `document.baseURI`, ensuring it intercepts fetch requests for all SPA routes even in sub-path deployments.
- **Upload chunk concatenation O(n) instead of O(n^2)**: Response chunks in `uploadWithProgress` are now concatenated via `new Blob(chunks).text()` instead of spread-reducing into intermediate arrays.
- **Unused `BehaviorSubject` import removed**: Only `Subject` is imported from RxJS, reducing bundle size.

## Differences and upgrades from Flowwe-JS v1

- Enterprise environment ready setup
- Get rid of mandatory naming scheme
- Animation
- Safer and better component cache, preloading
- Performance optimalisation

## Contributing

We welcome contributions to FlowweJS! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

 FlowweJS Framework Comparison & Scorecard

An architectural and visual animation evaluation of FlowweJS compared to other major JavaScript frameworks (React, Vue, Svelte, and Lit).

---

## Comparative Scorecard (Scale 1–10)

| Framework | Bundle / Load Speed | Setup & Dev Ergonomics | Layout Animation Fluidity | Memory / CPU Efficiency | Native Web Standards | **Overall Score** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **FlowweJS (Post-Diffing)** | 9.5 | 8.0 | 9.5 | 9.5 | 9.0 | **9.1 / 10** |
| **Svelte** | 9.0 | 9.5 | 9.5 | 9.0 | 8.0 | **9.0 / 10** |
| **Lit** | 9.5 | 7.0 | 5.0 | 9.5 | 10.0 | **8.2 / 10** |
| **Vue.js** | 7.5 | 9.0 | 8.5 | 7.5 | 6.0 | **7.7 / 10** |
| **React** | 5.0 | 8.5 | 6.0 | 5.5 | 4.0 | **5.8 / 10** |

---

## Detailed Visual & Architectural Analysis

### 1. Svelte (The Visual Gold Standard)
* **Bundle / Load Speed (9.0):** Compiles templates at build-time, rendering clean JS modules with a microscopic runtime library footprint.
* **Ergonomics (9.5):** Uses intuitive Single File Components (`.svelte`) containing standard script, HTML, and style blocks.
* **Layout Animation Fluidity (9.5):** Svelte treats animations as first-class core features. It provides a native `animate:flip` layout directive and transition systems compiled directly to highly efficient, hardware-accelerated CSS animations.
* **Standards Alignment (8.0):** Supports compilation output targeting custom web component elements.

### 2. FlowweJS (The Zero-Compile Animation SPA)
* **Bundle / Load Speed (9.5):** Possesses an extremely tiny core footprint (~15KB) that loads almost instantly. On-demand lazy-loading is handled natively.
* **Ergonomics (8.0):** Employs simple, clean templating directive structures (`@for`, `@if`) and utilizes dynamic Custom Elements with no mandatory compilation pipeline.
* **Layout Animation Fluidity (9.5):** Achieves app-like page swaps natively by integrating a FLIP transition manager directly into the core routing system.
* **Standards Alignment (9.0):** Extends native web standards (Custom Elements and Shadow DOM) with minimal abstraction.

### 3. Lit (The Web Component Benchmark)
* **Bundle / Load Speed (9.5):** Serves as a microscopic, highly optimized helper library (~6KB).
* **Ergonomics (7.0):** Relies on tagged template literals (`html```) and shadow trees. The developer experience is greatly enhanced by using decorators, though this introduces compilation requirements.
* **Layout Animation Fluidity (5.0):** Does not offer built-in transition systems or page-swapping animations. Animating layout changes requires importing third-party libraries or writing custom trackers.
* **Standards Alignment (10.0):** Represents the purest execution wrapper around native Web Component interfaces.

### 4. Vue.js (The Hybrid Compiler Framework)
* **Bundle / Load Speed (7.5):** Requires importing a medium-sized runtime parser, but supports robust tree-shaking and script partition splitting.
* **Ergonomics (9.0):** Offers a clean composition API and Single File Components (`.vue`).
* **Layout Animation Fluidity (8.5):** Integrates native `<Transition>` and `<TransitionGroup>` wrappers that manage list transitions and layout swaps cleanly.
* **Standards Alignment (6.0):** Employs a proprietary component structure, though it supports compiling target scripts to custom elements.

### 5. React (The Heavyweight Virtual DOM Engine)
* **Bundle / Load Speed (5.0):** Demands a large core runtime bundle payload (React + ReactDOM), impacting mobile FCP scores.
* **Ergonomics (8.5):** Provides JSX syntax which is highly popular, but requires mandatory bundler build steps (e.g. Webpack, Vite).
* **Layout Animation Fluidity (6.0):** The instant mount/unmount behaviors of the Virtual DOM make layout animations between routes complex, requiring heavy external animation engines (like Framer Motion) that increase execution load.
* **Standards Alignment (4.0):** Operates on a proprietary SyntheticEvent system and custom component definitions, which historically complicates integration with native custom elements.

## Key Core Achievements (FlowweJS vs Svelte & Lit)

### 1. Memory / CPU Efficiency Upgrade (9.5)
By upgrading the rendering engine to use a recursive DOM node patching walk (`patchNode`) instead of raw `innerHTML` replacements:
* **State Preservation:** Text selection, active input cursor positions, and scroll positions of scrollable nodes remain completely intact during re-renders.
* **Garbage Collection (GC) Drop:** Eliminates constant DOM element destruction and creation, drastically lowering runtime memory footprint.
* **Style Recalculation Cut:** The browser avoids full layout recalculations (reflows), updating only the leaf text nodes and altered attributes.

### 2. Svelte-Grade Transitions (9.5)
* **Out-of-the-Box Layout Fluidity:** FlowweJS matches Svelte's transition fluidity by integrating page-morphing FLIP transitions directly inside the core router. It provides the visual impact of Framer Motion (React) at a microscopic runtime cost.

### 3. Lit-Grade Load Speeds (9.5)
* **Direct Script Import:** Same-origin components load via dynamic native dynamic `import(url)` instead of Blobs, keeping the code fully strict-CSP compliant and utilizing browser HTTP caching automatically.

## License

FlowweJS is open-source software licensed under the [MIT license](LICENSE).
