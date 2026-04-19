import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the pit-game shell copy', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Hardcore Pit Prototype');
  expect(html).toContain('Workspace bootstrapped. Runtime modules land next.');
});
