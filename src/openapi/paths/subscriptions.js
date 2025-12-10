/**
 * @swagger
 * components:
 *   schemas:
 *     SubscriptionWithPlan:
 *       allOf:
 *         - $ref: '#/components/schemas/Subscription'
 *         - type: object
 *           properties:
 *             subscriptionPlan:
 *               $ref: '#/components/schemas/SubscriptionPlan'
 *
 *     SubscriptionUserResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             subscriptions:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionWithPlan'
 *             activeSubscription:
 *               allOf:
 *                 - $ref: '#/components/schemas/SubscriptionWithPlan'
 *                 - nullable: true
 *             plans:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlan'
 *             summary:
 *               type: object
 *               properties:
 *                 hasActiveSubscription:
 *                   type: boolean
 *                   example: true
 *                 currentPlan:
 *                   $ref: '#/components/schemas/SubscriptionPlan'
 *                   nullable: true
 *                 totalSubscriptions:
 *                   type: integer
 *                   example: 5
 *             pagination:
 *               type: object
 *               properties:
 *                 limit:
 *                   type: integer
 *                   example: 10
 *                 offset:
 *                   type: integer
 *                   example: 0
 *                 total:
 *                   type: integer
 *                   example: 25
 *                 hasMore:
 *                   type: boolean
 *                   example: true
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *
 *     SubscriptionStatusResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             hasActiveSubscription:
 *               type: boolean
 *               example: true
 *             hasPendingSubscription:
 *               type: boolean
 *               example: false
 *             status:
 *               type: string
 *               enum: [active, pending, cancelled, expired, failed]
 *               nullable: true
 *               example: active
 *             subscriptionId:
 *               type: string
 *               nullable: true
 *               example: sub_1734123456_abc123
 *             planId:
 *               type: string
 *               nullable: true
 *               example: plan_premium_monthly
 *             nextBilling:
 *               type: string
 *               format: date-time
 *               nullable: true
 *               example: 2025-01-15T00:00:00Z
 *
 *     SubscriptionPlansResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/SubscriptionPlan'
 *
 *     CreateSubscriptionPaymentRequest:
 *       type: object
 *       required:
 *         - subscriptionPlanId
 *       properties:
 *         subscriptionPlanId:
 *           type: string
 *           example: plan_premium_monthly
 *         environment:
 *           type: string
 *           enum: [production, staging]
 *           default: production
 *           example: production
 *         isRetry:
 *           type: boolean
 *           default: false
 *           description: Whether this is a retry payment for existing pending subscription
 *           example: false
 *
 *     SubscriptionPaymentResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Subscription payment page created
 *         paymentUrl:
 *           type: string
 *           format: uri
 *           example: https://payplus.co.il/payment/payment-page/...
 *         subscriptionId:
 *           type: string
 *           example: sub_1734123456_abc123
 *         transactionId:
 *           type: string
 *           example: txn_1734123456_abc123
 *         environment:
 *           type: string
 *           enum: [production, staging]
 *           example: production
 *         retryPayment:
 *           type: boolean
 *           example: false
 *           description: Whether this was a retry payment creation
 *
 *     CancelSubscriptionRequest:
 *       type: object
 *       properties:
 *         reason:
 *           type: string
 *           default: user_cancelled
 *           example: user_cancelled
 *           description: Reason for cancellation
 *         immediate:
 *           type: boolean
 *           default: false
 *           description: Whether to cancel immediately or at end of billing period
 *           example: false
 *
 *     SubscriptionValidationResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             valid:
 *               type: boolean
 *               example: true
 *             reason:
 *               type: string
 *               nullable: true
 *               example: null
 *             canSubscribe:
 *               type: boolean
 *               example: true
 *             hasActiveSubscription:
 *               type: boolean
 *               example: false
 *             hasPendingSubscription:
 *               type: boolean
 *               example: false
 *
 *     PlanWithContext:
 *       allOf:
 *         - $ref: '#/components/schemas/SubscriptionPlan'
 *         - type: object
 *           properties:
 *             canSubscribe:
 *               type: boolean
 *               example: true
 *             subscriptionStatus:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 error:
 *                   type: string
 *                   nullable: true
 *             isCurrentPlan:
 *               type: boolean
 *               example: false
 *
 *     PlansWithContextResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             plans:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PlanWithContext'
 *             currentSubscription:
 *               $ref: '#/components/schemas/SubscriptionWithPlan'
 *               nullable: true
 *
 *     ChangePlanRequest:
 *       type: object
 *       required:
 *         - subscriptionPlanId
 *         - actionType
 *       properties:
 *         subscriptionPlanId:
 *           type: string
 *           example: plan_pro_monthly
 *         actionType:
 *           type: string
 *           enum: [upgrade, downgrade, change]
 *           example: downgrade
 *         fromPlanId:
 *           type: string
 *           nullable: true
 *           example: plan_premium_monthly
 *           description: Current plan ID for validation
 *
 *     SubscriptionPaymentStatusCheckResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *         - summary
 *         - results
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Subscription payment page status checked for pending subscriptions
 *         summary:
 *           type: object
 *           properties:
 *             total_pending:
 *               type: integer
 *               example: 3
 *             activated:
 *               type: integer
 *               example: 1
 *             cancelled:
 *               type: integer
 *               example: 1
 *             errors:
 *               type: integer
 *               example: 0
 *             skipped:
 *               type: integer
 *               example: 1
 *         results:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               subscriptionId:
 *                 type: string
 *               transactionId:
 *                 type: string
 *               action_taken:
 *                 type: string
 *                 enum: [activated, cancelled, skipped]
 *               reason:
 *                 type: string
 *
 *     # Plan Change Schemas
 *     AvailablePlanChangesResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             canUpgrade:
 *               type: boolean
 *               example: true
 *             canDowngrade:
 *               type: boolean
 *               example: true
 *             availableUpgrades:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlan'
 *             availableDowngrades:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubscriptionPlan'
 *             currentPlan:
 *               $ref: '#/components/schemas/SubscriptionPlan'
 *             pendingChange:
 *               type: object
 *               nullable: true
 *               properties:
 *                 type:
 *                   type: string
 *                   enum: [upgrade, downgrade]
 *                 targetPlanId:
 *                   type: string
 *                 effectiveDate:
 *                   type: string
 *                   format: date-time
 *
 *     UpgradeSubscriptionRequest:
 *       type: object
 *       required:
 *         - newPlanId
 *       properties:
 *         newPlanId:
 *           type: string
 *           example: plan_premium_monthly
 *         paymentMethodId:
 *           type: string
 *           nullable: true
 *           example: pm_abc123
 *           description: PayPlus payment method ID for proration charge
 *
 *     DowngradeSubscriptionRequest:
 *       type: object
 *       required:
 *         - newPlanId
 *       properties:
 *         newPlanId:
 *           type: string
 *           example: plan_basic_monthly
 *
 *     PlanChangeResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Subscription upgraded successfully with immediate proration
 *         data:
 *           type: object
 *           properties:
 *             subscription:
 *               $ref: '#/components/schemas/Subscription'
 *             actionType:
 *               type: string
 *               enum: [upgrade, downgrade]
 *             prorationAmount:
 *               type: number
 *               nullable: true
 *               example: 15.90
 *             effectiveDate:
 *               type: string
 *               format: date-time
 *               example: 2025-12-11T10:00:00Z
 *
 *     # Subscription Benefits Schemas
 *     ClaimProductRequest:
 *       type: object
 *       required:
 *         - productType
 *         - productId
 *       properties:
 *         productType:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool]
 *           example: workshop
 *         productId:
 *           type: string
 *           example: product_abc123
 *         skipConfirmation:
 *           type: boolean
 *           default: false
 *           example: false
 *
 *     ClaimProductResponse:
 *       type: object
 *       required:
 *         - success
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Product claimed successfully
 *         needsConfirmation:
 *           type: boolean
 *           example: false
 *           description: Whether user needs to confirm claim (low allowances)
 *         data:
 *           type: object
 *           nullable: true
 *           properties:
 *             claim:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 subscription_history_id:
 *                   type: string
 *                 purchasable_type:
 *                   type: string
 *                 purchasable_id:
 *                   type: string
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *             alreadyClaimed:
 *               type: boolean
 *               example: false
 *             remainingClaims:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *         remainingClaims:
 *           type: object
 *           nullable: true
 *           description: Present when needsConfirmation is true
 *           additionalProperties:
 *             type: integer
 *         updatedContext:
 *           type: object
 *           description: Updated user context for real-time state sync
 *           properties:
 *             subscriptionAllowances:
 *               type: object
 *             activeSubscriptions:
 *               type: array
 *
 *     MonthlyAllowancesResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           nullable: true
 *           properties:
 *             monthYear:
 *               type: string
 *               example: "2025-12"
 *             totalAllowances:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               example:
 *                 workshops: 50
 *                 files: 100
 *                 lesson_plans: 30
 *             usedAllowances:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               example:
 *                 workshops: 12
 *                 files: 45
 *                 lesson_plans: 8
 *             remainingAllowances:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *               example:
 *                 workshops: 38
 *                 files: 55
 *                 lesson_plans: 22
 *             subscriptionPlan:
 *               $ref: '#/components/schemas/SubscriptionPlan'
 *
 *     RecordUsageRequest:
 *       type: object
 *       required:
 *         - productType
 *         - productId
 *       properties:
 *         productType:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool]
 *           example: workshop
 *         productId:
 *           type: string
 *           example: product_abc123
 *         duration_minutes:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *           example: 15
 *         activity_type:
 *           type: string
 *           enum: [view, play, edit, share, download]
 *           default: view
 *           example: play
 *         completion_percent:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           default: 0
 *           example: 75
 *         feature_action:
 *           type: string
 *           nullable: true
 *           example: completed_quiz
 *         teacherId:
 *           type: string
 *           nullable: true
 *           description: Required for students - ID of teacher whose claimed product they're using
 *           example: user_teacher123
 *
 *     RecordUsageResponse:
 *       type: object
 *       required:
 *         - success
 *         - message
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Usage recorded successfully
 *         data:
 *           type: object
 *           properties:
 *             totalSessions:
 *               type: integer
 *               example: 5
 *             totalMinutes:
 *               type: integer
 *               example: 120
 *             engagementPattern:
 *               type: string
 *               enum: [low, medium, high]
 *               example: high
 *             completionStatus:
 *               type: string
 *               enum: [not_started, in_progress, completed]
 *               example: in_progress
 *
 *     UsageSummaryResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             monthYear:
 *               type: string
 *               example: "2025-12"
 *             totalClaims:
 *               type: integer
 *               example: 25
 *             totalUsageMinutes:
 *               type: integer
 *               example: 1440
 *             engagementScore:
 *               type: number
 *               example: 87.5
 *             mostUsedProductTypes:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   productType:
 *                     type: string
 *                   count:
 *                     type: integer
 *                   minutes:
 *                     type: integer
 *             claimsByProductType:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *             usageByProductType:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *
 *     AnalyticsResponse:
 *       type: object
 *       required:
 *         - success
 *         - data
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             totalSubscriptions:
 *               type: integer
 *               example: 150
 *             totalClaims:
 *               type: integer
 *               example: 2500
 *             totalUsageMinutes:
 *               type: integer
 *               example: 45000
 *             averageClaimsPerUser:
 *               type: number
 *               example: 16.7
 *             claimsByPlan:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *             usageByProductType:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *             engagementMetrics:
 *               type: object
 *               properties:
 *                 averageSessionDuration:
 *                   type: number
 *                 completionRate:
 *                   type: number
 *                 retentionRate:
 *                   type: number
 *
 * /subscriptions/user:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get user's subscription data with pagination
 *     description: |
 *       Retrieve comprehensive subscription information for the authenticated user including:
 *       - Paginated subscription history
 *       - Current active subscription
 *       - Available subscription plans
 *       - Usage summary
 *
 *       **Features ETag support for data-driven caching** following Ludora patterns.
 *       Cache invalidates automatically when subscription or plan data changes.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Number of subscriptions to return (max 50)
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         example: 10
 *       - name: offset
 *         in: query
 *         description: Pagination offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         example: 0
 *     responses:
 *       200:
 *         description: User subscription data retrieved
 *         headers:
 *           ETag:
 *             description: Data version for caching
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache directives
 *             schema:
 *               type: string
 *               example: "private, no-cache"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionUserResponse'
 *       304:
 *         description: Not Modified (ETag match - data unchanged)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/current:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get current user's active subscription
 *     description: Retrieve detailed information about user's currently active subscription
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active subscription details or null if no active subscription
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/SubscriptionWithPlan'
 *                     - type: "null"
 *                 message:
 *                   type: string
 *                   example: No active subscription found
 *             examples:
 *               with_subscription:
 *                 summary: User has active subscription
 *                 value:
 *                   success: true
 *                   data:
 *                     id: sub_1734123456_abc123
 *                     status: active
 *                     billing_price: 79.90
 *                     subscriptionPlan:
 *                       name: Premium Monthly
 *                       price: 99.90
 *               no_subscription:
 *                 summary: User has no active subscription
 *                 value:
 *                   success: true
 *                   data: null
 *                   message: No active subscription found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/current-status:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get lightweight subscription status (optimized for frequent checks)
 *     description: |
 *       Ultra-fast endpoint with minimal data transfer for navigation components and frequent status checks.
 *
 *       **Features ETag support for data-driven caching** - perfect for frequent polling.
 *       Only returns essential status information with no joins.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Lightweight subscription status
 *         headers:
 *           ETag:
 *             description: Data version for caching
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache directives
 *             schema:
 *               type: string
 *               example: "private, no-cache"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionStatusResponse'
 *       304:
 *         description: Not Modified (ETag match - data unchanged)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/plans:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get all available subscription plans
 *     description: Retrieve all active subscription plans available for purchase
 *     responses:
 *       200:
 *         description: Available subscription plans
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionPlansResponse'
 *
 * /subscriptions/create-payment:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Create subscription payment page
 *     description: |
 *       Create PayPlus payment page for subscription purchase or retry payment for pending subscription.
 *
 *       **Features**:
 *       - New subscription creation
 *       - Retry payment for existing pending subscription
 *       - Environment selection (production/staging)
 *       - Comprehensive validation
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubscriptionPaymentRequest'
 *           examples:
 *             new_subscription:
 *               summary: Create new subscription
 *               value:
 *                 subscriptionPlanId: plan_premium_monthly
 *                 environment: production
 *             retry_payment:
 *               summary: Retry payment for pending subscription
 *               value:
 *                 subscriptionPlanId: plan_premium_monthly
 *                 isRetry: true
 *                 environment: production
 *     responses:
 *       200:
 *         description: Subscription payment page created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionPaymentResponse'
 *       400:
 *         description: Validation error or retry not possible
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_plan:
 *                 value:
 *                   error: subscriptionPlanId is required
 *               retry_invalid:
 *                 value:
 *                   error: No pending subscription found for retry
 *       409:
 *         description: Subscription conflict
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               active_subscription:
 *                 value:
 *                   error: User already has an active subscription
 *               pending_subscription:
 *                 value:
 *                   error: User already has a pending subscription
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/cancel:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Cancel current subscription
 *     description: |
 *       Cancel user's active subscription. Supports immediate cancellation or scheduled cancellation at end of billing period.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelSubscriptionRequest'
 *           examples:
 *             end_of_period:
 *               summary: Cancel at end of billing period (default)
 *               value:
 *                 reason: user_cancelled
 *                 immediate: false
 *             immediate_cancel:
 *               summary: Cancel immediately
 *               value:
 *                 reason: billing_issue
 *                 immediate: true
 *     responses:
 *       200:
 *         description: Subscription cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - message
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Subscription scheduled for cancellation
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Subscription cannot be cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No active subscription found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/{id}:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get subscription by ID
 *     description: |
 *       Retrieve detailed subscription information by ID. Users can only access their own subscriptions.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Subscription ID
 *         example: sub_1734123456_abc123
 *     responses:
 *       200:
 *         description: Subscription details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - success
 *                 - data
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/SubscriptionWithPlan'
 *       403:
 *         description: Access denied to this subscription
 *       404:
 *         description: Subscription not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/validate:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Validate subscription creation
 *     description: |
 *       Check if user can create a subscription for the specified plan.
 *       Returns validation details including existing subscription status.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subscriptionPlanId
 *             properties:
 *               subscriptionPlanId:
 *                 type: string
 *                 example: plan_premium_monthly
 *     responses:
 *       200:
 *         description: Subscription validation result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionValidationResponse'
 *       400:
 *         description: Missing subscription plan ID
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/plans-with-context:
 *   get:
 *     tags:
 *       - Subscriptions
 *     summary: Get subscription plans with user-specific context
 *     description: |
 *       Retrieve all subscription plans with user-specific information:
 *       - Whether user can subscribe to each plan
 *       - Which plan is user's current plan
 *       - Subscription validation status for each plan
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Plans with user context
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlansWithContextResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/change-plan:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Change subscription plan (direct changes)
 *     description: |
 *       Directly change subscription plan for immediate downgrades or free plan changes.
 *       For upgrades requiring payment, use `/plan-changes/upgrade` endpoint instead.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePlanRequest'
 *     responses:
 *       200:
 *         description: Plan changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanChangeResponse'
 *       400:
 *         description: Invalid request or plan change requires payment flow
 *       404:
 *         description: Plan not found or inactive
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/cancel-pending/{id}:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Cancel pending subscription
 *     description: |
 *       Cancel a specific pending subscription. Only the subscription owner can cancel.
 *       Only subscriptions with 'pending' status can be cancelled.
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Pending subscription ID
 *         example: sub_1734123456_abc123
 *     responses:
 *       200:
 *         description: Pending subscription cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Pending subscription cancelled successfully
 *                 data:
 *                   $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Only pending subscriptions can be cancelled
 *       403:
 *         description: Access denied to this subscription
 *       404:
 *         description: Subscription not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/check-payment-status:
 *   post:
 *     tags:
 *       - Subscriptions
 *     summary: Check subscription payment page status (abandoned page detection)
 *     description: |
 *       Advanced endpoint that checks PayPlus payment page status for pending subscriptions to detect:
 *       - Abandoned payment pages (cancels subscription)
 *       - Completed payments (activates subscription)
 *       - Failed payments (cancels subscription)
 *
 *       **Features**:
 *       - Concurrent request protection per user
 *       - Rate limiting for security
 *       - Automatic renewal detection via PayPlus APIs
 *       - Comprehensive status summary
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment page status checked for all pending subscriptions
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubscriptionPaymentStatusCheckResponse'
 *       429:
 *         description: Rate limited or concurrent request in progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Subscription payment status check already in progress
 *                 retryAfter:
 *                   type: integer
 *                   example: 5
 *       500:
 *         description: Service temporarily unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Subscription status check temporarily unavailable
 *                 retryAfter:
 *                   type: integer
 *                   example: 60
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * # Plan Change Endpoints (Dec 2025 Features)
 * /subscriptions/plan-changes/available:
 *   get:
 *     tags:
 *       - Subscription Plan Changes
 *     summary: Get available plan change options
 *     description: |
 *       Get available upgrade and downgrade options for user's current active subscription.
 *       Shows pricing differences, proration calculations, and pending changes.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Available plan change options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailablePlanChangesResponse'
 *       404:
 *         description: No active subscription found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No active subscription found
 *                 message:
 *                   type: string
 *                   example: You must have an active subscription to change plans
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/plan-changes/upgrade:
 *   post:
 *     tags:
 *       - Subscription Plan Changes
 *     summary: Upgrade subscription plan with immediate proration
 *     description: |
 *       Upgrade user's subscription to a higher-tier plan with immediate proration charge.
 *       The proration amount is calculated based on remaining billing period.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpgradeSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Subscription upgraded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanChangeResponse'
 *       400:
 *         description: Invalid request or payment method required
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: newPlanId is required
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: Payment method required for upgrade
 *                     needsPaymentMethod:
 *                       type: boolean
 *                       example: true
 *       402:
 *         description: Payment failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Proration charge failed
 *                 paymentFailed:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: No active subscription found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/plan-changes/downgrade:
 *   post:
 *     tags:
 *       - Subscription Plan Changes
 *     summary: Schedule subscription downgrade for next billing cycle
 *     description: |
 *       Schedule a subscription downgrade to take effect at the next billing cycle.
 *       User keeps current benefits until the downgrade becomes effective.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DowngradeSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Downgrade scheduled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanChangeResponse'
 *       400:
 *         description: Invalid request
 *       409:
 *         description: Pending plan change already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: You already have a pending plan change
 *                 pendingChange:
 *                   type: object
 *                   description: Details of existing pending change
 *                 message:
 *                   type: string
 *                   example: Cancel your pending change before scheduling a new one
 *       404:
 *         description: No active subscription found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/plan-changes/cancel-pending-downgrade:
 *   post:
 *     tags:
 *       - Subscription Plan Changes
 *     summary: Cancel pending subscription downgrade
 *     description: |
 *       Cancel a previously scheduled subscription downgrade.
 *       User will continue with current plan and billing.
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pending downgrade cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PlanChangeResponse'
 *       400:
 *         description: Can only cancel pending downgrades
 *       404:
 *         description: No pending plan change found or no active subscription
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: No active subscription found
 *                 - type: object
 *                   properties:
 *                     error:
 *                       type: string
 *                       example: No pending plan change found to cancel
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * # Subscription Benefits Endpoints
 * /subscriptions/benefits/claim:
 *   post:
 *     tags:
 *       - Subscription Benefits
 *     summary: Claim product using subscription allowance (Teachers only)
 *     description: |
 *       Claim a product using subscription benefits. Teachers can claim products
 *       within their monthly allowances. Returns updated user context for real-time
 *       frontend state synchronization.
 *
 *       **Important**: Only teachers can claim products with subscription benefits.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClaimProductRequest'
 *     responses:
 *       200:
 *         description: Product claim result (success or needs confirmation)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClaimProductResponse'
 *             examples:
 *               success:
 *                 summary: Product claimed successfully
 *                 value:
 *                   success: true
 *                   message: Product claimed successfully
 *                   data:
 *                     claim:
 *                       id: subpurch_abc123
 *                       subscription_history_id: sub_xyz789
 *                       purchasable_type: workshop
 *                       purchasable_id: product_abc123
 *                     alreadyClaimed: false
 *                     remainingClaims:
 *                       workshops: 38
 *                       files: 55
 *                   updatedContext:
 *                     subscriptionAllowances:
 *                       workshops: 38
 *               needs_confirmation:
 *                 summary: Low allowances - needs confirmation
 *                 value:
 *                   success: false
 *                   needsConfirmation: true
 *                   remainingClaims:
 *                     workshops: 2
 *                   message: You have only 2 workshop claims remaining this month
 *                   productType: workshop
 *                   productId: product_abc123
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied or insufficient allowances
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               not_teacher:
 *                 value:
 *                   error: Only teachers can claim products with subscription benefits
 *               no_allowance:
 *                 value:
 *                   error: No remaining allowances for this product type
 *                   details:
 *                     used: 50
 *                     allowed: 50
 *       404:
 *         description: Product not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/benefits/my-allowances:
 *   get:
 *     tags:
 *       - Subscription Benefits
 *     summary: Get user's monthly subscription allowances (Teachers only)
 *     description: |
 *       Retrieve user's subscription allowances for the specified month, including:
 *       - Total allowances by product type
 *       - Used allowances
 *       - Remaining allowances
 *       - Associated subscription plan details
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: monthYear
 *         in: query
 *         description: Month to get allowances for (YYYY-MM format)
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         example: "2025-12"
 *     responses:
 *       200:
 *         description: Monthly allowances data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MonthlyAllowancesResponse'
 *             examples:
 *               with_allowances:
 *                 summary: User has active subscription
 *                 value:
 *                   success: true
 *                   data:
 *                     monthYear: "2025-12"
 *                     totalAllowances:
 *                       workshops: 50
 *                       files: 100
 *                       lesson_plans: 30
 *                     usedAllowances:
 *                       workshops: 12
 *                       files: 45
 *                       lesson_plans: 8
 *                     remainingAllowances:
 *                       workshops: 38
 *                       files: 55
 *                       lesson_plans: 22
 *               no_subscription:
 *                 summary: No active subscription
 *                 value:
 *                   success: true
 *                   data: null
 *                   message: No active subscription found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/benefits/record-usage:
 *   post:
 *     tags:
 *       - Subscription Benefits
 *     summary: Record product usage (Teachers and Students)
 *     description: |
 *       Record usage data for claimed subscription products. Supports both teacher direct usage
 *       and student usage of teacher's claimed products.
 *
 *       **For Students**: Must specify teacherId to record usage of teacher's claimed products.
 *       **For Teachers**: Records usage of their own claimed products.
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordUsageRequest'
 *           examples:
 *             teacher_usage:
 *               summary: Teacher recording usage of their claimed product
 *               value:
 *                 productType: workshop
 *                 productId: product_abc123
 *                 duration_minutes: 45
 *                 activity_type: play
 *                 completion_percent: 100
 *                 feature_action: completed_quiz
 *             student_usage:
 *               summary: Student recording usage of teacher's claimed product
 *               value:
 *                 productType: game
 *                 productId: product_xyz789
 *                 duration_minutes: 20
 *                 activity_type: play
 *                 completion_percent: 75
 *                 teacherId: user_teacher123
 *     responses:
 *       200:
 *         description: Usage recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecordUsageResponse'
 *       400:
 *         description: Validation error (missing required fields)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missing_teacher_id:
 *                 value:
 *                   error: Students must specify teacherId when recording usage of teacher's claimed products
 *       404:
 *         description: Teacher not found or no subscription claim found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               no_claim:
 *                 value:
 *                   error: No subscription claim found for this product
 *               teacher_not_found:
 *                 value:
 *                   error: Teacher not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/benefits/my-summary:
 *   get:
 *     tags:
 *       - Subscription Benefits
 *     summary: Get user's subscription usage summary (Teachers only)
 *     description: |
 *       Get comprehensive usage summary for teacher's subscription benefits including:
 *       - Total claims and usage time
 *       - Engagement metrics
 *       - Most used product types
 *       - Usage patterns and analytics
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: monthYear
 *         in: query
 *         description: Month to get summary for (YYYY-MM format)
 *         schema:
 *           type: string
 *           pattern: '^\d{4}-\d{2}$'
 *         example: "2025-12"
 *     responses:
 *       200:
 *         description: Usage summary data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsageSummaryResponse'
 *       403:
 *         description: Only teachers can view subscription usage summary
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *
 * /subscriptions/benefits/analytics:
 *   get:
 *     tags:
 *       - Subscription Benefits
 *     summary: Get subscription benefits analytics (Admin only)
 *     description: |
 *       Get system-wide analytics for subscription benefits usage.
 *       Provides comprehensive metrics for business intelligence and platform optimization.
 *
 *       **Admin Access Required** (admin or sysadmin role)
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: Analytics start date (ISO format)
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-11-01"
 *       - name: endDate
 *         in: query
 *         description: Analytics end date (ISO format)
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-12-01"
 *       - name: productType
 *         in: query
 *         description: Filter by specific product type
 *         schema:
 *           type: string
 *           enum: [file, lesson_plan, game, workshop, course, tool]
 *         example: workshop
 *       - name: userId
 *         in: query
 *         description: Filter by specific user ID
 *         schema:
 *           type: string
 *         example: user_abc123
 *     responses:
 *       200:
 *         description: Subscription benefits analytics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AnalyticsResponse'
 *       403:
 *         description: Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               value:
 *                 error: Admin access required
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */

export default {};