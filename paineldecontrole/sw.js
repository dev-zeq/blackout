// Service worker do Painel de Controle (2026-08-23, pedido do usuário) — só
// existe pra tornar o painel instalável como app (PWA) em Android e iPhone.
// Não muda nada no funcionamento atual do sistema: só o "app shell" (o
// próprio index.html, o manifest e os ícones) passa por aqui, com estratégia
// network-first (sempre busca a versão mais nova primeiro; só usa o cache
// como fallback se a rede falhar). Qualquer outra requisição — chamadas ao
// Supabase, storage, APIs, o formulário público curriculo-form.html — nunca
// é interceptada aqui, então continua se comportando exatamente como sem
// service worker nenhum.
const CACHE_NAME = 'blackout-painel-shell-v1';
const APP_SHELL = ['index.html', 'manifest.json', 'assets/icon-192.png', 'assets/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .catch(() => {}) // sem internet no 1º acesso, por exemplo — não trava a instalação
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((chaves) => Promise.all(
            chaves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return; // só leitura — nunca intercepta gravações
    if (new URL(req.url).origin !== self.location.origin) return; // nunca intercepta chamadas externas (Supabase, etc.)

    const ehAppShell = APP_SHELL.some((caminho) => req.url.endsWith(caminho));
    if (!ehAppShell) return; // deixa passar direto pro comportamento padrão do navegador

    event.respondWith(
        fetch(req)
            .then((res) => {
                const copia = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
                return res;
            })
            .catch(() => caches.match(req))
    );
});
