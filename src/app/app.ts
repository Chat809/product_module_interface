import { Component } from '@angular/core';
import { Shell } from './core/layout/shell';

@Component({
  selector: 'app-root',
  imports: [Shell],
  template: '<app-shell />',
  styles: ':host { display: block; height: 100%; }',
})
export class App {}
