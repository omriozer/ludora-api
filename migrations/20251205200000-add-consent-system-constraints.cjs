'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔄 Adding consent system database constraints...');

    // Add constraint to ensure only students can have linked_teacher_id
    console.log('🔧 Adding student-teacher linking constraint...');
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "user"
        ADD CONSTRAINT chk_user_student_teacher_link
        CHECK (
          (user_type != 'student' AND linked_teacher_id IS NULL) OR
          (user_type = 'student')
        )
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Student-teacher linking constraint already exists');
      } else {
        throw error;
      }
    }

    // Add foreign key constraint for age_verified_by (already references user table)
    console.log('🔗 Adding age_verified_by foreign key constraint...');
    try {
      await queryInterface.addConstraint('user', {
        name: 'fk_user_age_verified_by',
        type: 'foreign key',
        fields: ['age_verified_by'],
        references: {
          table: 'user',
          field: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Age verification foreign key already exists');
      } else {
        throw error;
      }
    }

    // Note: Complex business logic constraints (like ensuring linked_teacher_id references
    // active teachers) are enforced at the application level rather than database level
    // to avoid PostgreSQL subquery limitations in check constraints.

    // Add constraint to prevent self-referential teacher links
    console.log('🔧 Adding self-reference prevention constraint...');
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE "user"
        ADD CONSTRAINT chk_user_no_self_teacher_link
        CHECK (id != linked_teacher_id)
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Self-reference prevention constraint already exists');
      } else {
        throw error;
      }
    }

    // Add constraint to ensure consent method is valid
    console.log('🔧 Adding consent method validation constraint...');
    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE parentconsent
        ADD CONSTRAINT chk_parentconsent_consent_method_valid
        CHECK (consent_method IN ('email', 'form', 'phone'))
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Consent method validation constraint already exists');
      } else {
        throw error;
      }
    }

    // Add composite unique constraint to prevent duplicate active consents
    console.log('🔧 Adding unique active consent constraint...');
    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX idx_parentconsent_unique_active
        ON parentconsent (student_user_id)
        WHERE revoked_at IS NULL
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Unique active consent constraint already exists');
      } else {
        throw error;
      }
    }

    // Add index for efficient teacher-student queries
    console.log('📊 Adding teacher-student query optimization index...');
    try {
      await queryInterface.addIndex('user', {
        name: 'idx_user_teacher_student_lookup',
        fields: ['user_type', 'linked_teacher_id', 'is_active']
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Teacher-student lookup index already exists');
      } else {
        throw error;
      }
    }

    // Add index for age verification queries
    try {
      await queryInterface.addIndex('user', {
        name: 'idx_user_age_verified_by',
        fields: ['age_verified_by']
      });
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️ Age verification index already exists');
      } else {
        throw error;
      }
    }

    console.log('✅ Consent system database constraints added successfully');
    console.log('🎯 Migration completed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔄 Rolling back consent system database constraints...');

    // Remove indexes first
    const indexesToRemove = [
      'idx_user_age_verified_by',
      'idx_user_teacher_student_lookup',
      'idx_parentconsent_unique_active'
    ];

    for (const indexName of indexesToRemove) {
      try {
        await queryInterface.removeIndex('user', indexName);
      } catch (error) {
        try {
          await queryInterface.removeIndex('parentconsent', indexName);
        } catch (error2) {
          console.log(`⚠️ Index ${indexName} removal failed:`, error.message);
        }
      }
    }

    // Remove constraints
    const userConstraints = [
      'chk_user_no_self_teacher_link',
      'fk_user_age_verified_by',
      'chk_user_student_teacher_link'
    ];

    for (const constraintName of userConstraints) {
      try {
        await queryInterface.removeConstraint('user', constraintName);
      } catch (error) {
        console.log(`⚠️ User constraint ${constraintName} removal failed:`, error.message);
      }
    }

    const parentConsentConstraints = [
      'chk_parentconsent_consent_method_valid'
    ];

    for (const constraintName of parentConsentConstraints) {
      try {
        await queryInterface.removeConstraint('parentconsent', constraintName);
      } catch (error) {
        console.log(`⚠️ ParentConsent constraint ${constraintName} removal failed:`, error.message);
      }
    }

    console.log('❌ Removed consent system database constraints');
    console.log('🔄 Migration rollback completed');
  }
};