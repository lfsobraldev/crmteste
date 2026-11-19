/** Pedido de link por e-mail (primeiro acesso ou recuperação). Resposta sempre neutra para não revelar quem está cadastrado. */
import { NextResponse } from "next/server";
import { emailConfigurado, enviarLink, urlBase } from "./email";
import { excedeu, ipDe } from "./limites";
import { pedidoEmailSchema } from "./regras";
import { erroGP, H, q } from "./servidor";
import { novoToken, VALIDADE_MIN } from "./tokens";

/** Envia o link certo para a situação da conta: sem senha ainda → ativação; com senha → recuperação. */
export async function enviarLinkConta(u: { id: string; email: string; nome: string; senha_definida: boolean }, ip: string) {
  const tipo = u.senha_definida ? "recuperacao" : "ativacao";
  const token = await novoToken(u.id, tipo, ip);
  const caminho = "/definir-senha?token=" + encodeURIComponent(token);
  await enviarLink(tipo, { email: u.email, nome: u.nome }, urlBase() + caminho, VALIDADE_MIN);
  return tipo;
}

export async function pedirLink(req: Request, origem: "primeiro-acesso" | "recuperar") {
  try {
    const { email } = pedidoEmailSchema.parse(await req.json().catch(() => ({})));
    if (!emailConfigurado()) return NextResponse.json({ error: "O envio de e-mails ainda não foi configurado no servidor. Fale com o administrador do sistema." }, { status: 503, headers: H });
    const ip = ipDe(req);
    if (await excedeu("link-ip:" + ip, 10, 15) || await excedeu("link-email:" + email, 3, 15))
      return NextResponse.json({ error: "Muitos pedidos seguidos. Aguarde 15 minutos e tente de novo." }, { status: 429, headers: H });
    const [u] = await q("select id,email,nome,ativo,senha_hash is not null senha_definida from gp_usuarios where lower(email)=$1", [email]);
    if (u?.ativo) {
      try { await enviarLinkConta(u as never, ip); }
      catch (e) { console.error("[email]", e instanceof Error ? e.message : e); return NextResponse.json({ error: "Não foi possível enviar o e-mail agora. Tente de novo em alguns minutos." }, { status: 502, headers: H }); }
    }
    const texto = origem === "primeiro-acesso"
      ? `Se o e-mail ${email} estiver autorizado pelo administrador, você vai receber em instantes um link para criar a sua senha. O link vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez.`
      : `Se existir uma conta com o e-mail ${email}, você vai receber em instantes um link para criar uma nova senha. O link vale por ${VALIDADE_MIN} minutos e só pode ser usado uma vez.`;
    return NextResponse.json({ ok: true, mensagem: texto + " Confira também a caixa de spam." }, { headers: H });
  } catch (e) { return erroGP(e, "Não foi possível processar o pedido."); }
}
