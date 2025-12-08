#!/usr/bin/env node
/**
 * Export OpenAPI Specification to JSON file
 *
 * This script generates the OpenAPI spec without starting the full server.
 * Used for frontend type generation pipeline.
 *
 * Usage: node scripts/export-openapi-spec.js [output-path]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { specs } from '../src/openapi/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get output path from args or use default
const outputPath = process.argv[2] || path.join(__dirname, '..', 'openapi-spec.json');

try {
  // Write OpenAPI spec to file
  fs.writeFileSync(outputPath, JSON.stringify(specs, null, 2), 'utf8');

  console.log('✅ OpenAPI specification exported successfully');
  console.log(`📄 Output: ${outputPath}`);
  console.log(`📊 Endpoints: ${Object.keys(specs.paths || {}).length}`);
  console.log(`📋 Schemas: ${Object.keys(specs.components?.schemas || {}).length}`);

  process.exit(0);
} catch (error) {
  console.error('❌ Failed to export OpenAPI specification:', error.message);
  process.exit(1);
}
