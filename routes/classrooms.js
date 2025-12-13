import express from 'express';
import { authenticateToken, authenticateUserOrPlayer } from '../middleware/auth.js';
import { addETagSupport } from '../middleware/etagMiddleware.js';
import { validateBody, rateLimiters, schemas } from '../middleware/validation.js';
import { checkStudentsAccess } from '../middleware/studentsAccessMiddleware.js';
import models from '../models/index.js';
import SettingsService from '../services/SettingsService.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { isPlayerId } from '../utils/studentUtils.js';

const router = express.Router();

/**
 * @openapi
 * /api/classrooms/discover:
 *   post:
 *     summary: Discover classrooms by teacher invitation code
 *     tags: [Classrooms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invitation_code
 *             properties:
 *               invitation_code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 pattern: '^[A-Z0-9]{6}$'
 *                 example: 'ABC123'
 *                 description: Teacher's 6-character invitation code
 *     responses:
 *       200:
 *         description: Classrooms found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 teacher:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'user_abc123def456'
 *                     full_name:
 *                       type: string
 *                       example: 'Sarah Johnson'
 *                     email:
 *                       type: string
 *                       example: 'sarah.johnson@school.edu'
 *                     invitation_code:
 *                       type: string
 *                       example: 'ABC123'
 *                 classrooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: 'classroom_123'
 *                       name:
 *                         type: string
 *                         example: '5th Grade Math'
 *                       grade_level:
 *                         type: string
 *                         example: '5'
 *                       description:
 *                         type: string
 *                         example: 'Advanced mathematics for 5th graders'
 *                       year:
 *                         type: string
 *                         example: '2024-2025'
 *                       student_count:
 *                         type: integer
 *                         example: 24
 *                       can_request:
 *                         type: boolean
 *                         example: true
 *                         description: Whether student can request to join this classroom
 *                       current_membership_status:
 *                         type: string
 *                         nullable: true
 *                         enum: [null, 'pending', 'active', 'denied', 'inactive']
 *                         example: null
 *                         description: Current membership status if already requested
 *       400:
 *         description: Invalid invitation code format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No teacher found with this invitation code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/discover', checkStudentsAccess, rateLimiters.auth, async (req, res) => {
  try {
    ludlog.auth('[CLASSROOM-DISCOVER] Starting classroom discovery', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      hasUser: !!req.user,
      hasPlayer: !!req.player
    });

    const { invitation_code } = req.body;

    // Get student ID (unified approach: either user ID or player ID)
    // Handle case where req.entityType might not be set by checkStudentsAccess
    let studentId = null;
    let isPlayer = false;

    if (req.user && req.user.id) {
      studentId = req.user.id;
      isPlayer = false;
    } else if (req.player && req.player.id) {
      studentId = req.player.id;
      isPlayer = true;
    } else if (req.entityType === 'user' && req.user) {
      studentId = req.user.id;
      isPlayer = false;
    } else if (req.entityType === 'player' && req.player) {
      studentId = req.player.id;
      isPlayer = true;
    } else {
      // No authentication found - this shouldn't happen with proper settings-based access control
      return res.status(401).json({
        error: 'Authentication required to discover classrooms',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    ludlog.auth('[CLASSROOM-DISCOVER] Processing discovery request', {
      studentId,
      isPlayer,
      invitationCode: invitation_code
    });

    // Validate invitation code
    if (!invitation_code || typeof invitation_code !== 'string') {
      return res.status(400).json({
        error: 'Invitation code is required',
        code: 'MISSING_INVITATION_CODE'
      });
    }

    // Validate invitation code format (6 alphanumeric characters)
    const trimmedCode = invitation_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
      ludlog.auth('[CLASSROOM-DISCOVER] Invalid invitation code format attempted', {
        studentId,
        attemptedCode: invitation_code,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Invalid invitation code format. Code must be 6 alphanumeric characters.',
        code: 'INVALID_FORMAT'
      });
    }

    // Find teacher by invitation code
    const teacher = await models.User.findOne({
      where: {
        invitation_code: trimmedCode,
        user_type: 'teacher',
        is_active: true
      },
      attributes: ['id', 'full_name', 'first_name', 'last_name', 'profile_image_url', 'email', 'invitation_code']
    });

    if (!teacher) {
      ludlog.auth('[CLASSROOM-DISCOVER] Teacher not found for invitation code', {
        studentId,
        attemptedCode: trimmedCode,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(404).json({
        error: 'No teacher found with this invitation code',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    ludlog.auth('[CLASSROOM-DISCOVER] Teacher found', {
      studentId,
      teacherId: teacher.id,
      teacherName: teacher.full_name,
      invitationCode: trimmedCode
    });

    // Get teacher's active classrooms with student counts
    const classrooms = await models.Classroom.findAll({
      where: {
        teacher_id: teacher.id,
        is_active: true
      },
      attributes: [
        'id', 'name', 'grade_level', 'description', 'year', 'created_at'
      ],
      order: [['name', 'ASC']]
    });

    ludlog.auth('[CLASSROOM-DISCOVER] Found classrooms', {
      studentId,
      teacherId: teacher.id,
      classroomCount: classrooms.length
    });

    // For each classroom, get student count and check student's current membership status
    const enrichedClassrooms = await Promise.all(classrooms.map(async (classroom) => {
      // Get student count for this classroom
      const studentCount = await models.ClassroomMembership.count({
        where: {
          classroom_id: classroom.id,
          status: 'active'
        }
      });

      // Check if current student has any existing membership request
      const existingMembership = await models.ClassroomMembership.findOne({
        where: {
          classroom_id: classroom.id,
          student_id: studentId
        },
        attributes: ['status']
      });

      const membershipStatus = existingMembership ? existingMembership.status : null;

      // Student can request if they don't have any membership or if previous was denied
      const canRequest = !existingMembership || existingMembership.status === 'denied';

      return {
        id: classroom.id,
        name: classroom.name,
        grade_level: classroom.grade_level,
        description: classroom.description,
        year: classroom.year,
        student_count: studentCount,
        can_request: canRequest,
        current_membership_status: membershipStatus,
        created_at: classroom.created_at
      };
    }));

    ludlog.auth('[CLASSROOM-DISCOVER] Classroom discovery completed successfully', {
      studentId,
      teacherId: teacher.id,
      teacherName: teacher.full_name,
      classroomsFound: enrichedClassrooms.length,
      requestableClassrooms: enrichedClassrooms.filter(c => c.can_request).length
    });

    res.json({
      success: true,
      teacher: {
        id: teacher.id,
        full_name: teacher.full_name,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        profile_image_url: teacher.profile_image_url,
        email: teacher.email,
        invitation_code: teacher.invitation_code
      },
      classrooms: enrichedClassrooms
    });

  } catch (error) {
    luderror.auth('[CLASSROOM-DISCOVER] Classroom discovery failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      studentId: req.entityType === 'user' ? req.user?.id : req.player?.id,
      invitationCode: req.body.invitation_code,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to discover classrooms',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * @openapi
 * /api/classrooms/request-membership:
 *   post:
 *     summary: Request to join a classroom
 *     tags: [Classrooms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - classroom_id
 *             properties:
 *               classroom_id:
 *                 type: string
 *                 example: 'classroom_123'
 *                 description: ID of the classroom to request membership
 *               request_message:
 *                 type: string
 *                 maxLength: 500
 *                 example: 'Hi Mrs. Johnson, I would like to join your math class.'
 *                 description: Optional message from student to teacher
 *               student_display_name:
 *                 type: string
 *                 maxLength: 100
 *                 example: 'Alex S.'
 *                 description: Optional custom display name for privacy
 *     responses:
 *       201:
 *         description: Membership request created successfully
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
 *                   example: 'Membership request sent successfully'
 *                 membership:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'membership_456'
 *                     classroom_id:
 *                       type: string
 *                       example: 'classroom_123'
 *                     student_id:
 *                       type: string
 *                       example: 'user_abc123def456'
 *                     status:
 *                       type: string
 *                       enum: ['pending']
 *                       example: 'pending'
 *                     requested_at:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-12-11T10:30:00Z'
 *                     request_message:
 *                       type: string
 *                       nullable: true
 *                       example: 'Hi Mrs. Johnson, I would like to join your math class.'
 *       400:
 *         description: Invalid request or student already has membership
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Classroom not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/request-membership', checkStudentsAccess, rateLimiters.auth, async (req, res) => {
  try {
    ludlog.auth('[CLASSROOM-REQUEST] Starting membership request', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      hasUser: !!req.user,
      hasPlayer: !!req.player
    });

    const { classroom_id, request_message, student_display_name } = req.body;

    // Get student ID (unified approach: either user ID or player ID)
    // Handle case where req.entityType might not be set by checkStudentsAccess
    let studentId = null;
    let isPlayer = false;

    if (req.user && req.user.id) {
      studentId = req.user.id;
      isPlayer = false;
    } else if (req.player && req.player.id) {
      studentId = req.player.id;
      isPlayer = true;
    } else if (req.entityType === 'user' && req.user) {
      studentId = req.user.id;
      isPlayer = false;
    } else if (req.entityType === 'player' && req.player) {
      studentId = req.player.id;
      isPlayer = true;
    } else {
      // No authentication found - this shouldn't happen with proper settings-based access control
      return res.status(401).json({
        error: 'Authentication required to request classroom membership',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    ludlog.auth('[CLASSROOM-REQUEST] Processing membership request', {
      studentId,
      isPlayer,
      classroomId: classroom_id
    });

    // Validate required fields
    if (!classroom_id) {
      return res.status(400).json({
        error: 'classroom_id is required',
        code: 'MISSING_CLASSROOM_ID'
      });
    }

    // Validate message length if provided
    if (request_message && request_message.length > 500) {
      return res.status(400).json({
        error: 'Request message must not exceed 500 characters',
        code: 'MESSAGE_TOO_LONG'
      });
    }

    // Validate display name length if provided
    if (student_display_name && student_display_name.length > 100) {
      return res.status(400).json({
        error: 'Student display name must not exceed 100 characters',
        code: 'DISPLAY_NAME_TOO_LONG'
      });
    }

    // Find the classroom and teacher
    const classroom = await models.Classroom.findOne({
      where: {
        id: classroom_id,
        is_active: true
      },
      include: [{
        model: models.User,
        as: 'Teacher',
        attributes: ['id', 'full_name', 'first_name', 'last_name', 'profile_image_url', 'email']
      }]
    });

    if (!classroom) {
      ludlog.auth('[CLASSROOM-REQUEST] Classroom not found', {
        studentId,
        classroomId: classroom_id,
        ip: req.ip
      });

      return res.status(404).json({
        error: 'Classroom not found or inactive',
        code: 'CLASSROOM_NOT_FOUND'
      });
    }

    ludlog.auth('[CLASSROOM-REQUEST] Classroom found', {
      studentId,
      classroomId: classroom_id,
      teacherId: classroom.teacher_id,
      classroomName: classroom.name
    });

    // Check if student already has a membership in this classroom
    const existingMembership = await models.ClassroomMembership.findOne({
      where: {
        classroom_id: classroom_id,
        student_id: studentId
      }
    });

    if (existingMembership) {
      const status = existingMembership.status;

      // If membership exists and is not denied, reject the request
      if (status !== 'denied') {
        ludlog.auth('[CLASSROOM-REQUEST] Student already has membership', {
          studentId,
          classroomId: classroom_id,
          existingStatus: status
        });

        let errorMessage = 'You already have a membership in this classroom';
        let errorCode = 'MEMBERSHIP_EXISTS';

        switch (status) {
          case 'pending':
            errorMessage = 'You already have a pending request for this classroom';
            errorCode = 'REQUEST_PENDING';
            break;
          case 'active':
            errorMessage = 'You are already a member of this classroom';
            errorCode = 'ALREADY_MEMBER';
            break;
          case 'inactive':
            errorMessage = 'Your membership in this classroom has been deactivated';
            errorCode = 'MEMBERSHIP_INACTIVE';
            break;
        }

        return res.status(400).json({
          error: errorMessage,
          code: errorCode,
          current_status: status
        });
      }

      // If status is 'denied', we allow re-requesting (will update existing record)
      ludlog.auth('[CLASSROOM-REQUEST] Previous denied membership found, allowing re-request', {
        studentId,
        classroomId: classroom_id,
        previousDeniedAt: existingMembership.approved_at
      });
    }

    // Check settings-based access control
    const settings = await SettingsService.getSettings();
    const studentsAccess = settings.students_access || 'invite_only';

    // For players, check if student portal access is allowed
    if (isPlayer && studentsAccess === 'authed_only') {
      return res.status(403).json({
        error: 'Anonymous students cannot request classroom membership. Please create an account.',
        code: 'ANONYMOUS_NOT_ALLOWED'
      });
    }

    // Create or update membership request
    const transaction = await models.sequelize.transaction();

    try {
      let membership;

      if (existingMembership && existingMembership.status === 'denied') {
        // Update existing denied membership to pending
        membership = await existingMembership.update({
          status: 'pending',
          requested_at: new Date(),
          approved_at: null,
          request_message: request_message || null,
          approval_message: null,
          student_display_name: student_display_name || null,
          updated_at: new Date()
        }, { transaction });

        ludlog.auth('[CLASSROOM-REQUEST] Updated existing denied membership to pending', {
          membershipId: membership.id,
          studentId,
          classroomId: classroom_id
        });
      } else {
        // Create new membership request
        membership = await models.ClassroomMembership.create({
          classroom_id: classroom_id,
          student_id: studentId,
          teacher_id: classroom.teacher_id,
          status: 'pending',
          requested_at: new Date(),
          request_message: request_message || null,
          student_display_name: student_display_name || null
        }, { transaction });

        ludlog.auth('[CLASSROOM-REQUEST] Created new membership request', {
          membershipId: membership.id,
          studentId,
          classroomId: classroom_id,
          teacherId: classroom.teacher_id
        });
      }

      await transaction.commit();

      ludlog.auth('[CLASSROOM-REQUEST] Membership request completed successfully', {
        membershipId: membership.id,
        studentId,
        classroomId: classroom_id,
        teacherId: classroom.teacher_id,
        classroomName: classroom.name,
        isUpdate: !!(existingMembership && existingMembership.status === 'denied')
      });

      res.status(201).json({
        success: true,
        message: 'Membership request sent successfully',
        membership: {
          id: membership.id,
          classroom_id: membership.classroom_id,
          student_id: membership.student_id,
          status: membership.status,
          requested_at: membership.requested_at,
          request_message: membership.request_message,
          student_display_name: membership.student_display_name
        },
        classroom: {
          id: classroom.id,
          name: classroom.name,
          teacher_name: classroom.Teacher.full_name
        }
      });

    } catch (createError) {
      await transaction.rollback();
      throw createError;
    }

  } catch (error) {
    luderror.auth('[CLASSROOM-REQUEST] Membership request failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      entityType: req.entityType,
      studentId: req.entityType === 'user' ? req.user?.id : req.player?.id,
      classroomId: req.body.classroom_id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to request classroom membership',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * @openapi
 * /api/classrooms/membership/{membershipId}/approve:
 *   post:
 *     summary: Approve or deny a classroom membership request
 *     tags: [Classrooms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: membershipId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: 'membership_456'
 *         description: ID of the membership request to approve/deny
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: ['approve', 'deny']
 *                 example: 'approve'
 *                 description: Action to take on the membership request
 *               approval_message:
 *                 type: string
 *                 maxLength: 500
 *                 example: 'Welcome to our math class! Please bring a notebook.'
 *                 description: Optional message from teacher to student
 *     responses:
 *       200:
 *         description: Membership request processed successfully
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
 *                   example: 'Membership request approved successfully'
 *                 membership:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'membership_456'
 *                     classroom_id:
 *                       type: string
 *                       example: 'classroom_123'
 *                     student_id:
 *                       type: string
 *                       example: 'user_abc123def456'
 *                     status:
 *                       type: string
 *                       enum: ['active', 'denied']
 *                       example: 'active'
 *                     approved_at:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-12-11T11:15:00Z'
 *                     approval_message:
 *                       type: string
 *                       nullable: true
 *                       example: 'Welcome to our math class!'
 *                 student:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'user_abc123def456'
 *                     display_name:
 *                       type: string
 *                       example: 'Alex S.'
 *                       description: Student's display name or custom privacy name
 *                     entity_type:
 *                       type: string
 *                       enum: ['user', 'player']
 *                       example: 'user'
 *       400:
 *         description: Invalid request or membership not in pending status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Teacher does not have permission for this membership
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Membership request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/membership/:membershipId/approve', authenticateToken, rateLimiters.auth, async (req, res) => {
  try {
    ludlog.auth('[MEMBERSHIP-APPROVE] Starting membership approval process', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      teacherId: req.user.id,
      membershipId: req.params.membershipId
    });

    const { membershipId } = req.params;
    const { action, approval_message } = req.body;
    const teacher = req.user;

    // Only teachers can approve/deny membership requests
    if (!teacher || teacher.user_type !== 'teacher') {
      return res.status(403).json({
        error: 'Only teachers can approve or deny membership requests',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    // Validate required fields
    if (!action || !['approve', 'deny'].includes(action)) {
      return res.status(400).json({
        error: 'Action must be either "approve" or "deny"',
        code: 'INVALID_ACTION'
      });
    }

    // Validate approval message length if provided
    if (approval_message && approval_message.length > 500) {
      return res.status(400).json({
        error: 'Approval message must not exceed 500 characters',
        code: 'MESSAGE_TOO_LONG'
      });
    }

    ludlog.auth('[MEMBERSHIP-APPROVE] Processing approval request', {
      teacherId: teacher.id,
      membershipId,
      action,
      hasMessage: !!approval_message
    });

    // Find the membership request with classroom and student info
    const membership = await models.ClassroomMembership.findOne({
      where: { id: membershipId },
      include: [
        {
          model: models.Classroom,
          attributes: ['id', 'name', 'teacher_id']
        },
        {
          model: models.User,
          as: 'Student',
          required: false, // Left join in case it's a player
          attributes: ['id', 'full_name', 'first_name', 'last_name', 'profile_image_url', 'email', 'user_type']
        }
      ]
    });

    if (!membership) {
      ludlog.auth('[MEMBERSHIP-APPROVE] Membership request not found', {
        teacherId: teacher.id,
        membershipId,
        ip: req.ip
      });

      return res.status(404).json({
        error: 'Membership request not found',
        code: 'MEMBERSHIP_NOT_FOUND'
      });
    }

    ludlog.auth('[MEMBERSHIP-APPROVE] Membership found', {
      teacherId: teacher.id,
      membershipId,
      classroomId: membership.classroom_id,
      studentId: membership.student_id,
      currentStatus: membership.status
    });

    // Verify teacher owns this classroom
    if (!membership.Classroom || membership.Classroom.teacher_id !== teacher.id) {
      ludlog.auth('[MEMBERSHIP-APPROVE] Teacher permission denied', {
        teacherId: teacher.id,
        membershipId,
        classroomTeacherId: membership.Classroom?.teacher_id,
        classroomId: membership.classroom_id
      });

      return res.status(403).json({
        error: 'You do not have permission to approve requests for this classroom',
        code: 'UNAUTHORIZED_CLASSROOM'
      });
    }

    // Check if membership is in pending status
    if (membership.status !== 'pending') {
      ludlog.auth('[MEMBERSHIP-APPROVE] Membership not in pending status', {
        teacherId: teacher.id,
        membershipId,
        currentStatus: membership.status
      });

      return res.status(400).json({
        error: `Membership is not pending approval. Current status: ${membership.status}`,
        code: 'NOT_PENDING',
        current_status: membership.status
      });
    }

    // Determine student info (could be User or Player)
    let studentInfo;
    let isPlayer = false;

    if (membership.Student) {
      // It's a registered User
      studentInfo = {
        id: membership.Student.id,
        display_name: membership.student_display_name || membership.Student.full_name || 'Student',
        entity_type: 'user'
      };
    } else {
      // Check if it's a Player (student_id starts with 'player_')
      if (isPlayerId(membership.student_id)) {
        isPlayer = true;

        // Fetch student user information (unified User system with user_type='player')
        const studentUser = await models.User.findOne({
          where: {
            id: membership.student_id,
            user_type: 'player'
          }
        });

        if (studentUser) {
          studentInfo = {
            id: studentUser.id,
            display_name: membership.student_display_name || studentUser.first_name || studentUser.full_name || 'Anonymous Student',
            entity_type: 'player'
          };
        } else {
          // Student user not found, might have been deleted
          studentInfo = {
            id: membership.student_id,
            display_name: membership.student_display_name || 'Unknown Student',
            entity_type: 'player'
          };
        }
      } else {
        // Neither User nor Player found - data inconsistency
        return res.status(400).json({
          error: 'Student record not found',
          code: 'STUDENT_NOT_FOUND'
        });
      }
    }

    ludlog.auth('[MEMBERSHIP-APPROVE] Student identified', {
      teacherId: teacher.id,
      membershipId,
      studentId: studentInfo.id,
      studentType: studentInfo.entity_type,
      isPlayer
    });

    // Process the approval or denial
    const transaction = await models.sequelize.transaction();

    try {
      const newStatus = action === 'approve' ? 'active' : 'denied';

      const updatedMembership = await membership.update({
        status: newStatus,
        approved_at: new Date(),
        approval_message: approval_message || null,
        updated_at: new Date()
      }, { transaction });

      await transaction.commit();

      const actionText = action === 'approve' ? 'approved' : 'denied';

      ludlog.auth(`[MEMBERSHIP-APPROVE] Membership request ${actionText} successfully`, {
        teacherId: teacher.id,
        membershipId,
        classroomId: membership.classroom_id,
        classroomName: membership.Classroom.name,
        studentId: studentInfo.id,
        studentType: studentInfo.entity_type,
        newStatus,
        approvalMessage: approval_message || 'No message'
      });

      res.json({
        success: true,
        message: `Membership request ${actionText} successfully`,
        membership: {
          id: updatedMembership.id,
          classroom_id: updatedMembership.classroom_id,
          student_id: updatedMembership.student_id,
          status: updatedMembership.status,
          approved_at: updatedMembership.approved_at,
          approval_message: updatedMembership.approval_message,
          request_message: updatedMembership.request_message
        },
        classroom: {
          id: membership.Classroom.id,
          name: membership.Classroom.name
        },
        student: studentInfo,
        action: action
      });

    } catch (updateError) {
      await transaction.rollback();
      throw updateError;
    }

  } catch (error) {
    luderror.auth('[MEMBERSHIP-APPROVE] Membership approval failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      teacherId: req.user?.id,
      membershipId: req.params.membershipId,
      action: req.body.action,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to process membership request',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * @openapi
 * /api/classrooms/membership/pending:
 *   get:
 *     summary: Get pending membership requests for teacher's classrooms
 *     tags: [Classrooms]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: classroom_id
 *         in: query
 *         schema:
 *           type: string
 *         example: 'classroom_123'
 *         description: Filter by specific classroom ID (optional)
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         example: 20
 *         description: Maximum number of requests to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         example: 0
 *         description: Number of requests to skip for pagination
 *     responses:
 *       200:
 *         description: Pending membership requests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 requests:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: 'membership_456'
 *                       classroom_id:
 *                         type: string
 *                         example: 'classroom_123'
 *                       student_id:
 *                         type: string
 *                         example: 'user_abc123def456'
 *                       status:
 *                         type: string
 *                         example: 'pending'
 *                       requested_at:
 *                         type: string
 *                         format: date-time
 *                         example: '2024-12-11T09:30:00Z'
 *                       request_message:
 *                         type: string
 *                         nullable: true
 *                         example: 'I would like to join your class'
 *                       student_display_name:
 *                         type: string
 *                         nullable: true
 *                         example: 'Alex S.'
 *                       classroom:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: 'classroom_123'
 *                           name:
 *                             type: string
 *                             example: '5th Grade Math'
 *                           grade_level:
 *                             type: string
 *                             example: '5'
 *                       student:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: 'user_abc123def456'
 *                           display_name:
 *                             type: string
 *                             example: 'Alex Smith'
 *                           entity_type:
 *                             type: string
 *                             enum: ['user', 'player']
 *                             example: 'user'
 *                           email:
 *                             type: string
 *                             nullable: true
 *                             example: 'alex@example.com'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 15
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     has_more:
 *                       type: boolean
 *                       example: false
 *       403:
 *         description: Only teachers can access pending requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/membership/pending', authenticateToken, addETagSupport('classroom-pending'), async (req, res) => {
  try {
    ludlog.auth('[PENDING-REQUESTS] Starting pending requests fetch', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      teacherId: req.user.id
    });

    const teacher = req.user;

    // Only teachers can view pending membership requests
    if (!teacher || teacher.user_type !== 'teacher') {
      return res.status(403).json({
        error: 'Only teachers can view pending membership requests',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    const { classroom_id, limit = 20, offset = 0 } = req.query;

    // Validate pagination parameters
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const parsedOffset = Math.max(parseInt(offset) || 0, 0);

    ludlog.auth('[PENDING-REQUESTS] Processing request parameters', {
      teacherId: teacher.id,
      classroomId: classroom_id,
      limit: parsedLimit,
      offset: parsedOffset
    });

    // Build where conditions
    const whereConditions = {
      teacher_id: teacher.id,
      status: 'pending'
    };

    if (classroom_id) {
      whereConditions.classroom_id = classroom_id;
    }

    // Get total count for pagination
    const totalCount = await models.ClassroomMembership.count({
      where: whereConditions
    });

    // Get pending requests with related data
    const pendingRequests = await models.ClassroomMembership.findAll({
      where: whereConditions,
      include: [
        {
          model: models.Classroom,
          attributes: ['id', 'name', 'grade_level', 'description']
        },
        {
          model: models.User,
          as: 'Student',
          required: false, // Left join for players
          attributes: ['id', 'full_name', 'first_name', 'last_name', 'profile_image_url', 'email', 'user_type']
        }
      ],
      order: [['requested_at', 'ASC']], // Oldest requests first
      limit: parsedLimit,
      offset: parsedOffset
    });

    ludlog.auth('[PENDING-REQUESTS] Found pending requests', {
      teacherId: teacher.id,
      totalCount,
      returnedCount: pendingRequests.length,
      classroomFilter: classroom_id
    });

    // Process requests to include student information (User or Player)
    const enrichedRequests = await Promise.all(pendingRequests.map(async (request) => {
      let studentInfo;

      if (request.Student) {
        // It's a registered User
        studentInfo = {
          id: request.Student.id,
          display_name: request.student_display_name || request.Student.full_name || 'Student',
          entity_type: 'user',
          email: request.Student.email
        };
      } else {
        // Check if it's a student user (user_type='player')
        if (request.student_id.startsWith('player_')) {
          const studentUser = await models.User.findOne({
            where: {
              id: request.student_id,
              user_type: 'player'
            }
          });

          if (studentUser) {
            studentInfo = {
              id: studentUser.id,
              display_name: request.student_display_name || studentUser.first_name || studentUser.full_name || 'Anonymous Student',
              entity_type: 'player',
              email: studentUser.email || null // Students may have email in unified system
            };
          } else {
            // Student user not found
            studentInfo = {
              id: request.student_id,
              display_name: request.student_display_name || 'Unknown Student',
              entity_type: 'player',
              email: null
            };
          }
        } else {
          // Unknown student type
          studentInfo = {
            id: request.student_id,
            display_name: request.student_display_name || 'Unknown Student',
            entity_type: 'unknown',
            email: null
          };
        }
      }

      return {
        id: request.id,
        classroom_id: request.classroom_id,
        student_id: request.student_id,
        status: request.status,
        requested_at: request.requested_at,
        request_message: request.request_message,
        student_display_name: request.student_display_name,
        classroom: {
          id: request.Classroom.id,
          name: request.Classroom.name,
          grade_level: request.Classroom.grade_level,
          description: request.Classroom.description
        },
        student: studentInfo
      };
    }));

    const paginationInfo = {
      total: totalCount,
      limit: parsedLimit,
      offset: parsedOffset,
      has_more: (parsedOffset + parsedLimit) < totalCount
    };

    ludlog.auth('[PENDING-REQUESTS] Pending requests fetched successfully', {
      teacherId: teacher.id,
      totalCount,
      returnedCount: enrichedRequests.length,
      pagination: paginationInfo
    });

    res.json({
      success: true,
      requests: enrichedRequests,
      pagination: paginationInfo
    });

  } catch (error) {
    luderror.auth('[PENDING-REQUESTS] Failed to fetch pending requests', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      teacherId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to fetch pending membership requests',
      code: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

/**
 * @openapi
 * /api/classrooms/migrate-player:
 *   post:
 *     summary: Migrate an anonymous player to an authenticated user account
 *     tags: [Classrooms]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - player_id
 *             properties:
 *               player_id:
 *                 type: string
 *                 pattern: '^player_[A-Z0-9]{6}$'
 *                 example: 'player_ABC123'
 *                 description: ID of the anonymous player to migrate
 *               preserve_display_name:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Whether to preserve the player's display name
 *               preserve_achievements:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Whether to preserve the player's achievements
 *               preserve_preferences:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *                 description: Whether to preserve the player's preferences
 *     responses:
 *       200:
 *         description: Player migrated to user successfully
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
 *                   example: 'Player migrated to user account successfully'
 *                 migration:
 *                   type: object
 *                   properties:
 *                     from_player_id:
 *                       type: string
 *                       example: 'player_ABC123'
 *                     to_user_id:
 *                       type: string
 *                       example: 'user_def456ghi789'
 *                     migrated_at:
 *                       type: string
 *                       format: date-time
 *                       example: '2024-12-11T12:00:00Z'
 *                     data_preserved:
 *                       type: object
 *                       properties:
 *                         display_name:
 *                           type: boolean
 *                           example: true
 *                         achievements:
 *                           type: boolean
 *                           example: true
 *                         preferences:
 *                           type: boolean
 *                           example: true
 *                         classroom_memberships:
 *                           type: integer
 *                           example: 2
 *                         game_sessions:
 *                           type: integer
 *                           example: 15
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 'user_def456ghi789'
 *                     email:
 *                       type: string
 *                       example: 'student@example.com'
 *                     full_name:
 *                       type: string
 *                       example: 'John Smith'
 *                     user_type:
 *                       type: string
 *                       example: 'student'
 *       400:
 *         description: Invalid player ID or user not eligible for migration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: User is not authorized to migrate this player
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Player not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/migrate-player', authenticateToken, rateLimiters.auth, async (req, res) => {
  try {
    ludlog.auth('[PLAYER-MIGRATE] Starting player migration process', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user.id,
      userEmail: req.user.email
    });

    const {
      player_id,
      preserve_display_name = true,
      preserve_achievements = true,
      preserve_preferences = true
    } = req.body;
    const user = req.user;

    // Only authenticated users can migrate players
    if (!user || !user.id) {
      return res.status(403).json({
        error: 'Authentication required for player migration',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    // Validate player ID format
    if (!player_id || typeof player_id !== 'string' || !/^player_[A-Z0-9]{6}$/.test(player_id)) {
      return res.status(400).json({
        error: 'Invalid player ID format. Must be player_XXXXXX',
        code: 'INVALID_PLAYER_ID'
      });
    }

    ludlog.auth('[PLAYER-MIGRATE] Processing migration request', {
      userId: user.id,
      userEmail: user.email,
      playerId: player_id,
      preserveOptions: {
        display_name: preserve_display_name,
        achievements: preserve_achievements,
        preferences: preserve_preferences
      }
    });

    // Find the student user to migrate (unified User system with user_type='player')
    const studentUser = await models.User.findOne({
      where: {
        id: player_id,
        user_type: 'player'
      }
    });

    if (!studentUser) {
      ludlog.auth('[PLAYER-MIGRATE] Student user not found', {
        userId: user.id,
        playerId: player_id,
        ip: req.ip
      });

      return res.status(404).json({
        error: 'Student user not found',
        code: 'PLAYER_NOT_FOUND'
      });
    }

    ludlog.auth('[PLAYER-MIGRATE] Student user found', {
      userId: user.id,
      playerId: player_id,
      playerDisplayName: studentUser.first_name || studentUser.full_name,
      playerTeacherId: studentUser.linked_teacher_id
    });

    // Check authorization: User can migrate a student user if:
    // 1. User is a student without linked teacher (can link to any orphaned student)
    // 2. User is a student with linked teacher matching student's linked teacher
    // 3. User is a teacher who owns the student
    // 4. User is an admin (can migrate any student)

    const canMigrate = await checkPlayerMigrationPermission(user, studentUser);

    if (!canMigrate.allowed) {
      ludlog.auth('[PLAYER-MIGRATE] Migration permission denied', {
        userId: user.id,
        playerId: player_id,
        reason: canMigrate.reason,
        userType: user.user_type,
        userLinkedTeacher: user.linked_teacher_id,
        playerTeacher: studentUser.linked_teacher_id
      });

      return res.status(403).json({
        error: canMigrate.reason,
        code: 'MIGRATION_NOT_AUTHORIZED'
      });
    }

    // Check if user already has conflicting classroom memberships
    const existingUserMemberships = await models.ClassroomMembership.findAll({
      where: {
        student_id: user.id
      }
    });

    const playerMemberships = await models.ClassroomMembership.findAll({
      where: {
        student_id: player_id
      }
    });

    // Check for classroom conflicts
    const userClassroomIds = existingUserMemberships.map(m => m.classroom_id);
    const conflictingMemberships = playerMemberships.filter(m =>
      userClassroomIds.includes(m.classroom_id)
    );

    if (conflictingMemberships.length > 0) {
      ludlog.auth('[PLAYER-MIGRATE] Classroom membership conflicts detected', {
        userId: user.id,
        playerId: player_id,
        conflictingClassrooms: conflictingMemberships.map(m => m.classroom_id)
      });

      return res.status(400).json({
        error: 'Migration blocked: User already has membership in classrooms where player is also a member',
        code: 'CLASSROOM_CONFLICT',
        conflicting_classrooms: conflictingMemberships.map(m => ({
          classroom_id: m.classroom_id,
          user_status: existingUserMemberships.find(um => um.classroom_id === m.classroom_id)?.status,
          player_status: m.status
        }))
      });
    }

    // Perform migration in transaction
    const transaction = await models.sequelize.transaction();

    try {
      const migrationData = {
        from_player_id: player_id,
        to_user_id: user.id,
        migrated_at: new Date(),
        data_preserved: {}
      };

      // Update user profile with student user data if requested and not already set
      const userUpdates = {};

      if (preserve_display_name && !user.full_name && (studentUser.first_name || studentUser.full_name)) {
        userUpdates.full_name = studentUser.first_name || studentUser.full_name;
        migrationData.data_preserved.display_name = true;
      } else {
        migrationData.data_preserved.display_name = false;
      }

      // Merge achievements if requested
      if (preserve_achievements && studentUser.getAchievements() && studentUser.getAchievements().length > 0) {
        const existingAchievements = user.getAchievements() || [];
        const studentAchievements = studentUser.getAchievements();
        const mergedAchievements = [...existingAchievements, ...studentAchievements];
        // Remove duplicates based on achievement type/id
        const uniqueAchievements = mergedAchievements.filter((achievement, index, self) =>
          index === self.findIndex(a => a.type === achievement.type && a.id === achievement.id)
        );
        userUpdates.user_settings = { ...user.user_settings, achievements: uniqueAchievements };
        migrationData.data_preserved.achievements = true;
      } else {
        migrationData.data_preserved.achievements = false;
      }

      // Merge preferences if requested
      if (preserve_preferences && studentUser.user_settings && Object.keys(studentUser.user_settings).length > 0) {
        const existingPreferences = user.user_settings || {};
        userUpdates.user_settings = { ...existingPreferences, ...studentUser.user_settings };
        migrationData.data_preserved.preferences = true;
      } else {
        migrationData.data_preserved.preferences = false;
      }

      // Update user if there are changes
      if (Object.keys(userUpdates).length > 0) {
        await user.update(userUpdates, { transaction });
      }

      // Migrate classroom memberships
      const membershipUpdateCount = await models.ClassroomMembership.update({
        student_id: user.id
      }, {
        where: {
          student_id: player_id
        },
        transaction
      });

      migrationData.data_preserved.classroom_memberships = membershipUpdateCount[0] || 0;

      // Migrate game sessions (update participants JSONB)
      const gameSessions = await models.GameSession.findAll({
        where: {
          [models.Sequelize.Op.or]: [
            models.sequelize.literal(`participants::text LIKE '%"student_id":"${player_id}"%'`)
          ]
        },
        transaction
      });

      let gameSessionUpdateCount = 0;
      for (const session of gameSessions) {
        if (Array.isArray(session.participants)) {
          const updatedParticipants = session.participants.map(participant => {
            if (participant.student_id === player_id) {
              return { ...participant, student_id: user.id };
            }
            return participant;
          });

          await session.update({
            participants: updatedParticipants
          }, { transaction });

          gameSessionUpdateCount++;
        }
      }

      migrationData.data_preserved.game_sessions = gameSessionUpdateCount;

      // Migrate user sessions
      const sessionUpdateCount = await models.UserSession.update({
        student_id: user.id
      }, {
        where: {
          student_id: player_id
        },
        transaction
      });

      // Deactivate the student user account (soft delete)
      await studentUser.update({
        is_active: false,
        updated_at: new Date()
      }, { transaction });

      await transaction.commit();

      ludlog.auth('[PLAYER-MIGRATE] Player migration completed successfully', {
        userId: user.id,
        userEmail: user.email,
        playerId: player_id,
        migrationData,
        userUpdatesApplied: Object.keys(userUpdates),
        membershipsMigrated: migrationData.data_preserved.classroom_memberships,
        gameSessionsMigrated: migrationData.data_preserved.game_sessions,
        sessionsMigrated: sessionUpdateCount[0] || 0
      });

      res.json({
        success: true,
        message: 'Player migrated to user account successfully',
        migration: migrationData,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          user_type: user.user_type
        }
      });

    } catch (migrationError) {
      await transaction.rollback();
      throw migrationError;
    }

  } catch (error) {
    luderror.auth('[PLAYER-MIGRATE] Player migration failed', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
      userEmail: req.user?.email,
      playerId: req.body.player_id,
      error: error.message,
      stack: error.stack
    });

    res.status(500).json({
      error: 'Failed to migrate player',
      code: 'MIGRATION_FAILED',
      message: error.message
    });
  }
});

/**
 * Helper function to check if a user can migrate a specific student user
 */
