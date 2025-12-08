/**
 * @openapi
 * components:
 *   schemas:
 *     EntityListResponse:
 *       type: object
 *       required: [data, pagination]
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             type: object
 *           description: Array of entity objects (type varies by entity type)
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *               example: 150
 *               description: Total number of entities
 *             page:
 *               type: integer
 *               example: 1
 *               description: Current page number
 *             limit:
 *               type: integer
 *               example: 50
 *               description: Number of items per page
 *             pages:
 *               type: integer
 *               example: 3
 *               description: Total number of pages
 *
 *     EntityCreateRequest:
 *       type: object
 *       description: Entity creation request (schema varies by entity type)
 *       properties:
 *         title:
 *           type: string
 *           example: "My New Entity"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "A detailed description"
 *       additionalProperties: true
 *
 *     EntityUpdateRequest:
 *       type: object
 *       description: Entity update request (partial schema, varies by entity type)
 *       additionalProperties: true
 *
 *     EntityBulkRequest:
 *       type: object
 *       required: [operation, data]
 *       properties:
 *         operation:
 *           type: string
 *           enum: [create, update, delete]
 *           example: "create"
 *           description: Bulk operation type
 *         data:
 *           type: array
 *           items:
 *             type: object
 *           minItems: 1
 *           maxItems: 100
 *           description: Array of entities to operate on (max 100)
 *
 *     EntityBulkResponse:
 *       type: object
 *       required: [success, results]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [success, error]
 *               error:
 *                 type: string
 *                 nullable: true
 *         total:
 *           type: integer
 *           example: 50
 *           description: Total operations attempted
 *         successful:
 *           type: integer
 *           example: 48
 *           description: Number of successful operations
 *         failed:
 *           type: integer
 *           example: 2
 *           description: Number of failed operations
 */

export default {};
