import axios from "axios";
import { moduleLogger } from "../logging/logger";

const log = moduleLogger("email");

/**
 * Sends one email through Resend (https://resend.com). RESEND_API_KEY and MAIL_FROM come from the
 * cloud's environment; MAIL_FROM must be on a domain verified in Resend (Resend's own
 * onboarding@resend.dev only delivers to the Resend account's owner). RESEND_BASE_URL points
 * tests at a mock.
 */
export async function sendEmail(message: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!key || !from) {
    log.error("email not sent: RESEND_API_KEY / MAIL_FROM not set");
    return false;
  }
  try {
    await axios.post(
      `${(process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/+$/, "")}/emails`,
      { from, to: [message.to], subject: message.subject, html: message.html, text: message.text },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 10_000 },
    );
    return true;
  } catch (error: any) {
    log.error({ status: error?.response?.status, err: error?.response?.data?.message ?? error?.message }, "email send failed");
    return false;
  }
}
