const { randomUUID } = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert the two tools
    await queryInterface.bulkInsert('tool', [
      {
        id: randomUUID(),
        tool_key: 'CONTACT_PAGE_GENERATOR',
        category: 'generators',
        default_access_days: 365,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: randomUUID(),
        tool_key: 'SCHEDULE_GENERATOR',
        category: 'generators',
        default_access_days: 365,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Tool table populated with CONTACT_PAGE_GENERATOR and SCHEDULE_GENERATOR');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the tools
    await queryInterface.bulkDelete('tool', {
      tool_key: {
        [Sequelize.Op.in]: ['CONTACT_PAGE_GENERATOR', 'SCHEDULE_GENERATOR']
      }
    });

    console.log('⚠️ Tools removed from tool table');
  }
};