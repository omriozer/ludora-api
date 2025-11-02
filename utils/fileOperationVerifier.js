/**
 * File Operation Verifier
 *
 * Integrates existing cleanup verification utilities into file operations
 * for proactive consistency checks and data integrity validation.
 */

import { validateS3Files, getFileDetails } from '../scripts/utils/s3FileAnalyzer.js';
import { collectAllFileReferences } from '../scripts/utils/databaseReferenceCollector.js';
import fileService from '../services/FileService.js';
import { constructS3Path } from './s3PathUtils.js';

/**
 * File Operation Verifier Class
 */
class FileOperationVerifier {
  constructor(environment = null) {
    this.environment = environment || process.env.ENVIRONMENT || 'development';
    this.s3Client = fileService.s3Client; // Use existing S3 client from FileService
    this.bucketName = process.env.AWS_S3_BUCKET;
  }

  /**
   * Verify file upload completed successfully
   * @param {string} s3Key - S3 key of uploaded file
   * @param {Object} expectedMetadata - Expected file metadata
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Verification result
   */
  async verifyUpload(s3Key, expectedMetadata, logger) {
    logger?.info('Starting post-upload verification', { s3Key });

    try {
      // Check if file exists in S3
      const fileDetails = await getFileDetails(this.s3Client, this.bucketName, s3Key);

      if (!fileDetails.success) {
        return {
          success: false,
          error: 'File not found in S3 after upload',
          details: fileDetails.error,
          s3Key
        };
      }

      // Verify file size matches
      if (expectedMetadata.size && fileDetails.size !== expectedMetadata.size) {
        return {
          success: false,
          error: 'File size mismatch',
          details: {
            expected: expectedMetadata.size,
            actual: fileDetails.size,
            difference: Math.abs(fileDetails.size - expectedMetadata.size)
          },
          s3Key
        };
      }

      // Verify content type if provided
      if (expectedMetadata.contentType && fileDetails.contentType !== expectedMetadata.contentType) {
        logger?.warn('Content type mismatch detected', {
          expected: expectedMetadata.contentType,
          actual: fileDetails.contentType
        });
      }

      logger?.info('Upload verification successful', {
        s3Key,
        size: fileDetails.sizeFormatted,
        contentType: fileDetails.contentType
      });

      return {
        success: true,
        fileDetails,
        s3Key,
        verified: {
          existence: true,
          size: expectedMetadata.size ? fileDetails.size === expectedMetadata.size : true,
          contentType: expectedMetadata.contentType ? fileDetails.contentType === expectedMetadata.contentType : true
        }
      };

    } catch (error) {
      logger?.error(error, { stage: 'upload_verification', s3Key });
      return {
        success: false,
        error: 'Verification failed',
        details: error.message,
        s3Key
      };
    }
  }

  /**
   * Verify file deletion was successful and check for dangling references
   * @param {string} s3Key - S3 key of deleted file
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Verification result
   */
  async verifyDeletion(s3Key, logger) {
    logger?.info('Starting post-deletion verification', { s3Key });

    try {
      // Check if file still exists in S3 (should not)
      const fileDetails = await getFileDetails(this.s3Client, this.bucketName, s3Key);

      if (fileDetails.success) {
        return {
          success: false,
          error: 'File still exists in S3 after deletion',
          s3Key,
          fileDetails
        };
      }

      // Check for dangling database references
      const allDbReferences = await collectAllFileReferences(this.environment);
      const hasDanglingReference = allDbReferences.includes(s3Key);

      if (hasDanglingReference) {
        logger?.warn('Dangling database reference detected after deletion', { s3Key });
        return {
          success: false,
          error: 'Dangling database reference found',
          s3Key,
          warning: 'File deleted from S3 but database still references it'
        };
      }

      logger?.info('Deletion verification successful', { s3Key });

      return {
        success: true,
        s3Key,
        verified: {
          s3Deleted: true,
          noDanglingReferences: true
        }
      };

    } catch (error) {
      logger?.error(error, { stage: 'deletion_verification', s3Key });
      return {
        success: false,
        error: 'Verification failed',
        details: error.message,
        s3Key
      };
    }
  }

