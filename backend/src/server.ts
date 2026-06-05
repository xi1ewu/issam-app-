import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setupSocketHandlers } from './socket/chatHandler';
import { seedSubscriptionPlans } from './config/seedPlans';
import { setIO } from './config/socketSingleton';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST'],
  },
});

app.locals.io = io;
setIO(io);
setupSocketHandlers(io);

const PORT = parseInt(process.env.PORT || '3000', 10);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`DA Consulting API running on port ${PORT}`);
  await seedSubscriptionPlans().catch(e => console.error('[seed] plan seed failed:', e));
});
