'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Import constants to populate default data
    const { STUDY_SUBJECTS, SCHOOL_GRADES } = await import('../constants/info.js');

    // Add the new columns
    await queryInterface.addColumn('settings', 'available_specializations', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Available specializations for teacher onboarding'
    });

    await queryInterface.addColumn('settings', 'available_grade_levels', {
      type: Sequelize.JSONB,
      allowNull: true,
      comment: 'Available grade levels for classroom creation'
    });

    // Populate default data based on constants
    const defaultSpecializations = Object.entries(STUDY_SUBJECTS).map(([key, hebrewName]) => ({
      key,
      name: hebrewName,
      emoji: getSubjectEmoji(key),
      enabled: true
    }));

    const defaultGradeLevels = Object.entries(SCHOOL_GRADES).map(([gradeNumber, hebrewLabel]) => ({
      value: `grade_${gradeNumber}`,
      label: `${getGradeEmoji(gradeNumber)} ${hebrewLabel}`,
      enabled: true
    }));

    // Add kindergarten and special grades
    defaultGradeLevels.unshift({
      value: 'kindergarten',
      label: '🧸 גן חובה',
      enabled: true
    });

    // Update settings with default data if no settings exist yet
    const settingsCount = await queryInterface.sequelize.query(
      'SELECT COUNT(*) FROM settings',
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (settingsCount[0].count === '0') {
      // Create initial settings record
      await queryInterface.sequelize.query(`
        INSERT INTO settings (
          id,
          available_specializations,
          available_grade_levels,
          created_at,
          updated_at
        ) VALUES (
          '1',
          $1,
          $2,
          NOW(),
          NOW()
        )
      `, {
        bind: [
          JSON.stringify(defaultSpecializations),
          JSON.stringify(defaultGradeLevels)
        ]
      });
    } else {
      // Update existing settings with default data
      await queryInterface.sequelize.query(`
        UPDATE settings
        SET
          available_specializations = $1,
          available_grade_levels = $2,
          updated_at = NOW()
        WHERE available_specializations IS NULL OR available_grade_levels IS NULL
      `, {
        bind: [
          JSON.stringify(defaultSpecializations),
          JSON.stringify(defaultGradeLevels)
        ]
      });
    }

    function getSubjectEmoji(key) {
      const emojiMap = {
        civics: '🏛️',
        art: '🎨',
        english: '🇺🇸',
        biology: '🧬',
        geography: '🌍',
        history: '📚',
        physical_education: '⚽',
        calculation: '🔢',
        chemistry: '⚗️',
        hebrew_language: '📖',
        legacy: '🏛️',
        religion: '📜',
        computers: '💻',
        music: '🎵',
        math: '🔢',
        spanish: '🇪🇸',
        literature: '📖',
        arabic: '🇸🇦',
        physics: '⚛️',
        french: '🇫🇷',
        bible_studies: '📜'
      };
      return emojiMap[key] || '📚';
    }

    function getGradeEmoji(gradeNumber) {
      const gradeNum = parseInt(gradeNumber);
      if (gradeNum <= 9) return `${gradeNum}️⃣`;
      if (gradeNum === 10) return '🔟';
      if (gradeNum === 11) return '🎯';
      if (gradeNum === 12) return '🎓';
      return '📚';
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('settings', 'available_specializations');
    await queryInterface.removeColumn('settings', 'available_grade_levels');
  }
};