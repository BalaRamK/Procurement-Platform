import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(500).default("Test email from Procurement Platform"),
  body: z.string().min(1).default("This is a test email to verify your email configuration is working correctly."),
});

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

  const host = process.env.SENDGRID_SMTP_HOST;
  const port = process.env.SENDGRID_SMTP_PORT;
  const from = process.env.SENDGRID_MAIL;
  const user = process.env.SENDGRID_API_KEY_ID ?? process.env.SENDGRID_MAIL;
  const pass = process.env.SENDGRID_API_KEY_SECRET;

  if (!host || !port || !from || !user || !pass) {
    return NextResponse.json(
      { error: "Email not configured. Set SENDGRID_SMTP_HOST, SENDGRID_SMTP_PORT, SENDGRID_MAIL, SENDGRID_API_KEY_ID, and SENDGRID_API_KEY_SECRET environment variables." },
      { status: 400 }
    );
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host,
      port: parseInt(port, 10) || 587,
      secure: false,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from,
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
