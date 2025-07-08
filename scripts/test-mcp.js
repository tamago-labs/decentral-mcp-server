#!/usr/bin/env node

/**
 * Test script to verify MCP service functionality
 * Usage: node scripts/test-mcp.js [service-url] [api-key]
 */

const axios = require('axios').default;

// Configuration
const SERVICE_URL = process.argv[2] || process.env.MCP_SERVICE_URL || 'http://localhost:3001';
const API_KEY = process.argv[3] || process.env.MCP_API_KEY || 'test-api-key';

console.log(`🧪 Testing MCP Service at: ${SERVICE_URL}`);
console.log(`🔑 Using API Key: ${API_KEY.substring(0, 8)}...`);
console.log('');

// HTTP client with default config
const client = axios.create({
  baseURL: SERVICE_URL,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

async function test(name, testFn) {
  try {
    console.log(`⏳ ${name}...`);
    const result = await testFn();
    console.log(`✅ ${name} - PASSED`);
    if (result) {
      console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    }
    console.log('');
    return true;
  } catch (error) {
    console.log(`❌ ${name} - FAILED`);
    console.log(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    console.log('');
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting MCP Service Tests\n');
  
  let passed = 0;
  let total = 0;

  // Test 1: Health Check
  total++;
  if (await test('Health Check', async () => {
    const response = await axios.get(`${SERVICE_URL}/health`);
    return {
      status: response.data.status,
      connectedServers: response.data.connectedServers?.length || 0
    };
  })) passed++;

  // Test 2: Authentication
  total++;
  if (await test('Authentication Check', async () => {
    const response = await client.get('/api/mcp/servers');
    return {
      hasAuth: true,
      serverCount: response.data.registered?.length || 0
    };
  })) passed++;

  // Test 3: List Servers
  total++;
  if (await test('List MCP Servers', async () => {
    const response = await client.get('/api/mcp/servers');
    return {
      registered: response.data.registered,
      connected: response.data.connected
    };
  })) passed++;

  // Test 4: Connect to Filesystem Server
  total++;
  if (await test('Connect Filesystem Server', async () => {
    const response = await client.post('/api/mcp/connect', {
      serverName: 'filesystem'
    });
    return {
      connected: response.data.success,
      message: response.data.message
    };
  })) passed++;

  // Test 5: List Tools
  total++;
  if (await test('List Available Tools', async () => {
    const response = await client.get('/api/mcp/tools');
    const toolCount = Object.values(response.data.tools || {})
      .reduce((sum, tools) => sum + tools.length, 0);
    return {
      servers: Object.keys(response.data.tools || {}),
      totalTools: toolCount
    };
  })) passed++;

  // Test 6: Write File
  total++;
  if (await test('Write Test File', async () => {
    const response = await client.post('/api/mcp/tools/call', {
      serverName: 'filesystem',
      toolName: 'write_file',
      arguments: {
        path: '/tmp/mcp-test.txt',
        contents: `MCP Test File\nCreated at: ${new Date().toISOString()}\nService URL: ${SERVICE_URL}`
      }
    });
    return {
      success: response.data.success,
      toolName: response.data.toolName
    };
  })) passed++;

  // Test 7: Read File
  total++;
  if (await test('Read Test File', async () => {
    const response = await client.post('/api/mcp/tools/call', {
      serverName: 'filesystem',
      toolName: 'read_file',
      arguments: {
        path: '/tmp/mcp-test.txt'
      }
    });
    const content = response.data.result?.content?.[0]?.text || '';
    return {
      success: response.data.success,
      contentLength: content.length,
      contentPreview: content.substring(0, 50) + '...'
    };
  })) passed++;

  // Test 8: List Directory
  total++;
  if (await test('List Directory', async () => {
    const response = await client.post('/api/mcp/tools/call', {
      serverName: 'filesystem',
      toolName: 'list_directory',
      arguments: {
        path: '/tmp'
      }
    });
    const files = response.data.result?.content?.[0]?.text || '[]';
    const fileList = JSON.parse(files);
    return {
      success: response.data.success,
      fileCount: fileList.length,
      hasTestFile: fileList.some(f => f.name === 'mcp-test.txt')
    };
  })) passed++;

  // Test 9: Error Handling
  total++;
  if (await test('Error Handling (Invalid Tool)', async () => {
    try {
      await client.post('/api/mcp/tools/call', {
        serverName: 'filesystem',
        toolName: 'nonexistent_tool',
        arguments: {}
      });
      throw new Error('Should have failed');
    } catch (error) {
      if (error.response?.status === 500) {
        return { errorHandled: true, status: error.response.status };
      }
      throw error;
    }
  })) passed++;

  // Test 10: Disconnect Server
  total++;
  if (await test('Disconnect Server', async () => {
    const response = await client.delete('/api/mcp/disconnect/filesystem');
    return {
      disconnected: response.data.success,
      message: response.data.message
    };
  })) passed++;

  // Summary
  console.log('📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  console.log(`📈 Success Rate: ${Math.round((passed / total) * 100)}%`);

  if (passed === total) {
    console.log('\n🎉 All tests passed! MCP Service is working correctly.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests failed. Please check the service configuration.');
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests().catch(error => {
  console.error('❌ Test runner failed:', error.message);
  process.exit(1);
});
