/**
 * @openapi
 * components:
 *   schemas:
 *     RegisterRequest:
 *       type: object
 *       required: [email, password]
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "teacher@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "securepassword123"
 *         fullName:
 *           type: string
 *           example: "Sarah Cohen"
 *         phone:
 *           type: string
 *           example: "+972501234567"
 *
 *     PlayerAuthResponse:
 *       type: object
 *       required: [entityType, id, privacy_code, display_name]
 *       properties:
 *         entityType:
 *           type: string
 *           enum: [player]
 *           example: "player"
 *         id:
 *           type: string
 *           example: "player_abc123"
 *         privacy_code:
 *           type: string
 *           example: "PLAY1234"
 *         display_name:
 *           type: string
 *           example: "Player 123"
 *         teacher_id:
 *           type: string
 *           nullable: true
 *           example: "user_teacher456"
 *         teacher:
 *           type: object
 *           nullable: true
 *         achievements:
 *           type: array
 *           items:
 *             type: string
 *         preferences:
 *           type: object
 *         is_online:
 *           type: boolean
 *           example: true
 *         sessionType:
 *           type: string
 *           example: "anonymous"
 *
 *     FirebaseLoginRequest:
 *       type: object
 *       required: [idToken]
 *       properties:
 *         idToken:
 *           type: string
 *           description: Firebase ID token from frontend authentication
 *           example: "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE..."
 *
 *     StudentAccessRequest:
 *       type: object
 *       properties:
 *         lobby_code:
 *           type: string
 *           pattern: '^[A-Z0-9]{6}$'
 *           example: "ABC123"
 *           description: Game lobby code for student access
 *         session_id:
 *           type: string
 *           example: "session_xyz789"
 *           description: Game session ID for student access
 *         teacher_invitation_code:
 *           type: string
 *           pattern: '^[A-Z0-9]{6}$'
 *           example: "DEF456"
 *           description: Teacher invitation code for linking student to teacher
 *       description: Student portal access request (one of lobby_code, session_id, or teacher_invitation_code required)
 *
 *     AuthResponse:
 *       type: object
 *       required: [user, session]
 *       properties:
 *         user:
 *           $ref: '#/components/schemas/User'
 *         session:
 *           type: object
 *           properties:
 *             sessionId:
 *               type: string
 *               example: "session_abc123"
 *             expiresAt:
 *               type: string
 *               format: date-time
 *               example: "2025-01-16T10:00:00Z"
 *         message:
 *           type: string
 *           example: "Login successful"
 *
 *     StudentPortalAuthResponse:
 *       type: object
 *       required: [accessType, sessionContext]
 *       properties:
 *         accessType:
 *           type: string
 *           enum: [lobby_access, session_access, teacher_invite, authenticated]
 *           description: Type of student portal access granted
 *         sessionContext:
 *           type: object
 *           description: Context-specific data for the access type
 *         user:
 *           $ref: '#/components/schemas/User'
 *           nullable: true
 *           description: User object if authenticated, null for anonymous access
 *
 *     TeacherInviteLinkRequest:
 *       type: object
 *       required: [teacher_invitation_code]
 *       properties:
 *         teacher_invitation_code:
 *           type: string
 *           pattern: '^[A-Z0-9]{6}$'
 *           example: "ABC123"
 *           description: Teacher invitation code to link student account
 *
 *     TeacherInviteLinkResponse:
 *       type: object
 *       required: [success, message]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Successfully linked to teacher"
 *         teacher:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             full_name:
 *               type: string
 *         consent_created:
 *           type: boolean
 *           description: Whether parent consent was created during linking
 *
 *     RefreshTokenRequest:
 *       type: object
 *       required: [refresh_token]
 *       properties:
 *         refresh_token:
 *           type: string
 *           example: "refresh_abc123xyz"
 *           description: Refresh token for obtaining new access token
 *
 *     RefreshTokenResponse:
 *       type: object
 *       required: [access_token, expires_in]
 *       properties:
 *         access_token:
 *           type: string
 *           description: New JWT access token
 *         expires_in:
 *           type: integer
 *           example: 3600
 *           description: Token expiration time in seconds
 *         refresh_token:
 *           type: string
 *           nullable: true
 *           description: New refresh token (optional, returned if rotation is enabled)
 *
 *     LogoutResponse:
 *       type: object
 *       required: [success, message]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Logged out successfully"
 *
 *     SessionValidationResponse:
 *       type: object
 *       required: [valid, user]
 *       properties:
 *         valid:
 *           type: boolean
 *           example: true
 *           description: Whether the session is valid
 *         user:
 *           $ref: '#/components/schemas/User'
 *           nullable: true
 *           description: User object if session is valid
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2025-01-16T10:00:00Z"
 */

export default {};
