"use client";

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

        {/* slide A - Top */}
        <div className="absolute top-16 left-1/2 transform -translate-x-[170px] rotate-[-2deg]">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-20" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-[400px] h-[240px]">
              <Image
                src="/samples/slides/product-infographic.png"
                alt="Product Infographic slide"
                width={400}
                height={240}
                priority
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSorjUdEABVDMqZlGWUE+8HeBtWN2EEZpkSq1cADh4ANnYKx5jfxYgFgBQSIyc87GhVMl8KbJmGLdMZQILbDWoSgFEA+8BePOmYa4BZO/YXA3CjrMWxvvbr8xHTrSdKVRF7BQOQV9qc5fQo6kWEbsKCCUgIJaHdWqoNrBHJEKBACgUAEB6YKA2WPrQLzTnJqXXN4YNh3BFE+xBOC6qgaABBEOBnLCqPWjNOOyFpzUUe5ATgbIxVNJQHrjD8GHMlFDqQg=="
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* slide B - Top right */}
        <div className="absolute top-20 left-1/2 transform -translate-x-[70px] rotate-[2deg]">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-15" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-[380px] h-[230px]">
              <Image
                src="/samples/slides/mckinsey-example-1.png"
                alt="Consulting slide example"
                width={380}
                height={230}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSorjUdEABVDMqZlGWUE+8HeBtWN2EEZpkSq1cADh4ANnYKx5jfxYgFgBQSIyc87GhVMl8KbJmGLdMZQILbDWoSgFEA+8BePOmYa4BZO/YXA3CjrMWxvvbr8xHTrSdKVRF7BQOQV9qc5fQo6kWEbsKCCUgIJaHdWqoNrBHJEKBACgUAEB6YKA2WPrQLzTnJqXXN4YNh3BFE+xBOC6qgaABBEOBnLCqPWjNOOyFpzUUe5ATgbIxVNJQHrjD8GHMlFDqQg=="
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* slide C - Bottom center */}
        <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 rotate-[0deg]">
          <div className="relative">
            <div className="absolute -inset-6 bg-white/10 blur-2xl rounded-3xl opacity-15" aria-hidden />
            <div className="relative rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 w-[420px] h-[250px]">
              <Image
                src="/samples/slides/jpm_slide_1.png"
                alt="Financial highlights slide"
                width={420}
                height={250}
                placeholder="blur"
                blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQABAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSorjUdEABVDMqZlGWUE+8HeBtWN2EEZpkSq1cADh4ANnYKx5jfxYgFgBQSIyc87GhVMl8KbJmGLdMZQILbDWoSgFEA+8BePOmYa4BZO/YXA3CjrMWxvvbr8xHTrSdKVRF7BQOQV9qc5fQo6kWEbsKCCUgIJaHdWqoNrBHJEKBACgUAEB6YKA2WPrQLzTnJqXXN4YNh3BFE+xBOC6qgaABBEOBnLCqPWjNOOyFpzUUe5ATgbIxVNJQHrjD8GHMlFDqQg=="
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* small floating dots for depth */}
        <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-white/30 rounded-full animate-pulse" />
        <div className="absolute top-1/3 right-1/3 w-5 h-5 bg-white/20 rounded-full animate-pulse delay-1000" />
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-white/40 rounded-full animate-pulse delay-500" />
        <div className="absolute bottom-1/4 right-1/4 w-4 h-4 bg-white/25 rounded-full animate-pulse delay-1500" />

      </div>
    </div>
  );
}
