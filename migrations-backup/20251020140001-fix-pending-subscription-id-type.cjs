'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🔧 Fixing pendingsubscription id column type...');

    // Drop the primary key constraint first
    await queryInterface.sequelize.query('ALTER TABLE pendingsubscription DROP CONSTRAINT pendingsubscription_pkey;');

    // Change column type from UUID to VARCHAR(255)
    await queryInterface.changeColumn('pendingsubscription', 'id', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // Re-add the primary key constraint
    await queryInterface.sequelize.query('ALTER TABLE pendingsubscription ADD CONSTRAINT pendingsubscription_pkey PRIMARY KEY (id);');

    console.log('✅ pendingsubscription id column type fixed successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔧 Reverting pendingsubscription id column type...');

    // Drop the primary key constraint first
    await queryInterface.sequelize.query('ALTER TABLE pendingsubscription DROP CONSTRAINT pendingsubscription_pkey;');

    // Change column type back to UUID
    await queryInterface.changeColumn('pendingsubscription', 'id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.UUIDV4
    });

    // Re-add the primary key constraint
    await queryInterface.sequelize.query('ALTER TABLE pendingsubscription ADD CONSTRAINT pendingsubscription_pkey PRIMARY KEY (id);');

    console.log('✅ pendingsubscription id column type reverted successfully');
  }
};