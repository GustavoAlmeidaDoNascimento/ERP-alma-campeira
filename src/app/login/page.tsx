import { AlmaLogo } from "@/components/alma-logo";
import { LoginForm } from "@/components/login-form";
import { getAuthenticatedUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const user = await getAuthenticatedUser()
  if (user) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--ac-bg)] p-4 sm:p-6">
      <div className="w-full max-w-[420px] rounded-xl border border-[var(--ac-border)] bg-[var(--ac-card)] p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <AlmaLogo className="flex-col sm:flex-row" />
          <p className="mt-2 max-w-[280px] text-sm text-[var(--ac-muted)]">
            Acesse o ERP com sua conta corporativa.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
