import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Cookie próprio que marca "sessão validada recentemente". Enquanto presente,
 * o middleware pula `auth.getUser()` (round-trip de rede) e devolve o response
 * direto. Mutações de auth (login/logout) limpam esse marcador.
 */
const MW_FRESH_COOKIE = "ac-mw-fresh";
const MW_FRESH_TTL_SECONDS = 300;

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // Caminho rápido: já validamos a sessão há menos de MW_FRESH_TTL_SECONDS.
  // Evita um round-trip à Supabase Auth em toda requisição (server actions, RSC, etc.).
  if (request.cookies.get(MW_FRESH_COOKIE)) {
    return response;
  }

  const { supabaseUrl, supabasePublishableKey } = getSupabaseEnv();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  await supabase.auth.getUser();

  // Marca a sessão como "fresca" por MW_FRESH_TTL_SECONDS. Cookie httpOnly + sameSite
  // pra não vazar, e path "/" pra valer em qualquer rota.
  response.cookies.set(MW_FRESH_COOKIE, "1", {
    maxAge: MW_FRESH_TTL_SECONDS,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
