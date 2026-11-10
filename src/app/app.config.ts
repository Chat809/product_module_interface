import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { PreloadAllModules, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { ConfiguracaoService } from './core/configuracao/configuracao.service';
import { PaginadorIntl } from './core/i18n/paginador-intl';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Marca, módulos ligados e sessão salva são lidos antes da primeira rota, para os guards já decidirem certo.
    provideAppInitializer(() => {
      const configuracao = inject(ConfiguracaoService);
      const auth = inject(AuthService);
      return Promise.all([configuracao.carregar().catch(() => undefined), auth.iniciar().catch(() => undefined)]);
    }),
    // Os módulos são baixados em segundo plano depois da primeira tela, para a navegação não esperar a rede.
    provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules)),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'BRL' },
    { provide: MatPaginatorIntl, useClass: PaginadorIntl },
  ],
};
