"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    });
    setLoading(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? "Erro ao autenticar.";
      setError(
        message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : message
      );
      return;
    }
    router.refresh();
    router.push("/");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-[var(--ac-text)]">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-[10px] border border-[var(--ac-border)] bg-white px-3.5 py-3 text-base text-[var(--ac-text)] outline-none transition-[box-shadow,border-color] placeholder:text-[var(--ac-muted)] focus:border-[var(--ac-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ac-accent)_35%,transparent)] sm:text-sm"
          placeholder="voce@empresa.com.br"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-[var(--ac-text)]">
          Senha
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full rounded-[10px] border border-[var(--ac-border)] bg-white py-3 pl-3.5 pr-12 text-base text-[var(--ac-text)] outline-none transition-[box-shadow,border-color] placeholder:text-[var(--ac-muted)] focus:border-[var(--ac-accent)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--ac-accent)_35%,transparent)] sm:text-sm"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center rounded-r-[10px] text-[var(--ac-muted)] transition hover:text-[var(--ac-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac-accent)]"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-5 shrink-0"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.182 4.182L9.88 9.88"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-5 shrink-0"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-[var(--ac-accent)] px-4 py-3 text-base font-semibold text-[#1a1a1a] shadow-sm transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac-accent)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
