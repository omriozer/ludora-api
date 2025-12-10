# Documentation Maintenance Guide

> **Comprehensive guide for maintaining high-quality, accurate, and up-to-date API documentation**

## Table of Contents

1. [Overview](#overview)
2. [Documentation Standards](#documentation-standards)
3. [Update Procedures](#update-procedures)
4. [Validation and Testing](#validation-and-testing)
5. [Review and Approval Process](#review-and-approval-process)
6. [Automated Maintenance](#automated-maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### Documentation Maintenance Philosophy

Ludora's API documentation follows a **"Documentation as Code"** approach where:

- **Documentation changes with code changes** - Never leave docs behind
- **Code examples are always tested** - No broken examples in production
- **One source of truth** - Eliminate conflicting information
- **User-focused content** - Write for developers who need to get things done
- **Continuous improvement** - Regularly update and refine based on feedback

### Documentation Ecosystem

The Ludora documentation ecosystem consists of:

1. **OpenAPI Specifications** (`/src/openapi/`) - Machine-readable API definitions
2. **Developer Guides** (`/docs/`) - Human-readable integration guides
3. **Code Comments** (throughout codebase) - Inline documentation
4. **Interactive Docs** (`/api-docs`) - Live testing environment
5. **Master Index** (`/docs/README.md`) - Central navigation hub

---

## Documentation Standards

### Writing Standards

#### Voice and Tone
- **Active voice**: "Create a game" not "A game is created"
- **Direct and concise**: Get to the point quickly
- **Helpful and encouraging**: Assume positive intent from developers
- **Technical but accessible**: Balance precision with readability

#### Structure Standards
```markdown
# Title (H1) - One per document
## Major Sections (H2) - Main topic areas
### Subsections (H3) - Specific topics
#### Details (H4) - Implementation specifics

- Use bullet points for lists
- Use numbered lists for sequential steps
- Include code examples for all concepts
- Provide "Quick Start" sections for complex topics
```

#### Code Example Standards
```javascript
// ✅ CORRECT: Always include error handling
try {
  const response = await apiRequest('/api/games', {
    method: 'POST',
    body: { title: 'Math Quiz', difficulty: 'easy' }
  });
  console.log('Game created:', response.id);
} catch (error) {
  if (error.status === 401) {
    // Handle authentication error
    redirectToLogin();
  }
  throw error;
}

// ❌ WRONG: Missing error handling
const response = await fetch('/api/games', {
  method: 'POST',
  body: JSON.stringify({ title: 'Math Quiz' })
});
const data = response.json();
```

### File Organization Standards

#### Naming Conventions
- Use `UPPERCASE_WITH_UNDERSCORES.md` for guides
- Use descriptive names: `AUTHENTICATION_REFERENCE.md` not `auth.md`
- Include version dates for specifications: `API_V2_MIGRATION_GUIDE.md`

#### Directory Structure
```
/docs/
├── README.md                    # Master index
├── [GUIDE_NAME].md             # Individual guides
├── archive/                    # Archived/outdated docs
│   ├── README.md              # Archive index
│   └── [category]/            # Organized by reason for archival
└── assets/                    # Images, diagrams (if needed)
```

---

## Update Procedures

### When to Update Documentation

#### Immediate Updates Required
- **New API endpoints** - Document within same PR
- **Breaking changes** - Update before deployment
- **Authentication changes** - Critical for developer access
- **Error code changes** - Affects error handling patterns
- **Rate limiting changes** - Impacts client implementation

#### Scheduled Updates
- **Quarterly guide review** - Ensure all examples still work
- **Monthly OpenAPI validation** - Verify spec accuracy
- **Annual architecture review** - Update high-level concepts

### Code Change → Documentation Update Workflow

#### 1. Pre-Development Planning
```bash
# Before starting development, identify documentation impact
# Questions to ask:
- Does this change any public APIs?
- Are there new authentication requirements?
- Do error responses change?
- Are there new rate limits or requirements?
- Does this affect integration patterns?
```

#### 2. Development Phase Documentation
```bash
# During development, update documentation alongside code:

# For new API endpoints:
1. Add OpenAPI specification in /src/openapi/paths/
2. Create or update relevant schema in /src/openapi/schemas/
3. Update integration guide with examples
4. Add error scenarios to error handling guide

# For authentication changes:
1. Update AUTHENTICATION_REFERENCE.md
2. Update all affected integration examples
3. Update OpenAPI security schemes

# For breaking changes:
1. Create migration guide
2. Update all affected examples
3. Add deprecation notices where applicable
```

#### 3. Testing Documentation Changes
```bash
# Test all documentation changes before PR:
1. Validate OpenAPI specifications
2. Test all code examples in guides
3. Verify internal links work
4. Check formatting and readability

# Testing commands:
npm run docs:validate          # Validate OpenAPI specs
npm run docs:test-examples     # Test code examples
npm run docs:lint             # Check markdown formatting
```

#### 4. Review and Deployment
```bash
# Documentation review checklist:
- [ ] All code examples tested and working
- [ ] No broken internal or external links
- [ ] New content follows style guidelines
- [ ] OpenAPI specs are valid and complete
- [ ] Changes are reflected in appropriate guides
- [ ] Master README.md updated if needed
```

### Emergency Documentation Updates

#### Critical Issues
For issues affecting production API usage:

```bash
# 1. Immediate hotfix documentation
# Update affected guides immediately
# Add prominent warning notices
# Notify users via appropriate channels

# 2. Example emergency update
# If authentication endpoint changes in production:
echo "⚠️ **URGENT UPDATE**: Authentication endpoint changed" >> AUTHENTICATION_REFERENCE.md
echo "New endpoint: POST /auth/v2/verify" >> AUTHENTICATION_REFERENCE.md
echo "Old endpoint deprecated immediately" >> AUTHENTICATION_REFERENCE.md
```

---

## Validation and Testing

### OpenAPI Specification Validation

#### Automated Validation
```bash
# Run OpenAPI validation before any deployment
npm run openapi:validate

# Validate individual path files
npx swagger-jsdoc src/openapi/paths/auth.js | npx swagger-codegen validate

# Check for breaking changes
npx openapi-diff old-spec.json new-spec.json
```

#### Manual Validation Checklist
- [ ] All endpoints documented with complete request/response examples
- [ ] Error responses include all possible HTTP status codes
- [ ] Authentication requirements clearly specified
- [ ] Parameter validation rules accurately documented
- [ ] Schema objects match actual API responses

### Code Example Testing

#### Automated Testing Framework
```javascript
// docs/examples/test-runner.js
// Automated testing of all code examples in documentation

class DocumentationExampleTester {
  async testAllExamples() {
    const files = await glob('docs/**/*.md');

    for (const file of files) {
      const examples = extractCodeExamples(file);
      for (const example of examples) {
        if (example.language === 'javascript' && example.runnable) {
          await this.testExample(example, file);
        }
      }
    }
  }

  async testExample(example, sourceFile) {
    try {
      // Run example in isolated context
      await eval(example.code);
      console.log(`✅ Example passed: ${sourceFile}`);
    } catch (error) {
      console.error(`❌ Example failed: ${sourceFile}`, error);
      this.failures.push({ file: sourceFile, error });
    }
  }
}
```

#### Manual Testing Checklist
- [ ] All API calls return expected responses
- [ ] Authentication examples work with current tokens
- [ ] Error handling examples trigger correctly
- [ ] Rate limiting examples demonstrate proper backoff
- [ ] File upload examples work with sample files

### Link Validation

#### Automated Link Checking
```bash
# Check all internal and external links
npm install -g markdown-link-check
find docs -name "*.md" -exec markdown-link-check {} \;

# Check OpenAPI documentation links
curl -s http://localhost:3003/api-docs.json | jq '.paths' > /dev/null
```

---

## Review and Approval Process

### Documentation Change Review

#### Review Criteria
1. **Technical Accuracy**
   - Code examples are correct and tested
   - API endpoints and parameters are accurate
   - Error scenarios are realistic and helpful

2. **Completeness**
   - All new features/changes documented
   - Migration guidance provided for breaking changes
   - Common use cases covered with examples

3. **Usability**
   - Clear, actionable instructions
   - Good progression from basic to advanced topics
   - Troubleshooting information included

4. **Consistency**
   - Follows established style guidelines
   - Uses consistent terminology
   - Integrates well with existing documentation

### Review Process

#### For Major Documentation Changes
1. **Technical Review** (Senior Developer)
   - Verify technical accuracy
   - Test all code examples
   - Check API specification completeness

2. **Editorial Review** (Documentation Lead)
   - Check writing quality and clarity
   - Verify style guide compliance
   - Ensure proper organization and flow

3. **User Experience Review** (Product)
   - Evaluate from developer perspective
   - Identify gaps or confusing areas
   - Suggest improvements for common use cases

#### For Minor Documentation Changes
1. **Peer Review** - Any team member can review
2. **Automated Checks** - Must pass all validation tests
3. **Self-Review Checklist** - Complete before submission

---

## Automated Maintenance

### GitHub Actions Integration

#### Documentation Validation Workflow
```yaml
# .github/workflows/docs-validation.yml
name: Documentation Validation

on:
  pull_request:
    paths:
      - 'docs/**'
      - 'src/openapi/**'
  push:
    branches: [main]

jobs:
  validate-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate OpenAPI Specs
        run: npm run openapi:validate

      - name: Test Documentation Examples
        run: npm run docs:test-examples

      - name: Check Links
        run: npm run docs:check-links

      - name: Lint Markdown
        run: npm run docs:lint
```

#### Auto-Update Detection
```yaml
# .github/workflows/docs-sync-check.yml
name: Documentation Sync Check

on:
  pull_request:
    paths:
      - 'src/routes/**'
      - 'src/openapi/**'

jobs:
  check-docs-sync:
    runs-on: ubuntu-latest
    steps:
      - name: Check for API Changes
        run: |
          # Compare OpenAPI specs for breaking changes
          # Flag PRs that need documentation updates
          npm run docs:sync-check
```

### Monitoring and Alerts

#### Documentation Health Monitoring
```javascript
// scripts/docs-health-check.js
class DocumentationHealthMonitor {
  async runHealthCheck() {
    const results = {
      openapi: await this.validateOpenAPI(),
      examples: await this.testCodeExamples(),
      links: await this.checkLinks(),
      coverage: await this.checkCoverage()
    };

    if (results.errors > 0) {
      await this.sendAlert(results);
    }

    return results;
  }

  async sendAlert(results) {
    // Send Slack/email notification for documentation issues
    // Include specific failures and recommended actions
  }
}

// Run daily
const monitor = new DocumentationHealthMonitor();
monitor.runHealthCheck();
```

---

## Troubleshooting

### Common Documentation Issues

#### Issue: Outdated Code Examples
**Symptoms:** Examples fail to work, generate errors, or use deprecated patterns

**Solution:**
1. Run documentation example tests: `npm run docs:test-examples`
2. Update examples with current API patterns
3. Add automated testing for new examples
4. Update review process to catch outdated examples

#### Issue: Broken Internal Links
**Symptoms:** Links return 404 errors, navigation is broken

**Solution:**
1. Run link validation: `npm run docs:check-links`
2. Update broken links to correct targets
3. Use relative paths for internal documentation links
4. Set up automated link checking in CI/CD

#### Issue: Inconsistent Information
**Symptoms:** Different guides provide conflicting instructions

**Solution:**
1. Identify conflicting documentation sections
2. Determine authoritative source of truth
3. Update all references to match authoritative version
4. Add cross-references between related sections

#### Issue: Missing Documentation for New Features
**Symptoms:** Developers ask questions about undocumented features

**Solution:**
1. Review recent code changes for undocumented APIs
2. Add OpenAPI specifications for new endpoints
3. Update relevant integration guides
4. Improve development process to require documentation

### Documentation Recovery Procedures

#### If Documentation Gets Out of Sync
```bash
# 1. Audit current state
npm run docs:audit                    # Check what's documented vs implemented
git log --oneline --since="1 month ago" src/routes/  # Recent API changes

# 2. Identify gaps
npm run docs:coverage-report          # Find undocumented endpoints
npm run docs:example-validation       # Find broken examples

# 3. Systematic recovery
npm run docs:regenerate-openapi       # Rebuild from route annotations
npm run docs:fix-examples            # Update all code examples
npm run docs:verify-complete         # Final validation
```

#### Emergency Documentation Deployment
```bash
# For critical documentation fixes that need immediate deployment
git checkout -b docs/emergency-fix
# Make critical updates
git commit -m "docs: emergency fix for [critical issue]"
git push origin docs/emergency-fix

# Deploy documentation only (if separate from main app)
npm run docs:deploy:emergency
```

---

## Maintenance Schedule

### Daily Automated Tasks
- **Link validation** - Check for broken links
- **OpenAPI validation** - Ensure specs are valid
- **Example testing** - Test sample code in guides

### Weekly Manual Tasks
- **Review user feedback** - Check for documentation issues reported
- **Update examples** - Ensure all examples use current best practices
- **Cross-reference validation** - Verify consistency between guides

### Monthly Comprehensive Review
- **Full documentation audit** - Review all guides for accuracy
- **Performance analysis** - Check doc site performance and usability
- **User journey testing** - Test full integration workflows
- **Archive cleanup** - Review archived docs for permanent removal

### Quarterly Strategic Review
- **Documentation architecture review** - Assess overall structure
- **Tool evaluation** - Review documentation tools and workflows
- **Style guide updates** - Refine writing and formatting standards
- **Training and onboarding** - Update team documentation processes

---

## Success Metrics

### Documentation Quality Metrics
- **Accuracy Rate**: % of code examples that work without modification
- **Completeness Score**: % of API endpoints with complete documentation
- **Freshness Index**: Average age of documentation updates
- **User Satisfaction**: Developer feedback scores and issue reports

### Process Efficiency Metrics
- **Time to Documentation**: Average time from code change to doc update
- **Review Cycle Time**: Average time for documentation review and approval
- **Issue Resolution Time**: Time to fix reported documentation problems
- **Automation Coverage**: % of documentation tasks that are automated

### Target Goals
- **99% accurate code examples** - All examples must work as written
- **100% API coverage** - Every public endpoint documented
- **< 30 day documentation age** - All docs updated within 30 days
- **< 24 hour critical fix time** - Emergency documentation fixes deployed quickly

---

## Getting Help

### For Documentation Issues
1. **Check this maintenance guide** for standard procedures
2. **Review recent changes** in documentation repository
3. **Test locally** to reproduce documentation problems
4. **Create detailed issue report** with specific examples

### For Process Questions
1. **Consult team lead** for documentation standards
2. **Review approved examples** in existing documentation
3. **Check automation logs** for validation error details
4. **Update this guide** if new procedures are established

---

*This guide is a living document. Update it as processes evolve and improve. Last updated: December 2025*