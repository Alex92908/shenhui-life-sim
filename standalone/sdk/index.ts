// Server half of the local SDK stand-in. Mirrors the API shape that
// server/src/actions.ts imports from "@hatch/space-sdk", so that file runs
// unchanged outside Muse.
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { z } from "zod";

export { z };

/** Shape of the weather tool result that actions.ts reads. */
export interface WeatherToolResult {
  content: {
    location?: string;
    summary?: string;
    conditions: {
      description?: string;
      temperature?: number | null;
      unit?: string;
      feels_like?: number | null;
      high?: number | null;
      low?: number | null;
      humidity_percent?: number | null;
      precipitation_chance?: number | null;
      wind?: string | null;
      sunrise?: string | null;
      sunset?: string | null;
    };
    alerts?: string[];
    forecast_days?: {
      date?: string | null;
      summary?: string | null;
      high?: number | null;
      low?: number | null;
      precipitation_chance?: number | null;
    }[];
    sources?: { title?: string; url?: string }[];
  };
}

export interface Ctx {
  db<S extends Record<string, unknown>>(): BetterSQLite3Database<S>;
  tool: {
    weather(
      query: string,
      opts: { location: { lat: number; lon: number; timezone?: string }; hourly_hours?: number },
    ): Promise<WeatherToolResult>;
  };
  /** Muse pushes a refetch hint to clients; standalone clients just poll. */
  invalidateQueries(): void;
}

export interface ActionDef<Req extends z.ZodType = z.ZodType, Res extends z.ZodType = z.ZodType> {
  description: string;
  request: Req;
  response: Res;
  handler(ctx: Ctx, args: z.output<Req>): Promise<z.input<Res>>;
}

export type ActionsModule = Record<string, ActionDef>;

export function defineAction<Req extends z.ZodType, Res extends z.ZodType>(def: ActionDef<Req, Res>): ActionDef<Req, Res> {
  return def;
}
