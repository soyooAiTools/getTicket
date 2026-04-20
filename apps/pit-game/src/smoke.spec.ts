import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the pit-game shell copy', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Hardcore Pit Prototype');
  expect(html).toContain('Simulation live');
  expect(html).toContain('HUD is already updating from the default authored profile.');
  expect(html).not.toContain('Workspace bootstrapped. Runtime modules land next.');
});
