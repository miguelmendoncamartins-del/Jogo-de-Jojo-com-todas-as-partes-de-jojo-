export const STORY_PHASES = Object.freeze({
  INTRO: 'INTRO',
  EXPLORATION: 'EXPLORATION',
  OBJECTIVE_ACTIVE: 'OBJECTIVE_ACTIVE',
  ENEMY_ENCOUNTER: 'ENEMY_ENCOUNTER',
  BOSS_FIGHT: 'BOSS_FIGHT',
  POST_BATTLE: 'POST_BATTLE',
  ENVIRONMENT_CHANGED: 'ENVIRONMENT_CHANGED',
  NEXT_STAGE_UNLOCKED: 'NEXT_STAGE_UNLOCKED',
  STAGE_COMPLETE: 'STAGE_COMPLETE',
  CAMPAIGN_COMPLETE: 'CAMPAIGN_COMPLETE',
});

const phaseTransitions = Object.freeze({
  INTRO: ['EXPLORATION', 'ENEMY_ENCOUNTER'],
  EXPLORATION: ['OBJECTIVE_ACTIVE'],
  OBJECTIVE_ACTIVE: ['ENEMY_ENCOUNTER'],
  ENEMY_ENCOUNTER: ['BOSS_FIGHT'],
  BOSS_FIGHT: ['POST_BATTLE'],
  POST_BATTLE: ['ENVIRONMENT_CHANGED'],
  ENVIRONMENT_CHANGED: ['NEXT_STAGE_UNLOCKED'],
  NEXT_STAGE_UNLOCKED: ['STAGE_COMPLETE'],
  STAGE_COMPLETE: ['INTRO', 'CAMPAIGN_COMPLETE'],
});

export const SAVE_DEFAULT = Object.freeze({
  advanced: [],
  supreme: [],
  victories: [],
  story: {
    unlockedCampaignIds: ['jonathan'],
    secretUnlocked: false,
    secretStageIndex: 0,
    secretDefeatedCampaignIds: [],
    secretFinalAvailable: false,
    secretFinalPhase: 0,
    secretFinalComplete: false,
    campaigns: {},
  },
});

function createCampaignProgress() {
  return {
    stageIndex: 0,
    phase: STORY_PHASES.INTRO,
    completedStageIds: [],
    defeatedEnemyIds: [],
    completedObjectiveIds: [],
    seenDialogueIds: [],
    unlockedPathIds: [],
    processedEventIds: [],
    flags: {},
  };
}

function uniqueStrings(value) {
  return Array.isArray(value) ? [...new Set(value.filter((item) => typeof item === 'string'))] : [];
}

export function normalizeSave(raw, campaigns) {
  const saved = raw && typeof raw === 'object' ? raw : {};
  const previousStory = saved.story && typeof saved.story === 'object' ? saved.story : {};
  const progressByCampaign = {};
  const campaignIds = new Set(campaigns.map((campaign) => campaign.id));

  for (const campaign of campaigns) {
    const previous = previousStory.campaigns?.[campaign.id] || {};
    const completedStageIds = uniqueStrings(previous.completedStageIds).filter((stageId) => campaign.stages.some((stage) => stage.id === stageId));
    const stageIndex = Math.max(0, Math.min(Number.isInteger(previous.stageIndex) ? previous.stageIndex : completedStageIds.length, campaign.stages.length));
    const phases = Object.values(STORY_PHASES);
    const phase = phases.includes(previous.phase) ? previous.phase : (stageIndex >= campaign.stages.length ? STORY_PHASES.CAMPAIGN_COMPLETE : STORY_PHASES.INTRO);
    progressByCampaign[campaign.id] = {
      ...createCampaignProgress(),
      ...previous,
      stageIndex,
      phase,
      completedStageIds,
      defeatedEnemyIds: uniqueStrings(previous.defeatedEnemyIds),
      completedObjectiveIds: uniqueStrings(previous.completedObjectiveIds),
      seenDialogueIds: uniqueStrings(previous.seenDialogueIds),
      unlockedPathIds: uniqueStrings(previous.unlockedPathIds),
      processedEventIds: uniqueStrings(previous.processedEventIds),
      flags: previous.flags && typeof previous.flags === 'object' ? previous.flags : {},
    };
  }

  const unlockedCampaignIds = uniqueStrings(previousStory.unlockedCampaignIds);
  if (!unlockedCampaignIds.includes('jonathan')) unlockedCampaignIds.unshift('jonathan');
  const unlocked = unlockedCampaignIds.filter((id) => campaigns.some((campaign) => campaign.id === id));

  return {
    advanced: uniqueStrings(saved.advanced).filter((id) => campaignIds.has(id)),
    supreme: uniqueStrings(saved.supreme).filter((id) => campaignIds.has(id)),
    victories: uniqueStrings(saved.victories).filter((id) => campaignIds.has(id)),
    story: {
      unlockedCampaignIds: unlocked,
      secretUnlocked: previousStory.secretUnlocked === true,
      secretStageIndex: Math.max(0, Math.min(Number.isInteger(previousStory.secretStageIndex) ? previousStory.secretStageIndex : 0, campaigns.length)),
      secretDefeatedCampaignIds: uniqueStrings(previousStory.secretDefeatedCampaignIds).filter((id) => campaigns.some((campaign) => campaign.id === id)),
      secretFinalAvailable: previousStory.secretFinalAvailable === true || (Number.isInteger(previousStory.secretStageIndex) && previousStory.secretStageIndex >= campaigns.length),
      secretFinalPhase: Math.max(0, Math.min(Number.isInteger(previousStory.secretFinalPhase) ? previousStory.secretFinalPhase : 0, 2)),
      secretFinalComplete: previousStory.secretFinalComplete === true,
      campaigns: progressByCampaign,
    },
  };
}

