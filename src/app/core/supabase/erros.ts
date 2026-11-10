import { HttpErrorResponse } from '@angular/common/http';
import { paraCamel } from './caixa';

/** Corpo de erro no formato RFC 9457 (Problem Details), o mesmo que as telas já sabem ler. */
export interface ProblemDetail {
  title?: string;
  status?: number;
  detail?: string;
  erros?: { campo: string; mensagem: string }[];
}

interface ErroPostgrest {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

interface ErroAuth {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
}

function resposta(status: number, detail: string, erros?: ProblemDetail['erros']): HttpErrorResponse {
  return new HttpErrorResponse({ status, statusText: detail, error: { status, detail, erros } satisfies ProblemDetail });
}

/** `Key (codigo)=(ABC) already exists.` vira o campo `codigo`. */
function colunaDaChave(detalhes: string | null | undefined): string | null {
  const achado = /Key \(([^)]+)\)=/.exec(detalhes ?? '');
  if (!achado) {
    return null;
  }
  const coluna = achado[1].replace(/^lower\(|\)$/g, '').split(',')[0].trim();
  return Object.keys(paraCamel({ [coluna]: true }))[0];
}

function colunaNaMensagem(mensagem: string): string | null {
  const achado = /column "([^"]+)"/.exec(mensagem);
  return achado ? Object.keys(paraCamel({ [achado[1]]: true }))[0] : null;
}

function doPostgrest(erro: ErroPostgrest): HttpErrorResponse {
  const codigo = erro.code ?? '';
  const mensagem = erro.message ?? '';
  switch (codigo) {
    case '23505': {
      const campo = colunaDaChave(erro.details);
      if (campo === 'codigo') {
        const duplicado = resposta(409, 'Já existe um cadastro com este código.', [{ campo, mensagem: 'Código já cadastrado' }]);
        (duplicado.error as ProblemDetail).title = 'Código já cadastrado';
        return duplicado;
      }
      return resposta(409, 'Já existe um cadastro com estes dados.', campo ? [{ campo, mensagem: 'Já cadastrado' }] : undefined);
    }
    case '23503':
      return resposta(
        409,
        /still referenced|ainda/.test(`${mensagem} ${erro.details ?? ''}`)
          ? 'Este registro está em uso em outros cadastros e não pode ser excluído.'
          : 'O cadastro relacionado não existe mais.',
      );
    case '23502': {
      const campo = colunaNaMensagem(mensagem);
      return resposta(400, 'Preencha os campos obrigatórios.', campo ? [{ campo, mensagem: 'Campo obrigatório' }] : undefined);
    }
    case '23514':
    case '22023':
    case '22P02':
    case '22003':
    case '22007':
    case '22008':
    case '22001':
      return resposta(400, mensagem && !/violates|invalid input|out of range|too long/i.test(mensagem) ? mensagem : 'Há valores inválidos no formulário.');
    case 'P0001':
      return resposta(422, mensagem || 'A operação não pôde ser concluída.');
    case 'P0002':
    case 'PGRST116':
      return resposta(404, 'Registro não encontrado.');
    case '42501':
      return resposta(403, 'Você não tem permissão para esta ação.');
    case '40001':
    case '40P01':
      return resposta(409, 'Outra pessoa alterou estes dados ao mesmo tempo. Tente novamente.');
    case 'PGRST301':
    case 'PGRST302':
    case 'PGRST303':
      return resposta(401, 'Sua sessão expirou. Entre novamente.');
  }
  if (/JWT/i.test(mensagem)) {
    return resposta(401, 'Sua sessão expirou. Entre novamente.');
  }
  return resposta(500, 'Ocorreu um erro inesperado. Tente novamente.');
}

function doAuth(erro: ErroAuth): HttpErrorResponse {
  switch (erro.code) {
    case 'invalid_credentials':
      return resposta(401, 'E-mail ou senha inválidos.');
    case 'email_not_confirmed':
      return resposta(401, 'Confirme o seu e-mail pelo link enviado antes de entrar.');
    case 'user_already_exists':
    case 'email_exists':
      return resposta(409, 'Já existe uma conta com este e-mail.', [{ campo: 'email', mensagem: 'Já existe uma conta com este e-mail' }]);
    case 'weak_password':
      return resposta(400, 'A senha é fraca demais.', [{ campo: 'senha', mensagem: 'Use uma senha mais forte' }]);
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return resposta(429, 'Muitas tentativas seguidas. Aguarde alguns minutos.');
    case 'signup_disabled':
      return resposta(403, 'O cadastro de novas contas está desativado.');
    case 'flow_state_not_found':
    case 'flow_state_expired':
    case 'bad_code_verifier':
      return resposta(401, 'O login foi iniciado em outra aba ou expirou. Tente novamente.');
  }
  return resposta(erro.status && erro.status >= 400 ? erro.status : 401, erro.message || 'Não foi possível autenticar.');
}

/** Converte qualquer falha do supabase-js em `HttpErrorResponse`, para as telas tratarem como antes. */
export function traduzirErro(erro: unknown): HttpErrorResponse {
  if (erro instanceof HttpErrorResponse) {
    return erro;
  }
  if (erro instanceof TypeError || (erro as { name?: string } | null)?.name === 'FunctionsFetchError') {
    return resposta(0, 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }
  const objeto = (erro ?? {}) as ErroPostgrest & ErroAuth;
  if (objeto.name?.startsWith('Auth') || objeto.name === 'AuthApiError') {
    return doAuth(objeto);
  }
  if (/Failed to fetch|NetworkError|Load failed/i.test(objeto.message ?? '')) {
    return resposta(0, 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }
  return doPostgrest(objeto);
}

/** Resposta de erro de uma Edge Function: `{ mensagem }` com o status HTTP real. */
export async function traduzirErroDeFuncao(erro: unknown): Promise<HttpErrorResponse> {
  const contexto = (erro as { context?: Response } | null)?.context;
  if (contexto && typeof contexto.status === 'number') {
    let mensagem = 'A operação não pôde ser concluída.';
    try {
      const corpo = (await contexto.clone().json()) as { mensagem?: string };
      mensagem = corpo.mensagem ?? mensagem;
    } catch {
      // corpo sem JSON: fica a mensagem padrão
    }
    return resposta(contexto.status, mensagem);
  }
  return traduzirErro(erro);
}

export { resposta as erroHttp };
