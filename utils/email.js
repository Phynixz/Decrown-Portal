// Requires RESEND_API_KEY in your environment (https://resend.com — free
// tier covers this comfortably at your volume). Swap this function's body
// if you'd rather use SendGrid or your own SMTP later; nothing else in
// the platform routes needs to change.
async function sendVerificationEmail(to, businessName, code) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.warn(
      `RESEND_API_KEY not set — verification code for ${to}: ${code}`,
    );
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
      html: `<p>Hi ${businessName ? businessName : "there"},</p>
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

module.exports = { sendVerificationEmail };
