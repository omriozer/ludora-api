import express from 'express';
import { admin } from '../config/firebase.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import AuthService from '../services/AuthService.js';

const authService = new AuthService();
import EmailService from '../services/EmailService.js';

const router = express.Router();

// Login endpoint with validation and rate limiting
router.post('/login', rateLimiters.auth, validateBody(schemas.login), async (req, res) => {
  try {
    const result = await authService.loginWithEmailPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Register endpoint
router.post('/register', rateLimiters.auth, validateBody(schemas.register), async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    
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
    const user = await authService.getUserByToken(req.headers.authorization?.replace('Bearer ', ''));
    
    // Return clean user data - all from database, no confusing customClaims
    res.json({
      id: user.id,
      uid: user.id, // For compatibility
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      education_level: user.education_level,
      specializations: user.specializations, // Add specializations for teacher onboarding
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      onboarding_completed: user.onboarding_completed,
      birth_date: user.birth_date, // Add birth_date for onboarding

      // Subscription fields
      current_subscription_plan_id: user.current_subscription_plan_id,
      subscription_status: user.subscription_status,
      subscription_start_date: user.subscription_start_date,
      subscription_end_date: user.subscription_end_date,
      subscription_status_updated_at: user.subscription_status_updated_at,
      payplus_subscription_uid: user.payplus_subscription_uid,

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
    const user = await authService.getUserByToken(req.headers.authorization?.replace('Bearer ', ''));
    const {
      full_name,
      phone,
      education_level,
      specializations,
      content_creator_agreement_sign_date,
      onboarding_completed,
      birth_date,
      user_type,
      current_subscription_plan_id,
      subscription_status,
      subscription_start_date,
      subscription_end_date,
      subscription_status_updated_at,
      payplus_subscription_uid
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

    // Subscription fields
    if (current_subscription_plan_id !== undefined) updateData.current_subscription_plan_id = current_subscription_plan_id;
    if (subscription_status !== undefined) updateData.subscription_status = subscription_status;
    if (subscription_start_date !== undefined) updateData.subscription_start_date = subscription_start_date;
    if (subscription_end_date !== undefined) updateData.subscription_end_date = subscription_end_date;
    if (subscription_status_updated_at !== undefined) updateData.subscription_status_updated_at = subscription_status_updated_at;
    if (payplus_subscription_uid !== undefined) updateData.payplus_subscription_uid = payplus_subscription_uid;
    
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
      specializations: user.specializations,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      onboarding_completed: user.onboarding_completed,
      birth_date: user.birth_date,

      // Subscription fields
      current_subscription_plan_id: user.current_subscription_plan_id,
      subscription_status: user.subscription_status,
      subscription_start_date: user.subscription_start_date,
      subscription_end_date: user.subscription_end_date,
      subscription_status_updated_at: user.subscription_status_updated_at,
      payplus_subscription_uid: user.payplus_subscription_uid,

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
    const user = await authService.getUserByToken(uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const customToken = authService.createJWTToken({
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

    const result = await authService.setCustomClaims({
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

    const tokenData = await authService.verifyToken(idToken);
    
    // Create our own JWT token for the verified user
    const jwtToken = authService.createJWTToken({
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
    const result = await authService.generatePasswordResetToken(req.body.email);
    
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
    const result = await authService.resetPassword(req.body);
    res.json(result);
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(400).json({ error: error.message });
  }
});

export default router;