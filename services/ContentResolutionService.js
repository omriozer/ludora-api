import models from '../models/index.js';
import { Op } from 'sequelize';

const {
  GameContentUsage,
  GameContentRuleInstance,
  Word,
  WordEN,
  Image,
  QA,
  Grammar,
  AudioFile,
  ContentList,
  Attribute,
  ContentRelationship
} = models;

/**
 * Content Resolution Service
 *
 * This service handles the dynamic resolution of content for games based on
 * the rules defined in GameContentUsage instances. It supports various rule types:
 *
 * - attribute_based: Filter content based on attribute values
 * - content_list: Use specific ContentLists
 * - complex_attribute: Complex attribute-based filtering with multiple conditions
 * - relation_based: Filter content based on relationships between content items
 */
class ContentResolutionService {
  /**
   * Get all content for a specific game usage instance
   * @param {string} gameUsageId - The game usage ID
   * @returns {Object} Resolved content organized by type
   */
  static async resolveContentForUsage(gameUsageId) {
    // Get the usage instance with its rules
    const usage = await GameContentUsage.findByPk(gameUsageId, {
      include: [{
        model: GameContentRuleInstance,
        as: 'rules',
        order: [['priority', 'DESC']]
      }]
    });

    if (!usage) {
      throw new Error(`Game usage not found: ${gameUsageId}`);
    }

    // Initialize result object with content types
    const result = {};
    for (const contentType of usage.content_types) {
      result[contentType] = [];
    }

    // If no rules defined, return empty content
    if (!usage.rules || usage.rules.length === 0) {
      return {
        usage_id: gameUsageId,
        usage_name: usage.name,
        content: result,
        metadata: {
          total_items: 0,
          rules_applied: 0,
          content_types: usage.content_types
        }
      };
    }

    // Process each rule and collect content
    const allContent = new Map(); // Use Map to avoid duplicates

    for (const rule of usage.rules) {
      try {
        const ruleContent = await this.resolveContentForRule(rule, usage.content_types);

        // Merge content from this rule
        for (const [contentType, items] of Object.entries(ruleContent)) {
          if (usage.content_types.includes(contentType)) {
            if (!allContent.has(contentType)) {
              allContent.set(contentType, new Set());
            }

            const contentSet = allContent.get(contentType);
            items.forEach(item => contentSet.add(JSON.stringify(item)));
          }
        }
      } catch (error) {
        console.error(`Error processing rule ${rule.id}:`, error);
        // Continue with other rules even if one fails
      }
    }

    // Convert Sets back to arrays and parse JSON
    for (const [contentType, itemSet] of allContent.entries()) {
      result[contentType] = Array.from(itemSet).map(item => JSON.parse(item));
    }

    // Calculate metadata
    const totalItems = Object.values(result).reduce((sum, items) => sum + items.length, 0);

    return {
      usage_id: gameUsageId,
      usage_name: usage.name,
      content: result,
      metadata: {
        total_items: totalItems,
        rules_applied: usage.rules.length,
        content_types: usage.content_types
      }
    };
  }

  /**
   * Resolve content for a specific rule
   * @param {Object} rule - The rule instance
   * @param {Array} allowedContentTypes - Content types allowed for this usage
   * @returns {Object} Content organized by type
   */
  static async resolveContentForRule(rule, allowedContentTypes) {
    switch (rule.rule_type) {
      case 'attribute_based':
        return await this.resolveAttributeBasedContent(rule.rule_config, allowedContentTypes);

      case 'content_list':
        return await this.resolveContentListContent(rule.rule_config, allowedContentTypes);

      case 'complex_attribute':
        return await this.resolveComplexAttributeContent(rule.rule_config, allowedContentTypes);

      case 'relation_based':
        return await this.resolveRelationBasedContent(rule.rule_config, allowedContentTypes);

      default:
        console.warn(`Unknown rule type: ${rule.rule_type}`);
        return {};
    }
  }

  /**
   * Resolve content based on simple attribute matching
   * Rule config format: { attribute_name: "difficulty", attribute_value: "easy" }
   */
  static async resolveAttributeBasedContent(config, allowedContentTypes) {
    const { attribute_name, attribute_value } = config;

    if (!attribute_name || attribute_value === undefined) {
      throw new Error('Attribute-based rule requires attribute_name and attribute_value');
    }

    const result = {};
    const contentTypeModels = this.getContentTypeModels();

    for (const contentType of allowedContentTypes) {
      if (!contentTypeModels[contentType]) continue;

      const Model = contentTypeModels[contentType];

      try {
        // Query content with the specified attribute
        const items = await Model.findAll({
          include: [{
            model: Attribute,
            as: 'attributes',
            where: {
              name: attribute_name,
              value: attribute_value
            }
          }],
          order: [['created_at', 'DESC']]
        });

        result[contentType] = items.map(item => this.serializeContentItem(item, contentType));
      } catch (error) {
        console.error(`Error querying ${contentType} for attribute ${attribute_name}:`, error);
        result[contentType] = [];
      }
    }

    return result;
  }

