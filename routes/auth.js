import express from 'express';
import crypto from 'crypto';
import { admin } from '../config/firebase.js';
import { authenticateToken, authenticateUserOrPlayer, requireAdmin } from '../middleware/auth.js';
import { addETagSupport } from '../middleware/etagMiddleware.js';
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
import { isProd } from '../src/utils/environment.js';

const authService = AuthService; // Use singleton instance
import EmailService from '../services/EmailService.js';
import SettingsService from '../services/SettingsService.js';
import SubscriptionPermissionsService from '../services/SubscriptionPermissionsService.js';
import { luderror, ludlog } from '../lib/ludlog.js';

// =============================================
// TEACHER CONNECTION VALIDATION HELPERS
// =============================================

/**
 * Check if a student has an existing active classroom membership
 * @param {string} studentId - Student user/player ID
 * @returns {Promise<boolean>} - True if has active membership
 */
const checkExistingMembership = async (studentId) => {
  if (!studentId) return false;

  const membership = await models.ClassroomMembership.findOne({
    where: {
      student_id: studentId,
      status: 'active'
    }
  });

  return !!membership;
};

/**
 * Create classroom membership if needed during login
 * @param {string} studentId - Student user/player ID
 * @param {string} teacherId - Teacher user ID
 * @param {object} transaction - Optional Sequelize transaction
 * @returns {Promise<object>} - Created or existing membership
 */
