import { LoginForm } from "@/components/login-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
