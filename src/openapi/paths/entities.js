/**
 * @swagger
 * /entities:
 *   get:
 *     tags:
 *       - Entities
 *     summary: List available entity types
 *     description: Returns information about available entity types in the system
 *     responses:
 *       200:
 *         description: Entity types information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntityTypesResponse'
 */

/**
 * @swagger
 * /entities/products/list:
 *   get:
 *     tags:
 *       - Products
 *     summary: List products with filtering and pagination
 *     description: Retrieve paginated list of products with optional filtering by category, type, and search
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number (1-based)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: search
 *         in: query
 *         description: Search term for title/description
 *         schema:
 *           type: string
 *       - name: category
 *         in: query
 *         description: Filter by category
 *         schema:
 *           type: string
 *       - name: product_type
 *         in: query
 *         description: Filter by product type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle']
 *     responses:
 *       200:
 *         description: Products list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductsListResponse'
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /entities/product/{id}/details:
 *   get:
 *     tags:
 *       - Products
 *     summary: Get product details with access information
 *     description: Retrieve detailed product information including access control status
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Product ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Product details with access information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductDetailsResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /entities/{type}:
 *   get:
 *     tags:
 *       - Entities
 *     summary: List entities by type
 *     description: Retrieve paginated list of entities for a specific type
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *       - name: page
 *         in: query
 *         description: Page number (1-based)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Items per page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: creator_user_id
 *         in: query
 *         description: Filter by creator
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         description: Search term
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entities list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntitiesListResponse'
 *       400:
 *         description: Invalid entity type or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   post:
 *     tags:
 *       - Entities
 *     summary: Create new entity
 *     description: Create a new entity of specified type using EntityService
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type to create
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEntityRequest'
 *     responses:
 *       201:
 *         description: Entity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntityResponse'
 *       400:
 *         description: Validation error or invalid entity type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/{type}/{id}:
 *   get:
 *     tags:
 *       - Entities
 *     summary: Get entity by ID
 *     description: Retrieve specific entity with optional access control information
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *       - name: id
 *         in: path
 *         required: true
 *         description: Entity ID
 *         schema:
 *           type: string
 *       - name: includeAccess
 *         in: query
 *         description: Include access control information
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Entity details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntityResponse'
 *       404:
 *         description: Entity not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags:
 *       - Entities
 *     summary: Update entity
 *     description: Update existing entity with ownership validation
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *       - name: id
 *         in: path
 *         required: true
 *         description: Entity ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateEntityRequest'
 *     responses:
 *       200:
 *         description: Entity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EntityResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Entity not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags:
 *       - Entities
 *     summary: Delete entity
 *     description: Delete entity with ownership validation and cascade cleanup
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *       - name: id
 *         in: path
 *         required: true
 *         description: Entity ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entity deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Insufficient permissions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Entity not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/{type}/bulk:
 *   post:
 *     tags:
 *       - Entities
 *     summary: Bulk entity operations
 *     description: Perform bulk operations (create, update, delete) on multiple entities
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkOperationRequest'
 *     responses:
 *       200:
 *         description: Bulk operation completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BulkOperationResponse'
 *       400:
 *         description: Invalid operation or parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/{type}/count:
 *   get:
 *     tags:
 *       - Entities
 *     summary: Count entities by type
 *     description: Get total count of entities for specified type with optional filtering
 *     parameters:
 *       - name: type
 *         in: path
 *         required: true
 *         description: Entity type
 *         schema:
 *           type: string
 *           enum: ['file', 'game', 'workshop', 'course', 'tool', 'lesson_plan', 'bundle', 'classroom', 'curriculum']
 *       - name: creator_user_id
 *         in: query
 *         description: Filter by creator
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         description: Search term filter
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Entity count
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CountResponse'

/**
 * @swagger
 * /entities/curriculum/available-combinations:
 *   get:
 *     tags:
 *       - Curriculum
 *     summary: Get available curriculum combinations
 *     description: Retrieve available subject and grade combinations for curriculum creation
 *     responses:
 *       200:
 *         description: Available curriculum combinations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumCombinationsResponse'

/**
 * @swagger
 * /entities/curriculum/create-range:
 *   post:
 *     tags:
 *       - Curriculum
 *     summary: Create curriculum range
 *     description: Create multiple curriculum entries for a range of subjects/grades
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCurriculumRangeRequest'
 *     responses:
 *       201:
 *         description: Curriculum range created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumRangeResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/curriculum/copy-to-class:
 *   post:
 *     tags:
 *       - Curriculum
 *     summary: Copy curriculum to classroom
 *     description: Copy curriculum structure to a specific classroom
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CopyCurriculumToClassRequest'
 *     responses:
 *       200:
 *         description: Curriculum copied to class successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CopyCurriculumResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/curriculum/{id}/cascade-update:
 *   put:
 *     tags:
 *       - Curriculum
 *     summary: Update curriculum with cascade
 *     description: Update curriculum and propagate changes to related entities
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Curriculum ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurriculumCascadeUpdateRequest'
 *     responses:
 *       200:
 *         description: Curriculum updated with cascade
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Curriculum not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/curriculum/{id}/products:
 *   get:
 *     tags:
 *       - Curriculum
 *     summary: Get curriculum products
 *     description: Retrieve products associated with a curriculum
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Curriculum ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Curriculum products
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumProductsResponse'
 *       404:
 *         description: Curriculum not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/curriculum/{id}/copy-status:
 *   get:
 *     tags:
 *       - Curriculum
 *     summary: Get curriculum copy status
 *     description: Check the status of curriculum copy operation
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Curriculum ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Curriculum copy status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CurriculumCopyStatusResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Curriculum not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/lesson-plan/{lessonPlanId}/upload-file:
 *   post:
 *     tags:
 *       - Lesson Plans
 *     summary: Upload file to lesson plan
 *     description: Upload and attach file to a lesson plan
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: lessonPlanId
 *         in: path
 *         required: true
 *         description: Lesson plan ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload
 *             required:
 *               - file
 *     responses:
 *       201:
 *         description: File uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FileUploadResponse'
 *       400:
 *         description: Invalid file or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Lesson plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/lesson-plan/{lessonPlanId}/link-file-product:
 *   post:
 *     tags:
 *       - Lesson Plans
 *     summary: Link file product to lesson plan
 *     description: Associate an existing file product with a lesson plan
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: lessonPlanId
 *         in: path
 *         required: true
 *         description: Lesson plan ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LinkFileProductRequest'
 *     responses:
 *       200:
 *         description: File product linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LinkFileProductResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Lesson plan or file product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/lesson-plan/{lessonPlanId}/unlink-file-product/{fileId}:
 *   delete:
 *     tags:
 *       - Lesson Plans
 *     summary: Unlink file product from lesson plan
 *     description: Remove file product association from lesson plan
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: lessonPlanId
 *         in: path
 *         required: true
 *         description: Lesson plan ID
 *         schema:
 *           type: string
 *       - name: fileId
 *         in: path
 *         required: true
 *         description: File ID to unlink
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File product unlinked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnlinkFileProductResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Lesson plan or file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/lesson-plan/{lessonPlanId}/file/{fileId}:
 *   delete:
 *     tags:
 *       - Lesson Plans
 *     summary: Delete file from lesson plan
 *     description: Remove and delete file from lesson plan and storage
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: lessonPlanId
 *         in: path
 *         required: true
 *         description: Lesson plan ID
 *         schema:
 *           type: string
 *       - name: fileId
 *         in: path
 *         required: true
 *         description: File ID to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: File deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DeleteFileResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Lesson plan or file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/lesson-plan/{lessonPlanId}/presentation:
 *   get:
 *     tags:
 *       - Lesson Plans
 *     summary: Get lesson plan presentation
 *     description: Retrieve presentation data for lesson plan display
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: lessonPlanId
 *         in: path
 *         required: true
 *         description: Lesson plan ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lesson plan presentation data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LessonPlanPresentationResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Lesson plan not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/user/{id}/generate-invitation-code:
 *   post:
 *     tags:
 *       - Users
 *     summary: Generate user invitation code
 *     description: Generate invitation code for parent consent and teacher linking
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Invitation code generated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InvitationCodeResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/user/{id}/reset-onboarding:
 *   put:
 *     tags:
 *       - Users
 *     summary: Reset user onboarding status
 *     description: Reset onboarding flags for user to restart onboarding process
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: User ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Onboarding status reset
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ResetOnboardingResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'

/**
 * @swagger
 * /entities/purchase/check-product-purchases/{productId}:
 *   get:
 *     tags:
 *       - Purchases
 *     summary: Check product purchase status
 *     description: Verify if user has purchased specific product
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: productId
 *         in: path
 *         required: true
 *         description: Product ID to check
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Purchase status information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProductPurchaseStatusResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'