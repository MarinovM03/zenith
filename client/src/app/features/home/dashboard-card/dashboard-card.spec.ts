import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DashboardCard } from './dashboard-card';

function createCard() {
  TestBed.configureTestingModule({
    imports: [DashboardCard],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(DashboardCard);
  fixture.componentRef.setInput('title', 'Launches');
  fixture.componentRef.setInput('route', '/launches');
  fixture.componentRef.setInput('variant', 'launch');
  return fixture;
}

describe('DashboardCard', () => {
  it('renders the requested card variant and route', () => {
    const fixture = createCard();
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.dash');
    expect(link.classList).toContain('dash--launch');
    expect(link.getAttribute('href')).toBe('/launches');
    expect(link.textContent).toContain('Launches');
  });

  it('renders an optional background image', () => {
    const fixture = createCard();
    fixture.componentRef.setInput('variant', 'mars');
    fixture.componentRef.setInput('backgroundImage', 'https://example.test/mars.jpg');
    fixture.componentRef.setInput('backgroundAlt', 'NAVCAM');
    fixture.detectChanges();

    const image: HTMLImageElement = fixture.nativeElement.querySelector('.dash__bg img');
    expect(image.src).toBe('https://example.test/mars.jpg');
    expect(image.alt).toBe('NAVCAM');
  });

  it('keeps the retry button outside the navigation link and emits retry', () => {
    const fixture = createCard();
    fixture.componentRef.setInput('error', true);
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('.dash');
    const retry: HTMLButtonElement = fixture.nativeElement.querySelector('.dash__retry');
    expect(link.contains(retry)).toBe(false);
    retry.click();
    expect(retried).toBe(true);
  });
});
