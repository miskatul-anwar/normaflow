/**
 * Enhanced Frontend Logger
 * Author: miskatul-anwar
 * Date: 2025-08-09 03:34:38 UTC
 */

export interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARN' | 'DEBUG';
  message: string;
  data?: any;
  category?: string;
}

export class Logger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000; // Prevent memory issues

  /**
   * Log an info message
   */
  info(message: string, data?: any, category?: string): void {
    this.addLog('INFO', message, data, category);
  }

  /**
   * Log a success message
   */
  success(message: string, data?: any, category?: string): void {
    this.addLog('SUCCESS', message, data, category);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: any, category?: string): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : undefined;
    
    this.addLog('ERROR', message, errorData, category);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any, category?: string): void {
    this.addLog('WARN', message, data, category);
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any, category?: string): void {
    this.addLog('DEBUG', message, data, category);
  }

  /**
   * Add a log entry
   */
  private addLog(level: LogEntry['level'], message: string, data?: any, category?: string): void {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      category
    };

    this.logs.push(logEntry);

    // Maintain log size limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output with appropriate method
    const formattedMessage = `[${logEntry.timestamp}] [${level}] ${message}`;
    
    switch (level) {
      case 'ERROR':
        console.error(formattedMessage, data);
        break;
      case 'WARN':
        console.warn(formattedMessage, data);
        break;
      case 'DEBUG':
        console.debug(formattedMessage, data);
        break;
      case 'SUCCESS':
      case 'INFO':
      default:
        console.log(formattedMessage, data);
        break;
    }
  }

  /**
   * Get all logs as formatted strings
   */
  getLogs(): string[] {
    return this.logs.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const category = log.category ? `[${log.category}] ` : '';
      const dataStr = log.data ? ` - ${JSON.stringify(log.data)}` : '';
      return `[${timestamp}] [${log.level}] ${category}${log.message}${dataStr}`;
    });
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogEntry['level']): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get logs filtered by category
   */
  getLogsByCategory(category: string): LogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get recent logs (last N entries)
   */
  getRecentLogs(count: number = 50): string[] {
    return this.getLogs().slice(-count);
  }

  /**
   * Get formatted logs for display
   */
  getFormattedLogs(): Array<{ timestamp: string; level: string; message: string; colorClass: string }> {
    return this.logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      message: log.message,
      colorClass: log.level.toLowerCase()
    }));
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Export logs as text
   */
  exportLogsAsText(): string {
    const header = `Database Normalization Process Log
Generated: ${new Date().toISOString()}
Total Entries: ${this.logs.length}
${'='.repeat(80)}\n\n`;

    const logEntries = this.logs.map(log => {
      const dataStr = log.data ? `\nData: ${JSON.stringify(log.data, null, 2)}` : '';
      const categoryStr = log.category ? ` [${log.category}]` : '';
      return `[${log.timestamp}] [${log.level}]${categoryStr} ${log.message}${dataStr}`;
    }).join('\n\n');

    return header + logEntries;
  }

  /**
   * Get log statistics
   */
  getLogStats(): {
    total: number;
    byLevel: { [key: string]: number };
    byCategory: { [key: string]: number };
    timeRange: { start: string; end: string } | null;
  } {
    const stats = {
      total: this.logs.length,
      byLevel: {} as { [key: string]: number },
      byCategory: {} as { [key: string]: number },
      timeRange: null as { start: string; end: string } | null
    };

    if (this.logs.length === 0) return stats;

    // Count by level
    for (const log of this.logs) {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      
      if (log.category) {
        stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
      }
    }

    // Time range
    const timestamps = this.logs.map(log => log.timestamp).sort();
    stats.timeRange = {
      start: timestamps[0],
      end: timestamps[timestamps.length - 1]
    };

    return stats;
  }

  /**
   * Log processing step with timing
   */
  logStep(stepName: string, operation: () => any): any {
    const startTime = Date.now();
    this.info(`Starting: ${stepName}`, undefined, 'STEP');
    
    try {
      const result = operation();
      const duration = Date.now() - startTime;
      this.success(`Completed: ${stepName} (${duration}ms)`, undefined, 'STEP');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${stepName} (${duration}ms)`, error, 'STEP');
      throw error;
    }
  }

  /**
   * Log async processing step with timing
   */
  async logAsyncStep(stepName: string, operation: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    this.info(`Starting: ${stepName}`, undefined, 'ASYNC_STEP');
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.success(`Completed: ${stepName} (${duration}ms)`, undefined, 'ASYNC_STEP');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.error(`Failed: ${stepName} (${duration}ms)`, error, 'ASYNC_STEP');
      throw error;
    }
  }

  /**
   * Set maximum number of logs to keep in memory
   */
  setMaxLogs(maxLogs: number): void {
    this.maxLogs = Math.max(100, maxLogs); // Minimum of 100 logs
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }
}