import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  return NextResponse.redirect(`${origin}${next.startsWith("/") ? next : "/login"}`);
}
