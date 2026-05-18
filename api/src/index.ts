import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { openAPISpecs } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { runMigrations } from './db/migrate.js';
import authRoutes from './auth/routes.js';

const app = new Hono();

app.route('/auth', authRoutes);

app.get(
  '/openapi',
  openAPISpecs(app, {
    documentation: {
      info: { title: 'Multipicross API', version: '1.0.0', description: 'Multipicross game API' },
      servers: [
        { url: 'http://api.multipicross.localhost', description: 'Development (Traefik)' },
        { url: 'http://localhost:3001', description: 'Development (direct)' },
      ],
    },
  }),
);

app.get('/docs', Scalar({ spec: { url: '/openapi' } }));

await runMigrations();

serve(
  { fetch: app.fetch, port: 3000 },
  (info) => console.log(`Server is running on http://localhost:${info.port}`),
);
