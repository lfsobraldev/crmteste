/** Tela de login na identidade visual da Gestão de Processos (grafite, verde, Nunito Sans e logotipo Famossul). */
export function paginaLogin(v: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Entrar · Gestão de Processos Famossul</title>
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,600;6..12,700;6..12,800;6..12,900&display=swap">
<link rel="stylesheet" href="/gp.css?v=${v}">
<style>
body{margin:0}
.lg{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr)}
.lg-a{background:var(--char);color:var(--on-char);padding:48px max(32px,env(safe-area-inset-left,0px));display:flex;flex-direction:column;justify-content:space-between;gap:32px;position:relative;overflow:hidden}
.lg-a::after{content:"";position:absolute;right:-90px;bottom:-60px;width:420px;height:420px;opacity:.06;background:var(--on-char);-webkit-mask:var(--logo) no-repeat 0 50%/auto 100%;mask:var(--logo) no-repeat 0 50%/auto 100%;pointer-events:none}
.lg-a .logo{width:190px}
.lg-a h1{font-size:34px;font-weight:900;letter-spacing:-.02em;line-height:1.1;margin:0 0 10px;max-width:16ch}
.lg-a p{color:var(--on-char-muted);margin:0;max-width:44ch;font-size:15px}
.lg-a ul{list-style:none;margin:22px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;color:var(--on-char-muted);font-weight:700;font-size:14px}
.lg-a li{display:flex;gap:10px;align-items:center}.lg-a li::before{content:"";width:18px;height:3px;border-radius:2px;background:var(--green)}
.lg-b{display:grid;place-items:center;padding:32px 16px;background:var(--bg)}
.lg-card{width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:28px;display:flex;flex-direction:column;gap:16px}
.lg-card h2{margin:0;font-size:22px;font-weight:900}
.lg-card .fld .inp{padding:11px 12px;font-size:15px;width:100%}
.lg-card .btn.pri{justify-content:center;padding:12px 14px;font-size:15px}
.lg-foot{font-size:12px;color:var(--faint)}
@media (max-width:820px){.lg{grid-template-columns:1fr}.lg-a{padding:28px 20px;gap:18px}.lg-a h1{font-size:24px}.lg-a ul{display:none}.lg-a .logo{width:140px}}
</style></head><body>
<div class="lg">
 <section class="lg-a">
  <div><span class="logo" role="img" aria-label="Famossul"></span><div class="side-sub">Gestão de Processos</div></div>
  <div><h1>Central de Chamados e Gestão de Processos</h1><p>Abra e acompanhe solicitações dos sistemas da empresa e organize tarefas, reuniões e o planejamento do setor.</p>
  <ul><li>Erros, melhorias, dúvidas e acessos</li><li>Fila, kanban e histórico de atendimento</li><li>Agenda e planejamento anual</li></ul></div>
  <div class="lg-foot" style="color:var(--on-char-muted)">Famossul</div>
 </section>
 <section class="lg-b">
  <form class="lg-card" id="lf" novalidate>
   <div><div class="eyebrow">Acesso</div><h2>Entrar</h2></div>
   <div class="fld"><label for="u">Usuário</label><input class="inp" id="u" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></div>
   <div class="fld"><label for="s">Senha</label><input class="inp" id="s" type="password" autocomplete="current-password" required></div>
   <div class="err" id="e" hidden></div>
   <button class="btn pri" id="b" type="submit">Entrar</button>
   <div class="lg-foot">Sem acesso ou esqueceu a senha? Fale com o administrador do sistema.</div>
  </form>
 </section>
</div>
<script src="/login.js?v=${v}" defer></script>
</body></html>`;
}
