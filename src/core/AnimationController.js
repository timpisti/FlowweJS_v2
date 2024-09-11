export class AnimationController {
  constructor() {
    this.oldComponents = new Map();
    this.newComponents = new Map();
    this.animationSpeed = 300; // Default animation duration in milliseconds
  }

  async animateRouteTransition(oldComponentsArray, newComponentsCallback) {
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
  }

 async waitForComponentsReady(componentsArray) {
    console.log('Checking components for readiness:',componentsArray);
    const readyPromises = componentsArray.map(component => {
      return new Promise(resolve => {
        console.log(`Checking component: ${component.tagName}`);
        console.log(`Has data-wait-for-ready: ${component.hasAttribute('data-wait-for-ready')}`);
        if (component.hasAttribute('data-wait-for-ready')) {
          console.log(`Animation waiting for component: ${component.tagName}`);
          const readyHandler = () => {
            console.log(`Component ready: ${component.tagName}`);
            component.removeEventListener('component-ready', readyHandler);
            resolve();
          };
          component.addEventListener('component-ready', readyHandler);
          // Add a timeout in case the event is never fired
          setTimeout(() => {
            console.log(`Timeout reached for component: ${component.tagName}`);
            resolve();
          }, 5000); // 5 seconds timeout
        } else {
          console.log(`Component doesn't need to wait: ${component.tagName}`);
          resolve();
        }
      });
    });
    await Promise.all(readyPromises);
    console.log('All components are ready');
  }

  hideNewComponents(componentsArray) {
    console.log('Hiding new components to prevent flickering');
    componentsArray.forEach(component => {
      const animatedElements = component.querySelectorAll('[data-animate]');
      animatedElements.forEach(element => {
        element.style.opacity = '0'; // Hide elements initially
      });
    });
  }

  captureComponentInfo(componentsArray, storageMap) {
    console.log('Capturing component info');
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
    console.log('Waiting for images to load');
    const imageLoadPromises = [];
    components.forEach(component => {
      const images = component.querySelectorAll('img[data-animate]');
      images.forEach(img => {
        if (!img.complete) {
          console.log(`Waiting for image to load: ${img.src}`);
          imageLoadPromises.push(new Promise(resolve => {
            img.onload = () => {
              console.log(`Image loaded: ${img.src}`);
              resolve();
            };
            img.onerror = () => {
              console.log(`Image failed to load: ${img.src}`);
              resolve();
            };
          }));
        } else {
          console.log(`Image already loaded: ${img.src}`);
        }
      });
    });
    await Promise.all(imageLoadPromises);
    console.log('All images loaded');
  }

  logComponentsInfo(title, components) {
    console.log(`${title}:`);
    for (const [id, { element, rect }] of components) {
      console.log(`Component ${id}:`);
      console.log(`  Element:`, element);
      console.log(`  Position: (${rect.x}, ${rect.y})`);
      console.log(`  Size: ${rect.width} x ${rect.height}`);
    }
  }

  logIdenticalComponents() {
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
    const { element, animationData } = newData;
    const [ , enterAnimation, enterAnimationDuration, enterAnimationDelay ] = animationData;

    return new Promise(resolve => {
      // Set initial styles for enter animation
      element.style.transition = `all ${enterAnimationDuration}ms ease-in-out ${enterAnimationDelay}ms`;
      element.style.opacity = '0';

      // Apply the enter animation
      setTimeout(() => {
        element.classList.add(enterAnimation);
        element.style.opacity = '1';
        console.log(`Enter animation started for element with ID: ${animationData[0]}`);
      }, parseInt(enterAnimationDelay, 10));

      setTimeout(() => {
        element.classList.remove(enterAnimation);
        console.log(`Enter animation completed for element with ID: ${animationData[0]}`);
        resolve();
      }, parseInt(enterAnimationDuration, 10) + parseInt(enterAnimationDelay, 10));
    });
  }

  runExitAnimation(oldData) {
    const { element, animationData } = oldData;
    const [ , , , , exitAnimation, exitAnimationDuration ] = animationData;

    return new Promise(resolve => {
      // Set initial styles for exit animation
      element.style.transition = `all ${exitAnimationDuration}ms ease-in-out`;
      element.style.opacity = '1';

      // Apply the exit animation
      setTimeout(() => {
        element.classList.add(exitAnimation);
        element.style.opacity = '0';
        console.log(`Exit animation started for element with ID: ${animationData[0]}`);
      }, 0);

      setTimeout(() => {
        element.classList.remove(exitAnimation);
        console.log(`Exit animation completed for element with ID: ${animationData[0]}`);
        resolve();
      }, parseInt(exitAnimationDuration, 10));
    });
  }

  animateElement(oldData, newData) {
    return new Promise((resolve) => {
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
        resolve();
      }, this.animationSpeed);
    });
  }

  cleanupAfterAnimation(newComponentsArray) {
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