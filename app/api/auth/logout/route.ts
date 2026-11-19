import { NextResponse } from "next/server";
import { COOKIE, opcoesCookie } from "@/lib/auth";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const r = NextResponse.json({ ok: true });
  r.cookies.set(COOKIE, "", opcoesCookie(req, 0));
  return r;
}
