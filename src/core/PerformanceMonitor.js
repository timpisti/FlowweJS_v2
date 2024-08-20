export class PerformanceMonitor {
  static markStart(label) {
    performance.mark(`${label}-start`);
  }

  static markEnd(label) {
    performance.mark(`${label}-end`);
    performance.measure(label, `${label}-start`, `${label}-end`);
  }

  static logMeasure(label) {
    const entries = performance.getEntriesByName(label);
    if (entries.length > 0) {
      console.log(`${label}: ${entries[0].duration.toFixed(2)}ms`);
    }
  }

  static clearMeasures() {
    performance.clearMarks();
    performance.clearMeasures();
  }
}