'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { generateId } = await import('../models/baseModel.js');

    // Check if templates already exist before creating them
    const existingParentTemplate = await queryInterface.sequelize.query(
      "SELECT id FROM emailtemplate WHERE trigger_type = 'parent_consent_request' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const existingStudentTemplate = await queryInterface.sequelize.query(
      "SELECT id FROM emailtemplate WHERE trigger_type = 'student_invitation' LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const templates = [];

    // Only create parent consent template if it doesn't exist
    if (existingParentTemplate.length === 0) {
      templates.push({
        id: generateId(),
        trigger_type: 'parent_consent_request',
        name: 'Parent Consent Request - Student Invitation',
        subject: 'בקשת אישור הורה - הרשמת {{student_name}} למערכת הלמידה',
        html_content: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>בקשת אישור הורה</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">בקשת אישור הורה</h1>
    </div>

    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">שלום,</p>

        <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>{{teacher_name}}</strong> הזמינה את <strong>{{student_name}}</strong>
            להצטרף לכיתה שלה במערכת הלמידה <strong>{{site_name}}</strong>.
        </p>

        <p style="font-size: 16px; margin-bottom: 20px;">
            כדי שהתלמיד יוכל להצטרף לכיתה, אנו זקוקים לאישורכם להרשמה ואיסוף מידע במערכת.
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-right: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">פרטי הכיתה:</h3>
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 10px;"><strong>שם הכיתה:</strong> {{classroom_name}}</li>
                <li style="margin-bottom: 10px;"><strong>שכבה:</strong> {{classroom_grade}}</li>
                <li style="margin-bottom: 10px;"><strong>מחזור:</strong> {{classroom_year}}</li>
            </ul>
        </div>

        {{#if personal_message}}
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 25px 0; border-right: 4px solid #ffc107;">
            <h4 style="margin-top: 0; color: #856404;">הודעה אישית מהמורה:</h4>
            <p style="margin: 0; white-space: pre-line;">{{personal_message}}</p>
        </div>
        {{/if}}

        <p style="font-size: 16px; margin: 25px 0;">
            המערכת משמשת למטרות חינוכיות בלבד ומיועדת לעזור לתלמידים להתקדם בלמידה באמצעות
            <strong>משחקים חינוכיים</strong>, <strong>תרגולים</strong> ו<strong>פעילויות אינטראקטיביות</strong>.
        </p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{consent_link}}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;
                      font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                מתן אישור הורה
            </a>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="font-size: 14px; color: #666;">
                אתם מוזמנים לעיין ב<a href="{{privacy_policy_link}}" style="color: #667eea;">מדיניות הפרטיות</a>
                וב<a href="{{terms_of_service_link}}" style="color: #667eea;">תנאי השימוש</a> שלנו לפני מתן האישור.
            </p>
        </div>

        <p style="font-size: 16px; margin-top: 30px;">
            בברכה,<br>
            צוות {{site_name}}
        </p>
    </div>

    <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
        <p>מייל זה נשלח אליכם כי {{teacher_name}} הזמינה את {{student_name}} להצטרף לכיתה במערכת {{site_name}}.</p>
    </div>
</body>
</html>
        `.trim(),
        is_active: true,
        send_to_admins: false,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Only create student invitation template if it doesn't exist
    if (existingStudentTemplate.length === 0) {
      templates.push({
        id: generateId(),
        trigger_type: 'student_invitation',
        name: 'Student Invitation - Direct',
        subject: 'הזמנה להצטרף לכיתת {{classroom_name}} במערכת {{site_name}}',
        html_content: `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>הזמנה להצטרף לכיתה</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">הוזמנת להצטרף לכיתה!</h1>
    </div>

    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px; margin-bottom: 20px;">שלום {{student_name}},</p>

        <p style="font-size: 16px; margin-bottom: 20px;">
            <strong>{{teacher_name}}</strong> הזמינה אותך להצטרף לכיתה שלה במערכת <strong>{{site_name}}</strong>!
        </p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 25px 0; border-right: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">פרטי הכיתה:</h3>
            <ul style="list-style: none; padding: 0;">
                <li style="margin-bottom: 10px;"><strong>שם הכיתה:</strong> {{classroom_name}}</li>
                <li style="margin-bottom: 10px;"><strong>שכבה:</strong> {{classroom_grade}}</li>
                <li style="margin-bottom: 10px;"><strong>מחזור:</strong> {{classroom_year}}</li>
            </ul>
        </div>

        {{#if personal_message}}
        <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; margin: 25px 0; border-right: 4px solid #4caf50;">
            <h4 style="margin-top: 0; color: #2e7d32;">הודעה אישית מהמורה:</h4>
            <p style="margin: 0; white-space: pre-line;">{{personal_message}}</p>
        </div>
        {{/if}}

        <p style="font-size: 16px; margin: 25px 0;">
            בכיתה תוכל ליהנות ממשחקים חינוכיים, תרגולים ופעילויות מעניינות שיעזרו לך ללמוד בצורה כיפית!
        </p>

        <div style="text-align: center; margin: 30px 0;">
            <a href="{{invitation_link}}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px;
                      font-size: 18px; font-weight: bold; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                הצטרף לכיתה
            </a>
        </div>

        <p style="font-size: 16px; margin-top: 30px;">
            בהצלחה ונתראה בכיתה!<br>
            צוות {{site_name}}
        </p>
    </div>

    <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
        <p>מייל זה נשלח אליך כי {{teacher_name}} הזמינה אותך להצטרף לכיתה במערכת {{site_name}}.</p>
    </div>
</body>
</html>
        `.trim(),
        is_active: true,
        send_to_admins: false,
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Insert templates if any need to be created
    if (templates.length > 0) {
      await queryInterface.bulkInsert('emailtemplate', templates);
      console.log(`✅ Created ${templates.length} default email templates`);
    } else {
      console.log('📧 Email templates already exist, skipping creation');
    }
  },

  async down(queryInterface, Sequelize) {
    // Remove the templates created by this migration
    await queryInterface.bulkDelete('emailtemplate', {
      trigger_type: ['parent_consent_request', 'student_invitation']
    });
  }
};