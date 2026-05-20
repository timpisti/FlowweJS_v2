class TemplateParser {
    // Stack-based tokenizer/parser for nested @for/@if blocks
    static tokenize(templateText) {
        const tokens = [];
        const controlRegex = /(@for\s*\(\s*(\w+)\s+of\s+([\w.\[\]]+)\s*\)|@endfor|@if\s*\(([^)]+)\)|@else|@endif)/g;
        let match;
        let lastIndex = 0;

        while ((match = controlRegex.exec(templateText)) !== null) {
            if (match.index > lastIndex) {
                tokens.push({ type: 'TEXT', content: templateText.substring(lastIndex, match.index) });
            }

            const tag = match[0];
            if (tag.startsWith('@for')) {
                tokens.push({ type: 'FOR_OPEN', item: match[2], array: match[3] });
            } else if (tag === '@endfor') {
                tokens.push({ type: 'FOR_CLOSE' });
            } else if (tag.startsWith('@if')) {
                tokens.push({ type: 'IF_OPEN', condition: match[4] });
            } else if (tag === '@else') {
                tokens.push({ type: 'ELSE' });
            } else if (tag === '@endif') {
                tokens.push({ type: 'IF_CLOSE' });
            }

            lastIndex = controlRegex.lastIndex;
        }

        if (lastIndex < templateText.length) {
            tokens.push({ type: 'TEXT', content: templateText.substring(lastIndex) });
        }

        return tokens;
    }

    static buildAST(tokens) {
        const root = { type: 'ROOT', children: [] };
        const stack = [root];

        for (const token of tokens) {
            const current = stack[stack.length - 1];

            if (token.type === 'TEXT') {
                current.children.push(token);
            } else if (token.type === 'FOR_OPEN') {
                const node = { type: 'FOR', item: token.item, array: token.array, children: [] };
                current.children.push(node);
                stack.push(node);
            } else if (token.type === 'FOR_CLOSE') {
                if (stack.length > 1) stack.pop();
            } else if (token.type === 'IF_OPEN') {
                const node = { type: 'IF', condition: token.condition, children: [], elseBranch: [] };
                current.children.push(node);
                stack.push(node);
            } else if (token.type === 'ELSE') {
                // Switch from if-branch to else-branch
                const ifNode = stack[stack.length - 1];
                if (ifNode.type === 'IF') {
                    const elseBranch = { type: 'ELSE_BRANCH', children: [] };
                    ifNode.elseBranch = elseBranch;
                    stack.pop();
                    stack.push(elseBranch);
                }
            } else if (token.type === 'IF_CLOSE') {
                if (stack.length > 1) stack.pop();
                // If we were in an ELSE_BRANCH, pop the parent IF too
                if (stack.length > 1 && stack[stack.length - 1].type === 'IF' && stack[stack.length - 1].elseBranch?.type === 'ELSE_BRANCH') {
                    // Already popped correctly
                }
            }
        }

        return root;
    }

    static render(node, data, service) {
        if (!node) return '';

        if (node.type === 'TEXT') {
            return node.content;
        }

        if (node.type === 'ROOT' || node.type === 'ELSE_BRANCH') {
            return node.children.map(child => this.render(child, data, service)).join('');
        }

        if (node.type === 'FOR') {
            // Resolve nested paths (e.g., article.comments) via safeResolve
            const arr = service.safeResolve(node.array, data);
            if (!Array.isArray(arr)) {
                console.error(`Array ${node.array} is not defined or is not an array in data context.`);
                return '';
            }
            return arr.map(elem => {
                const loopData = { [node.item]: elem, ...data };
                return node.children.map(child => this.render(child, loopData, service)).join('');
            }).join('');
        }

        if (node.type === 'IF') {
            if (service.safeEvaluateCondition(node.condition, data)) {
                return node.children.map(child => this.render(child, data, service)).join('');
            } else if (node.elseBranch) {
                const branch = node.elseBranch.type === 'ELSE_BRANCH' ? node.elseBranch : node.elseBranch;
                return branch.children ? branch.children.map(child => this.render(child, data, service)).join('') : '';
            }
            return '';
        }

        return '';
    }
}

