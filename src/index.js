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

  // Support both new field names and legacy (first_name/last_name/phone) form
  const firstName = sanitize(data.first_name);
  const lastName = sanitize(data.last_name);
  const combinedName = [firstName, lastName].filter(Boolean).join(" ");
  const name = sanitize(data.name) || combinedName;
  const email = sanitize(data.email);
  const company = sanitize(data.company);
  const phone = sanitize(data.phone);
  const message = sanitize(data.message);

  if (!name || !email || !message) {
    return json({ ok: false, error: "Missing required fields" }, 400);
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ ok: false, error: "Invalid email address" }, 400);
  }

  const subject = `New inquiry from ${name}`;
  const lines = [
    `Name: ${name}`,
    `Email: ${email}`,
  ];
  if (phone) lines.push(`Phone: ${phone}`);
  if (company) lines.push(`Company: ${company}`);
  lines.push("", "Message:", message);
  const text = lines.join("\n");

  const html = `
    <h2>New inquiry from ${escapeHtml(name)}</h2>
    <p><strong>Email:</strong> ${escapeHtml(email)}</p>
    ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ""}
    ${company ? `<p><strong>Company:</strong> ${escapeHtml(company)}</p>` : ""}
    <p><strong>Message:</strong></p>
    <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
  `;

  const resp = await fetch("https://api.resend.com/emails", {
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

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.log("Resend error", resp.status, errText);
    return json({ ok: false, error: "Failed to send message" }, 502);
  }

  return json({ ok: true });
}

function sanitize(v) {
  if (v == null) return "";
  return String(v).trim().slice(0, 5000);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
