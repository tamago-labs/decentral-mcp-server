const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const { logger } = require('./utils/logger');

class MCPClient extends EventEmitter {
  constructor(config, serverName) {
    super();
    this.config = config;
    this.serverName = serverName;
    this.process = null;
    this.requestId = 1;
    this.pendingRequests = new Map();
    this.initialized = false;
    this.buffer = '';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      logger.info(`[MCP Client] Starting server: ${this.config.command} ${this.config.args?.join(' ') || ''}`);
      
      logger.info(`config env: ${JSON.stringify(this.config.env)}`)

      try {
        this.process = spawn(this.config.command, this.config.args || [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd || process.cwd()
        });

        if (!this.process.stdin || !this.process.stdout || !this.process.stderr) {
          return reject(new Error('Failed to setup process streams'));
        }

        // Handle stdout - responses from MCP server
        this.process.stdout.on('data', (data) => {
          this.handleStdout(data);
        });

        // Handle stderr - logs from MCP server
        this.process.stderr.on('data', (data) => {
          logger.debug(`[MCP Client] ${this.serverName} stderr: ${data.toString()}`);
        });

        // Handle process exit
        this.process.on('exit', (code, signal) => {
          logger.info(`[MCP Client] ${this.serverName} exited with code: ${code}, signal: ${signal}`);
          this.cleanup();
        });

        this.process.on('error', (error) => {
          logger.error(`[MCP Client] ${this.serverName} process error:`, error);
          reject(error);
        });

        // Initialize the connection
        this.initialize()
          .then(() => {
            this.initialized = true;
            logger.info(`[MCP Client] ${this.serverName} initialized successfully`);
            resolve();
          })
          .catch(reject);

      } catch (error) {
        logger.error(`[MCP Client] Failed to spawn process for ${this.serverName}:`, error);
        reject(error);
      }
    });
  }

  handleStdout(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line.trim());
          this.handleResponse(response);
        } catch (error) {
          logger.error(`[MCP Client] ${this.serverName} - Failed to parse response:`, error, 'Line:', line);
        }
      }
    }
  }

  async initialize() {
    const initRequest = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: "mcp-railway-service",
          version: "1.0.0"
        }
      }
    };

    logger.debug(`[MCP Client] ${this.serverName} - Initializing connection...`);
    await this.sendRequest(initRequest);

    // Send initialized notification
    const initializedNotification = {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    };

    await this.sendNotification(initializedNotification);
    logger.debug(`[MCP Client] ${this.serverName} - Connection initialized`);
  }

  async listTools() {
    if (!this.initialized) {
      throw new Error(`Client ${this.serverName} not initialized`);
    }

    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "tools/list"
    };

    const response = await this.sendRequest(request);
    return response.result?.tools || [];
  }

  async callTool(name, arguments_) {
    if (!this.initialized) {
      throw new Error(`Client ${this.serverName} not initialized`);
    }

    logger.debug(`[MCP Client] ${this.serverName} - Calling tool: ${name}`, { arguments: arguments_ });

    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "tools/call",
      params: {
        name,
        arguments: arguments_
      }
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  async listResources() {
    if (!this.initialized) {
      throw new Error(`Client ${this.serverName} not initialized`);
    }

    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "resources/list"
    };

    const response = await this.sendRequest(request);
    return response.result?.resources || [];
  }

  async readResource(uri) {
    if (!this.initialized) {
      throw new Error(`Client ${this.serverName} not initialized`);
    }

    const request = {
      jsonrpc: "2.0",
      id: this.getNextRequestId(),
      method: "resources/read",
      params: { uri }
    };

    const response = await this.sendRequest(request);
    return response.result;
  }

  getNextRequestId() {
    return this.requestId++;
  }

  async sendRequest(request) {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        return reject(new Error(`Process stdin not available for ${this.serverName}`));
      }

      const id = request.id;
      this.pendingRequests.set(id, { resolve, reject });

      const requestStr = JSON.stringify(request) + '\n';
      logger.debug(`[MCP Client] ${this.serverName} - Sending request:`, request);
      
      this.process.stdin.write(requestStr, 'utf8', (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(new Error(`Failed to write to ${this.serverName}: ${error.message}`));
        }
      });

      // Set timeout for requests
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request ${id} to ${this.serverName} timed out`));
        }
      }, 30000); // 30 second timeout
    });
  }

  async sendNotification(notification) {
    if (!this.process?.stdin) {
      throw new Error(`Process stdin not available for ${this.serverName}`);
    }

    const notificationStr = JSON.stringify(notification) + '\n';
    logger.debug(`[MCP Client] ${this.serverName} - Sending notification:`, notification);
    
    return new Promise((resolve, reject) => {
      this.process.stdin.write(notificationStr, 'utf8', (error) => {
        if (error) {
          reject(new Error(`Failed to send notification to ${this.serverName}: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  handleResponse(response) {
    logger.debug(`[MCP Client] ${this.serverName} - Received response:`, response);

    if (response.id && this.pendingRequests.has(response.id)) {
      const { resolve, reject } = this.pendingRequests.get(response.id);
      this.pendingRequests.delete(response.id);

      if (response.error) {
        reject(new Error(`MCP Error from ${this.serverName}: ${JSON.stringify(response.error)}`));
      } else {
        resolve(response);
      }
    } else if (response.method) {
      // Handle notifications from server
      logger.debug(`[MCP Client] ${this.serverName} - Received notification: ${response.method}`);
      this.emit('notification', response);
    }
  }

  async disconnect() {
    if (this.initialized) {
      try {
        const shutdownRequest = {
          jsonrpc: "2.0",
          id: this.getNextRequestId(),
          method: "shutdown"
        };

        await this.sendRequest(shutdownRequest);
        logger.debug(`[MCP Client] ${this.serverName} - Shutdown request sent`);
      } catch (error) {
        logger.error(`[MCP Client] ${this.serverName} - Error during shutdown:`, error);
      }
    }

    this.cleanup();
  }

  cleanup() {
    if (this.process) {
      this.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if process doesn't exit
      setTimeout(() => {
        if (this.process && !this.process.killed) {
          logger.warn(`[MCP Client] ${this.serverName} - Force killing process`);
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      this.process = null;
    }
    
    // Reject all pending requests
    for (const [id, { reject }] of this.pendingRequests) {
      reject(new Error(`Connection to ${this.serverName} closed`));
    }
    this.pendingRequests.clear();
    
    this.initialized = false;
    this.emit('disconnected');
  }

  isConnected() {
    return this.initialized && this.process !== null && !this.process.killed;
  }

  getServerName() {
    return this.serverName;
  }

  getStatus() {
    return {
      serverName: this.serverName,
      connected: this.isConnected(),
      initialized: this.initialized,
      pendingRequests: this.pendingRequests.size,
      pid: this.process?.pid || null
    };
  }
}

module.exports = { MCPClient };