  /**
   * Resolve content from specific ContentLists
   * Rule config format: { content_list_ids: ["list1", "list2"] }
   */
  static async resolveContentListContent(config, allowedContentTypes) {
    const { content_list_ids } = config;

    if (!content_list_ids || !Array.isArray(content_list_ids)) {
      throw new Error('Content list rule requires content_list_ids array');
    }

    const result = {};

    // Get all specified content lists
    const contentLists = await ContentList.findAll({
      where: {
        id: {
          [Op.in]: content_list_ids
        }
      },
      include: [{
        model: ContentRelationship,
        as: 'relationships'
      }]
    });

    // Group content by type
    const contentByType = {};

    for (const contentList of contentLists) {
      for (const relationship of contentList.relationships) {
        const contentType = relationship.related_content_type;

        if (allowedContentTypes.includes(contentType)) {
          if (!contentByType[contentType]) {
            contentByType[contentType] = new Set();
          }
          contentByType[contentType].add(relationship.related_content_id);
        }
      }
    }

    // Fetch actual content items
    const contentTypeModels = this.getContentTypeModels();

    for (const [contentType, idSet] of Object.entries(contentByType)) {
      if (!contentTypeModels[contentType]) continue;

      const Model = contentTypeModels[contentType];
      const ids = Array.from(idSet);

      try {
        const items = await Model.findAll({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          order: [['created_at', 'DESC']]
        });

        result[contentType] = items.map(item => this.serializeContentItem(item, contentType));
      } catch (error) {
        console.error(`Error fetching ${contentType} items:`, error);
        result[contentType] = [];
      }
    }

    // Initialize empty arrays for content types not found
    for (const contentType of allowedContentTypes) {
      if (!result[contentType]) {
        result[contentType] = [];
      }
    }

    return result;
  }

  /**
   * Resolve content with complex attribute conditions
   * Rule config format: {
   *   conditions: [
   *     { attribute_name: "difficulty", operator: "eq", value: "easy" },
   *     { attribute_name: "subject", operator: "in", value: ["math", "science"] }
   *   ],
   *   logical_operator: "AND" // or "OR"
   * }
   */
  static async resolveComplexAttributeContent(config, allowedContentTypes) {
    const { conditions, logical_operator = 'AND' } = config;

    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      throw new Error('Complex attribute rule requires conditions array');
    }

    const result = {};
    const contentTypeModels = this.getContentTypeModels();

    for (const contentType of allowedContentTypes) {
      if (!contentTypeModels[contentType]) continue;

      const Model = contentTypeModels[contentType];

      try {
        // Build attribute conditions
        const attributeConditions = conditions.map(condition => {
          const { attribute_name, operator, value } = condition;

          switch (operator) {
            case 'eq':
              return { name: attribute_name, value: value };
            case 'ne':
              return { name: attribute_name, value: { [Op.ne]: value } };
            case 'in':
              return { name: attribute_name, value: { [Op.in]: Array.isArray(value) ? value : [value] } };
            case 'not_in':
              return { name: attribute_name, value: { [Op.notIn]: Array.isArray(value) ? value : [value] } };
            case 'like':
              return { name: attribute_name, value: { [Op.like]: `%${value}%` } };
            default:
              throw new Error(`Unsupported operator: ${operator}`);
          }
        });

        // Combine conditions based on logical operator
        const whereCondition = logical_operator === 'OR'
          ? { [Op.or]: attributeConditions }
          : { [Op.and]: attributeConditions };

        const items = await Model.findAll({
          include: [{
            model: Attribute,
            as: 'attributes',
            where: whereCondition
          }],
          order: [['created_at', 'DESC']]
        });

        result[contentType] = items.map(item => this.serializeContentItem(item, contentType));
      } catch (error) {
        console.error(`Error querying ${contentType} with complex attributes:`, error);
        result[contentType] = [];
      }
    }

