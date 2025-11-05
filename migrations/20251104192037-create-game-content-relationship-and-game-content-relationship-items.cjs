'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Table: game_content_relation
     * ----------------------------
     * Defines a semantic relationship between two or more GameContent records.
     * Examples:
     *   - Translation between English and Hebrew words
     *   - Antonyms or Synonyms
     *   - Question → Answer links
     *   - Distractor items for multiple choice questions
     */
    await queryInterface.createTable('game_content_relation', {
      id: {
        type: Sequelize.STRING, // UUID-like string (consistent with your GameContent model)
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING, // FK to 'game.id' (if applicable)
        allowNull: true,
      },
      relation_type: {
        type: Sequelize.ENUM(
          'translation',
          'antonym',
          'synonym',
          'similar_meaning',
          'question_answer',
          'answer_question',
          'distractor'
        ),
        allowNull: false,
        comment: 'Defines what kind of relationship this is (e.g., translation, synonym, etc.)',
      },
      is_bidirectional: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the relation applies in both directions (e.g., synonyms are bidirectional, Q/A are not)',
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Optional JSON for storing extra data (e.g., confidence score, source, etc.)',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    /**
     * Table: game_content_relation_items
     * ----------------------------------
     * Links one or more GameContent items to a specific relation.
     * Each item can have a role, defining its position in the relation.
     * Examples:
     *   - For a translation: source ↔ target
     *   - For Q/A: question → answer → distractors
     */
    await queryInterface.createTable('game_content_relation_items', {
      relation_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game_content_relation',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      content_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'gamecontent', // matches your existing table name
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      role: {
        type: Sequelize.ENUM('source', 'target', 'question', 'answer', 'distractor'),
        allowNull: true,
        comment: 'Optional label describing the content’s function within the relation',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add helpful indexes
    await queryInterface.addIndex('game_content_relation', ['relation_type']);
    await queryInterface.addIndex('game_content_relation_items', ['relation_id']);
    await queryInterface.addIndex('game_content_relation_items', ['content_id']);
  },

  async down(queryInterface, Sequelize) {
    // Drop in reverse order to handle FK dependencies
    await queryInterface.dropTable('game_content_relation_items');
    await queryInterface.dropTable('game_content_relation');
  },
};
