import { Observable, from, map, switchMap } from 'rxjs';
import { SupabaseService } from './supabase.service';

const BUCKET = 'avatars';
const EXTENSOES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Caminho dentro do bucket a partir da URL pública gravada em `perfis.avatar_url`. */
function caminhoDa(url: string | null | undefined): string | null {
  const marcador = `/object/public/${BUCKET}/`;
  const posicao = url?.indexOf(marcador) ?? -1;
  return url && posicao >= 0 ? decodeURIComponent(url.slice(posicao + marcador.length).split('?')[0]) : null;
}

/**
 * Envia a foto para `avatars/{usuario}/...` (o bucket é público para leitura) e grava a URL no perfil.
 * As políticas do Storage deixam cada pessoa mexer só na própria pasta, e o administrador em todas.
 */
export function enviarAvatar(supabase: SupabaseService, usuarioId: string, arquivo: File, urlAnterior?: string | null): Observable<string> {
  const caminho = `${usuarioId}/avatar-${Date.now()}.${EXTENSOES[arquivo.type] ?? 'img'}`;
  return supabase
    .executar<unknown>(() => supabase.cliente.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type, upsert: true }))
    .pipe(
      map(() => supabase.cliente.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl),
      switchMap((url) =>
        supabase
          .executar<unknown>(() => supabase.cliente.from('perfis').update({ avatar_url: url }).eq('id', usuarioId))
          .pipe(map(() => url)),
      ),
      switchMap((url) => apagarArquivo(supabase, urlAnterior).pipe(map(() => url))),
    );
}

export function removerAvatar(supabase: SupabaseService, usuarioId: string, urlAtual: string | null | undefined): Observable<void> {
  return supabase
    .executar<unknown>(() => supabase.cliente.from('perfis').update({ avatar_url: null }).eq('id', usuarioId))
    .pipe(switchMap(() => apagarArquivo(supabase, urlAtual)));
}

/** Apagar a foto antiga é faxina: se falhar, o perfil já está certo. */
function apagarArquivo(supabase: SupabaseService, url: string | null | undefined): Observable<void> {
  const caminho = caminhoDa(url);
  if (!caminho) {
    return from(Promise.resolve());
  }
  return from(
    supabase.cliente.storage
      .from(BUCKET)
      .remove([caminho])
      .then(
        () => undefined,
        () => undefined,
      ),
  );
}
