import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, finalize } from 'rxjs';
import { ACESSO_TOTAL, MODULOS, ROTULOS_PAPEL } from '../../core/auth/acessos';
import { Modulo, Papel, Usuario } from '../../core/auth/auth.model';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { ProblemDetail } from '../../core/http/error.interceptor';
import { TAMANHO_MAXIMO_AVATAR, TIPOS_DE_AVATAR } from '../../perfil/perfil.service';
import { Avatar } from '../../shared/avatar/avatar';
import { UsuarioService } from '../usuario.service';

export interface UsuarioFormData {
  /** Sem usuário, o diálogo cria uma conta nova (com senha inicial). */
  usuario?: Usuario;
  /** O admin não pode tirar de si mesmo o papel de administrador. */
  ehVoce: boolean;
}

/** Mesmo padrão de uma conta criada pelo cadastro: Dashboard, Produtos e Demandas. */
const NOVO_USUARIO: Usuario = {
  id: '',
  nome: '',
  email: '',
  papel: 'USUARIO',
  acessos: ['dashboard', 'produtos', 'demandas'],
  criadoEm: null,
};

/** Sugestões do campo Departamento; a API aceita qualquer texto de até 80 caracteres. */
export const DEPARTAMENTOS = [
  'Administrativo',
  'Comercial',
  'Compras',
  'Financeiro',
  'Logística',
  'Operações',
  'Recursos Humanos',
  'Tecnologia',
];

type Campo = 'nome' | 'email' | 'senha' | 'departamento' | 'funcao';

const MENSAGENS: Record<Campo, [validador: string, mensagem: string][]> = {
  nome: [
    ['required', 'O nome é obrigatório'],
    ['pattern', 'O nome é obrigatório'],
    ['maxlength', 'O nome deve ter no máximo 100 caracteres'],
  ],
  email: [
    ['required', 'O e-mail é obrigatório'],
    ['email', 'Informe um e-mail válido'],
    ['maxlength', 'O e-mail deve ter no máximo 254 caracteres'],
  ],
  senha: [
    ['required', 'A senha é obrigatória'],
    ['minlength', 'A senha deve ter pelo menos 6 caracteres'],
    ['maxlength', 'A senha deve ter no máximo 72 caracteres'],
  ],
  departamento: [['maxlength', 'O departamento deve ter no máximo 80 caracteres']],
  funcao: [['maxlength', 'O cargo deve ter no máximo 80 caracteres']],
};

function textoOuNulo(valor: string): string | null {
  return valor.trim() || null;
}

