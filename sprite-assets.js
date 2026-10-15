const ROLE_DIRECTORIES = Object.freeze({
  protagonist: 'Protagonista',
  finalBoss: 'Chefe-Final',
  antagonist: 'Boss-Secundário',
  ally: 'Aliados-do-Protagonista',
  secretBoss: 'Chefe-Secreto',
});

const fileUrls = import.meta.glob('./Jojo-Sprite/**/*.{jpeg,jpg,png,webp}', {
  eager: true,
  import: 'default',
  query: '?url',
});

const normalize = (value) => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]/g, '');

const aliases = Object.freeze({
  jonathan: ['Jonathan Joestar'],
  joseph: ['Joseph Joestar'],
  jotaro: ['Jotaro Kujo', 'JotaroAnime3'],
  josuke4: ['Josuke Higashikata', 'Josuke'],
  giorno: ['Giorno Giovanna'],
  jolyne: ['Jolyne Cujoh'],
  johnny: ['Johnny Joestar', 'Johnny_anime_png'],
  gappy: ['Josuke Higashikata (Gappy)', 'Gappy'],
  jodio: ['Jodio Joestar'],
  'will a. zeppeli': ['Wii A Zeppiin', 'Will A Zeppeli'],
  'diego brando alternativo': ['Diego Brando', 'Diego'],
  'diego brando': ['Diego'],
  'dio': ['Dio_3', 'Dio_1'],
  'dio brando': ['Dio_1', 'Dio'],
  'enrico pucci': ['Pucci'],
  'yoshikage kira': ['Kira_2', 'kira_1', 'Yoshikage Kira', 'Kira'],
  'kars': ['Kars_2', 'Kars'],
  'esidisi': ['EsidisiRender'],
  'foo fighters': ['Foo_Fighers'],
  'sports maxx': ['Sportsmaxx'],
  'n doul': ['N_Doul'],
  'devo': ['Devo-Jojo'],
  'd arby': ["D'arby"],
  'daniel j d arby': ["D'arby"],
  'bruno bucciarati': ['Bucciarati'],
  'will a zeppeli': ['Wii A Zeppiin', 'Will A Zeppeli'],
  'jotaro kujo': ['JotaroAnime3'],
  'noriaki kakyoin': ['Noriaki Kakyoin', 'Kakyoin'],
  'jean pierre polnareff': ['Jean Pierre Polnareff', 'Polnareff'],
  'wonder of u': ['Wonder Of You + Toru', 'Wonder Of You', 'Tooru', 'Toru'],
  tooru: ['Tooru', 'Toru', 'Wonder Of You + Toru'],
  'dio over heaven': ['Dio Over Heaven'],
});
const normalizedAliases = new Map(Object.entries(aliases).map(([name, candidates]) => [normalize(name), candidates]));

export const spriteAssets = Object.freeze(Object.entries(fileUrls)
  .map(([path, url]) => {
    const fileName = path.split('/').at(-1);
    const directory = path.split('/').at(-2);
    const name = fileName.replace(/\.[^.]+$/, '');
    return {
      key: `character-${normalize(directory)}-${normalize(name)}`,
      url,
      path,
      directory,
      name,
      normalizedName: normalize(name),
      comparableName: normalize(name).replace(/\d+$/, ''),
    };
  })
  .sort((first, second) => first.path.localeCompare(second.path)));

