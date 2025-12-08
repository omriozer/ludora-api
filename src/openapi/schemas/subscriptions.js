/**
 * @openapi
 * components:
 *   schemas:
 *     SubscriptionBenefits:
 *       type: object
 *       description: Rich JSONB benefits structure with granular access control
 *       properties:
 *         games_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: true
 *             unlimited:
 *               type: boolean
 *               example: false
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 50
 *               description: Monthly limit for game claims (ignored if unlimited=true)
 *         files_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: true
 *             unlimited:
 *               type: boolean
 *               example: true
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 0
 *               description: Monthly limit (0 if unlimited=true)
 *         lesson_plans_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: true
 *             unlimited:
 *               type: boolean
 *               example: false
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 30
 *         workshops_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: false
 *             unlimited:
 *               type: boolean
 *               example: false
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 0
 *         courses_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: false
 *             unlimited:
 *               type: boolean
 *               example: false
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 0
 *         tools_access:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: false
 *             unlimited:
 *               type: boolean
 *               example: false
 *             monthly_limit:
 *               type: integer
 *               minimum: 0
 *               example: 0
 *         classroom_management:
 *           type: object
 *           properties:
 *             enabled:
 *               type: boolean
 *               example: true
 *             unlimited_classrooms:
 *               type: boolean
 *               example: false
 *             max_classrooms:
 *               type: integer
 *               minimum: 0
 *               example: 10
 *             max_total_students:
 *               type: integer
 *               minimum: 0
 *               example: 500
 *         reports_access:
 *           type: boolean
 *           example: true
 *           description: Whether user can access reports and analytics
 *
 *     SubscriptionPlan:
 *       type: object
 *       required: [id, name, price, billing_period, benefits, is_active]
 *       properties:
 *         id:
 *           type: string
 *           example: "plan_premium_monthly"
 *           description: Unique subscription plan identifier
 *         name:
 *           type: string
 *           example: "Premium Monthly"
 *           description: Subscription plan name
 *         description:
 *           type: string
 *           nullable: true
 *           example: "Full access to all educational content"
 *           description: Plan description
 *         price:
 *           type: number
 *           minimum: 0
 *           example: 99.90
 *           description: Base price in ILS before discounts
 *         billing_period:
 *           type: string
 *           enum: [daily, monthly, yearly]
 *           example: "monthly"
 *           description: Billing frequency (daily only in staging/dev)
 *         has_discount:
 *           type: boolean
 *           nullable: true
 *           example: true
 *           description: Whether plan has an active discount
 *         discount_type:
 *           type: string
 *           enum: [percentage, fixed]
 *           nullable: true
 *           example: "percentage"
 *           description: Type of discount applied
 *         discount_value:
 *           type: number
 *           nullable: true
 *           example: 20
 *           description: Discount value (percentage or fixed amount)
 *         discount_valid_until:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2025-12-31T23:59:59Z"
 *           description: Discount expiration date
 *         is_active:
 *           type: boolean
 *           example: true
 *           description: Whether plan is available for purchase
 *         is_default:
 *           type: boolean
 *           nullable: true
 *           example: false
 *           description: Whether this is the default plan
 *         plan_type:
 *           type: string
 *           enum: [free, pro]
 *           nullable: true
 *           example: "pro"
 *           description: Plan tier type
 *         benefits:
 *           $ref: '#/components/schemas/SubscriptionBenefits'
 *         sort_order:
 *           type: number
 *           nullable: true
 *           example: 1
 *           description: Display order for plan listing
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     Subscription:
 *       type: object
 *       required: [id, user_id, subscription_plan_id, status, billing_price, billing_period, start_date]
 *       properties:
 *         id:
 *           type: string
 *           example: "sub_abc123"
 *           description: Unique subscription identifier
 *         user_id:
 *           type: string
 *           example: "user_teacher456"
 *           description: ID of subscribed user
 *         subscription_plan_id:
 *           type: string
 *           example: "plan_premium_monthly"
 *           description: Associated subscription plan
 *         transaction_id:
 *           type: string
 *           nullable: true
 *           example: "txn_xyz789"
 *           description: Associated transaction for payment tracking
 *         status:
 *           type: string
 *           enum: [pending, active, cancelled, expired, failed]
 *           example: "active"
 *           description: Current subscription status
 *         start_date:
 *           type: string
 *           format: date-time
 *           example: "2025-01-15T10:00:00Z"
 *           description: Subscription start date
 *         end_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *           description: Fixed end date (null for auto-renewing)
 *         next_billing_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2025-02-15T00:00:00Z"
 *           description: Next billing date for auto-renewal
 *         cancelled_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *           description: Cancellation timestamp
 *         payplus_subscription_uid:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *           description: PayPlus recurring subscription identifier
 *         payplus_status:
 *           type: string
 *           enum: [active, cancelled, expired, failed, pending, suspended]
 *           nullable: true
 *           example: "active"
 *           description: PayPlus-reported subscription status
 *         billing_price:
 *           type: number
 *           minimum: 0
 *           maximum: 99999.99
 *           example: 79.90
 *           description: Actual billing amount (after discounts, can be admin-overridden)
 *         original_price:
 *           type: number
 *           nullable: true
 *           example: 99.90
 *           description: Original price before discounts
 *         discount_amount:
 *           type: number
 *           nullable: true
 *           example: 20.00
 *           description: Discount amount applied
 *         billing_period:
 *           type: string
 *           enum: [daily, monthly, yearly]
 *           example: "monthly"
 *           description: Billing frequency (daily only in staging/dev)
 *         metadata:
 *           type: object
 *           nullable: true
 *           description: Additional metadata (JSONB)
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     CreateSubscriptionRequest:
 *       type: object
 *       required: [subscription_plan_id]
 *       properties:
 *         subscription_plan_id:
 *           type: string
 *           example: "plan_premium_monthly"
 *         billing_price:
 *           type: number
 *           minimum: 0
 *           description: Admin override for billing price (optional)
 *         start_date:
 *           type: string
 *           format: date-time
 *           description: Custom start date (admin only)
 *         enableAutoRenewal:
 *           type: boolean
 *           default: true
 *           description: Whether to enable auto-renewal
 *
 *     UpdateSubscriptionRequest:
 *       type: object
 *       properties:
 *         billing_price:
 *           type: number
 *           minimum: 0
 *           description: Update billing price (admin only)
 *         next_billing_date:
 *           type: string
 *           format: date-time
 *           description: Update next billing date
 *         end_date:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Set/update fixed end date
 *
 *     CancelSubscriptionRequest:
 *       type: object
 *       properties:
 *         keepActiveUntilEndDate:
 *           type: boolean
 *           default: false
 *           description: Keep subscription active until end date
 *         reason:
 *           type: string
 *           example: "user_cancelled"
 *           description: Cancellation reason
 *
 *     SubscriptionPurchase:
 *       type: object
 *       required: [id, subscription_history_id, purchasable_type, purchasable_id]
 *       properties:
 *         id:
 *           type: string
 *           example: "subpurch_abc123"
 *           description: Unique subscription purchase identifier
 *         subscription_history_id:
 *           type: string
 *           example: "subhist_xyz789"
 *           description: Associated subscription history record
 *         purchasable_type:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool]
 *           example: "workshop"
 *           description: Type of content claimed
 *         purchasable_id:
 *           type: string
 *           example: "workshop_abc123"
 *           description: ID of claimed content
 *         usage_tracking:
 *           type: object
 *           nullable: true
 *           description: Flexible JSONB usage tracking
 *           properties:
 *             monthly_claims:
 *               type: integer
 *               example: 1
 *               description: Number of times claimed this month
 *             total_usage:
 *               type: integer
 *               example: 5
 *               description: Total usage count
 *             last_accessed:
 *               type: string
 *               format: date-time
 *               description: Last access timestamp
 *             custom_metadata:
 *               type: object
 *               description: Additional custom tracking data
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *
 *     SubscriptionListResponse:
 *       type: object
 *       properties:
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Subscription'
 *         pagination:
 *           type: object
 *           properties:
 *             total:
 *               type: integer
 *             page:
 *               type: integer
 *             limit:
 *               type: integer
 *             totalPages:
 *               type: integer
 */

export default {};
