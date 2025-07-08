const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  // Log the error
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    apiKeyPrefix: req.apiKeyPrefix || 'none'
  });

  // Default error response
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'Internal server error';

  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED';
    message = 'Authentication failed';
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
    message = 'Unable to connect to MCP server';
  } else if (err.code === 'TIMEOUT') {
    statusCode = 408;
    errorCode = 'REQUEST_TIMEOUT';
    message = 'Request timed out';
  } else if (err.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'NOT_FOUND';
    message = err.message;
  } else if (err.message.includes('already connected')) {
    statusCode = 409;
    errorCode = 'ALREADY_EXISTS';
    message = err.message;
  }

  // Don't expose internal error details in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  const errorResponse = {
    error: message,
    code: errorCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // Add stack trace in development
  if (!isProduction && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Add request ID if available
  if (req.id) {
    errorResponse.requestId = req.id;
  }

  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, asyncHandler };
