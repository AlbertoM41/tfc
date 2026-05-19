import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'albertofernandezmesas@gmail.com'
const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verificar que el usuario es admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Sin autorización')

    const sbUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user } } = await sbUser.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) throw new Error('No autorizado')

    // 1. Obtener buildId de analiticafantasy.com
    const pageRes = await fetch('https://www.analiticafantasy.com/fantasy-la-liga/mercado', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    })
    const html = await pageRes.text()
    const buildMatch = html.match(/"buildId":"([^"]+)"/)
    if (!buildMatch) throw new Error('No se encontró el buildId de Next.js')
    const buildId = buildMatch[1]

    // 2. Obtener jugadores
    const dataRes = await fetch(
      `https://www.analiticafantasy.com/_next/data/${buildId}/fantasy-la-liga/puja-ideal.json`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    )
    if (!dataRes.ok) throw new Error(`Error ${dataRes.status} al obtener jugadores`)
    const json = await dataRes.json()
    const players = json.pageProps?.initialData?.players || []
    if (!players.length) throw new Error('No se encontraron jugadores en la fuente')

    // 3. Mapear y subir a Supabase con service key
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const rows = players.map((p: any) => ({
      external_id: p.id,
      nombre:      p.n || p.fi?.nickname || 'Desconocido',
      equipo:      p.club?.n || '—',
      equipo_key:  p.club?.id ? String(p.club.id) : '—',
      posicion:    POS[p.fi?.positionId] || '—',
      precio:      p.mv ? parseFloat((p.mv / 1000000).toFixed(2)) : 0,
      puntos:      p.fi?.points || 0,
      variacion:   p.up ? parseFloat((p.up / 1000000).toFixed(2)) : 0,
      estado:      p.fi?.status || p.st || 'ok',
      updated_at:  new Date().toISOString()
    }))

    let updated = 0
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await sb.from('jugadores').upsert(rows.slice(i, i + 100), { onConflict: 'external_id' })
      if (error) throw error
      updated += Math.min(100, rows.length - i)
    }

    return new Response(
      JSON.stringify({ success: true, updated, total: players.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
