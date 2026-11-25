import { defineConfig } from 'vite';
import { cpSync } from 'node:fs';
import { createHash, timingSafeEqual } from 'node:crypto';

const lanRooms = new Map();

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 16_384) {
        reject(new Error('Solicitação muito grande.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new Error('JSON inválido.')); }
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  return createHash('sha256').update(`lan-room:${password}`).digest();
}

function passwordsMatch(actual, expected) {
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function localLanRooms() {
  return {
    name: 'local-lan-rooms',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (!url.pathname.startsWith('/__lan/rooms')) return next();
        const respond = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify(data));
        };
        try {
          for (const [code, room] of lanRooms) if (Date.now() - room.updatedAt > 3 * 60 * 60 * 1000) lanRooms.delete(code);
          if (req.method === 'POST' && url.pathname === '/__lan/rooms') {
            const body = await readJson(req);
            const password = String(body.password || '').trim();
            if (!password) return respond(400, { error: 'Defina uma senha para criar a sala online.' });
            let code;
            do { code = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join(''); } while (lanRooms.has(code));
            const token = crypto.randomUUID();
            const room = { code, passwordHash: hashPassword(password), mode: String(body.mode || 'VERSUS').slice(0, 24), players: [{ token, name: String(body.name || 'Jogador 1').slice(0, 24), character: null }], inputs: [{ x: 0, y: 0, running: false, attack: 0, dash: 0 }, { x: 0, y: 0, running: false, attack: 0, dash: 0 }], snapshot: null, started: false, updatedAt: Date.now() };
            lanRooms.set(code, room);
            return respond(201, { code, token, slot: 0, room: { code, mode: room.mode, players: room.players.map(({ name, character }) => ({ name, character })), started: false } });
          }
          const parts = url.pathname.split('/').filter(Boolean);
          const code = (parts[2] || '').toUpperCase();
          const action = parts[3];
          const room = lanRooms.get(code);
          if (!room) return respond(404, { error: 'Sala não encontrada ou expirada.' });
          if (req.method === 'POST' && action === 'join') {
            if (room.players.length >= 2) return respond(409, { error: 'A sala já está cheia.' });
            const body = await readJson(req);
            const providedPassword = String(body.password || '').trim();
            if (!providedPassword || !passwordsMatch(hashPassword(providedPassword), room.passwordHash)) return respond(403, { error: 'Senha da sala incorreta.' });
            const token = crypto.randomUUID();
            room.players.push({ token, name: String(body.name || 'Jogador 2').slice(0, 24), character: null });
            room.updatedAt = Date.now();
            return respond(200, { code, token, slot: 1, room: { code, mode: room.mode, players: room.players.map(({ name, character }) => ({ name, character })), started: false } });
          }
          const body = action === 'poll' ? null : await readJson(req);
          const authorization = req.headers.authorization || '';
          const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
          const slot = room.players.findIndex((player) => player.token === bearerToken);
          if (slot < 0) return respond(403, { error: 'Este navegador não pertence a essa sala.' });
          if (req.method === 'GET' && action === 'poll') {
            room.updatedAt = Date.now();
            return respond(200, { code, mode: room.mode, players: room.players.map(({ name, character }) => ({ name, character })), inputs: room.inputs, snapshot: room.snapshot, started: room.started });
          }
          if (req.method === 'POST' && action === 'select') {
            const character = String(body.character || '');
            if (!/^[a-z0-9-]{1,32}$/.test(character)) return respond(400, { error: 'Personagem inválido.' });
            room.players[slot].character = character;
            room.updatedAt = Date.now();
            return respond(200, { players: room.players.map(({ name, character: selected }) => ({ name, character: selected })) });
          }
          if (req.method === 'POST' && action === 'start') {
            if (slot !== 0) return respond(403, { error: 'Somente quem criou a sala pode iniciar.' });
            if (room.players.length !== 2 || room.players.some((player) => !player.character)) return respond(409, { error: 'Os dois jogadores precisam entrar e escolher um personagem.' });
            room.started = true;
            room.updatedAt = Date.now();
            return respond(200, { started: true });
          }
          if (req.method === 'POST' && action === 'input') {
            room.inputs[slot] = {
              x: Math.max(-1, Math.min(1, Number(body.input?.x) || 0)),
              y: Math.max(-1, Math.min(1, Number(body.input?.y) || 0)),
              running: Boolean(body.input?.running),
              attack: Math.max(room.inputs[slot].attack, Number(body.input?.attack) || 0),
              dash: Math.max(room.inputs[slot].dash, Number(body.input?.dash) || 0),
            };
            room.updatedAt = Date.now();
            return respond(200, { ok: true });
          }
          if (req.method === 'POST' && action === 'snapshot') {
            if (slot !== 0) return respond(403, { error: 'Somente o anfitrião publica o estado da partida.' });
            const snapshot = body.snapshot;
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.player || !snapshot.rival && snapshot.rival !== null) return respond(400, { error: 'Snapshot inválido.' });
            const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
            if (!finiteNumber(snapshot.player.x) || !finiteNumber(snapshot.player.y) || !finiteNumber(snapshot.player.hp)) return respond(400, { error: 'Snapshot inválido.' });
            if (snapshot.rival && (!finiteNumber(snapshot.rival.x) || !finiteNumber(snapshot.rival.y) || !finiteNumber(snapshot.rival.hp))) return respond(400, { error: 'Snapshot inválido.' });
            room.snapshot = snapshot;
            room.updatedAt = Date.now();
            return respond(200, { ok: true });
          }
          return respond(405, { error: 'Ação inválida.' });
        } catch (error) {
          return respond(400, { error: error.message || 'Erro ao processar a sala.' });
        }
      });
    },
  };
}

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  base,
  plugins: [{
    name: 'copy-jojo-sprites-for-static-runtime',
    apply: 'build',
    closeBundle() {
      cpSync('Jojo-Sprite', 'dist/Jojo-Sprite', { recursive: true });
      cpSync('vendor', 'dist/vendor', { recursive: true });
    },
  }, localLanRooms()],
});
