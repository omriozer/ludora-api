export const SYSTEM_DEFAULT_LANGUAGE = {
    hebrew: 'עברית',
};

export const OTHER_LANGUAGES = {
    english: 'אנגלית',
    spanish: 'ספרדית',
    literature: 'ספרות',
    arabic: 'ערבית',
    physics: 'פיזיקה',
    french: 'צרפתית',
};

export const LANGUAGES_OPTIONS = {
    ...SYSTEM_DEFAULT_LANGUAGE,
    ...OTHER_LANGUAGES
};

export const LANGUAGES_STUDY_SUBJECTS = {
    hebrew_language: 'לשון והבעה',
    ...OTHER_LANGUAGES
};
