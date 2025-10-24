export const STUDY_SUBJECTS = {
    civics: 'אזרחות',
    art: 'אמנות',
    english: 'אנגלית',
    biology: 'ביולוגיה',
    geography: 'גיאוגרפיה',
    history: 'היסטוריה',
    physical_education: 'חינוך גופני',
    calculation: 'חשבון',
    chemistry: 'כימיה',
    hebrew_language: 'לשון והבעה',
    legacy: 'מורשת',
    religion: 'מחשבת ישראל',
    computers: 'מחשבים',
    music: 'מוזיקה',
    math: 'מתמטיקה',
    spanish: 'ספרדית',
    literature: 'ספרות',
    arabic: 'ערבית',
    physics: 'פיזיקה',
    french: 'צרפתית',
    bible_studies: 'תנ"ך',
};

export const SCHOOL_GRADES = {
    1: 'כיתה א\'',
    2: 'כיתה ב\'',
    3: 'כיתה ג\'',
    4: 'כיתה ד\'',
    5: 'כיתה ה\'',
    6: 'כיתה ו\'',
    7: 'כיתה ז\'',
    8: 'כיתה ח\'',
    9: 'כיתה ט\'',
    10: 'כיתה י\'',
    11: 'כיתה יא\'',
    12: 'כיתה יב\''
};

export const AUDIANCE_TARGETS_GROUPS = {
    student_ages: [
        'גיל הרך (3-5)',
        'ילדים (6-12)',
        'נוער (13-18)',
    ],
    teachers: [
        'מורים מקצועיים',
        'מחנכים',
    ],
    school_staff: [
        'מנהלי בתי ספר',
        'רכזי מקצוע',
        'רכזי שכבה',
        'יועצים חינוכיים',
        'מזכירות בתי ספר',
    ],
    parents: [
        'הורים'
    ]
}

export const FILES_AUDIANCE_TARGETS = [
    ...AUDIANCE_TARGETS_GROUPS.student_ages,
    ...AUDIANCE_TARGETS_GROUPS.teachers,
    ...AUDIANCE_TARGETS_GROUPS.school_staff,
    ...AUDIANCE_TARGETS_GROUPS.parents,
];

export const WORKSHOPS_AUDIANCE_TARGETS = [
    ...AUDIANCE_TARGETS_GROUPS.teachers,
    ...AUDIANCE_TARGETS_GROUPS.school_staff,
    ...AUDIANCE_TARGETS_GROUPS.parents,
];

export const COURSES_AUDIANCE_TARGETS = [
    ...AUDIANCE_TARGETS_GROUPS.student_ages,
    ...AUDIANCE_TARGETS_GROUPS.teachers,
    ...AUDIANCE_TARGETS_GROUPS.school_staff,
];

export const TOOLS_AUDIANCE_TARGETS = [
    ...AUDIANCE_TARGETS_GROUPS.teachers,
    ...AUDIANCE_TARGETS_GROUPS.school_staff,
];

export const AUDIANCE_TARGETS = {
    file: FILES_AUDIANCE_TARGETS,
    workshop: WORKSHOPS_AUDIANCE_TARGETS,
    course: COURSES_AUDIANCE_TARGETS,
    tool: TOOLS_AUDIANCE_TARGETS
};

