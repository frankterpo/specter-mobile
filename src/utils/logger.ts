// Comprehensive logging system for debugging
// Logs to console AND stores in memory for review

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 500; // Keep last 500 logs

  log(level: LogEntry['level'], category: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output with color coding
    const emoji = {
      info: '📘',
      warn: '⚠️',
      error: '❌',
      debug: '🔍',
    }[level];

    const timestamp = new Date().toLocaleTimeString();
    console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
      `${emoji} [${timestamp}] ${category}: ${message}`,
      data || ''
    );
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    if (__DEV__) {
      this.log('debug', category, message, data);
    }
  }

  getLogs() {
    return [...this.logs];
  }

  getLogsByCategory(category: string) {
    return this.logs.filter(log => log.category === category);
  }

  getRecentErrors(count = 10) {
    return this.logs.filter(log => log.level === 'error').slice(-count);
  }

  clearLogs() {
    this.logs = [];
    console.log('🧹 Logs cleared');
  }

  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = new Logger();

