'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create all missing tables that exist as models but not in production DB

    // EmailLog table
    await queryInterface.createTable('emaillog', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      template_id: { type: Sequelize.STRING, allowNull: true },
      recipient_email: { type: Sequelize.STRING, allowNull: true },
      subject: { type: Sequelize.STRING, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: true },
      trigger_type: { type: Sequelize.STRING, allowNull: true },
      related_product_id: { type: Sequelize.STRING, allowNull: true },
      related_registration_id: { type: Sequelize.STRING, allowNull: true },
      related_purchase_id: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      error_message: { type: Sequelize.STRING, allowNull: true },
      scheduled_for: { type: Sequelize.STRING, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // EmailTemplate table
    await queryInterface.createTable('emailtemplate', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: true },
      subject: { type: Sequelize.STRING, allowNull: true },
      html_content: { type: Sequelize.TEXT, allowNull: true },
      trigger_type: { type: Sequelize.STRING, allowNull: true },
      trigger_hours_before: { type: Sequelize.DECIMAL, allowNull: true },
      trigger_hours_after: { type: Sequelize.DECIMAL, allowNull: true },
      target_product_types: { type: Sequelize.JSONB, allowNull: true },
      target_product_ids: { type: Sequelize.JSONB, allowNull: true },
      target_admin_emails: { type: Sequelize.JSONB, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: true },
      send_to_admins: { type: Sequelize.BOOLEAN, allowNull: true },
      access_expiry_days_before: { type: Sequelize.DECIMAL, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // Notification table
    await queryInterface.createTable('notification', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.STRING, allowNull: true },
      message: { type: Sequelize.STRING, allowNull: true },
      read: { type: Sequelize.BOOLEAN, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameContentUsage table
    await queryInterface.createTable('gamecontentusage', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        }
      },
      template_id: {
        type: Sequelize.STRING,
        allowNull: true,
        references: {
          model: 'gamecontentusagetemplate',
          key: 'id'
        }
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      content_types: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
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
      }
    });

    // GameContentUsageTemplate table
    await queryInterface.createTable('gamecontentusagetemplate', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      content_types: {
        type: Sequelize.JSON,
        allowNull: false,
        defaultValue: []
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameAudioSettings table
    await queryInterface.createTable('gameaudiosettings', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        }
      },
      auto_play: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      play_correct_sound: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      play_incorrect_sound: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      volume: { type: Sequelize.DECIMAL, allowNull: true, defaultValue: 0.7 },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameMemorySettings table
    await queryInterface.createTable('gamememorysettings', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        }
      },
      grid_size: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 4 },
      match_count: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 2 },
      time_limit: { type: Sequelize.INTEGER, allowNull: true },
      auto_flip_delay: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1000 },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameScatterSettings table
    await queryInterface.createTable('gamescattersettings', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        }
      },
      time_limit: { type: Sequelize.INTEGER, allowNull: true },
      items_per_round: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 10 },
      auto_advance: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      show_progress: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameWisdomMazeSettings table
    await queryInterface.createTable('gamewisdommazesettings', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_id: {
        type: Sequelize.STRING,
        allowNull: false,
        references: {
          model: 'game',
          key: 'id'
        }
      },
      maze_size: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 10 },
      time_limit: { type: Sequelize.INTEGER, allowNull: true },
      show_hints: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
      hint_penalty: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 10 },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameTypeContentRestriction table
    await queryInterface.createTable('gametypecontentrestriction', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      game_type: { type: Sequelize.STRING, allowNull: false },
      content_type: { type: Sequelize.STRING, allowNull: false },
      is_allowed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // GameContentTag table
    await queryInterface.createTable('gamecontenttag', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      name: { type: Sequelize.STRING, allowNull: false },
      color: { type: Sequelize.STRING, allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // Grammar table
    await queryInterface.createTable('grammar', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      word: { type: Sequelize.STRING, allowNull: false },
      grammar_type: { type: Sequelize.STRING, allowNull: true },
      definition: { type: Sequelize.TEXT, allowNull: true },
      examples: { type: Sequelize.JSONB, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // QA table
    await queryInterface.createTable('qa', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      question: { type: Sequelize.TEXT, allowNull: false },
      answer: { type: Sequelize.TEXT, allowNull: false },
      category: { type: Sequelize.STRING, allowNull: true },
      difficulty_level: { type: Sequelize.INTEGER, allowNull: true },
      tags: { type: Sequelize.JSONB, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // Registration table
    await queryInterface.createTable('registration', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.STRING, allowNull: true },
      product_id: { type: Sequelize.STRING, allowNull: true },
      workshop_id: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true },
      registration_date: { type: Sequelize.DATE, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // PendingSubscription table
    await queryInterface.createTable('pendingsubscription', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.STRING, allowNull: false },
      subscription_plan_id: { type: Sequelize.STRING, allowNull: false },
      payplus_subscription_uid: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true, defaultValue: 'pending' },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // SubscriptionHistory table
    await queryInterface.createTable('subscriptionhistory', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.STRING, allowNull: false },
      subscription_plan_id: { type: Sequelize.STRING, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: false },
      old_status: { type: Sequelize.STRING, allowNull: true },
      new_status: { type: Sequelize.STRING, allowNull: true },
      details: { type: Sequelize.JSONB, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // SupportMessage table
    await queryInterface.createTable('supportmessage', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      user_id: { type: Sequelize.STRING, allowNull: true },
      email: { type: Sequelize.STRING, allowNull: true },
      subject: { type: Sequelize.STRING, allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING, allowNull: true, defaultValue: 'open' },
      priority: { type: Sequelize.STRING, allowNull: true, defaultValue: 'normal' },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // StudentInvitation table
    await queryInterface.createTable('studentinvitation', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      classroom_id: { type: Sequelize.STRING, allowNull: false },
      student_email: { type: Sequelize.STRING, allowNull: false },
      invitation_code: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.STRING, allowNull: true, defaultValue: 'pending' },
      expires_at: { type: Sequelize.DATE, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // ParentConsent table
    await queryInterface.createTable('parentconsent', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      student_user_id: { type: Sequelize.STRING, allowNull: false },
      parent_email: { type: Sequelize.STRING, allowNull: false },
      consent_given: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      consent_date: { type: Sequelize.DATE, allowNull: true },
      ip_address: { type: Sequelize.STRING, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // WordEN table (English words)
    await queryInterface.createTable('wordEN', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true,
        allowNull: false,
      },
      word: { type: Sequelize.STRING, allowNull: false },
      translation: { type: Sequelize.STRING, allowNull: true },
      definition: { type: Sequelize.TEXT, allowNull: true },
      pronunciation: { type: Sequelize.STRING, allowNull: true },
      difficulty_level: { type: Sequelize.INTEGER, allowNull: true },
      tags: { type: Sequelize.JSONB, allowNull: true },
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
      created_by: { type: Sequelize.STRING, allowNull: true },
      created_by_id: { type: Sequelize.STRING, allowNull: true },
    });

    // Add indexes for performance
    await queryInterface.addIndex('emaillog', ['recipient_email']);
    await queryInterface.addIndex('emaillog', ['template_id']);
    await queryInterface.addIndex('emaillog', ['status']);
    await queryInterface.addIndex('gamecontentusage', ['game_id']);
    await queryInterface.addIndex('gamecontentusage', ['template_id']);
    await queryInterface.addIndex('notification', ['user_id']);
    await queryInterface.addIndex('notification', ['read']);
    await queryInterface.addIndex('registration', ['user_id']);
    await queryInterface.addIndex('registration', ['product_id']);
    await queryInterface.addIndex('registration', ['workshop_id']);
    await queryInterface.addIndex('subscriptionhistory', ['user_id']);
    await queryInterface.addIndex('studentinvitation', ['classroom_id']);
    await queryInterface.addIndex('studentinvitation', ['student_email']);
    await queryInterface.addIndex('parentconsent', ['student_user_id']);
  },

  async down(queryInterface, Sequelize) {
    // Drop all created tables in reverse order
    await queryInterface.dropTable('wordEN');
    await queryInterface.dropTable('parentconsent');
    await queryInterface.dropTable('studentinvitation');
    await queryInterface.dropTable('supportmessage');
    await queryInterface.dropTable('subscriptionhistory');
    await queryInterface.dropTable('pendingsubscription');
    await queryInterface.dropTable('registration');
    await queryInterface.dropTable('qa');
    await queryInterface.dropTable('grammar');
    await queryInterface.dropTable('gamecontenttag');
    await queryInterface.dropTable('gametypecontentrestriction');
    await queryInterface.dropTable('gamewisdommazesettings');
    await queryInterface.dropTable('gamescattersettings');
    await queryInterface.dropTable('gamememorysettings');
    await queryInterface.dropTable('gameaudiosettings');
    await queryInterface.dropTable('gamecontentusagetemplate');
    await queryInterface.dropTable('gamecontentusage');
    await queryInterface.dropTable('notification');
    await queryInterface.dropTable('emailtemplate');
    await queryInterface.dropTable('emaillog');
  }
};