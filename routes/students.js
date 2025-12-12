import express from 'express';
import { ludlog, luderror } from '../lib/ludlog.js';
import { validateStudentAccess, authenticateUserOrPlayer } from '../middleware/auth.js';
import { validateBody, rateLimiters } from '../middleware/validation.js';
import Joi from 'joi';
import models from '../models/index.js';
import {
  getStudentById,
  isValidTeacherId,
  getStudentTeacherConnection,
} from '../utils/studentUtils.js';
import { ACCESS_CONTROL_KEYS } from '../constants/settingsKeys.js';
import AuthService from '../services/AuthService.js';
import PlayerService from '../services/PlayerService.js';
import { generateId } from '../models/baseModel.js';
import {
  createAccessTokenConfig,
  createRefreshTokenConfig,
  createClearCookieConfig,
  logCookieConfig
} from '../utils/cookieConfig.js';

const router = express.Router();
const authService = AuthService;
const playerService = new PlayerService();

// ========================================
// TEACHER CONNECTION VALIDATION HELPERS
// ========================================

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
    // Get ALL existing memberships for this teacher+student pair
    const existingMemberships = await models.ClassroomMembership.findAll({
      where: {
        student_id: studentId,
        teacher_id: teacherId
      },
      transaction,
      order: [['created_at', 'DESC']] // Most recent first
    });

    // If ANY memberships exist (general or classroom-specific), return all of them
    if (existingMemberships.length > 0) {
      ludlog.auth('Existing memberships found during student login:', {
        studentId: studentId,
        teacherId,
        membershipCount: existingMemberships.length,
        memberships: existingMemberships.map(m => ({
          id: m.id,
          classroom_id: m.classroom_id,
          status: m.status,
          created_at: m.created_at
        }))
      });
      return existingMemberships;
    }

    // No memberships exist - validate teacher has active subscription with classroom benefits
    const hasClassroomBenefits = await validateTeacherSubscription(teacherId);
    if (!hasClassroomBenefits) {
      throw new Error('Teacher does not have active subscription with classroom benefits');
    }

    // Create new general membership
    const membership = await models.ClassroomMembership.create({
      id: generateId(),
      teacher_id: teacherId,
      student_id: studentId,
      classroom_id: null, // General teacher connection, no specific classroom
      status: 'active',
      requested_at: new Date(),
      approved_at: new Date(),
      request_message: 'Auto-created during student login flow with teacher connection',
      approval_message: 'Automatic approval for invitation-based teacher connection'
    }, { transaction });

    ludlog.auth('New general membership auto-created during student login:', {
      membershipId: membership.id,
      studentId: studentId,
      teacherId,
      status: membership.status,
      classroom_id: membership.classroom_id
    });

    // Return as array for consistency with existing memberships case
    return [membership];
  } catch (error) {
    luderror.auth('Failed to create membership during student login:', {
      studentId: studentId,
      teacherId,
      error: error.message,
      errorName: error.name,
      stack: error.stack
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
      ludlog.auth('Teacher validation failed for student login - not found or not teacher:', {
        teacherId,
        found: !!teacher,
        userType: teacher?.user_type
      });
      return false;
    }

    // Check for active subscription with classroom benefits
    ludlog.auth('Checking teacher subscription:', { teacherId });

    const activeSubscription = await models.Subscription.findOne({
      where: {
        user_id: teacherId,
        status: 'active',
        end_date: { [models.Sequelize.Op.gt]: new Date() } // Not expired
      }
    });

    ludlog.auth('Subscription query result:', {
      teacherId,
      subscriptionFound: !!activeSubscription,
      subscriptionId: activeSubscription?.id,
      planId: activeSubscription?.subscription_plan_id
    });

    if (!activeSubscription) {
      ludlog.auth('No active subscription found for teacher during student login:', { teacherId });
      return false;
    }

    // Get the subscription plan separately
    ludlog.auth('Looking up subscription plan:', { planId: activeSubscription.subscription_plan_id });

    const subscriptionPlan = await models.SubscriptionPlan.findByPk(activeSubscription.subscription_plan_id);

    ludlog.auth('Subscription plan query result:', {
      teacherId,
      planId: activeSubscription.subscription_plan_id,
      planFound: !!subscriptionPlan,
      planName: subscriptionPlan?.name,
      planActive: subscriptionPlan?.is_active,
      benefits: subscriptionPlan?.benefits
    });

    if (!subscriptionPlan || !subscriptionPlan.is_active) {
      ludlog.auth('No active subscription plan found for teacher during student login:', {
        teacherId,
        planId: activeSubscription.subscription_plan_id,
        planFound: !!subscriptionPlan,
        planActive: subscriptionPlan?.is_active
      });
      return false;
    }

    // Check if plan includes classroom benefits
    const benefits = subscriptionPlan.benefits;
    const hasClassroomBenefits = benefits?.classroom_management?.enabled === true;

    ludlog.auth('Teacher subscription validation result for student login:', {
      teacherId,
      hasActiveSubscription: true,
      hasClassroomBenefits,
      subscriptionId: activeSubscription.id,
      planId: subscriptionPlan.id,
      planName: subscriptionPlan.name
    });

    return hasClassroomBenefits;
  } catch (error) {
    luderror.auth('Error validating teacher subscription during student login:', {
      teacherId,
      error: error.message,
      stack: error.stack
    });
    return false;
  }
};

