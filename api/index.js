// Build the shared app before Vercel bundles this function.
// Importing the app does not start a standalone listener.
module.exports = require('../server/dist/app.js').default;
