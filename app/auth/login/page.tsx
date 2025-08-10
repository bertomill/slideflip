import { LoginForm } from "@/components/login-form";
import Image from "next/image";

export default function Page() {
  return (
    <div className="flex min-h-screen w-full">
      {/* Left side - Sign in form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 md:p-10 bg-gradient-to-br from-[hsl(var(--background))] via-[hsl(var(--muted))]/30 to-[hsl(var(--card))]">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>
      
      {/* Right side - Creative slide gallery */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[hsl(var(--charade))] via-[hsl(var(--woodsmoke))] to-black relative overflow-hidden">
        {/* subtle vignette */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_60%)]" />

        {/* slide A */}
        <div className="absolute top-24 left-16 rotate-[-6deg] float-slow">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-20" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <Image
                src="/samples/slides/product-infographic.png"
                alt="Product Infographic slide"
                width={640}
                height={360}
                priority
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* slide B */}
        <div className="absolute top-44 right-16 rotate-[5deg] float-medium">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-15" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-[520px]">
              <Image
                src="/samples/slides/mckinsey-example-1.png"
                alt="Consulting slide example"
                width={520}
                height={320}
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* slide C */}
        <div className="absolute bottom-24 left-1/3 -translate-x-1/2 rotate-[2deg] float-delayed">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-15" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-[560px]">
              <Image
                src="/samples/slides/jpm_slide_1.png"
                alt="Financial highlights slide"
                width={560}
                height={330}
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* small floating dots for depth */}
        <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-white/30 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-5 h-5 bg-white/20 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-white/40 rounded-full animate-pulse delay-500" />
        <div className="absolute bottom-1/4 right-1/4 w-4 h-4 bg-white/25 rounded-full animate-pulse delay-1500" />

        {/* floating animations */}
        <style jsx>{`
          @keyframes floatY {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
          .float-slow { animation: floatY 10s ease-in-out infinite; }
          .float-medium { animation: floatY 8s ease-in-out infinite; }
          .float-delayed { animation: floatY 12s ease-in-out infinite; animation-delay: 1.5s; }
        `}</style>
      </div>
    </div>
  );
}
