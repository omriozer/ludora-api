/**
 * Database Reference Collector
 * Collects all file references from the database across all models
 * Enhanced to work with unified FileReferenceService and standardized fields
 */

import models from '../../models/index.js';
import EntityService from '../../services/EntityService.js';
import { constructS3Path } from '../../utils/s3PathUtils.js';
import FileReferenceService from '../../services/FileReferenceService.js';

const { sequelize } = models;

/**
 * Collect file references using the unified FileReferenceService
 * This handles standardized fields and asset types consistently
 * @param {string} environment - Environment name
 * @returns {Promise<Array>} Array of S3 keys from standardized file references
 */
async function collectUnifiedFileReferences(environment) {
  console.log('🔧 Collecting unified file references using FileReferenceService...');

  const references = [];

  try {
    // Product entities with standardized image fields
    const products = await safeModelQuery(() => models.Product.findAll({
      attributes: ['id', 'product_type', 'has_image', 'image_filename', 'image_url', 'marketing_video_type', 'marketing_video_id'],
      where: {
        [models.Sequelize.Op.or]: [
          { has_image: true },
          { image_url: { [models.Sequelize.Op.and]: [{ [models.Sequelize.Op.ne]: null }, { [models.Sequelize.Op.ne]: '' }] } },
          { marketing_video_type: 'uploaded' }
        ]
      }
    }), 'Product');

    for (const product of products) {
      try {
        // Check for image asset
        if (product.hasImageAsset()) {
          const imageInfo = await FileReferenceService.getAssetInfo(product, product.product_type || 'product', 'image');
          if (imageInfo.s3Key) {
            references.push(imageInfo.s3Key);
          }
        }

        // Check for marketing video asset (uploaded type only)
        if (product.marketing_video_type === 'uploaded' && product.marketing_video_id) {
          const videoInfo = await FileReferenceService.getAssetInfo(product, product.product_type || 'product', 'marketing-video');
          if (videoInfo.s3Key) {
            references.push(videoInfo.s3Key);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not get asset info for product ${product.id}: ${error.message}`);
      }
    }

    // Workshop entities (check if entity_id column exists)
    try {
      const workshopTableInfo = await models.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'workshop' AND column_name = 'entity_id'",
        { type: models.Sequelize.QueryTypes.SELECT }
      );

      if (workshopTableInfo.length > 0) {
        const workshops = await safeModelQuery(() => models.Workshop.findAll({
          attributes: ['id', 'entity_id'],
          where: {
            entity_id: { [models.Sequelize.Op.ne]: null }
          }
        }), 'Workshop');

        for (const workshop of workshops) {
          try {
            // Check all possible workshop assets
            const assetTypes = ['image', 'content-video', 'recording'];
            for (const assetType of assetTypes) {
              const assetInfo = await FileReferenceService.getAssetInfo(workshop, 'workshop', assetType);
              if (assetInfo.s3Key) {
                references.push(assetInfo.s3Key);
              }
            }
          } catch (error) {
            console.warn(`Warning: Could not get asset info for workshop ${workshop.id}: ${error.message}`);
          }
        }
      } else {
        console.log('ℹ️  Workshop table does not have entity_id column, skipping unified workshop references');
      }
    } catch (error) {
      console.warn(`Warning: Could not check workshop schema: ${error.message}`);
    }

    // Course entities (check if entity_id column exists)
    try {
      const courseTableInfo = await models.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'course' AND column_name = 'entity_id'",
        { type: models.Sequelize.QueryTypes.SELECT }
      );

      if (courseTableInfo.length > 0) {
        const courses = await safeModelQuery(() => models.Course.findAll({
          attributes: ['id', 'entity_id'],
          where: {
            entity_id: { [models.Sequelize.Op.ne]: null }
          }
        }), 'Course');

        for (const course of courses) {
          try {
            const assetInfo = await FileReferenceService.getAssetInfo(course, 'course', 'image');
            if (assetInfo.s3Key) {
              references.push(assetInfo.s3Key);
            }
          } catch (error) {
            console.warn(`Warning: Could not get asset info for course ${course.id}: ${error.message}`);
          }
        }
      } else {
        console.log('ℹ️  Course table does not have entity_id column, skipping unified course references');
      }
    } catch (error) {
      console.warn(`Warning: Could not check course schema: ${error.message}`);
    }

    // School entities
    const schools = await safeModelQuery(() => models.School.findAll({
      attributes: ['id'],
    }), 'School');

    for (const school of schools) {
      try {
        const assetInfo = await FileReferenceService.getAssetInfo(school, 'school', 'logo');
        if (assetInfo.s3Key) {
          references.push(assetInfo.s3Key);
        }
      } catch (error) {
        console.warn(`Warning: Could not get asset info for school ${school.id}: ${error.message}`);
      }
    }

    console.log(`✅ Found ${references.length} unified file references`);
    return references;
  } catch (error) {
    console.error('❌ Error collecting unified file references:', error);
    return [];
  }
}

/**
 * Collect all file references from File model using S3 path construction
 * @param {string} environment - Environment name
 * @returns {Promise<Array>} Array of S3 keys
 */
async function collectDirectFileReferences(environment) {
  console.log('📂 Collecting direct file references...');

  try {
    const files = await safeModelQuery(() => models.File.findAll({
      attributes: ['id', 'file_name'],
      where: {
        file_name: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'File');

    const references = [];

    for (const file of files) {
      if (file.file_name && file.file_name.trim() !== '') {
        // Use existing S3 path construction logic
        try {
          const s3Path = constructS3Path({
            env: environment,
            privacy: 'public', // Try both public and private
            assetType: 'general',
            entityType: 'file',
            entityId: file.id,
            filename: file.file_name
          });
          references.push(s3Path);

          // Also try private path
          const privateS3Path = constructS3Path({
            env: environment,
            privacy: 'private',
            assetType: 'general',
            entityType: 'file',
            entityId: file.id,
            filename: file.file_name
          });
          references.push(privateS3Path);
        } catch (error) {
          console.warn(`Warning: Could not construct S3 path for file ${file.id}: ${error.message}`);
        }
      }
    }

    console.log(`✅ Found ${references.length} direct file references`);
    return references;
  } catch (error) {
    console.error('❌ Error collecting direct file references:', error);
    return [];
  }
}

/**
 * Safe model query wrapper to handle missing tables
 * @param {Function} queryFunction - Function that returns a promise
 * @param {string} modelName - Name of the model being queried
 * @returns {Promise<Array>} Results or empty array if table doesn't exist
 */
async function safeModelQuery(queryFunction, modelName) {
  try {
    return await queryFunction();
  } catch (error) {
    if (error.name === 'SequelizeDatabaseError' && error.original?.code === '42P01') {
      console.log(`⚠️  Table ${modelName} doesn't exist in this environment, skipping...`);
      return [];
    }
    throw error;
  }
}

/**
 * Collect file references from URL fields across all models
 * @returns {Promise<Array>} Array of S3 keys extracted from URLs
 */
async function collectUrlFieldReferences() {
  console.log('🔗 Collecting URL field references...');

  const references = [];

  try {
    // AudioFile.file_url
    const audioFiles = await safeModelQuery(() => models.AudioFile.findAll({
      attributes: ['file_url'],
      where: {
        file_url: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'AudioFile');

    for (const audioFile of audioFiles) {
      if (audioFile.file_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(audioFile.file_url);
        if (s3Key) references.push(s3Key);
      }
    }

    // Product.image_url
    const products = await safeModelQuery(() => models.Product.findAll({
      attributes: ['image_url'],
      where: {
        image_url: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'Product');

    for (const product of products) {
      if (product.image_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(product.image_url);
        if (s3Key) references.push(s3Key);
      }
    }

    // Workshop.video_file_url and image_url
    const workshops = await safeModelQuery(() => models.Workshop.findAll({
      attributes: ['video_file_url', 'image_url'],
      where: {
        [models.Sequelize.Op.or]: [
          { video_file_url: { [models.Sequelize.Op.ne]: null } },
          { image_url: { [models.Sequelize.Op.ne]: null } }
        ]
      }
    }), 'Workshop');

    for (const workshop of workshops) {
      if (workshop.video_file_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(workshop.video_file_url);
        if (s3Key) references.push(s3Key);
      }
      if (workshop.image_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(workshop.image_url);
        if (s3Key) references.push(s3Key);
      }
    }

    // Course.image_url
    const courses = await safeModelQuery(() => models.Course.findAll({
      attributes: ['image_url'],
      where: {
        image_url: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'Course');

    for (const course of courses) {
      if (course.image_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(course.image_url);
        if (s3Key) references.push(s3Key);
      }
    }

    // Settings.logo_url (key-value structure)
    const logoUrlConfigs = await safeModelQuery(() => models.Settings.findAll({
      attributes: ['key', 'value'],
      where: {
        key: 'logo_url',
        value: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'Configuration');

    for (const config of logoUrlConfigs) {
      if (config.value) {
        const s3Key = EntityService.extractS3KeyFromUrl(config.value);
        if (s3Key) references.push(s3Key);
      }
    }

    // School.logo_url
    const schools = await safeModelQuery(() => models.School.findAll({
      attributes: ['logo_url'],
      where: {
        logo_url: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'School');

    for (const school of schools) {
      if (school.logo_url) {
        const s3Key = EntityService.extractS3KeyFromUrl(school.logo_url);
        if (s3Key) references.push(s3Key);
      }
    }

    console.log(`✅ Found ${references.length} URL field references`);
    return references;
  } catch (error) {
    console.error('❌ Error collecting URL field references:', error);
    return [];
  }
}

/**
 * Collect file references from JSONB fields
 * @returns {Promise<Array>} Array of S3 keys from JSONB fields
 */
async function collectJsonbReferences() {
  console.log('📋 Collecting JSONB field references...');

  const references = [];

  try {
    // LessonPlan.file_configs
    const lessonPlans = await safeModelQuery(() => models.LessonPlan.findAll({
      attributes: ['file_configs'],
      where: {
        file_configs: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'LessonPlan');

    for (const lessonPlan of lessonPlans) {
      if (lessonPlan.file_configs && lessonPlan.file_configs.files) {
        for (const fileConfig of lessonPlan.file_configs.files) {
          if (fileConfig.file_id) {
            // This is a File ID reference, not a direct S3 key
            // We'll handle this in the polymorphic references section
          }
        }
      }
    }

    // Settings.footer_settings (may contain logo URLs) - key-value structure
    const footerSettingsConfigs = await safeModelQuery(() => models.Settings.findAll({
      attributes: ['key', 'value'],
      where: {
        key: 'footer_settings',
        value: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'Settings');

    for (const config of footerSettingsConfigs) {
      if (config.value && typeof config.value === 'object' && config.value.logo && config.value.logo.url) {
        const s3Key = EntityService.extractS3KeyFromUrl(config.value.logo.url);
        if (s3Key) references.push(s3Key);
      }
    }

    // Game.game_settings (may contain media references)
    const games = await safeModelQuery(() => models.Game.findAll({
      attributes: ['game_settings'],
      where: {
        game_settings: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'Game');

    for (const game of games) {
      if (game.game_settings) {
        // Search for any URL-like strings in the JSON
        const jsonString = JSON.stringify(game.game_settings);
        const urlMatches = jsonString.match(/https?:\/\/[^\s"]+/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            const s3Key = EntityService.extractS3KeyFromUrl(url);
            if (s3Key) references.push(s3Key);
          }
        }
      }
    }

    // EmailTemplate.html_content (embedded URLs)
    const emailTemplates = await safeModelQuery(() => models.EmailTemplate.findAll({
      attributes: ['html_content'],
      where: {
        html_content: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'EmailTemplate');

    for (const template of emailTemplates) {
      if (template.html_content) {
        // Extract URLs from HTML content
        const urlMatches = template.html_content.match(/https?:\/\/[^\s"'<>]+/g);
        if (urlMatches) {
          for (const url of urlMatches) {
            const s3Key = EntityService.extractS3KeyFromUrl(url);
            if (s3Key) references.push(s3Key);
          }
        }
      }
    }

    console.log(`✅ Found ${references.length} JSONB field references`);
    return references;
  } catch (error) {
    console.error('❌ Error collecting JSONB references:', error);
    return [];
  }
}

/**
 * Collect file references through polymorphic relationships
 * @returns {Promise<Array>} Array of S3 keys from polymorphic references
 */
async function collectPolymorphicReferences() {
  console.log('🔗 Collecting polymorphic references...');

  const references = [];

  try {
    // LessonPlan file references through file_configs
    const lessonPlans = await safeModelQuery(() => models.LessonPlan.findAll({
      attributes: ['file_configs'],
      where: {
        file_configs: {
          [models.Sequelize.Op.ne]: null
        }
      }
    }), 'LessonPlan');

    const fileIds = new Set();
    for (const lessonPlan of lessonPlans) {
      if (lessonPlan.file_configs && lessonPlan.file_configs.files) {
        for (const fileConfig of lessonPlan.file_configs.files) {
          if (fileConfig.file_id) {
            fileIds.add(fileConfig.file_id);
          }
        }
      }
    }

    // Get actual File records for these IDs
    if (fileIds.size > 0) {
      const files = await safeModelQuery(() => models.File.findAll({
        attributes: ['id', 'file_name'],
        where: {
          id: {
            [models.Sequelize.Op.in]: Array.from(fileIds)
          }
        }
      }), 'File');

      // Convert to S3 paths (this duplicates some logic from collectDirectFileReferences)
      for (const file of files) {
        if (file.file_name) {
          // We can't determine environment here, so we'll mark these for later processing
          references.push(`POLYMORPHIC_FILE:${file.id}:${file.file_name}`);
        }
      }
    }

    console.log(`✅ Found ${references.length} polymorphic references`);
    return references;
  } catch (error) {
    console.error('❌ Error collecting polymorphic references:', error);
    return [];
  }
}

/**
 * Process polymorphic file references for a specific environment
 * @param {Array} polymorphicRefs - Array of polymorphic reference strings
 * @param {string} environment - Environment name
 * @returns {Array} Array of resolved S3 keys
 */
function resolvePolymorphicReferences(polymorphicRefs, environment) {
  const resolved = [];

  for (const ref of polymorphicRefs) {
    if (ref.startsWith('POLYMORPHIC_FILE:')) {
      const [, fileId, fileName] = ref.split(':');

      try {
        // Try both public and private paths
        const publicPath = constructS3Path({
          env: environment,
          privacy: 'public',
          assetType: 'general',
          entityType: 'file',
          entityId: fileId,
          filename: fileName
        });
        resolved.push(publicPath);

        const privatePath = constructS3Path({
          env: environment,
          privacy: 'private',
          assetType: 'general',
          entityType: 'file',
          entityId: fileId,
          filename: fileName
        });
        resolved.push(privatePath);
      } catch (error) {
        console.warn(`Warning: Could not resolve polymorphic reference ${ref}: ${error.message}`);
      }
    }
  }

  return resolved;
}

/**
 * Main function to collect all file references from database
 * Enhanced to include unified FileReferenceService approach
 * @param {string} environment - Environment name (development, staging, production)
 * @returns {Promise<Array>} Array of all S3 keys referenced in database
 */
async function collectAllFileReferences(environment) {
  console.log(`🔍 Collecting all file references for environment: ${environment}`);

  try {
    const [
      unifiedRefs,
      directRefs,
      urlRefs,
      jsonbRefs,
      polymorphicRefs
    ] = await Promise.all([
      collectUnifiedFileReferences(environment),
      collectDirectFileReferences(environment),
      collectUrlFieldReferences(),
      collectJsonbReferences(),
      collectPolymorphicReferences()
    ]);

    // Resolve polymorphic references for the specific environment
    const resolvedPolymorphicRefs = resolvePolymorphicReferences(polymorphicRefs, environment);

    // Combine all references and remove duplicates
    const allReferences = [
      ...unifiedRefs,
      ...directRefs,
      ...urlRefs,
      ...jsonbRefs,
      ...resolvedPolymorphicRefs
    ];

    const uniqueReferences = [...new Set(allReferences)].filter(ref => ref && !ref.startsWith('POLYMORPHIC_FILE:'));

    console.log(`✅ Total unique file references found: ${uniqueReferences.length}`);
    console.log(`   - Unified references: ${unifiedRefs.length}`);
    console.log(`   - Direct files: ${directRefs.length}`);
    console.log(`   - URL fields: ${urlRefs.length}`);
    console.log(`   - JSONB fields: ${jsonbRefs.length}`);
    console.log(`   - Polymorphic: ${resolvedPolymorphicRefs.length}`);

    return uniqueReferences;
  } catch (error) {
    console.error('❌ Error collecting file references:', error);
    return [];
  }
}

export {
  collectUnifiedFileReferences,
  collectDirectFileReferences,
  collectUrlFieldReferences,
  collectJsonbReferences,
  collectPolymorphicReferences,
  resolvePolymorphicReferences,
  collectAllFileReferences
};