class TemplateService {
    constructor() {
        this.eventHandlers = new Map();
		this.templateCache = new Map();
    }

    processTemplate(templateText, component, data = {}) {
        const template = document.createElement('template');
        let processedText = templateText;

        const evaluateWithContext = (expression, context) => {
            try {
                return new Function(...Object.keys(context), `return ${expression};`)(...Object.values(context));
            } catch (e) {
                console.error(`Error evaluating condition: ${expression}`, e);
                return '';
            }
        };

        // Process loops
        processedText = processedText.replace(/@for\s*\((\w+)\s+of\s+(\w+)\)([\s\S]*?)@endfor/g, (_, item, array, loopContent) => {
            if (!Array.isArray(data[array])) {
                console.error(`Array ${array} is not defined or is not an array in data context.`);
                return '';
            }
            return data[array].map(elem => {
                let loopProcessedContent = loopContent;
                loopProcessedContent = loopProcessedContent.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
                    const context = { [item]: elem, ...data };
                    return evaluateWithContext(expression, context);
                });
                return loopProcessedContent;
            }).join('');
        });

        // Process conditional statements
        processedText = processedText.replace(/@if\s*\(([^)]+)\)([\s\S]*?)@else([\s\S]*?)@endif/g, (_, condition, ifContent, elseContent) => {
            return evaluateWithContext(condition, data) ? ifContent : elseContent;
        });

        processedText = processedText.replace(/@if\s*\(([^)]+)\)([\s\S]*?)@endif/g, (_, condition, ifContent) => {
            return evaluateWithContext(condition, data) ? ifContent : '';
        });

        // Process placeholders
        processedText = processedText.replace(/\{\{(\w+(\.\w+)*)\}\}/g, (_, key) => {
            const keys = key.split('.');
            let value = data;
            keys.forEach(k => value = value ? value[k] : '');
            return value || '';
        });

        // Translate directive
        processedText = processedText.replace(/translate(?!-translate)/g, 'data-translate');

        // Store event handlers
        this.eventHandlers.set(component, []);
        processedText = processedText.replace(/\((\w+)\)="(\w+)\(([^)]*)\)"/g, (_, event, func, params) => {
            const handlerId = `handler_${this.eventHandlers.get(component).length}`;
            this.eventHandlers.get(component).push({ event, func, params, handlerId });
            return `data-event-handler-id="${handlerId}"`;
        });

        template.innerHTML = processedText;
        const content = template.content.cloneNode(true);
		
        this.attachEventListeners(content, component);

        return content;
    }

    attachEventListeners(content, component) {
        const handlers = this.eventHandlers.get(component) || [];
        handlers.forEach(({ event, func, params, handlerId }) => {
            const element = content.querySelector(`[data-event-handler-id="${handlerId}"]`);
            if (element && typeof component[func] === 'function') {
                element.removeAttribute('data-event-handler-id');
                element.addEventListener(event, (e) => {
                    e.preventDefault();
                    component[func].apply(component, params ? params.split(',').map(param => param.trim()) : []);
                });
            }
        });
    }

    rerenderTemplate(component, data) {
        if (!component || !component.template || !component.shadowRoot) {
            console.error('Invalid component or missing template');
            return;
        }

        const templateFragment = this.processTemplate(component.template, component, data);
        
        const styleContent = component.shadowRoot.querySelector('style')?.textContent || '';
        component.shadowRoot.innerHTML = `<style>${styleContent}</style>`;
        component.shadowRoot.appendChild(templateFragment);

        this.attachEventListeners(component.shadowRoot, component);
    }
}

window.templateService = new TemplateService();

