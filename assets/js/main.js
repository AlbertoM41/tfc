// ── Escudos de equipos ───────────────────────────────────────────
const TEAM_CRESTS = {
    RMA: 'img/RMA/escudorealmadrid.webp',
    BAR: 'img/BAR/escudobarsa.webp',
    ATM: 'img/ATM/escudoatleticodemadrid.webp',
    ATH: 'img/ATH/escudobilbao.webp',
    RSO: 'img/RSO/escudorealsociedad.webp',
    VIL: 'img/VIL/escudovillareal.webp',
    BET: 'img/BET/escudobetis.webp',
    SEV: 'img/SEV/escudosevilla.webp',
    GET: 'img/GET/escudogetafe2.webp',
    GIR: 'img/GIR/escudogirona.webp',
    CEL: 'img/CEL/escudocelta.webp',
    VAL: 'img/VAL/escudovalencia.webp',
    RAY: 'img/RAY/escudorayovallecano.webp',
    OSA: 'img/OSA/escudoosasuna.webp',
    ALA: 'img/ALA/escudoalaves.webp',
    MAL: 'img/MAL/escudomallorca.webp',
    ELC: 'img/ELC/elche.webp',
    LEV: 'img/LEV/escudolevante.webp',
    OVI: 'img/OVI/escudooviedo.webp',
    ESP: 'img/ESP/escudoespañol.webp',
};

function initCrests(root) {
    (root || document).querySelectorAll('.crest-fallback').forEach(el => {
        if (el.querySelector('img')) return; // ya procesado

        let code = null;
        const link = el.closest('a');
        if (link) {
            const m = link.href.match(/[?&]team=([A-Z]+)/i);
            if (m) code = m[1].toUpperCase();
        }
        if (!code) {
            const txt = el.textContent.trim().toUpperCase();
            if (TEAM_CRESTS[txt]) code = txt;
        }
        if (!code || !TEAM_CRESTS[code]) return;

        const img = document.createElement('img');
        img.src = TEAM_CRESTS[code];
        img.alt = link?.title || code;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
        img.onerror = () => { img.remove(); el.style.background = ''; };

        el.textContent = '';
        el.style.background = 'transparent';
        el.appendChild(img);
    });
}

document.addEventListener('DOMContentLoaded', () => initCrests());

// Navbar mobile toggle
document.getElementById('navToggle')?.addEventListener('click', () => {
    document.getElementById('navMobile')?.classList.toggle('open');
});

// Format price (price stored in thousands)
function formatPrice(val) {
    if (val >= 1000) return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + 'M€';
    return val + 'K€';
}

function formatChange(val) {
    if (val === 0) return '—';
    const sign = val > 0 ? '+' : '';
    return sign + formatPrice(Math.abs(val));
}

function priceChangeClass(val) {
    if (val > 0) return 'price-up';
    if (val < 0) return 'price-down';
    return 'price-neutral';
}

// Auto-dismiss alerts
document.querySelectorAll('.alert[data-dismiss]').forEach(el => {
    setTimeout(() => el.remove(), parseInt(el.dataset.dismiss) || 4000);
});

// ── Favoritos (localStorage) ──────────────────────────────────────
function getFavorites(userId) {
    try { return JSON.parse(localStorage.getItem('fp_favs_' + userId) || '[]'); }
    catch { return []; }
}
function saveFavorites(userId, favs) {
    localStorage.setItem('fp_favs_' + userId, JSON.stringify(favs));
}
function isFavorite(userId, nombre) {
    return getFavorites(userId).some(f => f.nombre === nombre);
}
function toggleFavorite(userId, player) {
    const favs = getFavorites(userId);
    const idx = favs.findIndex(f => f.nombre === player.nombre);
    if (idx >= 0) favs.splice(idx, 1);
    else favs.unshift(player);
    saveFavorites(userId, favs);
    return idx < 0;
}

// ── Avatar (localStorage) ─────────────────────────────────────────
function getUserAvatar(userId) {
    return localStorage.getItem('fp_avatar_' + userId) || null;
}
function setUserAvatar(userId, src) {
    localStorage.setItem('fp_avatar_' + userId, src);
}

// Dropdown toggle — disponible globalmente (admin y resto de páginas)
window._toggleUserDropdown = function(e) {
    e.stopPropagation();
    const dd = document.getElementById('userDropdown');
    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};
document.addEventListener('click', () => {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.style.display = 'none';
});

// ── Auth navbar — avatar dropdown ─────────────────────────────────
;(function() {
    if (typeof window.supabase === 'undefined') return;
    // Saltar si la página gestiona su propio navbar (admin, mi-equipo)
    if (document.querySelector('#adminNavActions') || document.querySelector('#miEquipoManaged')) return;

    const SUPABASE_URL = 'https://qcbviyqtdfgygtvheqcf.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_zuiDzXkTXtCzr5IqnhmuPw_QHHuKJGr';
    const ADMIN_EMAIL  = 'albertofernandezmesas@gmail.com';

    const _authSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    window._authLogout = async function() {
        await _authSb.auth.signOut();
        window.location.href = 'login.html';
    };

    _authSb.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        const user = session.user;
        window._currentUserId = user.id;
        const isAdmin = user.email === ADMIN_EMAIL;
        const name = user.user_metadata?.nombre || user.email.split('@')[0];
        const initial = name.charAt(0).toUpperCase();
        const avatarSrc = getUserAvatar(user.id);
        const avatarInner = avatarSrc
            ? `<img src="${avatarSrc}" alt="${name}">`
            : initial;

        const actions = document.querySelector('.navbar-actions');
        if (!actions) return;
        actions.innerHTML = `
            ${isAdmin ? '<a href="admin.html" class="btn btn-ghost btn-sm">Admin</a>' : ''}
            <div class="user-dropdown-wrap">
                <button class="user-avatar-btn" onclick="_toggleUserDropdown(event)" title="${name}">
                    ${avatarInner}
                </button>
                <div id="userDropdown" class="user-dropdown" style="display:none;" onclick="event.stopPropagation()">
                    <div class="user-dropdown-header">${user.email}</div>
                    <a href="perfil.html" class="user-dropdown-item">👤 Mi perfil</a>
                    <a href="favoritos.html" class="user-dropdown-item">⭐ Mis favoritos</a>
                    <a href="amigos.html" class="user-dropdown-item">👥 Amigos</a>
                    <div class="user-dropdown-sep"></div>
                    <button onclick="_authLogout()" class="user-dropdown-item danger">Cerrar sesión</button>
                </div>
            </div>
        `;
    });
})();
