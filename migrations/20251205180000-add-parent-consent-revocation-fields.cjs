'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding revocation fields to ParentConsent table...');

    // Check if table exists first
    const tableExists = await queryInterface.sequelize.query(
      "SELECT to_regclass('public.parentconsent') AS exists",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!tableExists[0].exists) {
      console.log('❌ ParentConsent table does not exist, skipping migration');
      return;
    }

    // Check if columns already exist
    const tableDescription = await queryInterface.describeTable('parentconsent');

    // Add revoked_at column
    if (!tableDescription.revoked_at) {
      console.log('➕ Adding revoked_at column...');
      await queryInterface.addColumn('parentconsent', 'revoked_at', {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when consent was revoked (NULL = still active)'
      });
    } else {
      console.log('⚠️ revoked_at column already exists');
    }

    // Add revoked_by column
    if (!tableDescription.revoked_by) {
      console.log('➕ Adding revoked_by column...');
      await queryInterface.addColumn('parentconsent', 'revoked_by', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User ID of who revoked consent (parent, teacher, admin)'
      });
    } else {
      console.log('⚠️ revoked_by column already exists');
    }

    // Add revocation_reason column
    if (!tableDescription.revocation_reason) {
      console.log('➕ Adding revocation_reason column...');
      await queryInterface.addColumn('parentconsent', 'revocation_reason', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Reason for consent revocation'
      });
    } else {
      console.log('⚠️ revocation_reason column already exists');
    }

    // Add revocation_ip column
    if (!tableDescription.revocation_ip) {
      console.log('➕ Adding revocation_ip column...');
      await queryInterface.addColumn('parentconsent', 'revocation_ip', {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IP address when consent was revoked (for audit trail)'
      });
    } else {
      console.log('⚠️ revocation_ip column already exists');
    }

    // Add revocation_user_agent column
    if (!tableDescription.revocation_user_agent) {
      console.log('➕ Adding revocation_user_agent column...');
      await queryInterface.addColumn('parentconsent', 'revocation_user_agent', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Browser user agent when consent was revoked (for audit trail)'
      });
    } else {
      console.log('⚠️ revocation_user_agent column already exists');
    }

    // Add foreign key constraint for revoked_by field
    console.log('🔗 Adding foreign key constraint for revoked_by...');
    try {
      await queryInterface.addConstraint('parentconsent', {
        name: 'fk_parentconsent_revoked_by',
        type: 'foreign key',
        fields: ['revoked_by'],
        references: {
          table: 'user',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Foreign key constraint already exists');
      } else {
        throw error;
      }
    }

    // Add database constraint for valid revocation reasons
    console.log('🔧 Adding check constraint for revocation_reason...');
    try {
      await queryInterface.addConstraint('parentconsent', {
        name: 'chk_parentconsent_revocation_reason',
        type: 'check',
        fields: ['revocation_reason'],
        where: {
          revocation_reason: {
            [Sequelize.Op.or]: [
              { [Sequelize.Op.is]: null },
              { [Sequelize.Op.in]: ['parent_request', 'teacher_unlink', 'admin_action', 'student_deactivation', 'system_cleanup'] }
            ]
          }
        }
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Check constraint already exists');
      } else {
        throw error;
      }
    }

    // Add database constraint to ensure revocation data consistency
    console.log('🔧 Adding revocation consistency constraint...');
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE parentconsent
        ADD CONSTRAINT chk_parentconsent_revocation_consistency
        CHECK (
          (revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL) OR
          (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL)
        )
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Revocation consistency constraint already exists');
      } else {
        throw error;
      }
    }

    // Add indexes for efficient querying of revocation data
    console.log('📊 Adding indexes for revocation fields...');

    try {
      await queryInterface.addIndex('parentconsent', {
        name: 'idx_parentconsent_revoked_at',
        fields: ['revoked_at']
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ revoked_at index already exists');
      } else {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex('parentconsent', {
        name: 'idx_parentconsent_revoked_by',
        fields: ['revoked_by']
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ revoked_by index already exists');
      } else {
        throw error;
      }
    }

    try {
      await queryInterface.addIndex('parentconsent', {
        name: 'idx_parentconsent_revocation_reason',
        fields: ['revocation_reason']
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ revocation_reason index already exists');
      } else {
        throw error;
      }
    }

    // Add composite index for active consent queries
    try {
      await queryInterface.addIndex('parentconsent', {
        name: 'idx_parentconsent_active_consent',
        fields: ['student_user_id', 'revoked_at'],
        where: {
          revoked_at: null
        }
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ active consent composite index already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ Parent consent revocation fields added successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back parent consent revocation fields...');

    // Remove constraints first
    try {
      await queryInterface.removeConstraint('parentconsent', 'chk_parentconsent_revocation_consistency');
    } catch (error) {
      console.log('⚠️ Revocation consistency constraint removal failed:', error.message);
    }

    try {
      await queryInterface.removeConstraint('parentconsent', 'chk_parentconsent_revocation_reason');
    } catch (error) {
      console.log('⚠️ Revocation reason constraint removal failed:', error.message);
    }

    try {
      await queryInterface.removeConstraint('parentconsent', 'fk_parentconsent_revoked_by');
    } catch (error) {
      console.log('⚠️ Foreign key constraint removal failed:', error.message);
    }

    // Remove indexes
    const indexesToRemove = [
      'idx_parentconsent_active_consent',
      'idx_parentconsent_revocation_reason',
      'idx_parentconsent_revoked_by',
      'idx_parentconsent_revoked_at'
    ];

    for (const indexName of indexesToRemove) {
      try {
        await queryInterface.removeIndex('parentconsent', indexName);
      } catch (error) {
        console.log(`⚠️ Index ${indexName} removal failed:`, error.message);
      }
    }

    // Remove columns
    const columnsToRemove = [
      'revocation_user_agent',
      'revocation_ip',
      'revocation_reason',
      'revoked_by',
      'revoked_at'
    ];

    for (const columnName of columnsToRemove) {
      try {
        await queryInterface.removeColumn('parentconsent', columnName);
      } catch (error) {
        console.log(`⚠️ Column ${columnName} removal failed:`, error.message);
      }
    }

    console.log('❌ Removed parent consent revocation fields');
    console.log('🔄 Migration rollback completed');
  }
};