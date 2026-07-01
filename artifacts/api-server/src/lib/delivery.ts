import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  transporter = nodemailer.createTransport({
    host,
    port: port ?? 587,
    secure: port === 465,
    auth: { user, pass },
  });
  return transporter;
}

export const sendEmail = async (to: string, subject: string, text: string) => {
  const mailer = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@o2o.local";
  if (mailer) {
    await mailer.sendMail({ from, to, subject, text });
    return;
  }
  console.log(`[EMAIL - SMTP not configured] To: ${to}`);
  console.log(`[EMAIL SUBJECT] ${subject}`);
  console.log(`[EMAIL BODY] ${text}`);
  console.log(`--------------------------------------------------`);
};

export const sendPushNotification = async (userId: string, title: string, body: string) => {
  console.log(`[PUSH DISPATCHED] To User: ${userId}`);
  console.log(`[PUSH TITLE] ${title}`);
  console.log(`[PUSH BODY] ${body}`);
  console.log(`--------------------------------------------------`);
};
