import { env } from "cloudflare:workers";

const RESEND_EMAIL_URL = "https://api.resend.com/emails";

function required(name: "RESEND_API_KEY" | "EMAIL_FROM") {
  const value = Reflect.get(env, name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required for self-hosted invitation email`);
  }
  return value.trim();
}

export async function sendSelfHostedInvitationEmail(input: {
  email: string;
  inviteUrl: string;
  organizationName: string;
  inviterName: string;
}) {
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("EMAIL_FROM"),
      to: [input.email],
      subject: `Invitation to ${input.organizationName} on OpenSEO`,
      html: `<p>${escapeHtml(input.inviterName)} invited you to join <strong>${escapeHtml(input.organizationName)}</strong> on OpenSEO.</p><p><a href="${escapeHtml(input.inviteUrl)}">Accept invitation</a></p><p>This invitation expires in 72 hours.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(
      `Resend invitation failed (${response.status}): ${responseText.slice(0, 300)}`,
    );
  }
}

export async function sendSelfHostedPasswordResetEmail(input: {
  email: string;
  resetUrl: string;
}) {
  const response = await fetch(RESEND_EMAIL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: required("EMAIL_FROM"),
      to: [input.email],
      subject: "Reset your OpenSEO password",
      html: `<p>A password reset was requested for your OpenSEO account.</p><p><a href="${escapeHtml(input.resetUrl)}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Resend password reset failed (${response.status})`);
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
