const { logger } = require('../utils/logger');

function authMiddleware(req, res, next) {
  // Skip auth for health check and options requests
  if (req.path === '/health' || req.method === 'OPTIONS') {
    return next();
  }

  const apiKey = req.headers['x-api-key'] || 
                 req.headers['authorization']?.replace('Bearer ', '') ||
                 req.query.api_key;

  if (!apiKey) {
    logger.warn('Authentication failed: No API key provided', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      error: 'Authentication required',
      code: 'MISSING_API_KEY',
      message: 'Please provide a valid API key in the X-API-Key header, Authorization header, or api_key query parameter'
    });
  }

  // Validate API key
  const validApiKeys = [
    process.env.MCP_API_KEY,
    process.env.RAILWAY_API_KEY,
    process.env.API_KEY
  ].filter(Boolean);

  if (validApiKeys.length === 0) {
    logger.error('Server configuration error: No valid API keys configured');
    return res.status(500).json({
      error: 'Server configuration error',
      code: 'NO_API_KEYS_CONFIGURED'
    });
  }

  if (!validApiKeys.includes(apiKey)) {
    logger.warn('Authentication failed: Invalid API key', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      providedKeyPrefix: apiKey.substring(0, 8) + '...'
    });
    
    return res.status(401).json({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
      message: 'The provided API key is not valid'
    });
  }

  // API key is valid, add it to request for logging
  req.apiKey = apiKey;
  req.apiKeyPrefix = apiKey.substring(0, 8) + '...';

  logger.debug('Authentication successful', {
    ip: req.ip,
    path: req.path,
    apiKeyPrefix: req.apiKeyPrefix
  });

  next();
}

module.exports = { authMiddleware };
