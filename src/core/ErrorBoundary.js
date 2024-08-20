export class ErrorBoundary {
  static init() {
    window.addEventListener('error', this.handleError);
    window.addEventListener('unhandledrejection', this.handlePromiseRejection);
  }

  static handleError(event) {
    console.error('Caught by Error Boundary:', event.error);
    // You can implement custom error handling here, such as displaying an error message to the user
    event.preventDefault();
  }

  static handlePromiseRejection(event) {
    console.error('Unhandled Promise Rejection:', event.reason);
    // Handle unhandled promise rejections
    event.preventDefault();
  }
}