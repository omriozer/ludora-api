'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { v4: uuidv4 } = await import('uuid');

    // Check if settings already exist
    const existingSettings = await queryInterface.sequelize.query(
      'SELECT id FROM settings LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingSettings.length > 0) {
      console.log('⏭️  Settings already exist, skipping seed');
      return;
    }

    await queryInterface.bulkInsert('settings', [{
      id: uuidv4(),
      subscription_system_enabled: true,
      default_recording_access_days: 30,
      recording_lifetime_access: true,
      default_course_access_days: 365,
      course_lifetime_access: true,
      default_file_access_days: 365,
      file_lifetime_access: true,
      contact_email: 'support@ludora.app',
      contact_phone: '',
      site_description: 'פלטפורמת למידה מתקדמת',
      logo_url: '',
      site_name: 'לודורה',
      maintenance_mode: true,
      student_invitation_expiry_days: 7,
      parent_consent_required: false,
      nav_order: JSON.stringify(["curriculum", "files", "games", "workshops", "courses", "lesson_plans", "classrooms", "content_creators", "account"]),
      nav_files_text: 'כלים',
      nav_files_icon: 'FileText',
      nav_files_visibility: 'logged_in_users',
      nav_files_enabled: true,
      nav_curriculum_enabled: true,
      nav_curriculum_text: 'תכנים',
      nav_curriculum_icon: 'Book',
      nav_curriculum_visibility: 'logged_in_users',
      nav_games_text: 'משחקים',
      nav_games_icon: 'Gamepad2',
      nav_games_visibility: 'public',
      nav_games_enabled: false,
      nav_workshops_text: 'הדרכות',
      nav_workshops_icon: 'Play',
      nav_workshops_visibility: 'logged_in_users',
      nav_workshops_enabled: false,
      nav_courses_text: 'קורסים',
      nav_courses_icon: 'BookOpen',
      nav_courses_visibility: 'logged_in_users',
      nav_courses_enabled: false,
      nav_classrooms_text: 'הכיתות שלי',
      nav_classrooms_icon: 'Users',
      nav_classrooms_visibility: 'logged_in_users',
      nav_classrooms_enabled: false,
      nav_account_text: 'החשבון שלי',
      nav_account_icon: 'UserIcon',
      nav_account_visibility: 'logged_in_users',
      nav_account_enabled: true,
      nav_content_creators_text: 'יוצרי תוכן',
      nav_content_creators_icon: 'Award',
      nav_content_creators_visibility: 'admins_and_creators',
      nav_content_creators_enabled: false,
      nav_tools_text: 'כלים',
      nav_tools_icon: 'Settings',
      nav_tools_visibility: 'admin_only',
      nav_tools_enabled: true,
      nav_lesson_plans_text: 'מערכי שיעור',
      nav_lesson_plans_icon: 'BookOpen',
      nav_lesson_plans_visibility: 'logged_in_users',
      nav_lesson_plans_enabled: false,
      is_sample: false,
      allow_content_creator_workshops: true,
      allow_content_creator_courses: false,
      allow_content_creator_files: true,
      allow_content_creator_tools: false,
      allow_content_creator_games: true,
      allow_content_creator_lesson_plans: false,
      created_at: new Date(),
      updated_at: new Date()
    }]);

    console.log('✅ Default settings seeded successfully');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('settings', null, {});
  }
};