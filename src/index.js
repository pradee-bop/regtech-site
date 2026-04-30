// Cloudflare Worker entry: handles POST /api/contact via Resend,
// falls through to static assets for everything else.

const TO_ADDRESS = "contact@regtechservices.team";
const FROM_ADDRESS = "RegTech Services <noreply@regtechservices.team>";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact" && request.method === "POST") {
      return handleContact(request, env);
    }

    // Everything else -> static assets
    return env.ASSETS.fetch(request);
  },
};

async function handleContact(request, env) {
  if (!env.RESEND_API_KEY) {
    return json({ ok: false, error: "Email service not configured" }, 503);
  }

  let data;
  try {
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      data = await request.json();
    } else {
      const form = await request.formData();
      data = Object.fromEntries(form);
    }
  } catch {
    return json({ ok: false, error: "Invalid request body" }, 400);
  }

  // Honeypot: silently accept bot submissions
  if (data.website && String(data.website).trim() !== "") {
    return json({ ok: true });
  }

  const name = sanitize(data.name);
  const email = sanitize(data.email);
  const company = sanitize(data.company);
  const message = sanitize(data.message);

  if (!name || !email || !message) {
    return json({ ok: false, error: "Name, email, and message are required" }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email address" }, 400);
  }

  const subject = `New inquiry from ${name}${company ? " (" + company + ")" : ""}`;
  const text =
`New contact form submission

Name:    ${name}
Email:   ${email}
Company: ${company || "(not provided)"}

Message:
${message}
`;

  const html = `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
  <h2 style="margin:0 0 12px">New contact form submission</h2>
  <table cellpadding="6" style="border-collapse:collapse">
    <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
    <tr><td><strong>Email</strong></td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
    <tr><td><strong>Company</strong></td><td>${escapeHtml(company) || "<em>(not provided)</em>"}</td></tr>
  </table>
  <h3 style="margin:18px 0 6px">Message</h3>
  <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [TO_ADDRESS],
      reply_to: email,
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("Resend error", res.status, detail);
    return json({ ok: false, error: "Failed to send message" }, 502);
  }

  return json({ ok: true });
}

function sanitize(v) {
  return (typeof v === "string" ? v : "").trim().slice(0, 5000);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
