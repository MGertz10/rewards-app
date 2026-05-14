import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { passcode } = await request.json();
  const expected = (process.env.APP_PASSCODE ?? "1234").trim();

  if (passcode !== expected) {
    return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("rewards_session", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
  return response;
}
