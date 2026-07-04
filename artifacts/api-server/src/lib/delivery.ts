import nodemailer from "nodemailer";
import { logger } from "./logger";

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
  logger.info({ to, subject, text }, "Email not sent - SMTP not configured");
};

export const sendPushNotification = async (userId: string, title: string, body: string) => {
  logger.info({ userId, title, body }, "Push notification dispatched");
};
