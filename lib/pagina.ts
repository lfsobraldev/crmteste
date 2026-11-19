/**
 * Página da Gestão de Processos (layout, logotipo, cores e tipografia do protótipo original preservados).
 * O estilo e o script ficam em public/ (gp.css e gp.js); `v` evita cache de versão antiga.
 */
const I = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><path d="M12 5v14M5 12h14"/></svg>',
  chamado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
  fila: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v4H4zM4 11h16v4H4zM4 17h10v3H4z"/></svg>',
  kanban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="5" height="18" rx="1.5"/><rect x="10" y="3" width="5" height="12" rx="1.5"/><rect x="17" y="3" width="4" height="8" rx="1.5"/></svg>',
  meus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 10.5h7M8.5 14h4.5"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/></svg>',
  ano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M6 17V11M10 17V7M14 17v-4M18 17V4"/></svg>',
  cfg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  senha: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  sair: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/></svg>',
  filtro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg>',
  csv: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
};

export function paginaGestaoProcessos(v: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Gestão de Processos Famossul</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800;6..12,900&display=swap">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style>
<link rel="stylesheet" href="/gp.css?v=${v}">
</head><body>
<div class="app">
<aside class="side" aria-label="Menu">
  <div class="side-top">
    <span class="logo" role="img" aria-label="Famossul"></span>
    <div class="side-sub">Gestão de Processos</div>
  </div>
  <button class="btn-new" id="btnCh" type="button">${I.chamado}Abrir chamado</button>
  <button class="btn-new alt" id="btnNew" type="button" hidden>${I.plus}<span>Nova tarefa</span></button>
  <nav class="nav" id="nav">
    <div class="nav-l">Central de chamados</div>
    <button class="nav-i" data-v="meus" type="button" hidden>${I.meus}Meus chamados<span class="badge warn" id="navAguard" hidden></span></button>
    <button class="nav-i" data-v="fila" type="button" hidden>${I.fila}Fila de atendimento<span class="badge info" id="navNovos" hidden></span></button>
    <button class="nav-i" data-v="kbch" type="button" hidden>${I.kanban}Kanban de chamados</button>
    <div class="nav-l g2" id="navTar" hidden>Visões</div>
    <button class="nav-i" data-v="dashboard" type="button" hidden>${I.dash}Dashboard<span class="badge" id="navLate" hidden></span></button>
    <button class="nav-i" data-v="agenda" type="button" hidden>${I.agenda}Agenda</button>
    <button class="nav-i" data-v="kanban" type="button" hidden>${I.kanban}Kanban</button>
    <button class="nav-i" data-v="lista" type="button" hidden>${I.lista}Lista</button>
    <button class="nav-i" data-v="ano" type="button" hidden>${I.ano}Planejamento anual</button>
  </nav>
  <div class="side-foot">
    <div class="me" id="me" hidden></div>
    <button class="side-btn" id="btnCfg" type="button" title="Usuários, sistemas, setores, tipos, jornadas e pessoas" hidden>${I.cfg}<span>Cadastros</span></button>
    <button class="side-btn" id="btnSenha" type="button" title="Trocar minha senha">${I.senha}<span>Minha senha</span></button>
    <button class="side-btn" id="btnSair" type="button" title="Sair">${I.sair}<span>Sair</span></button>
    <div class="sync"><span class="dot" id="syncDot"></span><span id="syncTxt">Conectando…</span></div>
  </div>
</aside>

<div class="main">
  <div class="bar">
    <div>
      <div class="eyebrow" id="vEye">Central de chamados</div>
      <h1 class="h1" id="vTitle">Carregando…</h1>
      <div class="vsub" id="vSub"></div>
    </div>
    <div class="pctl" id="pctl" hidden>
      <div class="seg" id="perSeg">
        <button data-p="hoje" type="button">Hoje</button><button data-p="semana" type="button">Semana</button><button data-p="mes" type="button">Mês</button><button data-p="trimestre" type="button">Trimestre</button><button data-p="ano" type="button">Ano</button><button data-p="tudo" type="button">Tudo</button><button data-p="custom" type="button">Período</button>
      </div>
      <div class="navp">
        <button id="pPrev" type="button" aria-label="Período anterior">‹</button>
        <span class="plabel" id="pLabel"></span>
        <button id="pNext" type="button" aria-label="Próximo período">›</button>
      </div>
      <div class="f-cust" id="fCust" hidden>
        <input type="date" class="inp" id="fDe" aria-label="De"><span class="sub">até</span><input type="date" class="inp" id="fAte" aria-label="Até">
      </div>
    </div>
  </div>

  <section class="filters" id="tfil" aria-label="Filtros de tarefas" hidden>
    <span class="fic">${I.filtro}Filtros</span>
    <select class="sel" id="fSetor" aria-label="Setor"></select>
    <select class="sel" id="fTipo" aria-label="Tipo de tarefa"></select>
    <select class="sel" id="fResp" aria-label="Responsável"></select>
    <select class="sel" id="fStatus" aria-label="Status"></select>
    <select class="sel" id="fPrio" aria-label="Prioridade"></select>
    <input class="inp q" id="fQ" type="search" placeholder="Buscar título, descrição, pessoa…" aria-label="Buscar">
    <button class="f-clear" id="fClear" type="button" hidden>Limpar filtros</button>
  </section>

  <section class="filters" id="cfil" aria-label="Filtros de chamados" hidden>
    <span class="fic">${I.filtro}Filtros</span>
    <select class="sel" id="cSis" aria-label="Sistema"></select>
    <select class="sel" id="cTipo" aria-label="Tipo de solicitação"></select>
    <select class="sel" id="cSt" aria-label="Status"></select>
    <select class="sel" id="cPrio" aria-label="Prioridade"></select>
    <select class="sel" id="cResp" aria-label="Responsável"></select>
    <input class="inp q" id="cQ" type="search" placeholder="Buscar número, título, descrição, pessoa…" aria-label="Buscar chamados">
    <button class="f-clear" id="cClear" type="button" hidden>Limpar filtros</button>
  </section>

  <div id="erro" class="blank err" hidden>
    <div class="bi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/></svg></div>
    <div class="bt"><h3 id="erroT">Não foi possível carregar</h3><p id="erroM"></p></div>
    <button class="btn pri" type="button" id="btnRetry">Tentar de novo</button>
  </div>

  <div id="blank" class="blank" hidden>
    <div class="bi"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5"/></svg></div>
    <div class="bt"><h3>Nenhuma tarefa cadastrada ainda</h3>
    <p>Cadastre tarefas e reuniões com setor, tipo, responsável e data. Tudo aparece ao mesmo tempo no dashboard, na agenda, no kanban e no planejamento anual, para todos que tiverem acesso.</p></div>
    <button class="btn pri" type="button" id="btnNew2">Cadastrar a primeira tarefa</button>
  </div>

  <div id="chBlank" class="blank" hidden>
    <div class="bi">${I.chamado}</div>
    <div class="bt"><h3 id="chBlankT">Nenhum chamado ainda</h3>
    <p id="chBlankP">Registre problemas, dúvidas, pedidos de acesso e melhorias dos sistemas da empresa. Você acompanha o andamento por aqui e conversa com o atendimento dentro do próprio chamado.</p></div>
    <button class="btn pri" type="button" id="btnCh2">Abrir chamado</button>
  </div>

  <section class="view" id="v-dashboard" hidden>
    <div id="chDash"></div>
    <div class="sec-h" id="tarH"><h2>Tarefas e reuniões</h2><span class="sub" id="tarHs"></span></div>
    <div class="hero" id="hero"></div>
    <div class="grid-d">
      <div class="panel c8"><div class="ph"><h2 class="h2">Evolução no período</h2><span class="sub" id="evoSub"></span></div><div class="chart" id="evo"></div>
        <div class="legend"><span><i class="sw" style="background:var(--line-2)"></i>Agendadas</span><span><i class="sw" style="background:var(--green-ink)"></i>Concluídas</span><span><i class="sw" style="background:var(--s-atraso)"></i>Atrasadas</span></div></div>
      <div class="panel c4"><div class="ph"><h2 class="h2">Status</h2><span class="sub" id="stSub"></span></div><div id="stBar"></div></div>
      <div class="panel c6"><div class="ph"><h2 class="h2">Por setor</h2><span class="sub">concluídas / total</span></div><div class="hbars" id="bySetor"></div></div>
      <div class="panel c6"><div class="ph"><h2 class="h2">Por tipo de tarefa</h2><span class="sub">concluídas / total</span></div><div class="hbars" id="byTipo"></div></div>
      <div class="panel c7"><div class="ph"><h2 class="h2">Desempenho por responsável</h2><span class="sub">clique para ver as tarefas</span></div><div class="tscroll" id="byResp"></div></div>
      <div class="panel c5"><div class="ph"><h2 class="h2">Próximos 7 dias</h2><span class="sub">pendentes</span></div><ul class="mini" id="next7"></ul></div>
      <div class="panel c12"><div class="ph"><h2 class="h2">Atrasadas</h2><span class="sub">data vencida e não concluída</span></div><ul class="mini late-grid" id="late"></ul></div>
    </div>
  </section>

  <section class="view" id="v-agenda" hidden>
    <div class="cal-bar">
      <div class="seg" id="calMode"><button data-m="mes" type="button">Mês</button><button data-m="semana" type="button">Semana</button></div>
      <div class="navp"><button id="cPrev" type="button" aria-label="Anterior">‹</button><span class="plabel" id="cLabel"></span><button id="cNext" type="button" aria-label="Próximo">›</button></div>
      <button class="btn" id="cToday" type="button">Hoje</button>
      <span class="sub">Clique num dia para agendar</span>
    </div>
    <div class="cal-scroll"><div class="cal" id="cal"></div></div>
  </section>

  <section class="view" id="v-kanban" hidden>
    <div class="kb-scroll"><div class="kb" id="kb"></div></div>
  </section>

  <section class="view" id="v-lista" hidden>
    <div class="panel">
      <div class="ph"><h2 class="h2" id="lsCount"></h2><button class="btn" id="btnCsv" type="button">${I.csv}Exportar CSV</button></div>
      <div class="tscroll" id="ls"></div>
    </div>
  </section>

  <section class="view" id="v-ano" hidden>
    <div class="panel">
      <div class="ph"><h2 class="h2" id="anoT">Tarefas por setor e mês</h2><span class="sub">Clique no número para abrir o mês na agenda</span></div>
      <div class="tscroll" id="heat"></div>
    </div>
  </section>

  <section class="view" id="v-fila" hidden>
    <div class="panel">
      <div class="ph"><h2 class="h2" id="filaCount"></h2><button class="btn" id="btnCsvCh" type="button">${I.csv}Exportar CSV</button></div>
      <div class="tscroll" id="fila"></div>
    </div>
  </section>

  <section class="view" id="v-kbch" hidden>
    <div class="kb-scroll"><div class="kb" id="kbch"></div></div>
  </section>

  <section class="view" id="v-meus" hidden>
    <div class="panel">
      <div class="ph"><h2 class="h2" id="meusCount"></h2><span class="sub">Clique no chamado para ver o andamento e conversar com o atendimento</span></div>
      <div class="tscroll" id="meus"></div>
    </div>
  </section>
</div>
</div>

<div class="ov" id="ov" hidden></div>
<div class="toast" id="toast" hidden></div>
<script src="/gp.js?v=${v}" defer></script>
</body></html>`;
}