export function resolveSpriteAsset(role, ...names) {
  const directory = ROLE_DIRECTORIES[role];
  if (!directory) return null;
  const requested = names.flat(Infinity).filter(Boolean);
  // Keep the caller's priority: character ids and explicit aliases should win
  // over incidental word fragments in a longer display name.
  const normalizedNames = new Map();

  requested.forEach((name, requestIndex) => {
    const normalized = normalize(name);
    if (!normalized) return;
    const add = (candidate, penalty = 0) => {
      const score = 1000 - requestIndex * 20 - penalty;
      normalizedNames.set(candidate, Math.max(normalizedNames.get(candidate) || 0, score));
    };
    add(normalized);
    for (const token of String(name).split(/[^\p{L}\p{N}]+/u)) {
      const normalizedToken = normalize(token);
      if (normalizedToken.length > 2) add(normalizedToken, 100);
    }
    for (const [aliasIndex, alias] of (normalizedAliases.get(normalized) || []).entries()) {
      add(normalize(alias), aliasIndex + 1);
    }
  });

  if (normalizedNames.size === 0) return null;
  const matches = spriteAssets.filter((asset) => asset.directory === directory)
    .map((asset) => {
      let score = 0;
      for (const [candidate, priority] of normalizedNames) {
        if (candidate === asset.normalizedName) score = Math.max(score, priority + 20);
        else if (candidate === asset.comparableName) score = Math.max(score, priority + 16);
        else if (asset.normalizedName.startsWith(candidate)) score = Math.max(score, priority + 5);
        else if (asset.comparableName.startsWith(candidate)) score = Math.max(score, priority + 3);
      }
      return { asset, score };
    })
    .filter(({ score }) => score > 0)
    .sort((first, second) => second.score - first.score || first.asset.path.localeCompare(second.asset.path));

  return matches[0]?.asset || null;
}

export function characterSprite(character) {
  return resolveSpriteAsset('protagonist', character.id, character.short, character.name);
}

export function allySprite(character) {
  return resolveSpriteAsset('ally', character.id, character.name, character.short);
}

export function prepareSpriteImage(image, maxWidth = 256, maxHeight = 384) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const ratio = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight, 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
  canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = pixels;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let read = 0;
  let write = 0;
  const isLightBackground = (index) => {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    return data[index + 3] > 0 && Math.min(red, green, blue) > 224 && Math.max(red, green, blue) - Math.min(red, green, blue) < 28;
  };
  const enqueue = (pixel) => {
    if (visited[pixel] || !isLightBackground(pixel * 4)) return;
    visited[pixel] = 1;
    queue[write] = pixel;
    write += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (read < write) {
    const pixel = queue[read];
    read += 1;
    data[pixel * 4 + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }

  context.putImageData(pixels, 0, 0);
  const depthCanvas = document.createElement('canvas');
  depthCanvas.width = canvas.width + 14;
  depthCanvas.height = canvas.height + 14;
  const depthContext = depthCanvas.getContext('2d');
  depthContext.imageSmoothingEnabled = false;
  depthContext.filter = 'brightness(0.16) saturate(0)';
  for (let depth = 12; depth >= 2; depth -= 2) {
    depthContext.globalAlpha = 0.36;
    depthContext.drawImage(canvas, 4 + depth, 2 + Math.round(depth * 0.42));
  }
  depthContext.filter = 'none';
  depthContext.globalAlpha = 0.75;
  depthContext.shadowColor = '#d8e7b5';
  depthContext.shadowBlur = 3;
  depthContext.shadowOffsetX = -2;
  depthContext.shadowOffsetY = -2;
  depthContext.drawImage(canvas, 4, 1);
  depthContext.globalAlpha = 1;
  depthContext.shadowColor = 'transparent';
  depthContext.shadowBlur = 0;
  depthContext.shadowOffsetX = 0;
  depthContext.shadowOffsetY = 0;
  depthContext.drawImage(canvas, 4, 1);
  return depthCanvas;
}

function imageMimeType(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
}

export async function loadSpriteImages(requestedAssets = spriteAssets, onProgress = () => {}) {
  const assets = [...new Map(requestedAssets.filter(Boolean).map((asset) => [asset.key, asset])).values()];
  const prepared = new Map();
  const queue = [...assets];
  let completed = 0;
  const loadNext = async () => {
    while (queue.length) {
      const asset = queue.shift();
      let objectUrl;
      try {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        const blob = new Blob([bytes], { type: imageMimeType(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 12))) });
        objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.decoding = 'async';
        image.src = objectUrl;
        await image.decode();
        prepared.set(asset.key, prepareSpriteImage(image));
      } catch (error) {
        console.warn(`Sprite indisponível, usando fallback: ${asset.path}`, error);
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        completed += 1;
        onProgress(completed, assets.length);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, assets.length) }, () => loadNext()));
  return prepared;
}
