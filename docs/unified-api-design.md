# Unified File Management API Design

## Overview
This document outlines the unified REST API structure for file management operations, consolidating all upload, download, and management endpoints into a coherent, RESTful design.

## Design Principles
1. **RESTful Resource Hierarchy** - Clear entity -> asset type -> operations structure
2. **Predictable Paths** - Consistent URL patterns for all operations
3. **Content Type Negotiation** - Automatic handling based on asset type
4. **Unified Error Handling** - Consistent error responses across all endpoints
5. **Transaction Safety** - All operations wrapped in transactions where applicable

## Unified API Structure

### Base Path: `/api/assets/`

```
/api/assets/
├── :entityType/:entityId/                          # Entity-level operations
│   ├── GET                                        # Check all assets for entity
│   ├── DELETE                                     # Delete all assets for entity
│   └── :assetType/                               # Asset-type specific operations
│       ├── GET                                   # Download/serve specific asset
│       ├── POST                                  # Upload specific asset
│       ├── PUT                                   # Replace specific asset
│       └── DELETE                                # Delete specific asset
└── batch/                                        # Batch operations
    ├── POST /validate                           # Batch validation
    ├── POST /upload                             # Batch upload
    └── DELETE                                   # Batch deletion
```

## Endpoint Details

### 1. Entity-Level Asset Check
**GET** `/api/assets/:entityType/:entityId`

**Purpose**: Check all assets associated with an entity
**Response**: List of available assets with metadata

```json
{
  "success": true,
  "entityType": "workshop",
  "entityId": "abc123",
  "assets": {
    "marketing-video": {
      "exists": true,
      "size": 52428800,
      "lastModified": "2025-10-01T12:00:00.000Z",
      "url": "/api/assets/workshop/abc123/marketing-video"
    },
    "document": {
      "exists": false,
      "reason": "Not uploaded"
    },
    "image": {
      "exists": true,
      "size": 1024000,
      "lastModified": "2025-10-01T11:00:00.000Z",
      "url": "/api/assets/workshop/abc123/image"
    }
  }
}
```

### 2. Entity-Level Asset Deletion
**DELETE** `/api/assets/:entityType/:entityId`

**Purpose**: Delete ALL assets for an entity (cascading delete)
**Use Case**: When deleting an entity completely

### 3. Asset-Specific Operations
**Base Path**: `/api/assets/:entityType/:entityId/:assetType`

#### 3.1 Asset Download/Serving
**GET** `/api/assets/:entityType/:entityId/:assetType`

**Content Negotiation**:
- **Documents**: Force download with original filename
- **Images**: Serve inline with caching headers
- **Videos**: Stream with range support
- **Marketing Videos**: Public access, cached
- **Content Videos**: Private access, no cache

**Query Parameters**:
- `preview=true` - For document preview mode (with watermarks)
- `download=true` - Force download even for images
- `quality=low|medium|high` - For future video quality selection

#### 3.2 Asset Upload
**POST** `/api/assets/:entityType/:entityId/:assetType`

**Unified Upload Endpoint** replacing:
- `/upload`
- `/upload/video/public`
- `/upload/video/private`

**Content-Type**: `multipart/form-data`
**Body**: File in `file` field

**Auto-Detection**:
- `marketing-video` vs `content-video` determined by entity type and user permissions
- File validation based on asset type
- Automatic filename standardization

#### 3.3 Asset Replacement
**PUT** `/api/assets/:entityType/:entityId/:assetType`

**Purpose**: Replace existing asset (same as POST but semantically clearer)

#### 3.4 Asset-Specific Deletion
**DELETE** `/api/assets/:entityType/:entityId/:assetType`

**Purpose**: Delete specific asset type while keeping others

### 4. Batch Operations

#### 4.1 Batch Validation
**POST** `/api/assets/batch/validate`

**Purpose**: Validate multiple files before upload without actually uploading

```json
{
  "files": [
    {
      "entityType": "workshop",
      "entityId": "abc123",
      "assetType": "marketing-video",
      "filename": "video.mp4",
      "size": 52428800,
      "mimeType": "video/mp4"
    }
  ]
}
```

#### 4.2 Batch Upload
**POST** `/api/assets/batch/upload`

**Purpose**: Upload multiple assets in a single transaction

#### 4.3 Batch Deletion
**DELETE** `/api/assets/batch`

**Purpose**: Delete multiple assets atomically

## Migration Strategy

### Phase 1: Add New Unified Endpoints
1. Implement new unified endpoints alongside existing ones
2. Add deprecation warnings to old endpoints
3. Update documentation

### Phase 2: Frontend Migration
1. Update frontend to use new endpoints
2. Test with both old and new simultaneously
3. Gradual cutover per feature

### Phase 3: Legacy Cleanup
1. Remove old endpoints after full migration
2. Clean up unused code
3. Update tests

## Asset Type Mapping

| Asset Type | Privacy | Path Pattern | Content Handling |
|------------|---------|--------------|------------------|
| `document` | Private | `entity/id/document` | Download with access control |
| `image` | Public | `entity/id/image` | Serve inline with caching |
| `marketing-video` | Public | `entity/id/marketing-video` | Stream with caching |
| `content-video` | Private | `entity/id/content-video` | Stream with access control |

## Backwards Compatibility

During transition period, maintain redirects:
- `/upload` → `/api/assets/:entityType/:entityId/:assetType` (POST)
- `/download/:entityType/:entityId` → `/api/assets/:entityType/:entityId/document` (GET)
- `/image/:entityType/:entityId/:filename` → `/api/assets/:entityType/:entityId/image` (GET)
- `/check/:entityType/:entityId` → `/api/assets/:entityType/:entityId` (GET)

## Benefits

1. **Consistency**: All file operations follow same URL pattern
2. **Discoverability**: Clear hierarchy makes API self-documenting
3. **Flexibility**: Easy to add new asset types or operations
4. **Caching**: Predictable URLs enable better caching strategies
5. **Frontend Simplification**: Single pattern for all file operations
6. **Mobile Friendly**: RESTful structure works well with mobile apps

## Error Handling

All endpoints use unified error response format:
```json
{
  "error": "Error type",
  "message": "Human readable message",
  "requestId": "req_12345",
  "timestamp": "2025-10-01T12:00:00.000Z",
  "details": {
    "entityType": "workshop",
    "entityId": "abc123",
    "assetType": "document"
  }
}
```

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Entity-level and asset-type level permissions
3. **Rate Limiting**: Per-user and per-endpoint limits
4. **Input Validation**: Comprehensive pre-upload validation
5. **Content Security**: No direct S3 URLs exposed