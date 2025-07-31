// Performance monitoring utility for tracking loading times and bottlenecks

interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private enabled: boolean = __DEV__; // Only enable in development

  startTimer(name: string, metadata?: Record<string, any>): void {
    if (!this.enabled) return;
    
    this.metrics.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
    
    console.log(`⏱️ [Performance] Started: ${name}`, metadata);
  }

  endTimer(name: string, additionalMetadata?: Record<string, any>): number | null {
    if (!this.enabled) return null;
    
    const metric = this.metrics.get(name);
    if (!metric) {
      console.warn(`⏱️ [Performance] Timer not found: ${name}`);
      return null;
    }

    metric.endTime = performance.now();
    metric.duration = metric.endTime - metric.startTime;
    
    if (additionalMetadata) {
      metric.metadata = { ...metric.metadata, ...additionalMetadata };
    }

    console.log(`⏱️ [Performance] Completed: ${name} in ${metric.duration.toFixed(2)}ms`, metric.metadata);
    
    // Remove the metric to prevent memory leaks
    this.metrics.delete(name);
    
    return metric.duration;
  }

  getTimer(name: string): PerformanceMetric | null {
    return this.metrics.get(name) || null;
  }

  clearTimers(): void {
    this.metrics.clear();
  }

  // Utility method for async operations
  async timeAsync<T>(name: string, operation: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
    this.startTimer(name, metadata);
    try {
      const result = await operation();
      this.endTimer(name, { success: true });
      return result;
    } catch (error: any) {
      this.endTimer(name, { success: false, error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  // Utility method for synchronous operations
  timeSync<T>(name: string, operation: () => T, metadata?: Record<string, any>): T {
    this.startTimer(name, metadata);
    try {
      const result = operation();
      this.endTimer(name, { success: true });
      return result;
    } catch (error: any) {
      this.endTimer(name, { success: false, error: error?.message || 'Unknown error' });
      throw error;
    }
  }
}

// Create a singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export const startTimer = (name: string, metadata?: Record<string, any>) => 
  performanceMonitor.startTimer(name, metadata);

export const endTimer = (name: string, additionalMetadata?: Record<string, any>) => 
  performanceMonitor.endTimer(name, additionalMetadata);

export const timeAsync = <T>(name: string, operation: () => Promise<T>, metadata?: Record<string, any>) => 
  performanceMonitor.timeAsync(name, operation, metadata);

export const timeSync = <T>(name: string, operation: () => T, metadata?: Record<string, any>) => 
  performanceMonitor.timeSync(name, operation, metadata);

// React hook for component performance monitoring
export const usePerformanceTimer = (componentName: string) => {
  const startComponentTimer = () => {
    startTimer(`${componentName}-render`);
  };

  const endComponentTimer = (metadata?: Record<string, any>) => {
    endTimer(`${componentName}-render`, metadata);
  };

  return { startComponentTimer, endComponentTimer };
}; 