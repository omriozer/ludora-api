'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1️⃣ הסרת game_id מהטבלה הקיימת
    await queryInterface.removeColumn('game_content_relation', 'game_id');

    // 2️⃣ יצירת טבלת game_content_link החדשה
    await queryInterface.createTable('game_content_link', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
        comment: 'Unique identifier for this link',
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'The game this link belongs to',
      },
      link_type: {
        type: Sequelize.ENUM('content', 'relation'),
        allowNull: false,
        comment: 'Defines whether the link points to a single content item or a content relation',
      },
      target_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'References either gamecontent.id or game_content_relation.id depending on link_type',
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Optional JSON data for storing additional info about the link',
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

    // Indexes לשיפור ביצועים
    await queryInterface.addIndex('game_content_link', ['game_id']);
    await queryInterface.addIndex('game_content_link', ['link_type']);
  },

  async down(queryInterface, Sequelize) {
    // מחזירים את השינוי אחורה אם נדרש
    await queryInterface.dropTable('game_content_link');

    // מחזירים את העמודה שהוסרה
    await queryInterface.addColumn('game_content_relation', 'game_id', {
      type: Sequelize.STRING,
      allowNull: true,
      references: {
        model: 'game',
        key: 'id',
      },
      onDelete: 'CASCADE',
      comment: 'Restored game reference (used before link table existed)',
    });

    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_game_content_link_link_type";`
    );
  },
};
