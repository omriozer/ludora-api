'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      console.log('Creating לשון והבעה curriculum with grade ranges...');

      // Helper function to generate IDs
      const generateId = () => Date.now().toString() + Math.random().toString(36).substring(2, 11);

      // Create curriculum entries for different grade ranges
      const curriculumData = [
        {
          id: generateId(),
          subject: 'hebrew_language',
          grade: 1, // Representative grade for backwards compatibility
          grade_from: 1,
          grade_to: 2,
          is_grade_range: true,
          teacher_user_id: null, // System curriculum
          class_id: null, // System curriculum
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          original_curriculum_id: null
        },
        {
          id: generateId(),
          subject: 'hebrew_language',
          grade: 3, // Representative grade for backwards compatibility
          grade_from: 3,
          grade_to: 4,
          is_grade_range: true,
          teacher_user_id: null,
          class_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          original_curriculum_id: null
        },
        {
          id: generateId(),
          subject: 'hebrew_language',
          grade: 5, // Representative grade for backwards compatibility
          grade_from: 5,
          grade_to: 6,
          is_grade_range: true,
          teacher_user_id: null,
          class_id: null,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          original_curriculum_id: null
        }
      ];

      // Insert curriculum entries
      await queryInterface.bulkInsert('curriculum', curriculumData, { transaction });
      console.log('✅ Created curriculum entries for grades 1-2, 3-4, 5-6');

      // Curriculum items for grades 1-2 (early Hebrew language skills)
      const curriculumItems12 = [
        {
          id: generateId(),
          curriculum_id: curriculumData[0].id,
          study_topic: 'זיהוי אותיות',
          content_topic: 'הכרת האותיות בעברית - אותיות הדפוס',
          is_mandatory: true,
          mandatory_order: 1,
          custom_order: 1,
          description: 'זיהוי וקריאת אותיות הדפוס העבריות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[0].id,
          study_topic: 'קריאה',
          content_topic: 'קריאת מילים פשוטות',
          is_mandatory: true,
          mandatory_order: 2,
          custom_order: 2,
          description: 'קריאת מילים בסיסיות ופשוטות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[0].id,
          study_topic: 'כתיבה',
          content_topic: 'כתיבת אותיות דפוס',
          is_mandatory: true,
          mandatory_order: 3,
          custom_order: 3,
          description: 'כתיבת אותיות דפוס עבריות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[0].id,
          study_topic: 'הבנת הנקרא',
          content_topic: 'הבנת משפטים קצרים',
          is_mandatory: true,
          mandatory_order: 4,
          custom_order: 4,
          description: 'הבנת משפטים קצרים ופשוטים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[0].id,
          study_topic: 'הבעה בעל פה',
          content_topic: 'תיאור פשוט של תמונות וחפצים',
          is_mandatory: true,
          mandatory_order: 5,
          custom_order: 5,
          description: 'תיאור פשוט ובסיסי של סביבה קרובה',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Curriculum items for grades 3-4 (intermediate Hebrew language skills)
      const curriculumItems34 = [
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'קריאה שוטפת',
          content_topic: 'קריאת טקסטים קצרים',
          is_mandatory: true,
          mandatory_order: 1,
          custom_order: 1,
          description: 'קריאה שוטפת של טקסטים קצרים ומובנים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'כתיבה',
          content_topic: 'כתיבת משפטים ופסקאות קצרות',
          is_mandatory: true,
          mandatory_order: 2,
          custom_order: 2,
          description: 'כתיבת משפטים שלמים ופסקאות קצרות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'אוצר מילים',
          content_topic: 'הרחבת אוצר המילים',
          is_mandatory: true,
          mandatory_order: 3,
          custom_order: 3,
          description: 'הכרת מילים חדשות והבנת משמעותן',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'הבנת הנקרא',
          content_topic: 'הבנת סיפורים ומידע עיקרי',
          is_mandatory: true,
          mandatory_order: 4,
          custom_order: 4,
          description: 'הבנת עלילה ומידע מרכזי בטקסטים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'הבעה בעל פה',
          content_topic: 'סיפור ותיאור מפורט',
          is_mandatory: true,
          mandatory_order: 5,
          custom_order: 5,
          description: 'סיפור חויות ותיאור מפורט של אירועים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[1].id,
          study_topic: 'דקדוק',
          content_topic: 'כללי דקדוק בסיסיים',
          is_mandatory: true,
          mandatory_order: 6,
          custom_order: 6,
          description: 'הכרת כללי דקדוק בסיסיים - זכר ונקבה, יחיד ורבים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Curriculum items for grades 5-6 (advanced Hebrew language skills)
      const curriculumItems56 = [
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'קריאה מתקדמת',
          content_topic: 'קריאת טקסטים מורכבים וספרותיים',
          is_mandatory: true,
          mandatory_order: 1,
          custom_order: 1,
          description: 'קריאה והבנה של טקסטים ספרותיים ומידעיים מורכבים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'כתיבה יצירתית',
          content_topic: 'כתיבת חיבורים וסיפורים',
          is_mandatory: true,
          mandatory_order: 2,
          custom_order: 2,
          description: 'כתיבת חיבורים, סיפורים וטקסטים יצירתיים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'ביקורת ספרות',
          content_topic: 'ניתוח טקסטים ספרותיים',
          is_mandatory: true,
          mandatory_order: 3,
          custom_order: 3,
          description: 'ניתוח ופרשנות של טקסטים ספרותיים',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'דקדוק מתקדם',
          content_topic: 'כללי דקדוק מורכבים',
          is_mandatory: true,
          mandatory_order: 4,
          custom_order: 4,
          description: 'זמנים, גזרות, תחביר משפטי מורכב',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'הבעה ודיבור',
          content_topic: 'הצגה ודיון מובנה',
          is_mandatory: true,
          mandatory_order: 5,
          custom_order: 5,
          description: 'הצגת עמדות, ניהול דיון והבעת דעות מנומקות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'חקר לשון',
          content_topic: 'מקורות השפה והתפתחותה',
          is_mandatory: true,
          mandatory_order: 6,
          custom_order: 6,
          description: 'הכרת מקורות השפה העברית והתפתחותה',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: generateId(),
          curriculum_id: curriculumData[2].id,
          study_topic: 'כתיבה אקדמית',
          content_topic: 'מחקר וכתיבה מובנית',
          is_mandatory: true,
          mandatory_order: 7,
          custom_order: 7,
          description: 'כתיבת מחקרים קצרים ועבודות מובנות',
          is_completed: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      // Insert all curriculum items
      const allCurriculumItems = [...curriculumItems12, ...curriculumItems34, ...curriculumItems56];
      await queryInterface.bulkInsert('curriculum_item', allCurriculumItems, { transaction });
      console.log(`✅ Created ${allCurriculumItems.length} curriculum items across all grade ranges`);

      await transaction.commit();
      console.log('✅ Hebrew language curriculum with grade ranges created successfully');
      console.log(`📊 Summary:
        - Grades 1-2: ${curriculumItems12.length} curriculum items
        - Grades 3-4: ${curriculumItems34.length} curriculum items
        - Grades 5-6: ${curriculumItems56.length} curriculum items
        - Total: ${allCurriculumItems.length} curriculum items`);

    } catch (error) {
      await transaction.rollback();
      console.error('❌ Hebrew language curriculum creation failed:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Delete curriculum items first (due to foreign key constraints)
      await queryInterface.sequelize.query(`
        DELETE FROM curriculum_item
        WHERE curriculum_id IN (
          SELECT id FROM curriculum
          WHERE subject = 'hebrew_language'
          AND is_grade_range = true
          AND teacher_user_id IS NULL
          AND class_id IS NULL
        )
      `, { transaction });

      // Delete curriculum entries
      await queryInterface.sequelize.query(`
        DELETE FROM curriculum
        WHERE subject = 'hebrew_language'
        AND is_grade_range = true
        AND teacher_user_id IS NULL
        AND class_id IS NULL
      `, { transaction });

      await transaction.commit();
      console.log('✅ Hebrew language curriculum rollback completed');
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Hebrew language curriculum rollback failed:', error);
      throw error;
    }
  }
};