// ログイン状態（セッション）の発行と確認。
// 中身は「メールアドレス」と「有効期限」だけで、戸籍のデータは一切含まない。
// 署名（HMAC-SHA256）を付けるので、利用者が書き換えると無効になる。

export const SESSION_COOKIE = "souzoku_session";
export const STATE_COOKIE = "souzoku_oauth_state";
export const SESSION_HOURS = 8; // ログインが続く時間（1営業日）

const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBytes(str) {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "=".repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET が未設定か短すぎます（32文字以上にしてください）");
  }
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]
  );
}

export async function createSession(email, secret, now = Date.now()) {
  const payload = { e: email, x: Math.floor(now / 1000) + SESSION_HOURS * 3600 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

// 正しい署名で、期限内で、許可したドメインのアドレスなら、そのアドレスを返す。違えば null。
export async function verifySession(token, secret, allowedDomain, now = Date.now()) {
  try {
    if (!token || typeof token !== "string") return null;
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, b64urlToBytes(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    if (typeof p.x !== "number" || p.x * 1000 < now) return null;
    if (!isAllowedEmail(p.e, allowedDomain)) return null;
    return p.e;
  } catch {
    return null;
  }
}

export function isAllowedEmail(email, allowedDomain) {
  if (!email || !allowedDomain) return false;
  return String(email).toLowerCase().endsWith("@" + String(allowedDomain).toLowerCase());
}

export function randomToken(bytes = 32) {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function readCookie(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

// Googleのトークン窓口から直接（HTTPSで）受け取ったIDトークンの中身を読む。
// 直接受け取ったものは署名の再検証を省略してよい、とGoogleの手順に書かれている。
export function decodeIdToken(idToken) {
  const part = String(idToken).split(".")[1];
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

// IDトークンが「このアプリ宛て」「Google発行」「期限内」「事務所のアカウント」かを確認する。
export function checkIdToken(claims, { clientId, allowedDomain, now = Date.now() }) {
  if (!claims) return "IDトークンがありません";
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) return "このアプリ宛てのログインではありません";
  if (!["accounts.google.com", "https://accounts.google.com"].includes(claims.iss)) return "Google以外が発行したログイン情報です";
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return "ログイン情報の期限が切れています";
  if (claims.email_verified !== true && claims.email_verified !== "true") return "メールアドレスが確認されていません";
  if (String(claims.hd || "").toLowerCase() !== String(allowedDomain).toLowerCase()) return "事務所のGoogleアカウントではありません";
  if (!isAllowedEmail(claims.email, allowedDomain)) return "事務所のGoogleアカウントではありません";
  return null;
}
