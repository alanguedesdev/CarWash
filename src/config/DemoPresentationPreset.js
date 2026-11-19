/**
 * Preset reversível para apresentações do CarWash.
 * Desligue DEMO_PRESENTATION_MODE e publique para restaurar o save original.
 * O backup preserva o valor anterior da chave principal sem alterar seu formato.
 */
export const DEMO_PRESENTATION_MODE = true;

const CAREER_STORAGE_KEY = "carwash-business-progress-v1";
const BACKUP_STORAGE_KEY = "carwash-demo-original-save-v1";
const SESSION_STORAGE_KEY = "carwash-demo-session-v1";

const DEMO_CAREER = Object.freeze({
  balance: 500,
  // CareerSystem calcula XP como completedJobs * 80: 2 serviços = 160 XP.
  completedJobs: 2,
  reputation: 5,
  purchasedUpgrades: [],
});

export function prepareDemoCareer() {
  try {
    if (!DEMO_PRESENTATION_MODE) {
      const backup = localStorage.getItem(BACKUP_STORAGE_KEY);
      if (backup !== null) {
        const parsed = JSON.parse(backup);
        if (parsed.original === null) localStorage.removeItem(CAREER_STORAGE_KEY);
        else localStorage.setItem(CAREER_STORAGE_KEY, parsed.original);
        localStorage.removeItem(BACKUP_STORAGE_KEY);
      }
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    if (localStorage.getItem(BACKUP_STORAGE_KEY) === null) {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        original: localStorage.getItem(CAREER_STORAGE_KEY),
      }));
    }

    // Inicializa uma única vez: compras e progresso de demo sobrevivem a refresh.
    if (localStorage.getItem(SESSION_STORAGE_KEY) !== "active") {
      localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(DEMO_CAREER));
      localStorage.setItem(SESSION_STORAGE_KEY, "active");
    }
  } catch (error) {
    console.warn("[CarWash Demo] Não foi possível preparar o save de demonstração:", error);
  }
}

function pickSpread(items, amount) {
  if (amount <= 0 || items.length === 0) return [];
  const sorted = [...items].sort((a, b) =>
    a.position.x - b.position.x || a.position.z - b.position.z
  );
  if (amount >= sorted.length) return sorted;
  if (amount === 1) return [sorted[Math.floor((sorted.length - 1) / 2)]];
  return Array.from({ length: amount }, (_, index) =>
    sorted[Math.round(index * (sorted.length - 1) / (amount - 1))]
  );
}

/**
 * Pré-limpa 80% dos pontos e mantém ~20% em superfícies externas mais altas.
 * A aparência usa a mesma sequência de canais do material procedural existente.
 */
export function applyDemoWashPreset(surfaceEffects) {
  if (!DEMO_PRESENTATION_MODE || !surfaceEffects?.dirtMarks?.length) return false;

  const marks = surfaceEffects.dirtMarks;
  const bounds = surfaceEffects.modelBounds;
  const height = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const yRatio = (mark) => (mark.position.y - bounds.min.y) / height;

  const eligible = marks.filter((mark) => {
    const outward = Math.max(Math.abs(mark.normal.x), Math.abs(mark.normal.y), Math.abs(mark.normal.z));
    return yRatio(mark) >= 0.28 && outward >= 0.58;
  });
  const targetRemaining = Math.max(1, Math.round(marks.length * 0.2));
  const side = eligible.filter((mark) =>
    Math.abs(mark.normal.z) >= 0.58 && yRatio(mark) >= 0.28 && yRatio(mark) <= 0.78
  );
  const upper = eligible.filter((mark) =>
    Math.abs(mark.normal.y) >= 0.58 && yRatio(mark) >= 0.42
  );
  const frontGlass = eligible.filter((mark) =>
    Math.abs(mark.normal.x) >= 0.58 && yRatio(mark) >= 0.38
  );

  const selected = [];
  const addUnique = (items) => {
    for (const mark of items) {
      if (selected.length >= targetRemaining) break;
      if (!selected.includes(mark)) selected.push(mark);
    }
  };

  addUnique(pickSpread(side, Math.round(targetRemaining * 0.55)));
  addUnique(pickSpread(upper, Math.round(targetRemaining * 0.3)));
  addUnique(pickSpread(frontGlass, targetRemaining - selected.length));
  addUnique(pickSpread(eligible, targetRemaining - selected.length));

  if (selected.length < targetRemaining) {
    addUnique(pickSpread([...marks].sort((a, b) => yRatio(b) - yRatio(a)), targetRemaining - selected.length));
  }

  const remaining = new Set(selected);
  let cleaned = 0;

  for (const mark of marks) {
    mark.wet = false;
    mark.soapy = false;
    mark.scrubbed = false;
    mark.removed = !remaining.has(mark);

    if (mark.removed) {
      const shader = surfaceEffects.materials.get(mark.mesh.uuid);
      if (shader) {
        shader.paint(mark.position, 0.68, "water", 0, mark.normal);
        shader.paint(mark.position, 0.68, "soap", 0, mark.normal);
        shader.paint(mark.position, 0.68, "sponge", 0, mark.normal);
        shader.paint(mark.position, 0.68, "water", 0, mark.normal);
      }
      mark.scrubbed = true;
      cleaned++;
    }
  }

  for (const shader of surfaceEffects.materials.values()) shader.flush();
  surfaceEffects.cleanedDirt = cleaned;
  surfaceEffects.onProgress(surfaceEffects.getProgress());
  surfaceEffects.onMessage("Modo demonstração: veículo preparado com aproximadamente 80% da limpeza concluída.");
  console.info(`[CarWash Demo] Preset aplicado: ${cleaned}/${marks.length} pontos concluídos; ${remaining.size} manchas restantes.`);
  return true;
}