class TemplateService {
    constructor() {
        this.eventHandlers = new Map();
		this.templateCache = new Map();
    }

    escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    safeResolve(expression, context) {
        const trimmed = expression.trim();

        // String literal
        if (/^(['"]).*\1$/.test(trimmed)) return trimmed.slice(1, -1);

        // Number literal
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);

        // Boolean/null/undefined
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        if (trimmed === 'null') return null;
        if (trimmed === 'undefined') return undefined;

        // Property path: a.b.c or a.b[0].c
        return trimmed.split('.').reduce((obj, part) => {
            if (obj == null) return undefined;
            // Handle bracket notation: name[index]
            const bracketMatch = part.match(/^(\w+)\[(\d+)\]$/);
            if (bracketMatch) {
                const prop = obj[bracketMatch[1]];
                return prop != null ? prop[parseInt(bracketMatch[2], 10)] : undefined;
            }
            return obj[part];
        }, context);
    }

    safeEvaluateCondition(expression, context) {
        const trimmed = expression.trim();

        // Negation
        if (trimmed.startsWith('!')) {
            return !this.safeEvaluateCondition(trimmed.slice(1), context);
        }

        // || operator (lower precedence — check first)
        const orIndex = this.findOperator(trimmed, '||');
        if (orIndex !== -1) {
            return this.safeEvaluateCondition(trimmed.slice(0, orIndex), context) ||
                   this.safeEvaluateCondition(trimmed.slice(orIndex + 2), context);
        }

        // && operator
        const andIndex = this.findOperator(trimmed, '&&');
        if (andIndex !== -1) {
            return this.safeEvaluateCondition(trimmed.slice(0, andIndex), context) &&
                   this.safeEvaluateCondition(trimmed.slice(andIndex + 2), context);
        }

        // Comparison operators (check multi-char first to avoid partial matches)
        const compOps = ['===', '!==', '>=', '<=', '>', '<'];
        for (const op of compOps) {
            const idx = this.findOperator(trimmed, op);
            if (idx !== -1) {
                const left = this.safeResolve(trimmed.slice(0, idx), context);
                const right = this.safeResolve(trimmed.slice(idx + op.length), context);
                switch (op) {
                    case '===': return left === right;
                    case '!==': return left !== right;
                    case '>=': return left >= right;
                    case '<=': return left <= right;
                    case '>': return left > right;
                    case '<': return left < right;
                }
            }
        }

        // Truthiness check
        return !!this.safeResolve(trimmed, context);
    }

    findOperator(str, op) {
        let inSingle = false, inDouble = false;
        for (let i = 0; i <= str.length - op.length; i++) {
            if (str[i] === "'" && !inDouble) inSingle = !inSingle;
            if (str[i] === '"' && !inSingle) inDouble = !inDouble;
            if (!inSingle && !inDouble && str.substr(i, op.length) === op) {
                // For single-char > and <, skip if part of >= or <=
                if ((op === '>' || op === '<') && str[i + 1] === '=') continue;
                return i;
            }
        }
        return -1;
    }

    interpolate(text, data) {
        // Raw output {{{ }}} — no escaping (process first)
        text = text.replace(/\{\{\{([^}]+)\}\}\}/g, (_, expression) => {
            const value = this.safeResolve(expression, data);
            return value != null ? value : '';
        });
        // Escaped output {{ }} — HTML entities escaped
        text = text.replace(/\{\{([^}]+)\}\}/g, (_, expression) => {
            const value = this.safeResolve(expression, data);
            return value != null ? this.escapeHtml(value) : '';
        });
        return text;
    }

    adoptSharedStyles(shadowRoot) {
        if (!shadowRoot || !window.FlowweSharedStyles || !('adoptedStyleSheets' in shadowRoot)) return;
        // Merge shared styles with any component-specific adopted sheets
        const existing = Array.from(shadowRoot.adoptedStyleSheets || []);
        const shared = window.FlowweSharedStyles.filter(s => !existing.includes(s));
        shadowRoot.adoptedStyleSheets = [...shared, ...existing];
    }

