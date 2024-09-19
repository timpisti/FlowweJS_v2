export class AnimationController {
  constructor(config = {}) {
    this.oldComponents = new Map();
    this.newComponents = new Map();
    this.animationSpeed = config.animationSpeed || 300;
    this.isCancelled = false;
    this.animationCache = new Map();
  }
  async animateRouteTransition(oldComponentsArray, newComponentsCallback) {
    if (this.isCancelled) return;

    try {
      console.log('Starting route transition');

      // Capture old components
      this.oldComponents.clear();
      this.captureComponentInfo(oldComponentsArray, this.oldComponents);
      this.logComponentsInfo('Old components', this.oldComponents);

      // Get new components
      console.log('Getting new components');
      const newComponentsArray = await newComponentsCallback();

      // Wait for components to be ready
      await this.waitForComponentsReady(newComponentsArray);

      // Hide new components initially to avoid flickering
      this.hideNewComponents(newComponentsArray);

      // Wait for images to load
      console.log('Waiting for images to load');
      await this.waitForImagesToLoad(newComponentsArray);

      // Capture new components
      this.newComponents.clear();
      this.captureComponentInfo(newComponentsArray, this.newComponents);
      this.logComponentsInfo('New components', this.newComponents);

      // Log identical components
      this.logIdenticalComponents();

      // Animate identical components and handle enter/exit animations
      console.log('Starting animations');
      await this.animateComponents();

      // Clean up after animation
      console.log('Cleaning up after animation');
      this.cleanupAfterAnimation(newComponentsArray);
    } catch (error) {
      console.error('Error during route transition:', error);
      throw error;
    }
  }

  async waitForComponentsReady(componentsArray) {
    if (this.isCancelled) return;

    const readyPromises = componentsArray.map(async component => {
      if (component.hasAttribute('data-wait-for-ready')) {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 5000);

        try {
          await new Promise((resolve, reject) => {
            const readyHandler = () => {
              clearTimeout(timeoutId);
              resolve();
            };
            component.addEventListener('component-ready', readyHandler, { once: true });
            abortController.signal.addEventListener('abort', () => {
              component.removeEventListener('component-ready', readyHandler);
              reject(new Error('Component ready timeout'));
            });
          });
        } catch (error) {
          console.warn(`Timeout reached for component: ${component.tagName}`);
        }
      }
    });

    await Promise.all(readyPromises);
  }

  hideNewComponents(componentsArray) {
    if (this.isCancelled) return;

    componentsArray.forEach(component => {
      const animatedElements = component.querySelectorAll('[data-animate]');
      animatedElements.forEach(element => {
        element.style.opacity = '0'; // Hide elements initially
      });
    });
  }

  captureComponentInfo(componentsArray, storageMap) {
    if (this.isCancelled) return;

    componentsArray.forEach(component => {
      const animatedElements = component.querySelectorAll('[data-animate]');
      animatedElements.forEach(element => {
        const animateId = element.getAttribute('data-animate').split(',')[0];
        const rect = element.getBoundingClientRect();
        storageMap.set(animateId, {
          element,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          animationData: element.getAttribute('data-animate').split(',')
        });
        console.log(`Captured info for component ${animateId}:`, rect);
      });
    });
  }

  async waitForImagesToLoad(components) {
    if (this.isCancelled) return;

    try {
      const imageLoadPromises = components.flatMap(component => {
        const images = component.querySelectorAll('img[data-animate]');
        return Array.from(images).map(img => {
          if (!img.complete) {
            console.log(`Waiting for image to load: ${img.src}`);
            return new Promise((resolve, reject) => {
              img.onload = () => {
                console.log(`Image loaded: ${img.src}`);
                resolve();
              };
              img.onerror = () => {
                console.log(`Image failed to load: ${img.src}`);
                resolve();
              };
              img.addEventListener('load', () => resolve());
              img.addEventListener('error', () => resolve());
            });
          } else {
            console.log(`Image already loaded: ${img.src}`);
            return Promise.resolve();
          }
        });
      });

      await Promise.all(imageLoadPromises);
      console.log('All images loaded');
    } catch (error) {
      console.error('Error loading images:', error);
      throw error;
    }
  }

  logComponentsInfo(title, components) {
    if (this.isCancelled) return;

    console.log(`${title}:`);
    for (const [id, { element, rect }] of components) {
      console.log(`Component ${id}:`);
      console.log(`  Element:`, element);
      console.log(`  Position: (${rect.x}, ${rect.y})`);
      console.log(`  Size: ${rect.width} x ${rect.height}`);
    }
  }

  logIdenticalComponents() {
    if (this.isCancelled) return;

    console.log('Logging identical components:');
    for (const [id, oldData] of this.oldComponents) {
      if (this.newComponents.has(id)) {
        const newData = this.newComponents.get(id);
        console.log(`Identical component found: ${id}`);
        console.log('Old element:', id, oldData.element);
        console.log('Old position:', id, `(${oldData.rect.x}, ${oldData.rect.y})`);
        console.log('Old size:', id, `${oldData.rect.width} x ${oldData.rect.height}`);
        console.log('New element:', id, newData.element);
        console.log('New position:', id, `(${newData.rect.x}, ${newData.rect.y})`);
        console.log('New size:', id, `${newData.rect.width} x ${newData.rect.height}`);
      }
    }
  }

  async animateComponents() {
    if (this.isCancelled) return;

    const animationPromises = [];

    // Handle enter animations for new components that do not exist in old components
    for (const [id, newData] of this.newComponents) {
      if (!this.oldComponents.has(id)) {
        console.log(`Running enter animation for new component: ${id}`);
        const enterAnimationPromise = this.runEnterAnimation(newData);
        animationPromises.push(enterAnimationPromise);
      }
    }

    // Handle exit animations for old components that do not exist in new components
    for (const [id, oldData] of this.oldComponents) {
      if (!this.newComponents.has(id)) {
        console.log(`Running exit animation for old component: ${id}`);
        const exitAnimationPromise = this.runExitAnimation(oldData);
        animationPromises.push(exitAnimationPromise);
      }
    }

    // Handle animation for components that are moving between old and new positions
    for (const [id, oldData] of this.oldComponents) {
      if (this.newComponents.has(id)) {
        const newData = this.newComponents.get(id);
        console.log(`Animating component: ${id}`);
        const animationPromise = this.animateElement(oldData, newData);
        animationPromises.push(animationPromise);
      }
    }

    // Wait for all animations to complete
    await Promise.all(animationPromises);
    console.log('All animations completed');
  }

  runEnterAnimation(newData) {
    if (this.isCancelled) return;

    const { element, animationData } = newData;
    const [, enterAnimation, enterAnimationDuration, enterAnimationDelay] = animationData;

    if ('animate' in Element.prototype) {
      return element.animate([
        { opacity: 0 },
        { opacity: 1 }
      ], {
        duration: parseInt(enterAnimationDuration, 10),
        delay: parseInt(enterAnimationDelay, 10),
        easing: 'ease-in-out',
        fill: 'forwards'
      }).finished;
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          element.style.opacity = '1';
          resolve();
        }, parseInt(enterAnimationDelay, 10) + parseInt(enterAnimationDuration, 10));
      });
    }
  }

  runExitAnimation(oldData) {
    if (this.isCancelled) return;

    const { element, animationData } = oldData;
    const [, , , , exitAnimation, exitAnimationDuration] = animationData;

    if ('animate' in Element.prototype) {
      return element.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], {
        duration: parseInt(exitAnimationDuration, 10),
        easing: 'ease-in-out',
        fill: 'forwards'
      }).finished;
    } else {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          element.style.opacity = '0';
          resolve();
        }, parseInt(exitAnimationDuration, 10));
      });
    }
  }

  async animateElement(oldData, newData) {
    if (this.isCancelled) return;

    const { element: oldElement, rect: oldRect } = oldData;
    const { element: newElement, rect: newRect } = newData;

    console.log(`Animating element from (${oldRect.x}, ${oldRect.y}) to (${newRect.x}, ${newRect.y})`);

    // Create a clone of the old element for animation
    const clone = oldElement.cloneNode(true);
    document.body.appendChild(clone);

    // Set initial position and size
    clone.style.position = 'fixed';
    clone.style.left = `${oldRect.x}px`;
    clone.style.top = `${oldRect.y}px`;
    clone.style.width = `${oldRect.width}px`;
    clone.style.height = `${oldRect.height}px`;
    clone.style.margin = '0';
    clone.style.transition = `all ${this.animationSpeed}ms ease-in-out`;
    clone.style.zIndex = '9999';

    // Force a reflow
    clone.offsetHeight;

    // Set final position and size
    clone.style.left = `${newRect.x}px`;
    clone.style.top = `${newRect.y}px`;
    clone.style.width = `${newRect.width}px`;
    clone.style.height = `${newRect.height}px`;

    // Show the new element gradually after the animation starts
    setTimeout(() => {
      newElement.style.transition = `opacity ${this.animationSpeed / 3}ms ease-in-out`;
      newElement.style.opacity = '1';
    }, this.animationSpeed - (this.animationSpeed / 3));

    // Remove the clone after animation
    setTimeout(() => {
      document.body.removeChild(clone);
      console.log(`Animation completed for element`);
    }, this.animationSpeed);
  }

  cancel() {
    this.isCancelled = true;
    // Implement cancellation logic in individual animation methods
  }

  cleanupAfterAnimation(newComponentsArray) {
    if (this.isCancelled) return;

    // Ensure all new elements are visible
    newComponentsArray.forEach(component => {
      const animatedElements = component.querySelectorAll('[data-animate]');
      animatedElements.forEach(element => {
        element.style.opacity = '1';
        console.log(`Showing new element: ${element.getAttribute('data-animate')}`);
      });
    });

    // Clear the component maps
    this.oldComponents.clear();
    this.newComponents.clear();
    console.log('Cleared component maps');
  }
}