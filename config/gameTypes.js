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
		disabled: true,
		singular: 'תפזורת',
		plural: 'תפזורות',
		navText: 'תפזורת',
		description: 'מציאת מילים בתפזורת',
		emoji: '🎯',
		color: 'from-red-500 to-red-600',
		bgColor: 'bg-red-50',
		borderColor: 'border-red-200',
		gradient: 'from-red-400 via-pink-500 to-purple-600',
		defaultPrice: 0,
		digital: true,
		offline: false,
		isPublished: false,
		allowContentCreator: false,
		showInCatalog: false,
		allowedContentTypes: ['Word', 'WordEN', 'ContentList'],
		validationRules: {},
	},
	sharp_and_smooth: {
		key: 'sharp_and_smooth',
		disabled: true,
		singular: 'חד וחלק',
		plural: 'חד וחלק',
		navText: 'חד וחלק',
		description: 'פוצצו את הבועה לפי חוקי השלב',
		emoji: '✏️',
		color: 'from-orange-500 to-orange-600',
		bgColor: 'bg-orange-50',
		borderColor: 'border-orange-200',
		gradient: 'from-orange-400 via-yellow-500 to-amber-600',
		defaultPrice: 0,
		digital: true,
		offline: false,
		isPublished: false,
		allowContentCreator: false,
		showInCatalog: false,
		allowedContentTypes: ['Word', 'WordEN', 'QA', 'ContentList'],
		validationRules: {},
	},
	memory_game: {
		key: 'memory_game',
		singular: 'משחק זיכרון',
		plural: 'משחקי זיכרון',
		navText: 'משחק זיכרון',
		description: 'משחק התאמה וזיכרון',
		emoji: '🧠',
		color: 'from-green-500 to-green-600',
		bgColor: 'bg-green-50',
		borderColor: 'border-green-200',
		gradient: 'from-green-400 via-emerald-500 to-teal-600',
		defaultPrice: 0,
		digital: true,
		offline: false,
		isPublished: false,
		allowContentCreator: false,
		showInCatalog: false,
		allowedContentTypes: ['Word', 'WordEN', 'Image', 'ContentList'],
		validationRules: {},
	},
	ar_up_there: {
		key: 'ar_up_there',
		disabled: true,
		singular: 'אי שם',
		plural: 'אי שם',
		navText: 'אי שם',
		description: 'משחק מציאות רבודה למובייל',
		emoji: '📱',
		color: 'from-cyan-500 to-cyan-600',
		bgColor: 'bg-cyan-50',
		borderColor: 'border-cyan-200',
		gradient: 'from-cyan-400 via-blue-500 to-indigo-600',
		defaultPrice: 0,
		digital: true,
		offline: false,
		isPublished: false,
		allowContentCreator: true,
		showInCatalog: false,
		allowedContentTypes: ['Word', 'WordEN', 'QA', 'Image', 'ContentList'],
		validationRules: {},
	},
};

// Utility functions
export const getGameTypeConfig = (key) => {
	return GAME_TYPES[key] || null;
};

export const isValidGameType = (key) => {
	return key in GAME_TYPES;
};

export const getGameTypeName = (key, form = 'singular') => {
	const gameType = GAME_TYPES[key];
	return gameType?.[form] || key;
};

export const getGameTypeDescription = (key) => {
	const gameType = GAME_TYPES[key];
	return gameType?.description || '';
};

export const getValidDigitalOptions = (gameTypeKey) => {
	// This function returns the digital setting for a game type
	// Digital: true = דיגיטלי, false = גרסה להדפסה
	const gameType = GAME_TYPES[gameTypeKey];
	return gameType ? [gameType.digital] : [true];
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

// Validation functions
export const validateGameTypeData = (gameTypeKey, _gameData) => {
	const gameType = GAME_TYPES[gameTypeKey];
	if (!gameType) {
		return { isValid: false, errors: [`Invalid game type: ${gameTypeKey}`] };
	}

	// No required fields validation - game_settings is now optional
	// All validation is handled at Product level

	return {
		isValid: true,
		errors: [],
	};
};

// Export arrays for iteration
export const GAME_TYPE_KEYS = Object.keys(GAME_TYPES);
export const ALL_GAME_TYPES = Object.values(GAME_TYPES);
