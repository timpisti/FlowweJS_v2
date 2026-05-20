export class ErrorBoundary {
  static init() {
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  static handleError(event) {
    console.error('Caught by Error Boundary:', event.error);
    ErrorBoundary.showErrorUI(event.error?.message || 'An unexpected error occurred');
    event.preventDefault();
  }

  static handlePromiseRejection(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
    ErrorBoundary.showErrorUI(event.reason?.message || 'An unhandled promise rejection occurred');
    event.preventDefault();
  }

  static showErrorUI(message) {
    if (!window.FlowweJSConfig?.errorDisplaying) return;

    // Avoid duplicate error banners
    const existing = document.getElementById('flowwe-error-banner');
    if (existing) existing.remove();

    const banner = document.createElement('div');
    banner.id = 'flowwe-error-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:12px 16px;background:#dc2626;color:#fff;font-family:system-ui,sans-serif;font-size:14px;display:flex;justify-content:space-between;align-items:center;';

    // Use textContent to prevent XSS — never innerHTML with untrusted message
    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    banner.appendChild(msgSpan);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u00d7';
    closeBtn.style.cssText = 'background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:0 0 0 16px;';
    closeBtn.addEventListener('click', () => banner.remove());
    banner.appendChild(closeBtn);

    document.body.appendChild(banner);

    // Auto-dismiss after 8 seconds
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
  }
}
