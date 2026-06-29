export const sendEmail = async (to: string, subject: string, text: string) => {
  // In a real production app, use nodemailer with AWS SES, SendGrid, etc.
  // For this local production-ready state, we log it to stdout.
  console.log(`[EMAIL DISPATCHED] To: ${to}`);
  console.log(`[EMAIL SUBJECT] ${subject}`);
  console.log(`[EMAIL BODY] ${text}`);
  console.log(`--------------------------------------------------`);
};

export const sendPushNotification = async (userId: string, title: string, body: string) => {
  // Real implementation would use Expo Push Notifications or FCM.
  console.log(`[PUSH DISPATCHED] To User: ${userId}`);
  console.log(`[PUSH TITLE] ${title}`);
  console.log(`[PUSH BODY] ${body}`);
  console.log(`--------------------------------------------------`);
};
