'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Import constants - we need to use dynamic import for ES modules
    const { STUDY_SUBJECTS, SCHOOL_GRADES } = await import('../constants/info.js');

    // Generate a simple ID for each curriculum
    function generateId() {
      return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    // Get all subject keys and grade numbers
    const subjects = Object.keys(STUDY_SUBJECTS);
    const grades = Object.keys(SCHOOL_GRADES).map(g => parseInt(g));

    console.log(`Creating ${subjects.length} subjects × ${grades.length} grades = ${subjects.length * grades.length} curriculum entries`);

    // Create curriculum entries for all combinations
    const curriculumEntries = [];
    const now = new Date();

    for (const subject of subjects) {
      for (const grade of grades) {
        curriculumEntries.push({
          id: generateId(),
          subject: subject,
          grade: grade,
          teacher_user_id: null, // System curriculum
          class_id: null, // System curriculum
          is_active: false, // Non-active as requested
          created_at: now,
          updated_at: now
        });
      }
    }

    console.log(`Inserting ${curriculumEntries.length} curriculum entries...`);

    // Insert all curriculum entries
    await queryInterface.bulkInsert('curriculum', curriculumEntries);

    console.log('✅ Successfully populated curriculum table with default entries');
  },

  async down(queryInterface, Sequelize) {
    // Remove all system curriculum entries (where teacher_user_id and class_id are null)
    await queryInterface.bulkDelete('curriculum', {
      teacher_user_id: null,
      class_id: null
    });

    console.log('✅ Removed all system curriculum entries');
  }
};