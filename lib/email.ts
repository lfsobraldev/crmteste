/** Envio de e-mail por SMTP (Microsoft 365, Google Workspace ou servidor da empresa). Sem SMTP configurado, nada é enviado. */
import nodemailer, { type Transporter } from "nodemailer";

const g = globalThis as unknown as { __gpSmtp?: Transporter };
export const emailConfigurado = () => !!(process.env.SMTP_HOST && process.env.EMAIL_REMETENTE);

function transporte() {
  if (!g.__gpSmtp) {
    const porta = Number(process.env.SMTP_PORT || 587);
    g.__gpSmtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: porta,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : porta === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" } : undefined,
      requireTLS: process.env.SMTP_TLS_OBRIGATORIO === "true",
      connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
  }
  return g.__gpSmtp;
}

/** Endereço público do sistema para montar os links (APP_URL; na Vercel, o domínio de produção). Nunca vem do pedido. */
export function urlBase(): string {
  const u = process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL : "");
  if (!u) throw new Error("APP_URL não configurada.");
  return u.replace(/\/+$/, "");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type TipoLink = "ativacao" | "recuperacao";
const TEXTOS: Record<TipoLink, { assunto: string; titulo: string; corpo: string; botao: string }> = {
  ativacao: { assunto: "Ative seu acesso à Gestão de Processos Famossul", titulo: "Ative seu acesso", corpo: "Seu acesso à Gestão de Processos e Central de Chamados foi liberado. Clique no botão para criar a sua senha.", botao: "Criar minha senha" },
  recuperacao: { assunto: "Redefinição de senha · Gestão de Processos Famossul", titulo: "Redefinir senha", corpo: "Recebemos um pedido para redefinir a sua senha. Clique no botão para criar uma nova senha.", botao: "Redefinir senha" },
};

export async function enviarLink(tipo: TipoLink, para: { email: string; nome: string }, link: string, minutos: number) {
  const t = TEXTOS[tipo];
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#EEF1F0;font-family:'Nunito Sans','Segoe UI',Arial,sans-serif;color:#1F2524">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F0;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #E1E6E4;border-radius:14px;overflow:hidden">
<tr><td style="background:#2B3332;padding:20px 26px;color:#FFFFFF"><div style="font-size:20px;font-weight:900;letter-spacing:-.01em">famossul</div>
<div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#A9B4B1;margin-top:4px"><span style="display:inline-block;width:18px;height:3px;background:#14CD64;border-radius:2px;vertical-align:middle;margin-right:8px"></span>Gestão de Processos</div></td></tr>
<tr><td style="padding:26px">
<h1 style="margin:0 0 10px;font-size:22px;font-weight:900">${t.titulo}</h1>
<p style="margin:0 0 6px;font-size:15px">Olá, ${esc(para.nome)}.</p>
<p style="margin:0 0 22px;font-size:15px;color:#646E6C">${t.corpo}</p>
<p style="margin:0 0 22px"><a href="${esc(link)}" style="display:inline-block;background:#14CD64;color:#0A2716;font-weight:800;font-size:15px;text-decoration:none;padding:12px 20px;border-radius:10px">${t.botao}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#646E6C">O link vale por ${minutos} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore esta mensagem: nada será alterado.</p>
<p style="margin:0;font-size:12px;color:#959E9B;word-break:break-all">Se o botão não abrir, copie este endereço no navegador:<br>${esc(link)}</p>
</td></tr></table></td></tr></table></body></html>`;
  const text = `${t.titulo}\n\nOlá, ${para.nome}.\n${t.corpo}\n\n${link}\n\nO link vale por ${minutos} minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore esta mensagem.`;
  await transporte().sendMail({ from: process.env.EMAIL_REMETENTE, to: { name: para.nome, address: para.email }, subject: t.assunto, html, text });
}
