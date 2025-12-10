#!/usr/bin/env node

/**
 * Documentation Validation Script
 * Comprehensive validation for Ludora API documentation
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { exec } from 'child_process';
import { promisify } from 'util';
import markdownLinkCheck from 'markdown-link-check';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

class DocumentationValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.stats = {
      filesChecked: 0,
      linksChecked: 0,
      examplesValidated: 0,
      openApiEndpoints: 0
    };
  }

  async validate() {
    console.log('🔍 Starting comprehensive documentation validation...\n');

    try {
      // Core validation tasks
      await this.validateOpenApiSpecs();
      await this.validateMarkdownFiles();
      await this.validateCodeExamples();
      await this.validateInternalLinks();
      await this.validateDocumentationStructure();

      this.printResults();
      return this.errors.length === 0;
    } catch (error) {
      console.error('❌ Validation failed with error:', error.message);
      return false;
    }
  }

  async validateOpenApiSpecs() {
    console.log('📋 Validating OpenAPI specifications...');

    const openApiFiles = await glob('src/openapi/**/*.js');

    for (const file of openApiFiles) {
      try {
        // Dynamically import the OpenAPI file
        const spec = await import(path.resolve(file));

        // Validate structure
        if (spec.default && typeof spec.default === 'object') {
          this.validateOpenApiStructure(spec.default, file);
          this.stats.openApiEndpoints += Object.keys(spec.default).length;
        } else {
          this.errors.push(`OpenAPI file ${file} does not export a valid specification object`);
        }
      } catch (error) {
        this.errors.push(`Failed to load OpenAPI file ${file}: ${error.message}`);
      }
    }

    this.stats.filesChecked += openApiFiles.length;
    console.log(`  ✅ Validated ${openApiFiles.length} OpenAPI files`);
  }

  validateOpenApiStructure(spec, filename) {
    for (const [path, methods] of Object.entries(spec)) {
      if (typeof methods !== 'object') {
        this.warnings.push(`Path ${path} in ${filename} should be an object`);
        continue;
      }

      for (const [method, definition] of Object.entries(methods)) {
        const httpMethods = ['get', 'post', 'put', 'delete', 'patch'];
        if (!httpMethods.includes(method.toLowerCase())) {
          continue; // Skip non-HTTP method properties
        }

        // Required fields validation
        if (!definition.summary) {
          this.errors.push(`${method.toUpperCase()} ${path} missing required 'summary' field`);
        }
        if (!definition.description) {
          this.warnings.push(`${method.toUpperCase()} ${path} missing 'description' field`);
        }
        if (!definition.responses) {
          this.errors.push(`${method.toUpperCase()} ${path} missing 'responses' field`);
        }

        // Validate response codes
        if (definition.responses) {
          this.validateResponseCodes(definition.responses, `${method.toUpperCase()} ${path}`);
        }
      }
    }
  }

  validateResponseCodes(responses, endpoint) {
    const hasSuccess = Object.keys(responses).some(code =>
      code.startsWith('2') || code === 'default'
    );

    if (!hasSuccess) {
      this.warnings.push(`${endpoint} has no success response codes (2xx)`);
    }

    // Check for common error responses
    const commonErrors = ['400', '401', '403', '404', '500'];
    const hasErrorHandling = commonErrors.some(code => responses[code]);

    if (!hasErrorHandling) {
      this.warnings.push(`${endpoint} missing common error response codes`);
    }
  }

  async validateMarkdownFiles() {
    console.log('📝 Validating Markdown files...');

    const markdownFiles = await glob('docs/**/*.md');

    for (const file of markdownFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        this.validateMarkdownStructure(content, file);
        this.stats.filesChecked++;
      } catch (error) {
        this.errors.push(`Failed to read Markdown file ${file}: ${error.message}`);
      }
    }

    console.log(`  ✅ Validated ${markdownFiles.length} Markdown files`);
  }

  validateMarkdownStructure(content, filename) {
    const lines = content.split('\n');
    let hasH1 = false;
    let codeBlockCount = 0;
    let inCodeBlock = false;
    let codeBlockType = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Check for H1 headings
      if (line.startsWith('# ') && !hasH1) {
        hasH1 = true;
      } else if (line.startsWith('# ') && hasH1) {
        this.warnings.push(`${filename}:${lineNum} - Multiple H1 headings found`);
      }

      // Track code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockType = line.slice(3).trim();
          codeBlockCount++;
        } else {
          inCodeBlock = false;
          codeBlockType = null;
        }
      }

      // Validate code block content
      if (inCodeBlock && codeBlockType === 'javascript') {
        this.validateJavaScriptExample(line, filename, lineNum);
      }
    }

    if (!hasH1) {
      this.warnings.push(`${filename} - No H1 heading found`);
    }

    // Track code examples for later validation
    this.stats.examplesValidated += codeBlockCount;
  }

  validateJavaScriptExample(line, filename, lineNum) {
    // Check for common anti-patterns in code examples
    if (line.includes('console.log(') || line.includes('console.error(')) {
      // Allow console usage in examples
      return;
    }

    // Check for fetch without error handling
    if (line.includes('fetch(') && !line.includes('catch')) {
      this.warnings.push(`${filename}:${lineNum} - fetch() without error handling in example`);
    }

    // Check for async/await without try/catch
    if (line.includes('await ') && !filename.includes('try')) {
      // This is a simplified check - would need more sophisticated parsing for real validation
    }
  }

  async validateCodeExamples() {
    console.log('💻 Validating JavaScript code examples...');

    const markdownFiles = await glob('docs/**/*.md');
    let totalExamples = 0;

    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const examples = this.extractJavaScriptExamples(content);

      for (const example of examples) {
        try {
          // Basic syntax validation using Node.js parser
          new Function(example.code);
          totalExamples++;
        } catch (error) {
          this.errors.push(`${file} - Invalid JavaScript syntax in example: ${error.message}`);
        }
      }
    }

    console.log(`  ✅ Validated ${totalExamples} JavaScript examples`);
  }

  extractJavaScriptExamples(content) {
    const examples = [];
    const codeBlocks = content.match(/```javascript\\n([\\s\\S]*?)\\n```/g) || [];

    codeBlocks.forEach(block => {
      const code = block
        .replace(/```javascript\\n/, '')
        .replace(/\\n```$/, '')
        .trim();

      if (code.length > 0) {
        examples.push({ code });
      }
    });

    return examples;
  }

  async validateInternalLinks() {
    console.log('🔗 Validating internal links...');

    const markdownFiles = await glob('docs/**/*.md');
    const allFiles = new Set(markdownFiles.map(f => path.basename(f)));

    for (const file of markdownFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const links = this.extractInternalLinks(content);

      for (const link of links) {
        if (!this.validateInternalLink(link, file, allFiles)) {
          this.errors.push(`${file} - Broken internal link: ${link}`);
        }
        this.stats.linksChecked++;
      }
    }

    console.log(`  ✅ Validated ${this.stats.linksChecked} internal links`);
  }

  extractInternalLinks(content) {
    const linkPattern = /\\[([^\\]]+)\\]\\(([^)]+)\\)/g;
    const links = [];
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const url = match[2];

      // Filter for internal links (relative paths, #anchors)
      if (url.startsWith('./') || url.startsWith('../') || url.startsWith('#') ||
          (!url.startsWith('http') && !url.startsWith('mailto:'))) {
        links.push(url);
      }
    }

    return links;
  }

  validateInternalLink(link, sourceFile, allFiles) {
    // Handle anchor links within the same file
    if (link.startsWith('#')) {
      return true; // Would need content parsing to validate anchors
    }

    // Handle relative file links
    const resolvedPath = path.resolve(path.dirname(sourceFile), link);
    const fileName = path.basename(resolvedPath);

    // Check if target file exists
    return fs.existsSync(resolvedPath) || allFiles.has(fileName);
  }

  async validateDocumentationStructure() {
    console.log('📁 Validating documentation structure...');

    const requiredFiles = [
      'docs/README.md',
      'docs/DEVELOPMENT_SETUP_GUIDE.md',
      'docs/API_INTEGRATION_GUIDE.md',
      'docs/AUTHENTICATION_REFERENCE.md',
      'docs/ERROR_HANDLING_REFERENCE.md'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        this.errors.push(`Required documentation file missing: ${file}`);
      }
    }

    // Check for master index
    if (fs.existsSync('docs/README.md')) {
      const content = fs.readFileSync('docs/README.md', 'utf-8');
      if (!content.includes('Quick Start') || !content.includes('Table of Contents')) {
        this.warnings.push('Master README.md should include Quick Start and Table of Contents');
      }
    }

    console.log('  ✅ Documentation structure validated');
  }

  printResults() {
    console.log('\\n📊 Validation Results:');
    console.log('═'.repeat(50));

    console.log(`📁 Files checked: ${this.stats.filesChecked}`);
    console.log(`📋 OpenAPI endpoints: ${this.stats.openApiEndpoints}`);
    console.log(`🔗 Links validated: ${this.stats.linksChecked}`);
    console.log(`💻 Code examples: ${this.stats.examplesValidated}`);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\\n✅ All documentation validation checks passed!');
      return;
    }

    if (this.errors.length > 0) {
      console.log(`\\n❌ ${this.errors.length} Error(s):`);
      this.errors.forEach(error => console.log(`  • ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\\n⚠️  ${this.warnings.length} Warning(s):`);
      this.warnings.forEach(warning => console.log(`  • ${warning}`));
    }

    console.log('\\n' + '═'.repeat(50));

    if (this.errors.length > 0) {
      console.log('❌ Validation failed. Please fix errors before proceeding.');
      process.exit(1);
    } else {
      console.log('✅ Validation passed with warnings. Review warnings above.');
    }
  }
}

// Main execution
async function main() {
  const validator = new DocumentationValidator();
  const success = await validator.validate();

  if (!success) {
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Validation script failed:', error);
    process.exit(1);
  });
}

export default DocumentationValidator;