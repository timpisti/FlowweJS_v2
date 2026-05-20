let isDebug = false;
export function setDebugAnimation(value) { isDebug = value; }

export class AnimationController {
  constructor(config = {}) {
    this.oldComponents = new Map();
    this.newComponents = new Map();
    this.animationSpeed = config.animationSpeed || 300;
    this.isCancelled = false;
    this.animationCache = new Map();
  }

  async animateRouteTransition(oldComponentsArray, newComponentsCallback, options = {}) {
    // Reset cancellation flag at the start of each transition
    this.isCancelled = false;

    // Use native View Transitions API when available and enabled
    // Only for non-waitForData routes — the callback must be a fast synchronous DOM swap
    if (window.FlowweJSConfig?.useViewTransition && document.startViewTransition && !options.skipNativeTransition) {
      return this.nativeViewTransition(newComponentsCallback, options);
    }

    // Fallback: manual FLIP animation
    return this.flipRouteTransition(oldComponentsArray, newComponentsCallback, options);
  }

  async nativeViewTransition(newComponentsCallback, options) {
    try {
      if (isDebug) console.log('Using native View Transition API');

      const transition = document.startViewTransition(async () => {
        const newComponentsArray = await newComponentsCallback();
        if (this.isCancelled || !newComponentsArray.length) return;

        // Wait for data-ready components
        await this.waitForComponentsReady(newComponentsArray);

        // Ensure all elements are visible after transition
        newComponentsArray.forEach(component => {
          const animated = component.querySelectorAll('[data-animate]');
          animated.forEach(el => { el.style.opacity = '1'; });
        });
      });

      await transition.finished;
    } catch (error) {
      if (!this.isCancelled) {
        console.error('View transition error:', error);
        // Transition failed — content was still swapped by the callback
      }
    }
  }

