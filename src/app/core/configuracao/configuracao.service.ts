import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CLIENTE } from '../../cliente/cliente';
import { SupabaseService } from '../supabase/supabase.service';

export interface Marca {
  nome: string;
  nomeCurto: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
}

export interface ModuloAtivo {
  modulo: string;
  rotulo: string;
  ativo: boolean;
  ordem: number;
}

const MARCA_PADRAO: Marca = {
  nome: CLIENTE.nomePadrao,
  nomeCurto: null,
  corPrimaria: null,
  corSecundaria: null,
  logoUrl: null,
  faviconUrl: null,
};

/** Cor clara o bastante para pedir texto escuro por cima (luminância relativa). */
function corClara(hex: string): boolean {
  const valor = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(valor)) {
    return false;
  }
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(valor.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.6;
}

/**
 * Marca e módulos ligados, lidos de `parametros_sistema` e `modulos_ativos` antes da primeira tela.
 * São linhas públicas: valem também para o login e as páginas públicas.
 */
@Injectable({ providedIn: 'root' })
export class ConfiguracaoService {
  private readonly supabase = inject(SupabaseService);
  private readonly documento = inject(DOCUMENT);

  readonly marca = signal<Marca>(MARCA_PADRAO);
  readonly modulos = signal<ModuloAtivo[]>([]);
  /** `null` enquanto não carregou: nesse caso nenhum módulo é escondido. */
  readonly modulosLigados = computed(() => {
    const lista = this.modulos();
    return lista.length ? new Set(lista.filter((m) => m.ativo).map((m) => m.modulo)) : null;
  });

  async carregar(): Promise<void> {
    const [parametros, modulos] = await Promise.all([
      this.supabase.cliente.from('parametros_sistema').select('chave, valor').eq('publico', true),
      this.supabase.cliente.from('modulos_ativos').select('modulo, rotulo, ativo, ordem').order('ordem'),
    ]);
    const marca = (parametros.data ?? []).find((p) => p.chave === 'marca')?.valor as Record<string, string | null> | undefined;
    if (marca) {
      this.aplicarMarca({
        nome: marca['nome'] || CLIENTE.nomePadrao,
        nomeCurto: marca['nome_curto'] ?? null,
        corPrimaria: marca['cor_primaria'] ?? null,
        corSecundaria: marca['cor_secundaria'] ?? null,
        logoUrl: marca['logo_url'] ?? null,
        faviconUrl: marca['favicon_url'] ?? null,
      });
    } else {
      this.aplicarMarca(MARCA_PADRAO);
    }
    this.modulos.set((modulos.data ?? []) as ModuloAtivo[]);
  }

  moduloLigado(modulo: string): boolean {
    return this.modulosLigados()?.has(modulo) ?? true;
  }

  aplicarMarca(marca: Marca): void {
    this.marca.set(marca);
    this.documento.title = marca.nome;
    const raiz = this.documento.documentElement.style;
    if (marca.corPrimaria) {
      raiz.setProperty('--mat-sys-primary', marca.corPrimaria);
      raiz.setProperty('--mat-sys-on-primary', corClara(marca.corPrimaria) ? '#1b1b1f' : '#ffffff');
    } else {
      raiz.removeProperty('--mat-sys-primary');
      raiz.removeProperty('--mat-sys-on-primary');
    }
    if (marca.corSecundaria) {
      raiz.setProperty('--app-cor-secundaria', marca.corSecundaria);
    } else {
      raiz.removeProperty('--app-cor-secundaria');
    }
    if (marca.faviconUrl) {
      const icone = this.documento.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (icone) {
        icone.href = marca.faviconUrl;
      }
    }
  }
}
