export const STUDY_SUBJECTS = {
    math: 'מתמטיקה',
    english: 'אנגלית',
    history: 'היסטוריה',
    geography: 'גיאוגרפיה',
    literature: 'ספרות',
    calculation: 'חשבון',
    physics: 'פיזיקה',
    chemistry: 'כימיה',
    biology: 'ביולוגיה',
    computers: 'מחשבים',
    art: 'אמנות',
    music: 'מוזיקה',
    physical_education: 'חינוך גופני',
    civics: 'אזרחות',
    hebrew_language: 'לשון והבעה',
    arabic: 'ערבית',
    french: 'צרפתית',
    foreign_languages: 'שפות זרות'
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