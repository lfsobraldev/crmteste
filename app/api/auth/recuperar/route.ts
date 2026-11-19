import { pedirLink } from "@/lib/links";

export const runtime = "nodejs";
/** Esqueci minha senha: envia link de redefinição (ou de ativação, se a conta ainda não foi ativada). */
export async function POST(req: Request) { return pedirLink(req, "recuperar"); }