@Component({
  selector: 'app-usuario-form-dialog',
  imports: [
    Avatar,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  templateUrl: './usuario-form.html',
  styleUrl: './usuario-form.scss',
})
export class UsuarioFormDialog {
  private readonly usuarioService = inject(UsuarioService);
  private readonly dialogRef = inject<MatDialogRef<UsuarioFormDialog, Usuario>>(MatDialogRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly data = inject<UsuarioFormData>(MAT_DIALOG_DATA);

  private readonly notificacao = inject(Notificacao);

  protected readonly criando = !this.data.usuario;
  protected readonly usuario = this.data.usuario ?? NOVO_USUARIO;
  protected readonly ehVoce = this.data.ehVoce;
  protected readonly senhaVisivel = signal(false);
  protected readonly papeis: Papel[] = ['USUARIO', 'ADMIN'];
  protected readonly rotulos = ROTULOS_PAPEL;
  /** O módulo de usuários não entra na lista: ele vem do papel ADMIN. */
  protected readonly modulos = MODULOS.filter((m) => !m.somenteAdmin);
  protected readonly tiposAceitos = TIPOS_DE_AVATAR.join(',');
  protected readonly salvando = signal(false);
  protected readonly enviandoFoto = signal(false);
  protected readonly avatarUrl = signal(this.usuario.avatarUrl ?? null);

  /** A foto é gravada na hora, sem esperar o "Salvar"; a lista é avisada mesmo se o diálogo for cancelado. */
  readonly avatarAlterado = output<Usuario>();

  protected readonly form = this.fb.group({
    nome: [this.usuario.nome, [Validators.required, Validators.maxLength(100), Validators.pattern(/\S/)]],
    email: [this.usuario.email, [Validators.required, Validators.email, Validators.maxLength(254)]],
    senha: ['', this.criando ? [Validators.required, Validators.minLength(6), Validators.maxLength(72)] : []],
    departamento: [this.usuario.departamento ?? '', [Validators.maxLength(80)]],
    funcao: [this.usuario.funcao ?? '', [Validators.maxLength(80)]],
    papel: [{ value: this.usuario.papel, disabled: this.ehVoce }],
    total: [this.usuario.acessos.includes(ACESSO_TOTAL)],
    modulos: this.fb.group(
      Object.fromEntries(this.modulos.map((m) => [m.chave, this.usuario.acessos.includes(m.chave)])) as Record<
        Modulo,
        boolean
      >,
    ),
  });

  protected readonly papel = toSignal(this.form.controls.papel.valueChanges, {
    initialValue: this.usuario.papel,
  });
  protected readonly total = toSignal(this.form.controls.total.valueChanges, {
    initialValue: this.form.controls.total.value,
  });

  private readonly departamentoDigitado = toSignal(this.form.controls.departamento.valueChanges, {
    initialValue: this.form.controls.departamento.value,
  });
  protected readonly departamentos = computed(() => {
    const termo = this.departamentoDigitado().trim().toLocaleLowerCase('pt-BR');
    return DEPARTAMENTOS.filter((d) => d.toLocaleLowerCase('pt-BR').includes(termo));
  });

  /** A API confere o conteúdo do arquivo; aqui só se evita enviar o que já se sabe que será recusado. */
  protected escolherFoto(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const arquivo = campo.files?.[0];
    campo.value = '';
    if (!arquivo) {
      return;
    }
    if (!TIPOS_DE_AVATAR.includes(arquivo.type)) {
      this.notificacao.erro('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_AVATAR) {
      this.notificacao.erro('A imagem deve ter no máximo 2 MB.');
      return;
    }
    this.trocarFoto(this.usuarioService.enviarAvatar(this.usuario.id, arquivo), 'Foto atualizada.');
  }

  protected removerFoto(): void {
    this.trocarFoto(this.usuarioService.removerAvatar(this.usuario.id), 'Foto removida.');
  }

  protected salvar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const valor = this.form.getRawValue();
    const dados = {
      nome: valor.nome.trim(),
      email: valor.email.trim(),
      papel: valor.papel,
      acessos: this.acessosEscolhidos(),
      departamento: textoOuNulo(valor.departamento),
      funcao: textoOuNulo(valor.funcao),
    };
    this.salvando.set(true);
    (this.criando
      ? this.usuarioService.criar({ ...dados, senha: valor.senha })
      : this.usuarioService.atualizar(this.usuario.id, dados)
    )
      .pipe(
        finalize(() => this.salvando.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (salvo) => this.dialogRef.close(salvo),
        error: (erro: HttpErrorResponse) => this.tratarErro(erro),
      });
  }

  protected mensagemDeErro(campo: Campo): string {
    const erros = this.form.controls[campo].errors;
    if (!erros) {
      return '';
    }
    return erros['api'] ?? MENSAGENS[campo].find(([validador]) => erros[validador])?.[1] ?? 'Valor inválido';
  }

  /** Mesma forma que a API grava: `['*']` ou os módulos marcados, na ordem do menu. */
  private acessosEscolhidos(): string[] {
    const { papel, total, modulos } = this.form.getRawValue();
    if (papel === 'ADMIN' || total) {
      return [ACESSO_TOTAL];
    }
    return this.modulos.filter((m) => modulos[m.chave]).map((m) => m.chave);
  }

  private trocarFoto(requisicao: Observable<Usuario>, mensagem: string): void {
    this.enviandoFoto.set(true);
    requisicao
      .pipe(
        finalize(() => this.enviandoFoto.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((salvo) => {
        this.avatarUrl.set(salvo.avatarUrl ?? null);
        this.avatarAlterado.emit(salvo);
        this.notificacao.sucesso(mensagem);
      });
  }

  private tratarErro(erro: HttpErrorResponse): void {
    if (erro.status === 409) {
      this.form.controls.email.setErrors({ api: 'Este e-mail já pertence a outra conta' });
    }
    (erro.error as ProblemDetail | null)?.erros?.forEach(({ campo, mensagem }) =>
      this.form.get(campo)?.setErrors({ api: mensagem }),
    );
    this.form.markAllAsTouched();
  }
}
