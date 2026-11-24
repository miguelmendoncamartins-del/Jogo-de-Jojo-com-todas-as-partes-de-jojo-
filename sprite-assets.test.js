import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'vite';

let vite;
let spriteRegistry;

before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' });
  spriteRegistry = await vite.ssrLoadModule('/sprite-assets.js');
});

after(async () => {
  await vite?.close();
});

test('os nove protagonistas encontram o próprio retrato na pasta Protagonista', () => {
  const expectedFiles = {
    jonathan: 'Jonathan.jpeg',
    joseph: 'Joseph.jpeg',
    jotaro: 'JotaroAnime3.jpeg',
    josuke4: 'Josuke.jpeg',
    giorno: 'Giorno.jpeg',
    jolyne: 'Jolyne.jpeg',
    johnny: 'Johnny_anime_png.jpeg',
    gappy: 'Gappy.jpeg',
    jodio: 'Jodio.jpeg',
  };

  for (const [id, expectedFile] of Object.entries(expectedFiles)) {
    const sprite = spriteRegistry.characterSprite({ id, short: id, name: id });
    assert.ok(sprite, `sprite ausente para ${id}`);
    assert.equal(sprite.directory, 'Protagonista');
    assert.equal(sprite.name, expectedFile.replace(/\.[^.]+$/, ''));
  }
});

test('chefes, antagonistas, aliados e DIO Over Heaven usam as pastas designadas', () => {
  const cases = [
    ['finalBoss', ['Dio Brando'], 'Chefe-Final', 'Dio_1'],
    ['finalBoss', ['Dio'], 'Chefe-Final', 'Dio_3'],
    ['finalBoss', ['Kars'], 'Chefe-Final', 'Kars'],
    ['finalBoss', ['Yoshikage Kira', 'Kira_2'], 'Chefe-Final', 'Kira_2'],
    ['finalBoss', ['Kosaku Kawajiri'], 'Chefe-Final', 'kira_1'],
    ['finalBoss', ['Diavolo'], 'Chefe-Final', 'Diavolo'],
    ['finalBoss', ['Enrico Pucci'], 'Chefe-Final', 'Pucci'],
    ['finalBoss', ['Funny Valentine'], 'Chefe-Final', 'funny-valentine'],
    ['antagonist', ['Jack, o Estripador', 'Jack_Jojo'], 'Boss-Secundário', 'Jack_Jojo'],
    ['antagonist', ['Aisho Dainenjiyama'], 'Boss-Secundário', 'Aisho Dainenjiyama'],
    ['ally', ['Noriaki Kakyoin', 'Kakyoin'], 'Aliados-do-Protagonista', 'Kakyoin'],
    ['ally', ['Will A. Zeppeli'], 'Aliados-do-Protagonista', 'Wii A Zeppiin'],
    ['secretBoss', ['Dio Over Heaven'], 'Chefe-Secreto', 'Dio Over Heaven'],
    ['finalBoss', ['Tooru', 'Wonder Of You + Toru'], 'Chefe-Final', 'Wonder Of You + Toru'],
  ];

  for (const [role, names, directory, expectedName] of cases) {
    const sprite = spriteRegistry.resolveSpriteAsset(role, names);
    assert.ok(sprite, `sprite ausente para ${names[0]}`);
    assert.equal(sprite.directory, directory);
    assert.equal(sprite.name, expectedName);
  }
});

test('não substitui nomes sem correspondência por retratos de outro personagem', () => {
  assert.equal(spriteRegistry.resolveSpriteAsset('protagonist', 'character-without-art'), null);
});

test('caminhada repete quatro quadros sem reutilizar o ciclo de ataque', () => {
  const { resolveSpriteAction, spriteAnimationFrame } = spriteRegistry;
  const walkFrames = Array.from({ length: 4 }, (_, index) => spriteAnimationFrame('walk', index / 9));

  assert.deepEqual(walkFrames, [0, 1, 2, 3]);
  assert.equal(spriteAnimationFrame('walk', 4 / 9), walkFrames[0]);
  assert.equal(spriteAnimationFrame('attack', 1 / 15), 1);
  assert.equal(spriteAnimationFrame('idle', 1 / 3), 1);
  assert.throws(() => spriteAnimationFrame('run', 0), RangeError);

  const frames = { idle: [1, 2, 3, 4], walk: [5, 6, 7, 8], special: [9, 10, 11, 12], 'skill-1': [13, 14, 15, 16] };
  assert.equal(resolveSpriteAction(frames, false, true, 'skill-1'), 'walk');
  assert.equal(resolveSpriteAction(frames, false, false, 'skill-1'), 'idle');
  assert.equal(resolveSpriteAction(frames, true, true, 'skill-1'), 'skill-1');
  assert.equal(resolveSpriteAction({ idle: [1] }, true, true, 'skill-1'), 'idle');
});

test('sprites pixel-art dos nove protagonistas incluem tiras de idle, caminhada e ataques', async () => {
  const protagonists = ['Jonathan', 'Joseph', 'JotaroAnime3', 'Josuke', 'Giorno', 'Jolyne', 'Johnny_anime_png', 'Gappy', 'Jodio'];
  const actions = ['idle', 'walk', 'special', 'skill-0', 'skill-1', 'skill-2', 'skill-3'];

  for (const protagonist of protagonists) {
    for (const action of actions) {
      const path = join(process.cwd(), 'public', 'pixel-sprites', 'animations', 'Protagonista', protagonist, `${action}.png`);
      const image = await readFile(path);
      assert.equal(image.toString('hex', 0, 8), '89504e470d0a1a0a', `${protagonist}/${action} não é PNG`);
      const width = image.readUInt32BE(16);
      assert.equal(width % 4, 0, `${protagonist}/${action} deve ter quatro quadros iguais`);
    }
  }
});