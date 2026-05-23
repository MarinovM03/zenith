import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { App } from './app';
import { ApiService, HealthResponse } from './core/services/api.service';

describe('App', () => {
  function configure(apiMock: Partial<ApiService>) {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: ApiService, useValue: apiMock }],
    });
  }

  it('renders the title', async () => {
    configure({
      health: () => of<HealthResponse>({ status: 'ok', service: 'acca-server', version: '0.1.0' }),
    });

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Acca');
  });

  it('shows the API status when /health succeeds', async () => {
    configure({
      health: () => of<HealthResponse>({ status: 'ok', service: 'acca-server', version: '0.1.0' }),
    });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status--ok');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('acca-server');
  });

  it('shows an error message when /health fails', async () => {
    configure({ health: () => throwError(() => new Error('boom')) });

    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('.status--error');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain('boom');
  });
});
