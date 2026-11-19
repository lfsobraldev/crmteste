/* Gestão de Processos Famossul + Central de Chamados.
 * Interface do protótipo original preservada; os dados vêm da API própria (/api/*), com login,
 * banco PostgreSQL e permissões verificadas no servidor. Nada de dados no localStorage
 * (ele guarda só preferências de tela: período e modo do calendário). */
(function(){
"use strict";
/* ---------- Constantes ---------- */
const STATUS=[{id:"afazer",n:"A fazer"},{id:"andamento",n:"Em andamento"},{id:"aguardando",n:"Aguardando"},{id:"concluido",n:"Concluído"},{id:"cancelado",n:"Cancelado"}];
const SN=Object.fromEntries(STATUS.map(s=>[s.id,s.n]));
const PRIO=["Baixa","Média","Alta","Urgente"];
const DEF_LISTS={setores:[],tipos:[],jornadas:[],pessoas:[],sistemas:[]};
const REC=[["nao","Não repete"],["diaria","Diária (dias úteis)"],["semanal","Semanal"],["quinzenal","Quinzenal"],["mensal","Mensal"],["trimestral","Trimestral"],["anual","Anual"]];
const MESES=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const MES3=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DSEM=["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
/* Central de Chamados */
const CST=[{id:"novo",n:"Novos",u:"Novo"},{id:"triagem",n:"Em triagem",u:"Em triagem"},{id:"andamento",n:"Em andamento",u:"Em andamento"},{id:"aguardando",n:"Aguardando retorno",u:"Aguardando retorno"},{id:"concluido",n:"Concluídos",u:"Concluído"}];
const CSN=Object.fromEntries(CST.map(s=>[s.id,s.u]));
const CPRIO=["Baixa","Média","Alta","Crítica"];
const CTIPO=["Erro","Melhoria","Dúvida","Acesso","Nova funcionalidade"];
const ANEXO_MAX=3*1024*1024;
const ACCEPT=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xlsx,.pptx,.zip,.txt,.csv,.log,image/*";
const API="/api";

/* ---------- Datas ---------- */
const pad=n=>String(n).padStart(2,"0");
const iso=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parse=s=>{const p=String(s||"").split("-").map(Number);return new Date(p[0],(p[1]||1)-1,p[2]||1);};
const addD=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const addM=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth()+n,1);const last=new Date(x.getFullYear(),x.getMonth()+1,0).getDate();x.setDate(Math.min(d.getDate(),last));return x;};
const wkStart=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x;};
const fmtD=s=>{if(!s)return"";const d=parse(s);return pad(d.getDate())+"/"+pad(d.getMonth()+1);};
const fmtDY=s=>{if(!s)return"";const d=parse(s);return pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear();};
const fmtTS=s=>{if(!s)return"";const d=new Date(s);if(isNaN(d))return"";return pad(d.getDate())+"/"+pad(d.getMonth()+1)+"/"+d.getFullYear()+" "+pad(d.getHours())+":"+pad(d.getMinutes());};
const dayTS=s=>{if(!s)return"";const d=new Date(s);return isNaN(d)?"":iso(d);};
let TODAY=iso(new Date());
const mins=h=>{if(!h)return null;const [a,b]=h.split(":").map(Number);return a*60+(b||0);};

/* ---------- Utilidades ---------- */
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ini=n=>{const p=String(n||"").trim().split(/\s+/).filter(Boolean);return p.length?(p[0][0]+(p.length>1?p[p.length-1][0]:"")).toUpperCase():"–";};
const fmtN=n=>new Intl.NumberFormat("pt-BR").format(n);
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const kb=n=>n>=1048576?(String(Math.round(n/104857.6)/10).replace(".",",")+" MB"):(Math.max(1,Math.round(n/1024))+" KB");
const numCh=n=>"#"+String(n).padStart(4,"0");
function toast(msg){const t=$("toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>{t.hidden=true;},3200);}
const isLate=t=>t.status!=="concluido"&&t.status!=="cancelado"&&t.data&&t.data<TODAY;
const chLate=c=>c.status!=="concluido"&&!!c.prazo&&c.prazo<TODAY;
function uuid(){if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();const b=new Uint8Array(16);crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;const h=[...b].map(x=>x.toString(16).padStart(2,"0")).join("");return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);}

/* ---------- Estado ---------- */
const S={tasks:[],lists:JSON.parse(JSON.stringify(DEF_LISTS)),view:"",per:"mes",anchor:new Date(),de:TODAY,ate:TODAY,
  f:{setor:"",tipo:"",resp:"",status:"",prio:"",q:""},cal:{mode:"mes",cur:new Date()},sort:{k:"data",d:1},
  ch:[],cf:{sis:"",tipo:"",st:"",prio:"",resp:"",q:""},csort:{k:"numero",d:-1},
  me:null,atendentes:[],admin:false,ready:false,chReady:false,err:null};
try{const p=JSON.parse(localStorage.getItem("gpf-prefs")||"{}");if(p.per)S.per=p.per;if(p.cal)S.cal.mode=p.cal;}catch(e){}
function savePrefs(){try{localStorage.setItem("gpf-prefs",JSON.stringify({per:S.per,cal:S.cal.mode}));}catch(e){}}
const VIEWS_ADM=["dashboard","fila","kbch","agenda","kanban","lista","ano"],VIEWS_SOL=["meus"];
const CH_VIEWS=["fila","kbch","meus"];
const views=()=>S.admin?VIEWS_ADM:VIEWS_SOL;

/* ---------- API (login do ERP; erros tratados) ---------- */
class ApiErr extends Error{constructor(m,st,body){super(m);this.status=st;this.body=body||{};}}
async function api(path,opt){
  opt=opt||{};const method=opt.method||"GET";
  const init={method,credentials:"same-origin",headers:{}};
  if(opt.form){init.body=opt.form;}else if(opt.body!==undefined){init.headers["Content-Type"]="application/json";init.body=JSON.stringify(opt.body);}
  const tentativas=method==="GET"?2:1;let last;
  for(let i=0;i<tentativas;i++){
    const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),opt.timeout||25000);init.signal=ctl.signal;
    try{
      const r=await fetch(API+path,init);clearTimeout(to);
      const expirou=r.status===401||(r.redirected&&/\/login(\?|$)/.test(r.url));
      let j={};if(!expirou)try{j=await r.json();}catch(e){if(r.ok)throw new ApiErr("Resposta inesperada do servidor. Tente de novo.",r.status);}
      if(expirou){setSync("","Sessão expirada · entrando de novo…");location.href="/login?next="+encodeURIComponent("/"+location.hash);throw new ApiErr("Sessão expirada. Entre novamente.",401,j);}
      if(!r.ok)throw new ApiErr(j.error||("Falha na comunicação com o servidor ("+r.status+")."),r.status,j);
      return j;
    }catch(e){clearTimeout(to);last=e;if(e instanceof ApiErr)throw e;
      if(i+1<tentativas)await new Promise(r=>setTimeout(r,600+Math.random()*600));}
  }
  throw new ApiErr(last&&last.name==="AbortError"?"O servidor demorou para responder. Tente de novo.":"Sem conexão com o servidor. Verifique a internet e tente de novo.",0);
}
const errMsg=e=>(e&&e.message)||"Não foi possível salvar. Verifique a conexão e tente de novo.";

/* ---------- Carregamento ---------- */
async function loadTasks(){const r=await api("/tarefas");S.tasks=r.tarefas||[];S.ready=true;}
async function loadCh(){const r=await api("/chamados");S.ch=(r.chamados||[]);if(r.hoje)TODAY=r.hoje;S.chReady=true;}
async function reload(quiet){
  try{await Promise.all([loadCh(),S.admin?loadTasks():Promise.resolve()]);S.err=null;okSync();}
  catch(e){if(!quiet)toast(errMsg(e));setSync("","Sem conexão · tentando de novo");if(e.status===503||!S.chReady){S.err=e;}}
  render();
}
const plural=(n,um,varios)=>fmtN(n)+" "+(n===1?um:varios);
function okSync(){setSync("on",(S.admin?"Atendimento":"Solicitante")+" · "+plural(S.ch.length,"chamado","chamados")+(S.admin?" · "+plural(S.tasks.length,"tarefa","tarefas"):""));}

/* ---------- Período ---------- */
function range(){const a=S.anchor;switch(S.per){
  case"hoje":return[iso(a),iso(a)];
  case"semana":{const s=wkStart(a);return[iso(s),iso(addD(s,6))];}
  case"mes":return[iso(new Date(a.getFullYear(),a.getMonth(),1)),iso(new Date(a.getFullYear(),a.getMonth()+1,0))];
  case"trimestre":{const q=Math.floor(a.getMonth()/3)*3;return[iso(new Date(a.getFullYear(),q,1)),iso(new Date(a.getFullYear(),q+3,0))];}
  case"ano":return[a.getFullYear()+"-01-01",a.getFullYear()+"-12-31"];
  case"custom":return[S.de<=S.ate?S.de:S.ate,S.de<=S.ate?S.ate:S.de];
  default:return[null,null];}}
function perLabel(){const a=S.anchor;switch(S.per){
  case"hoje":return fmtDY(iso(a));
  case"semana":{const s=wkStart(a);return fmtD(iso(s))+" a "+fmtDY(iso(addD(s,6)));}
  case"mes":return MESES[a.getMonth()]+" "+a.getFullYear();
  case"trimestre":return(Math.floor(a.getMonth()/3)+1)+"º tri "+a.getFullYear();
  case"ano":return"Ano "+a.getFullYear();
  case"custom":{const r=range();return fmtDY(r[0])+" a "+fmtDY(r[1]);}
  default:return"Todo o histórico";}}
function shift(dir){const a=S.anchor;switch(S.per){
  case"hoje":S.anchor=addD(a,dir);break;case"semana":S.anchor=addD(a,7*dir);break;
  case"mes":S.anchor=addM(a,dir);break;case"trimestre":S.anchor=addM(a,3*dir);break;
  case"ano":S.anchor=new Date(a.getFullYear()+dir,a.getMonth(),1);break;}render();}

/* ---------- Filtro de tarefas ---------- */
function passF(t){const f=S.f;
  if(f.setor&&t.setor!==f.setor)return false;
  if(f.tipo&&t.tipo!==f.tipo)return false;
  if(f.resp&&t.responsavel!==f.resp)return false;
  if(f.prio&&t.prioridade!==f.prio)return false;
  if(f.status){if(f.status==="atrasada"){if(!isLate(t))return false;}else if(t.status!==f.status)return false;}
  if(f.q){const q=f.q.toLowerCase();const h=[t.titulo,t.descricao,t.responsavel,t.solicitante,t.setor,t.tipo].join(" ").toLowerCase();if(h.indexOf(q)<0)return false;}
  return true;}
function inRange(t,r){if(!r[0])return true;return t.data>=r[0]&&t.data<=r[1];}
const visible=()=>{const r=range();return S.tasks.filter(t=>passF(t)&&inRange(t,r));};
const byDate=(a,b)=>(a.data||"").localeCompare(b.data||"")||(a.horaIni||"99").localeCompare(b.horaIni||"99");

