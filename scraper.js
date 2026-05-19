require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BASE = 'https://www.analiticafantasy.com';

// 1. Obtener el buildId de Next.js desde el HTML de la página
async function getBuildId() {
    const res = await fetch(`${BASE}/fantasy-la-liga/mercado`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const match = html.match(/"buildId":"([^"]+)"/);
    if (!match) throw new Error('No se encontró el buildId');
    console.log('BuildId:', match[1]);
    return match[1];
}

// 2. Obtener todos los jugadores
async function fetchPlayers(buildId) {
    const url = `${BASE}/_next/data/${buildId}/fantasy-la-liga/puja-ideal.json`;
    console.log('Fetching:', url);
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    return data.pageProps?.initialData?.players || [];
}

// 3. Guardar en Supabase
async function upsertPlayers(players) {
    const POS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

    const rows = players.map(p => ({
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
    }));

    // Subir en lotes de 100
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await sb.from('jugadores').upsert(batch, { onConflict: 'external_id' });
        if (error) throw error;
        console.log(`✓ Lote ${Math.floor(i/100)+1}: ${batch.length} jugadores`);
    }
    console.log(`\n✓ Total: ${rows.length} jugadores actualizados`);
}

async function main() {
    try {
        const buildId = await getBuildId();
        const players = await fetchPlayers(buildId);
        if (!players.length) throw new Error('No se encontraron jugadores');
        console.log(`Jugadores encontrados: ${players.length}`);
        console.log('Ejemplo:', JSON.stringify(players[0], null, 2));
        await upsertPlayers(players);
        console.log('\n✓ ¡Actualización completada!');
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