  async flipRouteTransition(oldComponentsArray, newComponentsCallback, options) {
    try {
      if (isDebug) console.log('Starting FLIP route transition');

      // Capture old components
      this.oldComponents.clear();
      this.captureComponentInfo(oldComponentsArray, this.oldComponents);
      if (isDebug) this.logComponentsInfo('Old components', this.oldComponents);

      // Get new components
      if (isDebug) console.log('Getting new components');
      const newComponentsArray = await newComponentsCallback();

      if (this.isCancelled || !newComponentsArray.length) return;

      // Wait for components to be ready
      await this.waitForComponentsReady(newComponentsArray);
      if (this.isCancelled) return;

      // Hide new components initially to avoid flickering
      this.hideNewComponents(newComponentsArray);

      // Wait for images to load
      if (isDebug) console.log('Waiting for images to load');
      await this.waitForImagesToLoad(newComponentsArray);
      if (this.isCancelled) return;

      // Capture new components
      this.newComponents.clear();
      this.captureComponentInfo(newComponentsArray, this.newComponents);
      if (isDebug) this.logComponentsInfo('New components', this.newComponents);

      // Log identical components
      if (isDebug) this.logIdenticalComponents();

      // Animate identical components and handle enter/exit animations
      if (isDebug) console.log('Starting animations');
      await this.animateComponents();

      // Clean up after animation
      if (isDebug) console.log('Cleaning up after animation');
      this.cleanupAfterAnimation(newComponentsArray);
    } catch (error) {
      if (!this.isCancelled) {
        console.error('Error during route transition:', error);
        throw error;
      }
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
        element.style.opacity = '0';
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
        if (isDebug) console.log(`Captured info for component ${animateId}:`, rect);
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
            if (isDebug) console.log(`Waiting for image to load: ${img.src}`);
            return new Promise(resolve => {
              img.addEventListener('load', () => {
                if (isDebug) console.log(`Image loaded: ${img.src}`);
                resolve();
              }, { once: true });
              img.addEventListener('error', () => {
                if (isDebug) console.log(`Image failed to load: ${img.src}`);
                resolve();
              }, { once: true });
            });
          } else {
            return Promise.resolve();
          }
        });
      });

      await Promise.all(imageLoadPromises);
      if (isDebug) console.log('All images loaded');
    } catch (error) {
      console.error('Error loading images:', error);
      throw error;
    }
  }

  logComponentsInfo(title, components) {
    console.log(`${title}:`);
    for (const [id, { element, rect }] of components) {
      console.log(`  ${id}: (${rect.x}, ${rect.y}) ${rect.width}x${rect.height}`);
    }
  }

  logIdenticalComponents() {
    for (const [id, oldData] of this.oldComponents) {
      if (this.newComponents.has(id)) {
        const newData = this.newComponents.get(id);
        console.log(`Identical: ${id} (${oldData.rect.x},${oldData.rect.y}) -> (${newData.rect.x},${newData.rect.y})`);
      }
    }
  }

  async animateComponents() {
    if (this.isCancelled) return;

    const animationPromises = [];

    // Handle enter animations for new components that do not exist in old components
    for (const [id, newData] of this.newComponents) {
      if (!this.oldComponents.has(id)) {
        if (isDebug) console.log(`Running enter animation for new component: ${id}`);
        animationPromises.push(this.runEnterAnimation(newData));
      }
    }

    // Handle exit animations for old components that do not exist in new components
    for (const [id, oldData] of this.oldComponents) {
      if (!this.newComponents.has(id)) {
        if (isDebug) console.log(`Running exit animation for old component: ${id}`);
        animationPromises.push(this.runExitAnimation(oldData));
      }
    }

    // Handle animation for components that are moving between old and new positions
    for (const [id, oldData] of this.oldComponents) {
      if (this.newComponents.has(id)) {
        const newData = this.newComponents.get(id);
        if (isDebug) console.log(`Animating component: ${id}`);
        animationPromises.push(this.animateElement(oldData, newData));
      }
    }

    // Wait for all animations to complete
    await Promise.all(animationPromises);
    if (isDebug) console.log('All animations completed');
  }

  runEnterAnimation(newData) {
    if (this.isCancelled) return Promise.resolve();

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
      return new Promise(resolve => {
        setTimeout(() => {
          element.style.opacity = '1';
          resolve();
        }, parseInt(enterAnimationDelay, 10) + parseInt(enterAnimationDuration, 10));
      });
    }
  }

  runExitAnimation(oldData) {
    if (this.isCancelled) return Promise.resolve();

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
      return new Promise(resolve => {
        setTimeout(() => {
          element.style.opacity = '0';
          resolve();
        }, parseInt(exitAnimationDuration, 10));
      });
    }
  }

  animateElement(oldData, newData) {
    if (this.isCancelled) return Promise.resolve();

    const { element: oldElement, rect: oldRect } = oldData;
    const { element: newElement, rect: newRect } = newData;

    // Check if the element (or its child img) has a loaded image to animate.
    // If not, skip FLIP and just show the new element directly.
    const oldImg = oldElement.tagName === 'IMG' ? oldElement : oldElement.querySelector('img');
    const newImg = newElement.tagName === 'IMG' ? newElement : newElement.querySelector('img');
    if ((oldImg && !oldImg.complete) || (newImg && !newImg.complete)) {
      if (isDebug) console.log('Skipping FLIP animation — image not loaded');
      newElement.style.opacity = '1';
      return Promise.resolve();
    }

    if (isDebug) console.log(`Animating element from (${oldRect.x}, ${oldRect.y}) to (${newRect.x}, ${newRect.y})`);

    // Create a clone of the old element for animation
    const clone = oldElement.cloneNode(true);

    // Strip IDs from clone to prevent duplicate ID collisions
    if (clone.id) clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));

    document.body.appendChild(clone);

    // Verify clone image rendered — if the cloned img is empty, abort FLIP
    const cloneImg = clone.tagName === 'IMG' ? clone : clone.querySelector('img');
    if (cloneImg && !cloneImg.complete) {
      clone.remove();
      newElement.style.opacity = '1';
      return Promise.resolve();
    }

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

    return new Promise(resolve => {
      // Show the new element gradually after the animation starts
      setTimeout(() => {
        newElement.style.transition = `opacity ${this.animationSpeed / 3}ms ease-in-out`;
        newElement.style.opacity = '1';
      }, this.animationSpeed - (this.animationSpeed / 3));

      // Remove the clone after animation and resolve
      setTimeout(() => {
        if (clone.parentNode) {
          clone.parentNode.removeChild(clone);
        }
        if (isDebug) console.log('Animation completed for element');
        resolve();
      }, this.animationSpeed);
    });
  }

  cancel() {
    this.isCancelled = true;
  }

  cleanupAfterAnimation(newComponentsArray) {
    if (this.isCancelled) return;

    // Ensure all new elements are visible
    newComponentsArray.forEach(component => {
      const animatedElements = component.querySelectorAll('[data-animate]');
      animatedElements.forEach(element => {
        element.style.opacity = '1';
      });
    });

    // Clear the component maps
    this.oldComponents.clear();
    this.newComponents.clear();
  }
}
