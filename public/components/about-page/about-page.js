// public/components/about-component/about-component.js
class AboutPage extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <h1>About Flowwe JS</h1>
      <p>Flowwe JS is a custom web component framework with dynamic routing capabilities.</p>
    `;
  }
}

customElements.define('about-page', AboutPage);