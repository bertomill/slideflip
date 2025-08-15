"use client";

import { LoginForm } from "@/components/login-form";
import { BackgroundGradientAnimation } from "@/components/ui/background-gradient-animation";
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
      
      {/* Right side - Three-slide showcase */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(0, 0, 0)"
          gradientBackgroundEnd="rgb(40, 40, 50)"
          firstColor="180, 180, 200"
          secondColor="120, 100, 150"
          thirdColor="200, 180, 220"
          fourthColor="100, 80, 120"
          fifthColor="160, 140, 180"
          pointerColor="200, 180, 220"
          size="140%"
          blendingValue="soft-light"
          interactive={true}
          containerClassName="w-full h-full"
          className="relative w-full h-full flex items-center justify-center"
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center space-y-8 z-10 px-8">
            {/* First slide */}
            <div className="relative w-[320px] aspect-[16/9] rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 shadow-2xl hover:scale-105 transition-transform duration-300 noise-texture">
              <Image
                src="/samples/slides/product-infographic.png"
                alt="Product infographic slide"
                width={320}
                height={180}
                className="object-cover w-full h-full"
              />
            </div>

            {/* Second slide */}
            <div className="relative w-[320px] aspect-[16/9] rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 shadow-2xl hover:scale-105 transition-transform duration-300 noise-texture">
              <Image
                src="/samples/slides/jpm_slide_1.png"
                alt="Financial highlights slide"
                width={320}
                height={180}
                priority
                className="object-cover w-full h-full"
              />
            </div>

            {/* Third slide */}
            <div className="relative w-[320px] aspect-[16/9] rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm border border-white/10 shadow-2xl hover:scale-105 transition-transform duration-300 noise-texture">
              <Image
                src="/samples/slides/mckinsey-example-1.png"
                alt="Consulting slide example"
                width={320}
                height={180}
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </BackgroundGradientAnimation>
      </div>
    </div>
  );
}
