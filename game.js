const Phaser = globalThis.Phaser;
import { campaigns, getCampaignForCharacter } from './campaigns.js';
import { allySprite, characterSprite, loadSpriteImages, resolveSpriteAsset, resolveSpriteAction, spriteAnimationFrame } from './sprite-assets.js';
import {
  normalizeSave,
  STORY_PHASES,
  completeStage,
  createSecretEncounter,
  finishStage,
  recordBattleVictory,
  recordDialogue,
  recordEnvironmentChange,
  recordObjective,
  recordSecretBossVictory,
  transitionPhase,
  unlockCampaignAfterCompletion,
} from './story-progression.js';

const $ = (selector) => document.querySelector(selector);
const ARENA_WIDTH = 960;
const ARENA_HEIGHT = 540;
const canvas = { width: ARENA_WIDTH, height: ARENA_HEIGHT };
const STORAGE_KEY = 'eternal-destiny-save-v1';
const colorPalette = ['#d7d869', '#7bb5a4', '#bc8091', '#719bd0', '#d6ae54', '#91b8a2', '#d48a57', '#74b9c2', '#97b759'];
let ctx;
let arenaSurface;
let arenaTexture;
let gameScene;
let physicsObjects = [];
const preparedSprites = new Map();
const pendingSpriteKeys = new Set();

const makeSkill = (id, name, type, damage, range, energy, cooldown, duration, effect, animation, tier) => ({
  id, name, type, damage, range, energy, cooldown, duration, effect, animation, tier,
});

const characters = [
  {
    id: 'jonathan', name: 'Jonathan Joestar', short: 'JONATHAN', stand: 'HAMON', part: 1, era: 'INGLATERRA, 1880', boss: 'DIO BRANDO', color: colorPalette[0],
    skills: [
      makeSkill('sunlight-yellow', 'Sunlight Yellow Overdrive', 'melee', 74, 125, 25, 6500, 0.65, 'hamon', 'charged-barrage', 'initial'),
      makeSkill('scarlet-overdrive', 'Scarlet Overdrive', 'break', 112, 155, 32, 10500, 0.85, 'guard-break', 'red-hamon-strike', 'advanced'),
      makeSkill('eternal-sun', 'Eternal Sun Overdrive', 'ultimate', 195, 205, 52, 22000, 1.2, 'interrupt', 'sunlight-impact', 'supreme'),
    ],
  },
  {
    id: 'joseph', name: 'Joseph Joestar', short: 'JOSEPH', stand: 'HAMON · ESTRATÉGIA', part: 2, era: 'NOVA YORK, 1938', boss: 'KARS', color: colorPalette[1],
    skills: [
      makeSkill('ripple-trap', 'Ripple Trap', 'trap', 64, 155, 22, 6500, 5, 'root', 'ground-trap', 'initial'),
      makeSkill('ultimate-counter', 'Ultimate Counter', 'counter', 125, 155, 28, 9500, 2.4, 'counter', 'counter-flash', 'advanced'),
      makeSkill('master-prediction', 'Master of Prediction', 'predict', 175, 205, 46, 20000, 3.1, 'interrupt', 'prediction-vision', 'supreme'),
    ],
  },
  {
    id: 'jotaro', name: 'Jotaro Kujo', short: 'JOTARO', stand: 'STAR PLATINUM', part: 3, era: 'EGITO, 1988', boss: 'DIO', color: colorPalette[2],
    skills: [
      makeSkill('star-platinum-barrage', 'Star Platinum Barrage', 'melee', 79, 128, 26, 6200, 0.6, 'stagger', 'rapid-barrage', 'initial'),
      makeSkill('star-finger', 'Star Finger', 'pierce', 112, 250, 30, 9500, 0.8, 'pierce', 'finger-extension', 'advanced'),
      makeSkill('the-world', 'Star Platinum: The World', 'time', 142, 170, 48, 20500, 2.2, 'time-stop', 'time-freeze', 'supreme'),
    ],
    heavenSkills: [
      makeSkill('over-heaven-barrage', 'Over Heaven Barrage', 'melee', 168, 145, 28, 6500, 0.9, 'stagger', 'heaven-barrage', 'awakening'),
      makeSkill('reality-overwrite', 'Reality Overwrite', 'overwrite', 188, 215, 38, 11500, 1.2, 'overwrite', 'reality-crack', 'awakening'),
      makeSkill('temporal-clash', 'The World Over Heaven — Temporal Clash', 'time', 135, 210, 43, 18500, 2.5, 'time-stop', 'temporal-clash', 'awakening'),
      makeSkill('final-impact', 'Over Heaven: Final Impact', 'ultimate', 288, 240, 62, 31000, 1.7, 'final-impact', 'cinematic-impact', 'awakening'),
    ],
  },
  {
    id: 'josuke4', name: 'Josuke Higashikata', short: 'JOSUKE', stand: 'CRAZY DIAMOND', part: 4, era: 'MORIOH, 1999', boss: 'YOSHIKAGE KIRA', color: colorPalette[3],
    skills: [
      makeSkill('crazy-diamond-rush', 'Crazy Diamond Rush', 'melee', 76, 130, 24, 6200, 0.65, 'stagger', 'rapid-barrage', 'initial'),
      makeSkill('restoration-field', 'Restoration Field', 'heal', 0, 155, 34, 18000, 1.2, 'heal', 'reconstruction', 'advanced'),
      makeSkill('reconstructed-impact', 'Crazy Diamond: Reconstructed Impact', 'ultimate', 208, 215, 48, 23500, 1.35, 'object-impact', 'reconstructed-impact', 'supreme'),
    ],
  },
  {
    id: 'giorno', name: 'Giorno Giovanna', short: 'GIORNO', stand: 'GOLD EXPERIENCE', part: 5, era: 'ITÁLIA, 2001', boss: 'DIAVOLO', color: colorPalette[4],
    skills: [
      makeSkill('life-creation', 'Life Creation', 'create', 56, 185, 23, 6800, 3, 'decoy', 'life-burst', 'initial'),
      makeSkill('enhanced-creation', 'Enhanced Life Creation', 'create', 105, 215, 33, 10000, 3.5, 'decoy', 'golden-life', 'advanced'),
      makeSkill('return-to-zero', 'Gold Experience Requiem — Return to Zero', 'requiem', 180, 205, 58, 28500, 1.7, 'nullify', 'zero-reset', 'supreme'),
    ],
  },
  {
    id: 'jolyne', name: 'Jolyne Cujoh', short: 'JOLYNE', stand: 'STONE FREE', part: 6, era: 'GREEN DOLPHIN, 2011', boss: 'ENRICO PUCCI', color: colorPalette[5],
    skills: [
      makeSkill('stone-free-barrage', 'Stone Free Barrage', 'melee', 74, 130, 24, 6200, 0.6, 'stagger', 'string-barrage', 'initial'),
      makeSkill('string-trap', 'String Trap', 'trap', 79, 165, 27, 9000, 5, 'root', 'string-snare', 'advanced'),
      makeSkill('mobius-defense', 'Mobius Defense', 'counter', 191, 200, 49, 22500, 2.8, 'reality-defense', 'mobius-fold', 'supreme'),
    ],
  },
  {
    id: 'johnny', name: 'Johnny Joestar', short: 'JOHNNY', stand: 'TUSK · SPIN', part: 7, era: 'OESTE AMERICANO, 1890', boss: 'FUNNY VALENTINE', color: colorPalette[6],
    skills: [
      makeSkill('tusk-act-1', 'Tusk Act 1', 'projectile', 64, 330, 22, 6200, 0.9, 'projectile', 'nail-shot', 'initial'),
      makeSkill('tusk-act-2', 'Tusk Act 2', 'projectile', 112, 395, 32, 10500, 1.1, 'terrain-shot', 'spiral-trail', 'advanced'),
      makeSkill('infinite-rotation', 'Tusk Act 4 — Infinite Rotation', 'ultimate', 226, 435, 55, 26500, 1.8, 'interrupt', 'infinite-rotation', 'supreme'),
    ],
  },
  {
    id: 'gappy', name: 'Josuke Higashikata', short: 'GAPPY', stand: 'SOFT & WET', part: 8, era: 'MORIOH, 2011', boss: 'TOORU', color: colorPalette[7],
    skills: [
      makeSkill('soft-wet-bubbles', 'Soft & Wet Bubbles', 'projectile', 67, 320, 23, 6200, 0.9, 'projectile', 'bubble-shot', 'initial'),
      makeSkill('property-extraction', 'Property Extraction', 'debuff', 78, 220, 31, 10500, 3.3, 'slow', 'property-steal', 'advanced'),
      makeSkill('go-beyond', 'Go Beyond', 'ultimate', 236, 470, 54, 27000, 1.5, 'dimensional-pierce', 'beyond-bubble', 'supreme'),
    ],
  },
  {
    id: 'jodio', name: 'Jodio Joestar', short: 'JODIO', stand: 'NOVEMBER RAIN', part: 9, era: 'HAWAI, 2023', boss: 'CHEFE DA PARTE 9', color: colorPalette[8],
    skills: [
      makeSkill('november-rain', 'November Rain', 'area', 68, 165, 24, 6900, 1.2, 'rain', 'rain-zone', 'initial'),
      makeSkill('focused-rain', 'Focused Rain', 'area', 115, 105, 33, 10800, 1.25, 'rain', 'focused-rain', 'advanced'),
      makeSkill('heavens-pressure', "November Rain — Heaven's Pressure", 'ultimate', 202, 185, 51, 24500, 1.9, 'heavy-rain', 'heavens-pressure', 'supreme'),
    ],
  },
];

characters.forEach((character) => {
  character.spriteAsset = characterSprite(character);
  if (!character.spriteAsset) console.warn(`Sprite de protagonista não encontrado: ${character.name}`);
});

const bosses = [
  { id: 'dio1', name: 'DIO BRANDO', x: 720, y: 245, hp: 400, color: '#bd6852', size: 1.1 },
  { id: 'kars', name: 'KARS', x: 720, y: 245, hp: 420, color: '#bf6d86', size: 1.08 },
  { id: 'dio3', name: 'DIO', x: 720, y: 245, hp: 450, color: '#c17858', size: 1.12 },
  { id: 'kira', name: 'YOSHIKAGE KIRA', x: 720, y: 245, hp: 425, color: '#b777a5', size: 1.05 },
  { id: 'diavolo', name: 'DIAVOLO', x: 720, y: 245, hp: 445, color: '#bd7457', size: 1.08 },
  { id: 'pucci', name: 'ENRICO PUCCI', x: 720, y: 245, hp: 435, color: '#77aabd', size: 1.04 },
  { id: 'valentine', name: 'FUNNY VALENTINE', x: 720, y: 245, hp: 450, color: '#bb7185', size: 1.1 },
  { id: 'tooru', name: 'TOORU', x: 720, y: 245, hp: 440, color: '#76aa91', size: 1.04 },
  { id: 'part9', name: 'CHEFE DA PARTE 9', x: 720, y: 245, hp: 445, color: '#94a34f', size: 1.08 },
];
const finalBosses = [
  { id: 'dio-heaven', name: 'DIO OVER HEAVEN', x: 711, y: 225, hp: 720, color: '#f0d75a', size: 1.23, attackTimer: 1.1 },
  { id: 'pucci-heaven', name: 'PUCCI · MADE IN HEAVEN', x: 775, y: 330, hp: 690, color: '#e18dca', size: 1.14, attackTimer: 2.2 },
];
const kakyoinSupport = {
  id: 'kakyoin',
  name: 'Noriaki Kakyoin',
  stand: 'HIEROPHANT GREEN',
  color: '#71a27c',
  skills: [
    { id: 'kakyoin-emerald-splash', name: 'Emerald Splash', damage: 132, range: 310, stun: 0.8 },
    { id: 'kakyoin-barrier', name: 'Hierophant Green · Barrier', damage: 105, range: 175, stun: 1.25 },
  ],
};
const assistCast = ['kakyoin', 'jolyne', 'joseph', 'giorno', 'jonathan', 'josuke4', 'johnny', 'gappy', 'jodio'];

function loadSave() {
  try {
    return normalizeSave(JSON.parse(localStorage.getItem(STORAGE_KEY)), campaigns);
  } catch {
    return normalizeSave(null, campaigns);
  }
}

const save = loadSave();
const state = {
  selected: 0,
  mode: 'campaign',
  fightActive: true,
  secretPhase: 0,
  secretRunPhase: null,
  secretCampaignId: null,
  jotaroAwakened: false,
  player: { x: 380, y: 320, facingX: 1, facingY: 0, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attackTimer: 0, attackAction: 'special', hitFlash: 0, isMoving: false, statuses: { freeze: 0, slow: 0, confuse: 0, burn: 0, burnTick: 0 }, physicsZone: null, body: null },
  enemies: [],
  cooldowns: {},
  effects: [],
  particles: [],
  keys: new Set(),
  touchAxis: { x: 0, y: 0 },
  elapsed: 0,
  attackCooldown: 0,
  invulnerable: 0,
  assistCooldown: 0,
  assist: null,
  screenShake: 0,
  cinematicUntil: 0,
  sound: false,
  nextUiUpdate: 0,
  storyStage: null,
};
let audioContext;
let musicTimer;
let musicStep = 0;
let toastTimeout;
let unlockTimeout;
let dialogueTimeout;
let activeDialogueSignature = '';
const characterSfx = new Map();
const characterSfxPlayedAt = new Map();
const CHARACTER_SFX = Object.freeze({
  jonathan: 'jojo-punch.mp3',
  joseph: 'jojos-bizarre-adventure-ay-ay-ay-ay-_-sound-effect.mp3',
  jotaro: 'jojo-punch.mp3',
  josuke4: 'dojyan.mp3',
  giorno: '7-page-muda-giorno.mp3',
  jolyne: 'jojo-punch.mp3',
  johnny: 'tusk-chimimi.mp3',
  gappy: 'dojyan.mp3',
  jodio: 'jojo-punch.mp3',
  kakyoin: 'jojo-punch.mp3',
  dio: 'dio-wryyy.mp3',
  dio1: 'dio-wryyy.mp3',
  dio3: 'dio-wryyy.mp3',
  'dio-heaven': 'dio-wryyy.mp3',
});
const ZA_WARUDO_SFX = 'za-warudo-toki-wo-tomare_WJVdsYt.mp3';
let dioHurtSfxCount = 0;
function playNamedSfx(file) {
  if (!state.sound) return;
  let audio = characterSfx.get(file);
  if (!audio) {
    const modulePath = new URL(import.meta.url).pathname;
    const sfxDirectory = modulePath.includes('/public/game/') || modulePath.endsWith('/game/game.js') ? './SFX/' : './Jojo-Sprite/SFX/';
    audio = new Audio(new URL(`${sfxDirectory}${file}`, import.meta.url).href);
    audio.preload = 'auto'; audio.volume = 0.65; characterSfx.set(file, audio);
  }
  audio.currentTime = 0; audio.play().catch(() => {});
}

function selectedCharacter() { return characters[state.selected]; }
function selectedCampaign() { return getCampaignForCharacter(selectedCharacter().id); }
function currentCampaignProgress(characterId = selectedCharacter().id) { return save.story.campaigns[characterId]; }
function currentCampaignStage(characterId = selectedCharacter().id) {
  const campaign = getCampaignForCharacter(characterId);
  const progress = currentCampaignProgress(characterId);
  return campaign && progress ? campaign.stages[progress.stageIndex] || null : null;
}
function isPart3Dio(enemy) {
  return selectedCampaign()?.id === 'jotaro' && normalizeVillainName(enemy?.name || '') === 'dio';
}
function hasCampaignAccess(characterId) { return save.story.unlockedCampaignIds.includes(characterId); }
function isOverHeaven() { return state.mode === 'final' && state.secretPhase === 2 && state.jotaroAwakened && selectedCharacter().id === 'jotaro'; }
function availableSkills() { return isOverHeaven() ? selectedCharacter().heavenSkills : selectedCharacter().skills; }
function isUnlocked(skill, character = selectedCharacter()) {
  if (skill.tier === 'initial' || skill.tier === 'awakening') return skill.tier !== 'awakening' || (state.jotaroAwakened && character.id === 'jotaro' && state.mode === 'final' && state.secretPhase === 2);
  const campaign = getCampaignForCharacter(character.id);
  const progress = currentCampaignProgress(character.id);
  if (skill.tier === 'advanced') return save.advanced.includes(character.id) || progress.stageIndex >= 2;
  const campaignFinalStageReached = state.mode === 'campaign' && campaign && progress.stageIndex >= campaign.stages.length - 1;
  const secretFinalPhaseReached = save.supreme.includes(character.id) && state.mode === 'final' && state.secretPhase === 2;
  return Boolean(campaignFinalStageReached || secretFinalPhaseReached);
}
function persistSave() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch { showToast('O salvamento local está indisponível neste navegador.'); }
}

async function loadSpritesInBackground(assets) {
  const missing = [...new Map(assets.filter((asset) => asset && !preparedSprites.has(asset.key) && !pendingSpriteKeys.has(asset.key)).map((asset) => [asset.key, asset])).values()];
  if (missing.length === 0) return;
  missing.forEach((asset) => pendingSpriteKeys.add(asset.key));
  try {
    const loadedSprites = await loadSpriteImages(missing, (loaded, total) => {
      if (loaded === total) $('#battle-message').textContent = `RETRATOS CARREGADOS · ${total}`;
    });
    loadedSprites.forEach((sprite, key) => {
      preparedSprites.set(key, sprite);
      if (gameScene && !gameScene.textures.exists(key)) gameScene.textures.addCanvas(key, sprite);
    });
    buildRoster();
    updateInterface(true);
  } catch (error) {
    console.error('Falha ao preparar alguns retratos; a arena mantém o fallback.', error);
  } finally {
    missing.forEach((asset) => pendingSpriteKeys.delete(asset.key));
  }
}

