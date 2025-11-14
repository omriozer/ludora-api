import models from '../models/index.js';
import { generateId } from '../models/baseModel.js';
import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.models = models;
    this.transporter = null;
    this.initializeTransporter();
  }

  // Initialize email transporter
  initializeTransporter() {
    try {
      // Configure based on environment variables
      const emailConfig = {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: process.env.EMAIL_PORT || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      };

      this.transporter = nodemailer.createTransport(emailConfig);
    } catch (error) {
      // Email transporter initialization failed
    }
  }

  // Send email
  async sendEmail({ to, subject, html, text, from, templateId = null, relatedEntityId = null }) {
    try {
      const emailData = {
        from: from || process.env.DEFAULT_FROM_EMAIL || 'noreply@ludora.app',
        to,
        subject,
        html: html || text,
        text: text || html?.replace(/<[^>]*>/g, '') // Strip HTML for text version
      };

      // Send email if transporter is available
      let result = null;
      if (this.transporter) {
        result = await this.transporter.sendMail(emailData);
      } else {
        result = { messageId: `mock_${Date.now()}` };
      }

      // Log email
      await this.models.EmailLog.create({
        id: generateId(),
        template_id: templateId,
        recipient_email: to,
        subject,
        content: html || text,
        status: 'sent',
        related_purchase_id: relatedEntityId,
        created_at: new Date(),
        updated_at: new Date()
      });

      return {
        success: true,
        data: {
          messageId: result.messageId,
          to,
          subject,
          from: emailData.from,
          status: 'sent',
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      
      // Log failed email
      await this.models.EmailLog.create({
        id: generateId(),
        template_id: templateId,
        recipient_email: to,
        subject,
        content: html || text,
        status: 'failed',
        error_message: error.message,
        created_at: new Date(),
        updated_at: new Date()
      });

      throw error;
    }
  }

  // Process email triggers
  async processEmailTriggers({ triggers }) {
    try {
      const results = [];

      for (const trigger of triggers) {
        try {
          // Find email template
          const template = await this.models.EmailTemplate.findOne({
            where: { trigger_type: trigger.type, is_active: true }
          });

          if (template) {
            // Process template variables
            const processedContent = this.processEmailTemplate(template.html_content, trigger.data);
            const processedSubject = this.processEmailTemplate(template.subject, trigger.data);

            // Send email
            const emailResult = await this.sendEmail({
              to: trigger.recipient,
              subject: processedSubject,
              html: processedContent,
              templateId: template.id,
              relatedEntityId: trigger.entityId
            });

            results.push({
              trigger: trigger.type,
              recipient: trigger.recipient,
              status: 'sent',
              messageId: emailResult.data.messageId
            });
          } else {
            results.push({
              trigger: trigger.type,
              recipient: trigger.recipient,
              status: 'no_template',
              error: 'No active template found'
            });
          }
        } catch (error) {
          results.push({
            trigger: trigger.type,
            recipient: trigger.recipient,
            status: 'failed',
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: 'Email triggers processed',
        data: { processed: results.length, results }
      };
    } catch (error) {
      throw error;
    }
  }

  // Process email template variables
  processEmailTemplate(template, data) {
    if (!template || !data) return template;

    let processed = template;
    
    // Replace template variables like {{variable_name}}
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = data[key] || '';
      processed = processed.replace(new RegExp(placeholder, 'g'), value);
    });

    return processed;
  }

  // Send registration email
  async sendRegistrationEmail({ email, registrationData }) {
    try {
      const template = await this.models.EmailTemplate.findOne({
        where: { trigger_type: 'registration_confirmation', is_active: true }
      });

      if (!template) {
        // Send default registration email
        return await this.sendEmail({
          to: email,
          subject: 'Registration Confirmation',
          html: `
            <h2>Welcome to Ludora!</h2>
            <p>Thank you for registering. Your account has been created successfully.</p>
            <p>Best regards,<br>The Ludora Team</p>
          `,
          relatedEntityId: registrationData?.id
        });
      }

      // Use template
      const processedContent = this.processEmailTemplate(template.html_content, registrationData);
      const processedSubject = this.processEmailTemplate(template.subject, registrationData);

      return await this.sendEmail({
        to: email,
        subject: processedSubject,
        html: processedContent,
        templateId: template.id,
        relatedEntityId: registrationData?.id
      });
    } catch (error) {
      throw error;
    }
  }

  // Send invitation emails
  async sendInvitationEmails({ emails, invitationData }) {
    try {
      const results = [];

      for (const email of emails) {
        try {
          const result = await this.sendEmail({
            to: email,
            subject: invitationData.subject || 'You are invited!',
            html: invitationData.content || `
              <h2>You're Invited!</h2>
              <p>${invitationData.message || 'You have been invited to join Ludora.'}</p>
              ${invitationData.inviteUrl ? `<p><a href="${invitationData.inviteUrl}">Accept Invitation</a></p>` : ''}
              <p>Best regards,<br>The Ludora Team</p>
            `,
            relatedEntityId: invitationData.id
          });

          results.push({
            email,
            status: 'sent',
            messageId: result.data.messageId
          });
        } catch (error) {
          results.push({
            email,
            status: 'failed',
            error: error.message
          });
        }
      }

      return {
        success: true,
        message: 'Invitation emails processed',
        data: { sent: results.filter(r => r.status === 'sent').length, results }
      };
    } catch (error) {
      throw error;
    }
  }

  // Initialize system email templates
  async initializeSystemEmailTemplates() {
    try {
      const systemTemplates = [
        {
          id: generateId(),
          name: 'Registration Confirmation',
          subject: 'Welcome to {{site_name}}!',
          html_content: `
            <h2>Welcome to {{site_name}}!</h2>
            <p>Hi {{user_name}},</p>
            <p>Thank you for registering. Your account has been created successfully.</p>
            <p>You can now access all available features and content.</p>
            <p>Best regards,<br>The {{site_name}} Team</p>
          `,
          trigger_type: 'registration_confirmation',
          is_active: true,
        },
        {
          id: generateId(),
          name: 'Payment Confirmation',
          subject: 'Payment Confirmation - Transaction #{{transaction_uid}}',
          html_content: `
            <h2>Payment Confirmed</h2>
            <p>Hi {{buyer_name}},</p>
            <p>Your payment of ${{amount}} has been successfully processed.</p>
            <p>Order Details:</p>
            <ul>
              <li>Transaction ID: {{transaction_uid}}</li>
              <li>Product: {{product_title}}</li>
              <li>Amount: ${{amount}}</li>
            </ul>
            <p>Thank you for your purchase!</p>
          `,
          trigger_type: 'payment_confirmation',
          is_active: true
        },
        {
          id: generateId(),
          name: 'Student Invitation',
          subject: 'Invitation to join {{classroom_name}}',
          html_content: `
            <h2>You're Invited to Join a Classroom!</h2>
            <p>Hi {{student_name}},</p>
            <p>{{teacher_name}} has invited you to join the classroom "{{classroom_name}}".</p>
            <p><a href="{{invitation_url}}">Accept Invitation</a></p>
            <p>This invitation will expire on {{expiry_date}}.</p>
          `,
          trigger_type: 'student_invitation',
          is_active: true
        }
      ];

      const createdTemplates = [];
      for (const template of systemTemplates) {
        // Check if template already exists
        const existing = await this.models.EmailTemplate.findOne({
          where: { trigger_type: template.trigger_type }
        });

        if (!existing) {
          const created = await this.models.EmailTemplate.create({
            ...template,
            created_at: new Date(),
            updated_at: new Date()
          });
          createdTemplates.push(created);
        }
      }

      return {
        success: true,
        message: 'System email templates initialized',
        data: { 
          initialized: createdTemplates.length,
          total: systemTemplates.length
        }
      };
    } catch (error) {
      throw error;
    }
  }
}

export default new EmailService();