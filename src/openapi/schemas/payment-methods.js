/**
 * @openapi
 * components:
 *   schemas:
 *     PaymentMethod:
 *       type: object
 *       required: [id, display_name, card_last4, card_brand, is_default, is_expired]
 *       properties:
 *         id:
 *           type: string
 *           example: "pm_123abc"
 *         display_name:
 *           type: string
 *           example: "Visa ending in 4242"
 *         card_last4:
 *           type: string
 *           pattern: '^[0-9]{4}$'
 *           example: "4242"
 *         card_brand:
 *           type: string
 *           enum: [visa, mastercard, amex, discover, diners, jcb]
 *           example: "visa"
 *         card_exp_month:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *           example: 12
 *         card_exp_year:
 *           type: integer
 *           minimum: 2024
 *           example: 2025
 *         is_default:
 *           type: boolean
 *           example: true
 *         is_expired:
 *           type: boolean
 *           example: false
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-11-01T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2024-11-01T10:30:00Z"
 *
 *     PaymentMethodValidation:
 *       type: object
 *       required: [valid, expired]
 *       properties:
 *         valid:
 *           type: boolean
 *           example: true
 *         expired:
 *           type: boolean
 *           example: false
 *         last4:
 *           type: string
 *           pattern: '^[0-9]{4}$'
 *           nullable: true
 *           example: "4242"
 *         brand:
 *           type: string
 *           enum: [visa, mastercard, amex, discover, diners, jcb]
 *           nullable: true
 *           example: "visa"
 *         error:
 *           type: string
 *           nullable: true
 *           description: "Error message if validation failed"
 *           example: null
 *
 *     CartItem:
 *       type: object
 *       required: [purchasable_type, purchasable_id, price]
 *       properties:
 *         purchasable_type:
 *           type: string
 *           enum: [file, workshop, course, game, tool, bundle]
 *           example: "workshop"
 *         purchasable_id:
 *           type: string
 *           description: "ID of the product to purchase"
 *           example: "ws_123abc"
 *         price:
 *           type: number
 *           description: "Price in ILS"
 *           minimum: 0
 *           example: 49.90
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: "Quantity to purchase"
 *           example: 1
 *         metadata:
 *           type: object
 *           description: "Additional item metadata"
 *           additionalProperties: true
 *           nullable: true
 *
 *     TokenChargeResult:
 *       type: object
 *       required: [success, transaction_id, amount, currency, purchase_count, purchases, message]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         transaction_id:
 *           type: string
 *           example: "txn_789ghi"
 *         amount:
 *           type: number
 *           description: "Total amount charged in ILS"
 *           example: 69.80
 *         currency:
 *           type: string
 *           example: "ILS"
 *         purchase_count:
 *           type: integer
 *           description: "Number of items purchased"
 *           example: 2
 *         purchases:
 *           type: array
 *           description: "Individual purchase records created"
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "purch_111aaa"
 *               type:
 *                 type: string
 *                 enum: [file, workshop, course, game, tool, bundle]
 *                 example: "workshop"
 *               entity_id:
 *                 type: string
 *                 example: "ws_123abc"
 *               amount:
 *                 type: number
 *                 example: 49.90
 *         message:
 *           type: string
 *           example: "Payment processed successfully using saved payment method"
 *
 *     DefaultPaymentMethod:
 *       type: object
 *       required: [success, has_default]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         has_default:
 *           type: boolean
 *           example: true
 *         payment_method:
 *           oneOf:
 *             - type: object
 *               title: "Default Method Available"
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "pm_123abc"
 *                 display_name:
 *                   type: string
 *                   example: "Visa ending in 4242"
 *                 card_last4:
 *                   type: string
 *                   example: "4242"
 *                 card_brand:
 *                   type: string
 *                   example: "visa"
 *                 is_default:
 *                   type: boolean
 *                   example: true
 *                 is_expired:
 *                   type: boolean
 *                   example: false
 *             - type: "null"
 *               title: "No Default Method"
 *
 *     PaymentMethodSetDefault:
 *       type: object
 *       required: [success, message, payment_method]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Default payment method updated successfully"
 *         payment_method:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: "pm_123abc"
 *             display_name:
 *               type: string
 *               example: "Visa ending in 4242"
 *             is_default:
 *               type: boolean
 *               example: true
 *
 *     PaymentMethodsListResponse:
 *       type: object
 *       required: [success, count, payment_methods]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         count:
 *           type: integer
 *           example: 2
 *         payment_methods:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PaymentMethod'
 *
 *     PaymentMethodValidationResponse:
 *       type: object
 *       required: [success, payment_method_id, validation]
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         payment_method_id:
 *           type: string
 *           example: "pm_123abc"
 *         validation:
 *           $ref: '#/components/schemas/PaymentMethodValidation'
 */

export default {};