// ========================================
// UNIFIED STUDENT AUTHENTICATION SYSTEM
// ========================================

// Unified login schema supporting both Firebase tokens and privacy codes
const studentLoginSchema = Joi.object({
  // Firebase authentication
  idToken: Joi.string().optional(),

  // Player authentication
  privacy_code: Joi.string().min(3).max(20).trim().optional(),

  // Teacher connection for new students
  teacher_id: Joi.string().optional(),

  // Additional metadata
  sessionMetadata: Joi.object().optional()
}).or('idToken', 'privacy_code'); // Either Firebase token OR privacy code required

/**
 * Unified Student Portal Login Endpoint
 * Handles both Firebase (User) and Player (privacy_code) authentication
 * Validates teacher connection requirement during login
 */
router.post('/login',
  validateStudentAccess,
  rateLimiters.auth,
  validateBody(studentLoginSchema),
  async (req, res) => {
    try {
      const { idToken, privacy_code, teacher_id, sessionMetadata } = req.body;

      ludlog.auth('[STUDENT-LOGIN] Starting unified student authentication', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        hasIdToken: !!idToken,
        hasPrivacyCode: !!privacy_code,
        hasTeacherId: !!teacher_id
      });

      const sessionMeta = {
        userAgent: req.get('User-Agent') || 'Unknown',
        ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
        timestamp: new Date(),
        ...sessionMetadata
      };

      let authResult = null;
      let studentId = null;
      let studentType = null;

      // Authenticate using Firebase or Player service
      if (idToken) {
        // Firebase authentication (User)
        ludlog.auth('[STUDENT-LOGIN] Attempting Firebase authentication');

        try {
          const tokenData = await authService.verifyToken(idToken);

          // Create session for the user
          const sessionId = await authService.createSession(tokenData.id, sessionMeta);

          authResult = {
            success: true,
            user: tokenData,
            sessionId: sessionId
          };
          studentId = authResult.user.id;
          studentType = 'user';
        } catch (firebaseError) {
          luderror.auth('[STUDENT-LOGIN] Firebase authentication failed', {
            hasTeacherId: !!teacher_id,
            ip: req.ip,
            error: firebaseError.message
          });
          return res.status(401).json({ error: 'Invalid Firebase token' });
        }

      } else if (privacy_code) {
        // Player authentication (Player)
        ludlog.auth('[STUDENT-LOGIN] Attempting Player authentication');

        const playerResult = await playerService.authenticatePlayer(privacy_code, sessionMeta);
        if (!playerResult.success) {
          luderror.auth('[STUDENT-LOGIN] Player authentication failed', {
            hasTeacherId: !!teacher_id,
            ip: req.ip
          });
          return res.status(401).json({ error: 'Invalid privacy code' });
        }

        authResult = playerResult;
        studentId = authResult.player.id;
        studentType = 'player';
      } else {
        return res.status(400).json({ error: 'Either idToken or privacy_code required' });
      }

      // Teacher connection validation for all student logins
      ludlog.auth('[STUDENT-LOGIN] Student authenticated successfully - checking teacher connection requirement', {
        studentId,
        studentType,
        teacherIdProvided: !!teacher_id
      });

      // Check if student has existing membership or teacher_id provided
      const hasExistingMembership = await checkExistingMembership(studentId);
      const teacherIdProvided = !!teacher_id;

      ludlog.auth('[STUDENT-LOGIN] Teacher connection validation check:', {
        studentId,
        studentType,
        hasExistingMembership,
        teacherIdProvided,
        teacherId: teacher_id
      });

      // Validation logic: Need teacher_id OR existing membership
      if (!teacherIdProvided && !hasExistingMembership) {
        luderror.auth('[STUDENT-LOGIN] Teacher connection required - login denied', {
          studentId,
          studentType,
          hasExistingMembership,
          teacherIdProvided,
          ip: req.ip
        });

        return res.status(403).json({
          error: 'Teacher connection required',
          code: 'TEACHER_CONNECTION_REQUIRED',
          message: 'Students must connect to a teacher to access the portal. Please use an invitation code or contact your teacher.',
          studentType
        });
      }

      // Create membership if teacher_id provided and no existing membership
      let allMemberships = [];
      if (teacherIdProvided && !hasExistingMembership) {
        ludlog.auth('[STUDENT-LOGIN] Creating new teacher connection during student login', {
          studentId,
          studentType,
          teacherId: teacher_id
        });

        try {
          allMemberships = await createMembershipIfNeeded(studentId, teacher_id);
          ludlog.auth('[STUDENT-LOGIN] Teacher connection created successfully during student login', {
            studentId,
            studentType,
            teacherId: teacher_id,
            membershipCount: allMemberships.length,
            memberships: allMemberships.map(m => ({
              id: m.id,
              classroom_id: m.classroom_id,
              status: m.status
            }))
          });
        } catch (membershipError) {
          luderror.auth('[STUDENT-LOGIN] Failed to create teacher connection during student login', {
            studentId,
            studentType,
            teacherId: teacher_id,
            error: membershipError.message
          });

          return res.status(400).json({
            error: 'Failed to connect to teacher',
            code: 'TEACHER_CONNECTION_FAILED',
            message: membershipError.message,
            studentType
          });
        }
      }

      // Generate appropriate tokens based on student type
      if (studentType === 'user') {
        // Firebase User - use AuthService for session management
        const sessionId = await authService.createSession(studentId, sessionMeta);

        // Set session cookie
        const sessionConfig = createAccessTokenConfig();
        sessionConfig.maxAge = 24 * 60 * 60 * 1000; // 24 hours
        logCookieConfig('Student Login (User) - Session', sessionConfig);
        res.cookie('student_session', sessionId, sessionConfig);

        // Return user data
        res.status(200).json({
          success: true,
          student: {
            id: authResult.user.id,
            email: authResult.user.email,
            full_name: authResult.user.full_name,
            display_name: authResult.user.display_name || authResult.user.full_name,
            user_type: authResult.user.user_type,
            is_verified: authResult.user.is_verified,
            type: 'user'
          },
          teacherConnectionCreated: allMemberships.length > 0,
          memberships: allMemberships.map(m => ({
            id: m.id,
            classroom_id: m.classroom_id,
            status: m.status,
            teacher_id: m.teacher_id,
            created_at: m.created_at
          }))
        });

      } else if (studentType === 'player') {
        // Player - generate JWT tokens
        const playerTokenData = {
          id: authResult.player.id,
          privacy_code: authResult.player.privacy_code,
          display_name: authResult.player.display_name,
          type: 'player'
        };

        // Generate player access token
        const accessToken = authService.createAccessToken(playerTokenData);

        // Create player-specific refresh token
        const jwt = await import('jsonwebtoken');
        const refreshTokenId = generateId();
        const refreshPayload = {
          id: authResult.player.id,
          type: 'player',
          tokenId: refreshTokenId,
          entityType: 'player'
        };
        const refreshToken = jwt.default.sign(refreshPayload, process.env.JWT_SECRET, {
          expiresIn: '7d',
          issuer: 'ludora-api',
          audience: 'ludora-student-portal'
        });

        // Set player tokens as httpOnly cookies
        const playerAccessConfig = createAccessTokenConfig();
        logCookieConfig('Student Login (Player) - Access Token', playerAccessConfig);
        res.cookie('student_access_token', accessToken, playerAccessConfig);

        const playerRefreshConfig = createRefreshTokenConfig();
        logCookieConfig('Student Login (Player) - Refresh Token', playerRefreshConfig);
        res.cookie('student_refresh_token', refreshToken, playerRefreshConfig);

        // Legacy session for compatibility
        const playerSessionConfig = createAccessTokenConfig();
        playerSessionConfig.maxAge = 24 * 60 * 60 * 1000;
        res.cookie('student_session', authResult.sessionId, playerSessionConfig);

        // Return player data
        res.status(200).json({
          success: true,
          student: {
            id: authResult.player.id,
            display_name: authResult.player.display_name,
            teacher: authResult.player.teacher,
            achievements: authResult.player.achievements,
            preferences: authResult.player.preferences,
            is_online: authResult.player.is_online,
            type: 'player'
          },
          teacherConnectionCreated: allMemberships.length > 0,
          memberships: allMemberships.map(m => ({
            id: m.id,
            classroom_id: m.classroom_id,
            status: m.status,
            teacher_id: m.teacher_id,
            created_at: m.created_at
          }))
        });
      }

    } catch (error) {
      luderror.auth('Student login error:', error);
      res.status(401).json({ error: error.message || 'Authentication failed' });
    }
  }
);