export function transitionPhase(progress, nextPhase, eventId) {
  if (!progress || !phaseTransitions[progress.phase]?.includes(nextPhase)) return false;
  if (progress.processedEventIds.includes(eventId)) return false;
  progress.phase = nextPhase;
  progress.processedEventIds.push(eventId);
  return true;
}

export function recordDialogue(progress, dialogueId) {
  if (!progress || progress.seenDialogueIds.includes(dialogueId)) return false;
  progress.seenDialogueIds.push(dialogueId);
  return true;
}

export function recordObjective(progress, objectiveId) {
  if (!progress || progress.phase !== STORY_PHASES.OBJECTIVE_ACTIVE || progress.completedObjectiveIds.includes(objectiveId)) return false;
  progress.completedObjectiveIds.push(objectiveId);
  return true;
}

export function recordBattleVictory(progress, stage, enemyIds) {
  if (!progress || progress.phase !== STORY_PHASES.BOSS_FIGHT || !Array.isArray(enemyIds)) return false;
  const defeatedIds = new Set(enemyIds);
  if (!stage.enemies.every((enemy) => defeatedIds.has(enemy.id))) return false;
  if (stage.enemies.every((enemy) => progress.defeatedEnemyIds.includes(enemy.id))) return false;
  stage.enemies.forEach((enemy) => {
    if (!progress.defeatedEnemyIds.includes(enemy.id)) progress.defeatedEnemyIds.push(enemy.id);
  });
  return transitionPhase(progress, STORY_PHASES.POST_BATTLE, `victory:${stage.id}:${stage.enemies.map((enemy) => enemy.id).join(',')}`);
}

export function recordEnvironmentChange(progress, stage) {
  if (!transitionPhase(progress, STORY_PHASES.NEXT_STAGE_UNLOCKED, `environment:${stage.id}`)) return false;
  if (!progress.unlockedPathIds.includes(stage.pathId)) progress.unlockedPathIds.push(stage.pathId);
  return true;
}

export function completeStage(progress, campaign) {
  if (!progress || progress.phase !== STORY_PHASES.STAGE_COMPLETE) return false;
  const stage = campaign.stages[progress.stageIndex];
  if (!stage || progress.completedStageIds.includes(stage.id)) return false;
  progress.completedStageIds.push(stage.id);
  progress.stageIndex += 1;

  if (progress.stageIndex < campaign.stages.length) {
    progress.phase = STORY_PHASES.INTRO;
    return true;
  }

  progress.phase = STORY_PHASES.CAMPAIGN_COMPLETE;
  return true;
}

export function finishStage(progress, stage) {
  if (!progress || progress.phase !== STORY_PHASES.NEXT_STAGE_UNLOCKED) return false;
  if (!transitionPhase(progress, STORY_PHASES.STAGE_COMPLETE, `complete:${stage.id}`)) return false;
  return true;
}

export function unlockCampaignAfterCompletion(save, campaign, campaigns) {
  const campaignProgress = save.story.campaigns[campaign.id];
  if (campaignProgress.phase !== STORY_PHASES.CAMPAIGN_COMPLETE) return false;
  const campaignIndex = campaigns.findIndex((entry) => entry.id === campaign.id);
  const nextCampaign = campaigns[campaignIndex + 1];
  if (nextCampaign && !save.story.unlockedCampaignIds.includes(nextCampaign.id)) save.story.unlockedCampaignIds.push(nextCampaign.id);
  const allComplete = campaigns.every((entry) => save.story.campaigns[entry.id].phase === STORY_PHASES.CAMPAIGN_COMPLETE);
  if (allComplete) save.story.secretUnlocked = true;
  return true;
}

export function createSecretEncounter(campaign, boss) {
  const multiplier = 1.5;
  return {
    ...boss,
    id: `secret-boss-${campaign.id}`,
    hp: Math.round(boss.hp * multiplier),
    maxHp: Math.round(boss.hp * multiplier),
    attackDamage: Math.round((boss.attackDamage || 8) * multiplier),
    attackRange: boss.attackRange || 94,
    attackInterval: boss.attackInterval || 1.22,
    empowered: true,
    pattern: boss.pattern || 'heavy',
  };
}

export function recordSecretBossVictory(save, campaign, enemyId, campaigns) {
  if (!save.story.secretUnlocked || save.story.secretStageIndex >= campaigns.length) return false;
  const expectedCampaign = campaigns[save.story.secretStageIndex];
  if (!expectedCampaign || campaign.id !== expectedCampaign.id || enemyId !== `secret-boss-${campaign.id}`) return false;
  if (save.story.secretDefeatedCampaignIds.includes(campaign.id)) return false;
  save.story.secretDefeatedCampaignIds.push(campaign.id);
  save.story.secretStageIndex += 1;
  if (save.story.secretStageIndex >= campaigns.length) save.story.secretFinalAvailable = true;
  return true;
}
