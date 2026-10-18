import { httpServerHandler } from 'cloudflare:node';
import app from '../server/src/app';

// Workers dispatches API requests to Express through its Node HTTP adapter.
// Static files and client-side routes are handled by the assets configuration.
app.listen(3000);
export default httpServerHandler({ port: 3000 });
