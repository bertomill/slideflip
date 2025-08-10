import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left side - Sign in form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 md:p-10 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))]/30 to-[hsl(var(--card))]">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
      
      {/* Right side - Creative design assets */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[hsl(var(--charade))] via-[hsl(var(--woodsmoke))] to-black relative overflow-hidden">
        {/* Design assets overlay */}
        <div className="absolute inset-0 opacity-20">
          {/* Magazine covers and design elements */}
          <div className="absolute top-10 left-10 w-32 h-40 rounded-lg shadow-lg transform rotate-6 bg-gradient-to-br from-[hsl(var(--manatee))] to-[hsl(var(--pale-sky))]"></div>
          <div className="absolute top-20 right-20 w-28 h-36 rounded-lg shadow-lg transform -rotate-3 bg-gradient-to-br from-[hsl(var(--old-lavender-light))] to-[hsl(var(--old-lavender))]"></div>
          <div className="absolute top-40 left-20 w-24 h-32 rounded-lg shadow-lg transform rotate-12 bg-gradient-to-br from-[hsl(var(--plantation))] to-[hsl(var(--charade))]"></div>
          <div className="absolute top-60 right-10 w-36 h-44 rounded-lg shadow-lg transform -rotate-6 bg-gradient-to-br from-[hsl(var(--pale-sky))] to-[hsl(var(--manatee))]"></div>
          <div className="absolute bottom-20 left-10 w-30 h-38 rounded-lg shadow-lg transform rotate-3 bg-gradient-to-br from-[hsl(var(--charade))] to-[hsl(var(--baltic-sea))]"></div>
          <div className="absolute bottom-40 right-20 w-26 h-34 rounded-lg shadow-lg transform -rotate-12 bg-gradient-to-br from-[hsl(var(--manatee))] to-[hsl(var(--pale-sky))]"></div>
          
          {/* Presentation slides */}
          <div className="absolute top-32 left-40 w-40 h-24 bg-white rounded-lg shadow-lg transform rotate-2">
            <div className="p-3">
              <div className="h-2 bg-gray-300 rounded mb-2"></div>
              <div className="h-2 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>
          <div className="absolute top-48 right-32 w-36 h-20 bg-white rounded-lg shadow-lg transform -rotate-4">
            <div className="p-3">
              <div className="h-2 bg-gray-300 rounded mb-2"></div>
              <div className="h-2 bg-gray-300 rounded w-2/3"></div>
            </div>
          </div>
          
          {/* Website mockups */}
          <div className="absolute bottom-32 left-32 w-44 h-28 bg-white rounded-lg shadow-lg transform rotate-8">
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="h-2 bg-blue-500 rounded w-8"></div>
                <div className="h-2 bg-gray-300 rounded w-4"></div>
              </div>
              <div className="h-2 bg-gray-300 rounded mb-1"></div>
              <div className="h-2 bg-gray-300 rounded w-3/4"></div>
            </div>
          </div>
        </div>
        
        {/* Floating elements */}
        <div className="absolute top-1/4 left-1/4 w-4 h-4 bg-white rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-6 h-6 bg-white rounded-full opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/3 left-1/3 w-3 h-3 bg-white rounded-full opacity-40 animate-pulse delay-500"></div>
        <div className="absolute bottom-1/4 right-1/4 w-5 h-5 bg-white rounded-full opacity-25 animate-pulse delay-1500"></div>
      </div>
    </div>
  );
}