async function checkPlayerMigrationPermission(user, studentUser) {
  try {
    // Admin users can migrate any student user
    if (user.role === 'admin') {
      return { allowed: true, reason: 'Admin privileges' };
    }

    // Teachers can migrate student users they own (via linked_teacher_id)
    if (user.user_type === 'teacher' && studentUser.linked_teacher_id === user.id) {
      return { allowed: true, reason: 'Teacher owns student user' };
    }

    // Students can migrate student users under specific conditions
    if (user.user_type === 'student') {
      // Student without linked teacher can migrate orphaned student users (no linked teacher)
      if (!user.linked_teacher_id && !studentUser.linked_teacher_id) {
        return { allowed: true, reason: 'Orphaned student user migration' };
      }

      // Student with linked teacher can migrate student users from same teacher
      if (user.linked_teacher_id && studentUser.linked_teacher_id === user.linked_teacher_id) {
        return { allowed: true, reason: 'Same teacher context' };
      }

      // Student can migrate their own previously created student accounts (edge case)
      // This would require additional tracking, for now we'll be restrictive
      return {
        allowed: false,
        reason: 'Students can only migrate student users from their linked teacher'
      };
    }

    // Other user types not allowed
    return {
      allowed: false,
      reason: 'Insufficient permissions for student user migration'
    };

  } catch (error) {
    luderror.auth('[MIGRATION-PERMISSION-CHECK] Permission check failed', {
      userId: user.id,
      studentUserId: studentUser.id,
      error: error.message
    });

    return {
      allowed: false,
      reason: 'Permission check failed'
    };
  }
}

export default router;