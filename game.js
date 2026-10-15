import Phaser from 'phaser';
import { campaigns, getCampaignForCharacter } from './campaigns.js';
import { allySprite, characterSprite, loadSpriteImages, resolveSpriteAsset } from './sprite-assets.js';
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
  player: { x: 380, y: 320, facingX: 1, facingY: 0, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attackTimer: 0, hitFlash: 0, statuses: { freeze: 0, slow: 0, confuse: 0, burn: 0, burnTick: 0 }, physicsZone: null, body: null },
  enemies: [],
  cooldowns: {},
  effects: [],
  particles: [],
  keys: new Set(),
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
let toastTimeout;
let unlockTimeout;

function selectedCharacter() { return characters[state.selected]; }
function selectedCampaign() { return getCampaignForCharacter(selectedCharacter().id); }
function currentCampaignProgress(characterId = selectedCharacter().id) { return save.story.campaigns[characterId]; }
function currentCampaignStage(characterId = selectedCharacter().id) {
  const campaign = getCampaignForCharacter(characterId);
  const progress = currentCampaignProgress(characterId);
  return campaign && progress ? campaign.stages[progress.stageIndex] || null : null;
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
      text = `A derrota anterior nao conteve ${campaign.secretBoss}. O chefe retornou com 50% a mais em seus atributos e percebeu a falha do primeiro encontro.`;
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
    return;
  }
  if (state.mode !== 'campaign') {
    if (panel) panel.hidden = true;
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
        text = `Observe ${stage.location.toLowerCase()} antes do confronto. A investigação prepara a pista que será usada nesta fase.`;
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
}
function createFinalBosses(secondPhase = false) {
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
  state.mode = mode;
  state.secretPhase = 0;
  state.secretRunPhase = null;
  state.secretCampaignId = null;
  state.jotaroAwakened = false;
  state.player = { x: 380, y: 320, facingX: 1, facingY: 0, hp: 100, maxHp: 100, energy: 100, maxEnergy: 100, attackTimer: 0, hitFlash: 0, statuses: { freeze: 0, slow: 0, confuse: 0, burn: 0, burnTick: 0 }, physicsZone: null, body: null };
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

function performBasicAttack() {
  if (!state.fightActive || performance.now() < state.cinematicUntil || state.attackCooldown > 0) return;
  state.attackCooldown = 0.42;
  state.player.attackTimer = 0.28;
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
  state.cooldowns[skill.id] = skill.cooldown / 1000;
  state.player.attackTimer = skill.duration;
  state.screenShake = skill.tier === 'supreme' || skill.tier === 'awakening' ? 7 : 3;
  activateSkill(skill);
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
      if (['interrupt', 'time-stop', 'overwrite', 'final-impact', 'dimensional-pierce'].includes(skill.effect)) enemy.stun = Math.max(enemy.stun, skill.effect === 'time-stop' ? Math.min(skill.duration, 2.5) : 1.4);
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
    let moveX = Number(state.keys.has('d') || state.keys.has('arrowright')) - Number(state.keys.has('a') || state.keys.has('arrowleft'));
    let moveY = Number(state.keys.has('s') || state.keys.has('arrowdown')) - Number(state.keys.has('w') || state.keys.has('arrowup'));
    if (player.statuses.freeze > 0) moveX = moveY = 0;
    if (player.statuses.confuse > 0) { moveX *= -1; moveY *= -1; }
    const magnitude = Math.hypot(moveX, moveY) || 1;
    moveX /= magnitude;
    moveY /= magnitude;
    if (player.body) {
      player.body.setVelocity(moveX * 190 * (player.statuses.slow > 0 ? 0.55 : 1), moveY * 155 * (player.statuses.slow > 0 ? 0.55 : 1));
    } else if (moveX || moveY) {
      const speedScale = player.statuses.slow > 0 ? 0.55 : 1;
      player.x += moveX * 190 * speedScale * dt;
      player.y += moveY * 155 * speedScale * dt;
    }
    if (moveX || moveY) {
      player.facingX = moveX;
      player.facingY = moveY;
    }
    if (state.fightActive) for (const enemy of state.enemies) updateEnemy(enemy, dt);
  } else {
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
        if (profile.status === 'freeze') statuses.freeze = Math.max(statuses.freeze, enemy.power === 'time-stop' ? 0.62 : 0.35);
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

function drawBackground() {
  const revengeMap = state.mode === 'final' && state.secretRunPhase?.startsWith('revenge');
  const theme = state.mode === 'campaign' || revengeMap ? state.storyStage?.palette : null;
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, theme?.wall || (state.mode === 'final' ? '#282b34' : '#3c4a3d'));
  gradient.addColorStop(0.52, theme?.ground || (state.mode === 'final' ? '#36343a' : '#53604a'));
  gradient.addColorStop(1, theme?.floor || (state.mode === 'final' ? '#26333a' : '#324437'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = theme?.wall || (state.mode === 'final' ? '#22272c' : '#333f35');
  ctx.fillRect(0, 32, canvas.width, 104);
  for (let building = 0; building < 13; building += 1) {
    const x = building * 78 - 12;
    const height = 38 + ((building * 37) % 55);
    ctx.fillStyle = building % 2 ? (theme?.ground || '#626457') : (theme?.wall || '#515c50');
    ctx.fillRect(x, 135 - height, 65, height);
    ctx.fillStyle = '#333c37';
    ctx.fillRect(x + 3, 135 - height, 58, 4);
    for (let window = 0; window < 4; window += 1) {
      ctx.fillStyle = state.mode === 'final' ? '#c5a95744' : `${theme?.accent || '#ddcf92'}80`;
      ctx.fillRect(x + 9 + (window % 2) * 27, 145 - height + Math.floor(window / 2) * 19, 8, 10);
    }
  }
  ctx.fillStyle = state.mode === 'final' ? '#44454a' : '#766f5c';
  ctx.fillRect(0, 135, canvas.width, 8);
  ctx.fillStyle = '#30392f';
  ctx.fillRect(0, 143, canvas.width, 10);
  ctx.fillStyle = state.mode === 'final' ? '#40464a' : '#5c604d';
  ctx.fillRect(0, 350, canvas.width, 7);
  ctx.fillStyle = '#313c35';
  ctx.fillRect(0, 357, canvas.width, 5);

  const groundGradient = ctx.createLinearGradient(0, 150, 0, canvas.height);
  groundGradient.addColorStop(0, theme?.ground || (state.mode === 'final' ? '#3a403a' : '#60604d'));
  groundGradient.addColorStop(1, theme?.floor || (state.mode === 'final' ? '#2b3736' : '#3d5043'));
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, 153, canvas.width, canvas.height - 153);
  for (let y = 174; y < 540; y += 38) {
    const inset = Math.max(0, y - 174) * 0.055;
    ctx.strokeStyle = y % 3 ? '#d3ccaa0c' : '#e1d9bf12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset, y);
    ctx.lineTo(canvas.width - inset, y);
    ctx.stroke();
  }
  for (let x = 82; x < canvas.width; x += 124) {
    ctx.fillStyle = '#ddd8c10e';
    ctx.fillRect(x, 169, 1, 340);
  }
  drawPlanter(120, 202);
  drawPlanter(838, 191);
  drawPlanter(872, 404);
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

  ctx.fillStyle = theme?.accent || '#a79b68';
  ctx.globalAlpha = 0.8;
  if (stage.id.includes('train') || stage.id.includes('hamon')) {
    ctx.fillRect(456, 268, 8, 55);
    ctx.fillRect(426, 281, 68, 5);
    ctx.fillRect(429, 304, 63, 5);
  } else if (stage.id.includes('race') || stage.id.includes('rotation')) {
    for (let post = 0; post < 5; post += 1) ctx.fillRect(427 + post * 27, 260, 4, 59);
    ctx.fillRect(427, 271, 112, 4);
  } else if (stage.id.includes('prison') || stage.id.includes('gwess') || stage.id.includes('johngalli')) {
    for (let bar = 0; bar < 7; bar += 1) ctx.fillRect(434 + bar * 13, 255, 3, 68);
  } else if (stage.id.includes('train') || stage.id.includes('trem')) {
    ctx.fillRect(432, 251, 119, 11);
    ctx.fillRect(432, 317, 119, 11);
    for (let window = 0; window < 4; window += 1) ctx.fillRect(443 + window * 27, 276, 17, 20);
  } else if (stage.id.includes('estate') || stage.id.includes('property') || stage.id.includes('diamond')) {
    ctx.fillRect(429, 307, 58, 12);
    ctx.fillRect(433, 278, 50, 12);
    ctx.fillStyle = '#d4bf85';
    ctx.fillRect(450, 269, 18, 38);
  } else if (stage.id.includes('dune') || stage.id.includes('desert') || stage.id.includes('hualalai')) {
    ctx.fillRect(414, 303, 58, 12);
    ctx.fillRect(476, 290, 64, 15);
  } else {
    ctx.fillRect(420, 302, 45, 13);
    ctx.fillRect(466, 290, 48, 13);
    ctx.fillRect(515, 277, 42, 13);
  }
  ctx.globalAlpha = 1;

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

function drawFighter(x, y, color, isPlayer, scale = 1, facingX = 1, hitFlash = 0, animation = 0, spriteAsset = null) {
  const spriteScale = 1.8 * scale;
  const bob = animation ? Math.sin(state.elapsed * 26) * 2 : Math.sin(state.elapsed * 4 + x) * 0.6;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  ctx.scale(facingX < 0 ? -1 : 1, 1);
  ctx.imageSmoothingEnabled = false;
  const sprite = getPreparedSprite(spriteAsset);
  if (sprite) {
    const ratio = sprite.width / sprite.height;
    const targetHeight = 104 * scale;
    const targetWidth = Math.min(targetHeight * ratio, 78 * scale);
    const drawnHeight = Math.min(targetHeight, targetWidth / ratio);
    const scalePulse = animation ? 1 + Math.sin(state.elapsed * 34) * 0.025 : 1;
    ctx.fillStyle = '#10151288';
    ctx.beginPath();
    ctx.ellipse(0, 9 * spriteScale, 13 * spriteScale, 4 * spriteScale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(sprite, -targetWidth * scalePulse / 2, -drawnHeight * scalePulse + 8, targetWidth * scalePulse, drawnHeight * scalePulse);
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
  ctx.fillRect(-8 * spriteScale, 5 * spriteScale, 6 * spriteScale, 7 * spriteScale);
  ctx.fillRect(2 * spriteScale, 5 * spriteScale, 6 * spriteScale, 7 * spriteScale);
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
  const armOffset = animation ? Math.sin(state.elapsed * 40) * 3 : 0;
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
    drawFighter(enemy.x, enemy.y, enemy.hitFlash > 0 ? '#ffffff' : enemy.color, false, enemy.size, state.player.x < enemy.x ? -1 : 1, enemy.hitFlash, 0, enemy.spriteAsset);
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
    if (character.id === 'jotaro' && state.jotaroAwakened && state.mode === 'final' && state.secretPhase === 2) {
      ctx.globalAlpha = 0.84;
      drawFighter(state.player.x + 24, state.player.y - 8, '#edc857', false, 0.88, state.player.facingX, 0, state.player.attackTimer);
      ctx.globalAlpha = 1;
    }
    drawFighter(state.player.x, state.player.y, state.player.hitFlash > 0 ? '#fff' : character.color, true, 1, state.player.facingX, state.player.hitFlash, state.player.attackTimer, character.spriteAsset);
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
window.addEventListener('blur', () => state.keys.clear());
$('#power-row').addEventListener('click', (event) => {
  const button = event.target.closest('[data-slot]');
  if (button && !button.disabled) useSkill(Number(button.dataset.slot));
});
$('#story-action').addEventListener('click', continueStory);
document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.mode)));
$('#assist-button').addEventListener('click', requestAssist);
$('#sound-button').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#sound-button').textContent = state.sound ? '♫' : '♪';
  $('#sound-button').setAttribute('aria-label', state.sound ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros');
  if (state.sound) playTone(480);
});
$('#reset-button').addEventListener('click', () => {
  if (!window.confirm('Apagar todos os poderes desbloqueados deste navegador?')) return;
  save.advanced = [];
  save.supreme = [];
  save.victories = [];
  save.story = normalizeSave(null, campaigns).story;
  state.selected = 0;
  persistSave();
  resetBattle('campaign');
  showToast('Progresso reiniciado.');
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
