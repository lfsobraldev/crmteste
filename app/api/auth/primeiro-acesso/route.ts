import { pedirLink } from "@/lib/links";

export const runtime = "nodejs";
/** Primeiro acesso: o colaborador informa o e-mail corporativo e recebe o link de ativação (se autorizado). */
export async function POST(req: Request) { return pedirLink(req, "primeiro-acesso"); }
