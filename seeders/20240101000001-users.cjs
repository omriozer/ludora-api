'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if users already exist
    const existingUsers = await queryInterface.sequelize.query(
      'SELECT id FROM "user" LIMIT 1',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (existingUsers.length > 0) {
      console.log('⏭️  Users already exist, skipping seed');
      return;
    }

    await queryInterface.bulkInsert('user', [
      {
        id: '685afa14113ac3f4419275b1',
        email: 'ozeromri@gmail.com',
        full_name: 'עומרי עוזר',
        role: 'admin',
        is_verified: true,
        is_active: true,
        created_at: new Date('2025-06-24T12:18:44.597Z'),
        updated_at: new Date('2025-09-22T18:05:15.933Z')
      },
      {
        id: '685b15c4a037d9433fbd2805',
        email: 'galgoldman4@gmail.com',
        full_name: 'gal goldman',
        role: 'user',
        is_verified: true,
        is_active: true,
        created_at: new Date('2025-06-24T14:16:52.477Z'),
        updated_at: new Date('2025-09-12T03:20:04.974Z')
      },
      {
        id: '68a0b172b43132f178b29b83',
        email: 'galclinic9@gmail.com',
        full_name: 'גל - קליניקה לפיתוח תכני הוראה עוזר',
        role: 'user',
        is_verified: true,
        is_active: true,
        created_at: new Date('2025-08-16T09:27:30.49Z'),
        updated_at: new Date('2025-08-16T09:27:30.49Z')
      },
      {
        id: '68b5c29a1cdd154f650cb976',
        email: 'liorgoldman0@gmail.com',
        full_name: 'lior goldman',
        role: 'user',
        is_verified: true,
        is_active: true,
        created_at: new Date('2025-09-01T08:58:18.091Z'),
        updated_at: new Date('2025-09-11T16:23:44.911Z')
      }
    ]);

    console.log('✅ Users seeded successfully');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('user', null, {});
  }
};