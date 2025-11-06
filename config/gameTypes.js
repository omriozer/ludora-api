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
		requiredFields: ['game_settings'],
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
		requiredFields: ['game_settings'],
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
		requiredFields: ['game_settings'],
		validationRules: {},
		settings: {
			digital: {
				min_cards: {
					type: 'number',
					label: 'מספר קלפים מינימלי',
					defaultValue: 8,
					min: 4,
					max: 30,
					step: 2,
					description: 'מספר הקלפים המינימלי במשחק (זוגות)',
					validation: {
						required: true,
						min: 4,
						max: 30,
						message: 'מספר הקלפים חייב להיות בין 4 ל-30'
					}
				},
				max_cards: {
					type: 'number',
					label: 'מספר קלפים מקסימלי',
					defaultValue: 16,
					min: 4,
					max: 30,
					step: 2,
					description: 'מספר הקלפים המקסימלי במשחק (זוגות)',
					validation: {
						required: true,
						min: 4,
						max: 30,
						message: 'מספר הקלפים חייב להיות בין 4 ל-30'
					}
				},
				semanticTypeSetA: {
					type: 'text',
					label: 'סוג תוכן קבוצה א\'',
					defaultValue: 'מילה',
					maxLength: 50,
					description: 'תיאור סוג התוכן של קבוצת הקלפים הראשונה',
					validation: {
						required: true,
						maxLength: 50,
						message: 'תיאור סוג התוכן חייב להיות עד 50 תווים'
					}
				},
				semanticTypeSetB: {
					type: 'text',
					label: 'סוג תוכן קבוצה ב\'',
					defaultValue: 'מילה',
					maxLength: 50,
					description: 'תיאור סוג התוכן של קבוצת הקלפים השנייה',
					validation: {
						required: true,
						maxLength: 50,
						message: 'תיאור סוג התוכן חייב להיות עד 50 תווים'
					}
				},
				semanticTypeSetA: {
					type: 'select',
					label: 'סוג תוכן קבוצה א\'',
					defaultValue: 'word',
					options: [
						{ value: 'word', label: 'מילים' },
						{ value: 'question', label: 'שאלות' },
						{ value: 'name', label: 'שמות' },
						{ value: 'place', label: 'מקומות' },
						{ value: 'text', label: 'טקסטים' },
						{ value: 'image', label: 'תמונות' },
						{ value: 'audio', label: 'קבצי שמע' },
						{ value: 'video', label: 'סרטונים' }
					],
					description: 'בחר סוג התוכן של קבוצת הקלפים הראשונה',
					validation: {
						required: true,
						isIn: [['word', 'question', 'name', 'place', 'text', 'image', 'audio', 'video']],
						message: 'בחר סוג תוכן תקין'
					}
				},
				semanticTypeSetB: {
					type: 'select',
					label: 'סוג תוכן קבוצה ב\'',
					defaultValue: 'image',
					options: [
						{ value: 'word', label: 'מילים' },
						{ value: 'question', label: 'שאלות' },
						{ value: 'name', label: 'שמות' },
						{ value: 'place', label: 'מקומות' },
						{ value: 'text', label: 'טקסטים' },
						{ value: 'image', label: 'תמונות' },
						{ value: 'audio', label: 'קבצי שמע' },
						{ value: 'video', label: 'סרטונים' }
					],
					description: 'בחר סוג התוכן של קבוצת הקלפים השנייה',
					validation: {
						required: true,
						isIn: [['word', 'question', 'name', 'place', 'text', 'image', 'audio', 'video']],
						message: 'בחר סוג תוכן תקין'
					}
				},
				time_limit: {
					type: 'number',
					label: 'הגבלת זמן (דקות)',
					defaultValue: null,
					min: 1,
					max: 60,
					nullable: true,
					description: 'זמן מקסימלי למשחק בדקות (ריק = ללא הגבלה)',
					validation: {
						required: false,
						min: 1,
						max: 60,
						message: 'הגבלת הזמן חייבת להיות בין 1-60 דקות'
					}
				}
			},
			offline: {
				// Offline settings will be added later
			}
		}
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
		requiredFields: ['game_settings'],
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

	// Note: title, short_description, price validation is now handled at Product level

	return {
		isValid: errors.length === 0,
		errors,
	};
};

// Export arrays for iteration
export const GAME_TYPE_KEYS = Object.keys(GAME_TYPES);
export const ALL_GAME_TYPES = Object.values(GAME_TYPES);
