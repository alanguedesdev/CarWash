import * as THREE from "three";

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
  const axes = [
    { u: "y", v: "z" }, { u: "y", v: "z" },
    { u: "x", v: "z" }, { u: "x", v: "z" },
    { u: "x", v: "y" }, { u: "x", v: "y" },
  ];
  const { u, v } = axes[axis];
  return {
    u: Math.max(0, Math.min(1, (point[u] - min[u]) / Math.max(size[u], 0.0001))),
    v: Math.max(0, Math.min(1, (point[v] - min[v]) / Math.max(size[v], 0.0001))),
  };
}

function chooseDoorCluster(marks, amount, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const min = bounds.min;
  const groups = new Map();
  // A orientação dos triângulos no GLB pode inverter o sinal da normal.
  // Detectamos o hemisfério efetivamente usado pelas amostras, sem presumir +Z.
  const positive = marks.filter((mark) => mark.normal.x >= 0.45).length;
  const negative = marks.filter((mark) => mark.normal.x <= -0.45).length;
  const sideSign = positive >= negative ? 1 : -1;

  for (const mark of marks) {
    if (mark.normal.x * sideSign < 0.45) continue;
    if (!groups.has(mark.mesh)) groups.set(mark.mesh, []);
    groups.get(mark.mesh).push(mark);
  }

  let bestMarks = [];
  let bestScore = Infinity;
  let bestAxis = 2;

  for (const group of groups.values()) {
    if (group.length < amount) continue;

    const sideAxis = "x";
    const longitudinalAxis = "z";
    const sidePosition = group.reduce((sum, mark) => sum + mark.position[sideAxis], 0) / group.length;
    const center = new THREE.Vector3();
    center[sideAxis] = sidePosition;
    center[longitudinalAxis] = min[longitudinalAxis] + size[longitudinalAxis] * 0.52;
    center.y = min.y + size.y * 0.39;

    const ranked = group.map((mark) => {
      const along = (mark.position[longitudinalAxis] - min[longitudinalAxis]) /
        Math.max(size[longitudinalAxis], 0.0001);
      const height = (mark.position.y - min.y) / Math.max(size.y, 0.0001);
      const outsideDoorPenalty =
        (along < 0.28 || along > 0.72 ? 100 : 0) +
        (height < 0.22 || height > 0.58 ? 100 : 0);
      return {
        mark,
        score: mark.position.distanceToSquared(center) + outsideDoorPenalty,
      };
    }).sort((a, b) => a.score - b.score);

    const selected = ranked.slice(0, amount);
    const score = selected.reduce((sum, item) => sum + item.score, 0);
    if (selected.length === amount && score < bestScore) {
      bestScore = score;
      bestMarks = selected.map((item) => item.mark);
      const signed = group.reduce((sum, mark) => sum + mark.normal[sideAxis], 0);
      bestAxis = signed >= 0 ? 0 : 1;
    }
  }

  if (!bestMarks.length) {
    // Não transforma silenciosamente uma face arbitrária em "porta direita".
    // Sem amostras do hemisfério direito, o preset falha de forma explícita.
    return { marks: [], axis: 0 };
  }

  return { marks: bestMarks, axis: bestAxis };
}

