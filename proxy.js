// すべてのページの手前で動く門番。
// 事務所のGoogleアカウントでログインしていない人は、ページを見る前にGoogleのログインへ送る。
import { next } from "@vercel/functions";
import { SESSION_COOKIE, readCookie, verifySession } from "./lib/session.js";

// ログインの入口・戻り口・ログアウトは、門番の対象外（ここを通らないとログインできないため）
const OPEN_PATHS = new Set(["/api/login", "/api/callback", "/api/logout", "/signed-out.html", "/favicon.ico"]);

export default async function proxy(request) {
  const url = new URL(request.url);
  if (OPEN_PATHS.has(url.pathname)) return next();

  const email = await verifySession(
    readCookie(request, SESSION_COOKIE),
    process.env.SESSION_SECRET,
    process.env.ALLOWED_DOMAIN
  );
  if (email) return next();

  const login = new URL("/api/login", url.origin);
  if (url.pathname !== "/") login.searchParams.set("to", url.pathname);
  return new Response(null, {
    status: 302,
    headers: { Location: login.toString(), "Cache-Control": "no-store" },
  });
}
