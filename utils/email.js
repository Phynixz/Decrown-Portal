// Requires RESEND_API_KEY in your environment (https://resend.com — free
// tier covers this comfortably at your volume). Swap this function's body
// if you'd rather use SendGrid or your own SMTP later; nothing else in
// the platform routes needs to change.
async function sendVerificationEmail(to, businessName, code) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email delivery is not configured");
    }
    console.warn(`Verification email to ${to} skipped outside production`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.PLATFORM_EMAIL_FROM || "onboarding@yourplatform.com",
      to,
      subject: "Verify your account",
      html: `<p>Hi ${escapeHtml(businessName || "there")},</p>
             <p>Your verification code is:</p>
             <p style="font-size:22px;font-weight:bold;letter-spacing:2px;">${code}</p>
             <p>This code expires in 15 minutes.</p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to send verification email: ${res.status} ${body}`);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

module.exports = { sendVerificationEmail };