function setTextureClean(shader, patch = null) {
  shader.textures.forEach((texture, axis) => {
    const data = texture.image.data;

    // Estado-base invariável: toda a malha começa limpa (canal R = 255).
    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = 255;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }

    // Somente os pixels dentro do patch voltam a permitir sujeira (R = 0).
    if (patch && axis === patch.axis) {
      const center = project(patch.center, axis, shader.boundsMin, shader.boundsSize);
      const axes = [
        { u: 1, v: 2 }, { u: 1, v: 2 },
        { u: 0, v: 2 }, { u: 0, v: 2 },
        { u: 0, v: 1 }, { u: 0, v: 1 },
      ][axis];
      const rx = Math.max(2, Math.ceil(Math.min(0.48, (patch.radiusU || patch.radius) / Math.max(shader.boundsSize.getComponent(axes.u), 0.001)) * 256));
      const ry = Math.max(2, Math.ceil(Math.min(0.48, (patch.radiusV || patch.radius) / Math.max(shader.boundsSize.getComponent(axes.v), 0.001)) * 256));
      const cx = Math.round(center.u * 255);
      const cy = Math.round(center.v * 255);

      for (let y = Math.max(0, cy - ry); y <= Math.min(255, cy + ry); y++) {
        for (let x = Math.max(0, cx - rx); x <= Math.min(255, cx + rx); x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const angle = Math.atan2(dy, dx);
          const edge = 1 + (patch.irregularity || 0) * (
            Math.sin(angle * 3 + 0.7) * 0.55 +
            Math.sin(angle * 5 - 1.2) * 0.3 +
            Math.sin(angle * 7 + 2.1) * 0.15
          );
          if (Math.hypot(dx, dy) <= edge) {
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
  const selection = chooseDoorCluster(marks, remainingCount, surfaceEffects.modelBounds);
  const remainingMarks = selection.marks;
  if (!remainingMarks.length) {
    console.error("[CarWash Demo] Não foi possível selecionar pontos residuais para a porta; preset não aplicado.", {
      totalMarks: marks.length,
      modelBounds: surfaceEffects.modelBounds,
    });
    return false;
  }
  if (remainingMarks.length !== remainingCount) {
    console.warn(`[CarWash Demo] Cluster lateral contém ${remainingMarks.length}/${remainingCount} pontos; ajustando o preset para preservar sujeira visível.`);
  }

  const remaining = new Set(remainingMarks);
  const center = remainingMarks.reduce(
    (sum, mark) => sum.add(mark.position),
    remainingMarks[0].position.clone()
  ).multiplyScalar(1 / remainingMarks.length);
  // Calcula a extensão real do grupo selecionado para que a máscara visual
  // cubra os pontos lógicos que a bucha/enxágue irão concluir.
  const patchAxis = selection.axis;
  const axes = [
    { u: "y", v: "z" }, { u: "y", v: "z" },
    { u: "x", v: "z" }, { u: "x", v: "z" },
    { u: "x", v: "y" }, { u: "x", v: "y" },
  ][patchAxis];
  const radius = Math.max(
    0.12,
    ...remainingMarks.map((mark) => Math.hypot(
      mark.position[axes.u] - center[axes.u],
      mark.position[axes.v] - center[axes.v]
    ) + 0.08)
  ) * 1.12;

  // Limpa TODAS as máscaras de TODAS as malhas. Na malha da porta, reabre
  // somente o patch circular escolhido na projeção lateral correspondente.
  for (const shader of surfaceEffects.materials.values()) setTextureClean(shader);
  const targetShader = surfaceEffects.materials.get(remainingMarks[0].mesh.uuid);
  if (!targetShader) {
    console.error("[CarWash Demo] Shader da malha selecionada não encontrado; preset cancelado.");
    return false;
  }
  // Mancha demo um pouco maior, ovalada e com borda orgânica; só afeta a máscara visual.
  setTextureClean(targetShader, {
    center,
    radius,
    radiusU: radius * 1.34,
    radiusV: radius * 0.86,
    irregularity: 0.12,
    axis: patchAxis,
  });

  for (const mark of marks) {
    mark.wet = false;
    mark.soapy = false;
    mark.scrubbed = false;
    mark.removed = !remaining.has(mark);
  }

  if (remainingMarks.length !== remainingCount) {
    console.warn(`[CarWash Demo] Apenas ${remainingMarks.length}/${remainingCount} pontos disponíveis na mesma malha lateral; percentual inicial ajustado para manter a região lavável.`);
  }

  surfaceEffects.demoWashPreset = true;
  surfaceEffects.cleanedDirt = marks.length - remainingMarks.length;
  surfaceEffects.resetBrushPath();
  surfaceEffects.onProgress(surfaceEffects.getProgress());
  surfaceEffects.onMessage("Modo demonstração: manchas concentradas em uma única área da lateral. Molhe, ensaboe, esfregue e enxágue.");
  console.info(`[CarWash Demo] preset aplicado: ${surfaceEffects.cleanedDirt}/${marks.length} pontos limpos; ${remainingMarks.length} pontos residuais; malha=${remainingMarks[0].mesh.name || remainingMarks[0].mesh.uuid}; centro=(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)}); raio=${radius.toFixed(3)}.`);
  return true;
}
