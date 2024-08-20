class FlowwejsDarkmodeswitch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.state = {
      darkMode: JSON.parse(window.localStorage.getItem('darkMode') ?? 'false')
    };
	if (this.state.darkMode != false) this.darkmodeOn();
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `<div style="margin-top:4px;" id="toggle-dark-mode">${!this.state.darkMode ? '<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 26 26"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 21a9 9 0 0 1-.5-17.986V3c-.354.966-.5 1.911-.5 3a9 9 0 0 0 9 9c.239 0 .254.018.488 0A9.004 9.004 0 0 1 12 21Z"/></svg>':'<svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="26" height="26" fill="none" viewBox="0 0 26 26"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5V3m0 18v-2M7.05 7.05 5.636 5.636m12.728 12.728L16.95 16.95M5 12H3m18 0h-2M7.05 16.95l-1.414 1.414M18.364 5.636 16.95 7.05M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>'}</div>`;

    this.shadowRoot.querySelector('#toggle-dark-mode').addEventListener('click', () => {
      if (this.state.darkMode) {
        this.darkmodeOff();
      } else {
        this.darkmodeOn();
      }
    });
  }

  darkmodeOn() {
    this.setState({ darkMode: true });
    window.localStorage.setItem('darkMode', 'true');
    document.body.classList.add("dark");
	if (document.getElementById('app')) document.getElementById('app').classList.add("dark");
	document.documentElement.setAttribute('data-theme', 'dark');
	document.documentElement.setAttribute('class', 'dark');
  }

  darkmodeOff() {
    this.setState({ darkMode: false });
    window.localStorage.setItem('darkMode', 'false');
    document.body.classList.remove("dark");
	if (document.getElementById('app')) document.getElementById('app').classList.remove("dark");
	document.documentElement.setAttribute('data-theme', 'light');
	document.documentElement.setAttribute('class', 'light');
  }

  setState(newState) {
    Object.assign(this.state, newState);
    this.render();
  }
}
customElements.define('flowwejs-darkmodeswitch', FlowwejsDarkmodeswitch);

