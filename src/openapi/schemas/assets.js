/**
 * @openapi
 * components:
 *   schemas:
 *     AssetInventory:
 *       type: object
 *       required: [entityType, entityId, assets, summary]
 *       properties:
 *         entityType:
 *           type: string
 *           enum: [workshop, course, file, tool]
 *           example: "workshop"
 *         entityId:
 *           type: string
 *           example: "ws_123abc"
 *         entity:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "ws_123abc"
 *             type:
 *               type: string
 *               example: "workshop"
 *         assets:
 *           type: object
 *           description: "Asset inventory by type"
 *           additionalProperties:
 *             oneOf:
 *               - $ref: '#/components/schemas/ExistingAsset'
 *               - $ref: '#/components/schemas/MissingAsset'
 *         summary:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               description: "Total possible asset types"
 *               example: 3
 *             existing:
 *               type: integer
 *               description: "Assets that exist"
 *               example: 1
 *             missing:
 *               type: integer
 *               description: "Assets that don't exist"
 *               example: 2
 *
 *     ExistingAsset:
 *       type: object
 *       required: [exists, filename, size, sizeFormatted, contentType, url]
 *       properties:
 *         exists:
 *           type: boolean
 *           example: true
 *         filename:
 *           type: string
 *           example: "video.mp4"
 *         size:
 *           type: integer
 *           description: "Size in bytes"
 *           example: 15728640
 *         sizeFormatted:
 *           type: string
 *           example: "15.0MB"
 *         contentType:
 *           type: string
 *           example: "video/mp4"
 *         lastModified:
 *           type: string
 *           format: date-time
 *           example: "2024-12-10T15:30:00Z"
 *         url:
 *           type: string
 *           example: "/api/assets/workshop/ws_123abc/marketing-video"
 *         canReplace:
 *           type: boolean
 *           example: true
 *
 *     MissingAsset:
 *       type: object
 *       required: [exists, reason, canUpload]
 *       properties:
 *         exists:
 *           type: boolean
 *           example: false
 *         reason:
 *           type: string
 *           example: "Not found in storage"
 *         canUpload:
 *           type: boolean
 *           example: true
 *         uploadUrl:
 *           type: string
 *           nullable: true
 *           example: "/api/assets/workshop/ws_123abc/content-video"
 *         error:
 *           type: string
 *           nullable: true
 *           description: "Error message if asset check failed"
 *
 *     AssetUploadResult:
 *       type: object
 *       required: [message, asset]
 *       properties:
 *         message:
 *           type: string
 *           example: "Asset uploaded successfully"
 *         asset:
 *           type: object
 *           properties:
 *             entityType:
 *               type: string
 *               example: "workshop"
 *             entityId:
 *               type: string
 *               example: "ws_123abc"
 *             assetType:
 *               type: string
 *               enum: [marketing-video, content-video, image, document]
 *               example: "marketing-video"
 *             filename:
 *               type: string
 *               example: "video.mp4"
 *             originalName:
 *               type: string
 *               example: "my-marketing-video.mp4"
 *             s3Key:
 *               type: string
 *               example: "private/marketing-video/workshop/ws_123abc/video.mp4"
 *             size:
 *               type: integer
 *               example: 15728640
 *             sizeFormatted:
 *               type: string
 *               example: "15.0MB"
 *             mimeType:
 *               type: string
 *               example: "video/mp4"
 *             accessLevel:
 *               type: string
 *               enum: [public, private]
 *               example: "private"
 *             uploadedBy:
 *               type: string
 *               example: "user_456def"
 *             uploadedAt:
 *               type: string
 *               format: date-time
 *               example: "2024-12-11T16:45:00Z"
 *             url:
 *               type: string
 *               example: "/api/assets/workshop/ws_123abc/marketing-video"
 *             downloadUrl:
 *               type: string
 *               nullable: true
 *             etag:
 *               type: string
 *               nullable: true
 *         integrity:
 *           type: object
 *           description: "File integrity validation results"
 *         analysis:
 *           type: object
 *           description: "Content analysis results"
 *
 *     AssetDeletionResult:
 *       type: object
 *       required: [entityType, entityId, deletionResults, summary]
 *       properties:
 *         entityType:
 *           type: string
 *           example: "workshop"
 *         entityId:
 *           type: string
 *           example: "ws_123abc"
 *         deletionResults:
 *           type: object
 *           description: "Results for each asset type deletion"
 *           additionalProperties:
 *             oneOf:
 *               - $ref: '#/components/schemas/SuccessfulDeletion'
 *               - $ref: '#/components/schemas/FailedDeletion'
 *         summary:
 *           type: object
 *           properties:
 *             totalAssets:
 *               type: integer
 *               example: 3
 *             deleted:
 *               type: integer
 *               example: 2
 *             errors:
 *               type: integer
 *               example: 1
 *             success:
 *               type: boolean
 *               example: false
 *         message:
 *           type: string
 *           example: "2 assets deleted, 1 errors occurred"
 *
 *     SuccessfulDeletion:
 *       type: object
 *       required: [deleted, s3Key, filename, databaseUpdated]
 *       properties:
 *         deleted:
 *           type: boolean
 *           example: true
 *         s3Key:
 *           type: string
 *           example: "private/marketing-video/workshop/ws_123abc/video.mp4"
 *         filename:
 *           type: string
 *           example: "video.mp4"
 *         databaseUpdated:
 *           type: boolean
 *           example: true
 *         deletedBy:
 *           type: string
 *           nullable: true
 *           example: "user_456def"
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-12-11T16:50:00Z"
 *
 *     FailedDeletion:
 *       type: object
 *       required: [deleted, reason]
 *       properties:
 *         deleted:
 *           type: boolean
 *           example: false
 *         reason:
 *           type: string
 *           example: "Asset not found in storage"
 *         error:
 *           type: string
 *           nullable: true
 *         s3Key:
 *           type: string
 *           nullable: true
 */

export default {};