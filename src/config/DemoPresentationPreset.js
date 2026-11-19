/**
 * Preset reversível para apresentações do CarWash.
 * Desligue DEMO_PRESENTATION_MODE e publique para restaurar o save original.
 * Com o modo ativo, cada carregamento da página reinicia a carreira de demo.
 */
export const DEMO_PRESENTATION_MODE = true;

const CAREER_STORAGE_KEY = "carwash-business-progress-v1";
const BACKUP_STORAGE_KEY = "carwash-demo-original-save-v1";

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
      return;
    }

    // Guarda o save real somente na primeira ativação; nunca o substitui pelo demo.
    if (localStorage.getItem(BACKUP_STORAGE_KEY) === null) {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        original: localStorage.getItem(CAREER_STORAGE_KEY),
      }));
    }

    // Executado a cada reload: a compra e o saldo voltam ao estado inicial de demo.
    localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(DEMO_CAREER));
  } catch (error) {
    console.warn("[CarWash Demo] Não foi possível preparar o save de demonstração:", error);
  }
}

function projection(point, axis, boundsMin, boundsSize) {
  const axes = [{ u: "y", v: "z" }, { u: "x", v: "z" }, { u: "x", v: "y" }];
  const { u, v } = axes[axis];
  return {
    u: Math.max(0, Math.min(1, (point[u] - boundsMin[u]) / Math.max(boundsSize[u], 0.0001))),
    v: Math.max(0, Math.min(1, (point[v] - boundsMin[v]) / Math.max(boundsSize[v], 0.0001))),
  };
}

function chooseSingleCluster(marks, amount, bounds) {
  const sideMarks = marks.filter((mark) => Math.abs(mark.normal.z) >= 0.48);
  const candidates = sideMarks.length >= amount
    ? sideMarks
    : marks.filter((mark) => mark.mesh === marks[0]?.mesh);

  if (!candidates.length) return [];

  // Escolhe o centro com a menor soma de distâncias aos N vizinhos mais próximos.
  let best = null;
  let bestScore = Infinity;
  for (const center of candidates) {
    const nearest = candidates
      .map((mark) => ({ mark, distance: mark.position.distanceTo(center.position) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, amount);
    if (nearest.length < amount) continue;
    const score = nearest.reduce((sum, item) => sum + item.distance ** 2, 0);
    if (score < bestScore) {
      bestScore = score;
      best = nearest.map((item) => item.mark);
    }
  }

  if (best) return best;
  return [...candidates].sort((a, b) =>
    a.position.distanceToSquared(candidates[0].position) -
    b.position.distanceToSquared(candidates[0].position)
  ).slice(0, amount);
}

function setTextureClean(shader, clean, patch) {
  shader.textures.forEach((texture, axis) => {
    const data = texture.image.data;
    // Canal R da máscara: 255 significa superfície limpa; 0 preserva a sujeira.
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = clean ? 255 : 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }

    if (patch && !clean) {
      const center = projection(patch.center, axis, shader.boundsMin, shader.boundsSize);
      const size = shader.boundsSize;
      const axes = [{ u: 1, v: 2 }, { u: 0, v: 2 }, { u: 0, v: 1 }][axis];
      const radiusU = Math.min(0.48, patch.radius / Math.max(size.getComponent(axes.u), 0.001));
      const radiusV = Math.min(0.48, patch.radius / Math.max(size.getComponent(axes.v), 0.001));
      const cx = Math.round(center.u * 255), cy = Math.round(center.v * 255);
      const rx = Math.max(2, Math.ceil(radiusU * 256));
      const ry = Math.max(2, Math.ceil(radiusV * 256));
      for (let y = Math.max(0, cy - ry); y <= Math.min(255, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(255, cx + rx); x++) {
          const distance = Math.hypot((x - cx) / rx, (y - cy) / ry);
          if (distance <= 1) data[(y * 256 + x) * 4] = 0;
        }
      }
    }

    texture.needsUpdate = true;
  });
  shader.foamPixels = 0;
  shader.fadeIndices.clear();
  shader.dirtyTextures.clear();
}

*
 * Preset reversível para apresentações do CarWash.
 * Desligue DEMO_PRESENTATION_MODE e publique para restaurar o save original.
 * Com o modo ativo, cada carregamento da página reinicia a carreira de demo.
 */
export const DEMO_PRESENTATION_MODE = true;

const CAREER_STORAGE_KEY = "carwash-business-progress-v1";
const BACKUP_STORAGE_KEY = "carwash-demo-original-save-v1";

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
      return;
    }

    // Guarda o save real somente na primeira ativação; nunca o substitui pelo demo.
    if (localStorage.getItem(BACKUP_STORAGE_KEY) === null) {
      localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
        original: localStorage.getItem(CAREER_STORAGE_KEY),
      }));
    }

    // Executado a cada reload: a compra e o saldo voltam ao estado inicial de demo.
    localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(DEMO_CAREER));
  } catch (error) {
    console.warn("[CarWash Demo] Não foi possível preparar o save de demonstração:", error);
  }
}