  /**
   * Check if file has multiple database references before deletion
   * @param {string} s3Key - S3 key to check
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Pre-deletion check result
   */
  async checkPreDeletion(s3Key, logger) {
    logger?.info('Starting pre-deletion checks', { s3Key });

    try {
      // Collect all database references
      const allDbReferences = await collectAllFileReferences(this.environment);

      // Count how many times this file is referenced
      const referenceCount = allDbReferences.filter(ref => ref === s3Key).length;

      // Check if file exists in S3
      const fileExists = await getFileDetails(this.s3Client, this.bucketName, s3Key);

      const result = {
        success: true,
        s3Key,
        checks: {
          fileExists: fileExists.success,
          referenceCount,
          safeToDelete: referenceCount <= 1 && fileExists.success
        }
      };

      if (!fileExists.success) {
        logger?.warn('File does not exist in S3', { s3Key });
        result.warnings = ['File does not exist in S3'];
      }

      if (referenceCount > 1) {
        logger?.warn('Multiple database references found', { s3Key, referenceCount });
        result.warnings = result.warnings || [];
        result.warnings.push(`File has ${referenceCount} database references`);
        result.checks.safeToDelete = false;
      }

      if (referenceCount === 0) {
        logger?.warn('No database references found', { s3Key });
        result.warnings = result.warnings || [];
        result.warnings.push('File has no database references (already orphaned)');
      }

      logger?.info('Pre-deletion checks completed', {
        s3Key,
        ...result.checks
      });

      return result;

    } catch (error) {
      logger?.error(error, { stage: 'pre_deletion_check', s3Key });
      return {
        success: false,
        error: 'Pre-deletion check failed',
        details: error.message,
        s3Key
      };
    }
  }

  /**
   * Perform comprehensive consistency check for a file operation
   * @param {string} operation - Operation type (upload, delete, etc.)
   * @param {string} s3Key - S3 key to verify
   * @param {Object} context - Operation context
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Consistency check result
   */
  async performConsistencyCheck(operation, s3Key, context, logger) {
    logger?.info('Starting consistency check', { operation, s3Key });

    try {
      const results = {
        success: true,
        operation,
        s3Key,
        context,
        checks: {}
      };

      // Check S3 file existence and metadata
      const s3Check = await getFileDetails(this.s3Client, this.bucketName, s3Key);
      results.checks.s3Existence = {
        exists: s3Check.success,
        details: s3Check.success ? {
          size: s3Check.size,
          sizeFormatted: s3Check.sizeFormatted,
          lastModified: s3Check.lastModified,
          contentType: s3Check.contentType
        } : { error: s3Check.error }
      };

      // Check database references
      const allDbReferences = await collectAllFileReferences(this.environment);
      const dbReferences = allDbReferences.filter(ref => ref === s3Key);
      results.checks.databaseReferences = {
        count: dbReferences.length,
        exists: dbReferences.length > 0,
        references: dbReferences.slice(0, 5) // Limit to first 5 for logging
      };

      // Consistency analysis
      const isConsistent = (s3Check.success && dbReferences.length > 0) ||
                           (!s3Check.success && dbReferences.length === 0);

      results.checks.consistency = {
        isConsistent,
        analysis: isConsistent
          ? 'S3 and database are in sync'
          : s3Check.success && dbReferences.length === 0
            ? 'File exists in S3 but has no database references (orphaned)'
            : !s3Check.success && dbReferences.length > 0
              ? 'Database references exist but file not found in S3 (dangling)'
              : 'Unknown consistency state'
      };

      if (!isConsistent) {
        results.success = false;
        logger?.warn('Consistency check failed', {
          s3Key,
          s3Exists: s3Check.success,
          dbReferenceCount: dbReferences.length
        });
      } else {
        logger?.info('Consistency check passed', {
          s3Key,
          analysis: results.checks.consistency.analysis
        });
      }

      return results;

    } catch (error) {
      logger?.error(error, { stage: 'consistency_check', operation, s3Key });
      return {
        success: false,
        error: 'Consistency check failed',
        details: error.message,
        operation,
        s3Key
      };
    }
  }

