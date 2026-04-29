const cors = require('cors');
const express = require('express');

const { createRentBackend, isClientError } = require('./backend');

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  const configuredOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.includes(origin)) {
    return true;
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function createApp(backend) {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS.'));
      },
    }),
  );
  app.use(express.json({ limit: '15mb' }));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      ok: true,
      service: 'rent-automation-backend',
    });
  });

  app.post('/api/auth/login', async (request, response) => {
    response.status(200).json(await backend.login(request.body || {}, { ipAddress: request.ip }));
  });

  app.post('/api/auth/refresh', async (request, response) => {
    response.status(200).json(await backend.refreshAuth(request.body || {}));
  });

  app.post('/api/auth/logout', async (request, response) => {
    response.status(200).json(await backend.logout(request.body || {}));
  });

  app.use('/api', async (request, response, next) => {
    const authorization = request.headers.authorization || '';
    const [, token] = authorization.match(/^Bearer\s+(.+)$/i) || [];

    if (!token) {
      response.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      request.authSession = await backend.getSessionForAccessToken(token);
      next();
    } catch (error) {
      response.status(401).json({ error: error.message || 'Invalid session.' });
    }
  });

  app.get('/api/state', async (request, response) => {
    response.status(200).json(await backend.getState(request.authSession));
  });

  app.post('/api/auth/set-password', async (request, response) => {
    response.status(200).json(await backend.setPassword(request.body || {}, request.authSession));
  });

  app.post('/api/auth/change-password', async (request, response) => {
    response.status(200).json(await backend.changePassword(request.body || {}, request.authSession));
  });

  app.post('/api/property', async (request, response) => {
    response
      .status(201)
      .json(await backend.createProperty(request.body || {}, request.authSession));
  });

  app.patch('/api/property', async (request, response) => {
    response
      .status(200)
      .json(await backend.updateProperty(request.body || {}, request.authSession));
  });

  app.patch('/api/settlement', async (request, response) => {
    response
      .status(200)
      .json(await backend.updateSettlement(request.body || {}, request.authSession));
  });

  app.post('/api/rooms', async (request, response) => {
    response.status(201).json(await backend.addRoom(request.body || {}, request.authSession));
  });

  app.post('/api/tenancies/invite', async (request, response) => {
    response
      .status(201)
      .json(await backend.inviteTenant(request.body || {}, request.authSession));
  });

  app.patch('/api/tenants/:tenantId/profile', async (request, response) => {
    response
      .status(200)
      .json(
        await backend.completeTenantProfile(
          request.params.tenantId,
          request.body || {},
          request.authSession,
        ),
      );
  });

  app.post('/api/tenants/:tenantId/reset-password', async (request, response) => {
    response
      .status(200)
      .json(await backend.resetTenantPassword(request.params.tenantId, request.authSession));
  });

  app.post('/api/tenancies/:tenancyId/activate', async (request, response) => {
    response
      .status(200)
      .json(
        await backend.activateTenancy(
          request.params.tenancyId,
          request.body || {},
          request.authSession,
        ),
      );
  });

  app.post('/api/invoices', async (request, response) => {
    response
      .status(201)
      .json(await backend.generateInvoice(request.body || {}, request.authSession));
  });

  app.post('/api/meter-readings/submissions', async (request, response) => {
    response
      .status(201)
      .json(await backend.submitMeterReading(request.body || {}, request.authSession));
  });

  app.post('/api/meter-readings/review', async (request, response) => {
    response
      .status(200)
      .json(await backend.reviewMeterReading(request.body || {}, request.authSession));
  });

  app.post('/api/payments/submissions', async (request, response) => {
    response
      .status(201)
      .json(await backend.submitPayment(request.body || {}, request.authSession));
  });

  app.post('/api/payments/review', async (request, response) => {
    response
      .status(200)
      .json(await backend.reviewPayment(request.body || {}, request.authSession));
  });

  app.patch('/api/reminders/:reminderId/status', async (request, response) => {
    response
      .status(200)
      .json(
        await backend.updateReminderStatus(
          request.params.reminderId,
          request.body?.deliveryStatus,
          request.authSession,
        ),
      );
  });

  app.post('/api/tenancies/:tenancyId/move-out', async (request, response) => {
    response
      .status(200)
      .json(
        await backend.scheduleMoveOut(
          request.params.tenancyId,
          request.body?.moveOutDate,
          request.authSession,
        ),
      );
  });

  app.post('/api/tenancies/:tenancyId/close', async (request, response) => {
    response
      .status(200)
      .json(await backend.closeTenancy(request.params.tenancyId, request.authSession));
  });

  app.use((request, response) => {
    response.status(404).json({
      error: 'Route not found.',
      path: request.path,
    });
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      response.status(400).json({ error: 'Invalid JSON body.' });
      return;
    }

    const statusCode = isClientError(error) ? 400 : 500;
    response.status(statusCode).json({
      error: error.message || 'Unexpected server error.',
    });
  });

  return app;
}

async function startServer() {
  const backend = createRentBackend();
  await backend.ready();

  const app = createApp(backend);
  const port = Number(process.env.PORT || 4000);
  const server = app.listen(port, () => {
    console.log(`Rent backend listening on http://localhost:${port}`);
  });

  const shutdown = async () => {
    await backend.close();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', () => {
    shutdown().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    shutdown().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  });

  return { app, backend, server };
}

module.exports = {
  createApp,
  startServer,
};
