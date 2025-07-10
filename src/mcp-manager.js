const { MCPClient } = require('./mcp-client');
const { logger } = require('./utils/logger');

require('dotenv').config();

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
      args: ["-y", '@modelcontextprotocol/server-filesystem', '/tmp'],
      env: {},
      autoStart: false,
      description: 'File system operations in /tmp directory'
    });

    // Nodit MCP server
    this.registerServer({
      name: 'nodit',
      command: 'npx',
      args: ["-y", "@noditlabs/nodit-mcp-server"],
      env: {
        NODIT_API_KEY: process.env.NODIT_API_KEY,
      },
      autoStart: false,
      description: 'Base MCP for other blockchain analytics in the system'
    });

    // Web3 MCP Base Server
    this.registerServer({
      name: 'agent-base',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=agent-base"],
      env: {},
      autoStart: false,
      description: 'Base MCP tools including symbol converter, cached Nodit API specs'
    });

    // Portfolio Snapshot
    this.registerServer({
      name: 'portfolio-snapshot',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=portfolio-snapshot"],
      env: {},
      autoStart: false,
      description: 'Cross-chain wallet and portfolio analysis for EVM-chains'
    });

    // Gas Optimization Helper
    this.registerServer({
      name: 'gas-optimization-helper',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=gas-optimization-helper"],
      env: {},
      autoStart: false,
      description: 'Smart gas price analysis and transaction timing optimization to minimize fees across EVM chains'
    });

    // Whale Monitor
    this.registerServer({
      name: 'whale-monitor',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=whale-monitor"],
      env: {},
      autoStart: false,
      description: 'Track large token transfers and whale wallet activities'
    });

    // Token Intelligence
    this.registerServer({
      name: 'token-intelligence',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=token-intelligence"],
      env: {},
      autoStart: false,
      description: 'Comprehensive token analysis including price data, holder distribution, and market metrics'
    });

    // Transaction Tracker
    this.registerServer({
      name: 'transaction-tracker',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=transaction-tracker"],
      env: {},
      autoStart: false,
      description: 'Detailed transaction analysis and address activity monitoring'
    });

    // NFT Collection Insights
    this.registerServer({
      name: 'nft-collection-insights',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=nft-collection-insights"],
      env: {},
      autoStart: false,
      description: 'NFT collection analytics including holder distribution, trading activity, and rarity analysis'
    });

    // Bitcoin Wallet Analyzer
    this.registerServer({
      name: 'bitcoin-wallet-analyzer',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=bitcoin-wallet-analyzer"],
      env: {},
      autoStart: false,
      description: 'Comprehensive Bitcoin wallet analysis with UTXO optimization'
    });

    // Bitcoin Transaction Tracker
    this.registerServer({
      name: 'bitcoin-transaction-tracker',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=bitcoin-transaction-tracker"],
      env: {},
      autoStart: false,
      description: 'Bitcoin transaction forensics and flow analysis'
    });

    // Bitcoin Network Insights
    this.registerServer({
      name: 'bitcoin-network-insights',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=bitcoin-network-insights"],
      env: {},
      autoStart: false,
      description: 'Bitcoin network health monitoring and mining analytics'
    });

    // EVM DeFi Analytics
    this.registerServer({
      name: 'evm-defi',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=evm-defi"],
      env: {},
      autoStart: false,
      description: 'Comprehensive DeFi analytics for liquidity pools, yield farming, and DEX trading for EVM chains'
    });

    // Aptos DeFi Analytics
    this.registerServer({
      name: 'aptos-defi',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=aptos-defi"],
      env: {},
      autoStart: false,
      description: 'Native Aptos DeFi ecosystem analysis including coin activities, liquidity pools, and protocol interactions'
    });

    // Quant Trading Analytics
    this.registerServer({
      name: 'quant-trading',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=quant-trading"],
      env: {},
      autoStart: false,
      description: 'Institutional-grade quantitative trading platform combining multi-factor token scoring, momentum detection, and risk assessment'
    });

    // Block Analytics  
    this.registerServer({
      name: 'block-analytics',
      command: 'npx',
      args: ["-y", "@tamago-labs/web3-mcp", "--agent_mode=block-analytics"],
      env: {},
      autoStart: false,
      description: 'Block tools for EVM-chains, good for testing.'
    });

    logger.info('✅ Default MCP servers registered');
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

    logger.info(`debug mcp config ${ JSON.stringify(mcpConfig) }`)

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
