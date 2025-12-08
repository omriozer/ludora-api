/**
 * @openapi
 * components:
 *   schemas:
 *     ProductBase:
 *       type: object
 *       required: [id, product_type, title, price, creator_user_id, entity_id, is_published]
 *       properties:
 *         id:
 *           type: string
 *           example: "product_abc123"
 *           description: Unique product identifier
 *         product_type:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool, bundle]
 *           description: Product type discriminator
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *           example: "Advanced Memory Game"
 *           description: Product title
 *         short_description:
 *           type: string
 *           nullable: true
 *           maxLength: 500
 *           example: "Quick summary of the product"
 *           description: Short product description
 *         description:
 *           type: string
 *           nullable: true
 *           example: "A challenging memory game for students with rich HTML formatting"
 *           description: Full product description (supports rich text HTML)
 *         category:
 *           type: string
 *           nullable: true
 *           example: "educational-games"
 *           description: Product category
 *         price:
 *           type: number
 *           minimum: 0
 *           example: 49.90
 *           description: Product price in ILS
 *         is_published:
 *           type: boolean
 *           example: true
 *           description: Whether product is published and visible to buyers
 *         image_filename:
 *           type: string
 *           nullable: true
 *           example: "product-image.jpg"
 *           description: Product image filename
 *         has_image:
 *           type: boolean
 *           default: false
 *           description: Whether product has an image asset
 *         marketing_video_type:
 *           type: string
 *           enum: [youtube, uploaded]
 *           nullable: true
 *           description: Type of marketing video
 *         marketing_video_id:
 *           type: string
 *           nullable: true
 *           example: "dQw4w9WgXcQ"
 *           description: YouTube video ID or entity ID for uploaded videos
 *         marketing_video_title:
 *           type: string
 *           nullable: true
 *           example: "Product Demo Video"
 *         marketing_video_duration:
 *           type: integer
 *           nullable: true
 *           example: 180
 *           description: Video duration in seconds
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           default: []
 *           example: ["math", "elementary", "interactive"]
 *           description: Product tags for searchability
 *         target_audience:
 *           type: string
 *           nullable: true
 *           example: "Elementary students"
 *           description: Target audience description
 *         type_attributes:
 *           type: object
 *           nullable: true
 *           description: Type-specific attributes (JSONB field)
 *         access_days:
 *           type: number
 *           nullable: true
 *           example: 365
 *           description: Access duration in days (null = lifetime access)
 *         creator_user_id:
 *           type: string
 *           example: "user_teacher123"
 *           description: ID of the user who created this product
 *         entity_id:
 *           type: string
 *           example: "game_abc123"
 *           description: ID of the associated entity record (null for bundles)
 *         content_topic_id:
 *           type: string
 *           nullable: true
 *           example: "topic_mathematics"
 *           description: Associated content topic
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-01-15T10:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2025-01-15T14:30:00Z"
 *
 *     GameEntity:
 *       type: object
 *       required: [id, game_type, digital, game_settings]
 *       properties:
 *         id:
 *           type: string
 *           example: "game_abc123"
 *           description: Unique game identifier
 *         game_type:
 *           type: string
 *           enum: [scatter_game, sharp_and_smooth, memory_game, ar_up_there]
 *           nullable: true
 *           example: "memory_game"
 *           description: Type of game
 *         digital:
 *           type: boolean
 *           default: true
 *           example: true
 *           description: "true = דיגיטלי, false = גרסה להדפסה"
 *         game_settings:
 *           type: object
 *           description: Game-specific settings (JSONB)
 *           example: {difficulty: "medium", time_limit: 60, cards_count: 12}
 *         content_query:
 *           type: object
 *           nullable: true
 *           description: JSON object defining how to query content for this game
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     FileEntity:
 *       type: object
 *       required: [id, title, allow_preview, add_branding, is_asset_only]
 *       properties:
 *         id:
 *           type: string
 *           example: "file_abc123"
 *           description: Unique file identifier
 *         title:
 *           type: string
 *           example: "Worksheet: Math Practice"
 *         file_name:
 *           type: string
 *           nullable: true
 *           example: "math-worksheet.pdf"
 *           description: Original filename (NULL if not uploaded yet)
 *         file_type:
 *           type: string
 *           enum: [pdf, ppt, docx, zip, other]
 *           nullable: true
 *           example: "pdf"
 *         allow_preview:
 *           type: boolean
 *           default: true
 *           description: Whether file can be previewed
 *         add_branding:
 *           type: boolean
 *           default: true
 *           description: Whether branding is enabled
 *         branding_settings:
 *           type: object
 *           nullable: true
 *           description: File-specific branding settings (JSONB)
 *         branding_template_id:
 *           type: string
 *           nullable: true
 *           description: Reference to system_templates for branding
 *         accessible_pages:
 *           type: array
 *           items:
 *             type: integer
 *             minimum: 1
 *           nullable: true
 *           example: [1, 3, 5, 7]
 *           description: Page numbers accessible in preview (null = all pages)
 *         watermark_template_id:
 *           type: string
 *           nullable: true
 *           description: Reference to system_templates for watermarks
 *         watermark_settings:
 *           type: object
 *           nullable: true
 *           description: Custom watermark settings (JSONB)
 *         is_asset_only:
 *           type: boolean
 *           default: false
 *           description: "true = asset only (not standalone product)"
 *         target_format:
 *           type: string
 *           enum: [pdf-a4-portrait, pdf-a4-landscape, svg-lessonplan, unknown]
 *           nullable: true
 *           example: "pdf-a4-portrait"
 *           description: File format orientation
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     LessonPlanEntity:
 *       type: object
 *       required: [id, is_active, allow_slide_preview, add_branding]
 *       properties:
 *         id:
 *           type: string
 *           example: "lessonplan_abc123"
 *         context:
 *           type: string
 *           nullable: true
 *           maxLength: 100
 *           example: "hanukkah"
 *           description: "Theme context like animals, hanukkah, christmas, etc."
 *         file_configs:
 *           type: object
 *           nullable: true
 *           description: JSON configuration for files (roles, connections, slide configs)
 *           example: {files: [], presentation: []}
 *         is_active:
 *           type: boolean
 *           default: true
 *           description: Whether lesson plan is active/published
 *         estimated_duration:
 *           type: integer
 *           nullable: true
 *           example: 45
 *           description: Estimated duration in minutes
 *         total_slides:
 *           type: integer
 *           nullable: true
 *           example: 12
 *           description: Total number of slides
 *         teacher_notes:
 *           type: string
 *           nullable: true
 *           description: Notes and instructions for the teacher
 *         accessible_slides:
 *           type: array
 *           items:
 *             type: integer
 *             minimum: 0
 *           nullable: true
 *           example: [0, 2, 4]
 *           description: Slide indices accessible in preview (0-based, null = all)
 *         allow_slide_preview:
 *           type: boolean
 *           default: true
 *           description: Whether slides can be previewed without purchase
 *         watermark_template_id:
 *           type: string
 *           nullable: true
 *           description: Reference to watermark template for slides
 *         branding_template_id:
 *           type: string
 *           nullable: true
 *           description: Reference to branding template for slides
 *         branding_settings:
 *           type: object
 *           nullable: true
 *           description: Custom branding configuration (JSONB)
 *         add_branding:
 *           type: boolean
 *           default: true
 *           description: Whether branding is enabled
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     BundleProduct:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductBase'
 *         - type: object
 *           required: [type_attributes]
 *           properties:
 *             entity_id:
 *               type: string
 *               nullable: true
 *               description: Always null for bundles (no entity table)
 *             type_attributes:
 *               type: object
 *               required: [is_bundle, bundle_items]
 *               properties:
 *                 is_bundle:
 *                   type: boolean
 *                   enum: [true]
 *                   description: Must be true for bundle products
 *                 bundle_items:
 *                   type: array
 *                   minItems: 2
 *                   maxItems: 50
 *                   items:
 *                     type: object
 *                     required: [product_type, product_id]
 *                     properties:
 *                       product_type:
 *                         type: string
 *                         enum: [file, lesson_plan, game, workshop, course, tool]
 *                         description: Type of bundled product
 *                       product_id:
 *                         type: string
 *                         description: ID of the bundled product
 *                   description: Array of bundled products (min 2, max 50)
 *                 original_total_price:
 *                   type: number
 *                   minimum: 0
 *                   example: 450
 *                   description: Sum of individual product prices
 *                 savings:
 *                   type: number
 *                   minimum: 0
 *                   example: 150
 *                   description: Total savings amount
 *                 savings_percentage:
 *                   type: number
 *                   minimum: 5
 *                   maximum: 100
 *                   example: 33
 *                   description: Savings as percentage (min 5%)
 *
 *     ProductWithAccess:
 *       allOf:
 *         - $ref: '#/components/schemas/ProductBase'
 *         - type: object
 *           properties:
 *             access:
 *               $ref: '#/components/schemas/AccessControlResponse'
 *             entity:
 *               oneOf:
 *                 - $ref: '#/components/schemas/GameEntity'
 *                 - $ref: '#/components/schemas/FileEntity'
 *                 - $ref: '#/components/schemas/LessonPlanEntity'
 *               discriminator:
 *                 propertyName: product_type
 *                 mapping:
 *                   game: '#/components/schemas/GameEntity'
 *                   file: '#/components/schemas/FileEntity'
 *                   lesson_plan: '#/components/schemas/LessonPlanEntity'
 *               nullable: true
 *               description: Associated entity data (null for bundles)
 *
 *     ProductListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProductWithAccess'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 150
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 50
 *             totalPages:
 *               type: integer
 *               example: 3
 *
 *     CreateProductRequest:
 *       type: object
 *       required: [product_type, title, price]
 *       properties:
 *         product_type:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool, bundle]
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *         short_description:
 *           type: string
 *           maxLength: 500
 *         description:
 *           type: string
 *         category:
 *           type: string
 *         price:
 *           type: number
 *           minimum: 0
 *         is_published:
 *           type: boolean
 *           default: false
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         target_audience:
 *           type: string
 *         type_attributes:
 *           type: object
 *           description: Type-specific attributes (required for bundles)
 *         access_days:
 *           type: number
 *           nullable: true
 *         content_topic_id:
 *           type: string
 *
 *     UpdateProductRequest:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           minLength: 1
 *           maxLength: 200
 *         short_description:
 *           type: string
 *           maxLength: 500
 *         description:
 *           type: string
 *         category:
 *           type: string
 *         price:
 *           type: number
 *           minimum: 0
 *         is_published:
 *           type: boolean
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         target_audience:
 *           type: string
 *         type_attributes:
 *           type: object
 *         access_days:
 *           type: number
 *           nullable: true
 *         content_topic_id:
 *           type: string
 */

export default {};