// ========================================
// UNIFIED TEACHER CONNECTION SYSTEM
// ========================================

/**
 * Connect student (Player or User) to teacher
 * Creates ClassroomMembership with NULL classroom_id for initial teacher connection
 * Enforces authentication method based on students_access setting
 */

// Validation schema for teacher connection
const connectTeacherSchema = Joi.object({
  teacher_id: Joi.string().optional(),
  invitation_code: Joi.string().min(6).max(8).optional(),
  request_message: Joi.string().max(500).optional().allow('')
}).xor('teacher_id', 'invitation_code'); // Either teacher_id OR invitation_code, but not both

router.post('/connect-teacher',
  validateStudentAccess,
  authenticateUserOrPlayer,
  validateBody(connectTeacherSchema),
  async (req, res) => {
    try {
      const { teacher_id, invitation_code, request_message } = req.body;

      // Validate XOR constraint: either teacher_id OR invitation_code, not both or neither
      if (!teacher_id && !invitation_code) {
        return res.status(400).json({
          error: 'Either teacher_id or invitation_code is required',
          code: 'MISSING_TEACHER_IDENTIFIER'
        });
      }

      if (teacher_id && invitation_code) {
        return res.status(400).json({
          error: 'Only one of teacher_id or invitation_code should be provided',
          code: 'CONFLICTING_TEACHER_IDENTIFIERS'
        });
      }

      ludlog.auth('Student connecting to teacher:', {
        studentId: req.entityType === 'player' ? req.player?.id : req.user?.id,
        studentType: req.entityType,
        teacher_id,
        invitation_code: invitation_code ? `${invitation_code.slice(0,2)}****` : null
      });

      // 1. Enforce authentication method based on students_access setting
      const settings = await models.Settings.findOne({
        where: { key: ACCESS_CONTROL_KEYS.STUDENTS_ACCESS }
      });
      const studentsAccess = settings?.value || 'all';

      // Validate authentication method against settings
      if (studentsAccess === 'invite_only' && req.entityType === 'user') {
        return res.status(403).json({
          error: 'Only anonymous students are allowed. Please use privacy code instead of Google login.',
          code: 'AUTHED_USERS_NOT_ALLOWED'
        });
      }

      if (studentsAccess === 'authed_only' && req.entityType === 'player') {
        return res.status(403).json({
          error: 'Anonymous access not allowed. Please sign in with Google account.',
          code: 'ANONYMOUS_PLAYERS_NOT_ALLOWED'
        });
      }

      // 2. Get student info
      const studentId = req.entityType === 'player' ? req.player.id : req.user.id;
      const student = await getStudentById(studentId);

      if (!student) {
        return res.status(404).json({
          error: 'Student not found',
          code: 'STUDENT_NOT_FOUND'
        });
      }

      // 3. Resolve teacher by ID or invitation code
      let teacher;
      if (teacher_id) {
        // Direct teacher ID provided
        if (!await isValidTeacherId(teacher_id)) {
          return res.status(404).json({
            error: 'Teacher not found',
            code: 'TEACHER_NOT_FOUND'
          });
        }
        teacher = await models.User.findByPk(teacher_id);
      } else {
        // Invitation code provided - find teacher
        teacher = await models.User.findOne({
          where: {
            invitation_code,
            user_type: 'teacher'
          }
        });

        if (!teacher) {
          return res.status(404).json({
            error: 'Invalid invitation code',
            code: 'INVALID_INVITATION_CODE'
          });
        }
      }

      // 4. Check if connection already exists
      const existingConnection = await getStudentTeacherConnection(studentId, teacher.id);
      if (existingConnection) {
        ludlog.auth('Student already connected to teacher:', {
          studentId,
          teacherId: teacher.id,
          membershipId: existingConnection.id,
          status: existingConnection.status
        });

        return res.status(409).json({
          error: 'Already connected to this teacher',
          code: 'ALREADY_CONNECTED',
          data: {
            teacher: {
              id: teacher.id,
              display_name: teacher.display_name,
              school: teacher.school_name
            },
            connection: {
              id: existingConnection.id,
              status: existingConnection.status,
              requested_at: existingConnection.requested_at
            }
          }
        });
      }

      // 5. Create ClassroomMembership with NULL classroom_id (teacher connection without specific classroom)
      const membership = await models.ClassroomMembership.create({
        id: generateId(),
        teacher_id: teacher.id,
        student_id: studentId,
        classroom_id: null, // NULL for teacher-student connection without specific classroom
        status: 'active', // Direct connection is immediately active (no approval needed)
        requested_at: new Date(),
        approved_at: new Date(),
        request_message: request_message || null,
        approval_message: 'Automatic approval for teacher connection'
      });

      ludlog.auth('Teacher connection created:', {
        membershipId: membership.id,
        studentId,
        teacherId: teacher.id,
        status: membership.status
      });

      // 6. Get teacher's available classrooms for student browsing
      const teacherClassrooms = await models.Classroom.findAll({
        where: {
          teacher_id: teacher.id,
          is_active: true
        },
        order: [['name', 'ASC']],
        attributes: ['id', 'name', 'description', 'grade_level', 'year']
      });

      // 7. Return success with teacher info and available classrooms
      res.status(201).json({
        message: 'Successfully connected to teacher',
        data: {
          connection: {
            id: membership.id,
            status: membership.status,
            created_at: membership.created_at
          },
          teacher: {
            id: teacher.id,
            display_name: teacher.display_name,
            email: teacher.email,
            school_name: teacher.school_name,
            invitation_code: teacher.invitation_code
          },
          student: {
            id: studentId,
            type: req.entityType,
            display_name: student.display_name || student.name
          },
          available_classrooms: teacherClassrooms,
          next_steps: {
            message: 'You can now browse and join specific classrooms',
            classroom_count: teacherClassrooms.length
          }
        }
      });

    } catch (error) {
      luderror.auth('Teacher connection failed:', error);
      res.status(500).json({
        error: 'Failed to connect to teacher',
        code: 'CONNECTION_FAILED'
      });
    }
  }
);

