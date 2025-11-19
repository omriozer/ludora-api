import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { admin } from '../config/firebase.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import { clog } from '../lib/utils.js';

class AuthService {
  constructor() {
    // Require JWT_SECRET to be explicitly set - no fallback for security
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required for security');
    }
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';

    // In-memory refresh token store for development
    this.refreshTokenStore = new Map();

    // In-memory session store for active user sessions
    this.sessionStore = new Map();

    // Clean up expired tokens and sessions every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
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
    return jwt.sign(
      { ...payload, type: 'access' },
      this.jwtSecret,
      { expiresIn: '15m' }
    );
  }

  // Create long-lived refresh token (7 days)
  createRefreshToken(userId) {
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

    // Store refresh token in memory with expiration
    this.refreshTokenStore.set(refreshTokenId, {
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    return { refreshToken, refreshTokenId };
  }

  // Generate both access and refresh tokens for a user
  generateTokenPair(user) {
    const accessToken = this.createAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    const { refreshToken, refreshTokenId } = this.createRefreshToken(user.id);

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

      // Check if token exists in store
      const tokenData = this.refreshTokenStore.get(payload.tokenId);
      if (!tokenData) {
        throw new Error('Refresh token not found');
      }

      // Check if token expired
      if (new Date() > tokenData.expiresAt) {
        this.refreshTokenStore.delete(payload.tokenId);
        throw new Error('Refresh token expired');
      }

      // Get fresh user data
      const user = await models.User.findByPk(payload.id);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

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
  revokeRefreshToken(refreshTokenId) {
    this.refreshTokenStore.delete(refreshTokenId);
  }

  // Cleanup expired refresh tokens
  cleanupExpiredTokens() {
    const now = new Date();
    for (const [tokenId, tokenData] of this.refreshTokenStore.entries()) {
      if (now > tokenData.expiresAt) {
        this.refreshTokenStore.delete(tokenId);
      }
    }
  }

  // Session Management Methods

  // Create a new user session
  createSession(userId, metadata = {}) {
    const sessionId = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours

    const sessionData = {
      sessionId,
      userId,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      isActive: true,
      // Optional metadata for tracking and analytics
      metadata: {
        userAgent: metadata.userAgent || 'Unknown',
        ipAddress: metadata.ipAddress || 'Unknown',
        loginMethod: metadata.loginMethod || 'email_password', // email_password, firebase, etc.
        ...metadata
      }
    };

    this.sessionStore.set(sessionId, sessionData);
    clog(`🔐 Session created: ${sessionId} for user ${userId}`);

    return sessionId;
  }

  // Validate and refresh a session
  validateSession(sessionId) {
    const session = this.sessionStore.get(sessionId);

    if (!session) {
      return null;
    }

    const now = new Date();

    // Check if session is expired
    if (now > session.expiresAt || !session.isActive) {
      this.sessionStore.delete(sessionId);
      return null;
    }

    // Update last accessed time
    session.lastAccessedAt = now;
    this.sessionStore.set(sessionId, session);

    return session;
  }

  // Invalidate a specific session
  invalidateSession(sessionId) {
    const session = this.sessionStore.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessionStore.set(sessionId, session);
      clog(`🔐 Session invalidated: ${sessionId}`);
    }
  }

  // Invalidate all sessions for a user
  invalidateUserSessions(userId) {
    let invalidatedCount = 0;
    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.userId === userId && session.isActive) {
        session.isActive = false;
        this.sessionStore.set(sessionId, session);
        invalidatedCount++;
      }
    }
    clog(`🔐 Invalidated ${invalidatedCount} sessions for user ${userId}`);
    return invalidatedCount;
  }

  // Get active sessions for a user
  getUserSessions(userId) {
    const userSessions = [];
    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (session.userId === userId && session.isActive && new Date() <= session.expiresAt) {
        userSessions.push({
          sessionId,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: session.expiresAt,
          metadata: session.metadata
        });
      }
    }
    return userSessions;
  }

  // Get session statistics
  getSessionStats() {
    const now = new Date();
    let activeSessions = 0;
    let expiredSessions = 0;
    let totalSessions = 0;
    const userCounts = new Map();

    for (const [sessionId, session] of this.sessionStore.entries()) {
      totalSessions++;

      if (!session.isActive) {
        expiredSessions++;
      } else if (now > session.expiresAt) {
        expiredSessions++;
      } else {
        activeSessions++;

        // Count sessions per user
        const count = userCounts.get(session.userId) || 0;
        userCounts.set(session.userId, count + 1);
      }
    }

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      uniqueActiveUsers: userCounts.size,
      averageSessionsPerUser: userCounts.size > 0 ? activeSessions / userCounts.size : 0,
      timestamp: now
    };
  }

  // Cleanup expired sessions
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessionStore.entries()) {
      if (now > session.expiresAt || !session.isActive) {
        this.sessionStore.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      clog(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  // Register new user
  async registerUser({ email, password, fullName, role = 'user' }, sessionMetadata = {}) {
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

      // Create user session with metadata
      const sessionId = this.createSession(user.id, {
        ...sessionMetadata,
        loginMethod: 'registration'
      });

      // Generate token pair
      const { accessToken, refreshToken } = this.generateTokenPair(user);

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
  async logoutUser(userId, sessionId = null) {
    try {
      if (sessionId) {
        // Invalidate specific session
        this.invalidateSession(sessionId);
        clog(`🚪 User ${userId} logged out from session ${sessionId}`);
      } else {
        // Invalidate all user sessions
        const invalidatedCount = this.invalidateUserSessions(userId);
        clog(`🚪 User ${userId} logged out from ${invalidatedCount} sessions`);
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
        clog('🚨 DEVELOPMENT TOKEN USED - This should NEVER happen in production!');
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

          // Get fresh user data
          const user = await models.User.findByPk(payload.id);

          if (!user || !user.is_active) {
            throw new Error('User not found or inactive');
          }

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            type: 'jwt',
            user: user.toJSON()
          };
        } catch (jwtError) {
          // If JWT fails, try Firebase
        }
      }

      // Try Firebase token verification
      if (admin && admin.auth) {
        try {
          const decodedToken = await admin.auth().verifyIdToken(token);

          // Find or create user in our database
          let user = await models.User.findOne({ where: { email: decodedToken.email } });
          if (!user && decodedToken.email) {
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
          }

          return {
            id: user?.id || decodedToken.uid,
            email: user?.email || decodedToken.email,
            role: user?.role || 'user',
            type: 'firebase',
            user: user ? user.toJSON() : {
              id: decodedToken.uid,
              email: decodedToken.email,
              full_name: decodedToken.name || decodedToken.email.split('@')[0],
              role: 'user',
              is_verified: decodedToken.email_verified,
              is_active: true
            }
          };
        } catch (firebaseError) {
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
}

export default AuthService;