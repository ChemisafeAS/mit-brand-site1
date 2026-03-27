import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/supabase/config";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });
  const isEmployeeArea =
    request.nextUrl.pathname === "/medarbejder" ||
    request.nextUrl.pathname.startsWith("/medarbejder/") ||
    request.nextUrl.pathname === "/kontakter" ||
    request.nextUrl.pathname.startsWith("/kontakter/");

  if (!isSupabaseConfigured()) {
    if (isEmployeeArea) {
      const loginUrl = request.nextUrl.clone();

      loginUrl.pathname = "/medarbejder-login";
      loginUrl.searchParams.set("error", "config");
      loginUrl.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  const { publishableKey, url } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isEmployeeArea && !user) {
    const loginUrl = request.nextUrl.clone();

    loginUrl.pathname = "/medarbejder-login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname === "/medarbejder-login" && user) {
    const dashboardUrl = request.nextUrl.clone();

    dashboardUrl.pathname = "/medarbejder";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/medarbejder/:path*", "/medarbejder-login", "/kontakter/:path*"],
};
