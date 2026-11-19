/**
 * Preset reversível para apresentações do CarWash.
 * Desligue DEMO_PRESENTATION_MODE e publique para restaurar o save original.
 * Com o modo ativo, cada carregamento reinicia o estado da carreira de demo.
 */
export const DEMO_PRESENTATION_MODE = true;

const CAREER_STORAGE_KEY = "carwash-business-progress-v1";
const BACKUP_STORAGE_KEY = "carwash-demo-original-save-v1";
const DEMO_CAREER = Object.freeze({
  balance: 500,
  completedJobs: 2, // CareerSystem converte cada serviço em 80 XP.
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
      return;
    }

    if (localStorage.getItem(BACKUP_STORAGE_KEY) === null) {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        original: localStorage.getItem(CAREER_STORAGE_KEY),
      }));
    }
    // Sempre reinicia antes do CareerSystem carregar o estado.
    localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(DEMO_CAREER));
  } catch (error) {
    console.warn("[CarWash Demo] Não foi possível preparar o save de demonstração:", error);
  }
}

function project(point, axis, min, size) {
  const axes = [{ u: "y", v: "z" }, { u: "x", v: "z" }, { u: "x", v: "y" }];
  const { u, v } = axes[axis];
  return {
    u: Math.max(0, Math.min(1, (point[u] - min[u]) / Math.max(size[u], 0.0001))),
    v: Math.max(0, Math.min(1, (point[v] - min[v]) / Math.max(size[v], 0.0001))),
  };
}

function chooseSingleCluster(marks, amount) {
  const groups = new Map();
  for (const mark of marks) {
    if (!groups.has(mark.mesh)) groups.set(mark.mesh, []);
    groups.get(mark.mesh).push(mark);
  }

  let best = null;
  let bestScore = Infinity;
  for (const group of groups.values()) {
    const side = group.filter((mark) => Math.abs(mark.normal.z) >= 0.42);
    const candidates = side.length >= amount ? side : group;
    if (candidates.length < amount) continue;

    for (const center of candidates) {
      const nearest = candidates
        .map((mark) => ({ mark, distance: mark.position.distanceTo(center.position) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, amount);
      const score = nearest.reduce((sum, item) => sum + item.distance ** 2, 0);
      if (score < bestScore) {
        bestScore = score;
        best = nearest.map((item) => item.mark);
      }
    }
  }

  if (best) return best;
  const group = [...groups.values()].sort((a, b) => b.length - a.length)[0] || [];
  const center = group[0];
  return center ? [...group].sort((a, b) =>
    a.position.distanceToSquared(center.position) - b.position.distanceToSquared(center.position)
  ).slice(0, amount) : [];
}

function setTextureClean(shader, clean, patch) {
  shader.textures.forEach((texture, axis) => {
    const data = texture.image.data;
    // Canal R: 255 oculta a sujeira procedural; 0 mantém a sujeira visível.
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = clean ? 255 : 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }

    if (patch && !clean) {
      const center = project(patch.center, axis, shader.boundsMin, shader.boundsSize);
      const axes = [{ u: 1, v: 2 }, { u: 0, v: 2 }, { u: 0, v: 1 }][axis];
      const rx = Math.max(2, Math.ceil(Math.min(0.48, patch.radius / Math.max(shader.boundsSize.getComponent(axes.u), 0.001)) * 256));
      const ry = Math.max(2, Math.ceil(Math.min(0.48, patch.radius / Math.max(shader.boundsSize.getComponent(axes.v), 0.001)) * 256));
      const cx = Math.round(center.u * 255), cy = Math.round(center.v * 255);
      for (let y = Math.max(0, cy - ry); y <= Math.min(255, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(255, cx + rx); x++) {
          if (Math.hypot((x - cx) / rx, (y - cy) / ry) <= 1) {
            data[(y * 256 + x) * 4] = 0;
          }
        }
      }
    }
    texture.needsUpdate = true;
  });
  shader.foamPixels = 0;
  shader.fadeIndices.clear();
  shader.dirtyTextures.clear();
}

/**
 * Deixa 80% dos pontos concluídos e concentra os 20% restantes em uma única
 * área da mesma malha. A limpeza continua usando SurfaceEffects.applyTool().
 */
export function applyDemoWashPreset(surfaceEffects) {
  if (!DEMO_PRESENTATION_MODE || !surfaceEffects?.dirtMarks?.length) return false;

  const marks = surfaceEffects.dirtMarks;
  const remainingCount = Math.max(1, Math.round(marks.length * 0.2));
  const remainingMarks = chooseSingleCluster(marks, remainingCount);
  if (!remainingMarks.length) return false;

  const remaining = new Set(remainingMarks);
  const center = remainingMarks.reduce(
    (sum, mark) => sum.add(mark.position),
    remainingMarks[0].position.clone()
  ).multiplyScalar(1 / remainingMarks.length);
  const radius = Math.max(0.3, ...remainingMarks.map(
    (mark) => mark.position.distanceTo(center) + 0.22
  ));

  // Limpa visualmente todas as peças, exceto uma única mancha em uma única malha.
  for (const shader of surfaceEffects.materials.values()) setTextureClean(shader, true, null);
  const targetShader = surfaceEffects.materials.get(remainingMarks[0].mesh.uuid);
  if (targetShader) {
    setTextureClean(targetShader, false, { center, radius });
  }

  for (const mark of marks) {
    mark.wet = false;
    mark.soapy = false;
    mark.scrubbed = false;
    mark.removed = !remaining.has(mark);
  }

  surfaceEffects.cleanedDirt = marks.length - remainingMarks.length;
  surfaceEffects.resetBrushPath();
  surfaceEffects.onProgress(surfaceEffects.getProgress());
  surfaceEffects.onMessage("Modo demonstração: manchas concentradas em uma única área da lateral. Molhe, ensaboe, esfregue e enxágue.");
  console.info(`[CarWash Demo] ${surfaceEffects.cleanedDirt}/${marks.length} pontos concluídos; ${remainingMarks.length} concentrados em uma área.`);
  return true;
}
