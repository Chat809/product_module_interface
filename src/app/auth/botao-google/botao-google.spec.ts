import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { Notificacao } from '../../core/feedback/notificacao.service';
import { BotaoGoogle } from './botao-google';

describe('BotaoGoogle', () => {
  let fixture: ComponentFixture<BotaoGoogle>;
  let auth: { entrarComGoogle: ReturnType<typeof vi.fn> };
  let notificacao: { erro: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { entrarComGoogle: vi.fn(() => new Promise<void>(() => {})) };
    notificacao = { erro: vi.fn() };
    TestBed.configureTestingModule({
      imports: [BotaoGoogle],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Notificacao, useValue: notificacao },
      ],
    });
    fixture = TestBed.createComponent(BotaoGoogle);
    await fixture.whenStable();
  });

  function botao(): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button')!;
  }

  it('deve mostrar o rótulo padrão e aceitar outro', async () => {
    expect(botao().textContent).toContain('Entrar com Google');
    fixture.componentRef.setInput('rotulo', 'Criar conta com Google');
    await fixture.whenStable();
    expect(botao().textContent).toContain('Criar conta com Google');
  });

  it('deve ir ao Google levando a rota de volta e travar o botão', async () => {
    fixture.componentRef.setInput('voltar', '/produtos');
    botao().click();
    await fixture.whenStable();

    expect(auth.entrarComGoogle).toHaveBeenCalledWith('/produtos');
    expect(botao().disabled).toBe(true);
    expect(botao().textContent).toContain('Abrindo o Google...');
  });

  it('deve liberar o botão e avisar se o navegador não conseguir iniciar o login', async () => {
    auth.entrarComGoogle.mockReturnValue(Promise.reject(new Error('sem crypto.subtle')));
    botao().click();
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();

    expect(notificacao.erro).toHaveBeenCalledWith('Não foi possível abrir o login com Google neste navegador.');
    expect(botao().disabled).toBe(false);
  });
});
