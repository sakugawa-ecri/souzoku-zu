// Googleのログイン画面へ送る。
import { STATE_COOKIE, cookie, randomToken } from "../lib/session.js";

export async function GET(request) {
  const url = new URL(request.url);
  const state = randomToken();
  const to = safePath(url.searchParams.get("to"));

  const google = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  google.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  google.searchParams.set("redirect_uri", `${url.origin}/api/callback`);
  google.searchParams.set("response_type", "code");
  google.searchParams.set("scope", "openid email"); // メールアドレスだけ。Drive等の権限は取らない
  google.searchParams.set("hd", process.env.ALLOWED_DOMAIN); // 事務所のアカウントを選ばせる
  google.searchParams.set("prompt", "select_account");
  google.searchParams.set("state", state);

  const headers = new Headers({ Location: google.toString(), "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(STATE_COOKIE, `${state}|${to}`, 600));
  return new Response(null, { status: 302, headers });
}

// 戻り先は、このサイトの中のパスだけに限る（外部サイトへ飛ばされないように）
export function safePath(p) {
  if (!p || typeof p !== "string") return "/";
  if (!p.startsWith("/") || p.startsWith("//") || p.includes("\\")) return "/";
  return p;
}
