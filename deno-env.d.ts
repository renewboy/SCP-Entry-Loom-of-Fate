declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://deno.land/std@0.224.0/http/server.ts";
declare module "npm:@google/genai";
declare module "npm:openai";
declare module "npm:@supabase/supabase-js";
