/**
 * Login com Google pelo Supabase no fluxo PKCE: o supabase-js guarda o verificador e o Google devolve só um
 * código de uso único para esta rota, trocado pela sessão no próprio navegador.
 */
export const ROTA_RETORNO_GOOGLE = '/auth/callback';
