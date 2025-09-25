import AuthService from '../services/authService.js';

const authService = new AuthService();

// Middleware to verify tokens
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const tokenData = await authService.verifyToken(token);
    req.user = tokenData;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(403).json({ error: error.message || 'Invalid or expired token' });
  }
}

// Optional auth middleware - continues if no token provided
export async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const tokenData = await authService.verifyToken(token);
        req.user = tokenData;
      } catch (error) {
        // Continue without authentication if token is invalid
        console.log('Optional auth failed, continuing without auth:', error.message);
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
      const user = req.user.user || await authService.getUserByToken(req.headers['authorization']?.split(' ')[1]);
      
      authService.validatePermissions(user, requiredRole);
      req.userRecord = user; // Attach full user record
      next();
    } catch (error) {
      console.error('Role validation error:', error);
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
      const user = req.user.user || await authService.getUserByToken(req.headers['authorization']?.split(' ')[1]);
      
      if (!user.user_type || user.user_type !== requiredUserType) {
        return res.status(403).json({ error: `${requiredUserType} user type required` });
      }

      req.userRecord = user; // Attach full user record
      next();
    } catch (error) {
      console.error('User type validation error:', error);
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
      if (req.user.uid !== resourceOwnerId) {
        return res.status(403).json({ error: 'Access denied: You can only access your own resources' });
      }

      next();
    } catch (error) {
      console.error('Ownership validation error:', error);
      res.status(403).json({ error: error.message });
    }
  };
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
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}