/**
 * Get available classrooms for a connected teacher
 * Student must be connected to the teacher first
 */
router.get('/teacher-classrooms/:teacherId',
  validateStudentAccess,
  authenticateUserOrPlayer,
  async (req, res) => {
    try {
      const { teacherId } = req.params;
      const studentId = req.entityType === 'player' ? req.player.id : req.user.id;

      // 1. Verify teacher connection exists
      const connection = await getStudentTeacherConnection(studentId, teacherId);
      if (!connection) {
        return res.status(403).json({
          error: 'Not connected to this teacher',
          code: 'NOT_CONNECTED_TO_TEACHER'
        });
      }

      // 2. Get teacher's classrooms
      const classrooms = await models.Classroom.findAll({
        where: {
          teacher_id: teacherId,
          is_active: true
        },
        include: [{
          model: models.ClassroomMembership,
          where: { student_id: studentId },
          required: false, // LEFT JOIN to show all classrooms, with membership status if exists
          attributes: ['id', 'status', 'requested_at', 'approved_at']
        }],
        order: [['name', 'ASC']]
      });

      res.json({
        data: {
          classrooms: classrooms.map(classroom => ({
            id: classroom.id,
            name: classroom.name,
            description: classroom.description,
            grade_level: classroom.grade_level,
            year: classroom.year,
            membership: classroom.ClassroomMemberships?.[0] || null
          })),
          teacher_connection: {
            id: connection.id,
            status: connection.status,
            connected_at: connection.requested_at
          }
        }
      });

    } catch (error) {
      luderror.auth('Failed to get teacher classrooms:', error);
      res.status(500).json({
        error: 'Failed to get classrooms',
        code: 'CLASSROOM_FETCH_FAILED'
      });
    }
  }
);

