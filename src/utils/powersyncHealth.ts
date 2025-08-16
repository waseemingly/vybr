import { usePowerSync } from '@/context/PowerSyncContext';

export interface PowerSyncHealthStatus {
  isHealthy: boolean;
  isConnected: boolean;
  isAvailable: boolean;
  platform: string;
  lastSyncTime?: Date;
  syncErrors: string[];
  performance: {
    queryCount: number;
    averageQueryTime: number;
    lastQueryTime: number;
  };
}

export class PowerSyncHealthMonitor {
  private static instance: PowerSyncHealthMonitor;
  private queryCount = 0;
  private queryTimes: number[] = [];
  private syncErrors: string[] = [];
  private lastSyncTime?: Date;

  static getInstance(): PowerSyncHealthMonitor {
    if (!PowerSyncHealthMonitor.instance) {
      PowerSyncHealthMonitor.instance = new PowerSyncHealthMonitor();
    }
    return PowerSyncHealthMonitor.instance;
  }

  recordQuery(duration: number) {
    this.queryCount++;
    this.queryTimes.push(duration);
    
    // Keep only last 100 query times for average calculation
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift();
    }
  }

  recordSyncError(error: string) {
    this.syncErrors.push(error);
    
    // Keep only last 10 errors
    if (this.syncErrors.length > 10) {
      this.syncErrors.shift();
    }
  }

  recordSyncSuccess() {
    this.lastSyncTime = new Date();
  }

  getHealthStatus(platform: string, isConnected: boolean, isAvailable: boolean): PowerSyncHealthStatus {
    const averageQueryTime = this.queryTimes.length > 0 
      ? this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length 
      : 0;

    return {
      isHealthy: isConnected && isAvailable && this.syncErrors.length === 0,
      isConnected,
      isAvailable,
      platform,
      lastSyncTime: this.lastSyncTime,
      syncErrors: [...this.syncErrors],
      performance: {
        queryCount: this.queryCount,
        averageQueryTime,
        lastQueryTime: this.queryTimes[this.queryTimes.length - 1] || 0
      }
    };
  }

  reset() {
    this.queryCount = 0;
    this.queryTimes = [];
    this.syncErrors = [];
    this.lastSyncTime = undefined;
  }
}

// Hook to get PowerSync health status
export function usePowerSyncHealth(): PowerSyncHealthStatus {
  const { isConnected, isPowerSyncAvailable, isMobile, isWeb } = usePowerSync();
  const monitor = PowerSyncHealthMonitor.getInstance();
  
  const platform = isMobile ? 'mobile' : isWeb ? 'web' : 'unknown';
  
  return monitor.getHealthStatus(platform, isConnected, isPowerSyncAvailable);
}

// Utility function to log PowerSync health
export function logPowerSyncHealth() {
  const monitor = PowerSyncHealthMonitor.getInstance();
  const { isConnected, isPowerSyncAvailable, isMobile, isWeb } = usePowerSync();
  const platform = isMobile ? 'mobile' : isWeb ? 'web' : 'unknown';
  
  const health = monitor.getHealthStatus(platform, isConnected, isPowerSyncAvailable);
  
  console.log('🔍 PowerSync Health Check:', {
    status: health.isHealthy ? '✅ Healthy' : '❌ Unhealthy',
    platform: health.platform,
    connected: health.isConnected,
    available: health.isAvailable,
    lastSync: health.lastSyncTime?.toISOString(),
    errorCount: health.syncErrors.length,
    performance: health.performance
  });
  
  if (health.syncErrors.length > 0) {
    console.warn('⚠️ PowerSync Errors:', health.syncErrors);
  }
  
  return health;
} 