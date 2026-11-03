import { environment } from '../../../environments/environment';
import { desafioDe, gerarVerificador, urlDoGoogle } from './google';

describe('PKCE do login com Google', () => {
  it('deve gerar verificadores de 43 caracteres base64url, diferentes a cada login', () => {
    const verificador = gerarVerificador();
    expect(verificador).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarVerificador()).not.toBe(verificador);
  });

  it('deve calcular o code_challenge S256 do exemplo da RFC 7636', async () => {
    expect(await desafioDe('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('deve montar o endereço de autorização do Supabase', () => {
    const url = new URL(urlDoGoogle('desafio', 'https://painel.exemplo.com/auth/callback'));
    expect(url.href.startsWith(`${environment.supabaseUrl}/auth/v1/authorize?`)).toBe(true);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      provider: 'google',
      redirect_to: 'https://painel.exemplo.com/auth/callback',
      code_challenge: 'desafio',
      code_challenge_method: 's256',
    });
  });
});
