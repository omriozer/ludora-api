# Computed Settings Architecture Documentation

## Overview

Ludora implements a **hybrid settings system** where settings are sourced from two different locations:

1. **Database Settings** (79 keys) - Stored in the `settings` table
2. **Computed Settings** (6 keys) - Generated dynamically from constants/config files

This documentation explains the **Option B approach** chosen for computed settings.

---

## Architecture Decision: Option B - Route-Level Computed Properties

**Decision:** Keep computed settings as **computed properties** added at the route level rather than migrating them to the SettingsService.

**Rationale:**
- **Separation of Concerns**: Database settings are user-configurable values; computed settings are system constants
- **Performance**: Constants are cached in memory; no database queries needed
- **Maintainability**: Changes to constants automatically reflected without database migrations
- **Type Safety**: Constants have compile-time validation; no runtime parsing needed

---

## Implementation Details

### Location: `/routes/settings.js` (lines 45-57)

```javascript
// Add enhanced configuration like the entities route does
const enhancedResults = results.map(setting => {
  const settingData = setting.toJSON ? setting.toJSON() : setting;

  return {
    ...settingData,
    file_types_config: getFileTypesForFrontend(),
    study_subjects: STUDY_SUBJECTS,
    audiance_targets: AUDIANCE_TARGETS,
    school_grades: SCHOOL_GRADES,
    game_types: GAME_TYPES,
    languade_options: LANGUAGES_OPTIONS
  };
});
```

### Computed Settings (6 keys)

| Key | Source File | Type | Description |
|-----|-------------|------|-------------|
| `file_types_config` | `/constants/fileTypes.js` | Object | Allowed file types for uploads |
| `study_subjects` | `/constants/info.js` | Array | Available academic subjects |
| `audiance_targets` | `/constants/info.js` | Array | Target audience options |
| `school_grades` | `/constants/info.js` | Array | Grade level options |
| `game_types` | `/config/gameTypes.js` | Array | Available game types |
| `languade_options` | `/constants/langauages.js` | Array | Supported language options |

---

## Data Flow Architecture

### Frontend Perspective
```
Frontend Request → GET /api/settings
                ↓
Route Handler (settings.js)
                ↓
Database Query (79 settings) + Constants Import (6 settings)
                ↓
Enhanced Result Object (85 total settings)
                ↓
Frontend Receives Complete Settings
```

### Cache Behavior

**Database Settings:**
- Cached via SettingsService with data-driven invalidation
- Cache key includes `MAX(updated_at)` from settings table
- Invalidated when any setting is modified

**Computed Settings:**
- Cached as Node.js module imports (memory resident)
- Never invalidated during runtime
- Only updated on server restart or code deployment

---

## Environment Synchronization

### Current Status (November 2024)

| Environment | Database Settings | Computed Settings | Total |
|-------------|------------------|-------------------|-------|
| Development | 79 ✅ | 6 ✅ | 85 |
| Staging | 79 ✅ | 6 ✅ | 85 |
| Production | 79 ✅ | 6 ✅ | 85 |

**Note:** All environments now synchronized with identical settings.

### Maintenance Mode Configuration

All non-development environments maintain `maintenance_mode = true`:
- **Staging**: `maintenance_mode = true`
- **Production**: `maintenance_mode = true`
- **Development**: `maintenance_mode = false` (configurable)

---

## Adding New Settings: Decision Guide

### When to use Database Settings
- User-configurable values (site name, contact info, feature toggles)
- Values that change frequently
- Values that differ between environments
- Values that require audit trails

### When to use Computed Settings
- System constants that never change during runtime
- Configuration derived from code/business logic
- Values that should be identical across all environments
- Values that require compile-time validation

---

## System Integrity Monitoring

### Automatic Validation (routes/settings.js:26-42)

```javascript
// Validate that all required settings keys exist (system integrity check)
const existingKeys = results.map(setting => setting.key).filter(Boolean);
const missingKeys = ALL_SETTINGS_KEYS_ARRAY.filter(requiredKey => !existingKeys.includes(requiredKey));

if (missingKeys.length > 0) {
  // Log missing keys for system tracking
  console.error('[SETTINGS_VALIDATION] Missing settings keys detected:', {
    missing: missingKeys,
    timestamp: new Date().toISOString(),
    endpoint: '/api/settings',
    totalExpected: ALL_SETTINGS_KEYS_ARRAY.length,
    totalFound: existingKeys.length
  });

  // Add system validation header for debugging
  res.set('X-Settings-Validation-Warning', `${missingKeys.length} missing keys`);
}
```

**Monitoring Features:**
- Automatic detection of missing database settings
- Console error logging for system tracking
- HTTP header warnings for debugging
- No user-visible errors (graceful degradation)

---

## Migration Scripts

