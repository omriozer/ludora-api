import FileProductService from './FileProductService.js';
import GameProductService from './GameProductService.js';
import BundleProductService from './BundleProductService.js';
import LessonPlanProductService from './LessonPlanProductService.js';
import WorkshopProductService from './WorkshopProductService.js';
import CourseProductService from './CourseProductService.js';
import ToolProductService from './ToolProductService.js';
import { ludlog } from '../lib/ludlog.js';
import { BadRequestError } from '../middleware/errorHandler.js';

/**
 * ProductServiceRouter - Routes operations to appropriate domain services
 *
 * Provides backward compatibility by routing EntityService calls to the
 * appropriate domain-specific services based on product type.
 *
 * This maintains the same API surface as EntityService while using
 * the new domain-specific services internally.
 */
class ProductServiceRouter {
  constructor() {
    // Map of product types to their respective services
    this.serviceMap = {
      'file': FileProductService,
      'game': GameProductService,
      'bundle': BundleProductService,
      'lesson_plan': LessonPlanProductService,
      'workshop': WorkshopProductService,
      'course': CourseProductService,
      'tool': ToolProductService
    };

    // Product types that use the new domain services
    this.domainManagedTypes = Object.keys(this.serviceMap);
  }

  // Get the appropriate service for a product type
  getService(entityType) {
    const service = this.serviceMap[entityType];
    if (!service) {
      throw new BadRequestError(`No service found for entity type: ${entityType}`);
    }
    return service;
  }

  // Check if entity type is managed by domain services
  isDomainManaged(entityType) {
    return this.domainManagedTypes.includes(entityType);
  }

  // Route create operations to appropriate service
  async create(entityType, data, createdBy = null) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing create operation to domain service', {
      entityType,
      createdBy,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.create(data, createdBy);
  }

  // Route update operations to appropriate service
  async update(entityType, id, data, updatedBy = null) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing update operation to domain service', {
      entityType,
      id,
      updatedBy,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.update(id, data, updatedBy);
  }

  // Route delete operations to appropriate service
  async delete(entityType, id) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing delete operation to domain service', {
      entityType,
      id,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.delete(id);
  }

  // Route find operations to appropriate service
  async find(entityType, query = {}, options = {}) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing find operation to domain service', {
      entityType,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.find(query, options);
  }

  // Route findById operations to appropriate service
  async findById(entityType, id, include = null) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing findById operation to domain service', {
      entityType,
      id,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.findById(id, include);
  }

  // Route count operations to appropriate service
  async count(entityType, query = {}) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    const service = this.getService(entityType);
    return await service.count(query);
  }

  // Route bulk create operations to appropriate service
  async bulkCreate(entityType, dataArray, createdBy = null) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing bulk create operation to domain service', {
      entityType,
      count: dataArray.length,
      createdBy,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.bulkCreate(dataArray, createdBy);
  }

  // Route bulk delete operations to appropriate service
  async bulkDelete(entityType, ids) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    ludlog.generic('Routing bulk delete operation to domain service', {
      entityType,
      count: ids.length,
      serviceUsed: this.getService(entityType).constructor.name
    });

    const service = this.getService(entityType);
    return await service.bulkDelete(ids);
  }

  // Get model for a product type (backward compatibility with EntityService)
  getModel(entityType) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    const service = this.getService(entityType);
    return service.getModel();
  }

  // Get available entity types
  getAvailableEntityTypes() {
    // For backward compatibility, return all domain-managed types
    // Note: This might need to be expanded if EntityService handled non-product types
    return this.domainManagedTypes;
  }

  // Convert string to PascalCase (for backward compatibility)
  toPascalCase(str) {
    // Delegate to one of the services (they all have the same implementation)
    return FileProductService.toPascalCase(str);
  }

  // Process sort parameter (for backward compatibility)
  processSortParameter(sort) {
    // Delegate to one of the services (they all have the same implementation)
    return FileProductService.processSortParameter(sort);
  }

  // Build where clause (for backward compatibility)
  buildWhereClause(query, entityType = null) {
    if (entityType && this.isDomainManaged(entityType)) {
      const service = this.getService(entityType);
      return service.buildWhereClause(query, entityType);
    }

    // Fallback to FileProductService for backward compatibility
    return FileProductService.buildWhereClause(query, entityType);
  }

  // Get search fields (for backward compatibility)
  getSearchFields(entityType) {
    if (this.isDomainManaged(entityType)) {
      const service = this.getService(entityType);
      return service.getSearchFields(entityType);
    }

    // Fallback for non-domain-managed types
    const searchFieldMap = {
      'word': ['word', 'vocalized', 'context'],
      'worden': ['word'],
      'wordEn': ['word'],
      'wordEN': ['word'],
      'qa': ['question_text'],
      'contentlist': ['name', 'description'],
      'image': ['name', 'description'],
      'attribute': ['type', 'value'],
    };

    return searchFieldMap[entityType?.toLowerCase()] || ['name', 'title', 'description'];
  }

  // Handle entity includes (for backward compatibility)
  handleEntityIncludes(entityType, include, queryOptions) {
    // Currently not implemented in the domain services
    // Return false to indicate include parameter not handled
    return false;
  }

  // Extract S3 key from URL (for backward compatibility)
  extractS3KeyFromUrl(fileUrl) {
    // Delegate to FileProductService which has this method
    return FileProductService.extractS3KeyFromUrl(fileUrl);
  }

  // Get entity with product data (for backward compatibility)
  async findEntityWithProduct(entityType, entityId) {
    if (!this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    // For domain services, findById returns combined product + entity data
    const service = this.getService(entityType);
    return await service.findById(entityId);
  }

  // Validate ownership (for backward compatibility)
  async validateOwnership(entityId, userId, userRole, entityType) {
    if (!entityType || !this.isDomainManaged(entityType)) {
      throw new BadRequestError(`Entity type ${entityType} is not supported by ProductServiceRouter`);
    }

    const service = this.getService(entityType);
    return await service.validateOwnership(entityId, userId, userRole);
  }

  // Transaction wrapper (for backward compatibility)
  async withTransaction(callback) {
    // Delegate to one of the services (they all have the same implementation)
    return await FileProductService.withTransaction(callback);
  }
}

export default new ProductServiceRouter();