/**
 * Request to join a specific classroom
 * Student must be connected to teacher first, then can request to join specific classrooms
 */
router.post('/join-classroom',
  validateStudentAccess,
  authenticateUserOrPlayer,
  validateBody(Joi.object({
    classroom_id: Joi.string().required(),
    request_message: Joi.string().max(500).optional().allow(''),
    student_display_name: Joi.string().max(100).optional().allow('')
  })),
  async (req, res) => {
    try {
      const { classroom_id, request_message, student_display_name } = req.body;
      const studentId = req.entityType === 'player' ? req.player.id : req.user.id;

      // 1. Validate classroom exists and get teacher info
      const classroom = await models.Classroom.findOne({
        where: { id: classroom_id, is_active: true },
        include: [{
          model: models.User,
          as: 'Teacher',
          attributes: ['id', 'display_name']
        }]
      });

      if (!classroom) {
        return res.status(404).json({
          error: 'Classroom not found',
          code: 'CLASSROOM_NOT_FOUND'
        });
      }

      // 2. Verify student is connected to teacher
      const teacherConnection = await getStudentTeacherConnection(studentId, classroom.teacher_id);
      if (!teacherConnection) {
        return res.status(403).json({
          error: 'Must be connected to teacher before joining classroom',
          code: 'NOT_CONNECTED_TO_TEACHER'
        });
      }

      // 3. Check if classroom membership already exists
      const existingMembership = await models.ClassroomMembership.findOne({
        where: {
          classroom_id,
          student_id: studentId,
          teacher_id: classroom.teacher_id
        }
      });

      if (existingMembership) {
        return res.status(409).json({
          error: 'Classroom membership already exists',
          code: 'ALREADY_MEMBER',
          data: {
            membership: {
              id: existingMembership.id,
              status: existingMembership.status,
              requested_at: existingMembership.requested_at
            }
          }
        });
      }

      // 4. Create classroom membership request
      const membership = await models.ClassroomMembership.create({
        id: generateId(),
        classroom_id,
        student_id: studentId,
        teacher_id: classroom.teacher_id,
        status: 'pending', // Classroom memberships require teacher approval
        requested_at: new Date(),
        request_message: request_message || null,
        student_display_name: student_display_name || null
      });

      ludlog.auth('Classroom membership requested:', {
        membershipId: membership.id,
        classroomId: classroom_id,
        studentId,
        teacherId: classroom.teacher_id
      });

      res.status(201).json({
        message: 'Classroom membership requested',
        data: {
          membership: {
            id: membership.id,
            status: membership.status,
            requested_at: membership.requested_at
          },
          classroom: {
            id: classroom.id,
            name: classroom.name,
            teacher_name: classroom.Teacher?.display_name
          },
          next_steps: {
            message: 'Your request has been sent to the teacher for approval',
            status: 'pending_approval'
          }
        }
      });

    } catch (error) {
      luderror.auth('Failed to join classroom:', error);
      res.status(500).json({
        error: 'Failed to request classroom membership',
        code: 'JOIN_CLASSROOM_FAILED'
      });
    }
  }
);

export default router;