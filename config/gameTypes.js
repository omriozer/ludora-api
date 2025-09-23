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
		requiredFields: ['title', 'short_description', 'game_settings'],
		validationRules: {
			price: { min: 0, max: 1000 },
			title: { minLength: 3, maxLength: 100 },
			short_description: { minLength: 10, maxLength: 500 },
		},
	},
	wisdom_maze: {
		key: 'wisdom_maze',
		name: 'מבוך החוכמה',
		description: 'נווט במבוך ופתור משימות',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		isPublished: false,
		requiredFields: ['title', 'short_description', 'game_settings'],
		validationRules: {
			price: { min: 0, max: 1000 },
			title: { minLength: 3, maxLength: 100 },
			short_description: { minLength: 10, maxLength: 500 },
		},
	},
	sharp_and_smooth: {
		key: 'sharp_and_smooth',
		name: 'חד וחלק',
		description: 'פוצצו את הבועה לפי חוקים',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		allowContentCreator: false,
		requiredFields: ['title', 'short_description', 'game_settings'],
		validationRules: {
			price: { min: 0, max: 1000 },
			title: { minLength: 3, maxLength: 100 },
			short_description: { minLength: 10, maxLength: 500 },
		},
	},
	memory_game: {
		key: 'memory_game',
		name: 'משחק זיכרון',
		description: 'משחק התאמה וזיכרון',
		defaultPrice: 0,
		deviceCompatibility: ['both', 'mobile_only', 'desktop_only'],
		showInCatalog: false,
		requiredFields: ['title', 'short_description', 'game_settings'],
		validationRules: {
			price: { min: 0, max: 1000 },
			title: { minLength: 3, maxLength: 100 },
			short_description: { minLength: 10, maxLength: 500 },
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

	if (rules.price && gameData.price !== undefined) {
		if (gameData.price < rules.price.min || gameData.price > rules.price.max) {
			errors.push(`Price must be between ${rules.price.min} and ${rules.price.max}`);
		}
	}

	if (rules.title && gameData.title) {
		if (gameData.title.length < rules.title.minLength || gameData.title.length > rules.title.maxLength) {
			errors.push(`Title must be between ${rules.title.minLength} and ${rules.title.maxLength} characters`);
		}
	}

	if (rules.short_description && gameData.short_description) {
		if (
			gameData.short_description.length < rules.short_description.minLength ||
			gameData.short_description.length > rules.short_description.maxLength
		) {
			errors.push(
				`Short description must be between ${rules.short_description.minLength} and ${rules.short_description.maxLength} characters`
			);
		}
	}

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
