const { randomUUID } = require('crypto');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get the tool IDs that were just created
    const [contactTool] = await queryInterface.sequelize.query(
      "SELECT id FROM tool WHERE tool_key = 'CONTACT_PAGE_GENERATOR'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    const [scheduleTool] = await queryInterface.sequelize.query(
      "SELECT id FROM tool WHERE tool_key = 'SCHEDULE_GENERATOR'",
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!contactTool || !scheduleTool) {
      throw new Error('Tool records not found. Make sure the previous migration ran successfully.');
    }

    // Create Product records that reference the tool entities
    await queryInterface.bulkInsert('product', [
      {
        id: `tool_contact_page_gen_${randomUUID()}`,
        title: 'מחולל דף קשר',
        short_description: 'כלי ליצירת דפי קשר מותאמים אישית',
        description: 'כלי ליצירת דפי קשר מותאמים אישית למוסדות חינוך וארגונים. יצירת דפי קשר מקצועיים עם כל הפרטים הנדרשים.',
        category: 'generators',
        product_type: 'tool',
        entity_id: contactTool.id, // Reference to the Tool table record
        price: 29,
        is_published: true,
        target_audience: 'מורים ומוסדות חינוך',
        access_days: 365,
        tags: JSON.stringify([]),
        type_attributes: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: `tool_schedule_gen_${randomUUID()}`,
        title: 'מחולל לוח זמנים',
        short_description: 'כלי ליצירת לוחות זמנים ותכנון מערכת שעות',
        description: 'כלי ליצירת לוחות זמנים ותכנון מערכת שעות למוסדות חינוך. יצירת מערכות שעות מותאמות אישית עם אפשרויות התאמה מתקדמות.',
        category: 'generators',
        product_type: 'tool',
        entity_id: scheduleTool.id, // Reference to the Tool table record
        price: 29,
        is_published: true,
        target_audience: 'מורים ומוסדות חינוך',
        access_days: 365,
        tags: JSON.stringify([]),
        type_attributes: JSON.stringify({}),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ Product records created for tools with proper entity_id references');
  },

  down: async (queryInterface, Sequelize) => {
    // Delete the product records for tools
    await queryInterface.bulkDelete('product', {
      product_type: 'tool'
    });

    console.log('⚠️ Tool product records removed');
  }
};