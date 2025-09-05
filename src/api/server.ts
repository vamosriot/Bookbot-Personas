/**
 * Book Recommendations API Server
 * 
 * Express.js REST API for book recommendations using vector embeddings.
 * Includes rate limiting, validation, error handling, and comprehensive logging.
 * 
 * Endpoints:
 * - POST /api/recommendations - Get recommendations by title
 * - GET /api/books/:id/similar - Get books similar to a specific ID
 * - GET /api/health - Health check
 * - GET /api/stats - System statistics
 * 
 * Features:
 * - Request validation and sanitization
 * - Rate limiting (100 req/min per IP)
 * - CORS support
 * - Comprehensive error handling
 * - Request/response logging
 * - OpenAPI documentation
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from 'dotenv';
import RecommendationService from '../services/recommendationService.js';
import { RecommendationRequest } from '@/types';

// Load environment variables
config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
let recommendationService: RecommendationService;

try {
  recommendationService = new RecommendationService();
} catch (error) {
  console.error('Failed to initialize RecommendationService:', error);
  process.exit(1);
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: '60 seconds'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

// Validation middleware
const validateRecommendationRequest = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, limit, threshold } = req.body;
    
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title is required and must be a non-empty string',
        code: 'INVALID_TITLE'
      });
    }

    if (title.length > 500) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title must be less than 500 characters',
        code: 'TITLE_TOO_LONG'
      });
    }

    if (limit !== undefined) {
      const numLimit = parseInt(limit, 10);
      if (isNaN(numLimit) || numLimit <= 0 || numLimit > 100) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Limit must be a number between 1 and 100',
          code: 'INVALID_LIMIT'
        });
      }
    }

    if (threshold !== undefined) {
      const numThreshold = parseFloat(threshold);
      if (isNaN(numThreshold) || numThreshold < 0 || numThreshold > 1) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Threshold must be a number between 0 and 1',
          code: 'INVALID_THRESHOLD'
        });
      }
    }

    next();
  } catch (error) {
    res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request format',
      code: 'INVALID_FORMAT'
    });
  }
};

// Error handling middleware
const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('API Error:', error);

  // Rate limiting errors
  if (error.status === 429) {
    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: error.message,
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: error.message,
      code: 'VALIDATION_ERROR'
    });
  }

  // OpenAI API errors
  if (error.message && error.message.includes('OpenAI')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'AI service temporarily unavailable. Please try again later.',
      code: 'AI_SERVICE_ERROR'
    });
  }

  // Database errors
  if (error.message && error.message.includes('database')) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database service temporarily unavailable. Please try again later.',
      code: 'DATABASE_ERROR'
    });
  }

  // Generic server error
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    code: 'INTERNAL_ERROR'
  });
};

// API Routes

/**
 * Health check endpoint
 */
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const stats = await recommendationService.getRecommendationStats();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      embeddings_available: stats.total_embeddings > 0,
      total_embeddings: stats.total_embeddings,
      cache_size: stats.cache_size
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service check failed'
    });
  }
});

/**
 * Get system statistics
 */
app.get('/api/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await recommendationService.getRecommendationStats();
    
    res.json({
      system: {
        total_embeddings: stats.total_embeddings,
        cache_size: stats.cache_size,
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development'
      },
      api: {
        version: '1.0.0',
        max_recommendations_per_request: 100,
        default_similarity_threshold: 0.7,
        cache_ttl_minutes: 5
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get book recommendations by title
 * POST /api/recommendations
 */
app.post('/api/recommendations', validateRecommendationRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, limit = 10, threshold = 0.7 } = req.body as RecommendationRequest;

    const result = await recommendationService.findSimilarBooksByTitle(
      title,
      limit,
      { similarity_threshold: threshold }
    );

    res.json({
      success: true,
      data: result,
      meta: {
        requested_title: title,
        limit_requested: limit,
        threshold_used: threshold,
        results_count: result.recommendations.length,
        processing_time_ms: result.processing_time_ms
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get books similar to a specific book ID
 * GET /api/books/:id/similar
 */
app.get('/api/books/:id/similar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = parseInt(req.params.id, 10);
    const limit = parseInt(req.query.limit as string || '10', 10);
    const threshold = parseFloat(req.query.threshold as string || '0.7');

    // Validation
    if (isNaN(bookId) || bookId <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Book ID must be a positive integer',
        code: 'INVALID_BOOK_ID'
      });
    }

    if (limit <= 0 || limit > 100) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Limit must be between 1 and 100',
        code: 'INVALID_LIMIT'
      });
    }

    if (threshold < 0 || threshold > 1) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Threshold must be between 0 and 1',
        code: 'INVALID_THRESHOLD'
      });
    }

    const result = await recommendationService.findSimilarBooksById(
      bookId,
      limit,
      { similarity_threshold: threshold }
    );

    res.json({
      success: true,
      data: result,
      meta: {
        source_book_id: bookId,
        limit_requested: limit,
        threshold_used: threshold,
        results_count: result.recommendations.length,
        processing_time_ms: result.processing_time_ms
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Book with ID ${req.params.id} not found`,
        code: 'BOOK_NOT_FOUND'
      });
    }
    next(error);
  }
});

/**
 * Get book details by ID
 * GET /api/books/:id
 */
app.get('/api/books/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = parseInt(req.params.id, 10);

    if (isNaN(bookId) || bookId <= 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Book ID must be a positive integer',
        code: 'INVALID_BOOK_ID'
      });
    }

    const book = await recommendationService.getBookById(bookId);

    if (!book) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Book with ID ${bookId} not found`,
        code: 'BOOK_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: book,
      meta: {
        book_id: bookId
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear recommendation cache
 * POST /api/cache/clear
 */
app.post('/api/cache/clear', async (req: Request, res: Response) => {
  try {
    recommendationService.clearCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to clear cache'
    });
  }
});

/**
 * API documentation endpoint
 */
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    title: 'Book Recommendations API',
    version: '1.0.0',
    description: 'REST API for book recommendations using vector embeddings',
    endpoints: {
      'GET /api/health': 'Health check and service status',
      'GET /api/stats': 'System statistics and configuration',
      'POST /api/recommendations': 'Get book recommendations by title',
      'GET /api/books/:id/similar': 'Get books similar to a specific ID',
      'GET /api/books/:id': 'Get book details by ID',
      'POST /api/cache/clear': 'Clear recommendation cache',
      'GET /api/docs': 'This documentation'
    },
    examples: {
      recommendations: {
        method: 'POST',
        url: '/api/recommendations',
        body: {
          title: 'Pride and Prejudice',
          limit: 5,
          threshold: 0.8
        }
      },
      similar_books: {
        method: 'GET',
        url: '/api/books/123/similar?limit=5&threshold=0.8'
      }
    }
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.baseUrl || req.path} not found`,
    code: 'ENDPOINT_NOT_FOUND',
    available_endpoints: [
      'GET /api/health',
      'GET /api/stats',
      'POST /api/recommendations',
      'GET /api/books/:id/similar',
      'GET /api/books/:id',
      'POST /api/cache/clear',
      'GET /api/docs'
    ]
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Book Recommendations API Server`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💓 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`\n📋 Available Endpoints:`);
  console.log(`   POST http://localhost:${PORT}/api/recommendations`);
  console.log(`   GET  http://localhost:${PORT}/api/books/:id/similar`);
  console.log(`   GET  http://localhost:${PORT}/api/books/:id`);
  console.log(`   GET  http://localhost:${PORT}/api/health`);
  console.log(`   GET  http://localhost:${PORT}/api/stats`);
  console.log(`   GET  http://localhost:${PORT}/api/docs\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
