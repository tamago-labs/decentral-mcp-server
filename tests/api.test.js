const request = require('supertest');
const app = require('../server');

describe('MCP Service API', () => {
  const apiKey = process.env.MCP_API_KEY || 'test-api-key';

  describe('Health Check', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('connectedServers');
    });
  });

  describe('Authentication', () => {
    test('API endpoints should require authentication', async () => {
      await request(app)
        .get('/api/mcp/servers')
        .expect(401);
    });

    test('Valid API key should allow access', async () => {
      await request(app)
        .get('/api/mcp/servers')
        .set('X-API-Key', apiKey)
        .expect(200);
    });
  });

  describe('MCP Servers', () => {
    test('GET /api/mcp/servers should return server list', async () => {
      const response = await request(app)
        .get('/api/mcp/servers')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('registered');
      expect(response.body).toHaveProperty('connected');
    });

    test('POST /api/mcp/connect should connect to filesystem server', async () => {
      const response = await request(app)
        .post('/api/mcp/connect')
        .set('X-API-Key', apiKey)
        .send({ serverName: 'filesystem' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('serverName', 'filesystem');
    });
  });

  describe('MCP Tools', () => {
    beforeAll(async () => {
      // Connect to filesystem server for testing
      await request(app)
        .post('/api/mcp/connect')
        .set('X-API-Key', apiKey)
        .send({ serverName: 'filesystem' });
    });

    test('GET /api/mcp/tools should return available tools', async () => {
      const response = await request(app)
        .get('/api/mcp/tools')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('tools');
    });

    test('POST /api/mcp/tools/call should execute a tool', async () => {
      const response = await request(app)
        .post('/api/mcp/tools/call')
        .set('X-API-Key', apiKey)
        .send({
          serverName: 'filesystem',
          toolName: 'write_file',
          arguments: {
            path: '/tmp/test-file.txt',
            contents: 'Test content'
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
    });
  });

  describe('Error Handling', () => {
    test('Invalid server name should return 500', async () => {
      await request(app)
        .post('/api/mcp/connect')
        .set('X-API-Key', apiKey)
        .send({ serverName: 'nonexistent-server' })
        .expect(500);
    });

    test('Missing parameters should return 400', async () => {
      await request(app)
        .post('/api/mcp/tools/call')
        .set('X-API-Key', apiKey)
        .send({})
        .expect(400);
    });
  });
});
