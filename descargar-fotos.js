/**
 * descargar-fotos.js
 * Descarga fotos de jugadores desde Analitica Fantasy usando su API.
 * Uso: node descargar-fotos.js
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const EQUIPOS = [
    { key:'RMA', nombre:'Real Madrid',        teamId:541 },
    { key:'BAR', nombre:'Barcelona',           teamId:529 },
    { key:'ATM', nombre:'Atlético de Madrid',  teamId:530 },
    { key:'ATH', nombre:'Athletic Club',       teamId:531 },
    { key:'RSO', nombre:'Real Sociedad',       teamId:548 },
    { key:'VIL', nombre:'Villarreal',          teamId:533 },
    { key:'BET', nombre:'Real Betis',          teamId:543 },
    { key:'SEV', nombre:'Sevilla',             teamId:536 },
    { key:'GET', nombre:'Getafe',              teamId:546 },
    { key:'GIR', nombre:'Girona',              teamId:547 },
    { key:'CEL', nombre:'Celta de Vigo',       teamId:538 },
    { key:'VAL', nombre:'Valencia',            teamId:532 },
    { key:'RAY', nombre:'Rayo Vallecano',      teamId:728 },
    { key:'OSA', nombre:'Osasuna',             teamId:727 },
    { key:'ALA', nombre:'Alavés',              teamId:542 },
    { key:'MAL', nombre:'Mallorca',            teamId:798 },
    { key:'ELC', nombre:'Elche CF',            teamId:797 },
    { key:'LEV', nombre:'Levante',             teamId:539 },
    { key:'OVI', nombre:'Real Oviedo',         teamId:718 },
    { key:'ESP', nombre:'Espanyol',            teamId:540 },
];

function slugify(name) {
    return name.toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esperar(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
            timeout: 8000,
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error('JSON inválido')); }
            });
        }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
    });
}

function descargarImagen(url, destPath) {
    return new Promise((resolve, reject) => {
        const proto = url.startsWith('https') ? https : http;
        const file  = fs.createWriteStream(destPath);
        proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close(); fs.unlinkSync(destPath);
                return descargarImagen(res.headers.location, destPath).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                file.close();
                try { fs.unlinkSync(destPath); } catch {}
                return reject(new Error(`HTTP ${res.statusCode}`));
            }
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', err => { try { fs.unlinkSync(destPath); } catch {} reject(err); });
    });
}

function imagenExiste(url) {
    return new Promise(resolve => {
        const proto = url.startsWith('https') ? https : http;
        proto.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
            resolve(res.statusCode === 200);
            res.resume();
        }).on('error', () => resolve(false));
    });
}

// Prueba un fixtureId con un equipo concreto; devuelve los jugadores o null
async function probarFixture(fixtureId, teamId) {
    try {
        const url = `https://app.analiticafantasy.com/api/vote-players?fixtureId=${fixtureId}&teamId=${teamId}`;
        const data = await fetchJSON(url);
        const players = data.players || data || [];
        if (Array.isArray(players) && players.length > 0) return players;
    } catch {}
    return null;
}

(async () => {
    console.log('🚀 Descargando fotos de jugadores desde Analitica Fantasy\n');

    // ── PASO 1: Encontrar fixtureId de cada equipo ───────────────────────
    // El fixtureId 1391196 ya funciona para RMA y ATH.
    // Buscamos los demás probando IDs cercanos.
    const FIXTURE_CONOCIDO = 1391196;
    const RANGO_BUSQUEDA   = 300; // ±300 del conocido

    const fixtureIds   = { 541: FIXTURE_CONOCIDO, 531: FIXTURE_CONOCIDO };
    const pendientes   = EQUIPOS.filter(e => !fixtureIds[e.teamId]);

    console.log(`🔍 Buscando fixtureId para ${pendientes.length} equipos (rango ±${RANGO_BUSQUEDA})...\n`);
    console.log('   Esto puede tardar 2-3 minutos, espera...\n');

    // Probamos de más cercano a más lejano para encontrar antes
    for (let delta = 1; delta <= RANGO_BUSQUEDA && pendientes.length > 0; delta++) {
        for (const fid of [FIXTURE_CONOCIDO - delta, FIXTURE_CONOCIDO + delta]) {
            if (pendientes.length === 0) break;
            // Probar todos los equipos pendientes con este fid en paralelo
            const resultados = await Promise.all(
                pendientes.map(eq => probarFixture(fid, eq.teamId).then(p => ({ eq, p })))
            );
            for (const { eq, p } of resultados) {
                if (p) {
                    fixtureIds[eq.teamId] = fid;
                    const idx = pendientes.findIndex(x => x.teamId === eq.teamId);
                    if (idx !== -1) pendientes.splice(idx, 1);
                    console.log(`  ✅ ${eq.nombre}: fixtureId=${fid}`);
                }
            }
            await esperar(80);
        }
    }

    if (pendientes.length > 0) {
        console.log(`\n  ⚠ Sin fixtureId: ${pendientes.map(e => e.nombre).join(', ')}`);
    }

    // ── PASO 2: Obtener lista de jugadores ───────────────────────────────
    console.log('\n📋 Obteniendo jugadores por equipo...\n');
    const todosJugadores = [];

    for (const equipo of EQUIPOS) {
        const fid = fixtureIds[equipo.teamId];
        if (!fid) {
            console.log(`  ⚠ ${equipo.nombre}: sin fixtureId, saltando`);
            continue;
        }
        const players = await probarFixture(fid, equipo.teamId);
        if (players) {
            console.log(`  ✅ ${equipo.nombre}: ${players.length} jugadores`);
            players.forEach(p => {
                if (p.playerId && p.name) {
                    todosJugadores.push({ nombre: p.name, teamKey: equipo.key, playerId: p.playerId });
                }
            });
        } else {
            console.log(`  ⚠ ${equipo.nombre}: sin datos`);
        }
        await esperar(150);
    }

    console.log(`\n📊 Total jugadores encontrados: ${todosJugadores.length}`);

    if (todosJugadores.length === 0) {
        console.log('❌ No se obtuvieron jugadores.');
        return;
    }

    fs.writeFileSync('af_jugadores_api.json', JSON.stringify(todosJugadores, null, 2));

    // ── PASO 3: Probar patrones de URL de imagen ─────────────────────────
    const prueba = todosJugadores.find(j => j.playerId);
    const patronesPrueba = [
        `https://assets.analiticafantasy.com/jugadores/${prueba.playerId}.png`,
        `https://assets.analiticafantasy.com/jugadores/${prueba.playerId}.webp`,
        `https://assets.analiticafantasy.com/players/${prueba.playerId}.png`,
        `https://assets.analiticafantasy.com/players/${prueba.playerId}.webp`,
        `https://assets.analiticafantasy.com/imagenes/jugadores/${prueba.playerId}.png`,
        `https://assets.analiticafantasy.com/fotos/${prueba.playerId}.png`,
    ];

    console.log(`\n🧪 Probando patrones con ${prueba.nombre} (ID: ${prueba.playerId})...`);
    let patronValido = null;
    for (const patron of patronesPrueba) {
        const existe = await imagenExiste(patron);
        console.log(`  ${existe ? '✅' : '❌'} ${patron}`);
        if (existe && !patronValido) patronValido = patron;
    }

    if (!patronValido) {
        console.log('\n⚠ Ningún patrón funcionó. Los player IDs están en af_jugadores_api.json');
        return;
    }

    const ext     = patronValido.includes('.webp') ? 'webp' : 'png';
    const baseDir = patronValido.replace(`${prueba.playerId}.${ext}`, '');
    console.log(`\n✅ Patrón válido: ${baseDir}{playerId}.${ext}`);

    // ── PASO 4: Descargar todas las imágenes ─────────────────────────────
    console.log(`\n📥 Descargando ${todosJugadores.length} fotos...\n`);

    let ok = 0, skip = 0, err = 0;
    const mapaImagenes = {};

    for (const jugador of todosJugadores) {
        const imgUrl  = `${baseDir}${jugador.playerId}.${ext}`;
        const slug    = slugify(jugador.nombre);
        const dirTeam = path.join('img', jugador.teamKey);
        const dest    = path.join(dirTeam, `${slug}.${ext}`);
        const relPath = `img/${jugador.teamKey}/${slug}.${ext}`;

        if (fs.existsSync(dest)) {
            mapaImagenes[slug] = relPath;
            skip++;
            continue;
        }

        fs.mkdirSync(dirTeam, { recursive: true });

        try {
            await descargarImagen(imgUrl, dest);
            mapaImagenes[slug] = relPath;
            ok++;
            if (ok % 20 === 0) console.log(`  ... ${ok} descargadas`);
        } catch {
            err++;
        }
        await esperar(80);
    }

    console.log(`\n✅ Descargadas: ${ok} | Ya existían: ${skip} | Errores: ${err}`);

    // ── PASO 5: Generar player-images-auto.js ────────────────────────────
    if (Object.keys(mapaImagenes).length > 0) {
        const entradas = Object.entries(mapaImagenes)
            .map(([k, v]) => `    '${k}': '${v}',`)
            .join('\n');

        const contenido = `// Mapa de imágenes de jugadores (generado automáticamente)
const PLAYER_IMAGES_NEW = {\n${entradas}\n};\n
if (typeof PLAYER_IMAGES !== 'undefined') {
    Object.assign(PLAYER_IMAGES, PLAYER_IMAGES_NEW);
} else {
    window.PLAYER_IMAGES = PLAYER_IMAGES_NEW;
}\n`;

        fs.mkdirSync('assets/js', { recursive: true });
        fs.writeFileSync('assets/js/player-images-auto.js', contenido);
        console.log(`\n📄 Mapa generado: assets/js/player-images-auto.js (${Object.keys(mapaImagenes).length} entradas)`);
        console.log('   Añade al HTML: <script src="assets/js/player-images-auto.js"></script>');
    }

    console.log('\n🎉 ¡Listo!');
})();