    return result;
  }

  /**
   * Resolve content based on relationships between content items
   * Rule config format: {
   *   source_content_type: "word",
   *   source_content_ids: ["id1", "id2"], // optional, if not provided uses all
   *   relationship_type: "synonym", // or "antonym", "related", etc.
   *   target_content_types: ["worden"] // which content types to include in results
   * }
   */
  static async resolveRelationBasedContent(config, allowedContentTypes) {
    const {
      source_content_type,
      source_content_ids,
      relationship_type,
      target_content_types
    } = config;

    if (!source_content_type || !relationship_type || !target_content_types) {
      throw new Error('Relation-based rule requires source_content_type, relationship_type, and target_content_types');
    }

    const result = {};

    // Build source content filter
    let sourceWhere = {
      source_content_type: source_content_type
    };

    if (source_content_ids && Array.isArray(source_content_ids) && source_content_ids.length > 0) {
      sourceWhere.source_content_id = {
        [Op.in]: source_content_ids
      };
    }

    // Find relationships
    const relationships = await ContentRelationship.findAll({
      where: {
        ...sourceWhere,
        relationship_type: relationship_type,
        related_content_type: {
          [Op.in]: target_content_types.filter(type => allowedContentTypes.includes(type))
        }
      }
    });

    // Group by target content type
    const contentByType = {};
    for (const relationship of relationships) {
      const contentType = relationship.related_content_type;
      if (!contentByType[contentType]) {
        contentByType[contentType] = new Set();
      }
      contentByType[contentType].add(relationship.related_content_id);
    }

    // Fetch actual content items
    const contentTypeModels = this.getContentTypeModels();

    for (const [contentType, idSet] of Object.entries(contentByType)) {
      if (!contentTypeModels[contentType]) continue;

      const Model = contentTypeModels[contentType];
      const ids = Array.from(idSet);

      try {
        const items = await Model.findAll({
          where: {
            id: {
              [Op.in]: ids
            }
          },
          order: [['created_at', 'DESC']]
        });

        result[contentType] = items.map(item => this.serializeContentItem(item, contentType));
      } catch (error) {
        console.error(`Error fetching ${contentType} items for relationships:`, error);
        result[contentType] = [];
      }
    }

    // Initialize empty arrays for content types not found
    for (const contentType of allowedContentTypes) {
      if (!result[contentType]) {
        result[contentType] = [];
      }
    }

    return result;
  }

  /**
   * Get model mapping for content types
   */
  static getContentTypeModels() {
    return {
      'word': Word,
      'worden': WordEN,
      'image': Image,
      'qa': QA,
      'grammar': Grammar,
      'audiofile': AudioFile,
      'contentlist': ContentList,
      'attribute': Attribute
    };
  }

  /**
   * Serialize content item for consistent API response
   */
  static serializeContentItem(item, contentType) {
    const serialized = {
      id: item.id,
      content_type: contentType,
      created_at: item.created_at,
      updated_at: item.updated_at
    };

    // Add type-specific fields
    switch (contentType) {
      case 'word':
      case 'worden':
        serialized.word = item.word;
        serialized.translation = item.translation;
        serialized.pronunciation = item.pronunciation;
        break;

      case 'image':
        serialized.image_url = item.image_url;
        serialized.alt_text = item.alt_text;
        serialized.caption = item.caption;
        break;

      case 'qa':
        serialized.question = item.question;
        serialized.answer = item.answer;
        serialized.question_type = item.question_type;
        break;

      case 'grammar':
        serialized.rule = item.rule;
        serialized.explanation = item.explanation;
        serialized.examples = item.examples;
        break;

      case 'audiofile':
        serialized.audio_url = item.audio_url;
        serialized.title = item.title;
        serialized.duration = item.duration;
        break;

      case 'contentlist':
        serialized.name = item.name;
        serialized.description = item.description;
        break;

      case 'attribute':
        serialized.name = item.name;
        serialized.value = item.value;
        serialized.content_type = item.content_type;
        serialized.content_id = item.content_id;
        break;
    }

    return serialized;
  }

  /**
   * Preview content that would be resolved for a rule configuration
   * Useful for testing rules before saving them
   */
  static async previewContentForRule(ruleType, ruleConfig, contentTypes, limit = 10) {
    const mockRule = {
      rule_type: ruleType,
      rule_config: ruleConfig
    };

    const content = await this.resolveContentForRule(mockRule, contentTypes);

    // Limit results for preview
    const preview = {};
    for (const [contentType, items] of Object.entries(content)) {
      preview[contentType] = items.slice(0, limit);
    }

    return {
      rule_type: ruleType,
      rule_config: ruleConfig,
      content_types: contentTypes,
      preview,
      metadata: {
        total_by_type: Object.fromEntries(
          Object.entries(content).map(([type, items]) => [type, items.length])
        )
      }
    };
  }
}

export default ContentResolutionService;