/* Telas de acesso: validação do domínio no navegador (o servidor valida de novo), mostrar senha e mensagens claras. */
(function(){"use strict";
const $=id=>document.getElementById(id);
const DOM="famossul.com.br";
const okEmail=v=>/^[a-z0-9._%+-]+@famossul\.com\.br$/.test(v)&&v.length<=160;
const show=(m)=>{const e=$("e");if(!e)return;e.textContent=m;e.hidden=!m;};
function checaEmail(){const v=$("em").value.trim().toLowerCase();
  if(!v)return"Informe o seu e-mail corporativo.";
  if(!okEmail(v))return v.indexOf("@")<0?"Informe o e-mail completo, por exemplo nome@"+DOM+".":"Use o seu e-mail corporativo @"+DOM+". E-mails pessoais ou de outros domínios não têm acesso.";
  return"";}
async function post(url,body){let r;
  try{r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify(body)});}
  catch(x){throw new Error("Sem conexão com o servidor. Verifique a internet e tente de novo.");}
  let j={};try{j=await r.json();}catch(x){}
  if(!r.ok)throw new Error(j.error||"Não foi possível concluir. Tente de novo.");return j;}
const busy=(b,t)=>{b.disabled=!!t;if(t){b.dataset.t=b.dataset.t||b.textContent;b.textContent=t;}else if(b.dataset.t)b.textContent=b.dataset.t;};
document.addEventListener("click",e=>{const b=e.target.closest("[data-ver]");if(!b)return;const i=$(b.dataset.ver);const ver=i.type==="password";i.type=ver?"text":"password";b.setAttribute("aria-pressed",ver);b.setAttribute("aria-label",ver?"Ocultar senha":"Mostrar senha");b.title=ver?"Ocultar senha":"Mostrar senha";});
const em=$("em");if(em){em.addEventListener("blur",()=>{if(em.value.trim()){const m=checaEmail();show(m);}});const p=new URLSearchParams(location.search).get("email");if(p&&!em.value)em.value=p;}

const fl=$("f-login");
if(fl)fl.addEventListener("submit",async e=>{e.preventDefault();show("");const m=checaEmail();if(m)return show(m);
  const senha=$("sn").value;if(!senha)return show("Informe a senha.");
  const b=$("b");busy(b,"Entrando…");
  try{await post("/api/auth/login",{email:$("em").value.trim().toLowerCase(),senha});
    const n=new URLSearchParams(location.search).get("next")||"/";location.replace(/^\/(?!\/)[^\s]*$/.test(n)&&!/^\/(login|primeiro-acesso|recuperar|definir-senha)/.test(n)?n:"/");}
  catch(x){busy(b);show(x.message);$("sn").select();}});

const fp=$("f-pedido");
if(fp)fp.addEventListener("submit",async e=>{e.preventDefault();show("");$("ok").hidden=true;const m=checaEmail();if(m)return show(m);
  const b=$("b");busy(b,"Enviando…");
  try{const r=await post(fp.dataset.api,{email:$("em").value.trim().toLowerCase()});$("ok").textContent=r.mensagem;$("ok").hidden=false;busy(b);b.textContent="Enviar novamente";}
  catch(x){busy(b);show(x.message);}});

const fs=$("f-senha");
if(fs){
  const token=new URLSearchParams(location.search).get("token")||"";
  try{history.replaceState(null,"","/definir-senha");}catch(x){}
  let email="";
  const regras=()=>{const a=$("s1").value,c=$("s2").value;const r={len:a.length>=8,mix:/[A-Za-zÀ-ÿ]/.test(a)&&/\d/.test(a),eq:!!a&&a===c};
    document.querySelectorAll("#req li").forEach(li=>li.classList.toggle("ok",r[li.dataset.r]));return r;};
  const falha=m=>{$("ds-tit").textContent="Link indisponível";$("ds-eye").textContent="Criar senha";$("ds-p").textContent=m;$("ds-campos").hidden=true;$("b").hidden=true;$("ds-links").hidden=false;};
  (async()=>{
    if(!/^[A-Za-z0-9_-]{43}$/.test(token))return falha("Este link é inválido. Abra o link completo recebido por e-mail ou peça um novo.");
    try{const r=await fetch("/api/auth/token?token="+encodeURIComponent(token),{credentials:"same-origin"});let j={};try{j=await r.json();}catch(x){}
      if(!r.ok)return falha(j.error||"Este link é inválido ou expirou.");
      email=j.email;$("ds-eye").textContent=j.tipo==="ativacao"?"Primeiro acesso":"Recuperação de senha";
      $("ds-tit").textContent=j.tipo==="ativacao"?"Crie a sua senha":"Crie uma nova senha";
      $("ds-p").textContent="Olá, "+j.nome+" ("+j.email+"). "+(j.tipo==="ativacao"?"Defina a senha para ativar o seu acesso.":"Defina a nova senha; as sessões abertas em outros aparelhos serão encerradas.");
      $("ds-campos").hidden=false;$("b").hidden=false;$("s1").focus();
    }catch(x){falha("Sem conexão com o servidor. Recarregue a página para tentar de novo.");}
  })();
  fs.addEventListener("input",regras);
  fs.addEventListener("submit",async e=>{e.preventDefault();show("");const r=regras();
    if(!r.len)return show("A senha precisa ter pelo menos 8 caracteres.");if(!r.mix)return show("A senha precisa ter letras e números.");if(!r.eq)return show("As duas senhas não são iguais.");
    const b=$("b");busy(b,"Salvando…");
    try{await post("/api/auth/definir-senha",{token,senha:$("s1").value});$("ds-tit").textContent="Senha criada";$("ds-p").textContent="Tudo certo. Entrando…";$("ds-campos").hidden=true;b.hidden=true;setTimeout(()=>location.replace("/"),700);}
    catch(x){busy(b);show(x.message);if(/inválido|expirou|usado/.test(x.message)){$("ds-campos").hidden=true;b.hidden=true;$("ds-links").hidden=false;}}});
}
})();
