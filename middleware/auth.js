import AuthService from '../services/AuthService.js';
import { createAccessTokenConfig, logCookieConfig } from '../utils/cookieConfig.js';

const authService = new AuthService();

// Middleware to verify tokens
export async function authenticateToken(req, res, next) {
  try {
    const token = req.cookies.access_token;

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    try {
      const tokenData = await authService.verifyToken(token);
      req.user = tokenData;
      return next();
    } catch (tokenError) {
      // If access token is invalid/expired, try to refresh it
      const refreshToken = req.cookies.refresh_token;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Session expired, please login again' });
      }

      try {
        // Attempt to refresh the access token
        const refreshResult = await authService.refreshAccessToken(refreshToken);

        // Set new access token cookie with subdomain support
        const accessConfig = createAccessTokenConfig();
        logCookieConfig('Auth Middleware - Refresh', accessConfig);
        res.cookie('access_token', refreshResult.accessToken, accessConfig);

        // Verify the new token and continue
        const newTokenData = await authService.verifyToken(refreshResult.accessToken);
        req.user = newTokenData;
        next();
      } catch (refreshError) {
        return res.status(401).json({ error: 'Session expired, please login again' });
      }
    }
  } catch (error) {
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
}

// Optional auth middleware - continues if no token provided
export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies.access_token;

    if (token) {
      try {
        const tokenData = await authService.verifyToken(token);
        req.user = tokenData;
      } catch (error) {
        // Continue without authentication if token is invalid
      }
    }

    next();
  } catch (error) {
    // Continue without authentication if any error occurs
    next();
  }
}

// Role-based access control
export function requireRole(requiredRole = 'user') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from database for fresh role information
      const user = req.user.user || await authService.getUserByToken(req.cookies.access_token);
      
      authService.validatePermissions(user, requiredRole);
      req.userRecord = user; // Attach full user record
      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Admin role check middleware
export const requireAdmin = requireRole('admin');

// Sysadmin role check middleware
export const requireSysadmin = requireRole('sysadmin');

// User type check middleware (for teacher, student, parent, headmaster)
export function requireUserType(requiredUserType) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user from database for fresh user_type information
      const user = req.user.user || await authService.getUserByToken(req.cookies.access_token);
      
      if (!user.user_type || user.user_type !== requiredUserType) {
        return res.status(403).json({ error: `${requiredUserType} user type required` });
      }

      req.userRecord = user; // Attach full user record
      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Specific user type middleware
export const requireTeacher = requireUserType('teacher');
export const requireStudent = requireUserType('student');
export const requireParent = requireUserType('parent');
export const requireHeadmaster = requireUserType('headmaster');

// Middleware to check if user owns the resource
export function requireOwnership(getResourceOwnerId) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const resourceOwnerId = await getResourceOwnerId(req);
      
      // Admin and sysadmin can access any resource
      if (req.user.role === 'admin' || req.user.role === 'sysadmin') {
        return next();
      }

      // Check if user owns the resource
      if (req.user.id !== resourceOwnerId) {
        return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
      }

      next();
    } catch (error) {
      res.status(403).json({ error: error.message });
    }
  };
}

// Video streaming authentication middleware - supports both header and query parameter
export async function authenticateTokenForVideo(req, res, next) {
  try {
    // Try header first (standard authentication)
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }

    // If no header token, try query parameter (for video streaming)
    if (!token && req.query.authToken) {
      token = req.query.authToken;
    }

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = await authService.verifyToken(token);
    req.user = tokenData;
    next();
  } catch (error) {
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
}

// Middleware to validate API key (for external integrations)
export function validateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      // If no API key is configured, skip validation
      return next();
    }

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    if (apiKey !== validApiKey) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
}