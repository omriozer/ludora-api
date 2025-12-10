/**
 * @openapi
 * components:
 *   schemas:
 *     CurriculumMatch:
 *       type: object
 *       required: [curriculumId, curriculumName, curriculumItemId, curriculumItemName, subject, gradeRange, matchReason]
 *       properties:
 *         curriculumId:
 *           type: string
 *           example: "curr_456def"
 *         curriculumName:
 *           type: string
 *           example: "Primary Mathematics"
 *         curriculumItemId:
 *           type: string
 *           example: "item_789ghi"
 *         curriculumItemName:
 *           type: string
 *           example: "Addition and Subtraction"
 *         subject:
 *           type: string
 *           example: "mathematics"
 *         gradeRange:
 *           type: string
 *           example: "grades_1_3"
 *         matchReason:
 *           type: string
 *           example: "Perfect grade range and subject match"
 *         matchQuality:
 *           type: string
 *           enum: [perfect, good, partial, suggestion]
 *           example: "perfect"
 *
 *     CurriculumLink:
 *       type: object
 *       required: [id, productId, curriculumItemId, curriculumItemName, curriculumId, curriculumName]
 *       properties:
 *         id:
 *           type: string
 *           example: "cp_111aaa"
 *         productId:
 *           type: string
 *           example: "prod_123abc"
 *         curriculumItemId:
 *           type: string
 *           example: "item_789ghi"
 *         curriculumItemName:
 *           type: string
 *           example: "Addition and Subtraction"
 *         curriculumId:
 *           type: string
 *           example: "curr_456def"
 *         curriculumName:
 *           type: string
 *           example: "Primary Mathematics"
 *         subject:
 *           type: string
 *           example: "mathematics"
 *         gradeRange:
 *           type: string
 *           example: "grades_1_3"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2024-12-11T10:30:00Z"
 *
 *     CurriculumBrowseResult:
 *       type: object
 *       required: [id, name, subject, gradeRange, isActive, items]
 *       properties:
 *         id:
 *           type: string
 *           example: "curr_456def"
 *         name:
 *           type: string
 *           example: "Primary Mathematics"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Core math skills for elementary students"
 *         subject:
 *           type: string
 *           example: "mathematics"
 *         gradeRange:
 *           type: string
 *           example: "grades_3_5"
 *         isActive:
 *           type: boolean
 *           example: true
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "item_789ghi"
 *               name:
 *                 type: string
 *                 example: "Addition and Subtraction"
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Basic arithmetic operations"
 *               order_index:
 *                 type: integer
 *                 example: 1
 *               linkedProductsCount:
 *                 type: integer
 *                 example: 5
 *
 *     CurriculumSuggestions:
 *       type: object
 *       required: [matches, gradeRanges, subjects]
 *       properties:
 *         matches:
 *           type: object
 *           properties:
 *             perfect:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CurriculumMatch'
 *               description: "Exact grade range and subject matches"
 *             good:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CurriculumMatch'
 *               description: "Overlapping grades with matching subjects"
 *             partial:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CurriculumMatch'
 *               description: "Either grades or subjects match"
 *             suggestions:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CurriculumMatch'
 *               description: "Related curriculum items for manual review"
 *         gradeRanges:
 *           type: array
 *           items:
 *             type: string
 *           description: "Detected grade ranges from product metadata"
 *           example: ["grades_1_3"]
 *         subjects:
 *           type: array
 *           items:
 *             type: string
 *           description: "Detected subjects from product metadata"
 *           example: ["mathematics"]
 *         existingLinks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/CurriculumLink'
 *           description: "Currently linked curriculum items"
 *
 *     CurriculumLinkResult:
 *       type: object
 *       required: [success, errors, skipped]
 *       properties:
 *         success:
 *           type: array
 *           description: "Successfully created links"
 *           items:
 *             type: object
 *             properties:
 *               curriculumItemId:
 *                 type: string
 *                 example: "item_789ghi"
 *               curriculumProductId:
 *                 type: string
 *                 example: "cp_111aaa"
 *               curriculumItemName:
 *                 type: string
 *                 example: "Addition and Subtraction"
 *         errors:
 *           type: array
 *           description: "Failed link attempts"
 *           items:
 *             type: object
 *             properties:
 *               curriculumItemId:
 *                 type: string
 *               error:
 *                 type: string
 *               details:
 *                 type: string
 *         skipped:
 *           type: array
 *           description: "Links that already exist"
 *           items:
 *             type: object
 *             properties:
 *               curriculumItemId:
 *                 type: string
 *               reason:
 *                 type: string
 *                 example: "Link already exists"
 *               existingLinkId:
 *                 type: string
 */

export default {};