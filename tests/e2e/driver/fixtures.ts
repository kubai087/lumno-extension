// Local web pages for the flows, served on 127.0.0.1 so no flow depends on
// the network.
import { createServer } from 'node:http';

const PAGES: Record<string, string> = {
  '/page.html': '<!doctype html><title>Lumno web page</title><h1>Web page</h1>' +
    '<p><a id="target-link" href="/target.html" style="font-size: 32px">Target link</a></p>' +
    `<p>${'text '.repeat(200)}</p>`,
  '/target.html': '<!doctype html><title>Lumno target page</title><h1>Target page</h1>',
  '/fixture.html': '<!doctype html><title>Lumno fixture page</title><h1>Fixture page</h1>'
};

export interface FixtureServer {
  url(pathname: string): string;
  close(): Promise<void>;
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url || '/', 'http://127.0.0.1');
    if (pathname === '/favicon.ico') {
      response.statusCode = 204;
      response.end();
      return;
    }
    const body = PAGES[pathname];
    response.statusCode = body ? 200 : 404;
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(body || 'not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: (pathname) => `http://127.0.0.1:${port}${pathname}`,
    close: () => new Promise((resolve) => server.close(() => resolve()))
  };
}
