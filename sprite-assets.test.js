import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
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
    ['finalBoss', ['Yoshikage Kira', 'Kira_2'], 'Chefe-Final', 'Kira_2'],
    ['finalBoss', ['Enrico Pucci'], 'Chefe-Final', 'Pucci'],
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
  const { spriteAnimationFrame } = spriteRegistry;
  const walkFrames = Array.from({ length: 4 }, (_, index) => spriteAnimationFrame('walk', index / 9));

  assert.deepEqual(walkFrames, [0, 1, 2, 3]);
  assert.equal(spriteAnimationFrame('walk', 4 / 9), walkFrames[0]);
  assert.equal(spriteAnimationFrame('attack', 1 / 15), 1);
  assert.equal(spriteAnimationFrame('idle', 1 / 3), 1);
  assert.throws(() => spriteAnimationFrame('run', 0), RangeError);
});