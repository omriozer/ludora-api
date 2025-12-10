# Documentation Update Workflow

> **Practical guide for keeping documentation synchronized with code changes**

## Quick Reference

### Before You Start Coding
```bash
# 1. Identify documentation impact
- [ ] Will this change public APIs?
- [ ] Are there new authentication requirements?
- [ ] Do error responses change?
- [ ] Are there new configuration options?

# 2. Plan documentation updates
- [ ] Which OpenAPI specs need updates?
- [ ] Which guides need new examples?
- [ ] Are there breaking changes requiring migration guides?
```

### During Development
```bash
# 1. Update OpenAPI specs as you build
# 2. Add/update code examples
# 3. Document new error scenarios
# 4. Update configuration guides
```

### Before Submitting PR
```bash
# 1. Test all documentation changes
npm run docs:validate

# 2. Check links and examples
npm run docs:check-links
npm run docs:validate:examples

# 3. Review documentation checklist (below)
```

---

## Table of Contents

1. [Workflow Overview](#workflow-overview)
2. [Change Type Workflows](#change-type-workflows)
3. [Documentation Templates](#documentation-templates)
4. [Review Checklists](#review-checklists)
5. [Common Scenarios](#common-scenarios)
6. [Troubleshooting](#troubleshooting)

---

## Workflow Overview

### Documentation-First Development

**Philosophy:** Documentation should be updated **during** development, not after. This ensures:
- Code and docs never get out of sync
- Examples are tested as part of development
- API design flaws are caught early
- Onboarding new developers is seamless

### Three-Layer Documentation Strategy

1. **OpenAPI Specifications** (`/src/openapi/`) - Machine-readable API contracts
2. **Integration Guides** (`/docs/`) - Human-readable implementation guidance
3. **Code Comments** - Inline documentation for complex logic

### Change Impact Matrix

| Change Type | OpenAPI Update | Guide Update | Examples Update | Migration Guide |
|-------------|----------------|--------------|-----------------|------------------|
| New endpoint | ✅ Required | ✅ Required | ✅ Required | ❌ Not needed |
| Breaking change | ✅ Required | ✅ Required | ✅ Required | ✅ Required |
| New auth method | ✅ Required | ✅ Required | ✅ Required | ⚠️ If breaking |
| Bug fix (no API change) | ❌ Not needed | ❌ Usually not needed | ⚠️ If examples affected | ❌ Not needed |
| Internal refactor | ❌ Not needed | ❌ Not needed | ❌ Not needed | ❌ Not needed |
| New error codes | ✅ Required | ✅ Required | ✅ Required | ❌ Usually not needed |

---

## Change Type Workflows

### 1. New API Endpoint

#### Step-by-Step Process

**🚨 CRITICAL: Add OpenAPI documentation BEFORE implementing the endpoint**

```bash
# 1. Create or update OpenAPI specification
vim src/openapi/paths/[endpoint-group].js

# 2. Add endpoint documentation
{
  '/api/new-endpoint': {
    post: {
      summary: 'Create new resource',
      description: 'Detailed description of what this endpoint does...',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/NewResourceRequest' }
          }
        }
      },
      responses: {
        201: {
          description: 'Resource created successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/NewResourceResponse' }
            }
          }
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimited' }
      }
    }
  }
}

# 3. Create schema if needed
vim src/openapi/schemas/new-resource.js

# 4. Update integration guide
vim docs/API_INTEGRATION_GUIDE.md

# 5. Add code examples
const response = await apiRequest('/api/new-endpoint', {
  method: 'POST',
  body: { name: 'Example Resource', type: 'sample' }
});
```

#### Documentation Checklist
- [ ] OpenAPI specification complete with all response codes
- [ ] Request/response schemas defined
- [ ] Integration guide updated with example
- [ ] Error handling documented
- [ ] Rate limiting information included
- [ ] Authentication requirements specified

### 2. Breaking API Changes

#### Required Documentation Updates

```bash
# 1. Update OpenAPI specs for new version
vim src/openapi/paths/[affected-endpoints].js

# 2. Create migration guide
vim docs/MIGRATION_GUIDE_V[X]_TO_V[Y].md

# 3. Update all affected examples
grep -r "old-endpoint-pattern" docs/ # Find all references
# Update each found reference

# 4. Add deprecation notices
echo "⚠️ **DEPRECATED**: This endpoint will be removed in v2.0" >> relevant_guide.md
echo "Use [new endpoint](link) instead." >> relevant_guide.md

# 5. Update error handling guide if error codes changed
vim docs/ERROR_HANDLING_REFERENCE.md
```

#### Migration Guide Template
```markdown
# Migration Guide: API v1.0 to v2.0

## Breaking Changes Summary

### Authentication Changes
**Before (v1.0):**
```javascript
// Old authentication method
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

**After (v2.0):**
```javascript
// New authentication method
const response = await apiRequest('/api/auth/verify', {
  method: 'POST',
  body: { idToken: firebaseToken }
});
```

### Timeline
- **v2.0 Release**: January 2025
- **v1.0 Deprecation**: March 2025
- **v1.0 Removal**: June 2025
```

### 3. Authentication Changes

#### Update Procedure

```bash
# 1. Update authentication reference
vim docs/AUTHENTICATION_REFERENCE.md

# 2. Update all integration examples
find docs -name "*.md" -exec grep -l "auth" {} \; | xargs vim

# 3. Update OpenAPI security schemes
vim src/openapi/index.js # Update security definitions

# 4. Test all authentication examples
npm run docs:validate:examples

# 5. Update setup guides if configuration changed
vim docs/DEVELOPMENT_SETUP_GUIDE.md
```

### 4. New Error Codes or Status Codes

#### Documentation Process

```bash
# 1. Update error handling reference
vim docs/ERROR_HANDLING_REFERENCE.md

# Add new error documentation:
## 422 Unprocessable Entity
**When it occurs:** Request is valid but cannot be processed due to business logic
**Example response:**
```json
{
  "error": "BUSINESS_RULE_VIOLATION",
  "message": "Cannot delete item with active dependencies",
  "details": { "dependencies": ["dep1", "dep2"] }
}
```

# 2. Update OpenAPI specs with new response codes
vim src/openapi/paths/[affected-endpoints].js

# 3. Update integration examples to show error handling
vim docs/API_INTEGRATION_GUIDE.md
```

---

## Documentation Templates

### OpenAPI Endpoint Template

```javascript
// src/openapi/paths/example.js
export default {
  '/api/resource/{id}': {
    get: {
      summary: 'Get resource by ID',
      description: `
        **Purpose:** Retrieve detailed information about a specific resource.

        **Authentication:** Requires valid JWT token in Authorization header.

        **Rate Limiting:** 100 requests per 15 minutes per user.

        **Caching:** Response is cached for 5 minutes on client side.
      `,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Unique identifier for the resource',
          schema: { type: 'string', pattern: '^[a-zA-Z0-9_]{8,}$' }
        }
      ],
      responses: {
        200: {
          description: 'Resource retrieved successfully',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Resource' }
            }
          }
        },
        400: { $ref: '#/components/responses/ValidationError' },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalServerError' }
      }
    }
  }
};
```

### Integration Guide Section Template

```markdown
### Working with [Feature Name]

**Overview:** Brief description of the feature and its purpose.

**Authentication:** What authentication is required.

**Prerequisites:** Any setup required before using this feature.

#### Basic Usage

```javascript
// Basic example with minimal error handling
try {
  const response = await apiRequest('/api/endpoint', {
    method: 'POST',
    body: { param1: 'value1', param2: 'value2' }
  });

  console.log('Success:', response.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

#### Advanced Example

```javascript
// Production-ready example with comprehensive error handling
async function createResource(resourceData) {
  try {
    // Validate input
    if (!resourceData.name) {
      throw new Error('Resource name is required');
    }

    const response = await apiRequest('/api/resources', {
      method: 'POST',
      body: {
        name: resourceData.name,
        description: resourceData.description || '',
        type: resourceData.type || 'default'
      }
    });

    return response;
  } catch (error) {
    // Handle specific error scenarios
    if (error.status === 409) {
      throw new Error('Resource name already exists');
    } else if (error.status === 429) {
      // Implement exponential backoff
      await new Promise(resolve => setTimeout(resolve, 5000));
      return createResource(resourceData); // Retry
    }

    throw error; // Re-throw other errors
  }
}
```

#### Error Handling

Common error scenarios and how to handle them:

| Error Code | Meaning | Recommended Action |
|------------|---------|-------------------|
| 400 | Invalid request data | Validate input and retry |
| 401 | Authentication required | Redirect to login |
| 403 | Insufficient permissions | Show access denied message |
| 409 | Resource conflict | Suggest alternative or update |
| 429 | Rate limit exceeded | Implement exponential backoff |

#### Best Practices

- Always validate input before sending requests
- Implement proper error handling for all scenarios
- Use exponential backoff for rate-limited requests
- Cache responses when appropriate
```

---

## Review Checklists

### Code Author Self-Review

**Before submitting PR:**

#### OpenAPI Documentation
- [ ] All new endpoints have complete OpenAPI documentation
- [ ] Request/response schemas are defined and accurate
- [ ] All possible HTTP status codes are documented
- [ ] Authentication requirements are clearly specified
- [ ] Rate limiting information is included
- [ ] Examples are provided for complex request bodies

#### Integration Guides
- [ ] New features have integration examples
- [ ] Code examples are tested and working
- [ ] Error handling is demonstrated
- [ ] Breaking changes are clearly marked
- [ ] Migration guidance is provided for breaking changes

#### Validation
- [ ] `npm run docs:validate` passes
- [ ] `npm run docs:check-links` passes
- [ ] All code examples have been manually tested
- [ ] Documentation follows established style guidelines

### PR Reviewer Checklist

#### Technical Accuracy
- [ ] OpenAPI specs match actual API implementation
- [ ] Code examples are correct and complete
- [ ] Error scenarios are accurately documented
- [ ] Authentication flows are properly documented

#### Completeness
- [ ] All new endpoints are documented
- [ ] Breaking changes have migration guides
- [ ] Integration patterns are explained clearly
- [ ] Common use cases are covered with examples

#### Quality and Clarity
- [ ] Documentation is clear and easy to follow
- [ ] Examples progress from basic to advanced
- [ ] Consistent terminology is used throughout
- [ ] Links between related sections work correctly

### Documentation Team Review

#### User Experience
- [ ] Documentation serves developer needs effectively
- [ ] Information is organized logically
- [ ] Getting started paths are clear
- [ ] Advanced scenarios are adequately covered

#### Consistency
- [ ] Style guide is followed consistently
- [ ] Terminology matches across all documentation
- [ ] Code examples follow established patterns
- [ ] Error messages match actual API responses

---

## Common Scenarios

### Scenario 1: Adding a New Product Type

**Example: Adding "Course" as a new product type**

```bash
# 1. Update OpenAPI for entities endpoint
vim src/openapi/paths/entities.js
# Add 'course' to productType enum

# 2. Add course-specific schemas
vim src/openapi/schemas/course.js

# 3. Update integration guide
vim docs/API_INTEGRATION_GUIDE.md
# Add course creation example

# 4. Update product type documentation
# Search for all references to product types and add course

# 5. Test new examples
npm run docs:validate:examples
```

### Scenario 2: Changing Authentication Method

**Example: Moving from basic auth to Firebase tokens**

```bash
# 1. Create migration guide
vim docs/FIREBASE_AUTHENTICATION_MIGRATION.md

# 2. Update authentication reference
vim docs/AUTHENTICATION_REFERENCE.md
# Update all authentication examples

# 3. Update OpenAPI security schemes
vim src/openapi/index.js
# Update securitySchemes definition

# 4. Add deprecation notices
grep -r "basic.*auth" docs/ # Find all basic auth references
# Add deprecation notices to each

# 5. Update setup guide
vim docs/DEVELOPMENT_SETUP_GUIDE.md
# Update Firebase configuration section
```

### Scenario 3: New Error Response Format

**Example: Adding structured error details**

```bash
# 1. Update error handling reference
vim docs/ERROR_HANDLING_REFERENCE.md
# Document new error response format

# 2. Update OpenAPI error schemas
vim src/openapi/schemas/errors.js
# Update error response schemas

# 3. Update all code examples
find docs -name "*.md" -exec grep -l "catch.*error" {} \;
# Update error handling in each example

# 4. Create migration guide if breaking
vim docs/ERROR_RESPONSE_MIGRATION.md
```

---

## Troubleshooting

### Common Issues and Solutions

#### Issue: Documentation validation fails
```bash
# Check specific validation errors
npm run docs:validate

# Common fixes:
- Update OpenAPI specs to match implementation
- Fix broken internal links
- Correct JavaScript syntax in examples
- Ensure all required fields are documented
```

#### Issue: Examples don't work
```bash
# Test specific examples
npm run docs:validate:examples

# Common causes:
- API has changed but examples weren't updated
- Authentication tokens are outdated
- Example uses deprecated patterns
- Missing error handling
```

#### Issue: Links are broken
```bash
# Check all links
npm run docs:check-links

# Common fixes:
- Update file paths after documentation reorganization
- Fix external URLs that have changed
- Correct anchor links to match actual headers
```

### Emergency Documentation Fix Process

**For critical documentation issues affecting production:**

```bash
# 1. Create hotfix branch
git checkout -b docs/emergency-fix-[issue]

# 2. Make minimal necessary changes
# Focus only on the critical issue

# 3. Fast validation
npm run docs:validate:openapi  # Quick API check
npm run docs:check-links       # Link validation

# 4. Create emergency PR
# Mark as emergency in title and description

# 5. Deploy documentation immediately if possible
# Don't wait for full review cycle for critical issues
```

---

## Automation Integration

### Pre-commit Hooks

```bash
# Install documentation validation in pre-commit hooks
echo "npm run docs:validate:openapi" >> .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### IDE Integration

#### VS Code Setup

```json
// .vscode/tasks.json - Add documentation tasks
{
  "label": "Validate Documentation",
  "type": "shell",
  "command": "npm run docs:validate",
  "group": "build",
  "presentation": {
    "reveal": "always",
    "panel": "new"
  },
  "problemMatcher": []
}
```

#### Live Documentation Preview

```bash
# Set up live preview while editing
# Terminal 1: Run development server
npm run dev

# Terminal 2: Watch documentation changes
npm run docs:validate -- --watch

# Browser: View live docs
open http://localhost:3003/api-docs
```

---

## Success Metrics

### Track Documentation Health

```bash
# Weekly documentation health check
npm run docs:validate && echo "✅ Documentation validation: PASS"
npm run docs:coverage && echo "📊 Documentation coverage calculated"
npm run docs:check-links && echo "🔗 Link validation: PASS"

# Monthly comprehensive review
find docs -name "*.md" -mtime -30 | wc -l  # Recently updated files
grep -r "TODO\|FIXME" docs/ | wc -l        # Outstanding items
```

### Quality Goals

- **100% OpenAPI coverage** - Every public endpoint documented
- **0 broken links** - All internal and external links work
- **0 failed examples** - All code examples execute successfully
- **< 7 day staleness** - Critical documentation updated within a week of code changes

---

## Getting Help

### Documentation Questions
1. **Check existing examples** in the same guide or related guides
2. **Review the maintenance guide** for standards and patterns
3. **Ask in team chat** with specific questions and context
4. **Reference this workflow** for step-by-step procedures

### Process Improvement
- **Update this guide** when you discover better practices
- **Share common patterns** that work well for your team
- **Suggest automation** for repetitive documentation tasks
- **Document new scenarios** as they arise

---

*This workflow guide is updated as processes evolve. Last updated: December 2025*