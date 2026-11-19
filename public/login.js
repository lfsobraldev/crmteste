(function(){"use strict";
const $=id=>document.getElementById(id);
$("lf").addEventListener("submit",async e=>{e.preventDefault();const u=$("u").value.trim(),s=$("s").value,err=$("e"),b=$("b");
  err.hidden=true;if(!u||!s){err.textContent="Informe usuário e senha.";err.hidden=false;return;}
  b.disabled=true;b.textContent="Entrando…";
  try{const r=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({usuario:u,senha:s})});
    let j={};try{j=await r.json();}catch(x){}
    if(!r.ok)throw new Error(j.error||"Não foi possível entrar.");
    const n=new URLSearchParams(location.search).get("next")||"/";location.replace(/^\/(?!\/)[^\s]*$/.test(n)&&!n.startsWith("/login")?n:"/");
  }catch(x){err.textContent=x.message==="Failed to fetch"?"Sem conexão com o servidor. Tente de novo.":x.message;err.hidden=false;b.disabled=false;b.textContent="Entrar";}
});})();