/* ---------- Filtro de chamados ---------- */
function passC(c){const f=S.cf;
  if(f.sis&&c.sistema!==f.sis)return false;
  if(f.tipo&&c.tipo!==f.tipo)return false;
  if(f.prio&&c.prioridade!==f.prio)return false;
  if(f.st){if(f.st==="abertos"){if(c.status==="concluido")return false;}else if(f.st==="atrasados"){if(!chLate(c))return false;}else if(c.status!==f.st)return false;}
  if(f.resp){if(f.resp==="__sem"){if(c.responsavel_usuario)return false;}else if(f.resp==="__eu"){if(!S.me||c.responsavel_usuario!==S.me.usuario)return false;}else if(c.responsavel_usuario!==f.resp)return false;}
  if(f.q){const q=f.q.toLowerCase().replace(/^#0*/,"");const h=[c.numero,numCh(c.numero),c.titulo,c.sistema,c.tipo,c.solicitante_nome,c.responsavel_nome].join(" ").toLowerCase();if(h.indexOf(q)<0)return false;}
  return true;}
const visCh=()=>S.ch.filter(passC);

/* ---------- Selects ---------- */
function people(){const s=new Set(S.lists.pessoas||[]);S.tasks.forEach(t=>{if(t.responsavel)s.add(t.responsavel);if(t.solicitante)s.add(t.solicitante);});return[...s].sort((a,b)=>a.localeCompare(b,"pt-BR"));}
function fillSel(el,opts,first,val){el.innerHTML=(first?'<option value="">'+esc(first)+"</option>":"")+opts.map(o=>{const v=Array.isArray(o)?o[0]:o,n=Array.isArray(o)?o[1]:o;return'<option value="'+esc(v)+'"'+(v===val?" selected":"")+">"+esc(n)+"</option>";}).join("");}
function withExtra(list,key){const s=new Set(list);S.tasks.forEach(t=>{if(t[key])s.add(t[key]);});return[...s];}
function renderFilters(){
  fillSel($("fSetor"),withExtra(S.lists.setores,"setor"),"Todos os setores",S.f.setor);
  fillSel($("fTipo"),withExtra(S.lists.tipos,"tipo"),"Todos os tipos",S.f.tipo);
  fillSel($("fResp"),people(),"Todos os responsáveis",S.f.resp);
  fillSel($("fStatus"),STATUS.map(s=>[s.id,s.n]).concat([["atrasada","Atrasadas"]]),"Todos os status",S.f.status);
  fillSel($("fPrio"),PRIO,"Todas as prioridades",S.f.prio);
  [["fSetor","setor"],["fTipo","tipo"],["fResp","resp"],["fStatus","status"],["fPrio","prio"]].forEach(([i,k])=>$(i).classList.toggle("on",!!S.f[k]));
  $("fClear").hidden=!Object.values(S.f).some(Boolean);
  document.querySelectorAll("#perSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.p===S.per));
  $("pLabel").textContent=perLabel();
  const nav=S.per!=="tudo"&&S.per!=="custom";$("pPrev").disabled=!nav;$("pNext").disabled=!nav;$("pPrev").style.opacity=$("pNext").style.opacity=nav?1:.35;
  $("fCust").hidden=S.per!=="custom";$("fDe").value=S.de;$("fAte").value=S.ate;
}
function renderCFilters(){
  const sis=new Set(S.lists.sistemas||[]);S.ch.forEach(c=>sis.add(c.sistema));
  fillSel($("cSis"),[...sis],"Todos os sistemas",S.cf.sis);
  fillSel($("cTipo"),CTIPO,"Todos os tipos",S.cf.tipo);
  fillSel($("cSt"),[["abertos","Em aberto (não concluídos)"]].concat(CST.map(s=>[s.id,s.u])).concat([["atrasados","Atrasados"]]),"Todos os status",S.cf.st);
  fillSel($("cPrio"),CPRIO,"Todas as prioridades",S.cf.prio);
  $("cResp").hidden=!S.admin;
  if(S.admin){const r=new Map(S.atendentes.map(a=>[a.usuario,a.nome]));S.ch.forEach(c=>{if(c.responsavel_usuario&&!r.has(c.responsavel_usuario))r.set(c.responsavel_usuario,c.responsavel_nome||c.responsavel_usuario);});
    fillSel($("cResp"),[["__eu","Comigo"],["__sem","Sem responsável"]].concat([...r.entries()].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"))),"Todos os responsáveis",S.cf.resp);}
  [["cSis","sis"],["cTipo","tipo"],["cSt","st"],["cPrio","prio"],["cResp","resp"]].forEach(([i,k])=>$(i).classList.toggle("on",!!S.cf[k]));
  $("cClear").hidden=!Object.values(S.cf).some(Boolean);
}

/* ---------- Render geral ---------- */
const VT={dashboard:["Painel de desempenho","Dashboard"],agenda:["Calendário de tarefas e reuniões","Agenda"],kanban:["Fluxo de trabalho","Kanban"],lista:["Consulta e exportação","Lista de tarefas"],ano:["Visão do ano por setor","Planejamento anual"],
  fila:["Central de chamados","Fila de atendimento"],kbch:["Central de chamados","Kanban de chamados"],meus:["Central de chamados","Meus chamados"]};
function render(){
  if(!S.me){return;}
  const V=S.view,isCh=CH_VIEWS.indexOf(V)>=0;
  document.querySelectorAll(".nav-i").forEach(b=>{b.hidden=views().indexOf(b.dataset.v)<0;if(b.dataset.v===V)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
  $("navTar").hidden=!S.admin;
  $("vEye").textContent=VT[V][0];$("vTitle").textContent=VT[V][1];
  const abertos=S.ch.filter(c=>c.status!=="concluido").length;
  $("vSub").textContent=isCh?(fmtN(visCh().length)+" de "+plural(S.ch.length,"chamado","chamados")+" · "+fmtN(abertos)+" em aberto"):V==="agenda"?"Filtros de setor, tipo, responsável e status valem também no calendário":V==="ano"?"Ano "+S.anchor.getFullYear():perLabel()+" · "+fmtN(visible().length)+" tarefas";
  $("pctl").hidden=V==="agenda"||isCh;
  $("tfil").hidden=isCh;$("cfil").hidden=!isCh;
  if(isCh)renderCFilters();else renderFilters();
  const nl=S.tasks.filter(isLate).length;$("navLate").hidden=!nl;$("navLate").textContent=nl;
  const nn=S.ch.filter(c=>c.status==="novo").length;$("navNovos").hidden=!nn;$("navNovos").textContent=nn;
  const na=S.ch.filter(c=>c.status==="aguardando").length;$("navAguard").hidden=!(na&&!S.admin);$("navAguard").textContent=na;
  Object.keys(VT).forEach(v=>$("v-"+v).hidden=v!==V||!!S.err);
  $("erro").hidden=!S.err;if(S.err){$("erroT").textContent=S.err.status===503?"Banco ainda não preparado":"Não foi possível carregar";$("erroM").textContent=S.err.message;}
  $("blank").hidden=!!S.err||isCh||!(S.ready&&S.tasks.length===0);
  $("chBlank").hidden=!!S.err||!(V==="meus"&&S.chReady&&S.ch.length===0);
  $("btnNew").hidden=!S.admin;$("btnCfg").hidden=!S.admin;
  if(S.err)return;
  ({dashboard:rDash,agenda:rAgenda,kanban:rKanban,lista:rLista,ano:rAno,fila:rFila,kbch:rKbCh,meus:rMeus})[V]();
}

/* ---------- Dashboard ---------- */
function stCount(arr){const c={afazer:0,andamento:0,aguardando:0,concluido:0,cancelado:0};arr.forEach(t=>{c[t.status]=(c[t.status]||0)+1;});return c;}
function rDash(){
  rChDash();
  $("tarHs").textContent=perLabel();
  const v=visible();const c=stCount(v);const ativos=v.filter(t=>t.status!=="cancelado");const late=v.filter(isLate);
  const taxa=pct(c.concluido,ativos.length);
  const reun=v.filter(t=>/reuni/i.test(t.tipo||"")).length;
  let hrs=0;v.forEach(t=>{const a=mins(t.horaIni),b=mins(t.horaFim);if(a!=null&&b!=null&&b>a)hrs+=b-a;});
  const hrsT=Math.round(hrs/6)/10;
  const C=2*Math.PI*48,off=C*(1-Math.min(100,taxa)/100);
  const st=[
    {l:"Tarefas no período",v:fmtN(v.length),d:fmtN(c.concluido)+" concluídas"},
    {l:"Em andamento",v:fmtN(c.andamento),d:fmtN(c.aguardando)+" aguardando · "+fmtN(c.afazer)+" a fazer"},
    {l:"Atrasadas",v:fmtN(late.length),d:late.length?"exigem ação":"nenhuma vencida",cls:late.length?"alert":"good"},
    {l:"Reuniões",v:fmtN(reun),d:"agendadas no período"},
    {l:"Horas agendadas",v:String(hrsT).replace(".",","),u:"h",d:"soma de início a fim"}];
  $("hero").innerHTML='<div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="Taxa de conclusão '+fmtN(taxa)+'%"><circle cx="60" cy="60" r="48" fill="none" stroke="var(--char-line)" stroke-width="12"/><circle cx="60" cy="60" r="48" fill="none" stroke="var(--green)" stroke-width="12" stroke-linecap="round" stroke-dasharray="'+C.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle" fill="var(--on-char)" font-family="Nunito Sans,sans-serif" font-size="26" font-weight="900">'+fmtN(Math.round(taxa))+'%</text><text x="60" y="78" text-anchor="middle" fill="var(--on-char-muted)" font-family="Nunito Sans,sans-serif" font-size="10.5" font-weight="700">concluídas</text></svg><div><div class="rl">Taxa de conclusão</div><div class="rv">'+fmtN(c.concluido)+' de '+fmtN(ativos.length)+' tarefas ativas em '+esc(perLabel())+'</div></div></div><div class="hstats">'+st.map(x=>'<div class="hs '+(x.cls||"")+'"><div class="l">'+esc(x.l)+'</div><div class="v">'+esc(x.v)+(x.u?"<small>"+x.u+"</small>":"")+'</div><div class="d">'+esc(x.d)+'</div></div>').join("")+'</div>';
  const tot=v.length||1;
  $("stSub").textContent=fmtN(v.length)+" tarefas";
  $("stBar").innerHTML='<div class="stack">'+(v.length?STATUS.map(s=>c[s.id]?'<i style="width:'+(c[s.id]/tot*100)+'%;background:var(--s-'+s.id+')" title="'+esc(s.n)+'"></i>':"").join(""):"")+'</div><div class="sgrid">'+STATUS.map(s=>'<span class="sitem"><i class="sw" style="background:var(--s-'+s.id+')"></i>'+esc(s.n)+"<b>"+fmtN(c[s.id])+"</b></span>").join("")+'<span class="sitem"><i class="sw" style="background:var(--s-atraso)"></i>Atrasadas<b>'+fmtN(late.length)+"</b></span></div>"+(()=>{const pc={};PRIO.forEach(x=>pc[x]=0);v.forEach(t=>{if(t.prioridade in pc&&t.status!=="concluido"&&t.status!=="cancelado")pc[t.prioridade]++;});const mx=Math.max(1,...Object.values(pc));return'<div class="ph" style="margin:22px 0 10px"><h3 class="h2" style="font-size:13.5px">Pendentes por prioridade</h3></div><div class="hbars">'+PRIO.slice().reverse().map(x=>'<div class="hb"><span class="n prio '+x+'">'+x+'</span><span class="tw"><span class="t" style="width:'+(pc[x]/mx*100)+'%;background:currentColor"><i style="flex:1;background:var(--'+({Urgente:"s-atraso",Alta:"s-aguardando","Média":"blue",Baixa:"faint"})[x]+')"></i></span></span><span class="x"><b>'+pc[x]+'</b></span></div>').join("")+'</div>';})();
  $("bySetor").innerHTML=hbars(v,"setor");$("byTipo").innerHTML=hbars(v,"tipo");
  const g={};v.forEach(t=>{const k=t.responsavel||"Sem responsável";(g[k]=g[k]||{t:0,c:0,a:0,l:0,x:0});g[k].t++;if(t.status==="concluido")g[k].c++;if(t.status==="andamento")g[k].a++;if(isLate(t))g[k].l++;if(t.status==="cancelado")g[k].x++;});
  const rows=Object.entries(g).sort((a,b)=>b[1].t-a[1].t);
  $("byResp").innerHTML=rows.length?'<table class="t"><thead><tr><th>Responsável</th><th class="rt">Total</th><th class="rt">Em and.</th><th class="rt">Atras.</th><th>Conclusão</th></tr></thead><tbody>'+rows.map(([n,o])=>{const p=pct(o.c,o.t-o.x);return'<tr class="r" data-resp="'+esc(n)+'"><td><span class="av">'+esc(ini(n))+"</span> "+esc(n)+'</td><td class="rt num">'+o.t+'</td><td class="rt num">'+o.a+'</td><td class="rt num" style="color:'+(o.l?"var(--s-atraso)":"inherit")+'">'+o.l+'</td><td><span class="pbar"><i style="width:'+p+'%"></i></span><span class="num">'+fmtN(p)+"%</span></td></tr>";}).join("")+"</tbody></table>":'<div class="empty">Sem tarefas no período.</div>';
  const lim=iso(addD(parse(TODAY),7));
  const nx=S.tasks.filter(t=>passF(t)&&t.data>=TODAY&&t.data<=lim&&t.status!=="concluido"&&t.status!=="cancelado").sort(byDate).slice(0,12);
  $("next7").innerHTML=nx.length?nx.map(mini).join(""):'<li class="empty" style="cursor:default">Nada pendente nos próximos 7 dias.</li>';
  const lt=S.tasks.filter(t=>passF(t)&&isLate(t)).sort(byDate).slice(0,20);
  $("late").innerHTML=lt.length?lt.map(mini).join(""):'<li class="empty" style="cursor:default">Nenhuma tarefa atrasada.</li>';
  evo(v);
}
/* Indicadores da Central de Chamados (situação atual, sem filtros de tarefas) */
function rChDash(){
  const a=S.ch,cnt=s=>a.filter(c=>c.status===s).length;
  const late=a.filter(chLate).length,conc=cnt("concluido");
  const d30=iso(addD(parse(TODAY),-30));const conc30=a.filter(c=>c.status==="concluido"&&dayTS(c.concluido_em)>=d30).length;
  const k=[
    {l:"Novos",v:cnt("novo"),d:fmtN(cnt("triagem"))+" em triagem",f:{st:"novo"}},
    {l:"Em andamento",v:cnt("andamento"),d:"em atendimento",f:{st:"andamento"}},
    {l:"Aguardando retorno",v:cnt("aguardando"),d:"do solicitante",f:{st:"aguardando"}},
    {l:"Atrasados",v:late,d:late?"prazo vencido":"nenhum vencido",cls:late?"alert":"",f:{st:"atrasados"}},
    {l:"Concluídos",v:conc,d:fmtN(conc30)+" nos últimos 30 dias",f:{st:"concluido"}}];
  const ab=a.filter(c=>c.status!=="concluido");
  const hb=(key,order)=>{const g={};ab.forEach(c=>{const x=c[key]||"Não informado";(g[x]=g[x]||{t:0,l:0,n:0});g[x].t++;if(chLate(c))g[x].l++;if(c.status==="novo")g[x].n++;});
    let e=Object.entries(g);e=order?order.slice().reverse().filter(x=>g[x]).map(x=>[x,g[x]]):e.sort((x,y)=>y[1].t-x[1].t);
    if(!e.length)return'<div class="empty">Nenhum chamado em aberto.</div>';const mx=Math.max(...e.map(x=>x[1].t));
    return e.map(([n,o])=>'<div class="hb" data-cf="'+esc(key)+'" data-cv="'+esc(n)+'" style="cursor:pointer"><span class="n'+(order?" prio "+esc(n):"")+'" title="'+esc(n)+'">'+esc(n)+'</span><span class="tw"><span class="t" style="width:'+(o.t/mx*100)+'%"><i style="width:'+(o.l/o.t*100)+'%;background:var(--s-atraso)"></i><i style="width:'+(o.n/o.t*100)+'%;background:var(--s-novo)"></i><i style="flex:1;background:var(--s-andamento)"></i></span></span><span class="x num"><b>'+o.t+"</b></span></div>").join("");};
  $("chDash").innerHTML='<div class="sec-h"><h2>Central de chamados</h2><span class="sub">situação atual · clique para abrir na fila</span></div>'+
    '<div class="kpis">'+k.map(x=>'<button type="button" class="kpi '+(x.cls||"")+'" data-kst="'+x.f.st+'"><div class="l">'+esc(x.l)+'</div><div class="v">'+fmtN(x.v)+'</div><div class="d">'+esc(x.d)+"</div></button>").join("")+"</div>"+
    '<div class="grid-d"><div class="panel c6"><div class="ph"><h2 class="h2">Demandas em aberto por sistema</h2><span class="sub">'+fmtN(ab.length)+' em aberto</span></div><div class="hbars">'+hb("sistema")+'</div></div>'+
    '<div class="panel c6"><div class="ph"><h2 class="h2">Demandas em aberto por prioridade</h2><span class="sub">em aberto</span></div><div class="hbars">'+hb("prioridade",CPRIO)+'</div>'+
    '<div class="legend"><span><i class="sw" style="background:var(--s-atraso)"></i>Atrasados</span><span><i class="sw" style="background:var(--s-novo)"></i>Novos</span><span><i class="sw" style="background:var(--s-andamento)"></i>Em atendimento</span></div></div></div>';
  $("tarH").classList.add("sec-gap");
}
function hbars(v,key){const g={};v.forEach(t=>{const k=t[key]||"Não informado";(g[k]=g[k]||{t:0,c:0,l:0});g[k].t++;if(t.status==="concluido")g[k].c++;if(isLate(t))g[k].l++;});
  const e=Object.entries(g).sort((a,b)=>b[1].t-a[1].t);if(!e.length)return'<div class="empty">Sem tarefas no período.</div>';
  const max=e[0][1].t;
  return e.map(([n,o])=>'<div class="hb"><span class="n" title="'+esc(n)+'">'+esc(n)+'</span><span class="tw"><span class="t" style="width:'+(o.t/max*100)+'%"><i style="width:'+(o.c/o.t*100)+'%;background:var(--green-ink)"></i><i style="width:'+(o.l/o.t*100)+'%;background:var(--s-atraso)"></i><i style="flex:1;background:var(--line-2)"></i></span></span><span class="x num"><b>'+o.c+"</b>/"+o.t+"</span></div>").join("");}
function mini(t){const late=isLate(t);return'<li data-id="'+esc(t.id)+'"><span class="dt">'+DSEM[(parse(t.data).getDay()+6)%7]+"<b>"+parse(t.data).getDate()+"</b>"+MES3[parse(t.data).getMonth()]+'</span><div><div class="tt">'+esc(t.titulo)+'</div><div class="mm">'+esc([t.horaIni?(t.horaIni+(t.horaFim?"–"+t.horaFim:"")):"",t.setor,t.tipo,t.responsavel].filter(Boolean).join(" · "))+"</div></div>"+(late?'<span class="pill p-atraso">Atrasada</span>':'<span class="pill p-'+esc(t.status)+'">'+esc(SN[t.status]||"")+"</span>")+"</li>";}
function evo(v){
  const r=range();let a=r[0],b=r[1];
  if(!a){if(!v.length){$("evo").innerHTML='<div class="empty">Sem tarefas.</div>';$("evoSub").textContent="";return;}const ds=v.map(t=>t.data).sort();a=ds[0];b=ds[ds.length-1];}
  const days=Math.round((parse(b)-parse(a))/864e5)+1;
  let unit=days>62?"m":days>14?"w":"d";const buckets=[];
  if(unit==="d"){for(let d=parse(a);iso(d)<=b;d=addD(d,1))buckets.push({k:iso(d),l:fmtD(iso(d)),s:iso(d),e:iso(d)});}
  else if(unit==="w"){for(let d=wkStart(parse(a));iso(d)<=b;d=addD(d,7))buckets.push({l:fmtD(iso(d)),s:iso(d),e:iso(addD(d,6))});}
  else{let d=new Date(parse(a).getFullYear(),parse(a).getMonth(),1);while(iso(d)<=b){buckets.push({l:MES3[d.getMonth()]+(days>400?"/"+String(d.getFullYear()).slice(2):""),s:iso(d),e:iso(new Date(d.getFullYear(),d.getMonth()+1,0))});d=new Date(d.getFullYear(),d.getMonth()+1,1);}}
  if(buckets.length>40){$("evo").innerHTML='<div class="empty">Período longo demais para o gráfico; escolha mês, trimestre ou ano.</div>';return;}
  buckets.forEach(k=>{const x=v.filter(t=>t.data>=k.s&&t.data<=k.e&&t.status!=="cancelado");k.t=x.length;k.c=x.filter(t=>t.status==="concluido").length;k.lt=x.filter(isLate).length;});
  $("evoSub").textContent=unit==="d"?"por dia":unit==="w"?"por semana (início seg.)":"por mês";
  const W=640,H=220,L=34,R=8,T=12,B=26,iw=W-L-R,ih=H-T-B;
  const mx=Math.max(1,...buckets.map(k=>k.t));const step=mx<=5?1:mx<=10?2:mx<=25?5:mx<=50?10:Math.ceil(mx/5/10)*10;const top=Math.ceil(mx/step)*step;
  const y=n=>T+ih-(n/top)*ih;const bw=iw/buckets.length;const w=Math.max(2,Math.min(28,bw*.62));
  let s='<svg viewBox="0 0 '+W+" "+H+'" role="img" aria-label="Tarefas agendadas e concluídas por período">';
  for(let n=0;n<=top;n+=step)s+='<line class="gl" x1="'+L+'" x2="'+(W-R)+'" y1="'+y(n)+'" y2="'+y(n)+'"/><text x="'+(L-6)+'" y="'+(y(n)+3)+'" text-anchor="end">'+n+"</text>";
  const every=Math.ceil(buckets.length/12);
  buckets.forEach((k,i)=>{const cx=L+bw*i+bw/2,x=cx-w/2;
    if(k.t)s+='<rect x="'+x+'" y="'+y(k.t)+'" width="'+w+'" height="'+(y(0)-y(k.t))+'" rx="2" fill="var(--line-2)"><title>'+esc(k.l)+": "+k.t+" agendadas, "+k.c+" concluídas, "+k.lt+" atrasadas</title></rect>";
    if(k.c)s+='<rect x="'+x+'" y="'+y(k.c)+'" width="'+w+'" height="'+(y(0)-y(k.c))+'" rx="2" fill="var(--green-ink)"/>';
    if(k.lt)s+='<rect x="'+x+'" y="'+y(k.c+k.lt)+'" width="'+w+'" height="'+(y(k.c)-y(k.c+k.lt))+'" fill="var(--s-atraso)"/>';
    if(i%every===0)s+='<text x="'+cx+'" y="'+(H-8)+'" text-anchor="middle">'+esc(k.l)+"</text>";});
  s+="</svg>";$("evo").innerHTML=s;}

/* ---------- Agenda ---------- */
function rAgenda(){
  document.querySelectorAll("#calMode button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===S.cal.mode));
  const cur=S.cal.cur;let start,end,wk=S.cal.mode==="semana";
  if(wk){start=wkStart(cur);end=addD(start,6);$("cLabel").textContent=fmtD(iso(start))+" a "+fmtDY(iso(end));}
  else{const f=new Date(cur.getFullYear(),cur.getMonth(),1);start=wkStart(f);const l=new Date(cur.getFullYear(),cur.getMonth()+1,0);end=addD(wkStart(l),6);$("cLabel").textContent=MESES[cur.getMonth()]+" "+cur.getFullYear();}
  const items=S.tasks.filter(passF);const map={};items.forEach(t=>{(map[t.data]=map[t.data]||[]).push(t);});
  let h=DSEM.map(d=>'<div class="dh">'+d+"</div>").join("");
  for(let d=new Date(start);iso(d)<=iso(end);d=addD(d,1)){const k=iso(d);const arr=(map[k]||[]).sort(byDate);const out=!wk&&d.getMonth()!==cur.getMonth();
    const lim=wk?50:3;
    h+='<div class="dc'+(out?" out":"")+((d.getDay()===0||d.getDay()===6)?" wkend":"")+(k===TODAY?" today":"")+(wk?" wk":"")+'" data-day="'+k+'"><span class="dn">'+(wk?DSEM[(d.getDay()+6)%7]+" ":"")+d.getDate()+"</span>"+
      arr.slice(0,lim).map(t=>'<button type="button" class="ev s-'+esc(t.status)+(isLate(t)?" late":"")+'" data-id="'+esc(t.id)+'" title="'+esc(t.titulo+(t.responsavel?" · "+t.responsavel:""))+'">'+(t.horaIni?'<span class="h">'+esc(t.horaIni)+"</span>":"")+esc(t.titulo)+"</button>").join("")+
      (arr.length>lim?'<button type="button" class="more" data-week="'+k+'">+'+(arr.length-lim)+" ver semana</button>":"")+"</div>";}
  $("cal").innerHTML=h;}

/* ---------- Kanban de tarefas ---------- */
function rKanban(){const v=visible();
  $("kb").innerHTML=STATUS.map(s=>{const arr=v.filter(t=>t.status===s.id).sort(byDate);
    return'<div class="col" data-st="'+s.id+'"><div class="col-h" style="border-bottom-color:var(--s-'+s.id+')"><b>'+esc(s.n)+'</b><span class="num">'+arr.length+"</span></div>"+
    (arr.length?arr.map(card).join(""):'<div class="empty" style="text-align:center">Sem tarefas</div>')+"</div>";}).join("");}
function card(t){const late=isLate(t);return'<div class="card'+(late?" late":"")+'" draggable="true" data-id="'+esc(t.id)+'"><div class="ct">'+esc(t.titulo)+'</div><div class="cm">'+[t.setor,t.tipo,t.jornada].filter(Boolean).map(x=>'<span class="chip">'+esc(x)+"</span>").join("")+'</div><div class="cf"><span class="num">'+fmtD(t.data)+(t.horaIni?" · "+esc(t.horaIni):"")+(late?' <b style="color:var(--s-atraso)">atrasada</b>':"")+'</span><span style="display:flex;gap:6px;align-items:center">'+(t.prioridade?'<span class="prio '+esc(t.prioridade)+'">'+esc(t.prioridade)+"</span>":"")+(t.responsavel?'<span class="av" title="'+esc(t.responsavel)+'">'+esc(ini(t.responsavel))+"</span>":"")+"</span></div></div>";}

/* ---------- Lista de tarefas ---------- */
const COLS=[["data","Data"],["horaIni","Hora"],["titulo","Título"],["tipo","Tipo"],["setor","Setor"],["jornada","Jornada"],["responsavel","Responsável"],["prioridade","Prioridade"],["status","Status"]];
function sorted(v){const k=S.sort.k,d=S.sort.d;const pr=x=>PRIO.indexOf(x);return v.slice().sort((a,b)=>{let x=a[k]||"",y=b[k]||"";if(k==="prioridade"){x=pr(x);y=pr(y);return(x-y)*d||byDate(a,b);}if(k==="status"){x=STATUS.findIndex(s=>s.id===x);y=STATUS.findIndex(s=>s.id===y);return(x-y)*d||byDate(a,b);}return String(x).localeCompare(String(y),"pt-BR")*d||byDate(a,b);});}
function rLista(){const v=sorted(visible());$("lsCount").textContent=fmtN(v.length)+(v.length===1?" tarefa":" tarefas")+" · "+perLabel();
  $("ls").innerHTML=v.length?'<table class="t"><thead><tr>'+COLS.map(c=>'<th class="s" data-k="'+c[0]+'">'+c[1]+(S.sort.k===c[0]?(S.sort.d>0?" ↑":" ↓"):"")+"</th>").join("")+"</tr></thead><tbody>"+
  v.map(t=>'<tr class="r" data-id="'+esc(t.id)+'"><td class="num">'+fmtDY(t.data)+'</td><td class="num">'+esc(t.horaIni?(t.horaIni+(t.horaFim?"–"+t.horaFim:"")):"")+'</td><td style="font-weight:600;min-width:200px">'+esc(t.titulo)+"</td><td>"+esc(t.tipo)+"</td><td>"+esc(t.setor)+"</td><td>"+esc(t.jornada)+"</td><td>"+esc(t.responsavel)+'</td><td><span class="prio '+esc(t.prioridade)+'">'+esc(t.prioridade)+"</span></td><td>"+(isLate(t)?'<span class="pill p-atraso">Atrasada</span>':'<span class="pill p-'+esc(t.status)+'">'+esc(SN[t.status]||"")+"</span>")+"</td></tr>").join("")+"</tbody></table>":'<div class="empty">Nenhuma tarefa com esses filtros.</div>';}

/* ---------- Ano ---------- */
function rAno(){const y=S.anchor.getFullYear();$("anoT").textContent="Tarefas por setor e mês · "+y;
  const v=S.tasks.filter(t=>passF(t)&&t.data&&t.data.slice(0,4)===String(y));
  const set=withExtra(S.lists.setores,"setor");const g={};v.forEach(t=>{const k=t.setor||"Não informado";const m=Number(t.data.slice(5,7))-1;(g[k]=g[k]||Array(12).fill(0))[m]++;});
  const rows=set.filter(s=>g[s]).concat(Object.keys(g).filter(k=>set.indexOf(k)<0));
  const mx=Math.max(1,...Object.values(g).flat());const tm=Array(12).fill(0);
  const cell=(n,m)=>{const a=n?0.12+0.78*(n/mx):0;return'<td class="hc'+(n?"":" z")+'" data-m="'+m+'" style="'+(n?"background:color-mix(in srgb, var(--green-ink) "+Math.round(a*100)+"%, var(--surface));color:"+(a>.5?"#fff":"var(--ink)"):"")+'">'+(n||"·")+"</td>";};
  let h='<table class="t heat"><thead><tr><th>Setor</th>'+MES3.map(m=>'<th class="m">'+m+"</th>").join("")+'<th class="rt">Total</th></tr></thead><tbody>';
  rows.forEach(s=>{const a=g[s];a.forEach((n,i)=>tm[i]+=n);h+="<tr><td style=\"font-weight:600;white-space:nowrap\">"+esc(s)+"</td>"+a.map(cell).join("")+'<td class="rt num">'+a.reduce((x,z)=>x+z,0)+"</td></tr>";});
  h+='<tr class="tot"><td>Total</td>'+tm.map((n,i)=>'<td class="hc'+(n?"":" z")+'" data-m="'+i+'">'+(n||"·")+"</td>").join("")+'<td class="rt num" style="font-weight:700">'+tm.reduce((x,z)=>x+z,0)+"</td></tr></tbody></table>";
  $("heat").innerHTML=rows.length?h:'<div class="empty">Nenhuma tarefa programada em '+y+" com esses filtros.</div>";}

/* ---------- Fila de atendimento / Meus chamados ---------- */
const CCOLS_ADM=[["numero","Nº"],["titulo","Título"],["sistema","Sistema"],["solicitante_nome","Solicitante"],["responsavel_nome","Responsável"],["prioridade","Prioridade"],["criado_em","Abertura"],["prazo","Prazo"],["status","Status"]];
const CCOLS_SOL=[["numero","Nº"],["titulo","Título"],["sistema","Sistema"],["tipo","Tipo"],["responsavel_nome","Responsável"],["prioridade","Prioridade"],["criado_em","Abertura"],["prazo","Prazo"],["status","Status"]];
function csorted(v){const k=S.csort.k,d=S.csort.d;return v.slice().sort((a,b)=>{let x=a[k],y=b[k];
  if(k==="numero")return(a.numero-b.numero)*d;
  if(k==="prioridade"){x=CPRIO.indexOf(x);y=CPRIO.indexOf(y);return(x-y)*d||(b.numero-a.numero);}
  if(k==="status"){x=CST.findIndex(s=>s.id===x);y=CST.findIndex(s=>s.id===y);return(x-y)*d||(b.numero-a.numero);}
  if(k==="prazo"){if(!x&&!y)return b.numero-a.numero;if(!x)return 1;if(!y)return -1;}
  return String(x||"").localeCompare(String(y||""),"pt-BR")*d||(b.numero-a.numero);});}
function stPill(c){return chLate(c)?'<span class="pill p-'+esc(c.status)+'">'+esc(CSN[c.status]||"")+'</span> <span class="pill p-atraso">Atrasado</span>':'<span class="pill p-'+esc(c.status)+'">'+esc(CSN[c.status]||"")+"</span>";}
function chTable(v,cols){
  return'<table class="t"><thead><tr>'+cols.map(c=>'<th class="s" data-ck="'+c[0]+'">'+c[1]+(S.csort.k===c[0]?(S.csort.d>0?" ↑":" ↓"):"")+"</th>").join("")+"</tr></thead><tbody>"+
  v.map(c=>'<tr class="r" data-ch="'+esc(c.id)+'">'+cols.map(([k])=>{
    if(k==="numero")return'<td class="ch-num">'+numCh(c.numero)+"</td>";
    if(k==="titulo")return'<td style="font-weight:700;min-width:220px">'+esc(c.titulo)+(c.comentarios||c.anexos?'<div class="sub" style="font-weight:600">'+[c.comentarios?fmtN(c.comentarios)+(c.comentarios===1?" comentário":" comentários"):"",c.anexos?fmtN(c.anexos)+(c.anexos===1?" anexo":" anexos"):""].filter(Boolean).join(" · ")+"</div>":"")+"</td>";
    if(k==="sistema")return'<td><span class="chip">'+esc(c.sistema)+"</span></td>";
    if(k==="solicitante_nome")return"<td>"+esc(c.solicitante_nome||c.solicitante_usuario)+"</td>";
    if(k==="responsavel_nome")return"<td>"+(c.responsavel_nome?'<span class="av">'+esc(ini(c.responsavel_nome))+"</span> "+esc(c.responsavel_nome):'<span class="sub">—</span>')+"</td>";
    if(k==="prioridade")return'<td><span class="prio '+esc(c.prioridade)+'">'+esc(c.prioridade)+"</span></td>";
    if(k==="criado_em")return'<td class="num" style="white-space:nowrap">'+fmtTS(c.criado_em)+"</td>";
    if(k==="prazo")return'<td class="num" style="white-space:nowrap'+(chLate(c)?";color:var(--s-atraso);font-weight:800":"")+'">'+(c.prazo?fmtDY(c.prazo):'<span class="sub">—</span>')+"</td>";
    if(k==="status")return'<td style="white-space:nowrap">'+stPill(c)+"</td>";
    return"<td>"+esc(c[k])+"</td>";}).join("")+"</tr>").join("")+"</tbody></table>";}
function rFila(){const v=csorted(visCh());$("filaCount").textContent=fmtN(v.length)+(v.length===1?" chamado":" chamados");
  $("fila").innerHTML=!S.chReady?'<div class="empty">Carregando…</div>':v.length?chTable(v,CCOLS_ADM):'<div class="empty">'+(S.ch.length?"Nenhum chamado com esses filtros.":"Nenhum chamado recebido ainda.")+"</div>";}
function rMeus(){const v=csorted(visCh());$("meusCount").textContent=fmtN(v.length)+(v.length===1?" chamado":" chamados");
  $("v-meus").hidden=S.chReady&&S.ch.length===0;
  $("meus").innerHTML=!S.chReady?'<div class="empty">Carregando…</div>':v.length?chTable(v,CCOLS_SOL):'<div class="empty">Nenhum chamado com esses filtros.</div>';}

/* ---------- Kanban de chamados ---------- */
function rKbCh(){const v=visCh();
  $("kbch").innerHTML=CST.map(s=>{const arr=v.filter(c=>c.status===s.id).sort((a,b)=>CPRIO.indexOf(b.prioridade)-CPRIO.indexOf(a.prioridade)||a.numero-b.numero);
    return'<div class="col" data-cst="'+s.id+'"><div class="col-h" style="border-bottom-color:var(--s-'+s.id+')"><b>'+esc(s.n)+'</b><span class="num">'+arr.length+"</span></div>"+
    (arr.length?arr.map(chCard).join(""):'<div class="empty" style="text-align:center">Sem chamados</div>')+"</div>";}).join("");}
function chCard(c){const late=chLate(c);return'<div class="card'+(late?" late":"")+'" draggable="true" data-ch="'+esc(c.id)+'"><div class="ct"><span class="ch-num">'+numCh(c.numero)+"</span> "+esc(c.titulo)+'</div><div class="cm"><span class="chip">'+esc(c.sistema)+'</span><span class="chip">'+esc(c.tipo)+'</span></div><div class="cf"><span class="num">'+(c.prazo?"Prazo "+fmtD(c.prazo):"Aberto "+fmtD(dayTS(c.criado_em)))+(late?' <b style="color:var(--s-atraso)">atrasado</b>':"")+'</span><span style="display:flex;gap:6px;align-items:center"><span class="prio '+esc(c.prioridade)+'">'+esc(c.prioridade)+"</span>"+(c.responsavel_nome?'<span class="av" title="'+esc(c.responsavel_nome)+'">'+esc(ini(c.responsavel_nome))+"</span>":'<span class="av" title="Sem responsável" style="background:var(--line-2);color:var(--muted)">?</span>')+"</span></div></div>";}

/* ---------- Modal de tarefa ---------- */
function opt(list,val,blank){const l=list.slice();if(val&&l.indexOf(val)<0)l.push(val);return(blank?'<option value="">'+blank+"</option>":"")+l.map(x=>'<option'+(x===val?" selected":"")+">"+esc(x)+"</option>").join("");}
function openTask(id,preset){
  if(!S.admin)return;
  const t=id?S.tasks.find(x=>x.id===id):null;if(id&&!t)return;
  const d=t||Object.assign({titulo:"",tipo:"",setor:"",jornada:"",prioridade:"Média",status:"afazer",data:TODAY,horaIni:"",horaFim:"",solicitante:"",responsavel:"",descricao:""},preset||{});
  const yEnd=parse(d.data||TODAY).getFullYear()+"-12-31";
  const pl=people();const chave=uuid();
  $("ov").innerHTML='<form class="modal" id="tf" novalidate><div class="m-h"><h3>'+(t?"Editar tarefa":"Nova tarefa")+'</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b">'+
   '<div class="fld s6"><label for="t-titulo">Título *</label><input class="inp" id="t-titulo" required maxlength="140" value="'+esc(d.titulo)+'" placeholder="Ex.: Reunião de indicadores com representantes"></div>'+
   '<div class="fld s2"><label for="t-tipo">Tipo</label><select class="sel" id="t-tipo">'+opt(S.lists.tipos,d.tipo,"—")+"</select></div>"+
   '<div class="fld s2"><label for="t-setor">Setor</label><select class="sel" id="t-setor">'+opt(S.lists.setores,d.setor,"—")+"</select></div>"+
   '<div class="fld s2"><label for="t-jornada">Jornada</label><select class="sel" id="t-jornada">'+opt(S.lists.jornadas,d.jornada,"—")+"</select></div>"+
   '<div class="fld s2"><label for="t-data">Data *</label><input class="inp" type="date" id="t-data" required value="'+esc(d.data)+'"></div>'+
   '<div class="fld s2"><label for="t-hi">Início</label><input class="inp" type="time" id="t-hi" value="'+esc(d.horaIni)+'"></div>'+
   '<div class="fld s2"><label for="t-hf">Fim</label><input class="inp" type="time" id="t-hf" value="'+esc(d.horaFim)+'"></div>'+
   '<div class="fld s3"><label for="t-resp">Responsável</label><input class="inp" id="t-resp" list="dl-p" maxlength="80" value="'+esc(d.responsavel)+'"></div>'+
   '<div class="fld s3"><label for="t-sol">Solicitante</label><input class="inp" id="t-sol" list="dl-p" maxlength="80" value="'+esc(d.solicitante)+'"></div>'+
   '<datalist id="dl-p">'+pl.map(p=>"<option value=\""+esc(p)+"\">").join("")+"</datalist>"+
   '<div class="fld s3"><label for="t-prio">Prioridade</label><select class="sel" id="t-prio">'+opt(PRIO,d.prioridade)+"</select></div>"+
   '<div class="fld s3"><label for="t-st">Status</label><select class="sel" id="t-st">'+STATUS.map(s=>'<option value="'+s.id+'"'+(s.id===d.status?" selected":"")+">"+s.n+"</option>").join("")+"</select></div>"+
   '<div class="fld s6"><label for="t-desc">Descrição / pauta</label><textarea class="inp" id="t-desc" maxlength="4000">'+esc(d.descricao)+"</textarea></div>"+
   (!t?'<div class="s6 rec"><div class="fld"><label for="t-rec">Repetir</label><select class="sel" id="t-rec">'+REC.map(r=>'<option value="'+r[0]+'">'+r[1]+"</option>").join("")+'</select></div><div class="fld"><label for="t-ate">Repetir até</label><input class="inp" type="date" id="t-ate" value="'+yEnd+'"></div></div>':"")+
   (t&&t.serie?'<label class="chk s6"><input type="checkbox" id="t-all"> Aplicar a esta e às próximas ocorrências da série (exceto status)</label>':"")+
   '<div class="s6 err" id="t-err" hidden></div>'+
   (t&&t.criadoEm?'<div class="s6 meta-l">Criada em '+esc(fmtDY(dayTS(t.criadoEm)))+(t.atualizadoEm?" · atualizada em "+esc(fmtDY(dayTS(t.atualizadoEm))):"")+"</div>":"")+
   '</div><div class="m-f">'+(t?'<button type="button" class="btn danger" id="t-del">Excluir</button>'+(t.serie?'<button type="button" class="btn danger" id="t-delS">Excluir esta e as próximas</button>':""):"")+'<span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn pri" id="t-save">'+(t?"Salvar alterações":"Agendar")+"</button></div></form>";
  $("ov").hidden=false;setTimeout(()=>{const f=$("t-titulo");if(f)f.focus();},30);
  const form=$("tf");
  form.addEventListener("submit",async e=>{e.preventDefault();
    const g=id=>$(id).value.trim();
    const data={titulo:g("t-titulo"),tipo:g("t-tipo"),setor:g("t-setor"),jornada:g("t-jornada"),data:g("t-data"),horaIni:g("t-hi"),horaFim:g("t-hf"),responsavel:g("t-resp"),solicitante:g("t-sol"),prioridade:g("t-prio"),status:g("t-st"),descricao:$("t-desc").value.trim()};
    const er=$("t-err");const fail=m=>{er.textContent=m;er.hidden=false;};
    if(!data.titulo||!data.data)return fail("Preencha o título e a data.");
    if(data.horaIni&&data.horaFim&&data.horaFim<=data.horaIni)return fail("O horário de fim precisa ser depois do início.");
    const btn=$("t-save");btn.disabled=true;btn.textContent="Salvando…";
    try{
      if(t){const all=$("t-all")&&$("t-all").checked;
        const r=await api("/tarefas",{method:"PATCH",body:{id:t.id,dados:data,serie:!!all}});
        toast(r.alteradas>1?r.alteradas+" ocorrências atualizadas":"Tarefa atualizada");
      }else{
        const rec=$("t-rec").value,ate=$("t-ate").value||data.data;
        const n=recur(data.data,rec,ate).length;
        if(n>370){btn.disabled=false;btn.textContent="Agendar";return fail("Repetição gera "+n+" ocorrências; reduza a data final (máx. 370).");}
        const r=await api("/tarefas",{method:"POST",body:{chave,dados:data,recorrencia:rec,ate}});
        toast(r.total>1?r.total+" ocorrências agendadas":"Tarefa agendada");
      }
      closeOv();await reload(true);
    }catch(ex){fail(errMsg(ex));btn.disabled=false;btn.textContent=t?"Salvar alterações":"Agendar";}
  });
  const arm=(b,fn)=>b&&b.addEventListener("click",async()=>{if(!b.classList.contains("armed")){b.classList.add("armed");b.dataset.o=b.textContent;b.textContent="Confirmar exclusão";return;}b.disabled=true;try{await fn();closeOv();await reload(true);}catch(ex){$("t-err").textContent=errMsg(ex);$("t-err").hidden=false;b.disabled=false;}});
  if(t){arm($("t-del"),async()=>{await api("/tarefas?id="+encodeURIComponent(t.id),{method:"DELETE"});toast("Tarefa excluída");});
    arm($("t-delS"),async()=>{const r=await api("/tarefas?serie=1&id="+encodeURIComponent(t.id),{method:"DELETE"});toast(r.excluidas+" ocorrências excluídas");});}
}
function recur(start,rec,ate){const out=[start];if(rec==="nao")return out;const end=ate<start?start:ate;let d=parse(start);const s0=parse(start);let i=1;
  while(out.length<1000){let n;
    if(rec==="diaria"){d=addD(d,1);while(d.getDay()===0||d.getDay()===6)d=addD(d,1);n=d;}
    else if(rec==="semanal")n=addD(s0,7*i);else if(rec==="quinzenal")n=addD(s0,14*i);
    else if(rec==="mensal")n=addM(s0,i);else if(rec==="trimestral")n=addM(s0,3*i);else if(rec==="anual")n=addM(s0,12*i);
    i++;const k=iso(n);if(k>end)break;out.push(k);}
  return out;}
let ovDirty=false;
function closeOv(force){if(!force&&ovDirty&&!confirmDescartar())return;ovDirty=false;$("ov").hidden=true;$("ov").innerHTML="";if(/^#chamado=/.test(location.hash))try{history.replaceState(null,"","#"+S.view);}catch(x){}}
function confirmDescartar(){const b=$("ov").querySelector("[data-dirty-warn]");if(b&&!b.hidden)return true;if(b){b.hidden=false;return false;}return true;}

/* ---------- Abrir chamado ---------- */
function filePicker(listId,files){const ul=$(listId);ul.innerHTML=files.map((f,i)=>'<li class="'+(f.size>ANEXO_MAX?"bad":"")+'" title="'+esc(f.name)+'"><span>'+esc(f.name)+" · "+kb(f.size)+(f.size>ANEXO_MAX?" (acima de 3 MB)":"")+'</span><button type="button" data-rmf="'+i+'" aria-label="Remover '+esc(f.name)+'">✕</button></li>').join("");}
function openNovoChamado(){
  const chave=uuid();let files=[];
  $("ov").innerHTML='<form class="modal" id="nf" novalidate><div class="m-h"><h3>Abrir chamado</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b">'+
   '<div class="fld s6"><label for="n-tit">Título da solicitação *</label><input class="inp" id="n-tit" required minlength="5" maxlength="140" placeholder="Ex.: Erro ao salvar o apontamento da Usinagem"></div>'+
   '<div class="fld s3"><label for="n-sis">Sistema relacionado *</label><select class="sel" id="n-sis" required>'+opt(S.lists.sistemas,"","Selecione…")+"</select></div>"+
   '<div class="fld s3"><label for="n-tipo">Tipo de solicitação *</label><select class="sel" id="n-tipo" required>'+opt(CTIPO,"","Selecione…")+"</select></div>"+
   '<div class="fld s2"><label for="n-prio">Prioridade *</label><select class="sel" id="n-prio">'+opt(CPRIO,"Média")+"</select></div>"+
   '<div class="fld s2"><label for="n-sol">Solicitante</label><input class="inp" id="n-sol" readonly value="'+esc(S.me.nome)+'"></div>'+
   '<div class="fld s2"><label for="n-dt">Data de abertura</label><input class="inp" id="n-dt" readonly value="'+esc(fmtDY(TODAY))+'"></div>'+
   '<div class="fld s6"><label for="n-desc">Descrição detalhada *</label><textarea class="inp" id="n-desc" rows="6" minlength="10" maxlength="8000" placeholder="O que aconteceu, em qual tela ou menu, o passo a passo para repetir, a mensagem de erro (se houver) e o resultado esperado."></textarea><span class="meta-l"><span id="n-cnt">0</span>/8.000 · Crítica = sistema parado ou operação bloqueada.</span></div>'+
   '<div class="fld s6"><label for="n-arq">Anexos (prints e arquivos)</label><input class="inp" type="file" id="n-arq" multiple accept="'+ACCEPT+'"><span class="meta-l">Até 3 MB por arquivo: imagens, PDF, Word, Excel, PowerPoint, ZIP, TXT ou CSV.</span><ul class="picked" id="n-files"></ul></div>'+
   '<div class="s6 err" id="n-err" hidden></div>'+
   '<div class="s6 note warn" data-dirty-warn hidden>Há dados preenchidos. Clique em fechar de novo para descartar.</div>'+
   '</div><div class="m-f"><span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn pri" id="n-save">Abrir chamado</button></div></form>';
  $("ov").hidden=false;ovDirty=false;setTimeout(()=>{const f=$("n-tit");if(f)f.focus();},30);
  const form=$("nf");
  form.addEventListener("input",()=>{ovDirty=true;$("n-cnt").textContent=fmtN($("n-desc").value.length);});
  $("n-arq").addEventListener("change",e=>{files=files.concat([...e.target.files]).slice(0,10);e.target.value="";filePicker("n-files",files);ovDirty=true;});
  $("n-files").addEventListener("click",e=>{const b=e.target.closest("[data-rmf]");if(!b)return;files.splice(Number(b.dataset.rmf),1);filePicker("n-files",files);});
  form.addEventListener("submit",async e=>{e.preventDefault();
    const body={chave,titulo:$("n-tit").value.trim(),sistema:$("n-sis").value,tipo:$("n-tipo").value,prioridade:$("n-prio").value,descricao:$("n-desc").value.trim()};
    const er=$("n-err");const fail=m=>{er.textContent=m;er.hidden=false;};er.hidden=true;
    if(body.titulo.length<5)return fail("Informe um título com pelo menos 5 caracteres.");
    if(!body.sistema)return fail("Selecione o sistema relacionado.");
    if(!body.tipo)return fail("Selecione o tipo de solicitação.");
    if(body.descricao.length<10)return fail("Descreva a solicitação com pelo menos 10 caracteres.");
    if(files.some(f=>f.size>ANEXO_MAX))return fail("Remova os arquivos acima de 3 MB (marcados em vermelho).");
    const btn=$("n-save");btn.disabled=true;btn.textContent="Abrindo…";
    let r;
    try{r=await api("/chamados",{method:"POST",body});}
    catch(ex){btn.disabled=false;btn.textContent="Abrir chamado";return fail(errMsg(ex));}
    const falhas=await enviarAnexos(r.id,files,(i,n)=>{btn.textContent="Enviando anexo "+i+"/"+n+"…";});
    ovDirty=false;closeOv(true);toast("Chamado "+numCh(r.numero)+" aberto"+(falhas.length?" · "+falhas.length+" anexo(s) não enviado(s)":""));
    await reload(true);openChamado(r.id,falhas);
  });
}
async function enviarAnexos(chamadoId,files,prog){const falhas=[];
  for(let i=0;i<files.length;i++){if(prog)prog(i+1,files.length);const fd=new FormData();fd.append("chamadoId",chamadoId);fd.append("arquivo",files[i],files[i].name);
    try{await api("/chamados/anexos",{method:"POST",form:fd,timeout:60000});}catch(e){const m=errMsg(e);falhas.push(m.indexOf(files[i].name)>=0?m:files[i].name+": "+m);}}
  return falhas;}

/* ---------- Detalhe do chamado ---------- */
const EVN={status:"Status",prioridade:"Prioridade",responsavel:"Responsável",prazo:"Prazo",sistema:"Sistema",tipo:"Tipo"};
function evTxt(e){
  if(e.tipo==="abertura")return"<b>"+esc(e.autor_nome)+"</b> abriu o chamado";
  if(e.tipo==="comentario")return"<b>"+esc(e.autor_nome)+"</b> comentou";
  if(e.tipo==="anexo")return"<b>"+esc(e.autor_nome)+"</b> anexou "+esc(e.texto);
  const v=x=>e.tipo==="status"?(CSN[x]||x):e.tipo==="prazo"?(x?fmtDY(x):"sem prazo"):(x||"ninguém");
  return"<b>"+esc(e.autor_nome)+"</b> alterou "+esc((EVN[e.tipo]||e.tipo).toLowerCase())+": "+esc(v(e.de))+" → <b>"+esc(v(e.para))+"</b>";}
async function openChamado(id,avisos){
  $("ov").innerHTML='<div class="modal wide"><div class="m-h"><h3>Chamado</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b" style="display:block"><div class="empty">Carregando…</div></div></div>';
  $("ov").hidden=false;ovDirty=false;
  try{history.replaceState(null,"","#chamado="+id);}catch(x){}
  let d;
  try{d=await api("/chamados?id="+encodeURIComponent(id));}
  catch(e){$("ov").querySelector(".m-b").innerHTML='<div class="note bad">'+esc(errMsg(e))+'</div>';return;}
  if(d.hoje)TODAY=d.hoje;
  const c=d.chamado,mine=S.me.usuario;
  const ix=S.ch.findIndex(x=>x.id===c.id);if(ix>=0)S.ch[ix]=Object.assign({},S.ch[ix],c,{comentarios:d.eventos.filter(e=>e.tipo==="comentario").length,anexos:d.anexos.length});
  const coms=d.eventos.filter(e=>e.tipo==="comentario");
  const fim=c.status==="concluido"?d.eventos.filter(e=>e.tipo==="status"&&e.para==="concluido").pop():null;
  const ats=S.atendentes.slice();if(c.responsavel_usuario&&!ats.some(a=>a.usuario===c.responsavel_usuario))ats.push({usuario:c.responsavel_usuario,nome:c.responsavel_nome||c.responsavel_usuario});
  const side=S.admin?
    '<div><h4>Atendimento</h4><form class="side-form" id="cf-at" novalidate>'+
      '<div class="fld"><label for="a-st">Status</label><select class="sel" id="a-st">'+CST.map(s=>'<option value="'+s.id+'"'+(s.id===c.status?" selected":"")+">"+esc(s.u)+"</option>").join("")+"</select></div>"+
      '<div class="fld"><label for="a-pr">Prioridade</label><select class="sel" id="a-pr">'+opt(CPRIO,c.prioridade)+"</select></div>"+
      '<div class="fld s2f"><label for="a-rs">Responsável</label><select class="sel" id="a-rs"><option value="">— Sem responsável —</option>'+ats.map(a=>'<option value="'+esc(a.usuario)+'"'+(a.usuario===c.responsavel_usuario?" selected":"")+">"+esc(a.nome)+"</option>").join("")+"</select>"+
        (c.responsavel_usuario!==mine&&S.atendentes.some(a=>a.usuario===mine)?'<button type="button" class="f-clear" id="a-eu" style="align-self:flex-start;padding:2px 0">Assumir eu mesmo</button>':"")+"</div>"+
      '<div class="fld"><label for="a-pz">Prazo</label><input class="inp" type="date" id="a-pz" value="'+esc(c.prazo||"")+'"></div>'+
      '<div class="fld"><label for="a-tp">Tipo</label><select class="sel" id="a-tp">'+opt(CTIPO,c.tipo)+"</select></div>"+
      '<div class="fld s2f"><label for="a-ss">Sistema</label><select class="sel" id="a-ss">'+opt(S.lists.sistemas,c.sistema)+"</select></div>"+
      '<div class="fld s2f"><label for="a-cm">Comentário da alteração (opcional, visível ao solicitante)</label><textarea class="inp" id="a-cm" rows="2" maxlength="8000" placeholder="Ex.: Corrigido na versão de hoje; confira e nos avise."></textarea></div>'+
      '<div class="s2f err" id="a-err" hidden></div>'+
      '<div class="s2f" style="display:flex;justify-content:flex-end"><button type="submit" class="btn pri" id="a-save">Salvar alterações</button></div>'+
    "</form></div>"
    :'<div><h4>Andamento</h4><dl class="kv"><dt>Status</dt><dd>'+stPill(c)+"</dd><dt>Prioridade</dt><dd><span class=\"prio "+esc(c.prioridade)+'">'+esc(c.prioridade)+"</span></dd><dt>Responsável</dt><dd>"+esc(c.responsavel_nome||"Aguardando definição")+"</dd><dt>Prazo</dt><dd>"+(c.prazo?fmtDY(c.prazo):"Não definido")+"</dd><dt>Atualizado</dt><dd>"+fmtTS(c.atualizado_em)+"</dd>"+(c.concluido_em?"<dt>Concluído</dt><dd>"+fmtTS(c.concluido_em)+"</dd>":"")+"</dl></div>";
  const hist='<div><h4>Histórico de alterações</h4><ul class="hist">'+d.eventos.slice().reverse().map(e=>'<li><span class="num">'+fmtTS(e.criado_em)+"</span> · "+evTxt(e)+"</li>").join("")+"</ul></div>";
  $("ov").innerHTML='<div class="modal wide" role="dialog" aria-modal="true" aria-labelledby="ch-ttl"><div class="m-h"><h3>Chamado '+numCh(c.numero)+'</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div>'+
   '<div class="chd"><div class="chd-main">'+
    (avisos&&avisos.length?'<div class="note bad">Alguns anexos não foram enviados: '+esc(avisos.map(x=>x.replace(/\.$/,"")).join(" · "))+". Anexe de novo abaixo.</div>":"")+
    '<div><h2 class="ttl" id="ch-ttl">'+esc(c.titulo)+'</h2><div class="tags">'+stPill(c)+' <span class="prio '+esc(c.prioridade)+'">'+esc(c.prioridade)+'</span><span class="chip">'+esc(c.sistema)+'</span><span class="chip">'+esc(c.tipo)+'</span></div>'+
    '<div class="meta-l" style="margin-top:8px">Aberto por <b>'+esc(c.solicitante_nome||c.solicitante_usuario)+"</b> em "+fmtTS(c.criado_em)+(c.responsavel_nome?" · responsável: <b>"+esc(c.responsavel_nome)+"</b>":"")+"</div></div>"+
    (c.status==="concluido"?'<div class="note ok">Solicitação concluída em '+fmtTS(c.concluido_em)+(fim?" por "+esc(fim.autor_nome):"")+". Se o problema continuar, comente abaixo"+(S.admin?"":" que o atendimento é avisado pela fila")+".</div>":
     c.status==="aguardando"&&!S.admin?'<div class="note warn">O atendimento está aguardando o seu retorno. Responda na comunicação abaixo.</div>':"")+
    '<div><h4>Descrição</h4><div class="desc">'+esc(c.descricao)+"</div></div>"+
    '<div><h4>Arquivos anexados ('+d.anexos.length+')</h4>'+(d.anexos.length?'<ul class="files">'+d.anexos.map(a=>'<li><a href="'+API+"/chamados/anexos?id="+esc(a.id)+'" target="_blank" rel="noopener">'+esc(a.nome)+'</a><span class="sub">'+kb(a.tamanho)+" · "+esc(a.enviado_nome||a.enviado_por)+" · "+fmtTS(a.criado_em)+"</span></li>").join("")+"</ul>":'<div class="empty" style="padding:2px 0">Nenhum arquivo.</div>')+"</div>"+
    '<div><h4>Comunicação</h4><div class="thread">'+(coms.length?coms.map(e=>'<div class="msg'+(e.autor_usuario===mine?" mine":"")+'"><div class="mh"><span class="av">'+esc(ini(e.autor_nome))+"</span><b>"+esc(e.autor_nome)+"</b>"+(e.autor_usuario===c.solicitante_usuario?"<span>solicitante</span>":"<span>atendimento</span>")+'<span class="num">'+fmtTS(e.criado_em)+'</span></div><div class="mt">'+esc(e.texto)+"</div></div>").join(""):'<div class="empty" style="padding:2px 0">Nenhuma mensagem ainda. Use o campo abaixo para trocar informações sem abrir outro chamado.</div>')+"</div>"+
    '<form class="compose" id="cf-msg" novalidate style="margin-top:10px"><textarea class="inp" id="m-txt" rows="3" maxlength="8000" placeholder="'+(S.admin?"Escreva uma atualização ou pergunta para o solicitante…":"Escreva uma informação complementar ou responda ao atendimento…")+'"></textarea>'+
    '<div class="row"><label class="btn" for="m-arq" style="cursor:pointer">Anexar arquivos</label><input type="file" id="m-arq" multiple accept="'+ACCEPT+'" hidden><span class="sp"></span><button type="submit" class="btn pri" id="m-send">Enviar</button></div>'+
    '<ul class="picked" id="m-files"></ul><div class="err" id="m-err" hidden></div>'+
    '<div class="note warn" data-dirty-warn hidden>Há uma mensagem não enviada. Clique em fechar de novo para descartar.</div></form></div>'+
   '</div><aside class="chd-side">'+side+hist+"</aside></div></div>";
  let files=[];
  $("m-txt").addEventListener("input",()=>{ovDirty=!!$("m-txt").value.trim()||files.length>0;});
  $("m-arq").addEventListener("change",e=>{files=files.concat([...e.target.files]).slice(0,10);e.target.value="";filePicker("m-files",files);ovDirty=true;});
  $("m-files").addEventListener("click",e=>{const b=e.target.closest("[data-rmf]");if(!b)return;files.splice(Number(b.dataset.rmf),1);filePicker("m-files",files);});
  $("cf-msg").addEventListener("submit",async e=>{e.preventDefault();const txt=$("m-txt").value.trim();const er=$("m-err");er.hidden=true;
    if(!txt&&!files.length){er.textContent="Escreva a mensagem ou escolha um arquivo.";er.hidden=false;return;}
    if(files.some(f=>f.size>ANEXO_MAX)){er.textContent="Remova os arquivos acima de 3 MB (marcados em vermelho).";er.hidden=false;return;}
    const b=$("m-send");b.disabled=true;b.textContent="Enviando…";
    try{if(txt)await api("/chamados/comentarios",{method:"POST",body:{id:c.id,texto:txt}});}
    catch(ex){b.disabled=false;b.textContent="Enviar";er.textContent=errMsg(ex);er.hidden=false;return;}
    const falhas=await enviarAnexos(c.id,files,(i,n)=>{b.textContent="Enviando anexo "+i+"/"+n+"…";});
    ovDirty=false;toast(falhas.length?"Enviado com falhas nos anexos":"Mensagem enviada");await reload(true);openChamado(c.id,falhas);});
  if(S.admin){
    const f=$("cf-at");
    f.addEventListener("input",()=>{ovDirty=true;});
    const eu=$("a-eu");if(eu)eu.onclick=()=>{$("a-rs").value=mine;if($("a-st").value==="novo")$("a-st").value="triagem";ovDirty=true;};
    f.addEventListener("submit",async e=>{e.preventDefault();const er=$("a-err");er.hidden=true;
      const body={id:c.id,versao:c.versao,status:$("a-st").value,prioridade:$("a-pr").value,responsavel_usuario:$("a-rs").value,prazo:$("a-pz").value,tipo:$("a-tp").value,sistema:$("a-ss").value,comentario:$("a-cm").value.trim()};
      const b=$("a-save");b.disabled=true;b.textContent="Salvando…";
      try{const r=await api("/chamados",{method:"PATCH",body});ovDirty=false;toast(r.semAlteracao?"Nada foi alterado":"Chamado "+numCh(c.numero)+" atualizado");await reload(true);openChamado(c.id);}
      catch(ex){b.disabled=false;b.textContent="Salvar alterações";er.textContent=errMsg(ex);er.hidden=false;if(ex.status===409){await reload(true);setTimeout(()=>{ovDirty=false;openChamado(c.id);toast(errMsg(ex));},50);}}});
  }
}

/* ---------- Cadastros ---------- */
function openCfg(){const L=S.lists;const ta=(id,lab,arr,hint)=>'<div class="fld s3"><label for="'+id+'">'+lab+'</label><textarea class="inp" id="'+id+'" rows="7">'+esc((arr||[]).join("\n"))+'</textarea><span class="meta-l">'+hint+"</span></div>";
  $("ov").innerHTML='<form class="modal" id="cf"><div class="m-h"><h3>Cadastros</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b">'+
  ta("c-sis","Sistemas (Central de Chamados)",L.sistemas,"Um por linha. Aparecem em Abrir chamado.")+
  (S.super?'<div class="fld s3"><label>Usuários e perfis</label><ul class="att-list" id="c-us"><li><span class="sub">Carregando…</span></li></ul><div><button type="button" class="btn" id="c-usb">Gerenciar usuários</button></div><span class="meta-l">Administrador gerencia usuários. Atendente vê todos os chamados e faz a triagem. Solicitante abre e acompanha os próprios chamados.</span></div>':'')+
  ta("c-set","Setores",L.setores,"Um por linha")+ta("c-tip","Tipos de tarefa",L.tipos,"Um por linha")+ta("c-jor","Jornadas",L.jornadas,"Ex.: Manhã, Tarde, Dia inteiro")+ta("c-pes","Pessoas (sugestão de responsável)",L.pessoas,"Um nome por linha")+
  '<div class="fld s6"><label for="c-imp">Importar tarefas do protótipo (dados-tarefas.json)</label><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="inp" type="file" id="c-imp" accept=".json,application/json" style="flex:1;min-width:0"><button type="button" class="btn" id="c-impb">Importar</button></div><span class="meta-l" id="c-impr">Tarefas já importadas (mesmo id) são ignoradas; não há duplicação.</span></div>'+
  '<div class="s6 err" id="c-err" hidden></div></div><div class="m-f"><span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn pri">Salvar cadastros</button></div></form>';
  $("ov").hidden=false;ovDirty=false;
  const err=m=>{$("c-err").textContent=m;$("c-err").hidden=false;};
  if(S.super){api("/usuarios").then(r=>{const us=r.usuarios||[];const at=us.filter(u=>u.ativo);const n=p=>at.filter(u=>u.papel===p).length;
    $("c-us").innerHTML='<li><span><b>'+fmtN(n("admin"))+'</b> admin · <b>'+fmtN(n("atendente"))+'</b> atendente(s) · <b>'+fmtN(n("solicitante"))+'</b> solicitante(s)'+(us.length>at.length?' · '+fmtN(us.length-at.length)+' bloqueado(s)':'')+"</span></li>";}).catch(e=>{$("c-us").innerHTML='<li><span class="err">'+esc(errMsg(e))+"</span></li>";});
  $("c-usb").onclick=()=>{if(ovDirty&&!confirmDescartar())return;ovDirty=false;openUsuarios();};}
  $("c-impb").onclick=async()=>{const f=$("c-imp").files[0];if(!f)return err("Escolha o arquivo dados-tarefas.json.");
    let j;try{j=JSON.parse(await f.text());}catch(x){return err("O arquivo não é um JSON válido.");}
    const b=$("c-impb");b.disabled=true;b.textContent="Importando…";
    try{const r=await api("/tarefas/importar",{method:"POST",body:j,timeout:60000});$("c-impr").textContent=fmtN(r.inseridas)+" tarefa(s) importada(s) · "+fmtN(r.jaExistiam)+" já existiam"+(r.invalidas.length?" · "+r.invalidas.length+" inválida(s): "+r.invalidas.slice(0,5).join(", "):"");await reload(true);}
    catch(x){err(errMsg(x));}finally{b.disabled=false;b.textContent="Importar";}};
  $("cf").addEventListener("input",e=>{if(e.target.tagName==="TEXTAREA")ovDirty=true;});
  $("cf").addEventListener("submit",async e=>{e.preventDefault();const sp=id=>[...new Set($(id).value.split("\n").map(x=>x.trim()).filter(Boolean))];
    const l={setores:sp("c-set"),tipos:sp("c-tip"),jornadas:sp("c-jor"),pessoas:sp("c-pes"),sistemas:sp("c-sis")};
    if(!l.sistemas.length)return err("Cadastre pelo menos um sistema para a Central de Chamados.");
    try{const r=await api("/listas",{method:"PUT",body:l});S.lists=r.listas;ovDirty=false;toast("Cadastros salvos");closeOv(true);render();}catch(ex){err(errMsg(ex));}});
}

/* ---------- Usuários (somente Administrador) ---------- */
const PAPEL={admin:"Administrador",atendente:"Atendente",solicitante:"Solicitante"};
const PAPEL_D={admin:"tudo, inclusive usuários e níveis de acesso",atendente:"todos os chamados, triagem, tarefas e cadastros",solicitante:"abre e acompanha os próprios chamados"};
const SIT={ativo:["Ativo","p-concluido"],pendente:["Aguardando ativação","p-aguardando"],bloqueado:["Bloqueado","p-cancelado"],travado:["Travado (tentativas)","p-atraso"]};
const sitU=u=>!u.ativo?"bloqueado":!u.senha_definida?"pendente":u.bloqueado_ate?"travado":"ativo";
let usFiltro="";
async function openUsuarios(){
  $("ov").innerHTML='<div class="modal"><div class="m-h"><h3>Usuários</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b" style="display:block"><div class="empty">Carregando…</div></div></div>';$("ov").hidden=false;ovDirty=false;
  let r;try{r=await api("/usuarios");}catch(e){$("ov").querySelector(".m-b").innerHTML='<div class="note bad">'+esc(errMsg(e))+"</div>";return;}
  const us=r.usuarios||[];
  const draw=()=>{const f=usFiltro.toLowerCase();const v=us.filter(u=>!f||(u.nome+" "+u.email+" "+u.setor+" "+PAPEL[u.papel]).toLowerCase().includes(f));
    $("us-body").innerHTML=v.length?v.map(u=>{const st=SIT[sitU(u)];return'<tr class="r" data-us="'+esc(u.id)+'"><td style="font-weight:700;min-width:170px"><span class="av">'+esc(ini(u.nome))+"</span> "+esc(u.nome)+(u.id===S.me.id?' <span class="sub">(você)</span>':"")+(u.setor?'<div class="sub" style="font-weight:600">'+esc(u.setor)+"</div>":"")+"</td><td>"+(u.email?esc(u.email):'<span class="sub">sem e-mail (conta antiga)</span>')+"</td><td>"+esc(PAPEL[u.papel]||u.papel)+'</td><td class="num" style="white-space:nowrap">'+(u.ultimo_acesso?fmtTS(u.ultimo_acesso):'<span class="sub">nunca</span>')+'</td><td style="white-space:nowrap"><span class="pill '+st[1]+'">'+st[0]+"</span></td></tr>";}).join(""):'<tr><td colspan="5" class="empty">Nenhum usuário encontrado.</td></tr>';};
  $("ov").innerHTML='<div class="modal" style="max-width:960px"><div class="m-h"><h3>Usuários</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div>'+
   '<div class="m-b" style="display:block">'+(r.emailConfigurado?"":'<div class="note warn" style="margin-bottom:12px">O envio de e-mail não está configurado no servidor (SMTP). Sem ele, os links de ativação e de recuperação não chegam às pessoas.</div>')+
   '<div class="ph"><input class="inp" id="us-q" type="search" placeholder="Buscar nome, e-mail, setor ou perfil…" value="'+esc(usFiltro)+'" style="flex:1;min-width:200px"><button type="button" class="btn pri" id="u-novo">Autorizar novo usuário</button></div>'+
   '<div class="tscroll"><table class="t"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th>Situação</th></tr></thead><tbody id="us-body"></tbody></table></div>'+
   '<div class="meta-l" style="margin-top:10px">'+plural(us.filter(u=>u.ativo).length,"usuário ativo","usuários ativos")+' · clique para editar, bloquear ou enviar link.</div></div>'+
   '<div class="m-f"><button type="button" class="btn" id="u-voltar">Voltar aos cadastros</button><span class="sp"></span><button type="button" class="btn" data-close>Fechar</button></div></div>';
  draw();$("us-q").oninput=e=>{usFiltro=e.target.value;draw();};
  $("u-novo").onclick=()=>openUsuario(null,r.emailConfigurado);$("u-voltar").onclick=openCfg;
  $("us-body").addEventListener("click",e=>{const tr=e.target.closest("[data-us]");if(tr)openUsuario(us.find(u=>u.id===tr.dataset.us),r.emailConfigurado);});
}
function openUsuario(u,smtp){
  const eu=u&&u.id===S.me.id;const st=u?sitU(u):"";
  $("ov").innerHTML='<form class="modal" id="uf" novalidate><div class="m-h"><h3>'+(u?"Editar usuário":"Autorizar novo usuário")+'</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b">'+
   '<div class="fld s3"><label for="u-email">E-mail corporativo *</label><input class="inp" id="u-email" type="email" maxlength="160" autocapitalize="none" spellcheck="false" placeholder="nome@famossul.com.br" value="'+esc(u?u.email:"")+'"'+(u?" readonly":"")+'></div>'+
   '<div class="fld s3"><label for="u-nome">Nome *</label><input class="inp" id="u-nome" maxlength="160" value="'+esc(u?u.nome:"")+'"></div>'+
   '<div class="fld s3"><label for="u-setor">Setor</label><input class="inp" id="u-setor" list="dl-set" maxlength="80" value="'+esc(u?u.setor:"")+'"><datalist id="dl-set">'+(S.lists.setores||[]).map(x=>'<option value="'+esc(x)+'">').join("")+"</datalist></div>"+
   '<div class="fld s3"><label for="u-papel">Perfil de acesso *</label><select class="sel" id="u-papel"'+(eu?' disabled title="Você não pode alterar o seu próprio nível de acesso"':"")+'>'+["solicitante","atendente","admin"].map(p=>'<option value="'+p+'"'+((u?u.papel:"solicitante")===p?" selected":"")+">"+PAPEL[p]+"</option>").join("")+'</select><span class="meta-l" id="u-pd"></span></div>'+
   (u?'<label class="chk s6"><input type="checkbox" id="u-ativo"'+(u.ativo?" checked":"")+(eu?" disabled":"")+'> Conta ativa (desmarque para bloquear: o acesso é cortado na hora e os links pendentes deixam de valer)</label>'+
      '<dl class="kv s6"><dt>Situação</dt><dd><span class="pill '+SIT[st][1]+'">'+SIT[st][0]+"</span></dd><dt>Último acesso</dt><dd>"+(u.ultimo_acesso?fmtTS(u.ultimo_acesso):"nunca")+"</dd><dt>Ativado em</dt><dd>"+(u.ativado_em?fmtTS(u.ativado_em):"—")+"</dd><dt>Autorizado em</dt><dd>"+fmtTS(u.criado_em)+"</dd></dl>"
     :'<label class="chk s6"><input type="checkbox" id="u-conv"'+(smtp?" checked":" disabled")+'> Enviar agora o link de ativação para o e-mail (válido por 30 minutos)'+(smtp?"":" — envio de e-mail não configurado")+'</label><div class="s6 meta-l">A pessoa também pode pedir o link em “Primeiro acesso”, na tela de login. A senha é criada por ela; o administrador nunca vê nem define senhas.</div>')+
   '<div class="s6 err" id="u-err" hidden></div><div class="s6 note ok" id="u-ok" hidden></div></div>'+
   '<div class="m-f"><button type="button" class="btn" id="u-lista">Voltar à lista</button>'+(u&&u.ativo&&u.email&&!eu?'<button type="button" class="btn" id="u-link">'+(st==="pendente"?"Enviar link de ativação":"Enviar link de redefinição de senha")+"</button>":"")+'<span class="sp"></span><button type="submit" class="btn pri" id="u-save">'+(u?"Salvar alterações":"Autorizar usuário")+"</button></div></form>";
  $("ov").hidden=false;ovDirty=false;setTimeout(()=>(u?$("u-nome"):$("u-email")).focus(),30);
  const pd=()=>{$("u-pd").textContent=PAPEL_D[$("u-papel").value];};pd();$("u-papel").onchange=pd;
  $("u-lista").onclick=openUsuarios;
  const er=$("u-err");const fail=m=>{$("u-ok").hidden=true;er.textContent=m;er.hidden=false;};
  const lk=$("u-link");if(lk)lk.onclick=async()=>{er.hidden=true;lk.disabled=true;const t=lk.textContent;lk.textContent="Enviando…";
    try{const r=await api("/usuarios/convite",{method:"POST",body:{id:u.id}});$("u-ok").textContent=(r.tipo==="ativacao"?"Link de ativação":"Link de redefinição")+" enviado para "+u.email+". Vale por 30 minutos.";$("u-ok").hidden=false;}catch(e){fail(errMsg(e));}finally{lk.disabled=false;lk.textContent=t;}};
  $("uf").addEventListener("submit",async e=>{e.preventDefault();er.hidden=true;
    const body={nome:$("u-nome").value.trim(),setor:$("u-setor").value.trim(),papel:$("u-papel").value};
    if(body.nome.length<2)return fail("Informe o nome.");
    if(!u){body.email=$("u-email").value.trim().toLowerCase();if(!/^[a-z0-9._%+-]+@famossul\.com\.br$/.test(body.email))return fail("Use um e-mail corporativo @famossul.com.br.");body.enviarConvite=$("u-conv").checked;}
    else{body.id=u.id;body.ativo=$("u-ativo").checked;}
    const b=$("u-save");b.disabled=true;b.textContent="Salvando…";
    try{const r=await api("/usuarios",{method:u?"PATCH":"POST",body});toast(r.aviso||(u?"Usuário atualizado":(body.enviarConvite?"Usuário autorizado · link de ativação enviado":"Usuário autorizado")));
      const s=await api("/sessao");S.atendentes=s.atendentes||[];openUsuarios();}
    catch(ex){b.disabled=false;b.textContent=u?"Salvar alterações":"Autorizar usuário";fail(errMsg(ex));}});
}
/* ---------- Minha senha ---------- */
function openSenha(){
  $("ov").innerHTML='<form class="modal" id="sf" novalidate style="max-width:460px"><div class="m-h"><h3>Minha senha</h3><button type="button" class="btn ghost" data-close aria-label="Fechar">✕</button></div><div class="m-b">'+
   '<div class="fld s6"><label for="s-at">Senha atual</label><input class="inp" id="s-at" type="password" autocomplete="current-password"></div>'+
   '<div class="fld s6"><label for="s-nv">Nova senha</label><input class="inp" id="s-nv" type="password" autocomplete="new-password" placeholder="mínimo de 8 caracteres"></div>'+
   '<div class="fld s6"><label for="s-cf">Repita a nova senha</label><input class="inp" id="s-cf" type="password" autocomplete="new-password"></div>'+
   '<div class="s6 meta-l">Ao trocar, as sessões abertas em outros aparelhos são encerradas.</div><div class="s6 err" id="s-err" hidden></div></div>'+
   '<div class="m-f"><span class="sp"></span><button type="button" class="btn" data-close>Cancelar</button><button type="submit" class="btn pri" id="s-save">Trocar senha</button></div></form>';
  $("ov").hidden=false;ovDirty=false;setTimeout(()=>$("s-at").focus(),30);
  $("sf").addEventListener("submit",async e=>{e.preventDefault();const er=$("s-err");const fail=m=>{er.textContent=m;er.hidden=false;};er.hidden=true;
    const atual=$("s-at").value,nova=$("s-nv").value;if(!atual)return fail("Informe a senha atual.");if(nova.length<8)return fail("A nova senha precisa ter pelo menos 8 caracteres.");if(!/[A-Za-zÀ-ÿ]/.test(nova)||!/\d/.test(nova))return fail("A nova senha precisa ter letras e números.");if(nova!==$("s-cf").value)return fail("A confirmação não confere com a nova senha.");
    const b=$("s-save");b.disabled=true;b.textContent="Salvando…";
    try{await api("/auth/senha",{method:"POST",body:{atual,nova}});closeOv(true);toast("Senha alterada");}catch(ex){b.disabled=false;b.textContent="Trocar senha";fail(errMsg(ex));}});
}

/* ---------- CSV (download comum do navegador) ---------- */
function baixar(nome,linhas){const blob=new Blob(["﻿"+linhas.join("\r\n")],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);}
const q=x=>'"'+String(x==null?"":x).replace(/"/g,'""').replace(/\r?\n/g," ")+'"';
function exportCsv(){const v=sorted(visible());const head=["Data","Início","Fim","Título","Tipo","Setor","Jornada","Responsável","Solicitante","Prioridade","Status","Atrasada","Descrição"];
  baixar("tarefas-famossul-"+TODAY+".csv",[head.join(";")].concat(v.map(t=>[fmtDY(t.data),t.horaIni,t.horaFim,t.titulo,t.tipo,t.setor,t.jornada,t.responsavel,t.solicitante,t.prioridade,SN[t.status]||t.status,isLate(t)?"Sim":"Não",t.descricao].map(q).join(";"))));}
function exportCsvCh(){const v=csorted(visCh());const head=["Número","Título","Sistema","Tipo","Solicitante","Responsável","Prioridade","Status","Atrasado","Abertura","Prazo","Conclusão"];
  baixar("chamados-famossul-"+TODAY+".csv",[head.join(";")].concat(v.map(c=>[numCh(c.numero),c.titulo,c.sistema,c.tipo,c.solicitante_nome,c.responsavel_nome,c.prioridade,CSN[c.status]||c.status,chLate(c)?"Sim":"Não",fmtTS(c.criado_em),c.prazo?fmtDY(c.prazo):"",fmtTS(c.concluido_em)].map(q).join(";"))));}

/* ---------- Eventos ---------- */
function go(v){if(views().indexOf(v)<0)v=views()[0];S.view=v;try{history.replaceState(null,"","#"+v);}catch(x){location.hash=v;}render();window.scrollTo(0,0);}
document.addEventListener("click",e=>{const el=e.target;
  const tab=el.closest(".nav-i");if(tab){go(tab.dataset.v);return;}
  if(el.closest("[data-close]")||el===$("ov")){closeOv();return;}
  if(!$("ov").hidden&&el.closest("#ov"))return;
  const pb=el.closest("#perSeg button");if(pb){S.per=pb.dataset.p;if(S.per!=="custom")S.anchor=new Date();savePrefs();render();return;}
  const cm=el.closest("#calMode button");if(cm){S.cal.mode=cm.dataset.m;savePrefs();render();return;}
  const ch=el.closest("[data-ch]");if(ch&&!el.closest(".card.dragging")){openChamado(ch.dataset.ch);return;}
  const kp=el.closest("[data-kst]");if(kp){S.cf=Object.assign({sis:"",tipo:"",st:"",prio:"",resp:"",q:""},{st:kp.dataset.kst});$("cQ").value="";go("fila");return;}
  const hb=el.closest("[data-cf]");if(hb){const k=hb.dataset.cf==="sistema"?"sis":"prio";S.cf={sis:"",tipo:"",st:"abertos",prio:"",resp:"",q:""};S.cf[k]=hb.dataset.cv;$("cQ").value="";go("fila");return;}
  const id=el.closest("[data-id]");if(id&&!el.closest(".card.dragging")){openTask(id.dataset.id);return;}
  const mw=el.closest("[data-week]");if(mw){S.cal.mode="semana";S.cal.cur=parse(mw.dataset.week);render();return;}
  const day=el.closest(".dc");if(day&&S.admin){openTask(null,{data:day.dataset.day});return;}
  const rr=el.closest("tr[data-resp]");if(rr){const n=rr.dataset.resp;S.f.resp=n==="Sem responsável"?"":n;go("lista");return;}
  const th=el.closest("th[data-k]");if(th){const k=th.dataset.k;S.sort=S.sort.k===k?{k,d:-S.sort.d}:{k,d:1};render();return;}
  const cth=el.closest("th[data-ck]");if(cth){const k=cth.dataset.ck;S.csort=S.csort.k===k?{k,d:-S.csort.d}:{k,d:k==="numero"||k==="criado_em"?-1:1};render();return;}
  const hm=el.closest("td[data-m]");if(hm){S.cal.mode="mes";S.cal.cur=new Date(S.anchor.getFullYear(),Number(hm.dataset.m),1);go("agenda");return;}
});
$("btnNew").onclick=()=>openTask(null);$("btnNew2").onclick=()=>openTask(null);$("btnCfg").onclick=openCfg;
$("btnCh").onclick=openNovoChamado;$("btnCh2").onclick=openNovoChamado;
$("btnCsv").onclick=exportCsv;$("btnCsvCh").onclick=exportCsvCh;
$("btnRetry").onclick=()=>{S.err=null;boot();};
$("btnSenha").onclick=openSenha;$("btnUsers").onclick=openUsuarios;
$("btnSair").onclick=async()=>{try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}catch(e){}location.href="/login";};
$("pPrev").onclick=()=>shift(-1);$("pNext").onclick=()=>shift(1);
$("cPrev").onclick=()=>{S.cal.cur=S.cal.mode==="semana"?addD(S.cal.cur,-7):addM(S.cal.cur,-1);render();};
$("cNext").onclick=()=>{S.cal.cur=S.cal.mode==="semana"?addD(S.cal.cur,7):addM(S.cal.cur,1);render();};
$("cToday").onclick=()=>{S.cal.cur=new Date();render();};
$("fDe").onchange=e=>{if(e.target.value){S.de=e.target.value;render();}};$("fAte").onchange=e=>{if(e.target.value){S.ate=e.target.value;render();}};
[["fSetor","setor"],["fTipo","tipo"],["fResp","resp"],["fStatus","status"],["fPrio","prio"]].forEach(([i,k])=>$(i).onchange=e=>{S.f[k]=e.target.value;render();});
let qT;$("fQ").oninput=e=>{clearTimeout(qT);qT=setTimeout(()=>{S.f.q=e.target.value.trim();render();},200);};
$("fClear").onclick=()=>{S.f={setor:"",tipo:"",resp:"",status:"",prio:"",q:""};$("fQ").value="";render();};
[["cSis","sis"],["cTipo","tipo"],["cSt","st"],["cPrio","prio"],["cResp","resp"]].forEach(([i,k])=>$(i).onchange=e=>{S.cf[k]=e.target.value;render();});
let cqT;$("cQ").oninput=e=>{clearTimeout(cqT);cqT=setTimeout(()=>{S.cf.q=e.target.value.trim();render();},200);};
$("cClear").onclick=()=>{S.cf={sis:"",tipo:"",st:"",prio:"",resp:"",q:""};$("cQ").value="";render();};
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("ov").hidden)closeOv();});
// Arrastar no kanban (tarefas e chamados)
let dragId=null,dragKind=null;
function dnd(el,kind){
  el.addEventListener("dragstart",e=>{const c=e.target.closest(".card");if(!c)return;dragId=kind==="ch"?c.dataset.ch:c.dataset.id;dragKind=kind;c.classList.add("dragging");try{e.dataTransfer.setData("text/plain",dragId);e.dataTransfer.effectAllowed="move";}catch(x){}});
  el.addEventListener("dragend",e=>{const c=e.target.closest(".card");if(c)c.classList.remove("dragging");document.querySelectorAll(".col.over").forEach(x=>x.classList.remove("over"));setTimeout(()=>{dragId=null;},0);});
  el.addEventListener("dragover",e=>{const col=e.target.closest(".col");if(!col||!dragId||dragKind!==kind)return;e.preventDefault();document.querySelectorAll(".col.over").forEach(x=>x!==col&&x.classList.remove("over"));col.classList.add("over");});
  el.addEventListener("drop",async e=>{const col=e.target.closest(".col");if(!col||!dragId||dragKind!==kind)return;e.preventDefault();const id=dragId;dragId=null;col.classList.remove("over");
    if(kind==="t"){const t=S.tasks.find(x=>x.id===id);const st=col.dataset.st;if(!t||t.status===st)return;const old=t.status;t.status=st;render();
      try{await api("/tarefas",{method:"PATCH",body:{id,status:st}});toast("Movida para "+SN[st]);}catch(ex){t.status=old;render();toast(errMsg(ex));}}
    else{const c=S.ch.find(x=>x.id===id);const st=col.dataset.cst;if(!c||c.status===st)return;const old=c.status;c.status=st;render();
      try{const r=await api("/chamados",{method:"PATCH",body:{id,versao:c.versao,status:st}});if(r.chamado)Object.assign(c,{versao:r.chamado.versao,status:r.chamado.status,concluido_em:r.chamado.concluido_em});toast(numCh(c.numero)+" movido para "+CSN[st]);render();}
      catch(ex){c.status=old;render();toast(errMsg(ex));if(ex.status===409)reload(true);}}
  });
}
dnd($("kb"),"t");dnd($("kbch"),"ch");
function route(){const h=(location.hash||"").replace("#","");
  const m=/^chamado=([0-9a-f-]{36})$/i.exec(h);
  if(m){if(!S.view)S.view=views()[0];render();openChamado(m[1]);return;}
  if(views().indexOf(h)>=0)S.view=h;else if(!S.view)S.view=views()[0];
  render();}
window.addEventListener("hashchange",()=>{if(/^#chamado=/.test(location.hash)&&!$("ov").hidden)return;route();});

/* ---------- Inicialização ---------- */
function setSync(kind,txt){$("syncDot").className="dot"+(kind==="on"?" on":kind==="local"?" local":"");$("syncTxt").textContent=txt;}
function drawMe(){const m=S.me;$("me").hidden=false;$("me").innerHTML='<span class="av">'+esc(ini(m.nome))+'</span><div><b title="'+esc(m.nome)+'">'+esc(m.nome)+"</b><small>"+esc(PAPEL[S.me.papel]||"")+"</small></div>";}
async function boot(){
  setSync("","Conectando…");
  try{
    const s=await api("/sessao");
    S.me={id:s.id,usuario:s.usuario,nome:s.nome,papel:s.papel};S.admin=s.papel==="admin"||s.papel==="atendente";S.super=s.papel==="admin";$("btnUsers").hidden=!S.super;S.lists=s.listas||S.lists;S.atendentes=s.atendentes||[];if(s.hoje)TODAY=s.hoje;
    drawMe();
  }catch(e){
    S.me=S.me||{usuario:"",nome:""};S.err=e;$("vTitle").textContent="Gestão de Processos";
    Object.keys(VT).forEach(v=>$("v-"+v).hidden=true);$("erro").hidden=false;$("erroT").textContent=e.status===503?"Banco ainda não preparado":"Não foi possível carregar";$("erroM").textContent=errMsg(e);setSync("","Sem conexão");return;}
  S.err=null;route();
  await reload(false);
  route();
}
// Atualização periódica: outras pessoas veem os mesmos dados (a cada 30 s com a aba visível; nunca durante um arraste).
setInterval(()=>{if(document.visibilityState==="visible"&&S.me&&S.me.usuario&&!S.err&&!dragId)reload(true);},30000);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&S.me&&S.me.usuario&&!S.err)reload(true);});
boot();
})();