const createMembershipIfNeeded = async (studentId, teacherId, transaction = null) => {
  if (!studentId || !teacherId) {
    throw new Error('Student ID and Teacher ID are required');
  }

  try {
    // Check if membership already exists
    const existingMembership = await models.ClassroomMembership.findOne({
      where: {
        student_id: studentId,
        teacher_id: teacherId
      },
      transaction
    });

    if (existingMembership) {
      ludlog.auth('Existing membership found during login:', {
        membershipId: existingMembership.id,
        studentId,
        teacherId,
        status: existingMembership.status
      });
      return existingMembership;
    }

    // Validate teacher has active subscription with classroom benefits
    const hasClassroomBenefits = await validateTeacherSubscription(teacherId);
    if (!hasClassroomBenefits) {
      throw new Error('Teacher does not have active subscription with classroom benefits');
    }

    // Create new membership
    const membership = await models.ClassroomMembership.create({
      teacher_id: teacherId,
      student_id: studentId,
      classroom_id: null, // General teacher connection, no specific classroom
      status: 'active',
      requested_at: new Date(),
      approved_at: new Date(),
      request_message: 'Auto-created during login flow with teacher connection',
      approval_message: 'Automatic approval for invitation-based teacher connection'
    }, { transaction });

    ludlog.auth('New membership auto-created during login:', {
      membershipId: membership.id,
      studentId,
      teacherId,
      status: membership.status
    });

    return membership;
  } catch (error) {
    luderror.auth('Failed to create membership during login:', {
      studentId,
      teacherId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Validate teacher has active subscription with classroom benefits
 * @param {string} teacherId - Teacher user ID
 * @returns {Promise<boolean>} - True if has valid subscription
 */
const validateTeacherSubscription = async (teacherId) => {
  try {
    const teacher = await models.User.findByPk(teacherId);
    if (!teacher || teacher.user_type !== 'teacher') {
      ludlog.auth('Teacher validation failed - not found or not teacher:', {
        teacherId,
        found: !!teacher,
        userType: teacher?.user_type
      });
      return false;
    }

    // Check for active subscription with classroom benefits
    const activeSubscription = await models.SubscriptionHistory.findOne({
      where: {
        user_id: teacherId,
        status: 'active',
        end_date: { [models.sequelize.Op.gt]: new Date() } // Not expired
      },
      include: [{
        model: models.SubscriptionPlan,
        where: {
          is_active: true
        }
      }]
    });

    if (!activeSubscription) {
      ludlog.auth('No active subscription found for teacher:', { teacherId });
      return false;
    }

    // Check if plan includes classroom benefits
    const benefits = activeSubscription.SubscriptionPlan?.benefits;
    const hasClassroomBenefits = benefits?.classroom_management?.enabled === true;

    ludlog.auth('Teacher subscription validation result:', {
      teacherId,
      hasActiveSubscription: true,
      hasClassroomBenefits,
      subscriptionId: activeSubscription.id,
      planId: activeSubscription.subscription_plan_id
    });

    return hasClassroomBenefits;
  } catch (error) {
    luderror.auth('Error validating teacher subscription:', {
      teacherId,
      error: error.message
    });
    return false;
  }
};

const verifyAdminPassword = (inputPassword) => {
  if (!process.env.ADMIN_PASSWORD) {
    throw new Error('Admin password not configured');
  }

  // Use timing-safe comparison to prevent timing attacks
  const envPassword = Buffer.from(process.env.ADMIN_PASSWORD, 'utf8');
  const inputBuffer = Buffer.from(inputPassword, 'utf8');

  // Ensure both buffers are same length to prevent timing attacks
  if (envPassword.length !== inputBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(envPassword, inputBuffer);
};

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a new user account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token using refresh token cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Refresh token missing or invalid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user and clear authentication cookies
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Logged out from teacher portal successfully"
 *       500:
 *         description: Logout failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
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

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user or player information
 *     tags: [Authentication]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User or player information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/User'
 *                 - $ref: '#/components/schemas/PlayerAuthResponse'
 *       500:
 *         description: Failed to fetch authentication information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get current user or player info (unified endpoint)
router.get('/me', authenticateUserOrPlayer, addETagSupport('auth-me'), async (req, res) => {
  try {
    ludlog.auth('[AUTH-ME] Starting user/player info fetch', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      hasUser: !!req.user,
      hasPlayer: !!req.player
    });

    // Check if authenticated as user or player
    if (req.entityType === 'user' && req.user) {
      ludlog.auth('[AUTH-ME] Processing user authentication', {
        userId: req.user.id,
        email: req.user.email
      });

      // Return user data
      const portal = detectPortal(req);
      ludlog.auth('[AUTH-ME] Portal detected for user', { portal, userId: req.user.id });

      const cookieNames = getPortalCookieNames(portal);
      const accessToken = req.cookies[cookieNames.accessToken];

      ludlog.auth('[AUTH-ME] Fetching user by token', {
        userId: req.user.id,
        portal,
        hasAccessToken: !!accessToken,
        cookieName: cookieNames.accessToken
      });

      let user;
      try {
        user = await authService.getUserByToken(accessToken);
        ludlog.auth('[AUTH-ME] User fetch successful', {
          userId: user.id,
          email: user.email,
          userType: user.user_type,
          portal
        });
      } catch (userFetchError) {
        luderror.auth('[AUTH-ME] Failed to get user by token', {
          userId: req.user.id,
          portal,
          accessTokenPresent: !!accessToken,
          error: userFetchError.message,
          stack: userFetchError.stack
        });
        throw userFetchError;
      }

      // Auto-assign user_type='student' for Firebase users on student portal (if currently null)
      if (portal === 'student' && user.user_type === null) {
        ludlog.auth('[AUTH-ME] Auto-assigning student user_type for user data fetch', {
          userId: user.id,
          email: user.email,
          portal
        });

        try {
          await user.update({ user_type: 'student' });
          ludlog.auth('[AUTH-ME] Student auto-assignment successful', {
            userId: user.id,
            email: user.email
          });
        } catch (updateError) {
          luderror.auth('[AUTH-ME] Failed to auto-assign student user_type during data fetch', {
            userId: user.id,
            email: user.email,
            error: updateError.message,
            portal
          });
          throw updateError;
        }

        // Log the auto-assignment for visibility
        luderror.auth(`[Auto-Assignment] User ${user.id} (${user.email}) assigned user_type='student' on student portal data fetch`);
      }

      ludlog.auth('[AUTH-ME] Fetching cached settings', { userId: user.id });
      let cachedSettings;
      try {
        // Get cached settings once to avoid N+1 query
        cachedSettings = await SettingsService.getSettings();
        ludlog.auth('[AUTH-ME] Cached settings retrieved successfully', {
          userId: user.id,
          settingsCount: Object.keys(cachedSettings).length
        });
      } catch (settingsError) {
        luderror.auth('[AUTH-ME] Failed to get cached settings', {
          userId: user.id,
          email: user.email,
          error: settingsError.message,
          stack: settingsError.stack
        });
        throw settingsError;
      }

      ludlog.auth('[AUTH-ME] Computing onboarding completion status', { userId: user.id });
      let onboardingCompleted;
      try {
        // Compute onboarding_completed based on required fields and feature flag with cached settings
        onboardingCompleted = await user.getOnboardingCompleted(cachedSettings);
        ludlog.auth('[AUTH-ME] Onboarding completion computed successfully', {
          userId: user.id,
          onboardingCompleted
        });
      } catch (onboardingError) {
        luderror.auth('[AUTH-ME] Failed to compute onboarding completion', {
          userId: user.id,
          email: user.email,
          error: onboardingError.message,
          stack: onboardingError.stack
        });
        throw onboardingError;
      }

      ludlog.auth('[AUTH-ME] Computing subscription permissions', { userId: user.id });
      let subscriptionPermissions = null;
      try {
        // Get enriched subscription permissions with current usage
        subscriptionPermissions = await SubscriptionPermissionsService.getEnrichedPermissions(user.id);
        ludlog.auth('[AUTH-ME] Subscription permissions computed successfully', {
          userId: user.id,
          hasPermissions: !!subscriptionPermissions,
          hasClassroomAccess: subscriptionPermissions?.classroom_management?.enabled || false
        });
      } catch (permissionsError) {
        luderror.auth('[AUTH-ME] Failed to compute subscription permissions', {
          userId: user.id,
          email: user.email,
          error: permissionsError.message,
          stack: permissionsError.stack
        });
        // Continue without permissions - don't block user data fetch
      }

      ludlog.auth('[AUTH-ME] User data fetch completed successfully', {
        userId: user.id,
        email: user.email,
        portal,
        userType: user.user_type,
        onboardingCompleted,
        hasSubscriptionPermissions: !!subscriptionPermissions
      });

      // Return clean user data - all from database except computed fields
      return res.json({
        entityType: 'user',
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image_url: user.profile_image_url,
        phone: user.phone,
        education_level: user.education_level,
        specializations: user.specializations,
        content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
        role: user.role,
        user_type: user.user_type,
        is_verified: user.is_verified,
        is_active: user.is_active,
        onboarding_completed: onboardingCompleted,
        birth_date: user.birth_date,
        invitation_code: user.invitation_code,
        linked_teacher_id: user.linked_teacher_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login,
        // NEW: Explicit subscription permissions from backend
        subscription_permissions: subscriptionPermissions
      });
    } else if (req.entityType === 'player' && req.player) {
      ludlog.auth('[AUTH-ME] Processing player authentication', {
        playerId: req.player.id,
        privacyCode: req.player.privacy_code,
        teacherId: req.player.teacher_id
      });

      // Return player data
      return res.json({
        entityType: 'player',
        id: req.player.id,
        privacy_code: req.player.privacy_code,
        display_name: req.player.display_name,
        teacher_id: req.player.teacher_id,
        teacher: req.player.teacher,
        achievements: req.player.achievements,
        preferences: req.player.preferences,
        is_online: req.player.is_online,
        sessionType: req.player.sessionType
      });
    } else {
      luderror.auth('[AUTH-ME] No valid authentication found', {
        ip: req.ip,
        entityType: req.entityType,
        hasUser: !!req.user,
        hasPlayer: !!req.player,
        cookies: Object.keys(req.cookies),
        userAgent: req.get('User-Agent')
      });
      throw new Error('No valid authentication found');
    }
  } catch (error) {
    luderror.auth('[AUTH-ME] Failed to fetch authentication information', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      hasUser: !!req.user,
      hasPlayer: !!req.player,
      error: error.message,
      stack: error.stack,
      portal: detectPortal(req)
    });

    res.status(500).json({ error: 'Failed to fetch authentication information' });
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
      // Note: onboarding_completed is now computed, not stored - removed from destructuring
      birth_date,
      user_type,
      invitation_code
    } = req.body;

    // Only allow updating specific fields
    // Note: onboarding_completed is now computed based on required fields and feature flag
    const updateData = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (education_level !== undefined) updateData.education_level = education_level;
    if (specializations !== undefined) updateData.specializations = specializations;
    if (content_creator_agreement_sign_date !== undefined) {
      updateData.content_creator_agreement_sign_date = new Date(content_creator_agreement_sign_date);
    }

    // Onboarding-related fields (these affect computed onboarding_completed)
    if (birth_date !== undefined) updateData.birth_date = birth_date;
    if (user_type !== undefined) updateData.user_type = user_type;
    if (invitation_code !== undefined) updateData.invitation_code = invitation_code;

    // Add updated timestamp
    updateData.updated_at = new Date();

    // Update the user
    await user.update(updateData);

    // Get cached settings once to avoid N+1 query
    const cachedSettings = await SettingsService.getSettings();

    // Compute onboarding_completed based on updated data and feature flag with cached settings
    const onboardingCompleted = await user.getOnboardingCompleted(cachedSettings);

    // Return updated user data with computed onboarding_completed
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      first_name: user.first_name,
      last_name: user.last_name,
      profile_image_url: user.profile_image_url,
      phone: user.phone,
      education_level: user.education_level,
      specializations: user.specializations,
      content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
      role: user.role,
      user_type: user.user_type,
      is_verified: user.is_verified,
      is_active: user.is_active,
      onboarding_completed: onboardingCompleted,
      birth_date: user.birth_date,
      invitation_code: user.invitation_code,
      linked_teacher_id: user.linked_teacher_id,
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

/**
 * @openapi
 * /api/auth/verify:
 *   post:
 *     summary: Verify Firebase ID token and establish session
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FirebaseLoginRequest'
 *     responses:
 *       200:
 *         description: Token verified successfully, session established
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: true
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid or expired token"
 */
// Verify ID token endpoint
router.post('/verify', async (req, res) => {
  try {
    ludlog.auth('[AUTH-VERIFY] Starting token verification process', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasIdToken: !!req.body.idToken,
      hasTeacherId: !!req.body.teacher_id
    });

    const { idToken, teacher_id } = req.body;

    if (!idToken) {
      luderror.auth('[AUTH-VERIFY] Missing idToken in request body', {
        ip: req.ip,
        body: req.body
      });
      return res.status(400).json({ error: 'ID token is required' });
    }

    ludlog.auth('[AUTH-VERIFY] IdToken provided, detecting portal', {
      idTokenLength: idToken.length,
      idTokenPrefix: idToken.substring(0, 20) + '...'
    });

    // Detect portal from request
    const portal = detectPortal(req);
    ludlog.auth('[AUTH-VERIFY] Portal detected', { portal });

    ludlog.auth('[AUTH-VERIFY] Calling authService.verifyToken', { portal });
    const tokenData = await authService.verifyToken(idToken);
    ludlog.auth('[AUTH-VERIFY] Token verification successful', {
      userId: tokenData.id,
      email: tokenData.email,
      portal
    });

    // Get the actual user from database (like loginWithEmailPassword does)
    ludlog.auth('[AUTH-VERIFY] Looking up user in database', { userId: tokenData.id });
    const user = await models.User.findByPk(tokenData.id);
    if (!user) {
      luderror.auth('[AUTH-VERIFY] User not found in database after successful token verification', {
        tokenUserId: tokenData.id,
        tokenEmail: tokenData.email,
        portal
      });
      throw new Error('User not found');
    }
    ludlog.auth('[AUTH-VERIFY] User found in database', {
      userId: user.id,
      email: user.email,
      userType: user.user_type,
      portal
    });

    // NEW: Teacher connection validation for student portal
    if (portal === 'student') {
      ludlog.auth('[AUTH-VERIFY] Student portal login - checking teacher connection requirement', {
        userId: user.id,
        email: user.email,
        teacherIdProvided: !!teacher_id,
        currentUserType: user.user_type
      });

      // Check if user has existing membership or teacher_id provided
      const hasExistingMembership = await checkExistingMembership(user.id);
      const teacherIdProvided = !!teacher_id;

      ludlog.auth('[AUTH-VERIFY] Teacher connection validation check:', {
        userId: user.id,
        hasExistingMembership,
        teacherIdProvided,
        teacherId: teacher_id
      });

      // Validation logic: Need teacher_id OR existing membership
      if (!teacherIdProvided && !hasExistingMembership) {
        luderror.auth('[AUTH-VERIFY] Teacher connection required - login denied', {
          userId: user.id,
          email: user.email,
          hasExistingMembership,
          teacherIdProvided,
          portal
        });

        return res.status(403).json({
          error: 'Teacher connection required',
          code: 'TEACHER_CONNECTION_REQUIRED',
          message: 'You must connect to a teacher to access the student portal. Please use an invitation code or contact your teacher.'
        });
      }

      // Create membership if teacher_id provided and no existing membership
      let membershipCreated = null;
      if (teacherIdProvided && !hasExistingMembership) {
        ludlog.auth('[AUTH-VERIFY] Creating new teacher connection during login', {
          userId: user.id,
          teacherId: teacher_id
        });

        try {
          membershipCreated = await createMembershipIfNeeded(user.id, teacher_id);
          ludlog.auth('[AUTH-VERIFY] Teacher connection created successfully during login', {
            userId: user.id,
            teacherId: teacher_id,
            membershipId: membershipCreated.id
          });
        } catch (membershipError) {
          luderror.auth('[AUTH-VERIFY] Failed to create teacher connection during login', {
            userId: user.id,
            teacherId: teacher_id,
            error: membershipError.message
          });

          return res.status(400).json({
            error: 'Failed to connect to teacher',
            code: 'TEACHER_CONNECTION_FAILED',
            message: membershipError.message
          });
        }
      }
    }

    // Auto-assign user_type='student' for Firebase users on student portal (if currently null)
    if (portal === 'student' && user.user_type === null) {
      ludlog.auth('[AUTH-VERIFY] Auto-assigning student user_type', {
        userId: user.id,
        email: user.email,
        portal
      });

      try {
        await user.update({
          user_type: 'student',
          last_login: new Date()
        });
        ludlog.auth('[AUTH-VERIFY] Student auto-assignment successful', {
          userId: user.id,
          email: user.email
        });
      } catch (updateError) {
        luderror.auth('[AUTH-VERIFY] Failed to auto-assign student user_type', {
          userId: user.id,
          email: user.email,
          error: updateError.message,
          portal
        });
        throw updateError;
      }

      // Log the auto-assignment for visibility
      luderror.auth(`[Auto-Assignment] User ${user.id} (${user.email}) assigned user_type='student' on student portal login`);
    } else {
      ludlog.auth('[AUTH-VERIFY] Updating last login and syncing Google profile data', {
        userId: user.id,
        currentUserType: user.user_type,
        portal
      });

      try {
        // Prepare update data - sync profile info from Google if available
        const updateData = { last_login: new Date() };

        // Sync profile data from Google token if available and different
        if (tokenData.name && tokenData.name !== user.full_name) {
          updateData.full_name = tokenData.name;
          ludlog.auth('[AUTH-VERIFY] Updating full_name from Google', {
            userId: user.id,
            oldName: user.full_name,
            newName: tokenData.name
          });
        }

        if (tokenData.first_name && tokenData.first_name !== user.first_name) {
          updateData.first_name = tokenData.first_name;
          ludlog.auth('[AUTH-VERIFY] Updating first_name from Google', {
            userId: user.id,
            oldFirstName: user.first_name,
            newFirstName: tokenData.first_name
          });
        }

        if (tokenData.last_name && tokenData.last_name !== user.last_name) {
          updateData.last_name = tokenData.last_name;
          ludlog.auth('[AUTH-VERIFY] Updating last_name from Google', {
            userId: user.id,
            oldLastName: user.last_name,
            newLastName: tokenData.last_name
          });
        }

        if (tokenData.profile_image_url && tokenData.profile_image_url !== user.profile_image_url) {
          updateData.profile_image_url = tokenData.profile_image_url;
          ludlog.auth('[AUTH-VERIFY] Updating profile image from Google', {
            userId: user.id,
            oldImage: user.profile_image_url,
            newImage: tokenData.profile_image_url
          });
        }

        // Update user with synced data
        await user.update(updateData);
        ludlog.auth('[AUTH-VERIFY] User profile sync from Google completed', {
          userId: user.id,
          updatedFields: Object.keys(updateData)
        });
      } catch (updateError) {
        luderror.auth('[AUTH-VERIFY] Failed to update user profile from Google', {
          userId: user.id,
          email: user.email,
          error: updateError.message,
          portal
        });
        throw updateError;
      }
    }

    // Create user session with metadata and portal context
    const sessionMetadata = {
      userAgent: req.get('User-Agent') || 'Unknown',
      ipAddress: req.ip || req.socket?.remoteAddress || 'Unknown',
      timestamp: new Date(),
      loginMethod: 'firebase_google'
    };

    ludlog.auth('[AUTH-VERIFY] Creating user session', {
      userId: user.id,
      portal,
      sessionMetadata
    });

    try {
      await authService.createSession(user.id, sessionMetadata, portal);
      ludlog.auth('[AUTH-VERIFY] Session creation successful', {
        userId: user.id,
        portal
      });
    } catch (sessionError) {
      luderror.auth('[AUTH-VERIFY] Failed to create user session', {
        userId: user.id,
        email: user.email,
        portal,
        sessionMetadata,
        error: sessionError.message,
        stack: sessionError.stack
      });
      throw sessionError;
    }

    ludlog.auth('[AUTH-VERIFY] Generating token pair', { userId: user.id, portal });
    let result;
    try {
      // Generate proper access and refresh tokens using AuthService
      result = await authService.generateTokenPair(user, sessionMetadata);
      ludlog.auth('[AUTH-VERIFY] Token pair generation successful', {
        userId: user.id,
        hasAccessToken: !!result.accessToken,
        hasRefreshToken: !!result.refreshToken
      });
    } catch (tokenError) {
      luderror.auth('[AUTH-VERIFY] Failed to generate token pair', {
        userId: user.id,
        email: user.email,
        portal,
        error: tokenError.message,
        stack: tokenError.stack
      });
      throw tokenError;
    }

    // Get portal-specific cookie names
    const cookieNames = getPortalCookieNames(portal);
    ludlog.auth('[AUTH-VERIFY] Setting cookies', {
      portal,
      cookieNames,
      accessTokenName: cookieNames.accessToken,
      refreshTokenName: cookieNames.refreshToken
    });

    // Set access token as httpOnly cookie (15 minutes) with portal-specific name
    const accessConfig = createPortalAccessTokenConfig(portal);
    logCookieConfig(`Verify ${portal} - Access Token`, accessConfig);
    res.cookie(cookieNames.accessToken, result.accessToken, accessConfig);

    // Set refresh token as httpOnly cookie (7 days) with portal-specific name
    const refreshConfig = createPortalRefreshTokenConfig(portal);
    logCookieConfig(`Verify ${portal} - Refresh Token`, refreshConfig);
    res.cookie(cookieNames.refreshToken, result.refreshToken, refreshConfig);

    ludlog.auth('[AUTH-VERIFY] Authentication verification completed successfully', {
      userId: user.id,
      email: user.email,
      portal,
      userType: user.user_type
    });

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        profile_image_url: user.profile_image_url,
        role: user.role,
        user_type: user.user_type,
        is_verified: user.is_verified,
        phone: user.phone,
        education_level: user.education_level,
        specializations: user.specializations,
        content_creator_agreement_sign_date: user.content_creator_agreement_sign_date,
        is_active: user.is_active,
        birth_date: user.birth_date,
        invitation_code: user.invitation_code,
        linked_teacher_id: user.linked_teacher_id,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }
    });
  } catch (error) {
    luderror.auth('[AUTH-VERIFY] Authentication verification failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      hasIdToken: !!req.body.idToken,
      idTokenLength: req.body.idToken?.length,
      error: error.message,
      stack: error.stack,
      portal: detectPortal(req)
    });

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
    luderror.auth('Failed to get session stats:', error);
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
    luderror.auth('Failed to get user sessions:', error);
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
    luderror.auth('Failed to invalidate user sessions:', error);
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
    luderror.auth('Failed to cleanup sessions:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});

// =============================================
// ANONYMOUS ADMIN PASSWORD VALIDATION
// =============================================

// Anonymous admin password validation (no authentication required)
// Used for maintenance mode bypass on student portal when students_access is invite_only
router.post('/validate-admin-password', rateLimiters.auth, async (req, res) => {
  try {
    const { password } = req.body;

    // Validate input
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Password is required'
      });
    }

    // Check password length to prevent obviously wrong passwords
    if (password.length < 3 || password.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password format'
      });
    }

    // Validate password using secure comparison
    try {
      const isValidPassword = verifyAdminPassword(password);
      if (!isValidPassword) {
        // Audit log failed attempts

        return res.status(401).json({
          success: false,
          error: 'Invalid admin password'
        });
      }
    } catch (verificationError) {
      luderror.auth('Password verification error:', verificationError);
      return res.status(500).json({
        success: false,
        error: 'Admin password not configured'
      });
    }

    // Password is correct - create signed token for httpOnly cookie
    const jwt = await import('jsonwebtoken');

    // Detect portal from request
    const portal = detectPortal(req);
    const audience = portal === 'student' ? 'ludora-student-portal' : 'ludora-teacher-portal';

    // Generate cryptographically secure random components for token uniqueness
    const nonce = crypto.randomBytes(32).toString('hex');
    const sessionId = crypto.randomUUID();
    const now = Date.now();

    const tokenPayload = {
      type: 'anonymous_admin',
      sessionId: sessionId,
      nonce: nonce,
      timestamp: now,
      expiresAt: now + (24 * 60 * 60 * 1000), // 24 hours
      portal: portal
    };

    const anonymousAdminToken = jwt.default.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      {
        expiresIn: '24h',
        issuer: 'ludora-api',
        audience: audience
      }
    );

    // Audit log successful validation

    // Set token as httpOnly cookie for security (prevents XSS attacks)
    res.cookie('anonymous_admin_token', anonymousAdminToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/'
    });

    // Return success with token
    res.json({
      success: true,
      message: 'Admin access granted',
      expiresAt: new Date(tokenPayload.expiresAt).toISOString(),
      anonymousAdminToken: anonymousAdminToken
    });

  } catch (error) {
    luderror.auth('Anonymous admin password validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /auth/consent-status - Check student consent and teacher linking status
router.get('/consent-status', authenticateToken, async (req, res) => {
  try {
    const { user } = req;

    // Only applies to students
    if (!user || user.user_type !== 'student') {
      return res.json({
        needs_teacher: false,
        needs_consent: false,
        status: 'not_applicable'
      });
    }

    // Check if student is linked to a teacher
    const hasLinkedTeacher = !!user.linked_teacher_id;

    // Check if student has parent consent
    const parentConsent = await models.ParentConsent.findOne({
      where: { student_id: user.id }
    });

    // Check if consent exists AND is active (not revoked)
    const hasActiveParentConsent = parentConsent && parentConsent.isActive();
    const hasParentConsentRecord = !!parentConsent;

    // Determine status
    let status = 'complete';
    let needs_teacher = false;
    let needs_consent = false;
    let consent_revoked = false;
    let revocation_info = null;

    if (!hasLinkedTeacher) {
      status = 'needs_teacher';
      needs_teacher = true;
    } else if (!hasParentConsentRecord) {
      status = 'needs_consent';
      needs_consent = true;
    } else if (parentConsent && !parentConsent.isActive()) {
      // Consent exists but has been revoked
      status = 'consent_revoked';
      consent_revoked = true;
      revocation_info = parentConsent.getRevocationInfo();
    }

    const responseData = {
      needs_teacher,
      needs_consent,
      status,
      linked_teacher_id: user.linked_teacher_id,
      has_parent_consent: hasActiveParentConsent, // Only true if active
      has_consent_record: hasParentConsentRecord,
      consent_revoked,
      revocation_info
    };

    res.json(responseData);

  } catch (error) {
    luderror.auth('Error checking consent status:', error);
    res.status(500).json({
      error: 'Failed to check consent status',
      message: error.message
    });
  }
});

// POST /auth/link-teacher - Link student to teacher using invitation code
router.post('/link-teacher',
  authenticateToken,
  rateLimiters.auth, // Add rate limiting for invitation code attempts
  async (req, res) => {
  try {
    const { user } = req;
    const { invitation_code } = req.body;

    // Only students can link to teachers
    if (!user || user.user_type !== 'student') {
      return res.status(400).json({
        error: 'Only students can link to teachers'
      });
    }

    // EDGE CASE 1: Check if student is already linked to a teacher
    if (user.linked_teacher_id) {
      return res.status(400).json({
        error: 'Student is already linked to a teacher',
        code: 'ALREADY_LINKED',
        current_teacher_id: user.linked_teacher_id
      });
    }

    // EDGE CASE 2: Enhanced invitation code validation
    if (!invitation_code || typeof invitation_code !== 'string') {
      return res.status(400).json({
        error: 'Invitation code is required'
      });
    }

    // Validate invitation code format (should be 6 alphanumeric characters)
    const trimmedCode = invitation_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
      luderror.auth('Invalid invitation code format attempted:', {
        studentId: user.id,
        attemptedCode: invitation_code,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid invitation code format. Code must be 6 characters.'
      });
    }

    // Find teacher by invitation code
    const teacher = await models.User.findOne({
      where: {
        invitation_code: trimmedCode,
        user_type: 'teacher',
        is_active: true
      }
    });

    if (!teacher) {
      // Log failed invitation code attempts for security monitoring
      luderror.auth('Failed invitation code attempt:', {
        studentId: user.id,
        attemptedCode: trimmedCode,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(404).json({
        error: 'Invalid invitation code or teacher not found'
      });
    }

    // EDGE CASE 3: Check if teacher account is properly set up
    if (!teacher.full_name || teacher.full_name.trim() === '') {
      return res.status(400).json({
        error: 'Teacher account is not fully set up. Please contact your teacher.'
      });
    }

    // Update student with linked teacher using transaction for safety
    const transaction = await models.sequelize.transaction();

    try {
      const updatedUser = await user.update({
        linked_teacher_id: teacher.id
      }, { transaction });

      await transaction.commit();

      // Use ludlog for successful operation, not luderror
      ludlog.auth('Student successfully linked to teacher:', {
        studentId: user.id,
        studentEmail: user.email,
        teacherId: teacher.id,
        teacherName: teacher.full_name,
        invitationCode: trimmedCode
      });

      res.json({
        message: 'Successfully linked to teacher',
        teacher: {
          id: teacher.id,
          full_name: teacher.full_name,
          email: teacher.email
        },
        linked_teacher_id: teacher.id
      });

    } catch (updateError) {
      await transaction.rollback();
      throw updateError;
    }

  } catch (error) {
    luderror.auth('Error linking student to teacher:', error);
    res.status(500).json({
      error: 'Failed to link to teacher',
      message: error.message
    });
  }
});

// POST /auth/revoke-consent - Revoke parent consent (admin/teacher only)
router.post('/revoke-consent', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { student_id, revocation_reason, notes } = req.body;

    // Only admins and teachers can revoke consent
    if (!user || (!user.isAdmin && user.user_type !== 'teacher')) {
      return res.status(403).json({
        error: 'Only admins and teachers can revoke parent consent'
      });
    }

    // Validate required fields
    if (!student_id || !revocation_reason) {
      return res.status(400).json({
        error: 'student_id and revocation_reason are required'
      });
    }

    // Validate revocation reason
    const validReasons = ['parent_request', 'teacher_unlink', 'admin_action', 'student_deactivation', 'system_cleanup'];
    if (!validReasons.includes(revocation_reason)) {
      return res.status(400).json({
        error: 'Invalid revocation reason'
      });
    }

    // Find the student
    const student = await models.User.findOne({
      where: { id: student_id, user_type: 'student' }
    });

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    // If teacher is making the request, verify they are linked to this student
    if (user.user_type === 'teacher' && student.linked_teacher_id !== user.id) {
      return res.status(403).json({
        error: 'You can only revoke consent for students linked to you'
      });
    }

    // Find active parent consent
    const parentConsent = await models.ParentConsent.findOne({
      where: { student_id: student_id }
    });

    if (!parentConsent) {
      return res.status(404).json({
        error: 'No parent consent found for this student'
      });
    }

    if (!parentConsent.isActive()) {
      return res.status(400).json({
        error: 'Parent consent is already revoked'
      });
    }

    // Prepare audit data
    const auditData = {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Revoke the consent
    await parentConsent.revokeConsent(user.id, revocation_reason, auditData);

    ludlog.auth('Parent consent revoked:', {
      studentId: student_id,
      studentEmail: student.email,
      revokedBy: user.id,
      revokerEmail: user.email,
      revocationReason: revocation_reason,
      notes: notes || 'No additional notes',
      ip: req.ip
    });

    res.json({
      message: 'Parent consent revoked successfully',
      student: {
        id: student.id,
        email: student.email
      },
      revocation: {
        revoked_by: user.id,
        revocation_reason: revocation_reason,
        revoked_at: parentConsent.revoked_at
      }
    });

  } catch (error) {
    luderror.auth('Error revoking parent consent:', error);
    res.status(500).json({
      error: 'Failed to revoke parent consent',
      message: error.message
    });
  }
});

// POST /auth/unlink-student - Unlink student from teacher (teacher/admin only)
router.post('/unlink-student', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { student_id, auto_revoke_consent } = req.body;

    // Only admins and teachers can unlink students
    if (!user || (!user.isAdmin && user.user_type !== 'teacher')) {
      return res.status(403).json({
        error: 'Only admins and teachers can unlink students'
      });
    }

    // Validate required fields
    if (!student_id) {
      return res.status(400).json({
        error: 'student_id is required'
      });
    }

    // Find the student
    const student = await models.User.findOne({
      where: { id: student_id, user_type: 'student' }
    });

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    if (!student.linked_teacher_id) {
      return res.status(400).json({
        error: 'Student is not linked to any teacher'
      });
    }

    // If teacher is making the request, verify they are linked to this student
    if (user.user_type === 'teacher' && student.linked_teacher_id !== user.id) {
      return res.status(403).json({
        error: 'You can only unlink students linked to you'
      });
    }

    const transaction = await models.sequelize.transaction();

    try {
      const previousTeacherId = student.linked_teacher_id;

      // Unlink the student
      await student.update({
        linked_teacher_id: null
      }, { transaction });

      // Optionally revoke parent consent when unlinking
      if (auto_revoke_consent) {
        const parentConsent = await models.ParentConsent.findOne({
          where: { student_id: student_id }
        });

        if (parentConsent && parentConsent.isActive()) {
          const auditData = {
            ip: req.ip,
            userAgent: req.get('User-Agent')
          };

          await parentConsent.revokeConsent(user.id, 'teacher_unlink', auditData);
        }
      }

      await transaction.commit();

      ludlog.auth('Student unlinked from teacher:', {
        studentId: student_id,
        studentEmail: student.email,
        previousTeacherId: previousTeacherId,
        unlinkedBy: user.id,
        unlinkerEmail: user.email,
        consentRevoked: auto_revoke_consent || false,
        ip: req.ip
      });

      res.json({
        message: 'Student unlinked successfully',
        student: {
          id: student.id,
          email: student.email,
          linked_teacher_id: null
        },
        consent_revoked: auto_revoke_consent || false
      });

    } catch (updateError) {
      await transaction.rollback();
      throw updateError;
    }

  } catch (error) {
    luderror.auth('Error unlinking student:', error);
    res.status(500).json({
      error: 'Failed to unlink student',
      message: error.message
    });
  }
});

