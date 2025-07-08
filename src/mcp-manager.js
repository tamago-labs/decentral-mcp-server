const { MCPClient } = require('./mcp-client');
const { logger } = require('./utils/logger');

class MCPManager {
  constructor() {
    this.clients = new Map();
    this.configs = new Map();
    this.registerDefaultServers();
  }

  registerDefaultServers() {
    // Filesystem MCP server
    this.registerServer({
      name: 'filesystem',
      command: 'npx',
      args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
      env: {},
      autoStart: false,
      description: 'File system operations in /tmp directory'
    });

    // Web3 MCP servers (if available)
    this.registerServer({
      name: 'web3-mcp',
      command: 'npx',
      args: ['web3-mcp'],
      env: {
        // Add blockchain RPC URLs if needed
        ETH_RPC_URL: process.env.ETH_RPC_URL,
        POLYGON_RPC_URL: process.env.POLYGON_RPC_URL,
      },
      autoStart: false,
      description: 'Web3 blockchain interactions'
    });

    // Nodit MCP server (using the web3-mcp tools we have)
    this.registerServer({
      name: 'nodit',
      command: 'node',
      args: ['-e', this.getNoditServerCode()],
      env: {
        NODIT_API_KEY: process.env.NODIT_API_KEY,
      },
      autoStart: false,
      description: 'Blockchain data queries via Nodit API'
    });

    logger.info('✅ Default MCP servers registered');
  }

  getNoditServerCode() {
    // Inline MCP server code for Nodit API
    return `
const { MCPServer } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio');

const server = new MCPServer({
  name: 'nodit-server',
  version: '1.0.0'
});

// Define tools
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_native_balance',
      description: 'Get native token balance for an address',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address' },
          chain: { type: 'string', description: 'Blockchain network' }
        },
        required: ['address', 'chain']
      }
    },
    {
      name: 'get_token_transfers',
      description: 'Get token transfer history',
      inputSchema: {
        type: 'object',
        properties: {
          address: { type: 'string', description: 'Wallet address' },
          chain: { type: 'string', description: 'Blockchain network' },
          limit: { type: 'number', description: 'Number of transfers to fetch' }
        },
        required: ['address', 'chain']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  // Mock implementation - replace with actual Nodit API calls
  switch (name) {
    case 'get_native_balance':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: args.address,
            chain: args.chain,
            balance: '1.5 ETH',
            timestamp: new Date().toISOString()
          })
        }]
      };
    
    case 'get_token_transfers':
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: args.address,
            chain: args.chain,
            transfers: [
              {
                hash: '0x123...',
                from: '0xabc...',
                to: args.address,
                value: '100 USDC',
                timestamp: new Date().toISOString()
              }
            ]
          })
        }]
      };
      
    default:
      throw new Error(\`Unknown tool: \${name}\`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
`;
  }

  registerServer(config) {
    this.configs.set(config.name, config);
    logger.info(`📝 Registered MCP server: ${config.name} - ${config.description || 'No description'}`);
  }

  async connectServer(serverName, customConfig = {}) {
    if (this.clients.has(serverName)) {
      logger.warn(`Server ${serverName} is already connected`);
      return { alreadyConnected: true };
    }

    const config = this.configs.get(serverName);
    if (!config) {
      throw new Error(`Server ${serverName} not registered. Available servers: ${Array.from(this.configs.keys()).join(', ')}`);
    }

    const mcpConfig = {
      command: customConfig.command || config.command,
      args: customConfig.args || config.args,
      env: { ...config.env, ...customConfig.env },
      cwd: customConfig.cwd || config.cwd
    };

    logger.info(`🔌 Connecting to MCP server: ${serverName}`);

    const client = new MCPClient(mcpConfig, serverName);
    
    // Set up event listeners
    client.on('disconnected', () => {
      logger.info(`🔌 MCP server ${serverName} disconnected`);
      this.clients.delete(serverName);
    });

    client.on('notification', (notification) => {
      logger.debug(`📢 Notification from ${serverName}:`, notification);
    });

    try {
      await client.connect();
      this.clients.set(serverName, client);
      logger.info(`✅ Successfully connected to MCP server: ${serverName}`);
      
      return { 
        connected: true, 
        serverName,
        status: client.getStatus()
      };
    } catch (error) {
      logger.error(`❌ Failed to connect to ${serverName}:`, error);
      throw new Error(`Failed to connect to ${serverName}: ${error.message}`);
    }
  }

