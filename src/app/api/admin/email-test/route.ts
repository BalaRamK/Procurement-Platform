import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500).default("Test email from Procurement Platform"),
  body: z.string().min(1).default("This is a test email to verify your email configuration is working correctly."),
});

async function getSmtpConfig() {
  const rows = await query<{ key: string; value: string | null }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [["smtp_host", "smtp_port", "smtp_from", "smtp_user", "smtp_pass"]]
  );
  const db: Record<string, string> = {};
  for (const row of rows) if (row.value) db[row.key] = row.value;

  return {
    host: db["smtp_host"] || process.env.SENDGRID_SMTP_HOST || "",
    port: db["smtp_port"] || process.env.SENDGRID_SMTP_PORT || "",
    from: db["smtp_from"] || process.env.SENDGRID_MAIL || "",
    user: db["smtp_user"] || process.env.SENDGRID_API_KEY_ID || process.env.SENDGRID_MAIL || "",
    pass: db["smtp_pass"] || process.env.SENDGRID_API_KEY_SECRET || "",
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }

  const { to, subject, body: emailBody } = parsed.data;
  const cfg = await getSmtpConfig();

  if (!cfg.host || !cfg.port || !cfg.from || !cfg.user || !cfg.pass) {
    return NextResponse.json(
      { error: "Email not configured. Set SMTP settings in the Email Settings section above." },
      { status: 400 }
    );
  }

  try {
    const numPort = parseInt(cfg.port, 10) || 587;
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: cfg.host,
      port: numPort,
      secure: numPort === 465,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    await transporter.sendMail({
      from: cfg.from,
      to,
      subject,
      text: emailBody,
      html: emailBody.replace(/\n/g, "<br>"),
    });
    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to send email: ${message}` }, { status: 500 });
  }
}