    processTemplate(templateText, component, data = {}) {
        const template = document.createElement('template');

        // Auto-adopt shared styles into shadow DOM
        if (component.shadowRoot) {
            this.adoptSharedStyles(component.shadowRoot);
        }

        // Parse with stack-based parser for proper nesting support
        const tokens = TemplateParser.tokenize(templateText);
        const ast = TemplateParser.buildAST(tokens);
        let processedText = TemplateParser.render(ast, data, this);

        // Interpolate remaining placeholders (raw {{{ }}} then escaped {{ }})
        processedText = this.interpolate(processedText, data);

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

    patchNode(oldNode, newNode) {
        // Text node — update content only if changed
        if (oldNode.nodeType === Node.TEXT_NODE && newNode.nodeType === Node.TEXT_NODE) {
            if (oldNode.textContent !== newNode.textContent) {
                oldNode.textContent = newNode.textContent;
            }
            return;
        }

        // Element node — patch attributes and recurse into children
        if (oldNode.nodeType === Node.ELEMENT_NODE && newNode.nodeType === Node.ELEMENT_NODE) {
            // Update changed/new attributes
            for (const attr of newNode.attributes) {
                if (oldNode.getAttribute(attr.name) !== attr.value) {
                    oldNode.setAttribute(attr.name, attr.value);
                }
            }
            // Remove obsolete attributes
            for (let i = oldNode.attributes.length - 1; i >= 0; i--) {
                const attr = oldNode.attributes[i];
                if (!newNode.hasAttribute(attr.name)) {
                    oldNode.removeAttribute(attr.name);
                }
            }
        }

        // Recurse into children
        const oldChildren = Array.from(oldNode.childNodes);
        const newChildren = Array.from(newNode.childNodes);

        newChildren.forEach((newChild, i) => {
            const oldChild = oldChildren[i];
            if (!oldChild) {
                // New child added
                oldNode.appendChild(newChild.cloneNode(true));
            } else if (oldChild.nodeName !== newChild.nodeName) {
                // Different node type — replace
                oldNode.replaceChild(newChild.cloneNode(true), oldChild);
            } else {
                // Same type — patch recursively
                this.patchNode(oldChild, newChild);
            }
        });

        // Remove trailing old children that no longer exist
        for (let i = newChildren.length; i < oldChildren.length; i++) {
            oldChildren[i].remove();
        }
    }

    rerenderTemplate(component, data) {
        if (!component || !component.template || !component.shadowRoot) {
            console.error('Invalid component or missing template');
            return;
        }

        const templateFragment = this.processTemplate(component.template, component, data);

        // Build a temporary container to hold the new content for diffing
        const tempContainer = document.createElement('div');
        tempContainer.appendChild(templateFragment);

        // Find the existing content root (skip the <style> element)
        const shadowRoot = component.shadowRoot;
        const styleEl = shadowRoot.querySelector('style');
        const oldContentNodes = Array.from(shadowRoot.childNodes).filter(n => n !== styleEl);

        // If there's an existing content wrapper, patch it instead of replacing
        if (oldContentNodes.length > 0 && tempContainer.childNodes.length > 0) {
            // Wrap old content in a virtual root for diffing
            const oldWrapper = document.createElement('div');
            oldContentNodes.forEach(n => oldWrapper.appendChild(n));
            shadowRoot.appendChild(oldWrapper);

            this.patchNode(oldWrapper, tempContainer);

            // Unwrap: move patched children back to shadow root
            while (oldWrapper.firstChild) {
                shadowRoot.insertBefore(oldWrapper.firstChild, oldWrapper);
            }
            oldWrapper.remove();
        } else {
            // First render or empty — fall back to full replacement
            const styleContent = styleEl?.textContent || '';
            shadowRoot.innerHTML = `<style>${styleContent}</style>`;
            shadowRoot.appendChild(templateFragment);
        }

        this.attachEventListeners(shadowRoot, component);
    }
}

window.templateService = new TemplateService();

window.escapeHtml = function(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
