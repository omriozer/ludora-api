/**
 * Migration: Implement Unified Student ID System
 *
 * CRITICAL: This migration implements the unified student_id approach:
 * - Updates Player.id format from UUID to player_XXXXXX
 * - Creates student_id fields that can hold either user_abc123 OR player_XXXXXX
 * - Migrates existing data with universal ID replacement
 * - Eliminates separate player_id/user_id confusion in student contexts
 *
 * Field Strategy:
 * - user_id: Only for users (ParentConsent.user_id, Player.teacher_id)
 * - student_id: Either users OR players (UserSession, ClassroomMembership, GameSession)
 * - player_id: Eliminated from all tables (unified into student_id)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Starting unified student_id system migration...');

      // Step 1: Create backup table for existing players
      await queryInterface.createTable('player_backup_pre_migration', {
        id: { type: Sequelize.UUID, primaryKey: true },
        privacy_code: { type: Sequelize.STRING(8) },
        display_name: { type: Sequelize.STRING(100) },
        teacher_id: { type: Sequelize.STRING },
        achievements: { type: Sequelize.JSONB },
        preferences: { type: Sequelize.JSONB },
        is_online: { type: Sequelize.BOOLEAN },
        last_seen: { type: Sequelize.DATE },
        is_active: { type: Sequelize.BOOLEAN },
        created_at: { type: Sequelize.DATE },
        updated_at: { type: Sequelize.DATE }
      }, { transaction });

      // Step 2: Backup existing player data
      await queryInterface.sequelize.query(`
        INSERT INTO player_backup_pre_migration
        SELECT * FROM player
      `, { transaction });

      const backupCount = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM player_backup_pre_migration',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      console.log(`📋 Backed up ${backupCount[0].count} existing players`);

      // Step 3: Get existing players for ID mapping
      const existingPlayers = await queryInterface.sequelize.query(
        'SELECT id, privacy_code, display_name, teacher_id FROM player ORDER BY created_at',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      // Step 4: Create temporary mapping table for ID conversion
      await queryInterface.createTable('player_id_mapping', {
        old_uuid: { type: Sequelize.UUID, primaryKey: true },
        new_player_id: { type: Sequelize.STRING(13), unique: true },
        created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
      }, { transaction });

      // Step 5: Generate new player IDs and create mapping
      console.log('🔄 Generating new player IDs...');

      const generatePlayerId = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = 'player_';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      const usedIds = new Set();
      const idMappings = [];

      for (const player of existingPlayers) {
        let newId;
        let attempts = 0;

        do {
          newId = generatePlayerId();
          attempts++;
        } while (usedIds.has(newId) && attempts < 50);

        if (attempts >= 50) {
          throw new Error('Failed to generate unique player ID');
        }

        usedIds.add(newId);
        idMappings.push({ old_uuid: player.id, new_player_id: newId });

        await queryInterface.sequelize.query(`
          INSERT INTO player_id_mapping (old_uuid, new_player_id)
          VALUES ('${player.id}', '${newId}')
        `, { transaction });
      }

      console.log(`📝 Generated ${idMappings.length} new player IDs`);

      // Step 6: Update UserSession to use student_id
      console.log('🔄 Migrating UserSession to unified student_id...');

      // Add student_id column
      await queryInterface.addColumn('user_session', 'student_id', {
        type: Sequelize.STRING(25),
        allowNull: true,
        comment: 'Student identifier - can be user_abc123def456 (24 chars) or player_XXXXXX (13 chars)'
      }, { transaction });

      // Migrate existing user sessions (user_id → student_id)
      await queryInterface.sequelize.query(`
        UPDATE user_session
        SET student_id = user_id
        WHERE user_id IS NOT NULL AND player_id IS NULL
      `, { transaction });

      // Migrate existing player sessions (player_id → student_id with new format)
      for (const mapping of idMappings) {
        await queryInterface.sequelize.query(`
          UPDATE user_session
          SET student_id = '${mapping.new_player_id}'
          WHERE player_id = '${mapping.old_uuid}'
        `, { transaction });
      }

      // Remove foreign key constraint and drop player_id column
      await queryInterface.removeConstraint('user_session', 'user_session_player_id_fkey', { transaction });
      await queryInterface.removeColumn('user_session', 'player_id', { transaction });

      console.log('✅ UserSession now uses unified student_id field');

      // Step 7: Update ClassroomMembership to use student_id
      console.log('🔄 Migrating ClassroomMembership to unified student_id...');

      // Rename student_user_id to student_id
      await queryInterface.renameColumn('classroommembership', 'student_user_id', 'student_id', { transaction });

      // Update comment for clarity
      await queryInterface.changeColumn('classroommembership', 'student_id', {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Student identifier - can be user_abc123 or player_XXXXXX'
      }, { transaction });

      console.log('✅ ClassroomMembership now uses unified student_id field');

      // Step 8: Update GameSession participants JSONB
      console.log('🔄 Updating GameSession participants to unified student_id...');
      const gameSessions = await queryInterface.sequelize.query(
        `SELECT id, participants FROM gamesession WHERE participants::text LIKE '%player_id%' OR participants::text LIKE '%user_id%'`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      for (const session of gameSessions) {
        let participantsJson = session.participants;
        let updated = false;

        if (Array.isArray(participantsJson)) {
          participantsJson = participantsJson.map(participant => {
            // Handle player_id → student_id migration
            if (participant.player_id) {
              const mapping = idMappings.find(m => m.old_uuid === participant.player_id);
              if (mapping) {
                const { player_id, ...cleanParticipant } = participant;
                return {
                  ...cleanParticipant,
                  student_id: mapping.new_player_id
                };
              }
            }
            // Handle user_id → student_id migration
            else if (participant.user_id && !participant.student_id) {
              const { user_id, ...cleanParticipant } = participant;
              return {
                ...cleanParticipant,
                student_id: user_id
              };
            }
            return participant;
          });
          updated = true;
        }

        if (updated) {
          await queryInterface.sequelize.query(`
            UPDATE gamesession
            SET participants = '${JSON.stringify(participantsJson)}'
            WHERE id = '${session.id}'
          `, { transaction });
        }
      }

      console.log('✅ GameSession participants now use unified student_id field');

      // Step 9: Drop and recreate player table with new structure
      console.log('🔄 Recreating player table with new ID format...');

      await queryInterface.dropTable('player', { transaction });

      await queryInterface.createTable('player', {
        id: {
          type: Sequelize.STRING(13),
          primaryKey: true,
          allowNull: false,
          comment: 'Unique player identifier (format: player_XXXXXX)'
        },
        privacy_code: {
          type: Sequelize.STRING(8),
          allowNull: false,
          unique: true,
          comment: 'Unique privacy code for anonymous player authentication'
        },
        display_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Display name shown in games and to teachers'
        },
        teacher_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: { model: 'user', key: 'id' },
          comment: 'Teacher who owns/manages this player (user_id only)'
        },
        achievements: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of player achievements and badges'
        },
        preferences: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Player preferences and settings'
        },
        is_online: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether player is currently connected via SSE'
        },
        last_seen: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: 'Last time player was active or seen online'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether player account is active (soft delete)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Step 10: Restore player data with new IDs
      console.log('🔄 Restoring player data with new IDs...');

      for (const mapping of idMappings) {
        const backupData = await queryInterface.sequelize.query(`
          SELECT * FROM player_backup_pre_migration WHERE id = '${mapping.old_uuid}'
        `, { type: Sequelize.QueryTypes.SELECT, transaction });

        if (backupData.length > 0) {
          const player = backupData[0];

          // Use Sequelize's query with parameters to avoid SQL injection and formatting issues
          await queryInterface.sequelize.query(
            `INSERT INTO player (
              id, privacy_code, display_name, teacher_id, achievements,
              preferences, is_online, last_seen, is_active, created_at, updated_at
            ) VALUES (
              :id, :privacy_code, :display_name, :teacher_id, :achievements,
              :preferences, :is_online, :last_seen, :is_active, :created_at, :updated_at
            )`,
            {
              replacements: {
                id: mapping.new_player_id,
                privacy_code: player.privacy_code,
                display_name: player.display_name,
                teacher_id: player.teacher_id,
                achievements: JSON.stringify(player.achievements),
                preferences: JSON.stringify(player.preferences),
                is_online: player.is_online,
                last_seen: player.last_seen,
                is_active: player.is_active,
                created_at: player.created_at,
                updated_at: player.updated_at
              },
              transaction
            }
          );
        }
      }

      // Step 11: Create essential indexes
      await queryInterface.addIndex('player', {
        fields: ['privacy_code'],
        unique: true,
        name: 'idx_player_privacy_code'
      }, { transaction });

      await queryInterface.addIndex('player', {
        fields: ['teacher_id'],
        name: 'idx_player_teacher_id'
      }, { transaction });

      // Step 12: Verify migration success
      const finalPlayerCount = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM player',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      const finalSessionCount = await queryInterface.sequelize.query(
        'SELECT COUNT(*) as count FROM user_session WHERE student_id IS NOT NULL',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      console.log('✅ Unified student_id system migration completed successfully:');
      console.log(`   - Migrated ${finalPlayerCount[0].count} players to new ID format`);
      console.log(`   - Updated ${finalSessionCount[0].count} user sessions to student_id`);
      console.log(`   - ClassroomMembership now uses student_id`);
      console.log(`   - GameSession participants unified to student_id`);
      console.log(`   - Backup table: player_backup_pre_migration`);
      console.log(`   - ID mapping table: player_id_mapping`);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Unified student_id system migration failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back unified student_id system migration...');

      // Check if backup table exists
      const tables = await queryInterface.showAllTables();
      if (!tables.includes('player_backup_pre_migration')) {
        throw new Error('Backup table not found. Cannot rollback migration.');
      }

      // Step 1: Drop current player table
      await queryInterface.dropTable('player', { transaction });

      // Step 2: Recreate original player table structure
      await queryInterface.createTable('player', {
        id: {
          type: Sequelize.UUID,
          primaryKey: true,
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          comment: 'Unique player identifier'
        },
        privacy_code: {
          type: Sequelize.STRING(8),
          allowNull: false,
          unique: true,
          comment: 'Unique privacy code for anonymous player authentication'
        },
        display_name: {
          type: Sequelize.STRING(100),
          allowNull: false,
          comment: 'Display name shown in games and to teachers'
        },
        teacher_id: {
          type: Sequelize.STRING,
          allowNull: true,
          references: { model: 'user', key: 'id' },
          comment: 'Teacher who owns/manages this player'
        },
        achievements: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of player achievements and badges'
        },
        preferences: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Player preferences and settings'
        },
        is_online: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          comment: 'Whether player is currently connected via SSE'
        },
        last_seen: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
          comment: 'Last time player was active or seen online'
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          comment: 'Whether player account is active (soft delete)'
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        }
      }, { transaction });

      // Step 3: Restore original player data
      await queryInterface.sequelize.query(`
        INSERT INTO player SELECT * FROM player_backup_pre_migration
      `, { transaction });

      // Step 4: Restore UserSession structure
      console.log('🔄 Restoring UserSession original structure...');

      // Add back player_id column
      await queryInterface.addColumn('user_session', 'player_id', {
        type: Sequelize.UUID,
        allowNull: true
      }, { transaction });

      // Get mapping data for rollback
      const idMappings = await queryInterface.sequelize.query(
        'SELECT old_uuid, new_player_id FROM player_id_mapping',
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );

      // Restore UserSession references
      for (const mapping of idMappings) {
        await queryInterface.sequelize.query(`
          UPDATE user_session
          SET player_id = '${mapping.old_uuid}', user_id = NULL
          WHERE student_id = '${mapping.new_player_id}'
        `, { transaction });
      }

      // Restore user sessions that were users
      await queryInterface.sequelize.query(`
        UPDATE user_session
        SET user_id = student_id
        WHERE student_id NOT LIKE 'player_%' AND student_id IS NOT NULL
      `, { transaction });

      // Drop student_id column
      await queryInterface.removeColumn('user_session', 'student_id', { transaction });

      // Step 5: Restore ClassroomMembership structure
      await queryInterface.renameColumn('classroommembership', 'student_id', 'student_user_id', { transaction });

      // Step 6: Cleanup backup tables
      await queryInterface.dropTable('player_backup_pre_migration', { transaction });
      await queryInterface.dropTable('player_id_mapping', { transaction });

      console.log('✅ Unified student_id system migration rolled back successfully');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Unified student_id system rollback failed:', error);
      throw error;
    }
  }
};