-- ================================================================
-- EJECUTAR ESTE SQL EN: Supabase Dashboard → SQL Editor
-- Nota: dejar "Confirm email" ACTIVADO en Authentication → Providers → Email
-- ================================================================

-- 1. Tabla de perfiles de usuario
CREATE TABLE IF NOT EXISTS perfiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre     TEXT,
  email      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Activar Row Level Security
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas: cada usuario ve su propio perfil, el admin ve todos
CREATE POLICY "usuario_propio" ON perfiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "admin_ve_todos" ON perfiles
  FOR SELECT TO authenticated
  USING ((SELECT email FROM auth.users WHERE id = auth.uid()) = 'albertofernandezmesas@gmail.com');

CREATE POLICY "insertar_propio" ON perfiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "actualizar_propio" ON perfiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);
