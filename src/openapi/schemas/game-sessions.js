/**
 * @openapi
 * components:
 *   schemas:
 *     GameLobby:
 *       type: object
 *       required: [id, name, game_id, host_user_id, status, max_participants]
 *       properties:
 *         id:
 *           type: string
 *           example: "lobby_abc123"
 *         name:
 *           type: string
 *           example: "Math Challenge Room"
 *         game_id:
 *           type: string
 *           example: "game_456def"
 *         host_user_id:
 *           type: string
 *           example: "teacher_789ghi"
 *         status:
 *           type: string
 *           enum: [waiting, starting, active, finished]
 *           example: "waiting"
 *         max_participants:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 30
 *         current_participants:
 *           type: integer
 *           minimum: 0
 *           example: 5
 *         settings:
 *           type: object
 *           description: Lobby-specific game settings
 *         metadata:
 *           type: object
 *           description: Additional lobby metadata
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2024-12-11T14:30:00Z"
 *
 *     GameSession:
 *       type: object
 *       required: [id, lobby_id, status, participants_count]
 *       properties:
 *         id:
 *           type: string
 *           example: "session_abc123"
 *         lobby_id:
 *           type: string
 *           example: "lobby_456def"
 *         status:
 *           type: string
 *           enum: [pending, active, paused, finished]
 *           example: "active"
 *         participants_count:
 *           type: integer
 *           minimum: 0
 *           example: 8
 *         game_state:
 *           type: object
 *           description: Current game state data
 *         session_metadata:
 *           type: object
 *           description: Session tracking metadata
 *         started_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2024-12-11T14:35:00Z"
 *         finished_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *
 *     GameParticipant:
 *       type: object
 *       required: [id, session_id, participant_type, status]
 *       properties:
 *         id:
 *           type: string
 *           example: "participant_abc123"
 *         session_id:
 *           type: string
 *           example: "session_456def"
 *         user_id:
 *           type: string
 *           nullable: true
 *           description: User ID for authenticated participants
 *           example: "user_789ghi"
 *         participant_type:
 *           type: string
 *           enum: [authenticated, anonymous]
 *           example: "anonymous"
 *         display_name:
 *           type: string
 *           example: "Player 1"
 *         status:
 *           type: string
 *           enum: [connected, disconnected, finished]
 *           example: "connected"
 *         score:
 *           type: integer
 *           nullable: true
 *           example: 150
 *         position:
 *           type: integer
 *           nullable: true
 *           description: Final position/rank in game
 *           example: 3
 *         joined_at:
 *           type: string
 *           format: date-time
 *           example: "2024-12-11T14:36:00Z"
 *
 *     LobbyInvite:
 *       type: object
 *       required: [lobby_code, lobby_name, invitation_type]
 *       properties:
 *         lobby_code:
 *           type: string
 *           pattern: '^[0-9]{6}$'
 *           example: "123456"
 *         lobby_name:
 *           type: string
 *           example: "Math Challenge Room"
 *         invitation_type:
 *           type: string
 *           enum: [manual_selection, order_assignment]
 *           example: "manual_selection"
 *         max_participants:
 *           type: integer
 *           example: 30
 *         current_participants:
 *           type: integer
 *           example: 5
 *         game_info:
 *           type: object
 *           properties:
 *             title:
 *               type: string
 *               example: "Addition Practice"
 *             difficulty:
 *               type: string
 *               example: "easy"
 *         host_info:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Mrs. Cohen"
 *
 *     SessionStateUpdate:
 *       type: object
 *       required: [update_type, data]
 *       properties:
 *         update_type:
 *           type: string
 *           enum: [state_change, participant_action, game_event]
 *           example: "participant_action"
 *         data:
 *           type: object
 *           description: Update-specific data
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: "2024-12-11T14:37:00Z"
 *         participant_id:
 *           type: string
 *           nullable: true
 *           description: Participant who triggered the update
 *           example: "participant_abc123"
 */

export default {};