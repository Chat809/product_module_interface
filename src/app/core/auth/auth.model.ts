export type Papel = 'ADMIN' | 'USUARIO';

/** Módulos (grupos do menu), com as mesmas chaves de `modulos_ativos` e das políticas do banco. */
export type Modulo =
  | 'inicio'
  | 'estoque'
  | 'demandas'
  | 'financeiro'
  | 'comercial'
  | 'crm'
  | 'rh'
  | 'relatorios'
  | 'configuracoes'
  | (string & {});

/** Subabas, no formato `modulo/subaba` gravado na coluna `acessos` do perfil. */
export type ChaveSubaba = `${string}/${string}`;

/** Pessoa logada ou listada. `acessos` traz `'*'` (todos), chaves de módulo ou de subaba. */
export interface Usuario {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  acessos: string[];
  criadoEm: string | null;
  avatarUrl?: string | null;
  /** Departamento e cargo (`funcao`) na empresa, definidos pelo admin. */
  departamento?: string | null;
  funcao?: string | null;
  telefone?: string | null;
  bio?: string | null;
}
