const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { MCPManager } = require('./src/mcp-manager');
const { authMiddleware } = require('./src/middleware/auth');
const { errorHandler } = require('./src/middleware/error-handler');
const { logger } = require('./src/utils/logger');

const app = express();
const port = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001', 
    /\.amplifyapp\.com$/,
    /\.vercel\.app$/,
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next();
});

// Initialize MCP Manager
const mcpManager = new MCPManager();

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    connectedServers: mcpManager.getConnectedServers(),
    registeredServers: mcpManager.getRegisteredServers()
  };

  res.json(healthStatus);
});

// API routes with authentication
app.use('/api', authMiddleware);

// Connect to MCP server
app.post('/api/mcp/connect', async (req, res) => {
  try {
    const { serverName, config } = req.body;

    if (!serverName) {
      return res.status(400).json({
        error: 'Server name is required',
        code: 'MISSING_SERVER_NAME'
      });
    }

    logger.info(`Connecting to MCP server: ${serverName}`, { config });

    const result = await mcpManager.connectServer(serverName, config);
    
    res.json({
      success: true,
      message: `Successfully connected to ${serverName}`,
      serverName,
      result
    });

  } catch (error) {
    logger.error('MCP connect error:', error);
    res.status(500).json({
      error: error.message,
      code: 'CONNECTION_FAILED',
      serverName: req.body.serverName
    });
  }
});

// Disconnect from MCP server
app.delete('/api/mcp/disconnect/:serverName', async (req, res) => {
  try {
    const { serverName } = req.params;

    logger.info(`Disconnecting from MCP server: ${serverName}`);

    await mcpManager.disconnectServer(serverName);
    
    res.json({
      success: true,
      message: `Successfully disconnected from ${serverName}`,
      serverName
    });

  } catch (error) {
    logger.error('MCP disconnect error:', error);
    res.status(500).json({
      error: error.message,
      code: 'DISCONNECTION_FAILED',
      serverName: req.params.serverName
    });
  }
});

// List all tools from connected servers
app.get('/api/mcp/tools', async (req, res) => {
  try {
    logger.info('Listing MCP tools');

    const tools = await mcpManager.listAllTools();
    
    res.json({
      success: true,
      tools,
      serverCount: Object.keys(tools).length,
      totalTools: Object.values(tools).reduce((sum, serverTools) => sum + serverTools.length, 0)
    });

  } catch (error) {
    logger.error('List tools error:', error);
    res.status(500).json({
      error: error.message,
      code: 'LIST_TOOLS_FAILED'
    });
  }
});

// Call a specific tool
app.post('/api/mcp/tools/call', async (req, res) => {
  try {
    const { serverName, toolName, arguments: args } = req.body;

    if (!serverName || !toolName) {
      return res.status(400).json({
        error: 'Server name and tool name are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    logger.info(`Calling MCP tool: ${serverName}.${toolName}`, { arguments: args });

    const result = await mcpManager.callTool(serverName, toolName, args || {});
    
    res.json({
      success: true,
      result,
      serverName,
      toolName,
      executionTime: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Tool call error:', error);
    res.status(500).json({
      error: error.message,
      code: 'TOOL_CALL_FAILED',
      serverName: req.body.serverName,
      toolName: req.body.toolName
    });
  }
});

// List all resources from connected servers
app.get('/api/mcp/resources', async (req, res) => {
  try {
    logger.info('Listing MCP resources');

    const resources = await mcpManager.listAllResources();
    
    res.json({
      success: true,
      resources,
      serverCount: Object.keys(resources).length,
      totalResources: Object.values(resources).reduce((sum, serverResources) => sum + serverResources.length, 0)
    });

  } catch (error) {
    logger.error('List resources error:', error);
    res.status(500).json({
      error: error.message,
      code: 'LIST_RESOURCES_FAILED'
    });
  }
});

// Read a specific resource
app.post('/api/mcp/resources/read', async (req, res) => {
  try {
    const { serverName, uri } = req.body;

    if (!serverName || !uri) {
      return res.status(400).json({
        error: 'Server name and URI are required',
        code: 'MISSING_PARAMETERS'
      });
    }

    logger.info(`Reading MCP resource: ${serverName} - ${uri}`);

    const content = await mcpManager.readResource(serverName, uri);
    
    res.json({
      success: true,
      content,
      serverName,
      uri,
      readTime: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Resource read error:', error);
    res.status(500).json({
      error: error.message,
      code: 'RESOURCE_READ_FAILED',
      serverName: req.body.serverName,
      uri: req.body.uri
    });
  }
});

// List server status
app.get('/api/mcp/servers', (req, res) => {
  try {
    const connected = mcpManager.getConnectedServers();
    const registered = mcpManager.getRegisteredServers();
    
    const status = registered.map(name => ({
      name,
      connected: connected.includes(name),
      registeredAt: new Date().toISOString()
    }));

    res.json({
      success: true,
      connected,
      registered,
      status
    });

  } catch (error) {
    logger.error('Server status error:', error);
    res.status(500).json({
      error: error.message,
      code: 'SERVER_STATUS_FAILED'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  try {
    await mcpManager.disconnectAll();
    logger.info('All MCP connections closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  try {
    await mcpManager.disconnectAll();
    logger.info('All MCP connections closed');
  } catch (error) {
    logger.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

// Start server
app.listen(port, '0.0.0.0', () => {
  logger.info(`🚀 MCP Service running on port ${port}`);
  logger.info(`📊 Health check: http://localhost:${port}/health`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize default MCP servers
  mcpManager.initializeDefaultServers()
    .then(() => {
      logger.info('✅ Default MCP servers initialized');
    })
    .catch((error) => {
      logger.error('❌ Failed to initialize default MCP servers:', error);
    });
});

module.exports = app;
