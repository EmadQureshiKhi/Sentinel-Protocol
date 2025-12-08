/**
 * Error Handler Middleware
 * Global error handling for Express
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

// Custom error class
export class ApiError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error response interface
interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  // Handle ApiError
  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  // Handle Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    message = 'Database operation failed';
    isOperational = true;
  }

  if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided';
    isOperational = true;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
    isOperational = true;
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Invalid JSON in request body';
    isOperational = true;
  }

  // Log error
  if (!isOperational) {
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.warn('Operational error:', {
      error: err.message,
      path: req.path,
      method: req.method,
    });
  }

  // Build error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && !isOperational) {
    (errorResponse as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Resource not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async handler wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default errorHandler;
