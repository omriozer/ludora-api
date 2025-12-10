import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { STUDY_SUBJECTS } from '../constants/info.js';

/**
 * CurriculumLinkingService - Automatic curriculum linking based on product metadata
 *
 * This service provides intelligent matching between products (files, games, lesson_plans)
 * and curriculum items based on grade ranges and subjects already stored in product data.
 */
class CurriculumLinkingService {

  /**
   * Find matching curriculum items for a product based on its grade and subject metadata
   * @param {string} productId - The product to find matches for
   * @returns {Object} Categorized matches with confidence scores
   */
  static async findMatchingCurricula(productId) {
    try {
      ludlog.api(`Finding curriculum matches for product: ${productId}`);

      // Get product with grade/subject metadata
      const product = await models.Product.findByPk(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      // Extract grade and subject data from type_attributes
      const { grade_min, grade_max, subject } = product.type_attributes || {};

      ludlog.api('Product metadata for matching:', {
        productId,
        productType: product.product_type,
        gradeMin: grade_min,
        gradeMax: grade_max,
        subject
      });

      // Handle bundles by aggregating data from bundle items
      let matchingGradeRanges = [];
      let matchingSubjects = [];

      if (product.type_attributes?.is_bundle) {
        const bundleData = await this.getBundleGradeSubjectData(product);
        matchingGradeRanges = bundleData.gradeRanges;
        matchingSubjects = bundleData.subjects;
      } else {
        // Single product - use direct grade/subject data
        if (grade_min !== undefined && grade_max !== undefined && grade_min !== null && grade_max !== null) {
          matchingGradeRanges.push({ min: grade_min, max: grade_max });
        }
        if (subject && subject.trim()) {
          matchingSubjects.push(subject.trim());
        }
      }

      // If no grade ranges found, provide manual browsing options instead of empty results
      if (matchingGradeRanges.length === 0) {
        ludlog.api('No grade ranges found for product, providing manual browsing options', {
          productId,
          productType: product.product_type,
          typeAttributes: product.type_attributes
        });

        // Get existing links even for products without metadata
        const existingLinks = await this.getExistingLinks(productId);

        // Provide browsing metadata for manual selection
        const availableSubjects = await this.getAvailableSubjects();
        const availableGrades = await this.getAvailableGradeRanges();

        return {
          product,
          gradeRanges: [],
          subjects: [],
          existingLinks,
          matches: { perfect: [], good: [], partial: [], suggestions: [] },
          // New: Manual browsing options
          manualBrowsing: {
            enabled: true,
            availableSubjects,
            availableGrades,
            message: 'No automatic matches found. Use manual browsing to select curriculum items.'
          }
        };
      }

      // Find all curriculum items that could match
      const allMatches = await this.findCurriculaByGradesAndSubjects(
        matchingGradeRanges,
        matchingSubjects
      );

      // Get existing links to exclude from suggestions
      const existingLinks = await this.getExistingLinks(productId);
      const existingCurriculumItemIds = existingLinks.map(link => link.curriculum_item_id);

      // Filter out already linked curricula
      const availableMatches = allMatches.filter(
        match => !existingCurriculumItemIds.includes(match.curriculumItem.id)
      );

      // Categorize and score matches
      const categorizedMatches = this.categorizeMatches(
        availableMatches,
        matchingGradeRanges,
        matchingSubjects
      );

      ludlog.api('Curriculum matching results:', {
        productId,
        totalMatches: allMatches.length,
        availableMatches: availableMatches.length,
        existingLinks: existingLinks.length
      });

      return {
        product,
        gradeRanges: matchingGradeRanges,
        subjects: matchingSubjects,
        existingLinks,
        matches: categorizedMatches
      };

    } catch (error) {
      luderror.api('Error finding curriculum matches:', error);
      throw error;
    }
  }

  /**
   * Aggregate grade and subject data from bundle items
   * @param {Object} bundleProduct - Bundle product with bundle_items in type_attributes
   * @returns {Object} Aggregated grade ranges and subjects
   */
  static async getBundleGradeSubjectData(bundleProduct) {
    try {
      const bundleItems = bundleProduct.type_attributes?.bundle_items || [];

      // Get all products in the bundle
      const productIds = bundleItems.map(item => item.product_id);
      const products = await models.Product.findAll({
        where: { id: productIds }
      });

      const gradeRanges = [];
      const subjects = new Set();

      // Aggregate grade ranges and subjects from all bundle items
      for (const product of products) {
        const { grade_min, grade_max, subject } = product.type_attributes || {};

        if (grade_min && grade_max) {
          gradeRanges.push({ min: grade_min, max: grade_max });
        }

        if (subject) {
          subjects.add(subject);
        }
      }

      return {
        gradeRanges,
        subjects: Array.from(subjects)
      };

    } catch (error) {
      luderror.api('Error aggregating bundle grade/subject data:', error);
      return { gradeRanges: [], subjects: [] };
    }
  }

  /**
   * Find curricula that match given grade ranges and subjects
   * @param {Array} gradeRanges - Array of {min, max} grade ranges
   * @param {Array} subjects - Array of subject strings
   * @returns {Array} Matching curriculum items with metadata
   */
  static async findCurriculaByGradesAndSubjects(gradeRanges, subjects) {
    try {
      const allMatches = [];

      // For each grade range and subject combination, find matching curricula
      for (const gradeRange of gradeRanges) {

        // Find curricula with overlapping grade ranges
        for (const subject of subjects) {
          const matches = await this.findOverlappingCurricula(gradeRange, subject);
          allMatches.push(...matches);
        }

        // Also find general curricula (no specific subject)
        const generalMatches = await this.findOverlappingCurricula(gradeRange, null);
        allMatches.push(...generalMatches);
      }

      // Remove duplicates based on curriculum_item_id
      const uniqueMatches = allMatches.filter((match, index, self) =>
        index === self.findIndex(m => m.curriculumItem.id === match.curriculumItem.id)
      );

      return uniqueMatches;

    } catch (error) {
      luderror.api('Error finding curricula by grades and subjects:', error);
      return [];
    }
  }

  /**
   * Find curricula with overlapping grade ranges for a specific subject
   * @param {Object} gradeRange - {min, max} grade range
   * @param {string|null} subject - Subject string or null for general curricula
   * @returns {Array} Matching curricula with metadata
   */
  static async findOverlappingCurricula(gradeRange, subject) {
    try {
      let curricula = [];

      if (subject) {
        // Search for curricula with specific subject
        curricula = await models.Curriculum.findOverlappingGradeRange(
          gradeRange.min,
          gradeRange.max,
          subject
        );
      } else {
        // Search for all active curricula within the grade range (general curricula)
        const { Op } = models.sequelize.Sequelize;

        curricula = await models.Curriculum.findAll({
          where: {
            teacher_user_id: null,
            class_id: null,
            is_active: true,
            [Op.or]: [
              // Legacy single grade curricula within range
              {
                grade: { [Op.between]: [gradeRange.min, gradeRange.max] },
                is_grade_range: false
              },
              // Range curricula that overlap with the specified range
              {
                [Op.and]: [
                  { grade_from: { [Op.lte]: gradeRange.max } },
                  { grade_to: { [Op.gte]: gradeRange.min } }
                ],
                is_grade_range: true
              }
            ]
          }
        });
      }

      const matches = [];

      for (const curriculum of curricula) {
        // Get curriculum items for this curriculum
        const curriculumItems = await models.CurriculumItem.findAll({
          where: { curriculum_id: curriculum.id },
          include: [
            {
              model: models.Product,
              as: 'products',
              through: { attributes: [] }, // Don't include junction table data
              required: false // Include curriculum items even if no products linked
            }
          ]
        });

        // Add each curriculum item as a potential match
        for (const curriculumItem of curriculumItems) {
          matches.push({
            curriculum,
            curriculumItem,
            matchType: this.determineMatchType(gradeRange, subject, curriculum),
            gradeOverlap: this.calculateGradeOverlap(gradeRange, curriculum.getGradeRange()),
            subjectMatch: this.compareSubjects(subject, curriculum.subject)
          });
        }
      }

      return matches;

    } catch (error) {
      luderror.api('Error finding overlapping curricula:', error);
      return [];
    }
  }

  /**
   * Determine the type of match between product and curriculum
   * @param {Object} productGradeRange - Product grade range
   * @param {string|null} productSubject - Product subject
   * @param {Object} curriculum - Curriculum model instance
   * @returns {string} Match type
   */
  static determineMatchType(productGradeRange, productSubject, curriculum) {
    const curriculumGradeRange = curriculum.getGradeRange();
    const gradeOverlap = this.calculateGradeOverlap(productGradeRange, curriculumGradeRange);
    const subjectMatch = this.compareSubjects(productSubject, curriculum.subject);

    if (gradeOverlap.percentage > 0.8 && subjectMatch) {
      return 'perfect'; // High grade overlap + exact subject match
    } else if (gradeOverlap.percentage > 0.5 && subjectMatch) {
      return 'good'; // Good grade overlap + exact subject match
    } else if (gradeOverlap.percentage > 0.3 && subjectMatch) {
      return 'partial_grade'; // Partial grade overlap + exact subject match
    } else if (gradeOverlap.percentage > 0.5 && !curriculum.subject) {
      return 'general'; // Good grade overlap + general curriculum
    } else if (subjectMatch && gradeOverlap.percentage > 0) {
      return 'subject_only'; // Subject match + some grade overlap
    } else {
      return 'weak'; // Minimal overlap
    }
  }

  /**
   * Calculate grade range overlap between product and curriculum
   * @param {Object} productRange - {min, max} product grade range
   * @param {Object} curriculumRange - {from, to} curriculum grade range
   * @returns {Object} Overlap information
   */
  static calculateGradeOverlap(productRange, curriculumRange) {
    const productMin = productRange.min;
    const productMax = productRange.max;
    const curriculumMin = curriculumRange.from || curriculumRange.to; // Handle single grade
    const curriculumMax = curriculumRange.to || curriculumRange.from;

    const overlapMin = Math.max(productMin, curriculumMin);
    const overlapMax = Math.min(productMax, curriculumMax);

    if (overlapMin <= overlapMax) {
      const overlapSize = overlapMax - overlapMin + 1;
      const productSize = productMax - productMin + 1;
      const curriculumSize = curriculumMax - curriculumMin + 1;

      return {
        hasOverlap: true,
        overlapMin,
        overlapMax,
        overlapSize,
        percentage: overlapSize / Math.max(productSize, curriculumSize)
      };
    }

    return {
      hasOverlap: false,
      percentage: 0
    };
  }

  /**
   * Categorize matches by type and confidence score
   * @param {Array} matches - All potential matches
   * @param {Array} gradeRanges - Product grade ranges
   * @param {Array} subjects - Product subjects
   * @returns {Object} Categorized matches
   */
  static categorizeMatches(matches, gradeRanges, subjects) {
    const perfect = [];
    const good = [];
    const partial = [];
    const suggestions = [];

    for (const match of matches) {
      const confidence = this.calculateConfidenceScore(match);
      match.confidence = confidence;

      switch (match.matchType) {
        case 'perfect':
          perfect.push(match);
          break;
        case 'good':
          good.push(match);
          break;
        case 'partial_grade':
        case 'general':
          partial.push(match);
          break;
        default:
          suggestions.push(match);
          break;
      }
    }

    // Sort each category by confidence score
    const sortByConfidence = (a, b) => b.confidence - a.confidence;

    return {
      perfect: perfect.sort(sortByConfidence),
      good: good.sort(sortByConfidence),
      partial: partial.sort(sortByConfidence),
      suggestions: suggestions.sort(sortByConfidence)
    };
  }

  /**
   * Calculate confidence score for a match (0-100)
   * @param {Object} match - Match object with curriculum and metadata
   * @returns {number} Confidence score 0-100
   */
  static calculateConfidenceScore(match) {
    let score = 0;

    // Base score from grade overlap
    const gradeScore = match.gradeOverlap.percentage * 40;
    score += gradeScore;

    // Subject match bonus
    const subjectScore = match.subjectMatch ? 30 : 0;
    if (match.subjectMatch) {
      score += 30;
    }

    // Match type bonuses
    let typeScore = 0;
    switch (match.matchType) {
      case 'perfect':
        typeScore = 20;
        score += 20;
        break;
      case 'good':
        typeScore = 15;
        score += 15;
        break;
      case 'partial_grade':
        typeScore = 10;
        score += 10;
        break;
      case 'general':
        typeScore = 5;
        score += 5;
        break;
    }

    // Curriculum quality indicators
    let systemScore = 0;
    if (!match.curriculum.teacher_user_id) {
      systemScore = 5;
      score += 5; // System curriculum bonus
    }

    // Existing usage bonus (if curriculum has linked products)
    let usageScore = 0;
    if (match.curriculumItem.products?.length > 0) {
      usageScore = 5;
      score += 5;
    }


    return Math.min(Math.round(score), 100);
  }

  /**
   * Get existing curriculum links for a product
   * @param {string} productId - Product ID
   * @returns {Array} Existing curriculum product links
   */
  static async getExistingLinks(productId) {
    try {
      return await models.CurriculumProduct.findAll({
        where: { product_id: productId },
        include: [
          {
            model: models.CurriculumItem,
            as: 'curriculumItem',
            include: [
              {
                model: models.Curriculum,
                as: 'curriculum'
              }
            ]
          }
        ]
      });
    } catch (error) {
      luderror.api('Error getting existing curriculum links:', error);
      return [];
    }
  }

  /**
   * Apply curriculum links for a product
   * @param {string} productId - Product ID
   * @param {Array} curriculumItemIds - Array of curriculum item IDs to link
   * @returns {Object} Results of the linking operation
   */
  static async applyLinks(productId, curriculumItemIds) {
    const transaction = await models.sequelize.transaction();

    try {
      ludlog.api(`Applying curriculum links for product ${productId}`, {
        curriculumItemIds
      });

      const results = {
        success: [],
        errors: [],
        skipped: []
      };

      for (const curriculumItemId of curriculumItemIds) {
        try {
          // Check if link already exists
          const existingLink = await models.CurriculumProduct.findOne({
            where: {
              product_id: productId,
              curriculum_item_id: curriculumItemId
            },
            transaction
          });

          if (existingLink) {
            results.skipped.push({
              curriculumItemId,
              reason: 'Link already exists'
            });
            continue;
          }

          // Create new link
          const link = await models.CurriculumProduct.create({
            product_id: productId,
            curriculum_item_id: curriculumItemId
          }, { transaction });

          results.success.push({
            curriculumItemId,
            linkId: link.id
          });

        } catch (error) {
          results.errors.push({
            curriculumItemId,
            error: error.message
          });
        }
      }

      await transaction.commit();

      ludlog.api('Curriculum linking completed:', {
        productId,
        success: results.success.length,
        errors: results.errors.length,
        skipped: results.skipped.length
      });

      return results;

    } catch (error) {
      await transaction.rollback();
      luderror.api('Error applying curriculum links:', error);
      throw error;
    }
  }

  /**
   * Remove curriculum link
   * @param {string} curriculumProductId - CurriculumProduct link ID to remove
   * @returns {boolean} Success status
   */
  static async removeLink(curriculumProductId) {
    try {
      ludlog.api(`Removing curriculum link: ${curriculumProductId}`);

      const result = await models.CurriculumProduct.destroy({
        where: { id: curriculumProductId }
      });

      return result > 0;

    } catch (error) {
      luderror.api('Error removing curriculum link:', error);
      throw error;
    }
  }

  /**
   * Convert Hebrew display name back to database key
   * @param {string} displayName - Hebrew display name
   * @returns {string|null} Database key or null if not found
   */
  static getSubjectKeyFromDisplayName(displayName) {
    if (!displayName || !displayName.trim()) return null;

    // Find the key that maps to this display name
    for (const [key, value] of Object.entries(STUDY_SUBJECTS)) {
      if (value === displayName.trim()) {
        return key;
      }
    }

    // If no mapping found, assume it's already a key
    return displayName.trim();
  }

  /**
   * Compare two subjects, handling both database keys and Hebrew display names
   * @param {string|null} subject1 - First subject (product subject)
   * @param {string|null} subject2 - Second subject (curriculum subject)
   * @returns {boolean} True if subjects match
   */
  static compareSubjects(subject1, subject2) {
    // Handle null/undefined cases
    if (!subject1 && !subject2) return true;
    if (!subject1 || !subject2) return false;

    // Normalize both subjects to database keys
    const key1 = this.getSubjectKeyFromDisplayName(subject1);
    const key2 = this.getSubjectKeyFromDisplayName(subject2);

    return key1 === key2;
  }

  /**
   * Get all available subjects from active curricula for manual browsing
   * @returns {Array} Array of unique subjects
   */
  static async getAvailableSubjects() {
    try {
      const curricula = await models.Curriculum.findAll({
        where: {
          teacher_user_id: null, // Only system curricula
          class_id: null,        // Not class-specific
          is_active: true,       // Active only
          subject: { [models.sequelize.Sequelize.Op.ne]: null } // Has subject defined
        },
        attributes: ['subject'],
        group: ['subject'],
        order: [['subject', 'ASC']]
      });

      // Map subject keys to Hebrew display names
      const subjectKeys = curricula
        .map(c => c.subject)
        .filter(subject => subject && subject.trim());

      // Convert keys to display names using STUDY_SUBJECTS mapping
      const displayNames = subjectKeys
        .map(key => STUDY_SUBJECTS[key] || key) // Fallback to key if no mapping found
        .filter(name => name) // Remove any null/undefined values
        .sort();

      return Array.from(new Set(displayNames)); // Remove duplicates

    } catch (error) {
      luderror.api('Error getting available subjects:', error);
      return [];
    }
  }

  /**
   * Get available grade ranges from active curricula for manual browsing
   * @returns {Array} Array of grade range objects
   */
  static async getAvailableGradeRanges() {
    try {
      const curricula = await models.Curriculum.findAll({
        where: {
          teacher_user_id: null, // Only system curricula
          class_id: null,        // Not class-specific
          is_active: true        // Active only
        },
        attributes: ['grade', 'grade_from', 'grade_to', 'is_grade_range'],
        order: [
          ['is_grade_range', 'ASC'],
          ['grade', 'ASC'],
          ['grade_from', 'ASC']
        ]
      });

      const gradeRanges = [];
      const seenRanges = new Set();

      for (const curriculum of curricula) {
        let gradeInfo;

        if (curriculum.is_grade_range && curriculum.grade_from && curriculum.grade_to) {
          // Range curriculum
          const rangeKey = `${curriculum.grade_from}-${curriculum.grade_to}`;
          if (!seenRanges.has(rangeKey)) {
            gradeInfo = {
              type: 'range',
              from: curriculum.grade_from,
              to: curriculum.grade_to,
              display: `כיתות ${curriculum.grade_from}-${curriculum.grade_to}`,
              key: rangeKey
            };
            seenRanges.add(rangeKey);
          }
        } else if (!curriculum.is_grade_range && curriculum.grade) {
          // Single grade curriculum
          const singleKey = `${curriculum.grade}`;
          if (!seenRanges.has(singleKey)) {
            gradeInfo = {
              type: 'single',
              from: curriculum.grade,
              to: curriculum.grade,
              display: `כיתה ${curriculum.grade}`,
              key: singleKey
            };
            seenRanges.add(singleKey);
          }
        }

        if (gradeInfo) {
          gradeRanges.push(gradeInfo);
        }
      }

      // Sort by grade number
      return gradeRanges.sort((a, b) => a.from - b.from);

    } catch (error) {
      luderror.api('Error getting available grade ranges:', error);
      return [
        // Fallback static ranges
        { type: 'single', from: 1, to: 1, display: 'כיתה א', key: '1' },
        { type: 'single', from: 2, to: 2, display: 'כיתה ב', key: '2' },
        { type: 'single', from: 3, to: 3, display: 'כיתה ג', key: '3' },
        { type: 'single', from: 4, to: 4, display: 'כיתה ד', key: '4' },
        { type: 'single', from: 5, to: 5, display: 'כיתה ה', key: '5' },
        { type: 'single', from: 6, to: 6, display: 'כיתה ו', key: '6' },
        { type: 'range', from: 1, to: 6, display: 'כיתות א-ו', key: '1-6' },
        { type: 'range', from: 7, to: 9, display: 'כיתות ז-ט', key: '7-9' },
        { type: 'range', from: 10, to: 12, display: 'כיתות י-יב', key: '10-12' }
      ];
    }
  }
}

export default CurriculumLinkingService;