import { NextResponse } from "next/server";
import { lerChamado } from "@/lib/consultas";
import { abreNoNavegador, ANEXO_MAX_BYTES, ANEXOS_POR_CHAMADO, isUuid, nomeArquivoSeguro, podeVerChamado, tipoAnexo } from "@/lib/regras";
import { contextoGP, erroGP, H, q, regra } from "@/lib/servidor";

export const runtime = "nodejs";

/** Baixa um anexo (?id=). Só quem pode ver o chamado. */
export async function GET(req: Request) {
  try {
    const c = await contextoGP();
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!isUuid(id)) throw regra("Anexo inválido.");
    const [a] = await q("select a.nome,a.mime,a.conteudo,c.solicitante_usuario from gp_chamado_anexos a join gp_chamados c on c.id=a.chamado_id where a.id=$1", [id]);
    if (!a || !podeVerChamado(c.papel, c.usuario, a)) return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404, headers: H });
    const buf = Buffer.isBuffer(a.conteudo) ? a.conteudo : Buffer.from(String(a.conteudo).replace(/^\\x/, ""), "hex");
    const nome = String(a.nome);
    const ascii = nome.normalize("NFD").replace(/[^\w.\- ]+/g, "_");
    return new NextResponse(new Uint8Array(buf), { headers: {
      "Content-Type": a.mime,
      "Content-Disposition": `${abreNoNavegador(a.mime) ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`,
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox", "Cache-Control": "private, no-store",
    } });
  } catch (e) { return erroGP(e, "Não foi possível abrir o anexo."); }
}

/** Envia UM arquivo por requisição (multipart: chamadoId, arquivo) — prints, PDF, Office, ZIP ou texto, até 3 MB. */
export async function POST(req: Request) {
  try {
    const c = await contextoGP();
    const f = await req.formData().catch(() => { throw regra("Envio inválido."); });
    const chamadoId = String(f.get("chamadoId") || "");
    const file = f.get("arquivo");
    if (!isUuid(chamadoId)) throw regra("Chamado inválido.");
    const ch = await lerChamado(chamadoId);
    if (!ch || !podeVerChamado(c.papel, c.usuario, ch)) return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404, headers: H });
    if (!(file instanceof File) || !file.size) throw regra("Selecione o arquivo.");
    const nome = nomeArquivoSeguro(file.name);
    if (file.size > ANEXO_MAX_BYTES) throw regra(`"${nome}" tem mais de 3 MB. Reduza o arquivo (ou envie um print) e tente de novo.`);
    const buf = Buffer.from(await file.arrayBuffer());
    const mime = tipoAnexo(buf, nome);
    if (!mime) throw regra(`"${nome}": formato não aceito. Envie imagem (JPG, PNG, WebP, GIF), PDF, Word, Excel, PowerPoint, ZIP, TXT ou CSV.`);
    const [{ n }] = await q("select count(*)::int n from gp_chamado_anexos where chamado_id=$1", [chamadoId]);
    if (n >= ANEXOS_POR_CHAMADO) throw regra(`Limite de ${ANEXOS_POR_CHAMADO} anexos por chamado atingido.`);
    const [r] = await q(`with a as (insert into gp_chamado_anexos(chamado_id,nome,mime,tamanho,conteudo,enviado_por,enviado_nome) values($1,$2,$3,$4,$5,$6,$7)
        returning id,nome,mime,tamanho,enviado_por,enviado_nome,criado_em)
      , ev as (insert into gp_chamado_eventos(chamado_id,tipo,texto,autor_usuario,autor_nome) select $1,'anexo',nome,$6,$7 from a)
      , up as (update gp_chamados set atualizado_em=now() where id=$1)
      select * from a`, [chamadoId, nome, mime, buf.length, buf, c.usuario, c.nome]);
    return NextResponse.json({ ok: true, anexo: r }, { status: 201, headers: H });
  } catch (e) { return erroGP(e, "Não foi possível enviar o anexo."); }
}
