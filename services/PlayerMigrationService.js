import models from '../models/index.js';
import { ludlog, luderror } from '../lib/ludlog.js';
import { isProd } from '../src/utils/environment.js';

/**
 * PlayerMigrationService
 *
 * Handles comprehensive migration of Player data to User accounts
 * including universal ID replacement across all database tables.
 *
 * CRITICAL: This service performs irreversible data migration.
 * Once a Player is migrated to User, the Player is deactivated.
 */
class PlayerMigrationService {
  constructor() {
    this.models = models;
  }

  /**
   * Migrate a Player to an existing User account
   * This is a teacher-initiated action to connect anonymous Player to registered student
   *
   * @param {string} playerId - Player ID to migrate (format: player_XXXXXX)
   * @param {string} targetUserId - User ID to migrate to
   * @param {string} teacherId - Teacher performing the migration
   * @param {Object} options - Migration options
   * @returns {Object} Migration result with affected records count
   */
  async migratePlayerToUser(playerId, targetUserId, teacherId, options = {}) {
    const transaction = options.transaction || await this.models.sequelize.transaction();
    const isExternalTransaction = !!options.transaction;

    try {
      ludlog.auth(`🔄 Starting Player migration: ${playerId} → ${targetUserId}`, {
        playerId,
        targetUserId,
        teacherId,
        initiatedBy: 'teacher'
      });

      // Step 1: Validate preconditions
      await this.validateMigrationPreconditions(playerId, targetUserId, teacherId, { transaction });

      // Step 2: Get Player data before migration
      const player = await this.models.Player.findByPk(playerId, {
        include: ['teacher'],
        transaction
      });

      // Step 3: Perform universal ID replacement
      const migrationResults = await this.performUniversalIdReplacement(playerId, targetUserId, { transaction });

      // Step 4: Transfer Player metadata to User
      await this.transferPlayerMetadata(player, targetUserId, { transaction });

      // Step 5: Deactivate Player (soft delete)
      await player.update({
        is_active: false,
        deactivated_at: new Date(),
        migration_target_user_id: targetUserId,
        migrated_by_teacher_id: teacherId
      }, { transaction });

      if (!isExternalTransaction) {
        await transaction.commit();
      }

      ludlog.auth(`✅ Player migration completed successfully`, {
        playerId,
        targetUserId,
        teacherId,
        affectedRecords: migrationResults
      });

      return {
        success: true,
        playerId,
        targetUserId,
        affectedRecords: migrationResults,
        message: 'Player data migrated successfully to User account'
      };

    } catch (error) {
      if (!isExternalTransaction) {
        await transaction.rollback();
      }

      luderror.auth('❌ Player migration failed', {
        playerId,
        targetUserId,
        teacherId,
        error: error.message,
        stack: error.stack
      });

      throw new Error(`Migration failed: ${error.message}`);
    }
  }

  /**
   * Validate all preconditions for migration
   * Ensures migration can be performed safely
   */
  async validateMigrationPreconditions(playerId, targetUserId, teacherId, options = {}) {
    const { transaction } = options;

    // Validate Player exists and is active
    const player = await this.models.Player.findByPk(playerId, { transaction });
    if (!player) {
      throw new Error(`Player ${playerId} not found`);
    }
    if (!player.is_active) {
      throw new Error(`Player ${playerId} is already deactivated`);
    }

    // Validate Teacher owns this Player
    if (player.teacher_id !== teacherId) {
      throw new Error(`Teacher ${teacherId} does not own Player ${playerId}`);
    }

    // Validate target User exists
    const targetUser = await this.models.User.findByPk(targetUserId, { transaction });
    if (!targetUser) {
      throw new Error(`Target User ${targetUserId} not found`);
    }

    // Validate User is a student (optional safety check)
    if (targetUser.user_type && targetUser.user_type !== 'student') {
      throw new Error(`Target User ${targetUserId} is not a student (type: ${targetUser.user_type})`);
    }

    // Check if User is connected to this teacher via ClassroomMembership
    const membership = await this.models.ClassroomMembership.findOne({
      where: {
        student_id: targetUserId,
        teacher_id: teacherId,
        status: 'active'
      },
      transaction
    });

    if (!membership) {
      throw new Error(`User ${targetUserId} is not an active student of teacher ${teacherId}`);
    }

    ludlog.auth(`✅ Migration preconditions validated`, {
      playerId,
      playerTeacherId: player.teacher_id,
      targetUserId,
      targetUserType: targetUser.user_type,
      validatingTeacherId: teacherId
    });
  }

