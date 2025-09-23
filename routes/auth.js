import express from 'express';
import { admin } from '../config/firebase.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import AuthService from '../services/AuthService.js';
import EmailService from '../services/EmailService.js';

const router = express.Router();

// Login endpoint with validation and rate limiting
router.post('/login', rateLimiters.auth, validateBody(schemas.login), async (req, res) => {
  try {
    const result = await AuthService.loginWithEmailPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Register endpoint
router.post('/register', rateLimiters.auth, validateBody(schemas.register), async (req, res) => {
  try {
    const result = await AuthService.registerUser(req.body);
    
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
      console.warn('Failed to send registration email:', emailError);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  try {
    // In production, you might want to invalidate the token
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// Get current user info
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await AuthService.getUserByToken(req.headers.authorization?.replace('Bearer ', ''));
    
    // Return clean user data - all from database, no confusing customClaims
    res.json({
      id: user.id,
      uid: user.id, // For compatibility
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      education_level: user.education_level,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      
      // Keep some fields for compatibility but mark deprecated
      displayName: user.full_name, // @deprecated - use full_name
      emailVerified: user.is_verified, // @deprecated - use is_verified
      disabled: !user.is_active, // @deprecated - use is_active
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user information' });
  }
});

// Update current user profile
router.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    const user = await AuthService.getUserByToken(req.headers.authorization?.replace('Bearer ', ''));
    const { full_name, phone, education_level, content_creator_agreement_sign_date } = req.body;
    
    // Only allow updating specific fields
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (education_level !== undefined) updateData.education_level = education_level;
    if (content_creator_agreement_sign_date !== undefined) {
      updateData.content_creator_agreement_sign_date = new Date(content_creator_agreement_sign_date);
    }
    
    // Add updated timestamp
    updateData.updated_at = new Date();
    
    // Update the user
    await user.update(updateData);
    
    // Return updated user data
    res.json({
      id: user.id,
      uid: user.id,
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      education_level: user.education_level,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_login: user.last_login,
      
      // Keep some fields for compatibility
      displayName: user.full_name,
      emailVerified: user.is_verified,
      disabled: !user.is_active,
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
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
        console.warn('Firebase custom token creation failed:', firebaseError);
      }
    }

    // Fallback to JWT token
    const user = await AuthService.getUserByToken(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customToken = AuthService.createJWTToken({
      uid: user.id,
      email: user.email,
      role: user.role,
      ...claims,
      type: 'jwt'
    });
    
    res.json({ customToken });
  } catch (error) {
    console.error('Error creating custom token:', error);
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

    const result = await AuthService.setCustomClaims({
      adminUserId: req.user.uid,
      targetUserId: uid,
      claims
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error setting custom claims:', error);
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

    const tokenData = await AuthService.verifyToken(idToken);
    
    // Create our own JWT token for the verified user
    const jwtToken = AuthService.createJWTToken({
      uid: tokenData.uid,
      email: tokenData.email,
      role: tokenData.role,
      type: 'jwt'
    });
    
    res.json({
      valid: true,
      token: jwtToken,
      user: {
        uid: tokenData.uid,
        email: tokenData.email,
        displayName: tokenData.name,
        role: tokenData.role,
        isVerified: tokenData.email_verified
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      valid: false,
      error: error.message || 'Invalid or expired token'
    });
  }
});

// Forgot password endpoint
router.post('/forgot-password', rateLimiters.auth, validateBody(schemas.passwordReset), async (req, res) => {
  try {
    const result = await AuthService.generatePasswordResetToken(req.body.email);
    
    // Send password reset email
    try {
      await EmailService.sendPasswordResetEmail({
        email: req.body.email,
        resetToken: result.token,
        expiresIn: result.expiresIn
      });
    } catch (emailError) {
      console.warn('Failed to send password reset email:', emailError);
    }

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Reset password endpoint
router.post('/reset-password', rateLimiters.auth, validateBody(schemas.newPassword), async (req, res) => {
  try {
    const result = await AuthService.resetPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;