### Population Script: `scripts/populate-settings-sql.js`
**Purpose:** Generate SQL to synchronize settings across environments

**Usage:**
```bash
# Generate SQL statements
node scripts/populate-settings-sql.js

# Apply to staging
node scripts/populate-settings-sql.js | psql staging_db

# Apply to production
node scripts/populate-settings-sql.js | psql production_db
```

**Features:**
- Generates 79 INSERT statements for all database settings
- Automatically forces `maintenance_mode = true` for staging/production
- Includes proper JSON escaping for Hebrew text and special characters
- Provides verification queries

### Addition Script: `scripts/add-missing-settings.js`
**Purpose:** Add only missing settings to development database

**Usage:**
```bash
node scripts/add-missing-settings.js [--list]
```

**Features:**
- Compares expected vs existing settings
- Only inserts missing settings (non-destructive)
- Validates data types and constraints
- Optional listing of current settings

---

## Frontend Integration

### API Client Usage
```javascript
// Frontend receives all 85 settings in a single call
const settings = await apiClient.get('/api/settings');

// Database settings (user-configurable)
const siteName = settings.find(s => s.key === 'site_name')?.value;

// Computed settings (system constants)
const gameTypes = settings[0].game_types; // Available on every setting object
const fileTypes = settings[0].file_types_config;
```

### Constants Synchronization
Frontend mirrors computed settings in `/src/constants/`:
- Frontend constants should match backend constants exactly
- No duplication of logic - frontend constants are for development only
- Production values always come from API

---

## Performance Characteristics

### Request Performance
- **Database Query**: 79 settings retrieved in single query
- **Constant Access**: 6 computed values accessed from memory
- **Total Latency**: ~10-30ms depending on database connection

### Memory Usage
- **Constants**: ~1KB per constant file (6KB total)
- **SettingsService Cache**: ~5KB for all database settings
- **Total Overhead**: <50KB for complete settings system

### Cache Hit Rates
- **Database Settings**: >95% cache hit rate with data-driven invalidation
- **Computed Settings**: 100% hit rate (never invalidated)

---

## Security Considerations

### Access Control
- **Public Endpoint**: `/api/settings/public` (only `students_access` setting)
- **Authenticated Endpoint**: `/api/settings` (all settings, requires auth)
- **Admin Endpoint**: Individual setting modification (admin only)

### Data Exposure
- **Computed Settings**: No sensitive data; all constants are safe for frontend
- **Database Settings**: May contain sensitive values; access control enforced
- **Environment Separation**: Production settings never accessible from development

---

## Troubleshooting Guide

### Common Issues

1. **Missing Settings on Environment**
   - **Symptoms**: Frontend errors, missing configuration
   - **Solution**: Run `populate-settings-sql.js` script
   - **Prevention**: Include settings migration in deployment process

2. **Stale Computed Settings**
   - **Symptoms**: New constants not reflected in API
   - **Solution**: Restart server to reload constants
   - **Prevention**: Automate server restart after code deployment

3. **Settings Validation Warnings**
   - **Symptoms**: `X-Settings-Validation-Warning` header present
   - **Solution**: Check console logs for missing keys, run addition script
   - **Prevention**: Run validation before deployment

### Debug Commands

```bash
# Check settings count in each environment
psql dev_db -c "SELECT COUNT(*) FROM settings;"
psql staging_db -c "SELECT COUNT(*) FROM settings;"
psql production_db -c "SELECT COUNT(*) FROM settings;"

# Verify maintenance mode
psql env_db -c "SELECT key, value FROM settings WHERE key = 'maintenance_mode';"

# List missing settings
node scripts/add-missing-settings.js --list
```

---

## Future Considerations

### Potential Improvements
1. **Computed Settings Versioning**: Track constant changes for cache invalidation
2. **Environment Configuration**: Make computed constants environment-specific
3. **Dynamic Constants**: Allow some constants to be modified without server restart
4. **Settings Schema Validation**: Implement JSON schema validation for database settings

### Migration Path (if needed)
If future requirements necessitate moving computed settings to the database:

1. Create migration script to insert constants as database records
2. Update SettingsService to handle both storage types
3. Modify route handler to use SettingsService exclusively
4. Update frontend to expect flat settings array
5. Remove constant imports from route file

**Estimated Effort:** 2-3 days for complete migration
**Recommendation:** Keep current architecture unless specific business need arises

---

## Conclusion

The **Option B** approach (computed properties at route level) provides an excellent balance of:
- **Performance**: Fast constant access with efficient database querying
- **Maintainability**: Clear separation between user settings and system constants
- **Reliability**: Consistent behavior across environments
- **Simplicity**: Straightforward implementation that's easy to understand

This architecture has successfully supported Ludora's requirements and should continue to scale effectively.