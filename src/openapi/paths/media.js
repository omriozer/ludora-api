/**
 * @swagger
 * components:
 *   schemas:
 *     AudioFileDownloadResponse:
 *       type: string
 *       format: binary
 *       description: Complete audio file binary data
 *
 *     VideoStreamResponse:
 *       type: string
 *       format: binary
 *       description: Video stream binary data (full stream or partial content)
 *
 *     MediaErrorResponse:
 *       type: object
 *       required:
 *         - error
 *         - message
 *       properties:
 *         error:
 *           type: string
 *           example: Authentication required
 *         message:
 *           type: string
 *           example: Private content requires authentication
 *         hint:
 *           type: string
 *           nullable: true
 *           example: Provide token via Authorization header or query parameter
 *         details:
 *           type: string
 *           nullable: true
 *           description: Additional error details
 *
 *     RangeNotSatisfiableResponse:
 *       type: object
 *       required:
 *         - error
 *         - message
 *       properties:
 *         error:
 *           type: string
 *           example: Range not satisfiable
 *         message:
 *           type: string
 *           example: The requested range is invalid
 *
 * /media/download/audiofile/{audioFileId}:
 *   get:
 *     tags:
 *       - Media
 *     summary: Download complete audio file
 *     description: |
 *       Downloads complete audio files for authenticated users.
 *       Supports query parameter authentication for HTML audio element compatibility.
 *       Returns the complete file (not streaming) for client-side caching.
 *
 *       **S3 Path Structure**: `{env}/private/audio/audiofile/{audioFileId}/{fileName}`
 *
 *       **Features**:
 *       - Complete file download (not streaming)
 *       - Query parameter authentication support
 *       - Hebrew filename support with proper encoding
 *       - Israeli-optimized caching headers
 *       - CORS support for web audio elements
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - name: audioFileId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the AudioFile entity
 *         example: 8ph4wf
 *       - name: token
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token (alternative to Authorization header)
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - name: authToken
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token (alias for token parameter)
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Complete audio file download
 *         headers:
 *           Content-Type:
 *             description: Audio MIME type
 *             schema:
 *               type: string
 *               example: audio/mpeg
 *           Content-Length:
 *             description: File size in bytes
 *             schema:
 *               type: integer
 *               example: 5242880
 *           Content-Disposition:
 *             description: Filename with Hebrew support (RFC 5987 encoding)
 *             schema:
 *               type: string
 *               example: 'inline; filename="audio.mp3"; filename*=UTF-8''%D7%A9%D7%99%D7%A8_%D7%99%D7%A9%D7%A8%D7%90%D7%9C.mp3'
 *           Cache-Control:
 *             description: Israeli-optimized cache control
 *             schema:
 *               type: string
 *               example: public, max-age=3600
 *           X-Content-Type:
 *             description: Content type identifier
 *             schema:
 *               type: string
 *               example: audio-file
 *           X-AudioFile-ID:
 *             description: AudioFile entity ID
 *             schema:
 *               type: string
 *               example: 8ph4wf
 *           Access-Control-Allow-Origin:
 *             description: CORS origin header
 *             schema:
 *               type: string
 *               example: "*"
 *         content:
 *           audio/mpeg:
 *             schema:
 *               $ref: '#/components/schemas/AudioFileDownloadResponse'
 *           audio/wav:
 *             schema:
 *               $ref: '#/components/schemas/AudioFileDownloadResponse'
 *           audio/ogg:
 *             schema:
 *               $ref: '#/components/schemas/AudioFileDownloadResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               no_token:
 *                 summary: No authentication token provided
 *                 value:
 *                   error: Authentication required
 *                   message: Audio file download requires authentication
 *                   hint: Provide token via Authorization header or query parameter (authToken or token)
 *       403:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Token verification failed
 *                 value:
 *                   error: Invalid or expired token
 *                   message: Token verification failed
 *       404:
 *         description: Audio file not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               file_not_found:
 *                 summary: AudioFile entity not found
 *                 value:
 *                   error: Audio file not found
 *                   message: AudioFile with ID 8ph4wf not found
 *               no_file_data:
 *                 summary: No audio data associated
 *                 value:
 *                   error: Audio file not available
 *                   message: No audio file data associated with this record
 *               storage_not_found:
 *                 summary: File not found in S3 storage
 *                 value:
 *                   error: Audio file not found in storage
 *                   message: Audio file for 8ph4wf not found in S3
 *                   details: NoSuchKey
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *
 *   options:
 *     tags:
 *       - Media
 *     summary: CORS preflight for audio download
 *     description: Handle CORS preflight requests for audio file downloads
 *     parameters:
 *       - name: audioFileId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the AudioFile entity
 *     responses:
 *       200:
 *         description: CORS preflight response
 *         headers:
 *           Access-Control-Allow-Origin:
 *             schema:
 *               type: string
 *               example: "*"
 *           Access-Control-Allow-Methods:
 *             schema:
 *               type: string
 *               example: GET, OPTIONS
 *           Access-Control-Allow-Headers:
 *             schema:
 *               type: string
 *               example: Range, Content-Type, Authorization
 *
 * /media/stream/{entityType}/{entityId}:
 *   get:
 *     tags:
 *       - Media
 *     summary: Stream video (unified endpoint for marketing and private videos)
 *     description: |
 *       Unified streaming endpoint for all videos with automatic public/private detection.
 *
 *       **Video Types**:
 *       - **Marketing Videos** (public): No authentication required, publicly cacheable
 *       - **Private Content Videos**: Authentication and access control required
 *
 *       **S3 Path Structures**:
 *       - Marketing: `{env}/public/marketing-video/{entityType}/{entityId}/video.mp4`
 *       - Private: `{env}/private/content-video/{entityType}/{entityId}/video.mp4`
 *
 *       **Features**:
 *       - Automatic public/private video detection
 *       - HTTP range requests support (video seeking)
 *       - Three-layer access control for private videos
 *       - Israeli-optimized caching for marketing videos
 *       - Free content auto-purchase tracking
 *       - Hebrew filename support
 *       - CORS support
 *
 *       **Access Control for Private Videos**:
 *       1. Creator Access (user owns the content)
 *       2. Purchase Access (user bought the content)
 *       3. Subscription Claim Access (user claimed via subscription)
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - name: entityType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [workshop, course, file, tool, lesson_plan, game]
 *         description: Type of entity containing the video
 *         example: workshop
 *       - name: entityId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the entity containing the video
 *         example: abc123
 *       - name: token
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token for private videos (alternative to Authorization header)
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       - name: authToken
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token alias for private videos
 *         example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Full video stream
 *         headers:
 *           Content-Type:
 *             description: Video MIME type
 *             schema:
 *               type: string
 *               example: video/mp4
 *           Content-Length:
 *             description: Video file size in bytes
 *             schema:
 *               type: integer
 *               example: 52428800
 *           Accept-Ranges:
 *             description: Byte ranges support for video seeking
 *             schema:
 *               type: string
 *               example: bytes
 *           Cache-Control:
 *             description: Cache control (varies by video type)
 *             schema:
 *               type: string
 *               example: public, max-age=3600
 *           X-Content-Type:
 *             description: Content type identifier
 *             schema:
 *               type: string
 *               enum: [marketing-video, private-video]
 *               example: marketing-video
 *           X-Entity-Type:
 *             description: Entity type
 *             schema:
 *               type: string
 *               example: workshop
 *           X-Entity-ID:
 *             description: Entity ID
 *             schema:
 *               type: string
 *               example: abc123
 *           Access-Control-Allow-Origin:
 *             description: CORS origin header
 *             schema:
 *               type: string
 *               example: "*"
 *           Access-Control-Expose-Headers:
 *             description: CORS exposed headers for video controls
 *             schema:
 *               type: string
 *               example: Content-Range, Accept-Ranges, Content-Length, Content-Type
 *         content:
 *           video/mp4:
 *             schema:
 *               $ref: '#/components/schemas/VideoStreamResponse'
 *       206:
 *         description: Partial content (range request for video seeking)
 *         headers:
 *           Content-Type:
 *             description: Video MIME type
 *             schema:
 *               type: string
 *               example: video/mp4
 *           Content-Range:
 *             description: Byte range being served
 *             schema:
 *               type: string
 *               example: bytes 1024000-2048000/52428800
 *           Content-Length:
 *             description: Number of bytes in this chunk
 *             schema:
 *               type: integer
 *               example: 1024001
 *           Accept-Ranges:
 *             description: Byte ranges support
 *             schema:
 *               type: string
 *               example: bytes
 *           X-Content-Type:
 *             description: Content type identifier
 *             schema:
 *               type: string
 *               enum: [marketing-video, private-video]
 *               example: marketing-video
 *         content:
 *           video/mp4:
 *             schema:
 *               $ref: '#/components/schemas/VideoStreamResponse'
 *       401:
 *         description: Authentication required for private video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               private_video_no_auth:
 *                 summary: Private video requires authentication
 *                 value:
 *                   error: Authentication required
 *                   message: Private content requires authentication
 *                   hint: Provide token via Authorization header or query parameter (authToken or token)
 *       403:
 *         description: Access denied to private video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               invalid_token:
 *                 summary: Invalid or expired token
 *                 value:
 *                   error: Invalid or expired token
 *                   message: Token verification failed
 *               access_denied:
 *                 summary: User doesn't have access to this video
 *                 value:
 *                   error: Access denied
 *                   message: You do not have permission to access this video
 *                   hint: Purchase the content or contact the creator for access
 *       404:
 *         description: Video not found (neither marketing nor private video exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               marketing_not_found:
 *                 summary: Marketing video not found
 *                 value:
 *                   error: Video not found
 *                   message: Marketing video for workshop/abc123 not found in storage
 *               private_not_found:
 *                 summary: Private video not found
 *                 value:
 *                   error: Video not found
 *                   message: Private video for workshop/abc123 not found in storage
 *                   details: NoSuchKey
 *       416:
 *         description: Range not satisfiable (invalid range request)
 *         headers:
 *           Content-Range:
 *             description: Valid range format
 *             schema:
 *               type: string
 *               example: bytes */52428800
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RangeNotSatisfiableResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *             examples:
 *               stream_error:
 *                 summary: Streaming error
 *                 value:
 *                   error: Stream error
 *                   message: Failed to stream video content
 *               server_error:
 *                 summary: General server error
 *                 value:
 *                   error: Internal server error
 *                   message: Failed to process video stream request
 *
 *   options:
 *     tags:
 *       - Media
 *     summary: CORS preflight for video streaming
 *     description: |
 *       Handle CORS preflight requests for video streaming endpoints.
 *       Supports range requests and various authentication methods.
 *     parameters:
 *       - name: entityType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [workshop, course, file, tool, lesson_plan, game]
 *         description: Type of entity containing the video
 *       - name: entityId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the entity containing the video
 *     responses:
 *       200:
 *         description: CORS preflight response for video streaming
 *         headers:
 *           Access-Control-Allow-Origin:
 *             description: Allowed origins
 *             schema:
 *               type: string
 *               example: "*"
 *           Access-Control-Allow-Credentials:
 *             description: Credentials support
 *             schema:
 *               type: string
 *               example: "false"
 *           Access-Control-Allow-Methods:
 *             description: Allowed HTTP methods
 *             schema:
 *               type: string
 *               example: GET, OPTIONS, HEAD
 *           Access-Control-Allow-Headers:
 *             description: Allowed request headers
 *             schema:
 *               type: string
 *               example: Range, Content-Type, Authorization, Cache-Control, Pragma
 *           Access-Control-Expose-Headers:
 *             description: Headers exposed to client
 *             schema:
 *               type: string
 *               example: Content-Range, Accept-Ranges, Content-Length, Content-Type
 *
 *   head:
 *     tags:
 *       - Media
 *     summary: Get video metadata without content
 *     description: |
 *       Get video metadata (headers only) without downloading content.
 *       Useful for checking video availability and getting file size.
 *       Follows same access control rules as GET request.
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - name: entityType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [workshop, course, file, tool, lesson_plan, game]
 *         description: Type of entity containing the video
 *         example: workshop
 *       - name: entityId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the entity containing the video
 *         example: abc123
 *       - name: token
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token for private videos (alternative to Authorization header)
 *       - name: authToken
 *         in: query
 *         schema:
 *           type: string
 *         description: Auth token alias for private videos
 *     responses:
 *       200:
 *         description: Video metadata (headers only)
 *         headers:
 *           Content-Type:
 *             description: Video MIME type
 *             schema:
 *               type: string
 *               example: video/mp4
 *           Content-Length:
 *             description: Video file size in bytes
 *             schema:
 *               type: integer
 *               example: 52428800
 *           Accept-Ranges:
 *             description: Byte ranges support for video seeking
 *             schema:
 *               type: string
 *               example: bytes
 *           X-Content-Type:
 *             description: Content type identifier
 *             schema:
 *               type: string
 *               enum: [marketing-video, private-video]
 *               example: marketing-video
 *       401:
 *         description: Authentication required for private video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *       403:
 *         description: Access denied to private video
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 *       404:
 *         description: Video not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MediaErrorResponse'
 */

export default {};