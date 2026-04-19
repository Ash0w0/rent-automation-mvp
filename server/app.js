const cors = require('cors');
const express = require('express');

const { createRentBackend, isClientError } = require('./backend');
const { getUploadsDir } = require('./uploads');

function createApp(backend) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '15mb' }));
  app.use('/uploads', express.static(getUploadsDir()));

  app.get('/health', (_request, response) => {
    response.status(200).json({
      ok: true,
      service: 'rent-automation-backend',
    });
  });

  app.post('/api/auth/request-otp', async (request, response) => {
    response.status(200).json(await backend.requestOtp(request.body || {}));
  });

  app.post('/api/auth/verify-otp', async (request, response) => {
    response.status(200).json(await backend.verifyOtp(request.body || {}));
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
      request.authState = await backend.getStateForAccessToken(token);
      next();
    } catch (error) {
      response.status(401).json({ error: error.message || 'Invalid session.' });
    }
  });

  app.get('/api/state', async (request, response) => {
    response.status(200).json(request.authState);
  });

  app.patch('/api/property', async (request, response) => {
    response.status(200).json(await backend.updateProperty(request.body || {}));
  });

  app.patch('/api/settlement', async (request, response) => {
    response.status(200).json(await backend.updateSettlement(request.body || {}));
  });

  app.post('/api/rooms', async (request, response) => {
    response.status(201).json(await backend.addRoom(request.body || {}));
  });

  app.post('/api/tenancies/invite', async (request, response) => {
    response.status(201).json(await backend.inviteTenant(request.body || {}));
  });

  app.patch('/api/tenants/:tenantId/profile', async (request, response) => {
    response
      .status(200)
      .json(await backend.completeTenantProfile(request.params.tenantId, request.body || {}));
  });

  app.post('/api/tenancies/:tenancyId/activate', async (request, response) => {
    response
      .status(200)
      .json(await backend.activateTenancy(request.params.tenancyId, request.body || {}));
  });

  app.post('/api/invoices', async (request, response) => {
    response.status(201).json(await backend.generateInvoice(request.body || {}));
  });

  app.post('/api/meter-readings/submissions', async (request, response) => {
    response.status(201).json(await backend.submitMeterReading(request.body || {}));
  });

  app.post('/api/meter-readings/review', async (request, response) => {
    response.status(200).json(await backend.reviewMeterReading(request.body || {}));
  });

  app.post('/api/payments/submissions', async (request, response) => {
    response.status(201).json(await backend.submitPayment(request.body || {}));
  });

  app.post('/api/payments/review', async (request, response) => {
    response.status(200).json(await backend.reviewPayment(request.body || {}));
  });

  app.patch('/api/reminders/:reminderId/status', async (request, response) => {
    response
      .status(200)
      .json(
        await backend.updateReminderStatus(
          request.params.reminderId,
          request.body?.deliveryStatus,
        ),
      );
  });

  app.post('/api/tenancies/:tenancyId/move-out', async (request, response) => {
    response
      .status(200)
      .json(await backend.scheduleMoveOut(request.params.tenancyId, request.body?.moveOutDate));
  });

  app.post('/api/tenancies/:tenancyId/close', async (request, response) => {
    response.status(200).json(await backend.closeTenancy(request.params.tenancyId));
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
