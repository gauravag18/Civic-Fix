export function isSafeAppOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false;
    if (url.pathname !== "/" && url.pathname !== "") return false;
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_FROM &&
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      isSafeAppOrigin(process.env.APP_ORIGIN),
  );
}

export async function sendAuthEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<"sent" | "not_configured" | "failed"> {
  if (!isEmailConfigured()) return "not_configured";
  try {
    const nodemailer = await import("nodemailer");
    const port = Number(process.env.SMTP_PORT);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
    return "sent";
  } catch {
    console.error("Auth email could not be sent.");
    return "failed";
  }
}

export function verificationMessage(origin: string, rawToken: string): string {
  return `Confirm your CivicFix email: ${origin}/verify-email?token=${encodeURIComponent(rawToken)}`;
}

export function resetMessage(origin: string, rawToken: string): string {
  return `Reset your CivicFix password: ${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
}
