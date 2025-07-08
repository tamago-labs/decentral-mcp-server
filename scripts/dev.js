#!/usr/bin/env node

/**
 * Development script to start MCP service with hot reload
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting MCP Service in Development Mode');
console.log('===========================================');

// Load environment variables
require('dotenv').config();

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  .env file not found. Creating from .env.example...');
  
  const examplePath = path.join(__dirname, '..', '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ Created .env file from .env.example');
    console.log('🔧 Please edit .env file with your configuration');
  } else {
    console.log('❌ .env.example not found');
  }
}

// Set development environment
process.env.NODE_ENV = 'development';
process.env.LOG_LEVEL = 'DEBUG';

// Default API key for development
if (!process.env.MCP_API_KEY) {
  process.env.MCP_API_KEY = 'dev-api-key-change-in-production';
  console.log('⚠️  Using default API key for development');
}

console.log(`📍 Environment: ${process.env.NODE_ENV}`);
console.log(`🔑 API Key: ${process.env.MCP_API_KEY.substring(0, 8)}...`);
console.log(`📝 Log Level: ${process.env.LOG_LEVEL}`);
console.log(`🌐 Port: ${process.env.PORT || 3001}`);
console.log('');

// Start the server with nodemon
const serverProcess = spawn('npx', ['nodemon', 'server.js'], {
  stdio: 'inherit',
  env: process.env
});

serverProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

serverProcess.on('exit', (code) => {
  console.log(`🔚 Server exited with code: ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  serverProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down development server...');
  serverProcess.kill('SIGTERM');
});

console.log('🔥 Server starting... Press Ctrl+C to stop');
console.log('📊 Health check: http://localhost:3001/health');
console.log('📚 API docs: http://localhost:3001/api/mcp/servers');
