/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required: [id, email, role]
 *       properties:
 *         id:
 *           type: string
 *           example: "user_abc123"
 *         email:
 *           type: string
 *           format: email
 *           example: "teacher@example.com"
 *         role:
 *           type: string
 *           enum: [student, teacher, admin]
 *           example: "teacher"
 *         first_name:
 *           type: string
 *           example: "Sarah"
 *         last_name:
 *           type: string
 *           example: "Cohen"
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-01-15T10:00:00Z"
 *
 *     AccessControlResponse:
 *       type: object
 *       required: [hasAccess, accessType, canDownload, canPreview, canPlay, remainingAllowances]
 *       properties:
 *         hasAccess:
 *           type: boolean
 *           description: Whether user can access this content
 *           example: true
 *         accessType:
 *           type: string
 *           enum: [creator, purchase, subscription_claim, student_via_teacher, none]
 *           description: How the user gained access
 *           example: "purchase"
 *         canDownload:
 *           type: boolean
 *           description: Whether user can download content files
 *           example: true
 *         canPreview:
 *           type: boolean
 *           description: Whether user can see preview/demo
 *           example: true
 *         canPlay:
 *           type: boolean
 *           description: Whether user can play/use the content
 *           example: true
 *         remainingAllowances:
 *           oneOf:
 *             - type: number
 *               minimum: 0
 *             - type: string
 *               enum: [unlimited]
 *           description: How many uses remaining (or 'unlimited')
 *           example: "unlimited"
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: When access expires (null = never expires)
 *           example: null
 *
 *     ErrorResponse:
 *       type: object
 *       required: [error, message]
 *       properties:
 *         error:
 *           type: string
 *           example: "PRODUCT_NOT_FOUND"
 *         message:
 *           type: string
 *           example: "Product with ID 'game_123' was not found"
 *         details:
 *           type: object
 *           description: Additional error context
 */
