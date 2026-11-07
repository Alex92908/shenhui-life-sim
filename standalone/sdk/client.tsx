// Client half of the local SDK stand-in: typed RPC proxy, shared
// QueryClient and a no-op safe-area scrim.
import { QueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import type { ActionDef, ActionsModule } from "./index";

type ClientOf<M extends ActionsModule> = {
  [K in keyof M]: M[K] extends ActionDef<infer Req, infer Res>
    ? (args: z.input<Req>) => Promise<z.output<Res>>
    : never;
};

export type ApiRequest<C, K extends keyof C> = C[K] extends (args: infer A) => unknown ? A : never;
export type ApiResponse<C, K extends keyof C> = C[K] extends (...a: never[]) => Promise<infer R> ? R : never;

/** POSTs `{action, args}` to `./actions`; the standalone server answers `{ok, data | error}`. */
export function createActionClient<M extends ActionsModule>(): ClientOf<M> {
  return new Proxy({} as ClientOf<M>, {
    get(_t, action) {
      if (typeof action !== "string") return undefined;
      return async (args: unknown) => {
        const res = await fetch("./actions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, args: args ?? {} }),
        });
        const body = (await res.json().catch(() => null)) as { ok: boolean; data?: unknown; error?: string } | null;
        if (!res.ok || !body?.ok) throw new Error(body?.error ?? `action ${action} failed (${res.status})`);
        return body.data;
      };
    },
  });
}

export const spaceQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

/** Muse draws a scrim under the host's notch/header; nothing to do standalone. */
export function SafeAreaTopScrim(_props: Record<string, unknown>) {
  return null;
}
