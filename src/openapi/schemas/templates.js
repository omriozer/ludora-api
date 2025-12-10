/**
 * @openapi
 * components:
 *   schemas:
 *     SystemTemplate:
 *       type: object
 *       required: [id, name, template_type, target_format, template_data, is_default]
 *       properties:
 *         id:
 *           type: string
 *           example: "tpl_123abc"
 *         name:
 *           type: string
 *           example: "Default Lesson Plan Watermark"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Standard watermark with teacher name and date"
 *         template_type:
 *           type: string
 *           enum: [branding, watermark]
 *           example: "watermark"
 *         target_format:
 *           type: string
 *           enum: [pdf-a4-landscape, pdf-a4-portrait, svg-lessonplan]
 *           example: "svg-lessonplan"
 *         template_data:
 *           type: object
 *           description: "Template configuration data (structure varies by type)"
 *           properties:
 *             elements:
 *               type: object
 *               description: "Template elements organized by type"
 *               additionalProperties:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/TemplateElement'
 *             globalSettings:
 *               type: object
 *               description: "Global template settings"
 *               nullable: true
 *         is_default:
 *           type: boolean
 *           example: true
 *         created_by:
 *           type: string
 *           example: "system_migration"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-12-01T10:00:00Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2024-12-01T10:00:00Z"
 *
 *     TemplateElement:
 *       type: object
 *       required: [id, type, position, style, visible]
 *       properties:
 *         id:
 *           type: string
 *           example: "element_1"
 *         type:
 *           type: string
 *           enum: [watermark-text, free-text, watermark-logo, logo]
 *           example: "watermark-text"
 *         content:
 *           type: string
 *           nullable: true
 *           description: "Text content (for text elements)"
 *           example: "{{user}} - {{date}}"
 *         pattern:
 *           type: string
 *           enum: [single, grid, scattered]
 *           nullable: true
 *           description: "Pattern for watermark elements"
 *           example: "single"
 *         source:
 *           type: string
 *           enum: [system-logo, custom-url, uploaded-file]
 *           nullable: true
 *           description: "Source type for logo elements"
 *         position:
 *           type: object
 *           required: [x, y]
 *           properties:
 *             x:
 *               type: number
 *               example: 50
 *             y:
 *               type: number
 *               example: 50
 *         style:
 *           type: object
 *           description: "Element styling properties"
 *           properties:
 *             fontSize:
 *               type: number
 *               nullable: true
 *               example: 14
 *             opacity:
 *               type: number
 *               nullable: true
 *               minimum: 0
 *               maximum: 1
 *               example: 0.3
 *             color:
 *               type: string
 *               nullable: true
 *               example: "#666666"
 *           additionalProperties: true
 *         visible:
 *           type: boolean
 *           example: true
 *
 *     TemplateUsageStats:
 *       type: object
 *       required: [template_id, template_name, usage, can_delete]
 *       properties:
 *         template_id:
 *           type: string
 *           example: "tpl_123abc"
 *         template_name:
 *           type: string
 *           example: "Default Lesson Plan Watermark"
 *         usage:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 25
 *             files:
 *               type: integer
 *               example: 15
 *             lesson_plans:
 *               type: integer
 *               example: 10
 *         samples:
 *           type: object
 *           properties:
 *             files:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   file_name:
 *                     type: string
 *             lesson_plans:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *         can_delete:
 *           type: boolean
 *           example: false
 *
 *     TemplatePreview:
 *       type: object
 *       required: [template_id, template_name, content_type, preview, variables_used]
 *       properties:
 *         template_id:
 *           type: string
 *           example: "tpl_123abc"
 *         template_name:
 *           type: string
 *           example: "Default Lesson Plan Watermark"
 *         content_type:
 *           type: string
 *           enum: [svg, pdf]
 *           example: "svg"
 *         preview:
 *           oneOf:
 *             - type: string
 *               title: "SVG Preview"
 *               description: "Complete SVG with watermark applied"
 *             - type: object
 *               title: "PDF Preview"
 *               properties:
 *                 template_data:
 *                   type: object
 *                 variables:
 *                   type: object
 *                 note:
 *                   type: string
 *         variables_used:
 *           type: object
 *           description: "All variables used in preview"
 *           additionalProperties:
 *             type: string
 *
 *     TemplateVariableTest:
 *       type: object
 *       required: [original_template, processed_template, variables_found, variables_provided, missing_variables]
 *       properties:
 *         original_template:
 *           type: object
 *           description: "Original template data"
 *         processed_template:
 *           type: object
 *           description: "Template with variables substituted"
 *         variables_found:
 *           type: array
 *           items:
 *             type: string
 *           description: "Variables discovered in template"
 *           example: ["user", "date", "lessonPlan"]
 *         variables_provided:
 *           type: object
 *           description: "Variables provided for substitution"
 *           additionalProperties:
 *             type: string
 *         missing_variables:
 *           type: array
 *           items:
 *             type: string
 *           description: "Variables found but not provided"
 *           example: []
 *
 *     TemplateExport:
 *       type: object
 *       required: [version, export_date, exported_by, template]
 *       properties:
 *         version:
 *           type: string
 *           example: "1.0"
 *         export_date:
 *           type: string
 *           format: date-time
 *           example: "2024-12-11T17:00:00Z"
 *         exported_by:
 *           type: string
 *           example: "admin@ludora.app"
 *         template:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             description:
 *               type: string
 *             template_type:
 *               type: string
 *               enum: [branding, watermark]
 *             target_format:
 *               type: string
 *             template_data:
 *               type: object
 */

export default {};