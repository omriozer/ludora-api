'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		console.log('Dropping and recreating school table...');

		// Drop the table if it exists
		await queryInterface.dropTable('school');

		// Create the school table from scratch with proper constraints
		await queryInterface.createTable('school', {
			// Base fields (following baseModel.js pattern)
			id: {
				type: Sequelize.STRING,
				primaryKey: true,
				allowNull: false,
			},
			// Core school information (required fields)
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'School name',
			},
			city: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'City where the school is located',
			},
			address: {
				type: Sequelize.STRING,
				allowNull: false,
				comment: 'Full address of the school',
			},
			institution_symbol: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
				comment: 'Unique institution symbol/code',
			},

			// Contact information
			email: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'Primary email address',
			},
			phone_numbers: {
				type: Sequelize.JSONB,
				allowNull: true,
				defaultValue: [],
				comment: 'Array of phone objects with phone and description fields',
			},

			// Educational information
			education_levels: {
				type: Sequelize.JSONB,
				allowNull: true,
				defaultValue: [],
				comment: 'Array of education levels (elementary, middle_school, high_school, academic)',
			},
			district: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'Educational district (צפון, חיפה, מרכז, etc.)',
			},

			// Visual branding
			logo_url: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'URL to school logo image',
			},

			// Management & System Integration (Admin-only fields)
			school_headmaster_id: {
				type: Sequelize.STRING,
				allowNull: true,
				references: {
					model: 'user',
					key: 'id',
					onDelete: 'SET NULL',
					onUpdate: 'CASCADE',
				},
				comment: 'School headmaster user ID',
			},
			edu_system_id: {
				type: Sequelize.STRING,
				allowNull: true,
				comment: 'Education system identifier',
			},
			created_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.NOW,
			},
			updated_at: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.NOW,
			},
		});

		// Add unique constraint on name + city + address combination
		await queryInterface.addConstraint('school', {
			fields: ['name', 'city', 'address'],
			type: 'unique',
			name: 'unique_school_location',
		});

		// Add indexes for performance
		await queryInterface.addIndex('school', ['institution_symbol'], {
			name: 'idx_school_institution_symbol',
			unique: true,
		});
		await queryInterface.addIndex('school', ['city'], {
			name: 'idx_school_city',
		});
		await queryInterface.addIndex('school', ['district'], {
			name: 'idx_school_district',
		});
		await queryInterface.addIndex('school', ['school_headmaster_id'], {
			name: 'idx_school_headmaster_id',
		});
		await queryInterface.addIndex('school', ['edu_system_id'], {
			name: 'idx_school_edu_system_id',
		});
		await queryInterface.addIndex('school', ['created_at'], {
			name: 'idx_school_created_at',
		});

		console.log('School table recreated successfully with proper constraints');
	},

	async down(queryInterface, Sequelize) {
		console.log('Dropping school table...');
		await queryInterface.dropTable('school');
	},
};