function projection(point, axis, boundsMin, boundsSize) {
  const axes = [{ u: "y", v: "z" }, { u: "x", v: "z" }, { u: "x", v: "y" }];
  const { u, v } = axes[axis];
  return {
    u: Math.max(0, Math.min(1, (point[u] - boundsMin[u]) / Math.max(boundsSize[u], 0.0001))),
    v: Math.max(0, Math.min(1, (point[v] - boundsMin[v]) / Math.max(boundsSize[v], 0.0001))),
  };
}

function chooseSingleCluster(marks, amount, bounds) {
  const sideMarks = marks.filter((mark) => Math.abs(mark.normal.z) >= 0.48);
  const candidates = sideMarks.length >= amount
    ? sideMarks
    : marks.filter((mark) => mark.mesh === marks[0]?.mesh);

  if (!candidates.length) return [];

  // Escolhe o centro com a menor soma de distâncias aos N vizinhos mais próximos.
  let best = null;
  let bestScore = Infinity;
  for (const center of candidates) {
    const nearest = candidates
      .map((mark) => ({ mark, distance: mark.position.distanceTo(center.position) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, amount);
    if (nearest.length < amount) continue;
    const score = nearest.reduce((sum, item) => sum + item.distance ** 2, 0);
    if (score < bestScore) {
      bestScore = score;
      best = nearest.map((item) => item.mark);
    }
  }

  if (best) return best;
  return [...candidates].sort((a, b) =>
    a.position.distanceToSquared(candidates[0].position) -
    b.position.distanceToSquared(candidates[0].position)
  ).slice(0, amount);
}

function setTextureClean(shader, clean, patch) {
  shader.textures.forEach((texture, axis) => {
    const data = texture.image.data;
    // Canal R da máscara: 255 significa superfície limpa; 0 preserva a sujeira.
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = clean ? 255 : 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }

    if (patch && !clean) {
      const center = projection(patch.center, axis, shader.boundsMin, shader.boundsSize);
      const size = shader.boundsSize;
      const axes = [{ u: 1, v: 2 }, { u: 0, v: 2 }, { u: 0, v: 1 }][axis];
      const radiusU = Math.min(0.48, patch.radius / Math.max(size.getComponent(axes.u), 0.001));
      const radiusV = Math.min(0.48, patch.radius / Math.max(size.getComponent(axes.v), 0.001));
      const cx = Math.round(center.u * 255), cy = Math.round(center.v * 255);
      const rx = Math.max(2, Math.ceil(radiusU * 256));
      const ry = Math.max(2, Math.ceil(radiusV * 256));
      for (let y = Math.max(0, cy - ry); y <= Math.min(255, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(255, cx + rx); x++) {
          const distance = Math.hypot((x - cx) / rx, (y - cy) / ry);
          if (distance <= 1) data[(y * 256 + x) * 4] = 0;
        }
      }
    }

    texture.needsUpdate = true;
  });
  shader.foamPixels = 0;
  shader.fadeIndices.clear();
  shader.dirtyTextures.clear();
}

function shaderBounds(shader) {
  return {
    min: shader.boundsMin,
    getSize: (target) => target.set(
      shader.boundsSize.x, shader.boundsSize.y, shader.boundsSize.z
    ),
  };
}

/**
 * Deixa 80% dos pontos concluídos e concentra os 20% restantes em uma única
 * mancha na mesma malha e em uma área circular da lateral/carroceria.
 * As interações seguintes continuam usando SurfaceEffects.applyTool().
 */
export function applyDemoWashPreset(surfaceEffects) {
  if (!DEMO_PRESENTATION_MODE || !surfaceEffects?.dirtMarks?.length) return false;

  const marks = surfaceEffects.dirtMarks;
  const remainingCount = Math.max(1, Math.round(marks.length * 0.2));
  const remainingMarks = chooseSingleCluster(marks, remainingCount, surfaceEffects.modelBounds);
  if (!remainingMarks.length) return false;

  const remaining = new Set(remainingMarks);
  const center = remainingMarks.reduce((sum, mark) => sum.add(mark.position), remainingMarks[0].position.clone())
    .multiplyScalar(1 / remainingMarks.length);
  const radius = Math.max(0.3, ...remainingMarks.map((mark) => mark.position.distanceTo(center) + 0.22));
  const patch = { center, radius };

  // Primeiro limpa toda a máscara visual de cada peça.
  for (const shader of surfaceEffects.materials.values()) {
    setTextureClean(shader, true, null);
  }

  // Reintroduz sujeira somente em um círculo da única malha escolhida.
  const targetMesh = remainingMarks[0].mesh;
  const targetShader = surfaceEffects.materials.get(targetMesh.uuid);
  if (targetShader) {
    setTextureClean(targetShader, false, patch);
    targetShader.flush();
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
