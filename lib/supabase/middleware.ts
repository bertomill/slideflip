import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasEnvVars } from "../utils";

/**
 * Middleware function that handles Supabase authentication session management
 * This runs on every request to maintain user authentication state and handle redirects
 */
export async function updateSession(request: NextRequest) {
  // Initialize the response object that will be returned at the end
  // This preserves the original request while allowing cookie modifications
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Early exit if Supabase environment variables are not configured
  // This allows the app to run without authentication during initial setup
  if (!hasEnvVars) {
    return supabaseResponse;
  }

  // Create a new Supabase client for each request to ensure proper session handling
  // This is required for server-side rendering and prevents session conflicts
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read all cookies from the incoming request
        getAll() {
          return request.cookies.getAll();
        },
        // Handle cookie updates by setting them on both request and response
        setAll(cookiesToSet) {
          // Set cookies on the request for immediate use
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          // Create a fresh response object
          supabaseResponse = NextResponse.next({
            request,
          });
          // Set cookies on the response to persist them in the browser
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // CRITICAL: Retrieve user authentication claims immediately after client creation
  // This call is essential for maintaining session state in server-side rendering
  // Any code between createServerClient and getClaims() can cause authentication issues
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  // Redirect unauthenticated users to login page for protected routes
  // Allows access to: home page ("/"), login pages, and all auth-related pages
  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    // Create redirect URL to login page while preserving the original destination
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Return the response with all authentication cookies properly set
  // This ensures the user's session is maintained across requests
  // CRITICAL: Always return the supabaseResponse to preserve authentication state
  return supabaseResponse;
}
