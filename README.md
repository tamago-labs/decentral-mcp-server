# MCP Service Railway Deployment

A Railway-ready MCP (Model Context Protocol) service that provides Web3 and blockchain functionality through HTTP APIs.

## 🚀 Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/deploy)

## 📋 Features

- **MCP Server Management**: Connect and manage multiple MCP servers
- **Web3 Integration**: Built-in support for blockchain operations
- **RESTful API**: Clean HTTP endpoints for all MCP operations
- **Security**: API key authentication and rate limiting
- **Monitoring**: Health checks and comprehensive logging
- **Production Ready**: Designed for Railway deployment

## 🔧 Available MCP Servers

1. **Filesystem**: File operations in `/tmp` directory
2. **Web3-MCP**: Blockchain interactions (ETH, Polygon, etc.)
3. **Nodit**: Blockchain data queries via Nodit API

## 🛠️ API Endpoints

### Health Check
```bash
GET /health
```

### MCP Operations
```bash
# Connect to MCP server
POST /api/mcp/connect
{
  "serverName": "filesystem",
  "config": { ... }
}

# List available tools
GET /api/mcp/tools

# Call a tool
POST /api/mcp/tools/call
{
  "serverName": "filesystem",
  "toolName": "read_file",
  "arguments": { "path": "/tmp/test.txt" }
}

# List servers
GET /api/mcp/servers

# Disconnect server
DELETE /api/mcp/disconnect/:serverName
```

## 🔑 Authentication

All API endpoints (except `/health`) require authentication via:

- **Header**: `X-API-Key: your-api-key`
- **Header**: `Authorization: Bearer your-api-key`
- **Query**: `?api_key=your-api-key`

## 🚀 Deployment Instructions

### 1. Railway Deployment (Recommended)

1. **Fork this repository**
2. **Connect to Railway**:
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo
   - Select this repository

3. **Set Environment Variables**:
   ```bash
   MCP_API_KEY=your-super-secure-api-key-here
   NODE_ENV=production
   LOG_LEVEL=INFO
   FRONTEND_URL=https://your-amplify-app.amplifyapp.com
   ```

4. **Deploy**: Railway will automatically build and deploy

5. **Get Your URL**: Railway provides a URL like `https://mcp-service-production.up.railway.app`

### 2. Local Development

```bash
# Clone repository
git clone <your-repo-url>
cd railway_app

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Set MCP_API_KEY=your-development-key

# Start development server
npm run dev

# Test health endpoint
curl http://localhost:3001/health
```

### 3. Testing the Service

```bash
# Test authentication
curl -H "X-API-Key: your-api-key" \
  https://your-service.railway.app/api/mcp/servers

# Connect to filesystem server
curl -X POST -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"serverName": "filesystem"}' \
  https://your-service.railway.app/api/mcp/connect

# List available tools
curl -H "X-API-Key: your-api-key" \
  https://your-service.railway.app/api/mcp/tools
```

## 🔗 Integration with Amplify

Update your Amplify app to use this MCP service:

```typescript
// In your Amplify Next.js app
const mcpClient = new RailwayMCPClient({
  baseUrl: 'https://your-service.railway.app',
  apiKey: process.env.MCP_API_KEY
});

// Use in your chat API
const result = await mcpClient.callTool('filesystem', 'read_file', {
  path: '/tmp/data.json'
});
```

## 📊 Monitoring

- **Health Check**: `GET /health` - Returns service status and connected servers
- **Logs**: Structured JSON logging in production
- **Metrics**: Railway provides built-in monitoring

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `MCP_API_KEY` | ✅ | API key for authentication | - |
| `NODE_ENV` | ❌ | Environment mode | `development` |
| `PORT` | ❌ | Server port | `3001` |
| `LOG_LEVEL` | ❌ | Logging level | `INFO` |
| `FRONTEND_URL` | ❌ | Allowed CORS origin | - |
| `ETH_RPC_URL` | ❌ | Ethereum RPC endpoint | - |
| `POLYGON_RPC_URL` | ❌ | Polygon RPC endpoint | - |
| `NODIT_API_KEY` | ❌ | Nodit API key | - |

### MCP Server Configuration

Add custom MCP servers by modifying `src/mcp-manager.js`:

```javascript
this.registerServer({
  name: 'custom-server',
  command: 'npx',
  args: ['your-mcp-server'],
  env: {
    API_KEY: process.env.YOUR_API_KEY
  },
  autoStart: false,
  description: 'Your custom MCP server'
});
```

## 🛡️ Security

- **API Key Authentication**: All endpoints protected
- **CORS Protection**: Configurable allowed origins
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Input Validation**: All inputs validated and sanitized
- **Security Headers**: Helmet.js for security headers

## 📈 Performance

- **Connection Pooling**: Reuse MCP connections
- **Request Timeouts**: 30-second timeout for MCP operations
- **Memory Management**: Automatic cleanup of disconnected servers
- **Error Handling**: Graceful error recovery

## 🔄 API Examples

### Connect and Use Filesystem Server

```javascript
// Connect to filesystem server
const connectResponse = await fetch('/api/mcp/connect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    serverName: 'filesystem'
  })
});

// List available tools
const toolsResponse = await fetch('/api/mcp/tools', {
  headers: { 'X-API-Key': 'your-api-key' }
});
const { tools } = await toolsResponse.json();

// Write a file
const writeResponse = await fetch('/api/mcp/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    serverName: 'filesystem',
    toolName: 'write_file',
    arguments: {
      path: '/tmp/test.txt',
      contents: 'Hello, World!'
    }
  })
});

// Read the file back
const readResponse = await fetch('/api/mcp/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    serverName: 'filesystem',
    toolName: 'read_file',
    arguments: {
      path: '/tmp/test.txt'
    }
  })
});
```

### Web3 Operations

```javascript
// Connect to web3 server
await fetch('/api/mcp/connect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    serverName: 'web3-mcp'
  })
});

// Get ETH balance
const balanceResponse = await fetch('/api/mcp/tools/call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  },
  body: JSON.stringify({
    serverName: 'web3-mcp',
    toolName: 'get_balance',
    arguments: {
      address: '0x742d35cc6688c02532e6a6314c90d4b97b0c3f77',
      chain: 'ethereum'
    }
  })
});
```

## 🚨 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check `MCP_API_KEY` environment variable
   - Ensure API key is included in request headers

2. **MCP Server Connection Failed**
   - Check if MCP server package is installed
   - Verify environment variables for server
   - Check Railway logs for error details

3. **Rate Limit Exceeded**
   - Implement request throttling in your client
   - Consider upgrading Railway plan for higher limits

4. **CORS Issues**
   - Add your domain to `FRONTEND_URL` environment variable
   - Check CORS configuration in `server.js`

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=DEBUG
```

### Railway Logs

View logs in Railway dashboard:
```bash
railway logs --follow
```

## 📚 Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [Railway Documentation](https://docs.railway.app/)
- [Express.js Documentation](https://expressjs.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- Create an issue in this repository
- Check Railway community forums
- Review the troubleshooting section above

---

**Ready to deploy?** Click the Railway button above or follow the deployment instructions!
