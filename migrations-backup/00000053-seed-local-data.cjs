'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🌱 Seeding local database data...');

    // Seed categories
    await queryInterface.bulkInsert('category', [
      {
        id: '685b0c20cbc040cad16f0a7b',
        name: 'AI',
        is_default: false,
        is_sample: false,
        created_at: new Date('2025-06-24 13:35:44.932'),
        updated_at: new Date('2025-06-24 13:35:44.932'),
        created_by: 'ozeromri@gmail.com',
        created_by_id: '685afa14113ac3f4419275b1'
      },
      {
        id: '685b0b48a037d9433fbd1b45',
        name: 'כללי',
        is_default: true,
        is_sample: false,
        created_at: new Date('2025-06-24 13:32:08.532'),
        updated_at: new Date('2025-06-24 13:32:08.532'),
        created_by: 'ozeromri@gmail.com',
        created_by_id: '685afa14113ac3f4419275b1'
      }
    ]);

    // Seed settings table
    await queryInterface.bulkInsert('settings', [
      {
        id: '685b14f8cbc040cad16f42fa',
        subscription_system_enabled: true,
        default_recording_access_days: 30,
        recording_lifetime_access: true,
        default_course_access_days: 365,
        course_lifetime_access: true,
        default_file_access_days: 365,
        file_lifetime_access: true,
        contact_email: 'galgoldman4@gmail.com',
        contact_phone: '0529593382',
        site_description: 'בית מתקדם לחינוך ולמידה',
        logo_url: 'https://base44.app/api/apps/685afa14113ac3f4419275b0/files/4cebc4ba9_full_logo.png',
        site_name: 'לודורה',
        maintenance_mode: false,
        student_invitation_expiry_days: 7,
        parent_consent_required: true,
        nav_order: JSON.stringify(["games", "workshops", "files", "classrooms", "content_creators", "courses", "account"]),
        nav_files_text: 'כלים',
        nav_files_icon: 'FileText',
        nav_files_visibility: 'public',
        nav_files_enabled: true,
        nav_games_text: 'משחקים',
        nav_games_icon: 'Gamepad2',
        nav_games_visibility: 'public',
        nav_games_enabled: true,
        nav_workshops_text: 'הדרכות',
        nav_workshops_icon: 'Play',
        nav_workshops_visibility: 'public',
        nav_workshops_enabled: true,
        nav_courses_text: 'קורסים',
        nav_courses_icon: 'BookOpen',
        nav_courses_visibility: 'hidden',
        nav_courses_enabled: true,
        nav_classrooms_text: 'הכיתות שלי',
        nav_classrooms_icon: 'Users',
        nav_classrooms_visibility: 'public',
        nav_classrooms_enabled: true,
        nav_account_text: 'החשבון שלי',
        nav_account_icon: 'UserIcon',
        nav_account_visibility: 'public',
        nav_account_enabled: true,
        nav_content_creators_text: 'יוצרי תוכן',
        nav_content_creators_icon: 'Award',
        nav_content_creators_visibility: 'admins_and_creators',
        nav_content_creators_enabled: true,
        is_sample: false,
        allow_content_creator_workshops: true,
        allow_content_creator_courses: false,
        allow_content_creator_files: true,
        allow_content_creator_tools: false,
        allow_content_creator_games: true,
        created_at: new Date('2025-06-24 14:13:28.416'),
        updated_at: new Date('2025-09-15 16:08:33.504'),
        created_by: 'ozeromri@gmail.com',
        created_by_id: '685afa14113ac3f4419275b1'
      }
    ]);

    // Seed users
    await queryInterface.bulkInsert('user', [
      {
        id: '68a0b172b43132f178b29b83',
        email: 'galclinic9@gmail.com',
        full_name: 'גל - קליניקה לפיתוח תכני הוראה עוזר',
        disabled: null,
        is_verified: true,
        _app_role: 'user',
        role: 'user',
        created_at: new Date('2025-08-16 09:27:30.49'),
        updated_at: new Date('2025-08-16 09:27:30.49'),
        is_active: true,
        last_login: null,
        phone: null,
        education_level: null,
        content_creator_agreement_sign_date: null,
        user_type: null
      },
      {
        id: '68b5c29a1cdd154f650cb976',
        email: 'liorgoldman0@gmail.com',
        full_name: 'lior goldman',
        disabled: null,
        is_verified: true,
        _app_role: 'admin',
        role: 'user',
        created_at: new Date('2025-09-01 08:58:18.091'),
        updated_at: new Date('2025-09-11 16:23:44.911'),
        is_active: true,
        last_login: null,
        phone: null,
        education_level: null,
        content_creator_agreement_sign_date: null,
        user_type: null
      },
      {
        id: '685b15c4a037d9433fbd2805',
        email: 'galgoldman4@gmail.com',
        full_name: 'gal goldman',
        disabled: null,
        is_verified: true,
        _app_role: 'admin',
        role: 'user',
        created_at: new Date('2025-06-24 14:16:52.477'),
        updated_at: new Date('2025-09-12 03:20:04.974'),
        is_active: true,
        last_login: null,
        phone: '054-477-7884',
        education_level: 'master_education',
        content_creator_agreement_sign_date: new Date('2025-09-11 22:21:23.247+07'),
        user_type: null
      },
      {
        id: '685afa14113ac3f4419275b1',
        email: 'ozeromri@gmail.com',
        full_name: 'עומרי עוזר',
        disabled: null,
        is_verified: true,
        _app_role: 'admin',
        role: 'admin',
        created_at: new Date('2025-06-24 12:18:44.597'),
        updated_at: new Date('2025-09-22 18:05:15.933'),
        is_active: true,
        last_login: new Date('2025-09-10 10:28:01.073'),
        phone: '0544777884',
        education_level: 'no_education_degree',
        content_creator_agreement_sign_date: new Date('2025-09-11 21:47:38.337+07'),
        user_type: null
      }
    ]);

    console.log('✅ Local data seeded successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🗑️ Removing seeded data...');

    // Clear data in reverse order
    await queryInterface.bulkDelete('user', null, {});
    await queryInterface.bulkDelete('settings', null, {});
    await queryInterface.bulkDelete('category', null, {});

    console.log('✅ Seeded data removed');
  }
};