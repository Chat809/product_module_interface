import { environment } from '../../../environments/environment';

/** Login com Google pelo Supabase no fluxo PKCE: o token nunca passa pela URL, só um código de uso único. */

export const ROTA_RETORNO_GOOGLE = '/auth/callback';

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** code_verifier: 32 bytes aleatórios viram 43 caracteres, o mínimo aceito pela RFC 7636. */
export function gerarVerificador(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

/** code_challenge (S256): só o hash sai do navegador; o verificador fica guardado até o retorno. */
export async function desafioDe(verificador: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64Url(new Uint8Array(hash));
}

export function urlDoGoogle(desafio: string, retorno: string): string {
  const parametros = new URLSearchParams({
    provider: 'google',
    redirect_to: retorno,
    code_challenge: desafio,
    code_challenge_method: 's256',
  });
  return `${environment.supabaseUrl}/auth/v1/authorize?${parametros}`;
}
