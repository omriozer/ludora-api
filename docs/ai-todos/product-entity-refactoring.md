# Product Entity Refactoring - Remaining Tasks

## Context
This document tracks the remaining work for the product entity architecture refactoring. The project is migrating from a single Product table "god object" to dedicated entity tables (Workshop, Course, File, Tool) with enhanced Purchase-based access control.

## Current Status: Frontend Integration Complete ✅

### Completed Work:
- ✅ **Frontend Entity Integration**: All major pages updated to use new entity architecture
- ✅ **Entity Services**: Workshop, Course, File, Tool services implemented
- ✅ **Purchase Flow**: Updated to handle both new polymorphic and legacy structures
- ✅ **Data Loading**: Pages use entity.filter() instead of Product.filter({product_type})
- ✅ **Navigation**: Entity-specific URLs for details and purchases

### Verified Status:
- ✅ No compilation errors in updated files
- ✅ Purchase flow updated for new entity system
- ✅ Download logic updated for File and Tool entities
- ✅ Admin edit links point to entity-specific management pages

## Remaining Tasks

### 🔄 Phase 2: Backend Database Schema (Priority: High)
- [ ] Create Workshop table with workshop-specific fields
- [ ] Create Course table with course-specific fields
- [ ] Create File table with file-specific fields
- [ ] Create Tool table with tool-specific fields
- [ ] Add polymorphic fields to Purchase table (purchasable_type, purchasable_id, access_expires_at)
- [ ] Create database migrations for all new tables

### 🔄 Phase 3: Backend API Implementation (Priority: High)
- [ ] Update entity models and associations
- [ ] Create API endpoints for Workshop entity (/api/entities/workshop)
- [ ] Create API endpoints for Course entity (/api/entities/course)
- [ ] Create API endpoints for File entity (/api/entities/file)
- [ ] Create API endpoints for Tool entity (/api/entities/tool)
- [ ] Update access control logic to use enhanced Purchase table
- [ ] Update purchase creation logic for polymorphic purchases

### 🔄 Phase 4: Data Migration (Priority: Medium)
- [ ] Create migration script to move Product data to entity tables
- [ ] Update existing Purchase records with new polymorphic fields
- [ ] Migrate Registration data to Purchase records
- [ ] Verify data integrity after migration

### 🔄 Phase 5: Frontend Completion (Priority: Low)
- [ ] Complete ProductDetails.jsx render section updates
- [ ] Update admin management pages for each entity type
- [ ] Test end-to-end purchase and access flows
- [ ] Update any remaining legacy Product references

### 🔄 Phase 6: Testing & Cleanup (Priority: Low)
- [ ] Create comprehensive tests for new entity system
- [ ] Remove old Product table references (after migration complete)
- [ ] Remove Registration table and related code
- [ ] Update all documentation

## Technical Notes

### Entity Table Structure Planned:
```sql
-- Workshop table
CREATE TABLE workshop (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_file_url VARCHAR(255),
  is_live BOOLEAN DEFAULT false,
  schedule_date TIMESTAMP,
  creator_user_id VARCHAR(255) REFERENCES "user"(id),
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Course table
CREATE TABLE course (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  course_modules JSONB DEFAULT '[]',
  creator_user_id VARCHAR(255) REFERENCES "user"(id),
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- File table
CREATE TABLE file (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size BIGINT,
  creator_user_id VARCHAR(255) REFERENCES "user"(id),
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tool table
CREATE TABLE tool (
  id VARCHAR(255) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  tool_url VARCHAR(255),
  file_url VARCHAR(255),
  tool_type VARCHAR(100),
  creator_user_id VARCHAR(255) REFERENCES "user"(id),
  price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Purchase table
ALTER TABLE purchase ADD COLUMN purchasable_type VARCHAR(50);
ALTER TABLE purchase ADD COLUMN purchasable_id VARCHAR(255);
ALTER TABLE purchase ADD COLUMN access_expires_at TIMESTAMP;
```

### Access Control Logic:
```javascript
// Enhanced Purchase-based access
const access = await Purchase.findOne({
  where: {
    buyer_email: userEmail,
    purchasable_type: entityType, // 'workshop', 'course', etc.
    purchasable_id: entityId,
    payment_status: 'completed',
    [Op.or]: [
      { access_expires_at: null }, // Lifetime access
      { access_expires_at: { [Op.gt]: new Date() } } // Active access
    ]
  }
});
```

## Session Continuity
If session is interrupted, next AI should:
1. Check this file for current progress
2. Continue with Phase 2: Backend Database Schema
3. Focus on Workshop table creation first
4. Update this file with each completed task

## Next Priority
**Start with Workshop table creation and API endpoint implementation** - this will establish the pattern for other entities.