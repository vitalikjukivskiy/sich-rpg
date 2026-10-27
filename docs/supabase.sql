-- Окреме збереження світу «Січ». Існуючі таблиці Supabase не змінюються.
CREATE TABLE IF NOT EXISTS public.sich_game_state (
  id text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 0,
  world jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sich_game_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sich_game_state FROM anon, authenticated;
INSERT INTO public.sich_game_state (id, revision, world)
VALUES ('live', 0, '{"version":1,"revision":0,"players":{},"accounts":{},"sessions":{},"chat":[],"clans":{},"duels":{},"market":{}}'::jsonb)
ON CONFLICT (id) DO NOTHING;
-- Тільки сервісна роль Edge Function має право змінювати дані.
GRANT SELECT, INSERT, UPDATE ON public.sich_game_state TO service_role;
