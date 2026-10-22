import crypto from "crypto";
import bcryptjs from "bcryptjs";
import usermodel from "./models/User";
import PasswordReset from "./models/PasswordReset";
import RefreshToken from "./models/RefreshToken";
import { cutOffTokens } from "./tokenCutoff";
import AppError from "../../shared/errors/AppError";
import { sendEmail } from "../../shared/email/resend";
import { moduleLogger } from "../../shared/logging/logger";

const log = moduleLogger("password-reset");
const LINK_MINUTES = 30;

const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Where reset links point: this cloud's own public address (Render sets RENDER_EXTERNAL_URL). */
const publicUrl = () => (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");

/**
 * "Forgot password": emails a reset link to the account with this email or username. Always
 * answers the same way, so it can't be used to find out who has an account.
 */
export async function requestPasswordReset(identifier: string): Promise<void> {
  const value = String(identifier ?? "").trim().toLowerCase();
  if (!value) throw new AppError("Enter your email address or username.", 400);
  const user: any = await usermodel.findOne(value.includes("@") ? { email: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") } : { username: value }).lean();
  if (!user?.email) {
    log.info("password reset requested for an unknown account or one without email");
    return;
  }
  // One live link at a time.
  await PasswordReset.deleteMany({ userId: user._id, usedAt: null });
  const token = crypto.randomBytes(32).toString("base64url");
  await PasswordReset.create({ userId: user._id, tokenHash: hash(token), expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000) });

  const link = `${publicUrl()}/auth/reset-password?token=${encodeURIComponent(token)}`;
  const name = escapeHtml(user.username);
  await sendEmail({
    to: user.email,
    subject: "Reset your RoninArc password",
    text: `Hi ${user.username},\n\nSomeone (hopefully you) asked to reset the password for your RoninArc account.\n\nSet a new password here (the link works for ${LINK_MINUTES} minutes, once):\n${link}\n\nIf you didn't ask for this, ignore this email; your password stays the same.`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:auto;color:#1a202c">
<h2 style="margin:0 0 16px">Reset your RoninArc password</h2>
<p>Hi ${name},</p>
<p>Someone (hopefully you) asked to reset the password for your RoninArc account.</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="background:#6B46C1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Set a new password</a></p>
<p style="color:#4a5568;font-size:14px">The link works for ${LINK_MINUTES} minutes, once. If you didn't ask for this, ignore this email; your password stays the same.</p>
</div>`,
  });
}

/** Sets the new password from a reset link and signs every device out. */
export async function resetPassword(token: string, password: string): Promise<void> {
  const plain = String(password ?? "").trim();
  if (plain.length < 6) throw new AppError("Use at least 6 characters.", 400);
  const reset: any = await PasswordReset.findOne({ tokenHash: hash(String(token ?? "")), usedAt: null });
  if (!reset || reset.expiresAt < new Date()) throw new AppError("This reset link has expired or was already used. Ask for a new one.", 400);
  const user = await usermodel.findById(reset.userId);
  if (!user) throw new AppError("This reset link has expired or was already used. Ask for a new one.", 400);
  user.passwordHash = await bcryptjs.hash(plain, 11);
  await user.save();
  reset.usedAt = new Date();
  await reset.save();
  await RefreshToken.deleteMany({ userId: user._id });
  await cutOffTokens(String(user._id));
}

/** The page a reset link opens: a small form, no app needed. */
export function resetPage(token: string): string {
  const t = JSON.stringify(String(token ?? ""));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset password · RoninArc</title>
<style>
:root{color-scheme:light dark;--bg:#f7fafc;--card:#fff;--text:#1a202c;--muted:#4a5568;--border:#e2e8f0;--accent:#6B46C1;--danger:#c53030;--ok:#2f855a}
@media (prefers-color-scheme:dark){:root{--bg:#171923;--card:#1a202c;--text:#f7fafc;--muted:#a0aec0;--border:#2d3748;--accent:#9F7AEA;--danger:#fc8181;--ok:#68d391}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
main{width:100%;max-width:380px;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px}
h1{font-size:22px;margin:0 0 6px}p{color:var(--muted);margin:0 0 20px;line-height:1.5}
label{display:block;font-size:14px;font-weight:600;margin:14px 0 6px}
input{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text);font-size:16px}
button{width:100%;margin-top:20px;padding:12px;border:0;border-radius:8px;background:var(--accent);color:#fff;font-weight:600;font-size:16px;cursor:pointer}
button:disabled{opacity:.6;cursor:default}.msg{margin-top:14px;font-size:14px}.err{color:var(--danger)}.ok{color:var(--ok)}
</style></head>
<body><main>
<h1>Set a new password</h1>
<p>For your RoninArc account. Afterwards, sign in with it on your phone and PC.</p>
<form id="f">
<label for="p1">New password</label><input id="p1" type="password" autocomplete="new-password" minlength="6" required>
<label for="p2">Repeat it</label><input id="p2" type="password" autocomplete="new-password" minlength="6" required>
<button id="b" type="submit">Save new password</button>
<div id="m" class="msg" role="status" aria-live="polite"></div>
</form>
</main>
<script>
const token=${t};const f=document.getElementById("f"),m=document.getElementById("m"),b=document.getElementById("b");
f.addEventListener("submit",async(e)=>{e.preventDefault();const p1=document.getElementById("p1").value,p2=document.getElementById("p2").value;
if(p1!==p2){m.className="msg err";m.textContent="The two passwords don't match.";return}
b.disabled=true;m.className="msg";m.textContent="Saving...";
try{const r=await fetch("/auth/reset-password",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token,password:p1})});const d=await r.json().catch(()=>({}));
if(r.ok){f.innerHTML='<p class="ok">Your password is changed. Sign in to RoninArc with it.</p>'}else{m.className="msg err";m.textContent=d.error||"Couldn't save the new password.";b.disabled=false}}
catch{m.className="msg err";m.textContent="Couldn't reach RoninArc. Check your connection and try again.";b.disabled=false}});
</script></body></html>`;
}
