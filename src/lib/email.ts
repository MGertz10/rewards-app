// Email delivery via Resend.
// Sends a daily alert digest to ALERT_EMAIL_TO.

import { Resend } from "resend";
import type { Alert } from "./alerts";

// Lazy init — prevents build-time module evaluation failure when env var not set
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

const SEVERITY_COLOR: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#22C55E",
  info:   "#117ACA",
};

const SEVERITY_LABEL: Record<string, string> = {
  high:   "🔴 Urgent",
  medium: "🟡 Soon",
  low:    "🟢 Heads up",
  info:   "ℹ️ Info",
};

function alertRow(alert: Alert): string {
  const color = SEVERITY_COLOR[alert.severity] ?? "#117ACA";
  const label = SEVERITY_LABEL[alert.severity] ?? "Info";
  return `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="display:inline-block;background:${color}22;color:${color};font-size:11px;font-weight:600;padding:2px 8px;border-radius:99px;margin-bottom:4px;">${label}</span>
        <p style="margin:4px 0 2px;font-size:14px;font-weight:600;color:#1a1a2e;">${alert.title}</p>
        ${alert.body ? `<p style="margin:0;font-size:13px;color:#666;">${alert.body}</p>` : ""}
      </td>
    </tr>`;
}

function buildHtml(alerts: Alert[], date: string): string {
  const high   = alerts.filter((a) => a.severity === "high");
  const medium = alerts.filter((a) => a.severity === "medium");
  const low    = alerts.filter((a) => a.severity === "low" || a.severity === "info");

  const section = (title: string, items: Alert[]) =>
    items.length === 0
      ? ""
      : `<h3 style="margin:20px 0 8px;font-size:13px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.05em;">${title}</h3>
         <table width="100%" cellpadding="0" cellspacing="0">${items.map(alertRow).join("")}</table>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#117ACA;padding:20px 24px;">
      <p style="margin:0;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Rewards App</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">Daily Alert Digest</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.75);font-size:13px;">${date}</p>
    </div>
    <div style="padding:20px 24px;">
      ${alerts.length === 0
        ? `<p style="color:#666;font-size:14px;text-align:center;padding:24px 0;">✅ No alerts today — all clear!</p>`
        : section("Urgent", high) + section("Coming Up", medium) + section("Low Priority", low)
      }
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;text-align:center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://rewards-app-tan.vercel.app"}/strategy"
           style="display:inline-block;background:#117ACA;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 20px;border-radius:10px;">
          Open Rewards App →
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendAlertDigest(alerts: Alert[]): Promise<void> {
  const to = process.env.ALERT_EMAIL_TO;
  if (!to) throw new Error("ALERT_EMAIL_TO not set");

  const date = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const urgentCount = alerts.filter((a) => a.severity === "high").length;
  const subject =
    urgentCount > 0
      ? `🔴 ${urgentCount} urgent alert${urgentCount > 1 ? "s" : ""} — Rewards App`
      : alerts.length > 0
      ? `📋 ${alerts.length} alert${alerts.length > 1 ? "s" : ""} — Rewards App`
      : "✅ All clear — Rewards App digest";

  await getResend().emails.send({
    from: "Rewards App <onboarding@resend.dev>",
    to,
    subject,
    html: buildHtml(alerts, date),
  });
}
