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
  const axes = [{ u: "y", v: "z" }, { u: "x", v: "z" }, { u: "x", v: "y" }];
  const { u, v } = axes[axis];
  return {
    u: Math.max(0, Math.min(1, (point[u] - min[u]) / Math.max(size[u], 0.0001))),
    v: Math.max(0, Math.min(1, (point[v] - min[v]) / Math.max(size[v], 0.0001))),
  };
}

function chooseDoorCluster(marks, amount, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const min = bounds.min;
  const target = new THREE.Vector3(
    min.x + size.x * 0.52,
    min.y + size.y * 0.39,
    0
  );
  const groups = new Map();

  // Primeiro restringe às faces laterais do modelo e agrupa por malha.
  for (const mark of marks) {
    if (Math.abs(mark.normal.z) < 0.45) continue;
    if (!groups.has(mark.mesh)) groups.set(mark.mesh, []);
    groups.get(mark.mesh).push(mark);
  }

  // Não exige que 18 amostras caiam por acaso dentro de uma janela estreita.
  // Seleciona a malha lateral com mais amostras e pega nela as mais próximas
  // do centro da porta. Isso evita retornar vazio e deixar o carro 0%/todo sujo.
  let best = [];
  let bestScore = Infinity;
  for (const group of groups.values()) {
    if (!group.length) continue;
    const sideZ = group.reduce((sum, mark) => sum + mark.position.z, 0) / group.length;
    const center = target.clone();
    center.z = sideZ;
    const nearest = group
      .map((mark) => {
        const nx = (mark.position.x - min.x) / Math.max(size.x, 0.0001);
        const ny = (mark.position.y - min.y) / Math.max(size.y, 0.0001);
        const regionPenalty =
          (nx < 0.30 || nx > 0.74 ? 1.5 : 0) +
          (ny < 0.20 || ny > 0.58 ? 1.5 : 0);
        return {
          mark,
          score: mark.position.distanceToSquared(center) + regionPenalty,
        };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, Math.min(amount, group.length));
    const score = nearest.reduce((sum, item) => sum + item.score, 0);
    // Prioriza grupos capazes de fornecer todos os pontos; em empate,
    // escolhe o conjunto espacialmente mais próximo da porta.
    const completenessPenalty = group.length < amount ? 1000 : 0;
    if (score + completenessPenalty < bestScore) {
      bestScore = score + completenessPenalty;
      best = nearest.map((item) => item.mark);
    }
  }

  return best;
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

      // Aplique a mancha somente na projeção alinhada à normal lateral.
    // As outras projeções são planos extrudados e espalhariam a sujeira pelo
    // teto/capô/partes internas da mesma malha.
    if (patch && !clean && axis === patch.axis) {
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
  const remainingMarks = chooseDoorCluster(marks, remainingCount, surfaceEffects.modelBounds);
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
  // Mancha visual contida no painel central da porta, sem alcançar capô,
  // teto, para-choques ou caixas de roda.
  const boundsSize = surfaceEffects.modelBounds.getSize(new THREE.Vector3());
  const radius = Math.min(boundsSize.x * 0.12, boundsSize.y * 0.16);

  // Limpa visualmente todas as peças, exceto uma única mancha em uma única malha.
  for (const shader of surfaceEffects.materials.values()) setTextureClean(shader, true, null);
  const targetShader = surfaceEffects.materials.get(remainingMarks[0].mesh.uuid);
  // A porta é uma face lateral: sua máscara usa exclusivamente a projeção XY
  // (eixo Z), evitando replicar sujeira no teto ou em superfícies internas.
  if (targetShader) {
    const dominantNormal = remainingMarks.reduce(
      (sum, mark) => sum.add(mark.normal),
      new THREE.Vector3()
    ).normalize();
    const patchAxis = Math.abs(dominantNormal.x) > Math.abs(dominantNormal.z) ? 0 : 2;
    setTextureClean(targetShader, false, { center, radius: Math.min(radius, 0.55), axis: patchAxis });
  }

  for (const mark of marks) {
    mark.wet = false;
    mark.soapy = false;
    mark.scrubbed = false;
    mark.removed = !remaining.has(mark);
  }

  surfaceEffects.demoWashPreset = true;
  surfaceEffects.cleanedDirt = marks.length - remainingMarks.length;
  surfaceEffects.resetBrushPath();
  surfaceEffects.onProgress(surfaceEffects.getProgress());
  surfaceEffects.onMessage("Modo demonstração: manchas concentradas em uma única área da lateral. Molhe, ensaboe, esfregue e enxágue.");
  console.info(`[CarWash Demo] preset aplicado: ${surfaceEffects.cleanedDirt}/${marks.length} pontos limpos; ${remainingMarks.length} pontos residuais; malha=${remainingMarks[0].mesh.name || remainingMarks[0].mesh.uuid}; centro=(${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)}); raio=${radius.toFixed(3)}.`);
  return true;
}
