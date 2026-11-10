import { Routes } from '@angular/router';
import { DefinicaoDeModulo } from '../core/auth/acessos';

/**
 * Ponto de personalização de cada cliente. Num fork, mude só esta pasta (e o banco do cliente): a base continua
 * recebendo atualizações do `upstream` sem conflitos.
 */
export interface ConfiguracaoDoCliente {
  /** Usado até a marca do banco (`parametros_sistema.marca`) carregar, e se ela não tiver nome. */
  nomePadrao: string;
  /** Ícone do Material Icons ao lado do nome quando a marca não tem logo. */
  iconeDaMarca: string;
  /** Módulos exclusivos do cliente, somados ao menu da base. As chaves precisam existir nas políticas do banco. */
  modulosExtras: DefinicaoDeModulo[];
  /** Rotas exclusivas do cliente, carregadas dentro do painel (com menu e login). */
  rotasExtras: Routes;
}

export const CLIENTE: ConfiguracaoDoCliente = {
  nomePadrao: 'Painel de Gestão',
  iconeDaMarca: 'inventory_2',
  modulosExtras: [],
  rotasExtras: [],
};
