const http = require('node:http');
const { URL } = require('node:url');

const { createRentBackend } = require('./service');

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function parseJsonBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = '';

    request.on('data', (chunk) => {
      rawBody += chunk;

      if (rawBody.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        request.destroy();
      }
    });

    request.on('end', () => {
      if (!rawBody) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(rawBody));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });

    request.on('error', reject);
  });
}

function matchRoute(pathname, expression) {
  const match = pathname.match(expression);
  return match ? match.slice(1) : null;
}

const backend = createRentBackend({
  filename: process.env.RENT_AUTOMATION_DB_FILE,
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === 'GET' && pathname === '/health') {
      sendJson(response, 200, {
        ok: true,
        service: 'rent-automation-backend',
      });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/state') {
      sendJson(response, 200, backend.getState());
      return;
    }

    if (request.method === 'POST' && pathname === '/api/auth/demo-login') {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.bootstrap(body));
      return;
    }

    if (request.method === 'PATCH' && pathname === '/api/property') {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.updateProperty(body));
      return;
    }

    if (request.method === 'PATCH' && pathname === '/api/settlement') {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.updateSettlement(body));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/rooms') {
      const body = await parseJsonBody(request);
      sendJson(response, 201, backend.addRoom(body));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/tenancies/invite') {
      const body = await parseJsonBody(request);
      sendJson(response, 201, backend.inviteTenant(body));
      return;
    }

    const tenantProfileMatch = matchRoute(pathname, /^\/api\/tenants\/([^/]+)\/profile$/);
    if (request.method === 'PATCH' && tenantProfileMatch) {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.completeTenantProfile(tenantProfileMatch[0], body));
      return;
    }

    const activateTenancyMatch = matchRoute(pathname, /^\/api\/tenancies\/([^/]+)\/activate$/);
    if (request.method === 'POST' && activateTenancyMatch) {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.activateTenancy(activateTenancyMatch[0], body));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/invoices') {
      const body = await parseJsonBody(request);
      sendJson(response, 201, backend.generateInvoice(body));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/payments/submissions') {
      const body = await parseJsonBody(request);
      sendJson(response, 201, backend.submitPayment(body));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/payments/review') {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.reviewPayment(body));
      return;
    }

    const reminderMatch = matchRoute(pathname, /^\/api\/reminders\/([^/]+)\/status$/);
    if (request.method === 'PATCH' && reminderMatch) {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.updateReminderStatus(reminderMatch[0], body.deliveryStatus));
      return;
    }

    const moveOutMatch = matchRoute(pathname, /^\/api\/tenancies\/([^/]+)\/move-out$/);
    if (request.method === 'POST' && moveOutMatch) {
      const body = await parseJsonBody(request);
      sendJson(response, 200, backend.scheduleMoveOut(moveOutMatch[0], body.moveOutDate));
      return;
    }

    const closeTenancyMatch = matchRoute(pathname, /^\/api\/tenancies\/([^/]+)\/close$/);
    if (request.method === 'POST' && closeTenancyMatch) {
      sendJson(response, 200, backend.closeTenancy(closeTenancyMatch[0]));
      return;
    }

    sendJson(response, 404, {
      error: 'Route not found.',
      path: pathname,
    });
  } catch (error) {
    const statusCode =
      /not found|required|unable|only|missing|already|must|invalid|choose|use owner|schedule/i.test(
        error.message,
      )
        ? 400
        : 500;

    sendJson(response, statusCode, {
      error: error.message,
    });
  }
});

const port = Number(process.env.PORT || 4000);

server.listen(port, () => {
  console.log(`Rent backend listening on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  backend.close();
  server.close(() => process.exit(0));
});
