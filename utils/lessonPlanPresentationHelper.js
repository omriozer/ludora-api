import models from '../models/index.js';
import { error } from '../lib/errorLogger.js';

/**
 * Helper functions for lesson plan presentation handling
 */

/**
 * Get lesson plan presentation files in the correct order
 * @param {string} lessonPlanId - Lesson plan ID
 * @returns {Promise<Object>} Object containing opening and body files
 */
export async function getLessonPlanPresentationFiles(lessonPlanId) {
  try {
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    if (!lessonPlan) {
      throw new Error(`Lesson plan ${lessonPlanId} not found`);
    }

    if (!lessonPlan.file_configs || !lessonPlan.file_configs.files) {
      return {
        opening: [],
        body: [],
        totalSlides: 0,
        hasPresentation: false
      };
    }

    const files = lessonPlan.file_configs.files;
    const openingFiles = files.filter(f => f.file_role === 'opening');
    const bodyFiles = files.filter(f => f.file_role === 'body');

    // Get File entities for opening and body files
    const openingFileIds = openingFiles.map(f => f.file_id);
    const bodyFileIds = bodyFiles.map(f => f.file_id);

    const [openingEntities, bodyEntities] = await Promise.all([
      openingFileIds.length > 0 ? models.File.findAll({ where: { id: openingFileIds } }) : [],
      bodyFileIds.length > 0 ? models.File.findAll({ where: { id: bodyFileIds } }) : []
    ]);

    // Combine config data with entity data
    const enrichedOpeningFiles = openingFiles.map(configFile => {
      const entity = openingEntities.find(e => e.id === configFile.file_id);
      return {
        ...configFile,
        entity: entity ? entity.toJSON() : null
      };
    }).filter(f => f.entity); // Only include files that exist

    const enrichedBodyFiles = bodyFiles.map(configFile => {
      const entity = bodyEntities.find(e => e.id === configFile.file_id);
      return {
        ...configFile,
        entity: entity ? entity.toJSON() : null
      };
    }).filter(f => f.entity); // Only include files that exist

    // Calculate total slides
    const totalSlides = [...enrichedOpeningFiles, ...enrichedBodyFiles]
      .reduce((total, file) => total + (file.slide_count || 0), 0);

    const hasPresentation = enrichedOpeningFiles.length > 0 || enrichedBodyFiles.length > 0;

    return {
      opening: enrichedOpeningFiles,
      body: enrichedBodyFiles,
      totalSlides,
      hasPresentation,
      lessonPlan: lessonPlan.toJSON()
    };

  } catch (error) {
    error.api('Error getting lesson plan presentation files:', error);
    throw error;
  }
}

/**
 * Check if user has access to lesson plan
 * @param {string} userId - User ID
 * @param {string} lessonPlanId - Lesson plan ID
 * @returns {Promise<boolean>} Whether user has access
 */
export async function checkLessonPlanAccess(userId, lessonPlanId) {
  try {
    // Find the lesson plan
    const lessonPlan = await models.LessonPlan.findByPk(lessonPlanId);
    if (!lessonPlan) {
      return false;
    }

    // Check if there's a purchase for this lesson plan
    const purchase = await models.Purchase.findOne({
      where: {
        buyer_user_id: userId,
        purchasable_type: 'lesson_plan',
        purchasable_id: lessonPlanId,
        payment_status: 'completed'
      }
    });

    return !!purchase;

  } catch (error) {
    error.api('Error checking lesson plan access:', error);
    return false;
  }
}

/**
 * Get ordered presentation file URLs for streaming
 * @param {Object} presentationFiles - Result from getLessonPlanPresentationFiles
 * @returns {Array} Array of file URLs in presentation order
 */
export function getOrderedPresentationUrls(presentationFiles) {
  const urls = [];

  // Add opening files first
  presentationFiles.opening.forEach(file => {
    if (file.entity) {
      // Construct file URL using the assets service (no /api prefix needed)
      const fileUrl = `/assets/download/file/${file.entity.id}`;
      urls.push({
        url: fileUrl,
        filename: file.filename,
        fileType: file.file_type,
        slideCount: file.slide_count || 0,
        role: 'opening'
      });
    }
  });

  // Add body files after opening
  presentationFiles.body.forEach(file => {
    if (file.entity) {
      // Construct file URL using the assets service (no /api prefix needed)
      const fileUrl = `/assets/download/file/${file.entity.id}`;
      urls.push({
        url: fileUrl,
        filename: file.filename,
        fileType: file.file_type,
        slideCount: file.slide_count || 0,
        role: 'body'
      });
    }
  });

  return urls;
}