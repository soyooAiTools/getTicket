import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the pit-game shell copy', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Minority Threat');
  expect(html).toContain('Fixed-song slice');
  expect(html).toContain('Open authoring lab');
  expect(html).toContain('Minority Threat Vertical Slice');
  expect(html).toContain('Load the exact song file to start the slice.');
  expect(html).not.toContain('Workspace bootstrapped. Runtime modules land next.');
});
