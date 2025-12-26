const nodemailer = require('nodemailer');
require('dotenv').config();

// Create email transporter
const createTransporter = () => {
  // Check if email is configured
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn('⚠️ Email service not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env');
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
};

// Send study group invitation email
const sendStudyGroupInvitation = async (inviteeEmail, groupDetails, inviterName, invitationToken) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('📧 Email service not configured, skipping email to:', inviteeEmail);
      return { success: false, message: 'Email service not configured' };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/study-groups/invitation/${invitationToken}`;
    
    const scheduledTimeFormatted = new Date(groupDetails.scheduledTime).toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: inviteeEmail,
      subject: `📚 You've been invited to join "${groupDetails.title}"`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background: #f9f9f9;
              padding: 30px 20px;
              border-radius: 0 0 10px 10px;
            }
            .group-details {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .group-details h3 {
              margin-top: 0;
              color: #667eea;
            }
            .detail-row {
              margin: 10px 0;
              padding: 10px;
              background: #f5f5f5;
              border-radius: 5px;
            }
            .detail-label {
              font-weight: bold;
              color: #666;
            }
            .button {
              display: inline-block;
              padding: 15px 30px;
              margin: 20px 10px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
            }
            .button:hover {
              background: #5568d3;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #ddd;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📚 Study Group Invitation</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            <p><strong>${inviterName}</strong> has invited you to join their study group.</p>
            
            <div class="group-details">
              <h3>${groupDetails.title}</h3>
              ${groupDetails.description ? `<p>${groupDetails.description}</p>` : ''}
              
              <div class="detail-row">
                <span class="detail-label">📅 Scheduled Time:</span><br>
                ${scheduledTimeFormatted}
              </div>
              
              ${groupDetails.meetLink ? `
              <div class="detail-row">
                <span class="detail-label">🔗 Meeting Link:</span><br>
                <a href="${groupDetails.meetLink}">${groupDetails.meetLink}</a>
              </div>
              ` : ''}
            </div>

            <div style="text-align: center;">
              <a href="${acceptUrl}" class="button">Accept Invitation</a>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you're not interested, you can safely ignore this email.
            </p>
          </div>
          <div class="footer">
            <p>This invitation was sent by ${inviterName}</p>
            <p>If you have any questions, please contact the group organizer.</p>
          </div>
        </body>
        </html>
      `,
      text: `
Study Group Invitation

${inviterName} has invited you to join "${groupDetails.title}"

${groupDetails.description || ''}

Scheduled Time: ${scheduledTimeFormatted}
${groupDetails.meetLink ? `Meeting Link: ${groupDetails.meetLink}` : ''}

Accept invitation: ${acceptUrl}

If you're not interested, you can safely ignore this email.
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Invitation email sent successfully:', {
      to: inviteeEmail,
      messageId: info.messageId,
      groupTitle: groupDetails.title
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Failed to send invitation email:', {
      error: error.message,
      to: inviteeEmail,
      groupTitle: groupDetails.title
    });
    return { success: false, message: error.message };
  }
};

// Send invitation reminder email
const sendInvitationReminder = async (inviteeEmail, groupDetails, inviterName, invitationToken) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('📧 Email service not configured, skipping reminder email');
      return { success: false, message: 'Email service not configured' };
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const acceptUrl = `${frontendUrl}/study-groups/invitation/${invitationToken}`;

    const mailOptions = {
      from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER,
      to: inviteeEmail,
      subject: `⏰ Reminder: Study Group Invitation - "${groupDetails.title}"`,
      html: `
        <h2>Reminder: Study Group Invitation</h2>
        <p>This is a friendly reminder that ${inviterName} invited you to join "${groupDetails.title}".</p>
        <p><a href="${acceptUrl}">Accept Invitation</a></p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Reminder email sent to:', inviteeEmail);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to send reminder email:', error);
    return { success: false, message: error.message };
  }
};

module.exports = {
  sendStudyGroupInvitation,
  sendInvitationReminder
};
