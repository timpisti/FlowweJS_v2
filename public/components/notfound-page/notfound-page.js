class NotfoundPage extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h1 class="text-6xl font-bold mb-4">404</h1>
        <p class="text-xl text-gray-600 dark:text-gray-400 mb-6">Page not found</p>
        <a href="/" data-link class="text-blue-600 hover:text-blue-800 text-lg">Back to Home</a>
      </div>
    `;
  }
}

customElements.define('notfound-page', NotfoundPage);