function updateStoryPanel() {
  const panel = $('#story-panel');
  if (!panel) return;
  const action = $('#story-action');
  if (state.mode === 'final') {
    action.hidden = false;
    const campaign = currentSecretCampaign();
    const stage = state.storyStage;
    let kicker = 'HISTÓRIA SECRETA';
    let location = '';
    let title = '';
    let text = '';
    let objective = '';
    let actionLabel = 'CONTINUAR';
    let dialogueId = null;

    if (state.secretRunPhase === 'revenge-intro' && campaign && stage) {
      kicker = `REVANCHE · PARTE ${campaign.part} / ${campaigns.length}`;
      location = stage.location.toUpperCase();
      title = `${campaign.secretBoss} voltou mais forte`;
      text = `A derrota anterior nao conteve ${campaign.secretBoss}. ${stage.scene} O chefe retorna com 50% a mais em seus atributos.`;
      objective = `CHEFE FORTALECIDO · ${campaign.secretBoss.toUpperCase()} · +50% ATRIBUTOS`;
      actionLabel = 'INICIAR REVANCHE';
      dialogueId = `secret:${campaign.id}:intro`;
    } else if (state.secretRunPhase === 'revenge-post' && campaign && stage) {
      kicker = `VITÓRIA REGISTRADA · PARTE ${campaign.part} / ${campaigns.length}`;
      location = stage.location.toUpperCase();
      title = `${campaign.secretBoss} foi derrotado novamente`;
      text = `A distorção causada nesta Parte diminuiu. ${stage.environmentChange}`;
      objective = save.story.secretStageIndex < campaigns.length ? `PRÓXIMO CHEFE · ${campaigns[save.story.secretStageIndex].secretBoss}` : 'AS NOVE REVANCHES FORAM CONCLUÍDAS';
      actionLabel = 'CONTINUAR A HISTÓRIA SECRETA';
      dialogueId = `secret:${campaign.id}:victory`;
    } else if (state.secretRunPhase === 'final-intro') {
      kicker = 'AS NOVE PARTES · CONFRONTO FINAL';
      location = 'ARENA FORA DO ESPAÇO-TEMPO';
      title = 'A equipe contra DIO e Pucci';
      text = 'Jotaro, Kakyoin e Jolyne abrem caminho contra Pucci com Made in Heaven e DIO Over Heaven. A primeira vitória dos vilões inicia uma transformação, não apaga o seu progresso.';
      objective = 'CONFRONTO EM DUAS FASES · A ASSISTÊNCIA É MANUAL';
      actionLabel = 'REUNIR A EQUIPE';
    } else if (state.secretRunPhase === 'complete') {
      kicker = 'ETERNAL DESTINY · CONCLUÍDO';
      location = 'O ESPAÇO-TEMPO SE ESTABILIZOU';
      title = 'A ameaça chegou ao fim';
      text = 'A distorção desaparece e os nove protagonistas conseguem voltar às suas jornadas.';
      objective = 'VITÓRIA · HISTÓRIA SECRETA ENCERRADA';
      action.hidden = true;
    } else {
      panel.hidden = true;
      scheduleDialogueAdvance(null, action);
      return;
    }

    if (dialogueId && campaign) {
      const progress = currentCampaignProgress(campaign.id);
      if (recordDialogue(progress, dialogueId)) persistSave();
    }
    $('#story-kicker').textContent = kicker;
    $('#story-location').textContent = location;
    $('#story-title').textContent = title;
    $('#story-text').textContent = text;
    $('#story-objective').textContent = objective;
    action.textContent = actionLabel;
    action.disabled = false;
    panel.hidden = false;
    scheduleDialogueAdvance(dialogueId, action);
    return;
  }
  if (state.mode !== 'campaign') {
    if (panel) panel.hidden = true;
    scheduleDialogueAdvance(null, $('#story-action'));
    return;
  }
  const campaign = selectedCampaign();
  const progress = currentCampaignProgress();
  const stage = currentCampaignStage();
  if (stage && !requiresInvestigation(campaign, stage) && [STORY_PHASES.EXPLORATION, STORY_PHASES.OBJECTIVE_ACTIVE].includes(progress.phase)) {
    progress.phase = STORY_PHASES.ENEMY_ENCOUNTER;
    const eventId = `skip-investigation:${stage.id}`;
    if (!progress.processedEventIds.includes(eventId)) progress.processedEventIds.push(eventId);
    persistSave();
  }
  let kicker = `${campaign.protagonist.toUpperCase()} · PARTE ${campaign.part}`;
  let location = '';
  let title = '';
  let text = '';
  let objective = '';
  let actionLabel = 'CONTINUAR';
  let dialogueId = null;

  if (!stage || progress.phase === STORY_PHASES.CAMPAIGN_COMPLETE) {
    kicker = 'CAMPANHA CONCLUÍDA';
    location = campaign.openEnded ? 'CAPÍTULOS REPRESENTADOS · HISTÓRIA ABERTA' : campaign.title.toUpperCase();
    title = campaign.openEnded ? 'O caminho continua' : `${campaign.protagonist} · jornada concluída`;
    text = campaign.openEnded
      ? 'Os capítulos representados neste protótipo foram concluídos. The JOJOLands permanece sem um desfecho definitivo; esta campanha pode receber novas fases.'
      : `A jornada de ${campaign.protagonist} chegou ao seu encerramento. O próximo protagonista está disponível.`;
    const nextCampaign = campaigns.find((entry) => entry.part > campaign.part && save.story.unlockedCampaignIds.includes(entry.id));
    if (nextCampaign) {
      objective = `${nextCampaign.protagonist.toUpperCase()} · PARTE ${nextCampaign.part} DESBLOQUEADA`;
      actionLabel = `CONTINUAR PARA ${nextCampaign.protagonist.toUpperCase()}`;
      action.hidden = false;
      action.disabled = false;
    } else if (save.story.secretUnlocked) {
      objective = 'As nove campanhas estão completas. A história secreta foi liberada.';
      actionLabel = 'INICIAR HISTÓRIA SECRETA';
      action.hidden = false;
      action.disabled = false;
    } else {
      objective = 'Seu progresso está salvo. A próxima campanha será liberada ao concluir esta jornada.';
      actionLabel = 'CAMPANHA CONCLUÍDA';
      action.hidden = false;
      action.disabled = true;
    }
  } else {
    location = stage.location.toUpperCase();
    switch (progress.phase) {
      case STORY_PHASES.INTRO:
        title = stage.title;
        text = stage.dialogue.intro;
        objective = `FASE ${progress.stageIndex + 1} / ${campaign.stages.length}`;
        actionLabel = 'ENTRAR NA ÁREA';
        dialogueId = `${stage.id}:intro`;
        break;
      case STORY_PHASES.EXPLORATION:
        title = 'Reconheça o local';
        text = stage.scene;
        objective = `PRÓXIMO OBJETIVO · ${stage.objective.label}`;
        actionLabel = 'EXPLORAR';
        break;
      case STORY_PHASES.OBJECTIVE_ACTIVE:
        title = 'Investigue o cenário';
        text = `A pista está marcada na arena. Aproxime-se dela e pressione F para ${stage.objective.label.toLowerCase()}.`;
        objective = 'OBJETIVO ATIVO · LOCALIZE O MARCADOR';
        actionLabel = 'APROXIME-SE DA PISTA';
        action.disabled = true;
        break;
      case STORY_PHASES.ENEMY_ENCOUNTER:
        title = stage.enemies.map((enemy) => enemy.name).join(' e ');
        text = stage.dialogue.encounter;
        objective = `CONFRONTO · ${stage.enemies.length} ${stage.enemies.length === 1 ? 'INIMIGO' : 'INIMIGOS'}`;
        actionLabel = 'INICIAR CONFRONTO';
        dialogueId = `${stage.id}:encounter`;
        break;
      case STORY_PHASES.BOSS_FIGHT:
        panel.hidden = true;
        scheduleDialogueAdvance(null, action);
        return;
      case STORY_PHASES.POST_BATTLE:
        title = 'A luta mudou o rumo';
        text = stage.dialogue.victory;
        objective = `CONSEQUÊNCIA · ${stage.environmentChange}`;
        actionLabel = 'VER CONSEQUÊNCIAS';
        dialogueId = `${stage.id}:victory`;
        break;
      case STORY_PHASES.ENVIRONMENT_CHANGED:
        title = 'O cenário mudou';
        text = stage.environmentChange;
        objective = 'A alteração do ambiente abre um caminho para a próxima fase.';
        actionLabel = 'LIBERAR CAMINHO';
        break;
      case STORY_PHASES.NEXT_STAGE_UNLOCKED:
        title = 'Próximo trecho desbloqueado';
        text = `A pista e o caminho desta batalha foram registrados. ${campaign.protagonist} pode seguir adiante.`;
        objective = stage.pathId.toUpperCase();
        actionLabel = 'CONCLUIR FASE';
        break;
      case STORY_PHASES.STAGE_COMPLETE:
        title = `${stage.title} · concluída`;
        text = stage.dialogue.victory;
        objective = progress.stageIndex + 1 < campaign.stages.length ? 'O próximo capítulo será iniciado.' : 'Esta era a última fase representada nesta campanha.';
        actionLabel = 'AVANÇAR HISTÓRIA';
        break;
      default:
        panel.hidden = true;
        scheduleDialogueAdvance(null, action);
        return;
    }
    action.hidden = progress.phase === STORY_PHASES.OBJECTIVE_ACTIVE;
    action.disabled = false;
  }

  if (dialogueId && recordDialogue(progress, dialogueId)) persistSave();
  $('#story-kicker').textContent = kicker;
  $('#story-location').textContent = location;
  $('#story-title').textContent = title;
  $('#story-text').textContent = text;
  $('#story-objective').textContent = objective;
  action.textContent = actionLabel;
  panel.hidden = false;
  scheduleDialogueAdvance(dialogueId, action);
}

function scheduleDialogueAdvance(dialogueId, action) {
  const signature = dialogueId && !action.disabled && !action.hidden
    ? `${dialogueId}:${action.textContent}` : '';
  if (signature === activeDialogueSignature) return;
  activeDialogueSignature = signature;
  window.clearTimeout(dialogueTimeout);
  action.classList.remove('dialogue-countdown');
  if (!signature) return;
  action.classList.add('dialogue-countdown');
  dialogueTimeout = window.setTimeout(() => {
    if (activeDialogueSignature === signature && !action.disabled && !action.hidden) action.click();
  }, 5000);
}

function requiresInvestigation(campaign, stage) {
  return Boolean(campaign && stage?.objective);
}

function changeStoryPhase(nextPhase, eventId) {
  const progress = currentCampaignProgress();
  if (!transitionPhase(progress, nextPhase, eventId)) return false;
  persistSave();
  if (nextPhase === STORY_PHASES.BOSS_FIGHT) {
    createCampaignBoss(state.storyStage);
    state.fightActive = true;
  } else {
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
  }
  updateStoryPanel();
  updateInterface(true);
  return true;
}

function interactWithStoryObjective() {
  if (state.mode !== 'campaign') return;
  const progress = currentCampaignProgress();
  const stage = state.storyStage;
  if (!stage || progress.phase !== STORY_PHASES.OBJECTIVE_ACTIVE) return;
  const objective = stage.objective;
  if (distance(state.player, objective) > 180) {
    showToast('Aproxime-se do marcador para investigar.');
    return;
  }
  if (!recordObjective(progress, objective.id)) return;
  progress.flags[`objective:${objective.id}`] = true;
  progress.phase = STORY_PHASES.ENEMY_ENCOUNTER;
  progress.processedEventIds.push(`objective:${objective.id}`);
  recordDialogue(progress, `${stage.id}:encounter`);
  persistSave();
  state.fightActive = false;
  updateStoryPanel();
  updateInterface(true);
  playTone(630, 0.1);
}

function continueSecretStory() {
  const campaign = currentSecretCampaign();
  if (state.secretRunPhase === 'revenge-intro' && campaign) {
    if (!createSecretRevengeBoss()) return;
    state.secretRunPhase = 'revenge-battle';
    state.fightActive = true;
    state.player.hp = state.player.maxHp;
    state.player.physicsZone?.setPosition(state.player.x, state.player.y);
    updateStoryPanel();
    updateInterface(true);
    $('#battle-message').textContent = `${campaign.protagonist} enfrenta ${campaign.secretBoss}, agora fortalecido.`;
    return;
  }

  if (state.secretRunPhase === 'revenge-post' && campaign) {
    state.player.hp = state.player.maxHp;
    state.player.energy = state.player.maxEnergy;
    state.cooldowns = {};
    state.player.x = 380;
    state.player.y = 320;
    if (save.story.secretStageIndex < campaigns.length) {
      state.secretCampaignId = campaigns[save.story.secretStageIndex].id;
      state.storyStage = currentSecretCampaign().stages.at(-1);
      state.secretRunPhase = 'revenge-intro';
      state.enemies = [];
    } else {
      state.secretCampaignId = null;
      state.storyStage = null;
      state.secretRunPhase = 'final-intro';
      state.enemies = [];
    }
    attachPhysicsBodies();
    persistSave();
    updateStoryPanel();
    updateInterface(true);
    return;
  }

  if (state.secretRunPhase === 'final-intro') {
    state.secretRunPhase = 'final-battle';
    state.secretPhase = 0;
    state.jotaroAwakened = false;
    state.fightActive = true;
    state.storyStage = null;
    state.player.hp = state.player.maxHp;
    state.player.energy = state.player.maxEnergy;
    createFinalBosses();
    updateStoryPanel();
    updateInterface(true);
    $('#battle-message').textContent = 'Jotaro, Kakyoin e Jolyne enfrentam DIO Over Heaven e Pucci com Made in Heaven.';
  }
}

function continueStory() {
  if (state.mode === 'final') {
    continueSecretStory();
    return;
  }
  const campaign = selectedCampaign();
  const progress = currentCampaignProgress();
  const stage = state.storyStage;
  if (!stage && progress.phase === STORY_PHASES.CAMPAIGN_COMPLETE) {
    const nextCampaign = campaigns.find((entry) => entry.part > campaign.part && save.story.unlockedCampaignIds.includes(entry.id));
    if (nextCampaign) {
      const nextCharacterIndex = characters.findIndex((character) => character.id === nextCampaign.id);
      if (nextCharacterIndex >= 0) {
        state.selected = nextCharacterIndex;
        resetBattle('campaign');
        $('#battle-message').textContent = `${nextCampaign.protagonist} inicia sua campanha.`;
      }
      return;
    }
    if (save.story.secretUnlocked) {
      switchMode('final');
      return;
    }
  }
  if (!stage) return;

  switch (progress.phase) {
    case STORY_PHASES.INTRO:
      if (requiresInvestigation(campaign, stage)) changeStoryPhase(STORY_PHASES.EXPLORATION, `enter:${stage.id}`);
      else changeStoryPhase(STORY_PHASES.ENEMY_ENCOUNTER, `encounter:${stage.id}`);
      break;
    case STORY_PHASES.EXPLORATION:
      changeStoryPhase(STORY_PHASES.OBJECTIVE_ACTIVE, `explore:${stage.id}`);
      break;
    case STORY_PHASES.ENEMY_ENCOUNTER:
      changeStoryPhase(STORY_PHASES.BOSS_FIGHT, `fight:${stage.id}`);
      break;
    case STORY_PHASES.POST_BATTLE:
      changeStoryPhase(STORY_PHASES.ENVIRONMENT_CHANGED, `change:${stage.id}`);
      break;
    case STORY_PHASES.ENVIRONMENT_CHANGED:
      if (recordEnvironmentChange(progress, stage)) {
        persistSave();
        updateStoryPanel();
        updateInterface(true);
      }
      break;
    case STORY_PHASES.NEXT_STAGE_UNLOCKED:
      if (finishStage(progress, stage)) {
        persistSave();
        updateStoryPanel();
        updateInterface(true);
      }
      break;
    case STORY_PHASES.STAGE_COMPLETE: {
      const wasFinalStage = progress.stageIndex === campaign.stages.length - 1;
      const completedStageIndex = progress.stageIndex;
      const entersThirdStage = completedStageIndex === 1 && !save.advanced.includes(campaign.id);
      const entersFinalBossStage = completedStageIndex === campaign.stages.length - 2 && !save.supreme.includes(campaign.id);
      if (!completeStage(progress, campaign)) return;
      if (entersThirdStage) unlockAdvanced(selectedCharacter());
      if (entersFinalBossStage) {
        const message = entersThirdStage
          ? `${selectedCharacter().skills[1].name} e ${selectedCharacter().skills[2].name} disponíveis`
          : `${selectedCharacter().skills[2].name} disponível antes do chefe final`;
        showUnlock(message);
      }
      if (wasFinalStage) {
        playNamedSfx('untitled_1071.mp3');
        // completeStage moves the campaign to CAMPAIGN_COMPLETE; the unlock
        // helper checks that phase before granting access to the next part.
        unlockCampaignAfterCompletion(save, campaign, campaigns);
        if (save.story.secretUnlocked) showUnlock('HISTÓRIA SECRETA DESBLOQUEADA');
        else {
          const nextCampaign = campaigns.find((entry) => save.story.unlockedCampaignIds.includes(entry.id) && entry.id !== campaign.id);
          if (nextCampaign) showUnlock(`${nextCampaign.protagonist} · NOVA CAMPANHA`);
          else showUnlock('CAPÍTULOS REPRESENTADOS CONCLUÍDOS');
        }
        state.storyStage = null;
        state.enemies = [];
        state.fightActive = false;
        attachPhysicsBodies();
      } else {
        state.storyStage = currentCampaignStage();
        state.player.x = 380;
        state.player.y = 320;
        state.player.hp = state.player.maxHp;
        state.player.energy = state.player.maxEnergy;
        state.player.statuses = { freeze: 0, slow: 0, confuse: 0, burn: 0, burnTick: 0 };
        state.cooldowns = {};
        state.enemies = [];
        state.fightActive = false;
        attachPhysicsBodies();
      }
      persistSave();
      updateStoryPanel();
      updateInterface(true);
      break;
    }
  }
}

