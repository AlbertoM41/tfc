-- ================================================================
-- SISTEMA DE AMIGOS — Ejecutar en Supabase Dashboard → SQL Editor
-- ================================================================

-- 1. Añadir columna username a perfiles (única por usuario)
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_perfiles_username ON perfiles(username);

-- 2. Permitir que usuarios autenticados busquen perfiles de otros
--    (necesario para buscar amigos por username)
DROP POLICY IF EXISTS "usuario_propio" ON perfiles;
CREATE POLICY "ver_perfiles" ON perfiles
    FOR SELECT TO authenticated USING (true);

-- Mantener políticas de escritura solo para el propio perfil
DROP POLICY IF EXISTS "insertar_propio" ON perfiles;
DROP POLICY IF EXISTS "actualizar_propio" ON perfiles;
CREATE POLICY "insertar_propio" ON perfiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "actualizar_propio" ON perfiles
    FOR UPDATE TO authenticated USING (auth.uid() = id);

-- 3. Crear tabla de amigos
CREATE TABLE IF NOT EXISTS amigos (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    friend_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status     TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'accepted'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id <> friend_id)
);

ALTER TABLE amigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amigos_select" ON amigos
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "amigos_insert" ON amigos
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id AND user_id <> friend_id);

CREATE POLICY "amigos_update" ON amigos
    FOR UPDATE TO authenticated
    USING (auth.uid() = friend_id);

CREATE POLICY "amigos_delete" ON amigos
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 4. Permitir ver equipos de amigos en mi_equipo
--    (Los usuarios autenticados pueden leer cualquier equipo;
--     solo pueden escribir en el suyo propio)
ALTER TABLE mi_equipo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ver_propio_equipo" ON mi_equipo;
DROP POLICY IF EXISTS "ver_equipos_publicos" ON mi_equipo;
DROP POLICY IF EXISTS "gestionar_equipo_propio" ON mi_equipo;
DROP POLICY IF EXISTS "update_equipo_propio" ON mi_equipo;
DROP POLICY IF EXISTS "delete_equipo_propio" ON mi_equipo;

CREATE POLICY "ver_equipos" ON mi_equipo
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "insertar_equipo_propio" ON mi_equipo
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "actualizar_equipo_propio" ON mi_equipo
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "eliminar_equipo_propio" ON mi_equipo
    FOR DELETE TO authenticated USING (auth.uid() = user_id);
