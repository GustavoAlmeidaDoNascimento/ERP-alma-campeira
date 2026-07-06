import { NextRequest, NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL, COOKIE_SECURE } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email e senha são obrigatórios" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    const valid = await compare(password, user.passwordHash);

    if (!valid) {
      return NextResponse.json({ error: "Invalid login credentials" }, { status: 401 });
    }

    const token = await createSessionToken({ id: user.id, email: user.email });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      maxAge: SESSION_TTL,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
