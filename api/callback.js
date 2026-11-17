// Googleのログインから戻ってきたところ。事務所のアカウントか確かめて、ログイン状態を発行する。
import {
  SESSION_COOKIE, STATE_COOKIE, SESSION_HOURS,
  checkIdToken, cookie, createSession, decodeIdToken, readCookie,
} from "../lib/session.js";
import { safePath } from "./login.js";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const saved = readCookie(request, STATE_COOKIE) || "";
  const [savedState, savedTo] = saved.split("|");

  if (url.searchParams.get("error")) return deny("ログインが取り消されました。");
  if (!code || !state || !savedState || state !== savedState) {
    return deny("ログインの手続きが正しくありません。もう一度ページを開き直してください。");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${url.origin}/api/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return deny("Googleでの確認に失敗しました。もう一度お試しください。");
  const { id_token } = await res.json();

  let claims;
  try { claims = decodeIdToken(id_token); } catch { claims = null; }
  const problem = checkIdToken(claims, {
    clientId: process.env.GOOGLE_CLIENT_ID,
    allowedDomain: process.env.ALLOWED_DOMAIN,
  });
  if (problem) return deny(`${problem}。事務所のGoogleアカウントでログインしてください。`);

  const token = await createSession(claims.email.toLowerCase(), process.env.SESSION_SECRET);
  const headers = new Headers({ Location: safePath(savedTo), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, token, SESSION_HOURS * 3600));
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
  return new Response(null, { status: 302, headers });
}

function deny(message) {
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>ログインできません</title>
<style>body{font:15px/1.7 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;color:#222;background:#fff}
a{color:#0b57d0}</style></head><body>
<h1 style="font-size:1.2rem">ログインできません</h1><p>${escapeHtml(message)}</p>
<p><a href="/api/login">もう一度ログインする</a></p></body></html>`;
  const headers = new Headers({ "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(STATE_COOKIE, "", 0));
  return new Response(html, { status: 403, headers });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
