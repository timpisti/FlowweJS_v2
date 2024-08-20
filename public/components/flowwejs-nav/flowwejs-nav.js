class FlowwejsNav extends HTMLElement {
  constructor() {
    super();
    console.log('FlowwejsNav constructor called');
  }
  
  connectedCallback() {
    console.log('FlowwejsNav connected');
    this.render();
  }

  render() {
    console.log('FlowwejsNav rendering');
    this.innerHTML = `
    <nav class="flex items-center justify-between w-full">
		<div class="flex-shrink flex items-center justify-center m-2">
		<a href="/" data-link class="flex items-center space-x-3 rtl:space-x-reverse mx-2">
            <img src="https://flowwe.4i.hu/assets/icons/android-chrome-36x36.png" class="h-8 rounded-md" alt="Flowwe Logo" />
            <span class="text-2xl font-semibold whitespace-nowrap dark:text-white">Flowwe</span>
        </a>
			
			<a href="/" class="text-2xl mx-1" data-link>Articles</a>
			<a href="/authors" class="text-2xl mx-1" data-link>Authors</a>
			
		</div>
        <div class="flex items-center md:order-2 space-x-1 md:space-x-2 rtl:space-x-reverse">
			<flowwejs-darkmodeswitch></flowwejs-darkmodeswitch>
		</div>
    </nav>    `;
    console.log('FlowwejsNav render complete');
  }
}

customElements.define('flowwejs-nav', FlowwejsNav);