function buildRoster() {
  const roster = $('#roster');
  roster.innerHTML = '';
  characters.forEach((character, index) => {
    const unlocked = hasCampaignAccess(character.id);
    const portrait = character.spriteAsset ? preparedSprites.get(character.spriteAsset.key) : null;
    character.portraitDataUrl ||= portrait?.toDataURL('image/png');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `roster-entry${index === state.selected ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
    button.disabled = !unlocked;
    button.title = unlocked ? `Campanha de ${character.name}` : 'Conclua a campanha anterior para liberar este protagonista.';
    button.setAttribute('aria-label', `Selecionar ${character.name}, Parte ${character.part}`);
    button.innerHTML = `<span class="portrait-chip" style="--portrait-color:${character.color}">${character.portraitDataUrl ? `<img src="${character.portraitDataUrl}" alt="">` : character.short[0]}</span><span><strong>${character.short}</strong><small>PARTE ${String(character.part).padStart(2, '0')}</small></span>`;
    button.addEventListener('click', () => selectCharacter(index));
    roster.append(button);
  });
}

function currentBossTemplate() { return bosses[state.selected]; }
const allyNames = new Set(['will a. zeppeli', 'noriaki kakyoin', 'avdol', 'jean pierre polnareff', 'bruno bucciarati', 'foo fighters']);
const normalizeVillainName = (name) => String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const villainPowers = Object.freeze({
  dio: 'time-stop', diobrando: 'time-stop', diooverheaven: 'reality-overwrite', jackoestripador: 'vampirism',
  bruford: 'sword', tarkus: 'strength',
  santana: 'absorption', esidisi: 'heat', wamuu: 'wind', kars: 'ultimate-lifeform',
  ndoul: 'water', danieljdarby: 'soul-gamble', telencetdarby: 'soul-gamble', vanillaice: 'void',
  yoshikagekira: 'bomb', kira: 'bomb', diavolo: 'erase-time', enricopucci: 'acceleration', pucci: 'acceleration',
  funnyvalentine: 'dimension', tooru: 'calamity', wonderofu: 'calamity',
  angelo: 'water', formaggio: 'shrink', illuso: 'mirror', prosciutto: 'aging', ghiaccio: 'ice',
  risotto: 'metal', cioccolata: 'mold', blackmore: 'rain', rikiel: 'rods', sportsmaxx: 'zombie',
  anjuro: 'water', keichonijimura: 'army', akiraotoishi: 'electricity', yukakoyamagishi: 'hair',
  rohan: 'heavens-door', shigechi: 'swarm', pesci: 'fishing-line', melone: 'tracking', blacksabbath: 'shadows', polpo: 'shadows',
  notoriousbig: 'devour', diegobrando: 'dinosaur', diegobrandoalternativo: 'dinosaur', ringoroadagain: 'time-rewind',
  yotsuyuyagiyama: 'attraction', tamakidamo: 'vitaminc', poortom: 'ozone', aishodainenjiyama: 'leaves',
  versus: 'terrain', johngallia: 'sniper', noriakikakyoin: 'emeralds',
  gwess: 'shrink',
});
const villainPowerProfiles = Object.freeze({
  'time-stop': { windup: 0.3, radius: 88, damage: 1.2, status: 'freeze' },
  'reality-overwrite': { windup: 0.25, radius: 108, damage: 1.35, status: 'confuse' },
  absorption: { windup: 0.44, radius: 68, damage: 1.05, status: 'absorb' },
  heat: { windup: 0.58, radius: 104, damage: 0.9, status: 'burn' },
  wind: { windup: 0.56, radius: 128, damage: 1.12, status: 'slow' },
  'ultimate-lifeform': { windup: 0.4, radius: 84, damage: 1.24, status: 'burn' },
  water: { windup: 0.58, radius: 120, damage: 0.9, status: 'slow' },
  'soul-gamble': { windup: 0.5, radius: 76, damage: 1, status: 'confuse' },
  void: { windup: 0.34, radius: 94, damage: 1.45, status: 'freeze' },
  bomb: { windup: 0.72, radius: 128, damage: 1.3, status: 'burn' },
  'erase-time': { windup: 0.18, radius: 78, damage: 1.45, status: 'freeze' },
  acceleration: { windup: 0.42, radius: 92, damage: 0.9, interval: 0.72, status: 'slow' },
  dimension: { windup: 0.42, radius: 82, damage: 1.08, status: 'confuse' },
  calamity: { windup: 0.52, radius: 104, damage: 1.08, status: 'calamity' },
  shrink: { windup: 0.48, radius: 88, damage: 0.85, status: 'slow' },
  mirror: { windup: 0.4, radius: 96, damage: 1.05, status: 'confuse' },
  aging: { windup: 0.48, radius: 106, damage: 0.95, status: 'slow' },
  ice: { windup: 0.6, radius: 110, damage: 1.05, status: 'freeze' },
  metal: { windup: 0.42, radius: 86, damage: 1.1, status: 'burn' },
  mold: { windup: 0.6, radius: 115, damage: 0.8, status: 'burn' },
  rain: { windup: 0.55, radius: 112, damage: 0.9, status: 'slow' },
  rods: { windup: 0.34, radius: 90, damage: 1.1, status: 'slow' },
  zombie: { windup: 0.48, radius: 86, damage: 0.95, status: 'burn' },
  arrows: { windup: 0.54, radius: 108, damage: 1.05, status: 'slow' },
  electricity: { windup: 0.36, radius: 100, damage: 1.08, status: 'freeze' },
  vampirism: { windup: 0.32, radius: 80, damage: 1.08, status: 'absorb' },
  sword: { windup: 0.62, radius: 105, damage: 1.2, status: 'slow' },
  strength: { windup: 0.78, radius: 72, damage: 1.4, status: 'slow' },
  hair: { windup: 0.5, radius: 112, damage: 0.9, status: 'slow' },
  'heavens-door': { windup: 0.46, radius: 90, damage: 0.8, status: 'confuse' },
  swarm: { windup: 0.3, radius: 124, damage: 0.75, interval: 0.72, status: 'slow' },
  'fishing-line': { windup: 0.44, radius: 118, damage: 0.92, status: 'slow' },
  tracking: { windup: 0.42, radius: 102, damage: 1.05, status: 'confuse' },
  shadows: { windup: 0.62, radius: 112, damage: 1.08, status: 'freeze' },
  devour: { windup: 0.26, radius: 120, damage: 1.25, status: 'absorb' },
  dinosaur: { windup: 0.28, radius: 100, damage: 1.12, interval: 0.78, status: 'slow' },
  'time-rewind': { windup: 0.28, radius: 90, damage: 1.05, status: 'confuse' },
  attraction: { windup: 0.42, radius: 112, damage: 0.92, status: 'slow' },
  vitaminc: { windup: 0.54, radius: 100, damage: 0.82, status: 'freeze' },
  ozone: { windup: 0.66, radius: 118, damage: 1.08, status: 'slow' },
  leaves: { windup: 0.3, radius: 108, damage: 0.96, status: 'confuse' },
  terrain: { windup: 0.48, radius: 118, damage: 1.08, status: 'slow' },
  sniper: { windup: 0.82, radius: 145, damage: 1.25, status: 'slow' },
  emeralds: { windup: 0.44, radius: 115, damage: 1.04, status: 'slow' },
  army: { windup: 0.3, radius: 120, damage: 0.85, interval: 0.72, status: 'slow' },
});
function villainPowerFor(name, campaign) {
  if (campaign?.id === 'jonathan' && normalizeVillainName(name).includes('dio')) return 'vampirism';
  return villainPowers[normalizeVillainName(name)] || null;
}
function enemySpriteAsset(enemy, campaign = selectedCampaign()) {
  const names = [enemy.name, enemy.id];
  if (campaign?.id === 'jotaro' && enemy.name.toLowerCase() === 'dio') names.push('Dio_3');
  if (campaign?.id === 'josuke4' && enemy.name.toLowerCase().includes('kira')) names.push('Kira_2');
  const finalBossSprite = resolveSpriteAsset('finalBoss', names);
  if (finalBossSprite) return finalBossSprite;
  if (allyNames.has(enemy.name.toLowerCase())) return resolveSpriteAsset('ally', enemy.name);
  return resolveSpriteAsset('antagonist', names);
}
function createCampaignBoss(stage = state.storyStage) {
  const campaign = selectedCampaign();
  const templates = stage?.enemies || [currentBossTemplate()];
  dioHurtSfxCount = 0;
  state.enemies = templates.map((template) => ({
    ...template,
    power: stage?.id === campaign.stages.at(-1)?.id
      && normalizeVillainName(template.name) === normalizeVillainName(campaign.secretBoss)
      ? villainPowerFor(template.name, campaign)
      : null,
    spriteAsset: enemySpriteAsset(template, campaign),
    hp: template.hp,
    maxHp: template.hp,
    attackTimer: 1.2,
    attackWindup: 0,
    attackTarget: null,
    stun: 0,
    slow: 0,
    marked: 0,
    hitFlash: 0,
  }));
  attachPhysicsBodies();
  loadSpritesInBackground(state.enemies.map((enemy) => enemy.spriteAsset));
  const names = templates.map((enemy) => enemy.name.toLowerCase()).join(' ');
  if (names.includes('funny valentine')) playNamedSfx('dojyan.mp3');
  if (['wamuu', 'esidisi', 'kars'].some((name) => names.includes(name))) playNamedSfx('jojos-bizarre-adventure-ay-ay-ay-ay-_-sound-effect.mp3');
}
function createFinalBosses(secondPhase = false) {
  dioHurtSfxCount = 0;
  const multiplier = secondPhase ? 3 : 1;
  state.enemies = finalBosses.map((boss) => ({
    ...boss,
    spriteAsset: boss.id === 'dio-heaven'
      ? resolveSpriteAsset('secretBoss', 'Dio Over Heaven')
      : resolveSpriteAsset('finalBoss', 'Enrico Pucci', 'Pucci'),
    hp: boss.hp * multiplier,
    maxHp: boss.hp * multiplier,
    attackTimer: boss.attackTimer,
    stun: 0,
    slow: 0,
    marked: 0,
    hitFlash: 0,
    empowered: secondPhase,
    power: boss.id === 'dio-heaven' ? 'reality-overwrite' : 'acceleration',
    pattern: 'temporal',
    attackRange: 125,
    attackDamage: secondPhase ? 24 : 12,
    attackInterval: secondPhase ? 1.05 : 1.4,
    attackWindup: 0,
    attackTarget: null,
  }));
  attachPhysicsBodies();
  loadSpritesInBackground(state.enemies.map((enemy) => enemy.spriteAsset));
}
function currentSecretCampaign() { return campaigns.find((campaign) => campaign.id === state.secretCampaignId) || campaigns[save.story.secretStageIndex] || null; }
function createSecretRevengeBoss() {
  const campaign = currentSecretCampaign();
  if (!campaign) return false;
  dioHurtSfxCount = 0;
  const candidate = campaign.stages.flatMap((stage) => stage.enemies).find((enemy) => enemy.name.toLowerCase() === campaign.secretBoss.toLowerCase());
  const fallback = campaign.stages.at(-1).enemies.at(-1);
  const encounter = createSecretEncounter(campaign, candidate || fallback);
  state.storyStage = campaign.stages.at(-1);
  state.enemies = [{
    ...encounter,
    power: villainPowerFor(campaign.secretBoss, campaign),
    spriteAsset: enemySpriteAsset({ ...encounter, name: campaign.secretBoss }, campaign),
    x: 710,
    y: 260,
    size: 1.16,
    attackTimer: 1.15,
    attackWindup: 0,
    attackTarget: null,
    stun: 0,
    slow: 0,
    marked: 0,
    hitFlash: 0,
  }];
  attachPhysicsBodies();
  loadSpritesInBackground(state.enemies.map((enemy) => enemy.spriteAsset));
  return true;
}
function prepareSecretMode() {
  state.secretPhase = save.story.secretFinalPhase;
  state.jotaroAwakened = state.secretPhase === 2;
  if (save.story.secretStageIndex < campaigns.length) {
    state.secretCampaignId = campaigns[save.story.secretStageIndex].id;
    state.secretRunPhase = 'revenge-intro';
    state.storyStage = currentSecretCampaign().stages.at(-1);
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
    return;
  }
  if (!save.story.secretFinalAvailable || save.story.secretFinalComplete) {
    state.secretCampaignId = null;
    state.secretRunPhase = save.story.secretFinalComplete ? 'complete' : 'final-intro';
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
    return;
  }
  if (state.secretPhase >= 1) {
    state.secretCampaignId = null;
    state.secretRunPhase = 'final-battle';
    createFinalBosses(state.secretPhase === 2);
  } else {
    state.secretCampaignId = null;
    state.secretRunPhase = 'final-intro';
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
  }
}
function attachPhysicsBodies() {
  if (!gameScene) return;
  physicsObjects.forEach((physicsObject) => physicsObject.destroy());
  physicsObjects = [];
  const attachBody = (actor, width, height) => {
    const physicsZone = gameScene.add.zone(actor.x, actor.y, width, height);
    gameScene.physics.add.existing(physicsZone);
    physicsZone.body.setAllowGravity(false);
    physicsZone.body.setCollideWorldBounds(true);
    physicsZone.body.setSize(width, height);
    actor.physicsZone = physicsZone;
    actor.body = physicsZone.body;
    physicsObjects.push(physicsZone);
  };
  attachBody(state.player, 22, 30);
  state.enemies.forEach((enemy) => attachBody(enemy, 36, 42));
}
function resetBattle(mode = state.mode) {
  dioHurtSfxCount = 0;
  state.mode = mode;
  state.secretPhase = 0;
  state.secretRunPhase = null;
  state.secretCampaignId = null;
  state.jotaroAwakened = false;
  state.player = { x: 380, y: 320, facingX: 1, facingY: 0, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attackTimer: 0, attackAction: 'special', hitFlash: 0, isMoving: false, statuses: { freeze: 0, slow: 0, confuse: 0, burn: 0, burnTick: 0 }, physicsZone: null, body: null };
  state.touchAxis = { x: 0, y: 0 };
  releaseJoystick();
  state.cooldowns = {};
  state.effects = [];
  state.particles = [];
  state.attackCooldown = 0;
  state.invulnerable = 0;
  state.assistCooldown = 0;
  state.assist = null;
  state.fightActive = true;
  state.cinematicUntil = 0;
  $('#cinematic').classList.remove('active');
  $('#cinematic').setAttribute('aria-hidden', 'true');
  if (mode === 'final') {
    state.storyStage = null;
    prepareSecretMode();
  } else {
    state.storyStage = currentCampaignStage();
    if (currentCampaignProgress().phase === STORY_PHASES.BOSS_FIGHT && state.storyStage) createCampaignBoss();
    else {
      state.enemies = [];
      attachPhysicsBodies();
    }
    updateStoryPanel();
  }
  updateInterface(true);
  buildRoster();
  loadSpritesInBackground([selectedCharacter().spriteAsset]);
}

function selectCharacter(index) {
  if (state.fightActive && state.mode === 'final') {
    showToast('Termine esta batalha para escolher outro protagonista.');
    return;
  }
  const character = characters[index];
  if (!hasCampaignAccess(character.id)) {
    showToast('Conclua a campanha anterior para liberar este protagonista.');
    return;
  }
  if (state.mode === 'campaign' && state.fightActive && index !== state.selected) {
    showToast('Conclua a luta atual antes de trocar de protagonista.');
    return;
  }
  state.selected = index;
  state.mode = 'campaign';
  resetBattle('campaign');
}

function switchMode(mode) {
  if (mode === 'final' && !save.story.secretUnlocked) {
    showToast('Conclua os capítulos disponíveis das nove campanhas para liberar esta história.');
    return;
  }
  if (mode === state.mode && state.fightActive) return;
  if (mode === 'final') state.selected = characters.findIndex((character) => character.id === 'jotaro');
  state.mode = mode;
  resetBattle(mode);
  if (mode === 'final') $('#battle-message').textContent = 'A jornada secreta aguarda a escolha do próximo trecho.';
  else $('#battle-message').textContent = `${selectedCharacter().name} inicia sua campanha.`;
  updateInterface(true);
}

function unlockAdvanced(character) {
  if (save.advanced.includes(character.id)) return;
  save.advanced.push(character.id);
  save.victories.push(character.id);
  persistSave();
  showUnlock(character.skills[1].name);
  playTone(690, 0.12);
}

function unlockSupremesAndAwakenJotaro() {
  if (state.secretPhase === 2) return;
  state.secretPhase = 2;
  state.secretRunPhase = 'final-battle';
  state.jotaroAwakened = true;
  save.story.secretFinalPhase = 2;
  characters.forEach((character) => {
    if (!save.supreme.includes(character.id)) save.supreme.push(character.id);
  });
  persistSave();
  createFinalBosses(true);
  state.player.hp = state.player.maxHp;
  state.player.energy = state.player.maxEnergy;
  state.cinematicUntil = performance.now() + 4700;
  state.invulnerable = 4.7;
  $('#cinematic').classList.add('active');
  $('#cinematic').setAttribute('aria-hidden', 'false');
  $('#fight-eyebrow').textContent = 'MODO HISTÓRIA SECRETO · FASE 2';
  $('#fight-title').textContent = 'Star Platinum: Over Heaven';
  $('#battle-message').textContent = 'PODER SUPREMO DESPERTADO! JOTARO KUJO — STAR PLATINUM: OVER HEAVEN';
  showUnlock('STAR PLATINUM: OVER HEAVEN');
  window.setTimeout(() => {
    $('#cinematic').classList.remove('active');
    $('#cinematic').setAttribute('aria-hidden', 'true');
    updateInterface(true);
  }, 4700);
  playTone(880, 0.18);
  window.setTimeout(() => playTone(1100, 0.2), 230);
  updateInterface(true);
}

function showUnlock(name) {
  $('#unlock-name').textContent = name.toUpperCase();
  $('#unlock-banner').classList.add('visible');
  window.clearTimeout(unlockTimeout);
  unlockTimeout = window.setTimeout(() => $('#unlock-banner').classList.remove('visible'), 3600);
}
function showToast(message) {
  const toast = $('#arena-toast');
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 2500);
}
function playTone(frequency, duration = 0.07) {
  if (!state.sound) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch { /* Audio is optional; combat remains playable without it. */ }
}

function playAbilitySfx(character, skill) {
  if (!state.sound) return;
  try {
    audioContext ||= new AudioContext();
    const identity = `${character.id}:${skill.id}`;
    const hash = [...identity].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
    const now = audioContext.currentTime;
    const duration = skill.tier === 'supreme' || skill.tier === 'awakening' ? 0.32 : 0.2;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = skill.type === 'melee' ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(190 + (hash % 430), now);
    oscillator.frequency.exponentialRampToValueAtTime(95 + (hash % 110), now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(skill.tier === 'supreme' || skill.tier === 'awakening' ? 0.09 : 0.055, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  } catch (error) {
    console.warn('Efeito sonoro da habilidade indisponível.', error);
  }
}

function playCharacterSfx(character, skill = null) {
  if (!state.sound || !character) return;
  const characterId = character.id || String(character.name || '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '');
  const file = skill?.effect === 'time-stop' ? ZA_WARUDO_SFX : CHARACTER_SFX[characterId];
  if (!file) return;
  const now = performance.now();
  const throttle = file === ZA_WARUDO_SFX ? 1200 : 240;
  if (now - (characterSfxPlayedAt.get(file) || 0) < throttle) return;
  characterSfxPlayedAt.set(file, now);
  let audio = characterSfx.get(file);
  if (!audio) {
    audio = new Audio(new URL(`./SFX/${file}`, document.baseURI).href);
    audio.preload = 'auto';
    audio.volume = 0.55;
    characterSfx.set(file, audio);
  }
  audio.currentTime = 0;
  audio.play().catch((error) => console.warn(`Efeito sonoro indisponível: ${file}`, error));
}

function playThemeStep() {
  if (!state.sound) return;
  // Short, original synthesized battle motif, generated locally with Web Audio.
  const notes = [220, 261.63, 329.63, 392, 329.63, 293.66, 246.94, 196];
  const frequency = notes[musicStep % notes.length];
  musicStep += 1;
  try {
    audioContext ||= new AudioContext();
    const now = audioContext.currentTime;
    for (const [tone, type, volume] of [[frequency, 'triangle', 0.022], [frequency / 2, 'sawtooth', 0.009]]) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(tone, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.35);
    }
  } catch { /* Audio is optional; gameplay remains available without it. */ }
}

function startTheme() {
  window.clearInterval(musicTimer);
  musicStep = 0;
  playThemeStep();
  musicTimer = window.setInterval(playThemeStep, 390);
}

function performBasicAttack() {
  if (!state.fightActive || performance.now() < state.cinematicUntil || state.attackCooldown > 0) return;
  state.attackCooldown = 0.42;
  state.player.attackTimer = 0.28;
  state.player.attackAction = 'special';
  state.screenShake = 2;
  const player = state.player;
  let hit = false;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    const direction = distance ? (dx / distance) * player.facingX + (dy / distance) * player.facingY : 1;
    if (isInFacingRange(enemy, 86, -0.28) && direction > -0.28) {
      damageEnemy(enemy, 23, 'basic');
      hit = true;
    }
  }
  spawnBurst(player.x + player.facingX * 62, player.y + player.facingY * 62, hit ? '#f0e9b2' : '#d3e85a', 'impact');
  playTone(hit ? 145 : 95);
  playNamedSfx('jojo-punch.mp3');
  if (hit) checkBattleEnd();
}

function useSkill(slot) {
  const skill = availableSkills()[slot];
  if (!skill || !state.fightActive || performance.now() < state.cinematicUntil) return;
  if (skill.tier === 'supreme' && !isUnlocked(skill)) {
    showToast(state.mode === 'campaign' ? 'Avance até a fase do chefe final para liberar este poder.' : 'Este poder desperta na segunda fase da batalha secreta.');
    return;
  }
  if (!isUnlocked(skill)) {
    showToast(skill.tier === 'advanced' ? 'Avance até a terceira fase desta campanha para liberar este poder.' : 'Este poder ainda está bloqueado.');
    return;
  }
  if (skill.tier === 'awakening' && !isUnlocked(skill)) {
    showToast('Star Platinum: Over Heaven só desperta na fase 2 do modo secreto.');
    return;
  }
  if (state.cooldowns[skill.id] > 0) {
    showToast(`Recarga: ${Math.ceil(state.cooldowns[skill.id])} s`);
    return;
  }
  if (state.player.energy < skill.energy) {
    showToast('Energia insuficiente. Aguarde a recuperação.');
    return;
  }
  state.player.energy -= skill.energy;
  const character = selectedCharacter();
  if (character.id === 'giorno' && slot === 1) playNamedSfx('7-page-muda-giorno.mp3');
  if (character.id === 'giorno' && skill.effect === 'nullify') playNamedSfx('jojos-bizarre-adventure-ay-ay-ay-ay-_-sound-effect.mp3');
  if (character.id === 'johnny' && slot < 3) playNamedSfx('tusk-chimimi.mp3');
  if (skill.effect === 'time-stop' && character.id === 'dio') playNamedSfx(ZA_WARUDO_SFX);
  state.cooldowns[skill.id] = skill.cooldown / 1000;
  state.player.attackTimer = skill.duration;
  state.player.attackAction = `skill-${slot}`;
  state.screenShake = skill.tier === 'supreme' || skill.tier === 'awakening' ? 7 : 3;
  activateSkill(skill);
  if (isOverHeaven() && slot === 0) playNamedSfx('muda_muda_muda_sound_effect.mp3');
  playAbilitySfx(character, skill);
  updateInterface(true);
}

function activateSkill(skill) {
  const player = state.player;
  const character = selectedCharacter();
  const centerX = player.x + player.facingX * Math.min(skill.range * 0.45, 105);
  const centerY = player.y + player.facingY * Math.min(skill.range * 0.45, 80);
  let affected = 0;
  if (skill.effect === 'heal') {
    const restored = Math.min(30, player.maxHp - player.hp);
    player.hp += restored;
    state.effects.push({ type: 'heal', x: player.x, y: player.y, radius: skill.range * 0.58, time: 1.2, maxTime: 1.2 });
    state.particles.push({ x: player.x, y: player.y - 25, text: restored ? `+${restored} VIDA` : 'VIDA COMPLETA', time: 1, color: '#d3e85a' });
    showToast(restored ? `Crazy Diamond restaurou ${restored} pontos de vida.` : 'Sua vida já está completa.');
  } else if (skill.effect === 'decoy') {
    state.effects.push({ type: 'decoy', x: centerX, y: centerY, radius: 22, time: skill.duration, maxTime: skill.duration });
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !overlapsHitCircle(enemy, centerX, centerY, skill.range)) continue;
      damageEnemy(enemy, skill.damage, skill.animation);
      affected += 1;
    }
    spawnBurst(centerX, centerY, character.color, 'life');
  } else if (skill.effect === 'rain' || skill.effect === 'heavy-rain') {
    const radius = skill.range;
    state.effects.push({ type: 'rain', x: centerX, y: centerY, radius, time: skill.duration, maxTime: skill.duration, heavy: skill.effect === 'heavy-rain' });
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !overlapsHitCircle(enemy, centerX, centerY, radius)) continue;
      damageEnemy(enemy, skill.damage, skill.animation);
      if (skill.effect === 'heavy-rain') enemy.slow = Math.max(enemy.slow, skill.duration);
      affected += 1;
    }
    spawnBurst(centerX, centerY, '#80bdce', 'rain');
  } else if (skill.effect === 'counter' || skill.effect === 'reality-defense') {
    state.effects.push({ type: skill.effect, x: player.x, y: player.y, radius: 60, time: skill.duration, maxTime: skill.duration });
    const enemiesInRange = state.enemies.filter((enemy) => enemy.hp > 0 && overlapsHitCircle(enemy, player.x, player.y, skill.range));
    for (const enemy of enemiesInRange) {
      damageEnemy(enemy, skill.damage, skill.animation);
      if (skill.effect === 'reality-defense') enemy.stun = Math.max(enemy.stun, 1.3);
      affected += 1;
    }
    if (skill.effect === 'reality-defense') state.invulnerable = Math.max(state.invulnerable, skill.duration);
  } else if (skill.effect === 'nullify') {
    state.effects.push({ type: 'nullify', x: player.x, y: player.y, radius: 93, time: 0.8, maxTime: 0.8 });
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !overlapsHitCircle(enemy, player.x, player.y, skill.range)) continue;
      if (enemy.attackTimer < 0.9) enemy.attackTimer = 0.9;
      enemy.stun = Math.max(enemy.stun, 1.1);
      damageEnemy(enemy, skill.damage, skill.animation);
      affected += 1;
    }
  } else if (skill.type === 'trap') {
    state.effects.push({ type: skill.effect === 'root' ? 'trap' : 'string', x: centerX, y: centerY, radius: skill.range * 0.55, time: skill.duration, maxTime: skill.duration, damage: skill.damage, activated: false });
    spawnBurst(centerX, centerY, character.color, 'trap');
  } else if (skill.type === 'projectile') {
    const projectileCount = skill.tier === 'supreme' ? 3 : 2;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !isInFacingRange(enemy, skill.range, 0.82)) continue;
      damageEnemy(enemy, skill.damage, skill.animation);
      if (skill.effect === 'slow') enemy.slow = Math.max(enemy.slow, 2.8);
      if (skill.effect === 'interrupt' || skill.effect === 'dimensional-pierce') enemy.stun = Math.max(enemy.stun, 1.1);
      affected += 1;
    }
    for (let index = 0; index < projectileCount; index += 1) {
      const spread = (index - (projectileCount - 1) / 2) * 12;
      state.effects.push({ type: skill.animation, x: player.x, y: player.y + spread, targetX: player.x + player.facingX * skill.range, targetY: player.y + player.facingY * skill.range + spread, radius: 9, time: 0.45, maxTime: 0.45 });
    }
  } else {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || !isInFacingRange(enemy, skill.range, skill.effect === 'interrupt' ? 0.1 : 0.72)) continue;
      damageEnemy(enemy, skill.damage, skill.animation, skill.effect === 'guard-break');
      affected += 1;
      if (['interrupt', 'time-stop', 'overwrite', 'final-impact', 'dimensional-pierce'].includes(skill.effect)) enemy.stun = Math.max(enemy.stun, skill.effect === 'time-stop' ? skill.duration : 1.4);
      if (skill.effect === 'slow') enemy.slow = Math.max(enemy.slow, skill.duration);
      if (skill.effect === 'root') enemy.stun = Math.max(enemy.stun, skill.duration);
      if (skill.effect === 'overwrite') enemy.marked = 2.2;
    }
    const effectColor = skill.tier === 'awakening' || skill.tier === 'supreme' ? '#fff2a2' : character.color;
    state.effects.push({ type: skill.animation, x: centerX, y: centerY, radius: skill.range * (skill.type === 'melee' ? 0.42 : 0.66), time: skill.duration, maxTime: skill.duration });
    spawnBurst(centerX, centerY, effectColor, skill.animation);
  }
  if (affected) checkBattleEnd();
  state.battleMessage = affected ? `${skill.name} atingiu ${affected} ${affected === 1 ? 'alvo' : 'alvos'}.` : `${skill.name} executado.`;
  $('#battle-message').textContent = state.battleMessage;
  playTone(skill.tier === 'supreme' || skill.tier === 'awakening' ? 510 : 320, 0.12);
}

function isInFacingRange(enemy, range, forwardDot = 0.45) {
  const dx = enemy.x - state.player.x;
  const dy = enemy.y - state.player.y;
  const distanceToEnemy = Math.hypot(dx, dy);
  const facingDot = distanceToEnemy ? (dx / distanceToEnemy) * state.player.facingX + (dy / distanceToEnemy) * state.player.facingY : 1;
  return overlapsHitCircle(enemy, state.player.x, state.player.y, range) && facingDot > forwardDot;
}
function overlapsHitCircle(target, x, y, radius) {
  if (!target.body) return distance(target, { x, y }) <= radius;
  const hitCircle = new Phaser.Geom.Circle(x, y, radius);
  const targetBounds = new Phaser.Geom.Rectangle(target.body.x, target.body.y, target.body.width, target.body.height);
  return Phaser.Geom.Intersects.CircleToRectangle(hitCircle, targetBounds);
}
function distance(first, second) { return Math.hypot(first.x - second.x, first.y - second.y); }

function damageEnemy(enemy, amount, kind, guardBreak = false) {
  if (enemy.hp <= 0) return;
  const multiplier = enemy.marked > 0 ? 1.12 : 1;
  enemy.hp = Math.max(0, enemy.hp - amount * multiplier);
  if (isPart3Dio(enemy) && dioHurtSfxCount < 3) { dioHurtSfxCount += 1; playNamedSfx('dio-wryyy.mp3'); }
  enemy.hitFlash = 0.22;
  if (guardBreak) enemy.stun = Math.max(enemy.stun, 1.3);
  const color = kind.includes('rain') ? '#c6edf1' : isOverHeaven() ? '#f0d75a' : selectedCharacter().color;
  spawnBurst(enemy.x, enemy.y - 10, color, kind === 'basic' ? 'impact' : kind);
  if (enemy.power === 'calamity' && enemy.hp > 0 && (enemy.calamityCooldown || 0) <= 0) {
    enemy.calamityCooldown = 1.25;
    state.player.hp = Math.max(0, state.player.hp - 4);
    state.player.hitFlash = 0.2;
    state.particles.push({ x: state.player.x, y: state.player.y - 35, text: 'CALAMIDADE', time: 0.8, color: '#bd83cb' });
    if (state.player.hp <= 0) playerDefeated();
  }
  if (amount >= 100) state.screenShake = 8;
}

function checkBattleEnd() {
  if (state.enemies.some((enemy) => enemy.hp > 0)) return;
  if (state.mode === 'final' && state.secretRunPhase === 'revenge-battle') {
    const campaign = currentSecretCampaign();
    const enemyId = state.enemies[0]?.id;
    if (!campaign || !recordSecretBossVictory(save, campaign, enemyId, campaigns)) {
      showToast('Esta revanche já foi concluída ou não corresponde à próxima Parte.');
      return;
    }
    state.secretRunPhase = 'revenge-post';
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
    persistSave();
    $('#battle-message').textContent = `${campaign.secretBoss} foi derrotado novamente. O próximo trecho foi registrado.`;
    updateStoryPanel();
    updateInterface(true);
    return;
  }
  if (state.mode === 'final' && state.secretRunPhase === 'final-battle' && state.secretPhase <= 1) {
    state.secretPhase = 1;
    state.secretRunPhase = 'final-transform';
    save.story.secretFinalPhase = 1;
    persistSave();
    state.enemies = [];
    attachPhysicsBodies();
    state.fightActive = false;
    $('#battle-message').textContent = 'Os dois inimigos caíram. A batalha ainda não terminou.';
    $('#fight-title').textContent = 'A transformação começa';
    $('#fight-eyebrow').textContent = 'MODO HISTÓRIA SECRETO · TRANSFORMAÇÃO';
    window.setTimeout(() => {
      if (state.mode !== 'final' || state.secretPhase !== 1) return;
      state.fightActive = true;
      unlockSupremesAndAwakenJotaro();
    }, 950);
    updateInterface(true);
    return;
  }
  if (state.mode === 'final') {
    state.fightActive = false;
    state.secretRunPhase = 'complete';
    save.story.secretFinalComplete = true;
    persistSave();
    $('#battle-message').textContent = 'DIO Over Heaven e Pucci foram derrotados. O destino foi reescrito.';
    $('#fight-title').textContent = 'A batalha pelo destino';
    updateStoryPanel();
    showToast('VITÓRIA — O modo história secreto foi concluído.');
  } else if (state.storyStage) {
    const progress = currentCampaignProgress();
    const stage = state.storyStage;
    const enemyIds = state.enemies.map((enemy) => enemy.id);
    if (!recordBattleVictory(progress, stage, enemyIds)) {
      showToast('Esta vitória não corresponde ao objetivo registrado da fase.');
      return;
    }
    state.fightActive = false;
    state.enemies = [];
    attachPhysicsBodies();
    if (stage.allyAfterVictory) progress.flags[`ally:${stage.allyAfterVictory}`] = true;
    if (stage.reward) progress.flags[`story-reward:${stage.reward}`] = true;
    if (stage.chapterEnd) unlockAdvanced(selectedCharacter());
    persistSave();
    $('#battle-message').textContent = `${stage.enemies.map((enemy) => enemy.name).join(' e ')} derrotado. O cenário e o próximo objetivo mudaram.`;
    updateStoryPanel();
    showToast('Vitória registrada. A fase avançou para suas consequências.');
  } else {
    state.fightActive = false;
    unlockAdvanced(selectedCharacter());
    $('#battle-message').textContent = `${selectedCharacter().boss} foi derrotado. ${selectedCharacter().skills[1].name} está disponível.`;
    showToast(`${selectedCharacter().boss} derrotado. Poder avançado liberado.`);
  }
  updateInterface(true);
}

function requestAssist() {
  if (state.mode !== 'final' || state.secretPhase !== 2 || !state.fightActive || state.assist || state.assistCooldown > 0) return;
  const current = selectedCharacter();
  const requestedHelperId = assistCast[state.assistIndex || 0];
  let helper = requestedHelperId === kakyoinSupport.id ? kakyoinSupport : characters.find((character) => character.id !== current.id && character.id === requestedHelperId);
  if (!helper) helper = characters.find((character) => character.id !== current.id);
  state.assistIndex = ((state.assistIndex || 0) + 1) % assistCast.length;
  if (helper.id === 'jotaro' && !state.jotaroAwakened) {
    showToast('A assistência de Jotaro ainda não está disponível.');
    return;
  }
  let assistanceSkill = helper.skills[helper.skills.length - 1];
  if (helper === kakyoinSupport) {
    assistanceSkill = helper.skills[(state.kakyoinAssistCount || 0) % helper.skills.length];
    state.kakyoinAssistCount = (state.kakyoinAssistCount || 0) + 1;
  }
  state.assist = { character: helper, skill: assistanceSkill, time: 2.7, maxTime: 2.7 };
  state.assistCooldown = 62.7;
  const hasSupreme = save.supreme.includes(helper.id);
  const damage = helper.id === 'jotaro' && state.jotaroAwakened ? 174 : helper.id === 'kakyoin' ? assistanceSkill.damage : hasSupreme ? 144 : 88;
  const target = state.enemies.filter((enemy) => enemy.hp > 0).sort((first, second) => first.hp - second.hp)[0];
  if (target) {
    damageEnemy(target, damage, helper.id === 'jotaro' ? 'heaven-barrage' : 'assist-impact');
    target.stun = Math.max(target.stun, assistanceSkill.stun || (helper.id === 'jotaro' ? 1.15 : 0.55));
    checkBattleEnd();
  }
  showToast(`${helper.id === 'jotaro' ? 'STAR PLATINUM: OVER HEAVEN' : helper.name.toUpperCase()} · ${assistanceSkill.name.toUpperCase()}!`);
  playTone(420, 0.11);
  playCharacterSfx(helper, assistanceSkill);
}

function update(dt, timestamp) {
  state.elapsed += dt;
  state.attackCooldown = Math.max(0, state.attackCooldown - dt);
  state.invulnerable = Math.max(0, state.invulnerable - dt);
  state.screenShake = Math.max(0, state.screenShake - dt * 20);
  state.assistCooldown = Math.max(0, state.assistCooldown - dt);
  if (state.assist) {
    state.assist.time -= dt;
    if (state.assist.time <= 0) state.assist = null;
  }
  for (const id of Object.keys(state.cooldowns)) state.cooldowns[id] = Math.max(0, state.cooldowns[id] - dt);
  for (const effect of state.effects) {
    effect.time -= dt;
    if (effect.type === 'trap' || effect.type === 'string') {
      const target = state.enemies.find((enemy) => enemy.hp > 0 && overlapsHitCircle(enemy, effect.x, effect.y, effect.radius) && !effect.activated);
      if (target) {
        effect.activated = true;
        target.stun = Math.max(target.stun, 1.6);
        damageEnemy(target, effect.damage, 'trap-snap');
        spawnBurst(target.x, target.y, '#d3e85a', 'string-snare');
        if (target.hp <= 0) checkBattleEnd();
      }
    }
  }
  state.effects = state.effects.filter((effect) => effect.time > 0);
  for (const particle of state.particles) particle.time -= dt;
  state.particles = state.particles.filter((particle) => particle.time > 0);
  state.player.energy = Math.min(state.player.maxEnergy, state.player.energy + dt * 7.2);
  state.player.attackTimer = Math.max(0, state.player.attackTimer - dt);
  state.player.hitFlash = Math.max(0, state.player.hitFlash - dt);
  const statuses = state.player.statuses;
  for (const key of ['freeze', 'slow', 'confuse', 'burn']) statuses[key] = Math.max(0, statuses[key] - dt);
  if (statuses.burn > 0 && state.fightActive) {
    statuses.burnTick -= dt;
    if (statuses.burnTick <= 0) {
      statuses.burnTick = 0.65;
      state.player.hp = Math.max(0, state.player.hp - 2);
      state.player.hitFlash = 0.16;
      if (state.player.hp <= 0) playerDefeated();
    }
  }

  const campaignPhase = state.mode === 'campaign' ? currentCampaignProgress().phase : null;
  const exploring = campaignPhase === STORY_PHASES.OBJECTIVE_ACTIVE;
  const campaignFinished = campaignPhase === STORY_PHASES.CAMPAIGN_COMPLETE;
  if ((state.fightActive || exploring || campaignFinished) && timestamp >= state.cinematicUntil) {
    const player = state.player;
    if (player.physicsZone) {
      player.x = player.physicsZone.x;
      player.y = player.physicsZone.y;
    }
    let moveX = Number(state.keys.has('d') || state.keys.has('arrowright')) - Number(state.keys.has('a') || state.keys.has('arrowleft')) + state.touchAxis.x;
    let moveY = Number(state.keys.has('s') || state.keys.has('arrowdown')) - Number(state.keys.has('w') || state.keys.has('arrowup')) + state.touchAxis.y;
    if (player.statuses.freeze > 0) moveX = moveY = 0;
    if (player.statuses.confuse > 0) { moveX *= -1; moveY *= -1; }
    const magnitude = Math.hypot(moveX, moveY);
    if (magnitude > 1) { moveX /= magnitude; moveY /= magnitude; }
    player.isMoving = magnitude > 0.12;
    if (player.body) {
      player.body.setVelocity(player.isMoving ? moveX * 190 * (player.statuses.slow > 0 ? 0.55 : 1) : 0, player.isMoving ? moveY * 155 * (player.statuses.slow > 0 ? 0.55 : 1) : 0);
    } else if (player.isMoving) {
      const speedScale = player.statuses.slow > 0 ? 0.55 : 1;
      player.x += moveX * 190 * speedScale * dt;
      player.y += moveY * 155 * speedScale * dt;
    }
    if (player.isMoving) {
      player.facingX = moveX;
      player.facingY = moveY;
    }
    if (state.fightActive) for (const enemy of state.enemies) updateEnemy(enemy, dt);
  } else {
    state.player.isMoving = false;
    state.player.body?.setVelocity(0, 0);
    state.enemies.forEach((enemy) => enemy.body?.setVelocity(0, 0));
  }
  if (state.nextUiUpdate < timestamp) {
    state.nextUiUpdate = timestamp + 110;
    updateInterface();
  }
}

function updateEnemy(enemy, dt) {
  if (enemy.hp <= 0) return;
  if (enemy.physicsZone) {
    enemy.x = enemy.physicsZone.x;
    enemy.y = enemy.physicsZone.y;
  }
  enemy.stun = Math.max(0, enemy.stun - dt);
  enemy.slow = Math.max(0, enemy.slow - dt);
  enemy.marked = Math.max(0, enemy.marked - dt);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
  enemy.calamityCooldown = Math.max(0, (enemy.calamityCooldown || 0) - dt);
  if (enemy.stun > 0) {
    enemy.body?.setVelocity(0, 0);
    return;
  }
  const player = state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distanceToPlayer = Math.hypot(dx, dy) || 1;
  const ranged = enemy.pattern === 'ranged' || enemy.pattern === 'hazard';
  const shouldRetreat = ranged && distanceToPlayer < 135;
  if (enemy.attackWindup > 0) {
    enemy.attackWindup = Math.max(0, enemy.attackWindup - dt);
    enemy.body?.setVelocity(0, 0);
    if (enemy.attackWindup === 0 && enemy.attackTarget) {
      const target = enemy.attackTarget;
      enemy.attackTarget = null;
      if (overlapsHitCircle(player, target.x, target.y, target.radius) && state.invulnerable <= 0) {
        const profile = villainPowerProfiles[enemy.power] || {};
        const damage = Math.round((enemy.attackDamage || (enemy.empowered ? 24 : 8)) * (profile.damage || 1));
        player.hp = Math.max(0, player.hp - damage);
        const statuses = player.statuses;
        if (profile.status === 'freeze') statuses.freeze = Math.max(statuses.freeze, isPart3Dio(enemy) && enemy.power === 'time-stop' ? 9 : enemy.power === 'time-stop' ? 0.62 : 0.35);
        if (profile.status === 'slow') statuses.slow = Math.max(statuses.slow, 1.6);
        if (profile.status === 'confuse') statuses.confuse = Math.max(statuses.confuse, 0.9);
        if (profile.status === 'burn') { statuses.burn = Math.max(statuses.burn, 2.2); statuses.burnTick = Math.min(statuses.burnTick || 0.65, 0.65); }
        if (profile.status === 'absorb') enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.ceil(damage * 0.32));
        if (profile.status === 'calamity') statuses.slow = Math.max(statuses.slow, 1.1);
        const powerLabel = { 'time-stop': 'TEMPO PARADO', 'reality-overwrite': 'SOBRESCRITA DA REALIDADE', absorption: 'ABSORÇÃO', heat: 'CALOR INTENSO', wind: 'LÂMINA DE VENTO', 'ultimate-lifeform': 'FORMA SUPREMA', water: 'ATAQUE AQUÁTICO', 'soul-gamble': 'JOGO DE ALMAS', void: 'VAZIO DIMENSIONAL', bomb: 'EXPLOSÃO', 'erase-time': 'TEMPO APAGADO', acceleration: 'ACELERAÇÃO TEMPORAL', dimension: 'DESLOCAMENTO DIMENSIONAL', calamity: 'CALAMIDADE', shrink: 'ENCOLHIMENTO', mirror: 'MUNDO DO ESPELHO', aging: 'ENVELHECIMENTO', ice: 'CONGELAMENTO', metal: 'LÂMINAS DE METAL', mold: 'MOFO', rain: 'CHUVA CORTANTE', rods: 'BARRAS DE LUZ', zombie: 'ZUMBIS', arrows: 'FLECHAS', electricity: 'DESCARGA ELÉTRICA', vampirism: 'VAMPIRISMO', sword: 'GOLPE DE ESPADA', strength: 'FORÇA BRUTA', hair: 'LAÇO DE CABELO', 'heavens-door': 'HEAVEN’S DOOR', swarm: 'ENXAME', 'fishing-line': 'LINHA DE PESCA', tracking: 'RASTREADOR', shadows: 'SOMBRA', devour: 'DEVORAR', dinosaur: 'SCARY MONSTERS', 'time-rewind': 'RETROCESSO TEMPORAL', attraction: 'ATRAÇÃO', vitaminc: 'VITAMIN C', ozone: 'OZÔNIO', leaves: 'FOLHAS CORTANTES', terrain: 'TERRENO ALTERADO', sniper: 'TIRO DE LONGO ALCANCE', emeralds: 'ESMERALDAS', army: 'BAD COMPANY' }[enemy.power];
        if (powerLabel) state.particles.push({ x: player.x, y: player.y - 35, text: powerLabel, time: 0.75, color: '#f3d27a' });
        player.hitFlash = 0.3;
        state.invulnerable = 0.65;
        state.screenShake = 4;
        spawnBurst(player.x, player.y, '#ed855e', 'damage');
        playTone(76, 0.08);
        if (player.hp <= 0) playerDefeated();
      }
    }
    return;
  }
  if (distanceToPlayer > 53 || shouldRetreat) {
    const speed = (enemy.approachSpeed || (enemy.empowered ? 63 : 49)) * (enemy.slow > 0 ? 0.48 : 1);
    const direction = shouldRetreat ? -1 : 1;
    if (enemy.body) {
      enemy.body.setVelocity(dx / distanceToPlayer * speed * direction, dy / distanceToPlayer * speed * direction);
    } else {
      enemy.x += dx / distanceToPlayer * speed * direction * dt;
      enemy.y += dy / distanceToPlayer * speed * direction * dt;
    }
  } else {
    enemy.body?.setVelocity(0, 0);
  }
  const powerProfile = villainPowerProfiles[enemy.power] || {};
  enemy.attackTimer -= dt;
  if (enemy.attackTimer <= 0 && distanceToPlayer < (enemy.attackRange || (enemy.empowered ? 150 : 82))) {
    const windupByPattern = { rapid: 0.2, rusher: 0.26, heavy: 0.72, ranged: 0.58, hazard: 0.78, trickster: 0.48, vampire: 0.64, temporal: 0.76, spatial: 0.68 };
    const duration = powerProfile.windup || windupByPattern[enemy.pattern] || 0.42;
    if (enemy.power === 'dimension') {
      const teleportX = Phaser.Math.Clamp(player.x + (enemy.x < player.x ? 165 : -165), 64, 896);
      const teleportY = Phaser.Math.Clamp(player.y + (enemy.y < player.y ? 92 : -92), 80, 500);
      enemy.x = teleportX; enemy.y = teleportY;
      if (enemy.physicsZone) { enemy.physicsZone.x = teleportX; enemy.physicsZone.y = teleportY; }
      enemy.body?.reset(teleportX, teleportY);
    }
    const radius = powerProfile.radius || (ranged ? 77 : enemy.pattern === 'spatial' ? 92 : 58);
    enemy.attackWindup = duration;
    enemy.attackTarget = { x: player.x, y: player.y, radius, power: enemy.power };
    enemy.attackTimer = (enemy.attackInterval || (enemy.empowered ? 1.05 : 1.45)) * (powerProfile.interval || 1);
    state.effects.push({ type: `enemy-power-${enemy.power || enemy.pattern}`, x: player.x, y: player.y, radius, time: duration, maxTime: duration });
        if (isPart3Dio(enemy) || enemy.id === 'dio-heaven') playNamedSfx('muda_muda_muda_sound_effect.mp3');
        if (isPart3Dio(enemy) && enemy.power === 'time-stop') playNamedSfx(ZA_WARUDO_SFX);
  }
}

function playerDefeated() {
  if (!state.fightActive) return;
  state.fightActive = false;
  const defeatMessages = {
    jonathan: 'Jonathan cai, mas o Hamon ainda pode virar o rumo do confronto.',
    joseph: 'Joseph recua após uma surpresa do inimigo e já prepara uma nova estratégia.',
    jotaro: 'Jotaro é forçado a recuar; Star Platinum voltará ao combate em instantes.',
    josuke4: 'Josuke cai protegendo Morioh; Crazy Diamond está pronto para tentar de novo.',
    giorno: 'Giorno é derrubado, mas Gold Experience ainda pode mudar o destino da luta.',
    jolyne: 'Jolyne recua por um momento; Stone Free voltará à batalha.',
    johnny: 'Johnny perde o equilíbrio, mas ainda pode retomar o controle da situação.',
    gappy: 'Gappy é surpreendido, mas Soft & Wet terá outra chance de virar a luta.',
    jodio: 'Jodio recua diante da pressão; November Rain voltará a cair sobre o inimigo.',
  };
  const message = defeatMessages[selectedCharacter().id] || `${selectedCharacter().name} foi derrotado. O confronto recomeçará em instantes.`;
  showToast(message);
  $('#battle-message').textContent = message;
  window.setTimeout(() => {
    if (state.player.hp > 0) return;
    resetBattle(state.mode);
    showToast('Batalha reiniciada. Tente outra estratégia.');
  }, 1700);
}

function spawnBurst(x, y, color, type) {
  const count = type.includes('impact') || type.includes('barrage') ? 12 : 8;
  for (let index = 0; index < count; index += 1) {
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.3;
    const speed = 18 + Math.random() * (type.includes('heaven') ? 135 : 85);
    state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, time: 0.35 + Math.random() * 0.4, maxTime: 0.75, color, size: 2 + Math.random() * 4 });
  }
}

const sceneKinds = Object.freeze({
  'p1-estate': 'mansion',
  'p1-stone-mask': 'london',
  'p1-hamon-training': 'river',
  'p1-jack': 'tunnel',
  'p1-bruford': 'ruins',
  'p1-tarkus': 'ruins',
  'p1-final-dio': 'castle',
  'p2-investigation': 'city',
  'p2-santana': 'facility',
  'p2-esidisi': 'volcano',
  'p2-wamuu': 'colosseum',
  'p2-kars': 'volcano',
  'p3-stand-awakening': 'cell',
  'p3-alliance': 'school',
  'p3-polnareff': 'hotel',
  'p3-ndoul': 'desert',
  'p3-darby': 'casino',
  'p3-vanilla-ice': 'mansion',
  'p3-dio': 'cairo',
  'p4-morioh': 'suburb',
  'p4-angelo': 'rain-house',
  'p4-keicho-akira': 'port',
  'p4-yukako': 'coast',
  'p4-rohan': 'studio',
  'p4-shigechi': 'school',
  'p4-kira': 'suburb',
  'p5-train': 'train',
  'p5-bucciarati': 'train',
  'p5-team': 'restaurant',
  'p5-missions': 'italy',
  'p5-polpo': 'prison',
  'p5-formaggio-illuso': 'italy',
  'p5-prosciutto-pesci': 'train',
  'p5-ghiacchio': 'snow',
  'p5-boss': 'venice',
  'p5-diavolo': 'colosseum',
  'p6-prison': 'prison',
  'p6-gwess': 'prison',
  'p6-johngalli': 'hospital',
  'p6-foo-sportsmaxx': 'swamp',
  'p6-rikiel': 'coast',
  'p6-versus': 'swamp',
  'p6-pucci': 'launchpad',
  'p7-start-race': 'beach',
  'p7-blackmore': 'rain-town',
  'p7-ringo': 'forest-cabin',
  'p7-valentine': 'train',
  'p7-infinite-rotation': 'coast',
  'p8-identity': 'rocky-coast',
  'p8-aisho': 'greenhouse',
  'p8-damo': 'home',
  'p8-poor-tom': 'orchard',
  'p8-tooru': 'hospital',
  'p9-hawaii': 'tropical-town',
  'p9-team': 'car',
  'p9-diamond': 'tropical-villa',
  'p9-open-chapter': 'volcano',
});

function currentSceneKind() {
  const stage = state.storyStage;
  if (stage && sceneKinds[stage.id]) return sceneKinds[stage.id];
  if (state.mode === 'final' && state.secretRunPhase?.startsWith('revenge')) return sceneKinds[stage?.id] || 'city';
  return ({ jonathan: 'mansion', joseph: 'city', jotaro: 'desert', josuke4: 'suburb', giorno: 'italy', jolyne: 'prison', johnny: 'beach', gappy: 'rocky-coast', jodio: 'tropical-town' })[selectedCharacter().id] || 'city';
}

function drawSceneFloor(theme, kind) {
  const ground = ctx.createLinearGradient(0, 145, 0, canvas.height);
  ground.addColorStop(0, theme?.ground || '#59634b');
  ground.addColorStop(1, theme?.floor || '#35453b');
  ctx.fillStyle = ground;
  ctx.fillRect(0, 145, canvas.width, canvas.height - 145);
  const tileColor = ['mansion', 'castle', 'casino', 'hotel', 'cell', 'school', 'facility', 'prison', 'hospital', 'train', 'restaurant', 'studio', 'home', 'car'].includes(kind)
    ? '#e5ddc11c' : '#f1e8c21a';
  for (let row = 0; row < 8; row += 1) {
    const y = 165 + row * 50;
    const inset = Math.round((y - 165) * 0.08);
    ctx.strokeStyle = row % 2 ? '#13191322' : tileColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inset, y);
    ctx.lineTo(canvas.width - inset, y);
    ctx.stroke();
  }
  for (let column = -2; column <= 14; column += 1) {
    const x = 480 + column * 78;
    ctx.strokeStyle = column % 2 ? '#10161010' : tileColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(480 + (x - 480) * 0.12, 145);
    ctx.lineTo(x, 540);
    ctx.stroke();
  }
}

function drawWallWindows(theme, width = 80, height = 44, gap = 18) {
  for (let x = 32; x < canvas.width - 30; x += width + gap) {
    ctx.fillStyle = '#171d1d';
    ctx.fillRect(x, 54, width, height);
    ctx.fillStyle = `${theme?.accent || '#e0cf91'}75`;
    ctx.fillRect(x + 5, 59, width - 10, height - 10);
    ctx.fillStyle = '#242a26';
    ctx.fillRect(x + width / 2 - 2, 54, 4, height);
  }
}

function drawBuildingRow(theme, tropical = false) {
  const colors = [theme?.wall || '#4c5148', theme?.ground || '#67634e', '#56584d'];
  for (let index = 0; index < 8; index += 1) {
    const x = index * 128 - 18;
    const height = 48 + (index * 29 % 52);
    ctx.fillStyle = '#14191655';
    ctx.fillRect(x + 7, 126 - height + 8, 124, height);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, 126 - height, 124, height);
    ctx.fillStyle = '#242b27';
    ctx.fillRect(x, 122 - height, 124, 6);
    for (let window = 0; window < 3; window += 1) {
      ctx.fillStyle = tropical ? '#82c8bc' : `${theme?.accent || '#e5d093'}85`;
      ctx.fillRect(x + 14 + window * 36, 90 - height, 20, 24);
      ctx.fillStyle = '#272d2a';
      ctx.fillRect(x + 12 + window * 36, 112 - height, 24, 4);
    }
    if (tropical && index % 2 === 0) drawTree(x + 110, 142, '#357a54');
  }
}

function drawTree(x, y, color = '#527348') {
  ctx.fillStyle = '#18251d70';
  ctx.fillRect(x - 15, y - 5, 34, 15);
  ctx.fillStyle = '#594a35';
  ctx.fillRect(x - 4, y - 22, 9, 28);
  ctx.fillStyle = color;
  ctx.fillRect(x - 18, y - 49, 37, 31);
  ctx.fillRect(x - 12, y - 59, 25, 16);
  ctx.fillStyle = '#a4b86766';
  ctx.fillRect(x - 10, y - 49, 10, 5);
}

function drawRoomColumns(theme, count = 6) {
  for (let index = 0; index < count; index += 1) {
    const x = 25 + index * (910 / (count - 1));
    ctx.fillStyle = '#15191666';
    ctx.fillRect(x + 6, 43, 13, 118);
    ctx.fillStyle = theme?.accent || '#bcb187';
    ctx.fillRect(x, 37, 16, 110);
    ctx.fillStyle = '#e5d6a65c';
    ctx.fillRect(x - 5, 35, 26, 7);
    ctx.fillRect(x - 3, 145, 22, 8);
  }
}

function drawSceneArchitecture(theme, kind, isFinal) {
  ctx.fillStyle = theme?.wall || '#343d37';
  ctx.fillRect(0, 0, canvas.width, 151);
  if (['mansion', 'castle', 'hotel', 'casino', 'restaurant', 'studio', 'home', 'school', 'tropical-villa'].includes(kind)) {
    drawWallWindows(theme, kind === 'casino' ? 100 : 74, 44, 26);
    ctx.fillStyle = '#171c19';
    ctx.fillRect(0, 112, canvas.width, 14);
    ctx.fillStyle = theme?.accent || '#c5b67e';
    ctx.fillRect(0, 109, canvas.width, 4);
    if (['mansion', 'castle'].includes(kind)) {
      drawRoomColumns(theme, 8);
      ctx.fillStyle = kind === 'castle' ? '#462d34' : '#53353c';
      ctx.fillRect(415, 150, 130, 390);
      for (let y = 175; y < 530; y += 46) {
        ctx.fillStyle = '#d7bc7850';
        ctx.fillRect(420, y, 120, 2);
      }
    }
  } else if (['city', 'london', 'cairo', 'suburb', 'port', 'italy', 'tropical-town', 'rain-town'].includes(kind)) {
    drawBuildingRow(theme, kind === 'tropical-town');
    ctx.fillStyle = '#252b2a';
    ctx.fillRect(0, 149, canvas.width, 69);
    ctx.fillStyle = '#d8d0b180';
    ctx.fillRect(0, 145, canvas.width, 6);
    ctx.fillRect(0, 216, canvas.width, 5);
    ctx.fillStyle = '#e9dfb991';
    for (let x = 60; x < 930; x += 138) ctx.fillRect(x, 181, 58, 3);
    if (kind === 'port') {
      for (let x = 64; x < 920; x += 170) {
        ctx.fillStyle = '#8b6042'; ctx.fillRect(x, 89, 128, 48);
        ctx.fillStyle = '#d19a5e'; ctx.fillRect(x + 8, 96, 112, 3);
        for (let line = 1; line < 5; line += 1) ctx.fillRect(x + line * 24, 94, 2, 41);
      }
    }
  } else if (['cell', 'prison', 'facility', 'hospital', 'launchpad'].includes(kind)) {
    ctx.fillStyle = kind === 'hospital' ? '#b1b8ae' : kind === 'launchpad' ? '#55606a' : '#49504d';
    ctx.fillRect(0, 0, canvas.width, 151);
    for (let x = 28; x < 950; x += 118) {
      ctx.fillStyle = '#292f2e';
      ctx.fillRect(x, 18, 83, 116);
      ctx.fillStyle = kind === 'hospital' ? '#d9ded5' : '#626a64';
      ctx.fillRect(x + 6, 24, 71, 104);
      ctx.fillStyle = theme?.accent || '#aeb7a2';
      ctx.fillRect(x + 11, 33, 61, 6);
      if (kind === 'prison' || kind === 'cell') {
        ctx.fillStyle = '#202726';
        for (let bar = 0; bar < 6; bar += 1) ctx.fillRect(x + 13 + bar * 11, 48, 3, 78);
      } else {
        ctx.fillStyle = '#344045';
        ctx.fillRect(x + 13, 68, 55, 24);
        ctx.fillStyle = '#d2d7d0';
        ctx.fillRect(x + 18, 63, 23, 8);
      }
    }
    ctx.fillStyle = '#d8e6e0';
    ctx.fillRect(0, 142, canvas.width, 8);
  } else if (kind === 'train' || kind === 'car') {
    ctx.fillStyle = '#242b2e';
    ctx.fillRect(0, 0, canvas.width, 151);
    for (let x = 12; x < 940; x += kind === 'car' ? 240 : 156) {
      ctx.fillStyle = '#1a2123'; ctx.fillRect(x, 24, kind === 'car' ? 214 : 138, 82);
      ctx.fillStyle = kind === 'car' ? '#718d86' : '#496d77'; ctx.fillRect(x + 7, 31, kind === 'car' ? 200 : 124, 66);
      ctx.fillStyle = '#1c2221'; ctx.fillRect(x + 3, 108, kind === 'car' ? 207 : 132, 28);
      ctx.fillStyle = '#946e4f'; ctx.fillRect(x + 13, 112, kind === 'car' ? 86 : 48, 18);
      ctx.fillRect(x + (kind === 'car' ? 116 : 70), 112, kind === 'car' ? 86 : 48, 18);
    }
    ctx.fillStyle = '#c9c4a5'; ctx.fillRect(0, 145, canvas.width, 6);
  } else if (kind === 'colosseum' || kind === 'ruins') {
    ctx.fillStyle = '#4d453b'; ctx.fillRect(0, 0, canvas.width, 151);
    for (let row = 0; row < 4; row += 1) {
      ctx.fillStyle = row % 2 ? '#80694b' : '#65543e';
      ctx.fillRect(0, 20 + row * 28, canvas.width, 24);
      for (let x = 12 + (row % 2) * 28; x < 960; x += 66) {
        ctx.fillStyle = '#332f2b'; ctx.fillRect(x, 23 + row * 28, 36, 17);
      }
    }
    ctx.fillStyle = '#b09a6b'; ctx.fillRect(0, 136, canvas.width, 12);
  } else if (['desert', 'beach', 'coast', 'rocky-coast'].includes(kind)) {
    ctx.fillStyle = kind === 'beach' || kind.includes('coast') ? '#547b84' : '#cbb26f';
    ctx.fillRect(0, 0, canvas.width, kind === 'desert' ? 151 : 126);
    if (kind !== 'desert') {
      ctx.fillStyle = '#d0b875'; ctx.fillRect(0, 115, canvas.width, 39);
      for (let wave = 0; wave < 6; wave += 1) {
        ctx.strokeStyle = wave % 2 ? '#d7e8d766' : '#83b8b177'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, 76 + wave * 10); ctx.quadraticCurveTo(250, 68 + wave * 10, 480, 80 + wave * 10); ctx.quadraticCurveTo(720, 91 + wave * 10, 960, 74 + wave * 10); ctx.stroke();
      }
    } else {
      for (let dune = 0; dune < 8; dune += 1) {
        ctx.fillStyle = dune % 2 ? '#a48653' : '#94774d';
        ctx.beginPath(); ctx.ellipse(dune * 142 - 20, 124, 106, 34 + dune % 3 * 7, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (['river', 'forest-cabin', 'swamp', 'orchard', 'greenhouse'].includes(kind)) {
    ctx.fillStyle = kind === 'swamp' ? '#364b3c' : '#435840';
    ctx.fillRect(0, 0, canvas.width, 151);
    if (kind === 'river') {
      ctx.fillStyle = '#457e8b'; ctx.fillRect(0, 106, canvas.width, 46);
      ctx.fillStyle = '#a5d6d477';
      for (let x = 16; x < 950; x += 75) ctx.fillRect(x, 117 + x % 4 * 3, 36, 3);
    }
    for (let x = 35; x < 950; x += 108) drawTree(x, 157, kind === 'orchard' ? '#667744' : '#31583f');
    if (kind === 'forest-cabin') {
      ctx.fillStyle = '#4d392f'; ctx.fillRect(365, 72, 230, 92);
      ctx.fillStyle = '#7b5641'; ctx.beginPath(); ctx.moveTo(343, 78); ctx.lineTo(480, 20); ctx.lineTo(617, 78); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#282622'; ctx.fillRect(445, 107, 70, 57);
    } else if (kind === 'greenhouse') {
      ctx.fillStyle = '#89b4a14a'; ctx.fillRect(210, 30, 540, 116);
      ctx.strokeStyle = '#c6ddd0'; ctx.lineWidth = 4;
      for (let x = 210; x <= 750; x += 90) { ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, 145); ctx.stroke(); }
      ctx.strokeRect(210, 30, 540, 116);
    }
  } else if (kind === 'volcano' || kind === 'snow') {
    ctx.fillStyle = kind === 'snow' ? '#879aa1' : '#443934';
    ctx.fillRect(0, 0, canvas.width, 151);
    for (let peak = 0; peak < 6; peak += 1) {
      const x = peak * 205 - 55;
      ctx.fillStyle = kind === 'snow' ? '#647781' : '#51423a';
      ctx.beginPath(); ctx.moveTo(x, 144); ctx.lineTo(x + 103, 23 + (peak % 2) * 28); ctx.lineTo(x + 212, 144); ctx.closePath(); ctx.fill();
      ctx.fillStyle = kind === 'snow' ? '#e2e8e4' : '#f27c3f';
      ctx.beginPath(); ctx.moveTo(x + 75, 58 + (peak % 2) * 28); ctx.lineTo(x + 103, 23 + (peak % 2) * 28); ctx.lineTo(x + 131, 58 + (peak % 2) * 28); ctx.closePath(); ctx.fill();
    }
  } else if (kind === 'tunnel' || kind === 'snow') {
    ctx.fillStyle = '#282c2d'; ctx.fillRect(0, 0, canvas.width, 151);
    for (let x = 0; x < canvas.width; x += 95) {
      ctx.strokeStyle = '#927859'; ctx.lineWidth = 7; ctx.strokeRect(x + 7, 20, 80, 127);
    }
  } else {
    drawBuildingRow(theme);
  }
}

function drawSceneProps(kind, theme) {
  if (['city', 'london', 'cairo', 'suburb', 'port', 'italy', 'tropical-town', 'rain-town'].includes(kind)) {
    ctx.fillStyle = '#252b2a';
    ctx.fillRect(0, 149, canvas.width, 69);
    ctx.fillStyle = '#d8d0b180';
    ctx.fillRect(0, 145, canvas.width, 6);
    ctx.fillRect(0, 216, canvas.width, 5);
    ctx.fillStyle = '#e9dfb991';
    for (let x = 60; x < 930; x += 138) ctx.fillRect(x, 181, 58, 3);
    if (kind === 'port') {
      for (let x = 64; x < 920; x += 170) {
        ctx.fillStyle = '#8b6042'; ctx.fillRect(x, 89, 128, 48);
        ctx.fillStyle = '#d19a5e'; ctx.fillRect(x + 8, 96, 112, 3);
        for (let line = 1; line < 5; line += 1) ctx.fillRect(x + line * 24, 94, 2, 41);
      }
    }
  }
  if (kind === 'mansion' || kind === 'castle') {
    ctx.fillStyle = kind === 'castle' ? '#462d34' : '#53353c';
    ctx.fillRect(415, 150, 130, 390);
    for (let y = 175; y < 530; y += 46) {
      ctx.fillStyle = '#d7bc7850';
      ctx.fillRect(420, y, 120, 2);
    }
  }
  if (kind === 'casino') {
    for (const [x, y] of [[145, 232], [480, 294], [810, 224]]) {
      ctx.fillStyle = '#171d18';
      ctx.beginPath(); ctx.ellipse(x, y + 9, 74, 40, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#75543c'; ctx.fillRect(x - 8, y + 12, 16, 45);
      ctx.fillStyle = '#26634d';
      ctx.beginPath(); ctx.ellipse(x, y, 68, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9c17a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, 29, 15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d3e85a';
      ctx.fillRect(x - 25, y - 3, 5, 7); ctx.fillRect(x + 18, y + 3, 5, 7);
    }
  }
  if (kind === 'restaurant' || kind === 'studio' || kind === 'home') {
    for (const [x, y] of [[155, 232], [800, 221], [175, 430], [786, 426]]) {
      ctx.fillStyle = '#1c211d80';
      ctx.beginPath(); ctx.ellipse(x, y + 8, 50, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kind === 'studio' ? '#795947' : '#8b6950';
      ctx.beginPath(); ctx.ellipse(x, y, 43, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9c08a'; ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }
  if (kind === 'school') {
    for (const [x, y] of [[160, 246], [365, 250], [590, 246], [800, 250]]) {
      ctx.fillStyle = '#252b28'; ctx.fillRect(x, y, 65, 36);
      ctx.fillStyle = '#866d50'; ctx.fillRect(x + 3, y - 5, 59, 27);
      ctx.fillStyle = '#d4c89e'; ctx.fillRect(x + 9, y + 5, 15, 11);
      ctx.fillStyle = '#42382e'; ctx.fillRect(x + 5, y + 31, 4, 12); ctx.fillRect(x + 55, y + 31, 4, 12);
    }
  }
  if (kind === 'mansion' || kind === 'castle') {
    ctx.fillStyle = kind === 'castle' ? '#462d34' : '#53353c';
    ctx.fillRect(415, 150, 130, 390);
    for (let y = 175; y < 530; y += 46) {
      ctx.fillStyle = '#d7bc7850';
      ctx.fillRect(420, y, 120, 2);
    }
  }
  if (kind === 'casino') {
    for (const [x, y] of [[145, 232], [480, 294], [810, 224]]) {
      ctx.fillStyle = '#171d18';
      ctx.beginPath(); ctx.ellipse(x, y + 9, 74, 40, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#75543c'; ctx.fillRect(x - 8, y + 12, 16, 45);
      ctx.fillStyle = '#26634d';
      ctx.beginPath(); ctx.ellipse(x, y, 68, 34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d9c17a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, 29, 15, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#d3e85a';
      ctx.fillRect(x - 25, y - 3, 5, 7); ctx.fillRect(x + 18, y + 3, 5, 7);
    }
  }
  if (kind === 'restaurant' || kind === 'studio' || kind === 'home') {
    for (const [x, y] of [[155, 232], [800, 221], [175, 430], [786, 426]]) {
      ctx.fillStyle = '#1c211d80';
      ctx.beginPath(); ctx.ellipse(x, y + 8, 50, 25, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kind === 'studio' ? '#795947' : '#8b6950';
      ctx.beginPath(); ctx.ellipse(x, y, 43, 21, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d9c08a'; ctx.fillRect(x - 4, y - 4, 8, 8);
    }
  }
  if (kind === 'beach' || kind === 'coast' || kind === 'tropical-town' || kind === 'tropical-villa') {
    drawTree(62, 227, '#30764d');
    drawTree(900, 221, '#347850');
    if (kind === 'beach') {
      ctx.fillStyle = '#a89161'; ctx.fillRect(0, 305, 960, 8);
      for (let x = 96; x < 900; x += 185) {
        ctx.fillStyle = '#e4d7b384'; ctx.fillRect(x, 204, 3, 90);
        ctx.fillRect(x - 21, 205, 45, 3);
      }
    }
  } else if (kind === 'volcano') {
    ctx.strokeStyle = '#ed7244'; ctx.lineWidth = 5;
    for (let crack = 0; crack < 4; crack += 1) {
      const x = 110 + crack * 223;
      ctx.beginPath(); ctx.moveTo(x, 158); ctx.lineTo(x + 38, 207); ctx.lineTo(x + 18, 260); ctx.lineTo(x + 71, 321); ctx.stroke();
    }
    for (const [x, y] of [[126, 337], [812, 292], [741, 454]]) drawRubble(x, y);
  } else if (kind === 'snow') {
    ctx.fillStyle = '#dce7e455';
    for (let x = 30; x < 950; x += 72) ctx.fillRect(x, 160 + (x % 5) * 43, 35, 4);
  } else if (kind === 'prison' || kind === 'cell') {
    ctx.fillStyle = '#202626';
    for (let x = 20; x < 950; x += 112) {
      ctx.fillRect(x, 210, 4, 292);
      ctx.fillRect(x + 94, 210, 4, 292);
      ctx.fillRect(x, 209, 98, 6);
      ctx.fillRect(x, 496, 98, 6);
    }
  } else if (kind === 'casino' || kind === 'restaurant') {
    for (const [x, y] of kind === 'casino' ? [[145, 232], [480, 294], [810, 224]] : [[290, 252], [672, 411]]) {
      ctx.fillStyle = '#171d18';
      ctx.beginPath(); ctx.ellipse(x, y + 9, 70, 38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kind === 'casino' ? '#26634d' : '#8b6950';
      ctx.beginPath(); ctx.ellipse(x, y, 64, 32, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = kind === 'casino' ? '#d9c17a' : '#d9c08a';
      ctx.beginPath(); ctx.ellipse(x, y, kind === 'casino' ? 28 : 0, kind === 'casino' ? 14 : 0, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#5c4235'; ctx.fillRect(x - 4, y + 12, 8, 32);
    }
  } else if (kind === 'train' || kind === 'car') {
    ctx.fillStyle = '#171c1d';
    ctx.fillRect(0, 151, 14, 389); ctx.fillRect(946, 151, 14, 389);
    for (let y = 182; y < 520; y += 77) {
      ctx.fillStyle = '#5a5044'; ctx.fillRect(28, y, 84, 36); ctx.fillRect(848, y, 84, 36);
      ctx.fillStyle = '#b18b5f'; ctx.fillRect(35, y + 5, 70, 4); ctx.fillRect(855, y + 5, 70, 4);
    }
  } else if (kind === 'hospital') {
    for (const [x, y] of [[86, 262], [830, 420]]) {
      ctx.fillStyle = '#242c2f'; ctx.fillRect(x, y, 112, 34);
      ctx.fillStyle = '#d5ddd8'; ctx.fillRect(x + 5, y - 14, 103, 24);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 13, y - 12, 35, 17);
      ctx.fillStyle = '#66716c'; ctx.fillRect(x + 4, y + 34, 4, 13); ctx.fillRect(x + 103, y + 34, 4, 13);
    }
  } else if (kind === 'forest-cabin' || kind === 'orchard' || kind === 'river' || kind === 'swamp') {
    for (let x = 44; x < 950; x += 146) drawTree(x, 516, kind === 'orchard' ? '#687b48' : '#345943');
  } else if (kind === 'colosseum' || kind === 'ruins') {
    for (let x = 48; x < 930; x += 144) {
      ctx.fillStyle = '#312d29'; ctx.fillRect(x, 184, 20, 132);
      ctx.fillStyle = theme?.accent || '#a99369'; ctx.fillRect(x - 8, 178, 36, 10);
      ctx.fillRect(x - 5, 314, 30, 8);
    }
    ctx.strokeStyle = '#d4c09555'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(480, 366, 322, 128, 0, 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'mansion' || kind === 'castle') {
    for (const [x, y] of [[170, 265], [790, 393]]) {
      ctx.fillStyle = '#171b18'; ctx.fillRect(x - 28, y + 7, 56, 20);
      ctx.fillStyle = '#68454b'; ctx.fillRect(x - 24, y - 13, 48, 19);
      ctx.fillStyle = theme?.accent || '#c9b986'; ctx.fillRect(x - 27, y - 16, 54, 4);
    }
  } else if (kind === 'suburb' || kind === 'tropical-villa' || kind === 'home' || kind === 'studio') {
    for (const [x, y] of [[86, 241], [874, 430]]) {
      ctx.fillStyle = '#20251f80'; ctx.fillRect(x - 34, y + 22, 72, 12);
      ctx.fillStyle = theme?.accent || '#c7b788'; ctx.fillRect(x - 31, y - 2, 64, 27);
      ctx.fillStyle = '#48504b'; ctx.fillRect(x - 24, y + 4, 18, 18); ctx.fillRect(x + 5, y + 4, 18, 18);
    }
  }
}

function drawRubble(x, y) {
  ctx.fillStyle = '#252927';
  ctx.fillRect(x - 18, y + 5, 43, 9);
  ctx.fillStyle = '#817866';
  ctx.fillRect(x - 13, y - 2, 16, 10);
  ctx.fillRect(x + 2, y - 8, 18, 13);
  ctx.fillStyle = '#aaa084';
  ctx.fillRect(x - 9, y - 5, 7, 4);
}

function drawBackground() {
  const revengeMap = state.mode === 'final' && state.secretRunPhase?.startsWith('revenge');
  const theme = state.mode === 'campaign' || revengeMap ? state.storyStage?.palette : null;
  const kind = currentSceneKind();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, theme?.wall || (state.mode === 'final' ? '#282b34' : '#3c4a3d'));
  gradient.addColorStop(0.31, theme?.ground || (state.mode === 'final' ? '#36343a' : '#53604a'));
  gradient.addColorStop(1, theme?.floor || (state.mode === 'final' ? '#26333a' : '#324437'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawSceneArchitecture(theme, kind, state.mode === 'final');
  drawSceneFloor(theme, kind);
  drawSceneProps(kind, theme);
  const progress = state.mode === 'campaign' ? currentCampaignProgress() : null;
  const ruinedEstate = kind === 'castle' && ['ENVIRONMENT_CHANGED', 'NEXT_STAGE_UNLOCKED', 'STAGE_COMPLETE'].includes(progress?.phase);
  if (ruinedEstate) {
    for (const [x, y] of [[251, 293], [698, 246], [590, 445]]) drawRubble(x, y);
    ctx.globalAlpha = 0.8;
    for (let flame = 0; flame < 7; flame += 1) {
      const x = 52 + flame * 137;
      const flicker = Math.sin(state.elapsed * 11 + flame) * 5;
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath(); ctx.moveTo(x - 12, 160); ctx.lineTo(x, 127 + flicker); ctx.lineTo(x + 13, 161); ctx.fill();
      ctx.fillStyle = '#ffd36e';
      ctx.beginPath(); ctx.moveTo(x - 5, 158); ctx.lineTo(x, 140 + flicker); ctx.lineTo(x + 6, 159); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (kind === 'rain-house' || kind === 'rain-town') {
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#c4e0e5';
    ctx.lineWidth = 1;
    for (let drop = 0; drop < 58; drop += 1) {
      const x = (drop * 97 + state.elapsed * 75) % canvas.width;
      const y = (drop * 53 + state.elapsed * 190) % canvas.height;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 12); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (kind === 'snow') {
    ctx.fillStyle = '#f2f4e8';
    for (let flake = 0; flake < 44; flake += 1) {
      const x = (flake * 113 + state.elapsed * 19) % canvas.width;
      const y = (flake * 71 + state.elapsed * 24) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  drawStoryLandmarks(theme);
  drawDepthRails();
}

function drawStoryLandmarks(theme) {
  const revengeMap = state.mode === 'final' && state.secretRunPhase?.startsWith('revenge');
  if (state.mode !== 'campaign' && !revengeMap) return;
  const stage = state.storyStage;
  const progress = revengeMap ? null : currentCampaignProgress();
  if (!stage) {
    const complete = progress.phase === STORY_PHASES.CAMPAIGN_COMPLETE;
    ctx.fillStyle = complete ? '#d3e85a' : '#707c62';
    ctx.fillRect(855, 278, 48, 6);
    ctx.fillRect(855, 284, 6, complete ? 36 : 62);
    ctx.fillRect(897, 284, 6, complete ? 36 : 62);
    ctx.fillStyle = '#20251f';
    ctx.fillRect(867, 286, 24, 43);
    if (complete) {
      ctx.fillStyle = '#d3e85a';
      ctx.fillRect(878, 302, 3, 4);
    }
    return;
  }

  if (progress?.phase === STORY_PHASES.OBJECTIVE_ACTIVE) {
    const marker = stage.objective;
    const bob = Math.sin(state.elapsed * 4) * 4;
    ctx.globalAlpha = 0.2 + Math.sin(state.elapsed * 5) * 0.05;
    ctx.fillStyle = theme?.accent || '#d3e85a';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme?.accent || '#d3e85a';
    ctx.beginPath();
    ctx.moveTo(marker.x, marker.y - 12 + bob);
    ctx.lineTo(marker.x + 9, marker.y + bob);
    ctx.lineTo(marker.x, marker.y + 12 + bob);
    ctx.lineTo(marker.x - 9, marker.y + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#171a19';
    ctx.fillRect(marker.x - 2, marker.y + bob - 2, 4, 4);
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#f0eee0';
    ctx.fillText('PISTA · F', marker.x, marker.y - 24 + bob);
    if (distance(state.player, marker) <= 86) {
      ctx.fillStyle = theme?.accent || '#d3e85a';
      ctx.fillText('PRESSIONE F', state.player.x, state.player.y - 48);
    }
  }

  if (progress && (progress.unlockedPathIds.includes(stage.pathId) || progress.phase === STORY_PHASES.ENVIRONMENT_CHANGED || progress.phase === STORY_PHASES.NEXT_STAGE_UNLOCKED || progress.phase === STORY_PHASES.STAGE_COMPLETE)) {
    const open = progress.phase !== STORY_PHASES.POST_BATTLE;
    ctx.fillStyle = theme?.accent || '#d3e85a';
    ctx.globalAlpha = 0.6 + Math.sin(state.elapsed * 3) * 0.14;
    ctx.fillRect(858, 250, 48, 5);
    ctx.fillRect(858, 255, 5, 58);
    ctx.fillRect(901, 255, 5, 58);
    if (open) ctx.fillRect(872, 270, 3, 43);
    ctx.globalAlpha = 1;
  }
}

function drawPlanter(x, y) {
  ctx.fillStyle = '#1c211e';
  ctx.fillRect(x - 22, y + 7, 44, 12);
  ctx.fillStyle = '#746b55';
  ctx.fillRect(x - 22, y, 44, 12);
  ctx.fillStyle = '#68734c';
  ctx.fillRect(x - 18, y - 8, 36, 9);
  ctx.fillStyle = '#898957';
  ctx.fillRect(x - 12, y - 16, 8, 9);
  ctx.fillRect(x + 3, y - 20, 9, 12);
  ctx.fillStyle = '#bdaf71';
  ctx.fillRect(x - 11, y - 15, 4, 4);
  ctx.fillRect(x + 4, y - 19, 4, 5);
}

function drawDepthRails() {
  const rails = state.mode === 'final' ? ['#8a738344', '#d6d5c522'] : ['#d3d1b422', '#292c2544'];
  for (let index = 0; index < 5; index += 1) {
    const y = 183 + index * 54;
    ctx.fillStyle = rails[index % 2];
    ctx.fillRect(14, y, 21, 3);
    ctx.fillRect(926, y, 21, 3);
    ctx.fillRect(14, y + 3, 3, 17);
    ctx.fillRect(944, y + 3, 3, 17);
  }
}

function getPreparedSprite(spriteAsset) {
  return spriteAsset ? preparedSprites.get(spriteAsset.key) || null : null;
}

function animationPhase(identity) {
  return [...String(identity)].reduce((value, letter) => (value + letter.charCodeAt(0)) % 4, 0);
}

function drawFighter(x, y, color, isPlayer, scale = 1, facingX = 1, hitFlash = 0, animation = 0, spriteAsset = null, moving = false, animationIdentity = '', attackAction = 'special') {
  const spriteScale = 1.8 * scale;
  const attacking = animation > 0;
  const walking = moving && !attacking;
  const attackMotion = Math.sin(state.elapsed * 34);
  const phase = animationPhase(animationIdentity || (isPlayer ? selectedCharacter().id : 'enemy'));
  const mode = attacking ? 'attack' : moving ? 'walk' : 'idle';
  const frame = spriteAnimationFrame(mode, state.elapsed, phase);
  const step = [-1, 0, 1, 0][frame];
  const idleBob = [0, -0.5, -1, -0.5][frame];
  const walkBob = [0, -1.5, 0, -1.5][frame];
  const bob = attacking ? Math.sin(state.elapsed * 26) * 2 : walking ? walkBob[frame] : idleBob;
  ctx.save();
  ctx.translate(Math.round(x + (walking ? step * 1.2 : 0)), Math.round(y + bob));
  ctx.scale(facingX < 0 ? -1 : 1, 1);
  if (walking) ctx.rotate(step * 0.018);
  ctx.imageSmoothingEnabled = false;
  const baseSprite = getPreparedSprite(spriteAsset);
  const pixelFrames = baseSprite?.frames;
  const action = resolveSpriteAction(pixelFrames, attacking, walking, attackAction);
  const sprite = pixelFrames?.[action]?.[frame] || baseSprite;
  if (sprite) {
    const ratio = sprite.width / sprite.height;
    const targetHeight = (sprite.isPixelSheet || baseSprite.isPixelSheet ? 120 : 104) * scale;
    const targetWidth = Math.min(targetHeight * ratio, (pixelFrames ? 112 : baseSprite.isPixelSheet ? 260 : 78) * scale);
    if (baseSprite.isPixelSheet && !animation) { const breathe = 1 + Math.sin(state.elapsed * 5 + x) * 0.02; ctx.scale(1 / breathe, breathe); }
    if (baseSprite.isPixelSheet && attacking && !pixelFrames) {
      ctx.translate(4 + Math.max(0, attackMotion) * 7, 0);
      ctx.rotate(attackMotion * 0.035);
    }
    const drawnHeight = Math.min(targetHeight, targetWidth / ratio);
    const scalePulse = attacking ? 1 + (frame % 2) * 0.035 : 1;
    ctx.fillStyle = '#10151288';
    ctx.beginPath();
    ctx.ellipse(0, 9 * spriteScale, 13 * spriteScale, 4 * spriteScale, 0, 0, Math.PI * 2);
    ctx.fill();
    const frameBob = pixelFrames ? 0 : frame === 1 ? -2 : frame === 3 ? 1 : 0;
    if (baseSprite.isPixelSheet && attacking && !pixelFrames) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(sprite, -targetWidth / 2 - 11, -drawnHeight + 8 + frameBob, targetWidth, drawnHeight);
      ctx.globalAlpha = 0.32;
      ctx.drawImage(sprite, -targetWidth / 2 - 6, -drawnHeight + 8 + frameBob, targetWidth, drawnHeight);
    }
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sprite, -targetWidth * scalePulse / 2, -drawnHeight * scalePulse + 8 + frameBob, targetWidth * scalePulse, drawnHeight * scalePulse);
    if (baseSprite.isPixelSheet && attacking) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = color;
      ctx.fillRect(targetWidth * 0.22, -drawnHeight * 0.68, 11 * scale, 3 * scale);
      ctx.fillStyle = '#f2dd6a';
      ctx.fillRect(targetWidth * 0.28, -drawnHeight * 0.61, 7 * scale, 2 * scale);
      ctx.globalAlpha = 0.9;
    }
    if (hitFlash > 0) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = '#ffffff88';
      ctx.fillRect(-targetWidth / 2, -drawnHeight + 8, targetWidth, drawnHeight);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = '#11151088';
  ctx.fillRect(-15 * spriteScale, 9 * spriteScale, 31 * spriteScale, 6 * spriteScale);
  if (isPlayer && state.selected === 2 && state.jotaroAwakened && state.mode === 'final') {
    ctx.globalAlpha = 0.55 + Math.sin(state.elapsed * 11) * 0.14;
    ctx.fillStyle = '#f2dd6a';
    ctx.fillRect(-13 * spriteScale, -30 * spriteScale, 27 * spriteScale, 47 * spriteScale);
    ctx.globalAlpha = 1;
  }
  const outline = hitFlash > 0 ? '#ffffff' : '#29282a';
  ctx.fillStyle = outline;
  ctx.fillRect(-6 * spriteScale, -14 * spriteScale, 13 * spriteScale, 23 * spriteScale);
  ctx.fillStyle = hitFlash > 0 ? '#ffffff' : color;
  ctx.fillRect(-5 * spriteScale, -13 * spriteScale, 11 * spriteScale, 19 * spriteScale);
  ctx.fillStyle = '#242329';
  ctx.fillRect((-8 - (walking ? step : 0)) * spriteScale, 5 * spriteScale, 6 * spriteScale, 7 * spriteScale);
  ctx.fillRect((2 + (walking ? step : 0)) * spriteScale, 5 * spriteScale, 6 * spriteScale, 7 * spriteScale);
  ctx.fillStyle = '#ded0ae';
  ctx.fillRect(-6 * spriteScale, -24 * spriteScale, 12 * spriteScale, 12 * spriteScale);
  ctx.fillStyle = '#bc9c79';
  ctx.fillRect(-2 * spriteScale, -20 * spriteScale, 2 * spriteScale, 2 * spriteScale);
  ctx.fillStyle = outline;
  ctx.fillRect(-7 * spriteScale, -27 * spriteScale, 14 * spriteScale, 6 * spriteScale);
  ctx.fillStyle = color;
  ctx.fillRect(-8 * spriteScale, -28 * spriteScale, 16 * spriteScale, 3 * spriteScale);
  ctx.fillRect(-6 * spriteScale, -31 * spriteScale, 13 * spriteScale, 4 * spriteScale);
  ctx.fillStyle = '#eee1c0';
  ctx.fillRect(-7 * spriteScale, -17 * spriteScale, 14 * spriteScale, 2 * spriteScale);
  const armOffset = attacking ? Math.sin(state.elapsed * 40) * 3 : walking ? -step * 2 : 0;
  ctx.fillStyle = hitFlash ? '#fff' : color;
  ctx.fillRect(6 * spriteScale, -11 * spriteScale + armOffset, 8 * spriteScale, 5 * spriteScale);
  ctx.fillStyle = '#ded0ae';
  ctx.fillRect(12 * spriteScale, -10 * spriteScale + armOffset, 4 * spriteScale, 5 * spriteScale);
  if (isPlayer) {
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = '#e9cfb1';
    ctx.fillRect(-4 * spriteScale, -9 * spriteScale, 8 * spriteScale, 13 * spriteScale);
    ctx.fillRect(-7 * spriteScale, -15 * spriteScale, 14 * spriteScale, 4 * spriteScale);
    ctx.fillStyle = '#f2e4c9';
    ctx.fillRect(-8 * spriteScale, -17 * spriteScale, 16 * spriteScale, 2 * spriteScale);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawStand(x, y, character, facingX = 1) {
  const colors = {
    jotaro: ['#b7a8e8', '#765ca7', '#e6cf6a'], josuke4: ['#6dc9e0', '#34799d', '#f2d36b'],
    giorno: ['#e6c963', '#ab6f3e', '#f4e4a1'], jolyne: ['#69d3b6', '#368b83', '#e5cf7a'],
    johnny: ['#75b4dc', '#496eac', '#e3c876'], gappy: ['#d9d7c6', '#4f9db0', '#e5c85e'],
    jodio: ['#8eb85a', '#506f3a', '#e4d16b'],
  }[character.id] || ['#9c9ed7', '#555c99', '#e6ce69'];
  const [body, shade, trim] = colors;
  const pulse = Math.sin(state.elapsed * 7) * 2;
  const xOffset = facingX >= 0 ? 27 : -27;
  ctx.save();
  ctx.translate(Math.round(x + xOffset), Math.round(y - 12 + pulse));
  ctx.globalAlpha = 0.87;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = `${body}35`;
  ctx.fillRect(-19, -38, 38, 49);
  ctx.fillStyle = shade;
  ctx.fillRect(-9, -39, 18, 9);
  ctx.fillRect(-14, -28, 28, 23);
  ctx.fillRect(-19, -23, 7, 18);
  ctx.fillRect(12, -23, 7, 18);
  ctx.fillRect(-11, -5, 8, 15);
  ctx.fillRect(4, -5, 8, 15);
  ctx.fillStyle = body;
  ctx.fillRect(-7, -37, 14, 7);
  ctx.fillRect(-10, -25, 20, 17);
  ctx.fillRect(-16, -21, 5, 13);
  ctx.fillRect(11, -21, 5, 13);
  ctx.fillRect(-9, -3, 5, 13);
  ctx.fillRect(4, -3, 5, 13);
  ctx.fillStyle = trim;
  ctx.fillRect(-3, -24, 6, 3);
  ctx.fillRect(-12, -17, 3, 3);
  ctx.fillRect(9, -17, 3, 3);
  ctx.globalAlpha = 0.28 + Math.sin(state.elapsed * 9) * 0.08;
  ctx.fillStyle = trim;
  ctx.fillRect(-22, -32, 44, 2);
  ctx.restore();
}

function drawEffects() {
  for (const effect of state.effects) {
    const progress = 1 - effect.time / effect.maxTime;
    const fade = Math.max(0, 1 - progress);
    ctx.save();
    if (effect.type === 'rain') {
      ctx.globalAlpha = 0.13 + fade * 0.12;
      ctx.fillStyle = effect.heavy ? '#8dbfcc' : '#6eb6c6';
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, effect.radius, effect.radius * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.74;
      ctx.strokeStyle = '#bddfe0';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, effect.radius * 0.93, effect.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let drop = 0; drop < 17; drop += 1) {
        const angle = (drop / 17) * Math.PI * 2 + state.elapsed * 1.6;
        const radius = effect.radius * (0.22 + ((drop * 17) % 63) / 100);
        const dx = Math.cos(angle) * radius;
        const dy = Math.sin(angle) * radius * 0.66;
        ctx.fillStyle = '#d9eff1bd';
        ctx.fillRect(effect.x + dx, effect.y + dy, 2, effect.heavy ? 9 : 6);
      }
    } else if (effect.type === 'trap' || effect.type === 'string') {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = effect.activated ? '#ef8c72' : '#d3e85a';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, effect.radius, effect.radius * 0.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (effect.targetX !== undefined) {
      const travel = Math.min(1, progress * 2.2);
      const x = effect.x + (effect.targetX - effect.x) * travel;
      const y = effect.y + (effect.targetY - effect.y) * travel;
      ctx.fillStyle = effect.type.includes('bubble') ? '#c9f1e1' : '#f3e2a4';
      ctx.fillRect(x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#ffffffa0';
      ctx.fillRect(x - 2, y - 3, 3, 3);
    } else {
      let color = selectedCharacter().color;
      if (effect.type.startsWith('enemy-power-')) {
        const power = effect.type.slice('enemy-power-'.length);
        color = ({ 'time-stop': '#8bd4e5', 'erase-time': '#e68a58', acceleration: '#e6d45f', bomb: '#ed745d', calamity: '#bd83cb', heat: '#fa7a45', ice: '#a4e2f0', void: '#a89ad3', dimension: '#db94dd', water: '#5aafd0', wind: '#c5e69a', mold: '#8cb568' })[power] || '#e9bd6b';
      }
      if (effect.type.includes('temporal') || effect.type.includes('heaven') || effect.type.includes('overwrite') || effect.type.includes('impact')) color = '#f2dd6a';
      if (effect.type.includes('time') || effect.type.includes('reality')) color = '#a7d3d3';
      if (effect.type.includes('hamon') || effect.type.includes('sunlight')) color = '#ffe387';
      ctx.globalAlpha = 0.26 + fade * 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = effect.type.includes('cinematic') ? 5 : 2;
      ctx.beginPath();
      ctx.ellipse(effect.x, effect.y, Math.max(5, effect.radius * (0.68 + progress * 0.45)), Math.max(4, effect.radius * (0.43 + progress * 0.45)), 0, 0, Math.PI * 2);
      ctx.stroke();
      if (!['basic', 'impact', 'trap', 'string', 'rain', 'heal'].includes(effect.type)) {
        const glyphPhase = animationPhase(effect.type) * 0.35 + progress * Math.PI * 2;
        const glyphCount = 4 + animationPhase(effect.type);
        ctx.globalAlpha = 0.72 * fade;
        ctx.lineWidth = 2;
        for (let glyph = 0; glyph < glyphCount; glyph += 1) {
          const angle = glyphPhase + glyph * Math.PI * 2 / glyphCount;
          const inner = effect.radius * (0.18 + (glyph % 2) * 0.08);
          const outer = effect.radius * (0.42 + progress * 0.18);
          ctx.beginPath();
          ctx.moveTo(effect.x + Math.cos(angle) * inner, effect.y + Math.sin(angle) * inner * 0.7);
          ctx.lineTo(effect.x + Math.cos(angle + 0.12) * outer, effect.y + Math.sin(angle + 0.12) * outer * 0.7);
          ctx.stroke();
        }
      }
      if (effect.type.includes('reality') || effect.type.includes('overwrite') || effect.type.includes('mobius')) {
        ctx.beginPath();
        ctx.moveTo(effect.x - effect.radius * 0.35, effect.y - effect.radius * 0.35);
        ctx.lineTo(effect.x + effect.radius * 0.2, effect.y + effect.radius * 0.05);
        ctx.lineTo(effect.x - effect.radius * 0.08, effect.y + effect.radius * 0.39);
        ctx.lineTo(effect.x + effect.radius * 0.4, effect.y - effect.radius * 0.32);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  for (const particle of state.particles) {
    const opacity = Math.min(1, particle.time / (particle.maxTime || 1));
    ctx.globalAlpha = opacity;
    if (particle.text) {
      ctx.fillStyle = particle.color;
      ctx.font = 'bold 13px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(particle.text, particle.x, particle.y - (1 - opacity) * 22);
    } else {
      particle.x += (particle.vx || 0) * (1 / 60);
      particle.y += (particle.vy || 0) * (1 / 60);
      ctx.fillStyle = particle.color;
      ctx.fillRect(Math.round(particle.x), Math.round(particle.y), particle.size || 3, particle.size || 3);
    }
  }
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (state.screenShake > 0) ctx.translate((Math.random() - 0.5) * state.screenShake, (Math.random() - 0.5) * state.screenShake);
  drawBackground();
  const drawables = state.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => ({ y: enemy.y, draw: () => {
    drawFighter(enemy.x, enemy.y, enemy.hitFlash > 0 ? '#ffffff' : enemy.color, false, enemy.size, state.player.x < enemy.x ? -1 : 1, enemy.hitFlash, (enemy.attackTimer ?? 9) < 0.35 ? 1 : 0, enemy.spriteAsset, Boolean(enemy.body?.velocity?.x || enemy.body?.velocity?.y), enemy.id);
    if (enemy.empowered) {
      ctx.globalAlpha = 0.4 + Math.sin(state.elapsed * 7) * 0.13;
      ctx.strokeStyle = enemy.id === 'dio-heaven' ? '#f0d75a' : '#e18dca';
      ctx.strokeRect(enemy.x - 20, enemy.y - 53, 40, 57);
      ctx.globalAlpha = 1;
    }
    if (enemy.stun > 0) {
      ctx.fillStyle = '#fff4a0';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', enemy.x, enemy.y - 54);
    }
    ctx.fillStyle = '#161a18';
    ctx.fillRect(enemy.x - 33, enemy.y - 57, 66, 5);
    ctx.fillStyle = enemy.empowered ? '#f0d75a' : '#e78465';
    ctx.fillRect(enemy.x - 32, enemy.y - 56, 64 * Math.max(0, enemy.hp / enemy.maxHp), 3);
    ctx.fillStyle = '#f0eee0';
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, enemy.x, enemy.y - 66);
  } }));
  drawables.push({ y: state.player.y, draw: () => {
    const character = selectedCharacter();
    if (character.part >= 3 && character.part <= 9) drawStand(state.player.x, state.player.y, character, state.player.facingX);
    if (character.id === 'jotaro' && state.jotaroAwakened && state.mode === 'final' && state.secretPhase === 2) {
      ctx.globalAlpha = 0.84;
      drawFighter(state.player.x + 24, state.player.y - 8, '#edc857', false, 0.88, state.player.facingX, 0, state.player.attackTimer);
      ctx.globalAlpha = 1;
    }
    drawFighter(state.player.x, state.player.y, state.player.hitFlash > 0 ? '#fff' : character.color, true, 1, state.player.facingX, state.player.hitFlash, state.player.attackTimer, character.spriteAsset, state.player.isMoving, character.id, state.player.attackAction);
    ctx.fillStyle = '#fff6cf';
    ctx.font = '9px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(character.short, state.player.x, state.player.y - 54);
  } });
  if (state.assist) {
    drawables.push({ y: state.player.y + 12, draw: () => {
    const fade = Math.min(1, state.assist.time / 0.35, (state.assist.maxTime - state.assist.time) / 0.2 + 1);
    ctx.globalAlpha = Math.max(0, fade);
    const allyAsset = state.assist.character.id === 'jotaro' ? state.assist.character.spriteAsset : allySprite(state.assist.character) || state.assist.character.spriteAsset;
    drawFighter(state.player.x - 43, state.player.y + 12, state.assist.character.id === 'jotaro' ? '#f0d75a' : state.assist.character.color, false, 0.92, 1, 0, 1, allyAsset);
    ctx.globalAlpha = 1;
    } });
  }
  drawables.sort((first, second) => first.y - second.y).forEach((item) => item.draw());
  drawEffects();
  if (state.mode === 'final' && state.secretPhase === 2) {
    const vignette = ctx.createRadialGradient(480, 270, 170, 480, 270, 570);
    vignette.addColorStop(0, '#e5d16e00');
    vignette.addColorStop(1, '#14172480');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}

function updateInterface(force = false) {
  const character = selectedCharacter();
  if (force) {
    $('#part-label').innerHTML = `PARTE ${character.part} <span>/</span> ${character.era}`;
    $('#fighter-name').textContent = character.name.toUpperCase();
    $('#form-name').textContent = isOverHeaven() ? 'STAR PLATINUM: OVER HEAVEN' : character.stand;
    const campaign = selectedCampaign();
    const progress = currentCampaignProgress();
    const stage = state.storyStage;
    $('#boss-label').textContent = state.mode === 'final'
      ? state.secretRunPhase?.startsWith('revenge') ? currentSecretCampaign()?.secretBoss || 'CHEFE DA REVANCHE' : 'DIO OVER HEAVEN · PUCCI'
      : stage?.enemies.map((enemy) => enemy.name).join(' · ') || (progress.phase === STORY_PHASES.CAMPAIGN_COMPLETE ? 'JORNADA CONCLUÍDA' : 'AGUARDANDO PRÓXIMA FASE');
    $('#fight-eyebrow').textContent = state.mode === 'final'
      ? state.secretRunPhase?.startsWith('revenge') ? `REVANCHE · PARTE ${campaigns.findIndex((entry) => entry.id === state.secretCampaignId) + 1} / ${campaigns.length}` : `MODO HISTÓRIA SECRETO · ${state.secretRunPhase === 'complete' ? 'CONCLUÍDO' : `FASE ${Math.max(1, state.secretPhase)}`}`
      : `CAMPANHA · PARTE ${campaign.part} · ${progress.phase.replaceAll('_', ' ')}`;
    if (state.mode === 'campaign') $('#fight-title').textContent = stage?.title || (campaign.openEnded ? 'A campanha continua' : `${campaign.protagonist} · campanha concluída`);
    else if (state.secretRunPhase?.startsWith('revenge')) $('#fight-title').textContent = state.storyStage?.title || 'Revanche';
    else if (state.secretRunPhase === 'final-intro') $('#fight-title').textContent = 'As nove Partes se reencontram';
    else if (state.secretRunPhase === 'complete') $('#fight-title').textContent = 'A ameaça terminou';
    document.querySelectorAll('.roster-entry').forEach((button, index) => button.classList.toggle('selected', index === state.selected));
    document.querySelectorAll('.mode-button').forEach((button) => button.classList.toggle('active', button.dataset.mode === state.mode));
    updateStoryPanel();
  }
  const healthPercent = Math.max(0, state.player.hp / state.player.maxHp * 100);
  $('#health-fill').style.width = `${healthPercent}%`;
  $('#health-label').textContent = `${Math.ceil(state.player.hp)} / ${state.player.maxHp}`;
  $('#energy-fill').style.width = `${state.player.energy / state.player.maxEnergy * 100}%`;
  $('#energy-label').textContent = `${Math.floor(state.player.energy)} / ${state.player.maxEnergy}`;

  $('#boss-bars').innerHTML = state.enemies.map((enemy) => `<div class="boss-bar-row"><span>${enemy.id === 'dio-heaven' ? 'DIO' : enemy.id === 'pucci-heaven' ? 'PUCCI' : 'BOSS'}</span><div class="meter"><div class="boss-fill" style="width:${Math.max(0, enemy.hp / enemy.maxHp * 100)}%"></div></div><b>${Math.ceil(enemy.hp)} / ${enemy.maxHp}</b></div>`).join('') || '<span style="color:#939c94;font-size:8px">AGUARDANDO TRANSFORMAÇÃO</span>';
  updatePowerRow();
  const assistButton = $('#assist-button');
  const assistEnabled = state.mode === 'final' && state.secretPhase === 2 && state.fightActive && !state.assist && state.assistCooldown <= 0;
  assistButton.disabled = !assistEnabled;
  $('#assist-timer').textContent = state.assist ? 'ALIADO NA ARENA' : state.assistCooldown > 0 ? `${Math.ceil(state.assistCooldown)} S` : state.mode === 'final' && state.secretPhase === 2 ? 'PRONTA' : 'FASE 2';
  document.querySelectorAll('.mode-button').forEach((button) => {
    if (button.dataset.mode === 'final') button.disabled = !save.story.secretUnlocked;
  });
  document.querySelectorAll('.roster-entry').forEach((button, index) => {
    const unlocked = hasCampaignAccess(characters[index].id);
    button.disabled = !unlocked;
    button.classList.toggle('locked', !unlocked);
  });
  $('#interact-button').hidden = !(state.mode === 'campaign' && state.storyStage && currentCampaignProgress().phase === STORY_PHASES.OBJECTIVE_ACTIVE);
}

// Atualiza os botões no lugar: recriá-los a cada quadro fazia cliques se perderem.
function updatePowerRow() {
  const powerRow = $('#power-row');
  const skills = availableSkills();
  const signature = skills.map((skill) => skill.id).join('|');
  if (powerRow.dataset.signature !== signature) {
    powerRow.dataset.signature = signature;
    powerRow.innerHTML = skills.map((skill, index) => `<button type="button" class="power-slot" data-slot="${index}"><span class="power-key">${index + 1}</span><strong>${skill.name}</strong><small></small></button>`).join('');
  }
  skills.forEach((skill, index) => {
    const button = powerRow.children[index];
    const unlocked = isUnlocked(skill);
    const cooldown = state.cooldowns[skill.id] || 0;
    const lockedText = skill.tier === 'advanced' ? 'LIBERA NA FASE 3' : skill.tier === 'supreme' ? 'LIBERA ANTES DO CHEFE FINAL' : skill.tier === 'awakening' ? 'STAR PLATINUM: OVER HEAVEN' : 'DISPONÍVEL';
    const status = cooldown > 0 ? `${cooldown.toFixed(1)} s · ${skill.energy} EN` : `${skill.range} P · ${skill.energy} EN`;
    button.classList.toggle('locked', !unlocked);
    button.disabled = !(unlocked && cooldown <= 0 && state.player.energy >= skill.energy && state.fightActive);
    button.title = `${skill.name} · ${unlocked ? `${skill.energy} energia, alcance ${skill.range}` : lockedText}`;
    const label = unlocked ? status : lockedText;
    const small = button.querySelector('small');
    if (small.textContent !== label) small.textContent = label;
  });
}

function handleKeyDown(event) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'f', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' ', 'j', '1', '2', '3', '4', 'enter'].includes(key)) event.preventDefault();
  const storyAction = $('#story-action');
  if (!event.repeat && (key === 'enter' || key === ' ') && !state.fightActive && !storyAction.hidden && !storyAction.disabled) {
    continueStory();
    return;
  }
  state.keys.add(key);
  if (!event.repeat && (key === 'j' || key === ' ')) performBasicAttack();
  if (!event.repeat && /^[1-4]$/.test(key)) useSkill(Number(key) - 1);
  if (!event.repeat && key === 'f') interactWithStoryObjective();
  if (!event.repeat && key === 'e') requestAssist();
}
function handleKeyUp(event) { state.keys.delete(event.key.toLowerCase()); }
const joystick = $('#touch-joystick');
const joystickKnob = $('#joystick-knob');
let joystickPointer = null;
function moveJoystick(event) {
  if (!joystick || joystickPointer !== event.pointerId) return;
  const bounds = joystick.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const maxRadius = bounds.width * 0.31;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;
  const distance = Math.hypot(dx, dy);
  const scale = distance > maxRadius ? maxRadius / distance : 1;
  const offsetX = dx * scale;
  const offsetY = dy * scale;
  state.touchAxis = distance < 8 ? { x: 0, y: 0 } : { x: offsetX / maxRadius, y: offsetY / maxRadius };
  joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}
function releaseJoystick(event) {
  if (event && joystickPointer !== event.pointerId) return;
  joystickPointer = null;
  state.touchAxis = { x: 0, y: 0 };
  if (joystick && joystickKnob) {
    joystick.classList.remove('active');
    joystickKnob.style.transform = 'translate(-50%, -50%)';
  }
}
joystick?.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  joystickPointer = event.pointerId;
  joystick.setPointerCapture(event.pointerId);
  joystick.classList.add('active');
  moveJoystick(event);
});
joystick?.addEventListener('pointermove', moveJoystick);
joystick?.addEventListener('pointerup', releaseJoystick);
joystick?.addEventListener('pointercancel', releaseJoystick);
joystick?.addEventListener('lostpointercapture', releaseJoystick);
const deviceControlQuery = window.matchMedia('(pointer: coarse), (max-width: 760px)');
function updateDeviceControls() {
  const touchMode = deviceControlQuery.matches || window.matchMedia('(pointer: coarse)').matches;
  document.body.dataset.controlMode = touchMode ? 'touch' : 'keyboard';
  $('#game').setAttribute('aria-label', touchMode
    ? 'Arena top-down. Use o joystick virtual para mover, toque em Atacar para golpear e nos poderes para usar habilidades.'
    : 'Arena de combate top-down. Use W A S D ou as setas para mover, J para atacar e 1 a 4 para usar poderes.');
}
updateDeviceControls();
deviceControlQuery.addEventListener('change', updateDeviceControls);
window.addEventListener('resize', updateDeviceControls, { passive: true });
window.addEventListener('blur', () => {
  state.keys.clear();
  releaseJoystick();
});
$('#power-row').addEventListener('click', (event) => {
  const button = event.target.closest('[data-slot]');
  if (button && !button.disabled) useSkill(Number(button.dataset.slot));
});
$('#attack-button').addEventListener('click', () => {
  $('#game').focus({ preventScroll: true });
  performBasicAttack();
});
$('#interact-button').addEventListener('click', interactWithStoryObjective);
$('#story-action').addEventListener('click', continueStory);
document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.mode)));
$('#assist-button').addEventListener('click', requestAssist);
$('#sound-button').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#sound-button').textContent = state.sound ? '♫' : '♪';
  $('#sound-button').setAttribute('aria-label', state.sound ? 'Desativar trilha e efeitos sonoros' : 'Ativar trilha e efeitos sonoros');
  $('#sound-button').title = state.sound ? 'Desativar trilha e efeitos sonoros' : 'Ativar trilha e efeitos sonoros';
  if (state.sound) { startTheme(); playTone(480); }
  else window.clearInterval(musicTimer);
});
$('#reset-button').addEventListener('click', () => {
  if (!window.confirm('Apagar todo o progresso salvo e voltar à primeira missão da Parte 1?')) return;
  save.advanced = [];
  save.supreme = [];
  save.victories = [];
  save.story = normalizeSave(null, campaigns).story;
  state.selected = 0;
  persistSave();
  resetBattle('campaign');
  showToast('Progresso reiniciado. Parte 1, primeira missão.');
});

class BattleScene extends Phaser.Scene {
  constructor() {
    super('battle');
  }

  create() {
    gameScene = this;
    this.physics.world.setBounds(18, 80, ARENA_WIDTH - 36, ARENA_HEIGHT - 98);
    preparedSprites.forEach((sprite, key) => this.textures.addCanvas(key, sprite));
    const drawingCanvas = document.createElement('canvas');
    drawingCanvas.width = ARENA_WIDTH;
    drawingCanvas.height = ARENA_HEIGHT;
    arenaTexture = this.textures.addCanvas('eternal-destiny-arena', drawingCanvas);
    ctx = arenaTexture.getContext();
    arenaSurface = this.add.image(0, 0, 'eternal-destiny-arena').setOrigin(0, 0);
    this.input.keyboard.on('keydown', handleKeyDown);
    this.input.keyboard.on('keyup', handleKeyUp);
    buildRoster();
    resetBattle('campaign');
    $('#battle-message').textContent = `${selectedCharacter().name} enfrenta ${selectedCharacter().boss}. Derrote o chefe para liberar um novo poder.`;
    this.renderInitialFrame();
    loadSpritesInBackground([
      selectedCharacter().spriteAsset,
      ...(state.storyStage?.enemies.map((enemy) => enemySpriteAsset(enemy, selectedCampaign())) || []),
    ]);
  }

  renderInitialFrame() {
    try {
      draw();
      arenaTexture.refresh();
    } catch (error) {
      this.reportRenderError(error);
    }
  }

  update(_time, delta) {
    try {
      const timestamp = performance.now();
      update(Math.min(0.034, Math.max(0, delta / 1000)), timestamp);
      draw();
      arenaTexture.refresh();
    } catch (error) {
      this.reportRenderError(error);
    }
  }

  reportRenderError(error) {
    console.error('Erro ao desenhar a arena Phaser.', error);
    $('#battle-message').textContent = `ERRO NO DESENHO DA ARENA · ${error.message || 'consulte o console'}`;
    this.scene.pause();
  }
}

const gameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  backgroundColor: '#28352b',
  pixelArt: true,
  roundPixels: true,
  render: { antialias: false },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: ARENA_WIDTH,
    height: ARENA_HEIGHT,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false, gravity: { x: 0, y: 0 } },
  },
  scene: [BattleScene],
};

function startGame() {
  new Phaser.Game(gameConfig);
}

try {
  startGame();
} catch (error) {
  console.error('Não foi possível iniciar a arena Phaser.', error);
  $('#battle-message').textContent = 'Não foi possível iniciar a arena. Atualize a página para tentar novamente.';
}
