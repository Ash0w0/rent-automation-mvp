const { createApp } = require('../server/app');
const { createRentBackend } = require('../server/backend');

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const backend = createRentBackend();
      await backend.ready();
      return createApp(backend);
    })();
  }

  return appPromise;
}

module.exports = async (request, response) => {
  const app = await getApp();
  return app(request, response);
};