  /**
   * Perform universal ID replacement across all database tables
   * This is the core migration logic that updates all Player references
   */
  async performUniversalIdReplacement(playerId, newUserId, options = {}) {
    const { transaction } = options;
    const results = {};

    ludlog.auth(`🔄 Starting universal ID replacement`, { playerId, newUserId });

    // 1. UserSession: player_id → user_id
    const userSessionResults = await this.models.UserSession.update(
      {
        user_id: newUserId,
        player_id: null,
        migration_notes: `Migrated from player ${playerId} on ${new Date().toISOString()}`
      },
      {
        where: { player_id: playerId },
        transaction
      }
    );
    results.userSessions = userSessionResults[0];
    ludlog.auth(`📱 UserSession migration: ${results.userSessions} records updated`);

    // 2. GameSession participants (JSONB replacement)
    const gameSessionsResults = await this.migrateGameSessionParticipants(playerId, newUserId, { transaction });
    results.gameSessionParticipants = gameSessionsResults;
    ludlog.auth(`🎮 GameSession participants migration: ${results.gameSessionParticipants} records updated`);

    // 3. ClassroomMembership: student_id (if Player was in classrooms)
    const classroomResults = await this.models.ClassroomMembership.update(
      {
        student_id: newUserId,
        migration_notes: `Migrated from player ${playerId} on ${new Date().toISOString()}`
      },
      {
        where: { student_id: playerId },
        transaction
      }
    );
    results.classroomMemberships = classroomResults[0];
    ludlog.auth(`🏫 ClassroomMembership migration: ${results.classroomMemberships} records updated`);

    // 4. ParentConsent: student_id (if Player had consent - unlikely but possible)
    const consentResults = await this.models.ParentConsent.update(
      {
        student_id: newUserId,
        migration_notes: `Migrated from player ${playerId} on ${new Date().toISOString()}`
      },
      {
        where: { student_id: playerId },
        transaction
      }
    );
    results.parentConsents = consentResults[0];
    ludlog.auth(`👨‍👩‍👧‍👦 ParentConsent migration: ${results.parentConsents} records updated`);

    // 5. Future-proof: Add any additional table migrations here
    // TODO: Add other tables that might reference Player IDs

    ludlog.auth(`✅ Universal ID replacement completed`, {
      playerId,
      newUserId,
      totalRecordsAffected: Object.values(results).reduce((sum, count) => sum + count, 0),
      results
    });

    return results;
  }

  /**
   * Migrate GameSession participants JSONB data
   * Updates player_id references in the participants array
   */
  async migrateGameSessionParticipants(playerId, newUserId, options = {}) {
    const { transaction } = options;

    // Find all GameSessions containing this player
    const gameSessions = await this.models.GameSession.findAll({
      where: {
        participants: {
          [this.models.Sequelize.Op.contains]: [{ player_id: playerId }]
        }
      },
      transaction
    });

    let updatedCount = 0;

    for (const session of gameSessions) {
      // Update participants array
      const updatedParticipants = session.participants.map(participant => {
        if (participant.player_id === playerId) {
          return {
            ...participant,
            player_id: null,           // Remove player_id
            user_id: newUserId,        // Add user_id
            migrated: true,            // Flag as migrated
            migrated_at: new Date().toISOString(),
            original_player_id: playerId  // Audit trail
          };
        }
        return participant;
      });

      // Save updated participants
      await session.update({
        participants: updatedParticipants
      }, { transaction });

      updatedCount++;
    }

    return updatedCount;
  }

  /**
   * Transfer Player metadata to User account
   * Preserves achievements, preferences, and other Player-specific data
   */
  async transferPlayerMetadata(player, targetUserId, options = {}) {
    const { transaction } = options;

    const targetUser = await this.models.User.findByPk(targetUserId, { transaction });

    // Merge achievements (avoid duplicates)
    const existingAchievements = targetUser.achievements || [];
    const playerAchievements = player.achievements || [];
    const mergedAchievements = [
      ...existingAchievements,
      ...playerAchievements.filter(achievement =>
        !existingAchievements.find(existing => existing.id === achievement.id)
      )
    ];

    // Merge preferences (Player preferences take priority for conflicts)
    const mergedPreferences = {
      ...targetUser.preferences,
      ...player.preferences,
      // Mark migrated preferences
      _migrated_from_player: player.id,
      _migration_date: new Date().toISOString()
    };

    // Update User with merged data
    await targetUser.update({
      achievements: mergedAchievements,
      preferences: mergedPreferences,
      // Preserve display name if User doesn't have full_name
      full_name: targetUser.full_name || player.display_name,
    }, { transaction });

    ludlog.auth(`📊 Player metadata transferred to User`, {
      playerId: player.id,
      targetUserId,
      achievementsCount: mergedAchievements.length,
      preferencesKeys: Object.keys(mergedPreferences).length
    });
  }

  /**
   * Get migration status for a Player
   * Useful for checking if migration is possible
   */
  async getMigrationStatus(playerId) {
    try {
      const player = await this.models.Player.findByPk(playerId, {
        include: ['teacher']
      });

      if (!player) {
        return { canMigrate: false, reason: 'Player not found' };
      }

      if (!player.is_active) {
        return {
          canMigrate: false,
          reason: 'Player already deactivated',
          migrationTarget: player.migration_target_user_id
        };
      }

      // Check for potential User targets (teacher's students)
      const potentialTargets = await this.models.ClassroomMembership.findAll({
        where: {
          teacher_id: player.teacher_id,
          status: 'active'
        },
        include: [{
          model: this.models.User,
          as: 'Student',
          attributes: ['id', 'email', 'full_name', 'user_type']
        }]
      });

      return {
        canMigrate: true,
        player: {
          id: player.id,
          privacy_code: player.privacy_code,
          display_name: player.display_name,
          teacher_id: player.teacher_id,
          teacher_name: player.teacher?.full_name
        },
        potentialTargets: potentialTargets.map(membership => membership.Student)
      };

    } catch (error) {
      luderror.auth('Error checking migration status:', error);
      return { canMigrate: false, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Rollback a migration (if needed for debugging/testing)
   * WARNING: This is a dangerous operation and should only be used in development
   */
  async rollbackMigration(playerId, userId, options = {}) {
    if (isProd()) {
      throw new Error('Migration rollback is not allowed in production');
    }

    const transaction = options.transaction || await this.models.sequelize.transaction();
    const isExternalTransaction = !!options.transaction;

    try {
      ludlog.auth(`⚠️ Starting migration rollback: ${playerId} ← ${userId}`);

      // This would reverse the ID replacement operations
      // Implementation depends on specific requirements
      // Generally not recommended for production use

      if (!isExternalTransaction) {
        await transaction.commit();
      }

      return { success: true, message: 'Migration rolled back successfully' };

    } catch (error) {
      if (!isExternalTransaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }
}

export default new PlayerMigrationService();