import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Avatar } from './avatar';

describe('Avatar', () => {
  let fixture: ComponentFixture<Avatar>;
  let elemento: HTMLElement;

  async function exibir(nome: string, url: string | null = null): Promise<void> {
    fixture.componentRef.setInput('nome', nome);
    fixture.componentRef.setInput('url', url);
    await fixture.whenStable();
  }

  beforeEach(() => {
    fixture = TestBed.createComponent(Avatar);
    elemento = fixture.nativeElement;
  });

  it('sem foto deve mostrar as iniciais do primeiro e do último nome', async () => {
    await exibir('Maria da Silva Souza');
    expect(elemento.textContent?.trim()).toBe('MS');

    await exibir('khalil');
    expect(elemento.textContent?.trim()).toBe('K');

    await exibir('   ');
    expect(elemento.textContent?.trim()).toBe('?');
  });

  it('deve mostrar a foto e voltar às iniciais se ela não carregar', async () => {
    await exibir('Maria Souza', 'https://exemplo.com/foto.png');
    const imagem = elemento.querySelector('img')!;
    expect(imagem.getAttribute('src')).toBe('https://exemplo.com/foto.png');
    expect(imagem.alt).toBe('Foto de Maria Souza');

    imagem.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(elemento.querySelector('img')).toBeNull();
    expect(elemento.textContent?.trim()).toBe('MS');

    await exibir('Maria Souza', 'https://exemplo.com/outra.png');
    expect(elemento.querySelector('img')).not.toBeNull();
  });
});
