import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

import { App } from './App';

it('renders the playable browser slice shell', () => {
  const html = renderToStaticMarkup(createElement(App));

  expect(html).toContain('Minority Threat');
  expect(html).toContain('30-second playable slice');
  expect(html).toContain('Load Minority Threat.mp3');
  expect(html).not.toContain('workspace');
});