  /**
   * Validate multiple S3 files exist (batch verification)
   * @param {Array} s3Keys - Array of S3 keys to validate
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Batch validation result
   */
  async validateMultipleFiles(s3Keys, logger) {
    logger?.info('Starting batch file validation', { count: s3Keys.length });

    try {
      const validationResult = await validateS3Files(this.s3Client, this.bucketName, s3Keys);

      logger?.info('Batch validation completed', {
        total: validationResult.total,
        existing: validationResult.existing,
        missing: validationResult.missing,
        errors: validationResult.errors
      });

      return {
        success: validationResult.success,
        total: validationResult.total,
        existing: validationResult.existing,
        missing: validationResult.missing,
        errors: validationResult.errors,
        missingFiles: validationResult.missingFiles,
        errorFiles: validationResult.errorFiles,
        validationRate: validationResult.total > 0
          ? ((validationResult.existing / validationResult.total) * 100).toFixed(1) + '%'
          : '0%'
      };

    } catch (error) {
      logger?.error(error, { stage: 'batch_validation', fileCount: s3Keys.length });
      return {
        success: false,
        error: 'Batch validation failed',
        details: error.message,
        total: s3Keys.length
      };
    }
  }

  /**
   * Quick health check for file operation system
   * @param {Object} logger - File operation logger
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck(logger) {
    logger?.info('Starting file operation system health check');

    try {
      const results = {
        success: true,
        environment: this.environment,
        timestamp: new Date().toISOString(),
        checks: {}
      };

      // Test S3 connectivity
      try {
        await this.s3Client.headBucket({ Bucket: this.bucketName }).promise();
        results.checks.s3Connectivity = { status: 'healthy', bucket: this.bucketName };
      } catch (error) {
        results.checks.s3Connectivity = { status: 'unhealthy', error: error.message };
        results.success = false;
      }

      // Test database connectivity (quick query)
      try {
        const dbRefs = await collectAllFileReferences(this.environment);
        results.checks.databaseConnectivity = {
          status: 'healthy',
          totalReferences: dbRefs.length
        };
      } catch (error) {
        results.checks.databaseConnectivity = { status: 'unhealthy', error: error.message };
        results.success = false;
      }

      logger?.info('Health check completed', {
        overall: results.success ? 'healthy' : 'unhealthy',
        s3: results.checks.s3Connectivity.status,
        database: results.checks.databaseConnectivity.status
      });

      return results;

    } catch (error) {
      logger?.error(error, { stage: 'health_check' });
      return {
        success: false,
        error: 'Health check failed',
        details: error.message,
        environment: this.environment
      };
    }
  }
}

/**
 * Factory function to create file operation verifier
 * @param {string} environment - Environment name
 * @returns {FileOperationVerifier} Verifier instance
 */
export function createFileVerifier(environment = null) {
  return new FileOperationVerifier(environment);
}

/**
 * Quick verification helper for single file
 * @param {string} s3Key - S3 key to verify
 * @param {string} operation - Operation type
 * @param {Object} logger - File operation logger
 * @returns {Promise<Object>} Verification result
 */
export async function quickVerify(s3Key, operation, logger) {
  const verifier = createFileVerifier();

  switch (operation) {
    case 'upload':
      return await verifier.verifyUpload(s3Key, {}, logger);
    case 'delete':
      return await verifier.verifyDeletion(s3Key, logger);
    case 'consistency':
      return await verifier.performConsistencyCheck(operation, s3Key, {}, logger);
    default:
      return {
        success: false,
        error: 'Unknown operation type',
        operation,
        s3Key
      };
  }
}

export default FileOperationVerifier;