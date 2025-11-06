import { DataTypes } from 'sequelize';
import { baseFields, baseOptions, generateId } from './baseModel.js';

export default function (sequelize) {
	const GameContent = sequelize.define(
		'GameContent',
		{
			id: {
				type: DataTypes.STRING,
				primaryKey: true,
				allowNull: false,
				defaultValue: () => generateId(),
			},
			semantic_type: {
				type: DataTypes.STRING,
				allowNull: false,
				validate: {
					isIn: [['word', 'question', 'name', 'place', 'text', 'image', 'audio', 'video', 'game_card_bg', 'complete_card']],
				},
			},
			data_type: {
				type: DataTypes.STRING,
				allowNull: false,
				validate: {
					isIn: [['string', 'varchar', 'number', 'image_url', 'audio_url', 'video_url']],
				},
			},
			value: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			metadata: {
				type: DataTypes.JSONB,
				allowNull: true,
				defaultValue: {},
			},
		},
		{
			...baseOptions,
			tableName: 'gamecontent',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
			indexes: [
				{
					fields: ['semantic_type'],
				},
				{
					fields: ['data_type'],
				},
				{
					fields: ['metadata'],
					using: 'gin',
				},
			],
		}
	);

	GameContent.associate = function (models) {
		// Has many relation items (can be part of many relationships)
		GameContent.hasMany(models.GameContentRelationItem, {
			foreignKey: 'content_id',
			as: 'relationItems'
		});

		// Many-to-many through GameContentRelationItem
		GameContent.belongsToMany(models.GameContentRelation, {
			through: models.GameContentRelationItem,
			foreignKey: 'content_id',
			otherKey: 'relation_id',
			as: 'relations'
		});

		// Many-to-many with Games through GameContentLink
		GameContent.belongsToMany(models.Game, {
			through: models.GameContentLink,
			foreignKey: 'target_id',
			otherKey: 'game_id',
			as: 'linkedGames'
		});
	};

	return GameContent;
}
