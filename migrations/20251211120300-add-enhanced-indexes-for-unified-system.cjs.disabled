/**
 * Migration: Add Enhanced Indexes for Unified Student ID System
 *
 * Adds performance indexes to support the unified student_id architecture:
 * - Player management and migration tracking
 * - UserSession with student_id field (unified approach)
 * - ClassroomMembership with student_id field
 * - Authentication and session management
 * - Settings-based access control queries
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Adding enhanced indexes for unified student_id system...');

      // ===========================================
      // PLAYER TABLE INDEXES
      // ===========================================

      // Player teacher management index (for teachers viewing their players)
      try {
        await queryInterface.addIndex('player', {
          fields: ['teacher_id', 'is_active'],
          name: 'idx_player_teacher_active'
        }, { transaction });
        console.log('✅ Created idx_player_teacher_active');
      } catch (error) {
        console.log('⚠️ Index idx_player_teacher_active may already exist');
      }

      // Player online status index (for real-time features)
      try {
        await queryInterface.addIndex('player', {
          fields: ['is_online'],
          name: 'idx_player_online'
        }, { transaction });
        console.log('✅ Created idx_player_online');
      } catch (error) {
        console.log('⚠️ Index idx_player_online may already exist');
      }

      // Player last seen index (for activity tracking)
      try {
        await queryInterface.addIndex('player', {
          fields: ['last_seen'],
          name: 'idx_player_last_seen'
        }, { transaction });
        console.log('✅ Created idx_player_last_seen');
      } catch (error) {
        console.log('⚠️ Index idx_player_last_seen may already exist');
      }

      // Teacher + online status compound index (for teacher dashboard)
      try {
        await queryInterface.addIndex('player', {
          fields: ['teacher_id', 'is_online'],
          name: 'idx_player_teacher_online'
        }, { transaction });
        console.log('✅ Created idx_player_teacher_online');
      } catch (error) {
        console.log('⚠️ Index idx_player_teacher_online may already exist');
      }

      // Player display name index (for search functionality)
      try {
        await queryInterface.addIndex('player', {
          fields: ['display_name'],
          name: 'idx_player_display_name'
        }, { transaction });
        console.log('✅ Created idx_player_display_name');
      } catch (error) {
        console.log('⚠️ Index idx_player_display_name may already exist');
      }

      // ===========================================
      // USER_SESSION TABLE INDEXES (UNIFIED STUDENT_ID)
      // ===========================================

      // UserSession student_id index (for unified student sessions)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id'],
          name: 'idx_user_session_student_id'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_id');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_id may already exist');
      }

      // UserSession portal-specific indexes
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal'],
          name: 'idx_user_session_portal'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal may already exist');
      }

      // Active sessions by portal
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal', 'is_active'],
          name: 'idx_user_session_portal_active'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal_active may already exist');
      }

      // Student sessions by portal (unified approach)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['portal', 'student_id'],
          name: 'idx_user_session_portal_student'
        }, { transaction });
        console.log('✅ Created idx_user_session_portal_student');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_portal_student may already exist');
      }

      // Student active sessions (performance)
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id', 'is_active'],
          name: 'idx_user_session_student_active'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_active may already exist');
      }

      // Student session expiration
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['student_id', 'expires_at'],
          name: 'idx_user_session_student_expires'
        }, { transaction });
        console.log('✅ Created idx_user_session_student_expires');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_student_expires may already exist');
      }

      // Session cleanup performance index
      try {
        await queryInterface.addIndex('user_session', {
          fields: ['expires_at', 'is_active'],
          name: 'idx_user_session_expiration_cleanup'
        }, { transaction });
        console.log('✅ Created idx_user_session_expiration_cleanup');
      } catch (error) {
        console.log('⚠️ Index idx_user_session_expiration_cleanup may already exist');
      }

      // ===========================================
      // CLASSROOMMEMBERSHIP TABLE INDEXES (UNIFIED STUDENT_ID)
      // ===========================================

      // Student membership queries (unified student_id)
      try {
        await queryInterface.addIndex('classroommembership', {
          fields: ['student_id'],
          name: 'idx_classroommembership_student'
        }, { transaction });
        console.log('✅ Created idx_classroommembership_student');
      } catch (error) {
        console.log('⚠️ Index idx_classroommembership_student may already exist');
      }

      // Unique membership constraint (updated for student_id)
      try {
        await queryInterface.addIndex('classroommembership', {
          unique: true,
          fields: ['classroom_id', 'student_id'],
          name: 'idx_classroommembership_unique_student_membership'
        }, { transaction });
        console.log('✅ Created idx_classroommembership_unique_student_membership');
      } catch (error) {
        console.log('⚠️ Index idx_classroommembership_unique_student_membership may already exist');
      }

      // ===========================================
      // CLASSROOM TABLE INDEXES
      // ===========================================

      // Teacher active classrooms index
      try {
        await queryInterface.addIndex('classroom', {
          fields: ['teacher_id', 'is_active'],
          name: 'idx_classroom_teacher_active'
        }, { transaction });
        console.log('✅ Created idx_classroom_teacher_active');
      } catch (error) {
        console.log('⚠️ Index idx_classroom_teacher_active may already exist');
      }

      // Classroom invitation code index (for student signup)
      try {
        await queryInterface.addIndex('classroom', {
          fields: ['teacher_invitation_code'],
          name: 'idx_classroom_invitation_code'
        }, { transaction });
        console.log('✅ Created idx_classroom_invitation_code');
      } catch (error) {
        console.log('⚠️ Index idx_classroom_invitation_code may already exist');
      }

      // ===========================================
      // USER TABLE INDEXES
      // ===========================================

      // User type index (for student/teacher filtering)
      try {
        await queryInterface.addIndex('user', {
          fields: ['user_type'],
          name: 'idx_user_type'
        }, { transaction });
        console.log('✅ Created idx_user_type');
      } catch (error) {
        console.log('⚠️ Index idx_user_type may already exist');
      }

      // User verification status index
      try {
        await queryInterface.addIndex('user', {
          fields: ['is_verified'],
          name: 'idx_user_verified'
        }, { transaction });
        console.log('✅ Created idx_user_verified');
      } catch (error) {
        console.log('⚠️ Index idx_user_verified may already exist');
      }

      // User active status index
      try {
        await queryInterface.addIndex('user', {
          fields: ['is_active'],
          name: 'idx_user_active'
        }, { transaction });
        console.log('✅ Created idx_user_active');
      } catch (error) {
        console.log('⚠️ Index idx_user_active may already exist');
      }

      // Teacher invitation code index
      try {
        await queryInterface.addIndex('user', {
          fields: ['invitation_code'],
          name: 'idx_user_invitation_code'
        }, { transaction });
        console.log('✅ Created idx_user_invitation_code');
      } catch (error) {
        console.log('⚠️ Index idx_user_invitation_code may already exist');
      }

      // ===========================================
      // PARENTCONSENT TABLE INDEXES (USER_ID ONLY)
      // ===========================================

      // Student consent status index (users only - never players)
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['student_user_id'],
          name: 'idx_parentconsent_student'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_student');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_student may already exist');
      }

      // Teacher consent management index
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['given_by_teacher_id'],
          name: 'idx_parentconsent_teacher'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_teacher');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_teacher may already exist');
      }

      // Consent status tracking index
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['consent_revoked_at'],
          name: 'idx_parentconsent_revoked'
        }, { transaction });
        console.log('✅ Created idx_parentconsent_revoked');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_revoked may already exist');
      }

      // Active consents index (commonly used query)
      try {
        await queryInterface.addIndex('parentconsent', {
          fields: ['student_user_id', 'consent_revoked_at'],
          name: 'idx_parentconsent_student_active',
          where: {
            consent_revoked_at: null
          }
        }, { transaction });
        console.log('✅ Created idx_parentconsent_student_active');
      } catch (error) {
        console.log('⚠️ Index idx_parentconsent_student_active may already exist');
      }

      // ===========================================
      // GAMESESSION PERFORMANCE INDEXES
      // ===========================================

      // Game session participants optimization (JSONB) - now using student_id
      try {
        await queryInterface.addIndex('gamesession', {
          fields: [
            queryInterface.sequelize.literal("((participants)::text)")
          ],
          name: 'idx_gamesession_participants_text',
          using: 'gin'
        }, { transaction });
        console.log('✅ Created idx_gamesession_participants_text (GIN)');
      } catch (error) {
        console.log('⚠️ Index idx_gamesession_participants_text may already exist');
      }

      // ===========================================
      // VERIFICATION AND SUMMARY
      // ===========================================

      // Count created indexes
      const indexesCreated = await queryInterface.sequelize.query(`
        SELECT COUNT(*) as count
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname LIKE 'idx_%'
      `, { type: Sequelize.QueryTypes.SELECT, transaction });

      console.log('✅ Enhanced indexes for unified student_id system completed successfully:');
      console.log(`   - Player management and activity tracking indexes`);
      console.log(`   - UserSession unified student_id performance indexes`);
      console.log(`   - ClassroomMembership unified student_id indexes`);
      console.log(`   - User type and verification status indexes`);
      console.log(`   - Parent consent workflow indexes (user_id only)`);
      console.log(`   - GameSession JSONB optimization for student_id`);
      console.log(`   - Total indexes in database: ${indexesCreated[0].count}`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Enhanced indexes migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back enhanced indexes for unified system...');

      // List of all indexes to remove
      const indexesToRemove = [
        // Player indexes
        'idx_player_teacher_active',
        'idx_player_online',
        'idx_player_last_seen',
        'idx_player_teacher_online',
        'idx_player_display_name',

        // UserSession indexes (unified student_id)
        'idx_user_session_student_id',
        'idx_user_session_portal',
        'idx_user_session_portal_active',
        'idx_user_session_portal_student',
        'idx_user_session_student_active',
        'idx_user_session_student_expires',
        'idx_user_session_expiration_cleanup',

        // ClassroomMembership indexes (unified student_id)
        'idx_classroommembership_student',
        'idx_classroommembership_unique_student_membership',

        // Classroom indexes
        'idx_classroom_teacher_active',
        'idx_classroom_invitation_code',

        // User indexes
        'idx_user_type',
        'idx_user_verified',
        'idx_user_active',
        'idx_user_invitation_code',

        // ParentConsent indexes
        'idx_parentconsent_student',
        'idx_parentconsent_teacher',
        'idx_parentconsent_revoked',
        'idx_parentconsent_student_active',

        // GameSession indexes
        'idx_gamesession_participants_text'
      ];

      let removedCount = 0;
      for (const indexName of indexesToRemove) {
        try {
          // Determine table name from index name pattern
          let tableName = 'unknown';
          if (indexName.includes('_player_')) tableName = 'player';
          else if (indexName.includes('_user_session_')) tableName = 'user_session';
          else if (indexName.includes('_classroommembership_')) tableName = 'classroommembership';
          else if (indexName.includes('_classroom_')) tableName = 'classroom';
          else if (indexName.includes('_user_')) tableName = 'user';
          else if (indexName.includes('_parentconsent_')) tableName = 'parentconsent';
          else if (indexName.includes('_gamesession_')) tableName = 'gamesession';

          if (tableName !== 'unknown') {
            await queryInterface.removeIndex(tableName, indexName, { transaction });
            console.log(`✅ Removed index ${indexName}`);
            removedCount++;
          }
        } catch (error) {
          console.log(`⚠️ Index ${indexName} may not exist:`, error.message);
        }
      }

      console.log(`✅ Enhanced indexes rollback completed. Removed ${removedCount} indexes.`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Enhanced indexes rollback failed:', error);
      throw error;
    }
  }
};