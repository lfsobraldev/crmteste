/** Versão usada nos links de gp.css/gp.js para o navegador não usar arquivo antigo depois de um deploy. */
export const VERSAO = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.APP_VERSAO || String(Date.now())).slice(0, 12);
export const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Frame-Options": "SAMEORIGIN", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin" };
