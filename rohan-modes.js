const STORAGE_KEY = 'eternal-destiny-rohan-modes-v1';

export const ROHAN_MODES = Object.freeze([
  { id: 'story', title: 'Modo História', description: 'Campanhas das nove partes e progressão original.', status: 'Disponível' },
  { id: 'arcade', title: 'Modo Arcade', description: 'Arcade: treinamentos, ranqueadas, torneios e desafios rápidos.', status: 'Menu local' },
  { id: 'versus', title: 'Modo Versus', description: 'Confronto local com lutadores desbloqueados pelas campanhas.', status: 'Disponível' },
  { id: 'online', title: 'Modo Online', description: 'Versus, ranqueadas e torneios preparados para servidor.', status: 'Servidor necessário' },
  { id: 'ranked', title: 'Modo Ranqueado', description: 'Pontuação local preparada para pareamento competitivo.', status: 'Local' },
  { id: 'tournament', title: 'Modo Torneio', description: 'Chave eliminatória local com até 16 participantes.', status: 'Local' },
  { id: 'party', title: 'Party Game', description: 'Desafios rápidos de reação e observação.', status: 'Disponível' },
  { id: 'beat-em-up', title: "Beat 'em Up", description: 'Ondas de inimigos e chefes em arenas locais.', status: 'Local' },
  { id: 'stealth', title: 'Modo Furtividade', description: 'Objetivos secretos e áreas de detecção.', status: 'Em desenvolvimento' },
  { id: 'tower-defense', title: 'Tower Defense', description: 'Defesa por ondas com habilidades dos aliados.', status: 'Em desenvolvimento' },
  { id: 'race', title: 'Corridas', description: 'Percursos inspirados na Steel Ball Run.', status: 'Em desenvolvimento' },
  { id: 'challenges', title: 'Desafios Multiplayer', description: 'Missões cooperativas ou competitivas.', status: 'Servidor necessário' },
  { id: 'training', title: 'Estúdio do Rohan', description: 'Treino de ataques, hitboxes, IA e gravação local.', status: 'Disponível' },
  { id: 'chronicles', title: 'Crônicas do Rohan', description: 'Histórico local, perfil e temporadas do jogador.', status: 'Local' },
]);

const defaultProfile = () => ({
  playerName: 'Jogador Local',
  score: 1000,
  wins: 0,
  losses: 0,
  defeatedRohan: false,
  rohanUnlocked: false,
  mostUsed: {},
  history: [],
  season: 'Temporada 1',
  seasonStartedAt: new Date().toISOString(),
});

export function loadRohanProfile(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(STORAGE_KEY));
    if (!raw || typeof raw !== 'object') return defaultProfile();
    return {
      ...defaultProfile(),
      ...raw,
      mostUsed: raw.mostUsed && typeof raw.mostUsed === 'object' ? raw.mostUsed : {},
      history: Array.isArray(raw.history) ? raw.history.slice(-100) : [],
    };
  } catch {
    return defaultProfile();
  }
}

export function saveRohanProfile(profile, storage = globalThis.localStorage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Persistent data is optional; gameplay remains available.
  }
}

export function recordRohanMatch(profile, result, mode = 'versus', opponent = 'ROHAN') {
  const won = result === 'win';
  profile.wins += won ? 1 : 0;
  profile.losses += won ? 0 : 1;
  profile.score = Math.max(0, profile.score + (won ? 25 : -15));
  if (opponent === 'ROHAN' && won) {
    profile.defeatedRohan = true;
    profile.rohanUnlocked = true;
  }
  profile.history.unshift({
    at: new Date().toISOString(),
    result: won ? 'VITÓRIA' : 'DERROTA',
    mode,
    opponent,
  });
  profile.history = profile.history.slice(0, 100);
  return profile;
}

export function getRohanWinRate(profile) {
  const total = profile.wins + profile.losses;
  return total === 0 ? 0 : Math.round((profile.wins / total) * 100);
}
