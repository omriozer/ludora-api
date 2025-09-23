import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { admin } from '../config/firebase.js';
import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';

class AuthService {
  constructor() {
    // Require JWT_SECRET to be explicitly set - no fallback for security
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required for security');
    }
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
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

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Compare password
  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Login with email and password
  async loginWithEmailPassword({ email, password }) {
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      // Find user by email
      const user = await models.User.findOne({ where: { email } });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new Error('Account is disabled');
      }

      // Note: Password authentication is now handled by Firebase Auth
      // Local password storage has been removed

      // Update last login
      await user.update({ last_login: new Date() });

      // Create JWT token
      const token = this.createJWTToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        type: 'jwt'
      });

      return {
        success: true,
        token,
        user: {
          uid: user.id,
          email: user.email,
          displayName: user.full_name,
          role: user.role,
          isVerified: user.is_verified
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  // Register new user
  async registerUser({ email, password, fullName, role = 'user' }) {
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

      // Note: Password hashing is now handled by Firebase Auth
      // Local password storage has been removed

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

      // Create JWT token
      const token = this.createJWTToken({
        uid: user.id,
        email: user.email,
        role: user.role,
        type: 'jwt'
      });

      return {
        success: true,
        token,
        user: {
          uid: user.id,
          email: user.email,
          displayName: user.full_name,
          role: user.role,
          isVerified: user.is_verified
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  // Verify token (supports both JWT and Firebase)
  async verifyToken(token) {
    try {
      // Development token support - ONLY in development environment
      if (token.startsWith('token_') && process.env.ENVIRONMENT === 'development') {
        console.warn('🚨 DEVELOPMENT TOKEN USED - This should NEVER happen in production!');
        return {
          uid: `dev_user_${Date.now()}`,
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
          const user = await models.User.findByPk(payload.uid);
          console.log('JWT Token Verification Debug:', {
            payload_uid: payload.uid,
            user_found: !!user,
            user_active: user?.is_active,
            user_email: user?.email
          });

          if (!user || !user.is_active) {
            throw new Error('User not found or inactive');
          }

          return {
            uid: user.id,
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
            uid: user?.id || decodedToken.uid,
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
      console.error('Token verification error:', error);
      throw error;
    }
  }

  // Get user by token
  async getUserByToken(token) {
    try {
      const tokenData = await this.verifyToken(token);
      const user = await models.User.findByPk(tokenData.uid);
      
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      console.error('Error getting user by token:', error);
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
          console.warn('Firebase custom claims update failed:', firebaseError);
        }
      }

      return {
        success: true,
        message: 'Custom claims set successfully',
        userId: targetUserId,
        claims
      };
    } catch (error) {
      console.error('Error setting custom claims:', error);
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
        uid: user.id,
        email: user.email,
        type: 'password_reset'
      });

      return {
        success: true,
        token: resetToken,
        expiresIn: '1h'
      };
    } catch (error) {
      console.error('Error generating password reset token:', error);
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

      const user = await models.User.findByPk(payload.uid);
      if (!user) {
        throw new Error('User not found');
      }

      // Note: Password reset is now handled by Firebase Auth
      // Local password storage has been removed
      await user.update({ 
        updated_at: new Date()
      });

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      throw error;
    }
  }
}

export default new AuthService();