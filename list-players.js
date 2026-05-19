require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
    const { data, error } = await sb.from('jugadores')
        .select('nombre, equipo, posicion, precio, puntos')
        .order('equipo')
        .order('posicion')
        .order('nombre');
    if (error) { console.error(error); process.exit(1); }

    let currentTeam = '';
    data.forEach(p => {
        if (p.equipo !== currentTeam) {
            currentTeam = p.equipo;
            console.log(`\n=== ${p.equipo} ===`);
        }
        console.log(`  [${p.posicion}] "${p.nombre}"  ${p.precio}M€  ${p.puntos}pts`);
    });
}
main();
