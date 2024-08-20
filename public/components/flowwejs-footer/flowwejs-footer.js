class FlowwejsFooter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
		this.filebasename='flowwejs-footer';
        this.data = {
            expression: 'value', // example initial value
            items: ['item1', 'item2', 'item3'], // example items array
            title: 'title itt',
            description: 'description itt'
        };
    }

    async connectedCallback() {
        const services = JSON.parse(this.getAttribute('flowservices') || '[]');
        const fetchURL = this.getAttribute('fetchURL') || window.FlowweJSConfig.componentFetchUrl;

        try {
        const services = JSON.parse(this.getAttribute('flowservices') || '[]');
        const fetchURL = this.getAttribute('fetchURL') || window.FlowweJSConfig.componentFetchUrl;
        const templateResponse = await fetch(`${fetchURL}/${this.filebasename}/${this.filebasename}.html`);
        const templateText = await templateResponse.text();
        const styleResponse = await fetch(`${fetchURL}/${this.filebasename}/${this.filebasename}.css`);
        const styleText = await styleResponse.text();

        const templateService = window.templateService;
        
        this.template = templateText; // Store the template text for updates
        const template = templateService.processTemplate(this.template, this, this.data);

        const style = document.createElement('style');
        style.textContent = styleText;

        this.shadowRoot.innerHTML = ''; // Clear existing content

        this.shadowRoot.appendChild(style);
        this.shadowRoot.appendChild(template);

            if (services.includes('configService')) {
                this.loadConfig();
            }

            this.subscribeToRxJS();
            
                if (window.translateService) window.translateService.reinit(this.shadowRoot);
        } catch (error) {
            console.error('Error loading template or styles:', error);
        }
    }

    loadConfig() {
        const configURL = this.getAttribute('configURL') || `${fetchURL}/${this.filebasename}/${this.filebasename}.config.json`;
        fetch(configURL)
            .then(response => response.json())
            .then(config => {
                // Merge configuration
                Object.assign(this.data, config);
            });
    }

    subscribeToRxJS() {
        if (window.rxjsService) {
            window.rxjsService.subscribe(data => {
                this.updateContent(data);
            });
        }
    }

    updateContent(data) {
        const templateService = window.templateService;
        this.data = data;
        const templateFragment = templateService.processTemplate(this.template, this, data);

        // Convert DocumentFragment to string
        const temporaryContainer = document.createElement('div');
        temporaryContainer.appendChild(templateFragment);
        const processedTemplateHTML = temporaryContainer.innerHTML;

        // Combine style and template as strings and set innerHTML
        const styleContent = this.shadowRoot.querySelector('style').textContent;
        const combinedContent = `<style>${styleContent}</style>${processedTemplateHTML}`;
        this.shadowRoot.innerHTML = combinedContent;

        // Ensure translations are applied after content is rendered
        if (window.translateService) window.translateService.reinit(this.shadowRoot);
            
        
    }
	

}

customElements.define('flowwejs-footer', FlowwejsFooter);
