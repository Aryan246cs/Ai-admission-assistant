import { logger } from './logger.js';

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  logger.error(`${err.statusCode} - ${err.message}`, {
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  if (process.env.NODE_ENV === 'development') {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  } else {
    res.status(err.statusCode).json({
      success: false,
      error: err.isOperational ? err.message : 'Something went wrong'
    });
  }
};
