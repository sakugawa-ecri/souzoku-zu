// ログアウト。ログイン状態を消して、案内ページへ。
import { SESSION_COOKIE, cookie } from "../lib/session.js";

export async function GET() {
  const headers = new Headers({ Location: "/signed-out.html", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", cookie(SESSION_COOKIE, "", 0));
  return new Response(null, { status: 302, headers });
}
