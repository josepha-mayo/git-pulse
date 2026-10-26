import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/explore", "/post", "/login", "/signup", "/auth/error", "/signout"];

function hasSessionCookie(req: NextRequest) {
  return Boolean(
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token")
  );
}

export default function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname.includes("\0") || pathname.length > 2000) {
    return new NextResponse("Invalid URI", { status: 400 });
  }

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname === route || (route !== "/" && pathname.startsWith(route + "/"))
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (!hasSessionCookie(req)) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.jpg$|.*\\.png$|.*\\.svg$|.*\\.webp$|.*\\.gif$|.*\\.ico$|manifest\\.json).*)",
  ],
};
