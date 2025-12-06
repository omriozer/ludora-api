import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { admin } from '../config/firebase.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { ludlog, luderror } from '../lib/ludlog.js';

class AuthService {
  constructor() {
    // Require JWT_SECRET to be explicitly set - no fallback for security
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required for security');
    }
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // Session cleanup initialization moved to separate method
    // to avoid multiple instantiation during startup
    this._sessionCleanupInitialized = false;
  }

  // Initialize session cleanup jobs with job scheduler
  // Should only be called after JobScheduler is confirmed to be initialized
  async initializeSessionCleanupJobs() {
    // Prevent duplicate initialization
    if (this._sessionCleanupInitialized) {
      return;
    }

    try {
      // Import job scheduler dynamically to avoid circular dependencies
      const jobScheduler = (await import('./JobScheduler.js')).default;

      // Only proceed if JobScheduler is initialized
      if (!jobScheduler.isInitialized) {
        ludlog.generic('JobScheduler not initialized, skipping session cleanup job scheduling');
        return;
      }

      // Schedule frequent cleanup every 2 hours (lighter cleanup)
      await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
        { type: 'light', batchSize: 500 },
        '0 */2 * * *', // Every 2 hours
        { priority: 60 }
      );

      // Schedule deep cleanup every 12 hours (full cleanup)
      await jobScheduler.scheduleRecurringJob('SESSION_CLEANUP',
        { type: 'full', batchSize: 1000 },
        '0 */12 * * *', // Every 12 hours
        { priority: 50 }
      );

      this._sessionCleanupInitialized = true;

      ludlog.generic('Session cleanup jobs scheduled successfully', {
        lightCleanup: 'every 2 hours',
        deepCleanup: 'every 12 hours',
        source: 'AuthService'
      });

    } catch (error) {
      luderror.generic('Error setting up session cleanup jobs:', error);
      // Silent failure - cleanup can still happen on-demand
    }
  }

  // Create JWT token
  createJWTToken(payload) {
    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  // Verify JWT token
  verifyJWTToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Create short-lived access token (15 minutes)
  createAccessToken(payload) {
    const finalPayload = { ...payload, type: payload.type || 'access' };
    return jwt.sign(
      finalPayload,
      this.jwtSecret,
      { expiresIn: '15m' }
    );
  }

  // Create long-lived refresh token (7 days)
  async createRefreshToken(userId, metadata = {}) {
    const refreshTokenId = generateId();
    const refreshToken = jwt.sign(
      {
        id: userId,
        tokenId: refreshTokenId,
        type: 'refresh'
      },
      this.jwtSecret,
      { expiresIn: '7d' }
    );

    // Hash the token for secure storage
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Store refresh token in database with metadata
    await models.RefreshToken.create({
      id: refreshTokenId,
      user_id: userId,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      metadata: {
        created_via: 'login',
        user_agent: metadata.userAgent || 'unknown',
        ip_address: metadata.ipAddress || 'unknown',
        login_method: metadata.loginMethod || 'email_password',
        ...metadata
      },
      created_at: new Date(),
      updated_at: new Date()
    });

    return { refreshToken, refreshTokenId };
  }

  // Generate both access and refresh tokens for a user
  async generateTokenPair(user, metadata = {}) {
    const accessToken = this.createAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    const { refreshToken, refreshTokenId } = await this.createRefreshToken(user.id, metadata);

    return {
      accessToken,
      refreshToken,
      refreshTokenId
    };
  }

  // Verify refresh token and return user
  async verifyRefreshToken(refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, this.jwtSecret);

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Hash the token to match stored hash
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

      // Check database for token
      const tokenRecord = await models.RefreshToken.findOne({
        where: {
          id: payload.tokenId,
          token_hash: tokenHash,
          revoked_at: null // Not manually revoked
        },
        include: [{
          model: models.User,
          as: 'User'
        }]
      });

      if (!tokenRecord) {
        throw new Error('Refresh token not found or revoked');
      }

      // Check if token expired
      if (tokenRecord.isExpired()) {
        // Clean up expired token
        await tokenRecord.destroy();
        throw new Error('Refresh token expired');
      }

      const user = tokenRecord.User;
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      // Update last used timestamp
      await tokenRecord.updateLastUsed();

      return { user, tokenId: payload.tokenId };
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken) {
    const { user, tokenId } = await this.verifyRefreshToken(refreshToken);

    // Generate new access token
    const newAccessToken = this.createAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    return {
      accessToken: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_verified: user.is_verified
      }
    };
  }

  // Revoke a refresh token
  async revokeRefreshToken(refreshTokenId) {
    await models.RefreshToken.update(
      {
        revoked_at: new Date(),
        updated_at: new Date()
      },
      { where: { id: refreshTokenId } }
    );
  }

  // Cleanup expired refresh tokens
  async cleanupExpiredTokens() {
    await models.RefreshToken.destroy({
      where: {
        expires_at: { [models.Sequelize.Op.lt]: new Date() }
      }
    });
  }

  // Get all active refresh tokens for a user
  async getUserRefreshTokens(userId) {
    return await models.RefreshToken.findAll({
      where: {
        user_id: userId,
        revoked_at: null,
        expires_at: { [models.Sequelize.Op.gt]: new Date() }
      },
      order: [['created_at', 'DESC']]
    });
  }

  // Revoke all refresh tokens for a user
  async revokeUserRefreshTokens(userId) {
    const revokedCount = await models.RefreshToken.update(
      {
        revoked_at: new Date(),
        updated_at: new Date()
      },
      {
        where: {
          user_id: userId,
          revoked_at: null
        }
      }
    );
    return revokedCount[0];
  }

  // Session Management Methods

  // Create a new user session with portal context
  async createSession(userId, metadata = {}, portal = 'teacher') {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    // Use the UserSession model's createUserSession method to include portal
    await models.UserSession.createUserSession(sessionId, userId, expiresAt, {
      userAgent: metadata.userAgent || 'Unknown',
      ipAddress: metadata.ipAddress || 'Unknown',
      loginMethod: metadata.loginMethod || 'email_password', // email_password, firebase, etc.
      ...metadata
    }, portal);

    return sessionId;
  }

  // Validate and refresh a session
  async validateSession(sessionId) {
    try {
      const session = await models.UserSession.findByPk(sessionId);

      if (!session) {
        return null;
      }

      // Lazy cleanup: Clean expired sessions for this user only (with performance limit)
      // 10% probability to reduce overhead
      if (Math.random() < 0.1 && session.user_id) {
        await models.UserSession.destroy({
          where: {
            user_id: session.user_id,
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: 100 // Performance limit
        });

        // Also clean expired refresh tokens for this user
        await models.RefreshToken.destroy({
          where: {
            user_id: session.user_id,
            expires_at: { [models.Sequelize.Op.lt]: new Date() }
          },
          limit: 100 // Performance limit
        });
      }

      // Check if session is active (not expired, not invalidated, and is_active flag is true)
      if (!session.isActive()) {
        // Don't destroy - let cleanup handle it with grace period
        return null;
      }

      // Auto-extend session for active users (if expires within 2 hours)
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
      if (session.expires_at < twoHoursFromNow) {
        await session.extendExpiration(24); // Extend by 24 hours
      }

      // Update last accessed time
      await session.updateLastAccessed();

      return {
        sessionId: session.id,
        userId: session.user_id,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
        expiresAt: session.expires_at,
        isActive: session.is_active,
        metadata: session.metadata
      };
    } catch (error) {
      return null;
    }
  }

  // Invalidate a specific session
  async invalidateSession(sessionId) {
    try {
      const session = await models.UserSession.findByPk(sessionId);
      if (session) {
        await session.invalidate();
      }
    } catch (error) {
      // Silent failure for session invalidation
    }
  }

  // Invalidate all sessions for a user
  async invalidateUserSessions(userId) {
    try {
      return await models.UserSession.invalidateUserSessions(userId);
    } catch (error) {
      return 0;
    }
  }

  // Get active sessions for a user
  async getUserSessions(userId) {
    try {
      const sessions = await models.UserSession.findUserActiveSessions(userId);
      return sessions.map(session => ({
        sessionId: session.id,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
        expiresAt: session.expires_at,
        metadata: session.metadata
      }));
    } catch (error) {
      return [];
    }
  }

  // Get session statistics
  async getSessionStats() {
    try {
      const now = new Date();

      // Get counts from database
      const [activeSessions, expiredSessions, totalSessions, uniqueUsers] = await Promise.all([
        models.UserSession.count({
          where: {
            is_active: true,
            expires_at: { [models.Sequelize.Op.gt]: now },
            invalidated_at: null
          }
        }),
        models.UserSession.count({
          where: {
            [models.Sequelize.Op.or]: [
              { is_active: false },
              { expires_at: { [models.Sequelize.Op.lte]: now } },
              { invalidated_at: { [models.Sequelize.Op.ne]: null } }
            ]
          }
        }),
        models.UserSession.count(),
        models.UserSession.count({
          distinct: true,
          col: 'user_id',
          where: {
            is_active: true,
            expires_at: { [models.Sequelize.Op.gt]: now },
            invalidated_at: null
          }
        })
      ]);

      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        uniqueActiveUsers: uniqueUsers,
        averageSessionsPerUser: uniqueUsers > 0 ? activeSessions / uniqueUsers : 0,
        timestamp: now
      };
    } catch (error) {
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        uniqueActiveUsers: 0,
        averageSessionsPerUser: 0,
        timestamp: new Date()
      };
    }
  }

  // Portal-aware session management methods

  // Invalidate all sessions for a user in a specific portal
  async invalidateUserPortalSessions(userId, portal, exceptSessionId = null) {
    try {
      return await models.UserSession.invalidateUserSessionsByPortal(userId, portal, exceptSessionId);
    } catch (error) {
      return 0;
    }
  }

  // Check if user has active sessions in a specific portal
  async hasActivePortalSession(userId, portal) {
    try {
      return await models.UserSession.hasActivePortalSession(userId, portal);
    } catch (error) {
      return false;
    }
  }

  // Get active sessions for a user in a specific portal
  async getUserPortalSessions(userId, portal) {
    try {
      const sessions = await models.UserSession.findUserActiveSessionsByPortal(userId, portal);
      return sessions.map(session => ({
        sessionId: session.id,
        portal: session.portal,
        createdAt: session.created_at,
        lastAccessedAt: session.last_accessed_at,
        expiresAt: session.expires_at,
        metadata: session.metadata
      }));
    } catch (error) {
      return [];
    }
  }

  // Logout user from specific portal
  async logoutUserFromPortal(userId, portal, sessionId = null, refreshTokenId = null) {
    try {
      if (sessionId) {
        // Invalidate specific session (only if it belongs to the portal)
        const session = await models.UserSession.findByPk(sessionId);
        if (session && session.isPortalSession(portal)) {
          await this.invalidateSession(sessionId);
        }
      } else {
        // Invalidate all user sessions for this portal
        await this.invalidateUserPortalSessions(userId, portal);
      }

      if (refreshTokenId) {
        // Revoke specific refresh token
        await this.revokeRefreshToken(refreshTokenId);
      }

      return {
        success: true,
        message: `Successfully logged out from ${portal} portal`
      };
    } catch (error) {
      throw error;
    }
  }

  // Cleanup expired sessions
  async cleanupExpiredSessions() {
    try {
      await models.UserSession.cleanupExpired();
    } catch (error) {
      // Silent cleanup failure
    }
  }

  // Register new user
  async registerUser({ email, password, fullName, role = 'user' }, sessionMetadata = {}, portal = 'teacher') {
    try {
      // Validate input
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      if (password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      // Check if user already exists
      const existingUser = await models.User.findOne({ where: { email } });
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Password hashing handled by Firebase Auth

      // Create user
      const user = await models.User.create({
        id: generateId(),
        email,
        full_name: fullName || email.split('@')[0],
        role,
        is_active: true,
        is_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      });

      // Create user session with metadata and portal context
      const sessionId = await this.createSession(user.id, {
        ...sessionMetadata,
        loginMethod: 'registration'
      }, portal);

      // Generate token pair
      const { accessToken, refreshToken } = await this.generateTokenPair(user, {
        ...sessionMetadata,
        loginMethod: 'registration'
      });

      return {
        success: true,
        sessionId,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          is_verified: user.is_verified
        }
      };
    } catch (error) {
      throw error;
    }
  }

  // Logout user and invalidate session
  async logoutUser(userId, sessionId = null, refreshTokenId = null) {
    try {
      if (sessionId) {
        await this.invalidateSession(sessionId);
      } else {
        await this.invalidateUserSessions(userId);
      }

      if (refreshTokenId) {
        await this.revokeRefreshToken(refreshTokenId);
      } else {
        await this.revokeUserRefreshTokens(userId);
      }

      return {
        success: true,
        message: 'Successfully logged out'
      };
    } catch (error) {
      throw error;
    }
  }

  // Verify token (supports both JWT and Firebase)
  async verifyToken(token) {
    try {

      // Development token support - ONLY in development environment
      if (token.startsWith('token_') && process.env.ENVIRONMENT === 'development') {

        return {
          id: `dev_user_${Date.now()}`,
          email: 'dev@example.com',
          role: 'user',
          type: 'development'
        };
      }

      // Reject development tokens in non-development environments
      if (token.startsWith('token_') && process.env.ENVIRONMENT !== 'development') {
        throw new Error('Development tokens are not allowed in production environments');
      }

      // Try JWT verification
      if (token.startsWith('eyJ')) { // JWT tokens typically start with this
        try {
          const payload = this.verifyJWTToken(token);

          if (payload.type === 'player') {
            // Handle player token - look up in Player table
            const PlayerService = await import('../services/PlayerService.js');
            const playerService = new PlayerService.default();
            const player = await playerService.getPlayer(payload.id, true);

            if (!player) {
              throw new Error('Player not found or inactive');
            }

            return {
              id: player.id,
              privacy_code: player.privacy_code,
              display_name: player.display_name,
              type: 'player'
            };
          } else {
            // Handle user token - look up in User table
            const user = await models.User.findByPk(payload.id);

            if (!user || !user.is_active) {
              throw new Error('User not found or inactive');
            }

            const userData = user.toJSON();
            return {
              ...userData,
              type: 'jwt'
            };
          }
        } catch (jwtError) {
          // If JWT fails, try Firebase
        }
      }

      // Try Firebase token verification
      if (admin && admin.auth) {
        ludlog.auth('Attempting Firebase token verification');
        try {
          ludlog.auth('Calling Firebase admin.auth().verifyIdToken()');
          const decodedToken = await admin.auth().verifyIdToken(token);
          ludlog.auth('Firebase token verification successful', {
            uid: decodedToken.uid,
            email: decodedToken.email,
            email_verified: decodedToken.email_verified
          });

          // Find or create user in our database
          ludlog.auth('Looking for existing user in database', { email: decodedToken.email });
          let user;

          try {
            user = await models.User.findOne({ where: { email: decodedToken.email } });
            ludlog.auth('Database query completed', { userFound: !!user, userId: user?.id });
          } catch (dbError) {
            luderror.auth.prod('Database query failed when looking for user:', {
              email: decodedToken.email,
              error: {
                message: dbError.message,
                name: dbError.name,
                stack: dbError.stack,
                code: dbError.code
              }
            });
            throw dbError;
          }

          if (!user && decodedToken.email) {
            ludlog.auth('User not found, creating new user', { uid: decodedToken.uid, email: decodedToken.email });
            try {
              user = await models.User.create({
                id: decodedToken.uid,
                email: decodedToken.email,
                full_name: decodedToken.name || decodedToken.email.split('@')[0],
                is_verified: decodedToken.email_verified,
                is_active: true,
                role: 'user',
                created_at: new Date(),
                updated_at: new Date()
              });
              ludlog.auth('New user created successfully', { id: user.id });
            } catch (createError) {
              luderror.auth.prod('User creation failed:', {
                uid: decodedToken.uid,
                email: decodedToken.email,
                error: {
                  message: createError.message,
                  name: createError.name,
                  stack: createError.stack,
                  code: createError.code
                }
              });
              throw createError;
            }
          } else {
            ludlog.auth('Existing user found', { id: user?.id });
          }

          ludlog.auth('Building userData object', { hasUser: !!user, userId: user?.id });
          const userData = user ? user.toJSON() : {
            id: decodedToken.uid,
            email: decodedToken.email,
            full_name: decodedToken.name || decodedToken.email.split('@')[0],
            role: 'user',
            is_verified: decodedToken.email_verified,
            is_active: true
          };
          ludlog.auth('UserData built successfully', { userId: userData.id });

          ludlog.auth('Firebase authentication completed successfully', { userId: userData.id });
          return {
            ...userData,
            type: 'firebase'
          };
        } catch (firebaseError) {
          // CRITICAL: Log the actual Firebase error before masking it
          luderror.auth.prod('Firebase token verification failed - ACTUAL ERROR:', {
            errorMessage: firebaseError.message,
            errorCode: firebaseError.code,
            errorName: firebaseError.name,
            errorStack: firebaseError.stack,
            tokenPrefix: token ? token.substring(0, 20) + '...' : 'no token',
            firebaseConfigPresent: !!admin,
            firebaseAuthPresent: !!(admin && admin.auth),
            timestamp: new Date().toISOString()
          });
          throw new Error('Invalid or expired token');
        }
      }

      throw new Error('Invalid token format');
    } catch (error) {
      throw error;
    }
  }

  // Get user by token
  async getUserByToken(token) {
    try {
      const tokenData = await this.verifyToken(token);
      const user = await models.User.findByPk(tokenData.id);

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  // Set custom claims (admin only)
  async setCustomClaims({ adminUserId, targetUserId, claims }) {
    try {
      // Verify admin user (admin or sysadmin can set claims)
      const adminUser = await models.User.findByPk(adminUserId);
      if (!adminUser || (adminUser.role !== 'admin' && adminUser.role !== 'sysadmin')) {
        throw new Error('Admin access required');
      }

      // Update target user
      const targetUser = await models.User.findByPk(targetUserId);
      if (!targetUser) {
        throw new Error('Target user not found');
      }

      // Update role if specified in claims
      if (claims.role) {
        await targetUser.update({ role: claims.role });
      }

      // If using Firebase, update Firebase custom claims too
      if (admin && admin.auth) {
        try {
          await admin.auth().setCustomUserClaims(targetUserId, claims);
        } catch (firebaseError) {
          // Firebase custom claims update failed - continue without throwing
        }
      }

      return {
        success: true,
        message: 'Custom claims set successfully',
        userId: targetUserId,
        claims
      };
    } catch (error) {
      throw error;
    }
  }

  // Validate user permissions
  validatePermissions(user, requiredRole = 'user') {
    if (!user) {
      throw new Error('Authentication required');
    }

    if (!user.is_active) {
      throw new Error('Account is disabled');
    }

    const roleHierarchy = {
      'user': 0,
      'admin': 1,
      'sysadmin': 2
    };

    const userLevel = roleHierarchy[user.role] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    if (userLevel < requiredLevel) {
      throw new Error(`${requiredRole} access required`);
    }

    return true;
  }

  // Generate password reset token
  async generatePasswordResetToken(email) {
    try {
      const user = await models.User.findOne({ where: { email } });
      if (!user) {
        throw new Error('User not found');
      }

      const resetToken = this.createJWTToken({
        id: user.id,
        email: user.email,
        type: 'password_reset'
      });

      return {
        success: true,
        token: resetToken,
        expiresIn: '1h'
      };
    } catch (error) {
      throw error;
    }
  }

  // Reset password
  async resetPassword({ token, newPassword }) {
    try {
      const payload = this.verifyJWTToken(token);

      if (payload.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      if (newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }

      const user = await models.User.findByPk(payload.id);
      if (!user) {
        throw new Error('User not found');
      }

      // Password reset handled by Firebase Auth
      await user.update({
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      throw error;
    }
  }

  // 12-hour safety net cleanup (not a frequent cleanup)
  // This only runs as a safety net - primary cleanup is lazy on access
  async safetyNetCleanup() {
    try {
      // Clean expired sessions with batch limit
      const deletedSessions = await models.UserSession.destroy({
        where: {
          expires_at: { [models.Sequelize.Op.lt]: new Date() }
        },
        limit: 1000 // Batch limit to prevent blocking
      });

      // Clean expired refresh tokens with batch limit
      const deletedTokens = await models.RefreshToken.destroy({
        where: {
          expires_at: { [models.Sequelize.Op.lt]: new Date() }
        },
        limit: 1000 // Batch limit to prevent blocking
      });

      if (deletedSessions > 0 || deletedTokens > 0) {

      }
    } catch (error) {
      // Silent failure for safety net cleanup

    }
  }
}

// Export singleton instance to prevent multiple instantiations
let authServiceInstance = null;

const getAuthServiceInstance = () => {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
};

export default getAuthServiceInstance();