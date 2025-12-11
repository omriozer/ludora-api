/**
 * Deprecation Warning Utility
 *
 * Centralized system for issuing deprecation warnings for file reference patterns
 * identified in the File Reference Audit. Provides consistent warning format and
 * can be disabled in production environments.
 *
 * This utility addresses Phase 2 requirement: "Add deprecation warnings for magic values"
 */

import { isProd } from '../src/utils/environment.js';

class DeprecationWarnings {
  static isEnabled = !isProd() || process.env.SHOW_DEPRECATION_WARNINGS === 'true';

  /**
   * Issue a deprecation warning for the "HAS_IMAGE" magic value
   */
  static warnHasImageUsage(context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: "HAS_IMAGE" Magic Value Detected
────────────────────────────────────────────────────────
Issue: Using magic string "HAS_IMAGE" in image_url field
Context: ${JSON.stringify(context, null, 2)}

Migration Path:
  DEPRECATED: product.image_url = 'HAS_IMAGE'

  RECOMMENDED:
    product.has_image = true
    product.image_filename = 'image.jpg'

Reference: File Reference Audit Issue #3
Migration: 20251030000001-standardize-product-image-references.cjs
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a deprecation warning for conflicting video field usage
   */
  static warnVideoFieldConflict(entityType, context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: Conflicting Video Fields Detected
────────────────────────────────────────────────────────
Issue: Multiple video reference fields found on ${entityType} entity
Context: ${JSON.stringify(context, null, 2)}

Migration Path:
  DEPRECATED:
    entity.video_file_url = "..."
    entity.recording_url = "..."

  RECOMMENDED:
    entity.has_video = true
    entity.video_filename = 'video.mp4'

Reference: File Reference Audit Issue #1
Status: Migration pending for ${entityType} entities
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a deprecation warning for direct URL storage patterns
   */
  static warnDirectUrlStorage(entityType, fieldName, context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: Direct URL Storage Pattern
────────────────────────────────────────────────────────
Issue: Storing complete URLs instead of predictable paths
Entity: ${entityType}
Field: ${fieldName}
Context: ${JSON.stringify(context, null, 2)}

Migration Path:
  DEPRECATED: entity.${fieldName} = "https://..."

  RECOMMENDED: Use FileReferenceService.getAssetUrl()
    - Store boolean flags or filenames only
    - Generate URLs at runtime via service layer

Reference: File Reference Audit Issue #2
Service: FileReferenceService provides centralized URL generation
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a deprecation warning for footer settings duplication
   */
  static warnFooterSettingsDuplication(context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: Footer Settings Duplication
────────────────────────────────────────────────────────
Issue: Footer configuration stored in multiple entities
Context: ${JSON.stringify(context, null, 2)}

Migration Path:
  DEPRECATED: Separate footer_settings in File and Settings

  RECOMMENDED: Single source of truth with overrides pattern
    - System settings in Settings entity
    - File-specific overrides in File entity
    - Merge logic in FooterSettingsHelper

Reference: File Reference Audit Issue #7
Status: Migration pending for footer settings unification
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a deprecation warning for S3 path logic duplication
   */
  static warnS3PathDuplication(location, context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: S3 Path Logic Duplication
────────────────────────────────────────────────────────
Issue: S3 path construction logic duplicated in ${location}
Context: ${JSON.stringify(context, null, 2)}

Migration Path:
  DEPRECATED: Manual S3 path construction in frontend/backend

  RECOMMENDED: Use centralized utilities
    - Backend: FileReferenceService.getS3Key()
    - Frontend: API calls for URL generation
    - Utilities: s3PathUtils.constructS3Path()

Reference: File Reference Audit Issue #4
Service: FileReferenceService centralizes all path logic
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a deprecation warning for direct usage of deprecated fields
   */
  static warnDirectUsage(entityType, fieldName, context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: Direct Usage of Deprecated Field
────────────────────────────────────────────────────────
Issue: Direct access to deprecated field ${fieldName} on ${entityType}
Field: ${entityType}.${fieldName}
Context: ${JSON.stringify(context, null, 2)}

Migration Message: ${context.message || 'Field has been deprecated, use recommended alternative'}

Reference: File Reference Standardization Project
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Issue a general deprecation warning with custom message
   */
  static warnCustom(title, issue, migrationPath, reference, context = {}) {
    if (!this.isEnabled) return;

    console.warn(`
🚨 DEPRECATION WARNING: ${title}
────────────────────────────────────────────────────────
Issue: ${issue}
Context: ${JSON.stringify(context, null, 2)}

Migration Path: ${migrationPath}

Reference: ${reference}
────────────────────────────────────────────────────────
    `);
  }

  /**
   * Enable or disable deprecation warnings
   */
  static setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Get current enabled status
   */
  static getEnabled() {
    return this.isEnabled;
  }
}

export default DeprecationWarnings;