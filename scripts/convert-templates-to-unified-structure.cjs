#!/usr/bin/env node

/**
 * Template Structure Conversion Script
 *
 * Converts existing template data from mixed built-in/custom structure
 * to unified array-based structure: elements: {logo: [...], text: [...], etc.}
 */

const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Load environment variables from parent directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database connection using correct credentials from .env
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ludora_development',
  username: process.env.DB_USER || 'ludora_user',
  password: process.env.DB_PASSWORD || 'ludora_dev_pass'
};

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
  host: dbConfig.host,
  port: dbConfig.port,
  dialect: 'postgres',
  logging: console.log, // Enable logging to see what's happening
});

// Define SystemTemplate model (minimal version for reading data)
const SystemTemplate = sequelize.define('SystemTemplate', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  template_type: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  target_format: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  template_data: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'system_templates',
  underscored: true
});

/**
 * Convert old template structure to new unified array-based structure
 */
function convertTemplateStructure(oldData) {
  console.log('\n🔄 Converting template structure...');
  console.log('📥 Input structure keys:', Object.keys(oldData));

  const newData = {
    elements: {}
  };

  // Convert built-in elements to arrays
  const builtInTypes = ['logo', 'url', 'copyright-text', 'user-info'];
  builtInTypes.forEach(type => {
    if (oldData[type]) {
      console.log(`  ✅ Converting built-in ${type}`);
      newData.elements[type] = [{ ...oldData[type] }];
    }
  });

  // Convert custom elements to type-based arrays
  if (oldData.customElements) {
    console.log(`  📦 Processing ${Object.keys(oldData.customElements).length} custom elements`);

    Object.entries(oldData.customElements).forEach(([elementId, element]) => {
      const elementType = element.type || 'free-text';

      console.log(`    🔹 Converting ${elementId} (type: ${elementType})`);

      // Initialize array if it doesn't exist
      if (!newData.elements[elementType]) {
        newData.elements[elementType] = [];
      }

      // Remove the 'type' field and add to appropriate array
      const {type, ...elementWithoutType} = element;
      newData.elements[elementType].push(elementWithoutType);
    });
  }

  // Copy any other top-level properties (settings, etc.)
  Object.entries(oldData).forEach(([key, value]) => {
    if (!builtInTypes.includes(key) && key !== 'customElements') {
      console.log(`  📋 Preserving top-level property: ${key}`);
      newData[key] = value;
    }
  });

  console.log('📤 Output structure:');
  Object.entries(newData.elements).forEach(([type, elements]) => {
    console.log(`  ${type}: ${elements.length} element(s)`);
  });

  return newData;
}

/**
 * Create backup of existing data before conversion
 */
async function createBackup(templates) {
  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const backupFile = path.join(backupDir, `templates-backup-${timestamp}.json`);

  fs.writeFileSync(backupFile, JSON.stringify(templates, null, 2));
  console.log(`💾 Backup created: ${backupFile}`);
  return backupFile;
}

/**
 * Main conversion function
 */
async function main() {
  try {
    console.log('🚀 Starting template structure conversion...');

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Read all existing templates
    const templates = await SystemTemplate.findAll({
      order: [['template_type', 'ASC'], ['target_format', 'ASC']]
    });

    if (templates.length === 0) {
      console.log('⚠️ No templates found in database');
      return;
    }

    console.log(`📊 Found ${templates.length} templates to convert`);

    // Create backup
    const backupFile = await createBackup(templates.map(t => t.toJSON()));

    // Convert each template
    const convertedTemplates = templates.map(template => {
      console.log(`\n🏷️ Converting: ${template.name} (${template.template_type} - ${template.target_format})`);

      const oldData = template.template_data;
      const newData = convertTemplateStructure(oldData);

      return {
        ...template.toJSON(),
        template_data: newData
      };
    });

    // Save converted templates to file for manual review
    const outputFile = path.join(__dirname, 'converted-templates.json');
    fs.writeFileSync(outputFile, JSON.stringify(convertedTemplates, null, 2));
    console.log(`\n📄 Converted templates saved to: ${outputFile}`);

    // Generate update SQL statements
    const sqlFile = path.join(__dirname, 'update-templates.sql');
    const sqlStatements = convertedTemplates.map(template => {
      const dataJson = JSON.stringify(template.template_data).replace(/'/g, "''");
      return `UPDATE system_templates SET template_data = '${dataJson}'::jsonb WHERE id = '${template.id}';`;
    });

    fs.writeFileSync(sqlFile, sqlStatements.join('\n\n'));
    console.log(`📝 SQL update statements saved to: ${sqlFile}`);

    console.log('\n✅ Conversion complete! Next steps:');
    console.log('1. Review converted-templates.json');
    console.log('2. Test converted structure in development');
    console.log('3. Run SQL statements manually: psql -f update-templates.sql');
    console.log(`4. Backup available at: ${backupFile}`);

  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the conversion
if (require.main === module) {
  main();
}

module.exports = { convertTemplateStructure };