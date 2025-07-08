const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.level = this.getLogLevel();
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  getLogLevel() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    return LOG_LEVELS[envLevel] ?? LOG_LEVELS.INFO;
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...metadata
    };

    if (this.isDevelopment) {
      // Pretty format for development
      const metaStr = Object.keys(metadata).length > 0 
        ? '\n' + JSON.stringify(metadata, null, 2)
        : '';
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    } else {
      // JSON format for production
      return JSON.stringify(logEntry);
    }
  }

  log(level, levelNum, message, metadata) {
    if (levelNum <= this.level) {
      const formatted = this.formatMessage(level, message, metadata);
      
      if (levelNum === LOG_LEVELS.ERROR) {
        console.error(formatted);
      } else if (levelNum === LOG_LEVELS.WARN) {
        console.warn(formatted);
      } else {
        console.log(formatted);
      }
    }
  }

  error(message, metadata = {}) {
    this.log('ERROR', LOG_LEVELS.ERROR, message, metadata);
  }

  warn(message, metadata = {}) {
    this.log('WARN', LOG_LEVELS.WARN, message, metadata);
  }

  info(message, metadata = {}) {
    this.log('INFO', LOG_LEVELS.INFO, message, metadata);
  }

  debug(message, metadata = {}) {
    this.log('DEBUG', LOG_LEVELS.DEBUG, message, metadata);
  }

  // Helper methods for specific use cases
  mcpEvent(serverName, event, metadata = {}) {
    this.info(`MCP ${event}: ${serverName}`, {
      server: serverName,
      event,
      ...metadata
    });
  }

  apiRequest(req, metadata = {}) {
    this.info(`API ${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      ...metadata
    });
  }

  performance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...metadata
    });
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = { logger, Logger };
