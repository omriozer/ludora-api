/**
 * Centralized Game Types Configuration for Backend
 *
 * This file defines game type validation rules, permissions,
 * and type constraints for the API.
 */

// Game Types Configuration
export const GAME_TYPES = {
	scatter_game: {
		key: 'scatter_game',
		name: 'תפזורת',
		description: 'מציאת מילים בתפזורת',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		isDevelopment: true,
		requiredFields: ['game_settings'],
		validationRules: {
			// Note: title, short_description, price validation moved to Product level
		},
	},
	wisdom_maze: {
		key: 'wisdom_maze',
		name: 'מבוך החוכמה',
		description: 'נווט במבוך ופתור משימות',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		isPublished: false,
		requiredFields: ['game_settings'],
		validationRules: {
			// Note: title, short_description, price validation moved to Product level
		},
	},
	sharp_and_smooth: {
		key: 'sharp_and_smooth',
		name: 'חד וחלק',
		description: 'פוצצו את הבועה לפי חוקים',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		allowContentCreator: false,
		requiredFields: ['game_settings'],
		validationRules: {
			// Note: title, short_description, price validation moved to Product level
		},
	},
	memory_game: {
		key: 'memory_game',
		name: 'משחק זיכרון',
		description: 'משחק התאמה וזיכרון',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		showInCatalog: false,
		requiredFields: ['game_settings'],
		validationRules: {
			// Note: title, short_description, price validation moved to Product level
		},
	},
};

// Utility functions
export const getGameTypeConfig = (key) => {
	return GAME_TYPES[key] || null;
};

export const isValidGameType = (key) => {
	return key in GAME_TYPES;
};

export const getGameTypeName = (key) => {
	const gameType = GAME_TYPES[key];
	return gameType?.name || key;
};

export const getGameTypeDescription = (key) => {
	const gameType = GAME_TYPES[key];
	return gameType?.description || '';
};

export const getValidDeviceCompatibilityOptions = (gameTypeKey) => {
	const gameType = GAME_TYPES[gameTypeKey];
	return gameType?.deviceCompatibility || ['both'];
};

// Filter functions
export const getPublishedGameTypes = () => {
	return Object.values(GAME_TYPES).filter((gameType) => gameType.isPublished);
};

export const getContentCreatorAllowedGameTypes = () => {
	return Object.values(GAME_TYPES).filter((gameType) => gameType.allowContentCreator);
};

export const getCatalogVisibleGameTypes = () => {
	return Object.values(GAME_TYPES).filter((gameType) => gameType.showInCatalog);
};

export const getDevelopmentGameTypes = () => {
	return Object.values(GAME_TYPES).filter((gameType) => gameType.isDevelopment);
};

// Validation functions
export const validateGameTypeData = (gameTypeKey, gameData) => {
	const gameType = GAME_TYPES[gameTypeKey];
	if (!gameType) {
		return { isValid: false, errors: [`Invalid game type: ${gameTypeKey}`] };
	}

	const errors = [];

	// Check required fields
	gameType.requiredFields.forEach((field) => {
		if (!gameData[field]) {
			errors.push(`Missing required field: ${field}`);
		}
	});

	// Validate against rules
	const rules = gameType.validationRules;

	// Note: title, short_description, price validation is now handled at Product level

	// Validate device compatibility
	if (gameData.device_compatibility && !gameType.deviceCompatibility.includes(gameData.device_compatibility)) {
		errors.push(
			`Invalid device compatibility: ${
				gameData.device_compatibility
			}. Valid options: ${gameType.deviceCompatibility.join(', ')}`
		);
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};

// Export arrays for iteration
export const GAME_TYPE_KEYS = Object.keys(GAME_TYPES);
export const ALL_GAME_TYPES = Object.values(GAME_TYPES);
