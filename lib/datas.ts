/** "Hoje" no fuso da empresa (padrão America/Sao_Paulo; ajuste com FUSO_HORARIO). */
export function hojeBR(agora: Date = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: process.env.FUSO_HORARIO || "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(agora);
  const v = (t: string) => p.find((x) => x.type === t)?.value;
  return `${v("year")}-${v("month")}-${v("day")}`;
}
