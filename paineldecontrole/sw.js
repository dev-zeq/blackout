// Service worker do Painel de Controle (2026-08-23, pedido do usuário; revisado
// em 2026-08-25 pra garantir que o app instalado sempre carregue a versão mais
// nova depois de um deploy, sem precisar limpar cache manualmente) — só existe
// pra tornar o painel instalável como app (PWA) em Android e iPhone. Não muda
// nada no funcionamento atual do sistema: só o "app shell" (o próprio
// index.html, o manifest e os ícones) passa por aqui, com estratégia
// network-first de verdade — o fetch ignora o cache HTTP do navegador
// (`cache: 'no-store'`), então nunca serve uma resposta velha guardada pelo
// próprio navegador por trás das costas do Service Worker; só usa a cópia
// salva em Cache Storage como último recurso, se a rede falhar de verdade
// (offline). Qualquer outra requisição — chamadas ao Supabase, storage, APIs,
// os formulários públicos — nunca é interceptada aqui, então continua se
// comportando exatamente como sem service worker nenhum.
//
// Bump do nome do cache a cada revisão relevante deste arquivo (só decoração:
// o activate() abaixo já apaga sozinho qualquer cache com nome diferente do
// atual, então isso garante um corte limpo pros apps já instalados antes
// desta revisão, sem depender de esperar o TTL antigo expirar).
const CACHE_NAME = 'blackout-painel-shell-v2';
const APP_SHELL = ['index.html', 'manifest.json', 'assets/icon-192.png', 'assets/icon-512.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL.map((caminho) => new Request(caminho, { cache: 'reload' }))))
            .catch(() => {}) // sem internet no 1º acesso, por exemplo — não trava a instalação
    );
    // Ativa a nova versão imediatamente, sem esperar todas as abas antigas
    // fecharem — combinado com self.clients.claim() no activate() e o reload
    // automático feito pelo index.html ao detectar 'controllerchange' (ver
    // inicializarPwa()), é isso que faz o app instalado trocar de versão
    // sozinho, sem exigir reabrir manualmente nem limpar cache.
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
        // `cache: 'no-store'` força o navegador a ignorar o próprio cache HTTP
        // dele (o `Cache-Control` que o GitHub Pages manda) e ir na rede de
        // verdade — sem isso, "network first" podia devolver uma resposta
        // ainda válida pelo cache HTTP do navegador mesmo já tendo saído um
        // deploy novo, sem o Service Worker nem perceber que estava velha.
        fetch(req, { cache: 'no-store' })
            .then((res) => {
                const copia = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, copia));
                return res;
            })
            .catch(() => caches.match(req))
    );
});