  async disconnectServer(serverName) {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not connected`);
    }

    logger.info(`🔌 Disconnecting from MCP server: ${serverName}`);

    try {
      await client.disconnect();
      this.clients.delete(serverName);
      logger.info(`✅ Successfully disconnected from MCP server: ${serverName}`);
    } catch (error) {
      logger.error(`❌ Error disconnecting from ${serverName}:`, error);
      // Still remove from clients map even if disconnect failed
      this.clients.delete(serverName);
      throw error;
    }
  }

  getClient(serverName) {
    return this.clients.get(serverName);
  }

  getConnectedServers() {
    return Array.from(this.clients.keys());
  }

  getRegisteredServers() {
    return Array.from(this.configs.keys());
  }

  async listAllTools() {
    const allTools = {};

    for (const [serverName, client] of this.clients) {
      try {
        logger.debug(`📋 Listing tools for ${serverName}`);
        const tools = await client.listTools();
        allTools[serverName] = tools;
        logger.debug(`📋 Found ${tools.length} tools for ${serverName}`);
      } catch (error) {
        logger.error(`❌ Error listing tools for ${serverName}:`, error);
        allTools[serverName] = [];
      }
    }

    return allTools;
  }

  async callTool(serverName, toolName, arguments_) {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not connected. Connected servers: ${this.getConnectedServers().join(', ')}`);
    }

    logger.info(`🔧 Calling tool ${toolName} on ${serverName}`, { arguments: arguments_ });

    try {
      const result = await client.callTool(toolName, arguments_);
      logger.info(`✅ Tool ${toolName} completed successfully`);
      return result;
    } catch (error) {
      logger.error(`❌ Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  async listAllResources() {
    const allResources = {};

    for (const [serverName, client] of this.clients) {
      try {
        logger.debug(`📋 Listing resources for ${serverName}`);
        const resources = await client.listResources();
        allResources[serverName] = resources;
        logger.debug(`📋 Found ${resources.length} resources for ${serverName}`);
      } catch (error) {
        logger.error(`❌ Error listing resources for ${serverName}:`, error);
        allResources[serverName] = [];
      }
    }

    return allResources;
  }

  async readResource(serverName, uri) {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Server ${serverName} not connected. Connected servers: ${this.getConnectedServers().join(', ')}`);
    }

    logger.info(`📖 Reading resource from ${serverName}: ${uri}`);

    try {
      const content = await client.readResource(uri);
      logger.info(`✅ Resource read successfully from ${serverName}`);
      return content;
    } catch (error) {
      logger.error(`❌ Failed to read resource from ${serverName}:`, error);
      throw error;
    }
  }

  async disconnectAll() {
    logger.info(`🔌 Disconnecting all MCP servers (${this.clients.size} servers)`);

    const disconnectPromises = Array.from(this.clients.keys()).map(async (serverName) => {
      try {
        await this.disconnectServer(serverName);
      } catch (error) {
        logger.error(`❌ Error disconnecting ${serverName}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    logger.info('✅ All MCP servers disconnected');
  }

  isServerConnected(serverName) {
    const client = this.clients.get(serverName);
    return client?.isConnected() ?? false;
  }

  getServerStatus(serverName) {
    const client = this.clients.get(serverName);
    const config = this.configs.get(serverName);
    
    return {
      name: serverName,
      registered: !!config,
      connected: client?.isConnected() ?? false,
      description: config?.description || 'No description',
      status: client?.getStatus() || null,
      autoStart: config?.autoStart ?? false
    };
  }

  getAllServerStatus() {
    const allServers = new Set([
      ...this.getRegisteredServers(),
      ...this.getConnectedServers()
    ]);

    return Array.from(allServers).map(serverName => this.getServerStatus(serverName));
  }

  async initializeDefaultServers() {
    logger.info('🚀 Initializing default MCP servers...');

    const serversToStart = Array.from(this.configs.values())
      .filter(config => config.autoStart)
      .map(config => config.name);

    if (serversToStart.length === 0) {
      logger.info('📝 No auto-start servers configured');
      return;
    }

    logger.info(`🔌 Auto-starting servers: ${serversToStart.join(', ')}`);

    for (const serverName of serversToStart) {
      try {
        await this.connectServer(serverName);
        logger.info(`✅ Auto-started ${serverName}`);
      } catch (error) {
        logger.error(`❌ Failed to auto-start ${serverName}:`, error);
      }
    }
  }

  // Health check method
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      servers: {
        registered: this.getRegisteredServers().length,
        connected: this.getConnectedServers().length,
        details: this.getAllServerStatus()
      },
      summary: {}
    };

    // Test each connected server
    for (const [serverName, client] of this.clients) {
      try {
        const tools = await client.listTools();
        health.summary[serverName] = {
          status: 'healthy',
          toolCount: tools.length,
          connected: client.isConnected()
        };
      } catch (error) {
        health.summary[serverName] = {
          status: 'unhealthy',
          error: error.message,
          connected: client.isConnected()
        };
      }
    }

    // Determine overall health
    const unhealthyServers = Object.values(health.summary).filter(s => s.status === 'unhealthy');
    if (unhealthyServers.length > 0) {
      health.status = 'degraded';
    }

    return health;
  }
}

module.exports = { MCPManager };
