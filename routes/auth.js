import express from 'express';
import { admin } from '../config/firebase.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import AuthService from '../services/AuthService.js';
import models from '../models/index.js';
import {
  logCookieConfig,
  detectPortal,
  getPortalCookieNames,
  createPortalAccessTokenConfig,
  createPortalRefreshTokenConfig,
  createPortalClearCookieConfig
} from '../utils/cookieConfig.js';

const authService = new AuthService();
import EmailService from '../services/EmailService.js';
import { clog, cerror } from '../lib/utils.js';

const router = express.Router();

// Register endpoint
router.post('/register', rateLimiters.auth, validateBody(schemas.register), async (req, res) => {
  try {
    // Detect portal from request
    const portal = detectPortal(req);

    // Collect session metadata
    const sessionMetadata = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
      timestamp: new Date()
    };

    const result = await authService.registerUser(req.body, sessionMetadata, portal);

    // Get portal-specific cookie names
    const cookieNames = getPortalCookieNames(portal);

    // Set access token as httpOnly cookie (15 minutes) with portal-specific name
    const accessConfig = createPortalAccessTokenConfig(portal);
    logCookieConfig(`Register ${portal} - Access Token`, accessConfig);
    res.cookie(cookieNames.accessToken, result.accessToken, accessConfig);

    // Set refresh token as httpOnly cookie (7 days) with portal-specific name
    const refreshConfig = createPortalRefreshTokenConfig(portal);
    logCookieConfig(`Register ${portal} - Refresh Token`, refreshConfig);
    res.cookie(cookieNames.refreshToken, result.refreshToken, refreshConfig);

    // Send welcome email
    try {
      await EmailService.sendRegistrationEmail({
        email: req.body.email,
        registrationData: {
          user_name: req.body.fullName || req.body.email.split('@')[0],
          site_name: 'Ludora'
        }
      });
    } catch (emailError) {
      clog('Failed to send registration email:', emailError);
    }

    // Return success and user data (without tokens)
    res.status(201).json({
      success: result.success,
      user: result.user
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Refresh token endpoint
router.post('/refresh', async (req, res) => {
  try {
    // Detect portal from request
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    const refreshToken = req.cookies[cookieNames.refreshToken];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    // Set new access token as httpOnly cookie (15 minutes) with portal-specific name
    const accessConfig = createPortalAccessTokenConfig(portal);
    logCookieConfig(`Refresh ${portal} - Access Token`, accessConfig);
    res.cookie(cookieNames.accessToken, result.accessToken, accessConfig);

    // Return success and user data
    res.json({
      success: true,
      user: result.user
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    // Detect portal from request
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);

    let userId = null;

    // Get user ID from portal-specific access token if possible
    const accessToken = req.cookies[cookieNames.accessToken];
    if (accessToken) {
      try {
        const tokenData = await authService.verifyToken(accessToken);
        userId = tokenData.id;
      } catch (tokenError) {
        // Continue with logout even if token verification fails
      }
    }

    // Revoke refresh token if it exists
    const refreshToken = req.cookies[cookieNames.refreshToken];
    if (refreshToken) {
      try {
        // Extract token ID to revoke from store
        const jwt = await import('jsonwebtoken');
        const payload = jwt.default.verify(refreshToken, process.env.JWT_SECRET);
        if (payload.tokenId) {
          await authService.revokeRefreshToken(payload.tokenId);
        }
      } catch (tokenError) {
        // Continue with logout even if token revocation fails
      }
    }

    // Invalidate user sessions for this portal only if we have a user ID
    if (userId) {
      await authService.logoutUserFromPortal(userId, portal);
    }

    // Clear both httpOnly cookies with proper domain settings and portal-specific names
    const clearConfig = createPortalClearCookieConfig(portal);
    logCookieConfig(`Logout ${portal} - Clear Cookies`, clearConfig);
    res.clearCookie(cookieNames.accessToken, clearConfig);
    res.clearCookie(cookieNames.refreshToken, clearConfig);

    res.json({ success: true, message: `Logged out from ${portal} portal successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Detect portal and get appropriate access token
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);
    const accessToken = req.cookies[cookieNames.accessToken];

    const user = await authService.getUserByToken(accessToken);
    
    // Return clean user data - all from database
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      education_level: user.education_level,
      specializations: user.specializations,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      onboarding_completed: user.onboarding_completed,
      birth_date: user.birth_date,
      invitation_code: user.invitation_code,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

// Update current user profile
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    // Detect portal and get appropriate access token
    const portal = detectPortal(req);
    const cookieNames = getPortalCookieNames(portal);
    const accessToken = req.cookies[cookieNames.accessToken];

    const user = await authService.getUserByToken(accessToken);
    const {
      full_name,
      phone,
      education_level,
      specializations,
      content_creator_agreement_sign_date,
      onboarding_completed,
      birth_date,
      user_type,
      invitation_code
    } = req.body;

    // Only allow updating specific fields
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (education_level !== undefined) updateData.education_level = education_level;
    if (specializations !== undefined) updateData.specializations = specializations;
    if (content_creator_agreement_sign_date !== undefined) {
      updateData.content_creator_agreement_sign_date = new Date(content_creator_agreement_sign_date);
    }

    // Onboarding fields
    if (onboarding_completed !== undefined) updateData.onboarding_completed = onboarding_completed;
    if (birth_date !== undefined) updateData.birth_date = birth_date;
    if (user_type !== undefined) updateData.user_type = user_type;
    if (invitation_code !== undefined) updateData.invitation_code = invitation_code;

    // Add updated timestamp
    updateData.updated_at = new Date();
    
    // Update the user
    await user.update(updateData);
    
    // Return updated user data
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      education_level: user.education_level,
      specializations: user.specializations,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      onboarding_completed: user.onboarding_completed,
      birth_date: user.birth_date,
      invitation_code: user.invitation_code,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Create custom token (for server-side auth)
router.post('/custom-token', async (req, res) => {
  try {
    const { uid, claims } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    // First try Firebase token creation if available
    if (admin && admin.auth) {
      try {
        const customToken = await admin.auth().createCustomToken(uid, claims);
        return res.json({ customToken });
      } catch (firebaseError) {
      }
    }

    // Fallback to JWT token
    const user = await authService.getUserByToken(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customToken = authService.createJWTToken({
      id: user.id,
      email: user.email,
      role: user.role,
      ...claims,
      type: 'jwt'
    });
    
    res.json({ customToken });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create custom token' });
  }
});

// Set custom claims for user (admin only)
router.post('/set-claims', authenticateToken, async (req, res) => {
  try {
    const { uid, claims } = req.body;
    
    if (!uid) {
      return res.status(400).json({ error: 'UID is required' });
    }

    const result = await authService.setCustomClaims({
      adminUserId: req.user.id,
      targetUserId: uid,
      claims
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify ID token endpoint
router.post('/verify', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }

    // Detect portal from request
    const portal = detectPortal(req);

    const tokenData = await authService.verifyToken(idToken);

    // Get the actual user from database (like loginWithEmailPassword does)
    const user = await models.User.findByPk(tokenData.id);
    if (!user) {
      throw new Error('User not found');
    }

    // Update last login (like loginWithEmailPassword does)
    await user.update({ last_login: new Date() });

    // Create user session with metadata and portal context
    const sessionMetadata = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.socket?.remoteAddress || 'Unknown',
      timestamp: new Date(),
      loginMethod: 'firebase_google'
    };

    authService.createSession(user.id, sessionMetadata, portal);

    // Generate proper access and refresh tokens using AuthService
    const result = await authService.generateTokenPair(user, sessionMetadata);

    // Get portal-specific cookie names
    const cookieNames = getPortalCookieNames(portal);

    // Set access token as httpOnly cookie (15 minutes) with portal-specific name
    const accessConfig = createPortalAccessTokenConfig(portal);
    logCookieConfig(`Verify ${portal} - Access Token`, accessConfig);
    res.cookie(cookieNames.accessToken, result.accessToken, accessConfig);

    // Set refresh token as httpOnly cookie (7 days) with portal-specific name
    const refreshConfig = createPortalRefreshTokenConfig(portal);
    logCookieConfig(`Verify ${portal} - Refresh Token`, refreshConfig);
    res.cookie(cookieNames.refreshToken, result.refreshToken, refreshConfig);

    res.json({
      valid: true,
      user: {
        id: tokenData.id,
        email: tokenData.email,
        full_name: tokenData.name,
        role: tokenData.role,
        is_verified: tokenData.email_verified
      }
    });
  } catch (error) {
    res.status(401).json({
      valid: false,
      error: error.message || 'Invalid or expired token'
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', rateLimiters.auth, validateBody(schemas.passwordReset), async (req, res) => {
  try {
    const result = await authService.generatePasswordResetToken(req.body.email);
    
    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail({
        email: req.body.email,
        resetToken: result.token,
        expiresIn: result.expiresIn
      });
    } catch (emailError) {
      clog('Failed to send password reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Reset password endpoint
router.post('/reset-password', rateLimiters.auth, validateBody(schemas.newPassword), async (req, res) => {
  try {
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// =============================================
// ADMIN SESSION MANAGEMENT ROUTES
// =============================================

// Get session statistics (admin only)
router.get('/sessions/stats', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    const stats = authService.getSessionStats();
    res.json({
      message: 'Session statistics retrieved successfully',
      stats
    });
  } catch (error) {
    cerror('Failed to get session stats:', error);
    res.status(500).json({ error: 'Failed to retrieve session statistics' });
  }
});

// Get user sessions (admin only)
router.get('/sessions/user/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const userSessions = authService.getUserSessions(userId);
    res.json({
      message: `Sessions for user ${userId} retrieved successfully`,
      userId,
      sessions: userSessions,
      count: userSessions.length
    });
  } catch (error) {
    cerror('Failed to get user sessions:', error);
    res.status(500).json({ error: 'Failed to retrieve user sessions' });
  }
});

// Invalidate user sessions (admin only)
router.post('/sessions/invalidate/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const invalidatedCount = authService.invalidateUserSessions(userId);
    res.json({
      message: `Successfully invalidated ${invalidatedCount} sessions for user ${userId}`,
      userId,
      invalidatedCount
    });
  } catch (error) {
    cerror('Failed to invalidate user sessions:', error);
    res.status(500).json({ error: 'Failed to invalidate user sessions' });
  }
});

// Force cleanup of expired sessions (admin only)
router.post('/sessions/cleanup', authenticateToken, requireAdmin, async (_req, res) => {
  try {
    authService.cleanupExpiredSessions();
    await authService.cleanupExpiredTokens();

    const stats = authService.getSessionStats();
    res.json({
      message: 'Session cleanup completed successfully',
      currentStats: stats
    });
  } catch (error) {
    cerror('Failed to cleanup sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

export default router;