// POST /auth/mark-consent - Mark parent consent as accepted by teacher (teacher/admin only)
router.post('/mark-consent', authenticateToken, async (req, res) => {
  try {
    const { user } = req;
    const { student_id } = req.body;

    // Only admins and teachers can mark parent consent
    if (!user || (!user.isAdmin && user.user_type !== 'teacher')) {
      return res.status(403).json({
        error: 'Only admins and teachers can mark parent consent as accepted'
      });
    }

    // Check if teacher consent verification is enabled
    const settings = await SettingsService.getSettings();
    const teacherConsentVerificationEnabled = settings?.teacher_consent_verification_enabled;

    if (!teacherConsentVerificationEnabled) {
      return res.status(403).json({
        error: 'Teacher consent verification is not enabled',
        code: 'FEATURE_DISABLED'
      });
    }

    // Validate required fields
    if (!student_id) {
      return res.status(400).json({
        error: 'student_id is required'
      });
    }

    // Find the student
    const student = await models.User.findOne({
      where: { id: student_id, user_type: 'student' }
    });

    if (!student) {
      return res.status(404).json({
        error: 'Student not found'
      });
    }

    // If teacher is making the request, verify they are linked to this student
    if (user.user_type === 'teacher' && student.linked_teacher_id !== user.id) {
      return res.status(403).json({
        error: 'You can only mark consent for students linked to you'
      });
    }

    // Check if parent consent already exists
    let parentConsent = await models.ParentConsent.findOne({
      where: { student_id: student_id }
    });

    if (parentConsent && parentConsent.isActive()) {
      return res.status(400).json({
        error: 'Parent consent already exists and is active',
        code: 'CONSENT_ALREADY_EXISTS'
      });
    }

    const transaction = await models.sequelize.transaction();

    try {
      // Prepare teacher approval data
      const teacherApprovalData = {
        teacher_id: user.id,
        approved_at: new Date().toISOString(),
        teacher_name: user.full_name,
        approval_method: 'teacher_verification'
      };

      // Create or update parent consent record
      if (parentConsent) {
        // Update existing revoked consent with teacher verification
        await parentConsent.update({
          consent_given_at: new Date(),
          consent_revoked_at: null,
          revoked_by: null,
          revocation_reason: null,
          revocation_notes: null,
          consent_method: 'teacher_verification',
          teacher_approval_data: teacherApprovalData,
          // Keep original parent fields as null for teacher verification
          parent_email: null,
          parent_name: null
        }, { transaction });
      } else {
        // Create new parent consent record with teacher verification
        parentConsent = await models.ParentConsent.create({
          student_id: student_id,
          consent_given_at: new Date(),
          consent_method: 'teacher_verification',
          teacher_approval_data: teacherApprovalData,
          given_by_teacher_id: user.id,
          // Leave parent fields null for teacher verification
          parent_email: null,
          parent_name: null,
          consent_metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            approval_timestamp: new Date().toISOString(),
            teacher_verification: true
          }
        }, { transaction });
      }

      await transaction.commit();

      ludlog.auth('Parent consent marked as accepted by teacher:', {
        studentId: student_id,
        studentEmail: student.email,
        markedBy: user.id,
        teacherEmail: user.email,
        teacherName: user.full_name,
        consentId: parentConsent.id,
        ip: req.ip
      });

      res.json({
        message: 'Parent consent marked as accepted successfully',
        student: {
          id: student.id,
          email: student.email
        },
        consent: {
          id: parentConsent.id,
          consent_given_at: parentConsent.consent_given_at,
          consent_method: 'teacher_verification',
          given_by_teacher: {
            id: user.id,
            name: user.full_name,
            email: user.email
          }
        }
      });

    } catch (updateError) {
      await transaction.rollback();
      throw updateError;
    }

  } catch (error) {
    luderror.auth('Error marking parent consent:', error);
    res.status(500).json({
      error: 'Failed to mark parent consent as accepted',
      message: error.message
    });
  }
});

export default router;