import { NextResponse } from "next/server";
import { authServiceUrl, clearSessionCookie, currentSessionToken } from "../shared";

export async function POST() {
  const token = await currentSessionToken();

  if (token) {
    await fetch(`${authServiceUrl()}/sessions/current`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store"
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookie(response);

  return response;
}
