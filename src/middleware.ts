import { NextResponse, type NextRequest } from "next/server";

const MES_URL = process.env.MES_URL ?? "http://localhost:8000";
const MES_PUBLIC_URL = process.env.MES_PUBLIC_URL ?? "https://localhost:13000";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/denied") return NextResponse.next();
  const token = request.cookies.get("mes_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", MES_PUBLIC_URL));
  }
  const me = await fetch(`${MES_URL}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!me.ok) {
    return NextResponse.redirect(new URL("/login", MES_PUBLIC_URL));
  }
  const user = (await me.json()) as { role?: string };
  if (user.role !== "ADMIN") {
    return NextResponse.rewrite(new URL("/denied", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
