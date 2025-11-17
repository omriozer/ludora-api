'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🗑️ Dropping old game content tables...');

      // 1. DROP old tables (in correct order due to foreign key dependencies)
      await queryInterface.dropTable('game_content_relation_items', { transaction });
      await queryInterface.dropTable('game_content_link', { transaction });
      await queryInterface.dropTable('game_content_relation', { transaction });
      await queryInterface.dropTable('gamecontent', { transaction });

      console.log('✅ Old tables dropped successfully');
      console.log('🏗️ Creating new edu_content table...');

      // 2. CREATE edu_content table
      await queryInterface.createTable('edu_content', {
        id: {
          type: Sequelize.STRING(255),
          primaryKey: true,
          allowNull: false
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
        },
        element_type: {
          type: Sequelize.ENUM('playing_card_complete', 'playing_card_bg', 'data'),
          allowNull: false,
          comment: 'Type of educational content element'
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false,
          comment: 'The actual content - image URL, text value, etc.'
        },
        content_metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Flexible metadata for content (language, difficulty, represents_data_id, etc.)'
        }
      }, { transaction });

      console.log('🏗️ Creating new edu_content_use table...');

      // 3. CREATE edu_content_use table
      await queryInterface.createTable('edu_content_use', {
        id: {
          type: Sequelize.STRING(255),
          primaryKey: true,
          allowNull: false
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
        },
        game_id: {
          type: Sequelize.STRING(255),
          allowNull: false,
          references: {
            model: 'game',
            key: 'id'
          },
          onDelete: 'CASCADE',
          comment: 'Reference to the game using this content'
        },
        use_type: {
          type: Sequelize.ENUM('single_content', 'pair', 'group'),
          allowNull: false,
          comment: 'How the content is grouped/used in the game'
        },
        contents_data: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
          comment: 'Array of edu_content IDs in this grouping'
        },
        content_order: {
          type: Sequelize.JSONB,
          allowNull: true,
          defaultValue: null,
          comment: 'Optional: array defining order when sequence matters'
        },
        usage_metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
          comment: 'Additional metadata about how content is used'
        }
      }, { transaction });

      console.log('📊 Creating indexes for performance...');

      // 4. CREATE indexes for edu_content
      await queryInterface.addIndex('edu_content', ['element_type'], {
        name: 'idx_edu_content_element_type',
        transaction
      });
      await queryInterface.addIndex('edu_content', ['content_metadata'], {
        name: 'idx_edu_content_metadata',
        using: 'gin',
        transaction
      });
      await queryInterface.addIndex('edu_content', ['created_at'], {
        name: 'idx_edu_content_created_at',
        transaction
      });

      // 5. CREATE indexes for edu_content_use
      await queryInterface.addIndex('edu_content_use', ['game_id'], {
        name: 'idx_edu_content_use_game_id',
        transaction
      });
      await queryInterface.addIndex('edu_content_use', ['use_type'], {
        name: 'idx_edu_content_use_type',
        transaction
      });
      await queryInterface.addIndex('edu_content_use', ['contents_data'], {
        name: 'idx_edu_content_use_contents_data',
        using: 'gin',
        transaction
      });
      await queryInterface.addIndex('edu_content_use', ['created_at'], {
        name: 'idx_edu_content_use_created_at',
        transaction
      });

      console.log('✅ Migration completed successfully!');
      console.log('📋 New tables created:');
      console.log('   - edu_content (3 element types)');
      console.log('   - edu_content_use (3 use types)');

      await transaction.commit();
    } catch (error) {
      console.error('❌ Migration failed:', error);
      await transaction.rollback();
      throw error;
    }
  },

  async down (queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('🔄 Rolling back: dropping new tables...');

      // Drop new tables (in reverse order)
      await queryInterface.dropTable('edu_content_use', { transaction });
      await queryInterface.dropTable('edu_content', { transaction });

      console.log('⚠️ Note: Old game content tables NOT recreated');
      console.log('   This is intentional since we\'re not migrating data');

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
