import * as THREE from "three";
import ProceduralWashMaterial from "./ProceduralWashMaterial.js";

const DIRT_COUNT = 90;
const RADIUS = 0.62;
const WATER_RADIUS = 0.29;

export default class SurfaceEffects {
  constructor({ onProgress = () => {}, onMessage = () => {} } = {}) {
    this.onProgress = onProgress;
    this.onMessage = onMessage;
    this.model = null;
    this.surfaces = new Map();
    this.materials = new Map();
    this.dirtMarks = [];
    this.soapZones = [];
    this.wetZones = [];
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.cleaningRadiusMultiplier = 1;
    this.rinseRadiusMultiplier = 1;
    this.disposed = false;
    this.clock = new THREE.Clock();
    this.dirtProfile = "mud";
    this.lastBrushHit = null;
  }

  setUpgradeBonuses({ cleaningRadiusMultiplier = 1, rinseRadiusMultiplier = 1 } = {}) {
    this.cleaningRadiusMultiplier = Math.max(1, cleaningRadiusMultiplier);
    this.rinseRadiusMultiplier = Math.max(1, rinseRadiusMultiplier);
  }

  attachModel(model, { dirtProfile = this.dirtProfile } = {}) {
    this.dispose();
    this.dirtProfile = ["mud", "soot", "tar", "debris"].includes(dirtProfile) ? dirtProfile : "mud";
    this.disposed = false;
    this.model = model;
    this.surfaces = new Map();
    this.materials = new Map();
    this.dirtMarks = [];
    this.soapZones = [];
    this.wetZones = [];
    this.cleanedDirt = 0;
    model.updateMatrixWorld(true);

    const candidates = [];
    model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);
      const area = size.x * size.y + size.x * size.z + size.y * size.z;
      if (size.length() > 0.001 && area > 0.002) candidates.push({ mesh, area });
    });
    candidates.sort((a, b) => b.area - a.area);

    for (const { mesh, area } of candidates) {
      this.surfaces.set(mesh.uuid, { mesh, area });
      const meshToModel = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
      this.materials.set(mesh.uuid, new ProceduralWashMaterial(mesh, { dirtProfile: this.dirtProfile, meshToModel }));
    }
    if (!this.surfaces.size) {
      this.onMessage("Não foi possível preparar as superfícies do carro.");
      return false;
    }

    const totalArea = candidates.reduce((sum, item) => sum + item.area, 0);
    for (const { mesh, area } of candidates) {
      const count = Math.max(1, Math.round((area / Math.max(totalArea, 0.001)) * DIRT_COUNT));
      for (let i = 0; i < count; i++) {
        const sample = this.randomPointOnMesh(mesh);
        if (!sample) continue;
        const worldPoint = mesh.localToWorld(sample.point.clone());
        const modelPoint = model.worldToLocal(worldPoint);
        this.dirtMarks.push({
          mesh,
          position: modelPoint,
          wet: false,
          soapy: false,
          scrubbed: false,
          removed: false,
        });
      }
    }
    this.totalDirt = this.dirtMarks.length;
    this.onProgress(this.getProgress());
    this.onMessage("Superfície preparada. Molhe, ensaboe, esfregue e enxágue.");
    console.info(`[SurfaceEffects] Shader triplanar aplicado em ${this.surfaces.size} peças; ${this.totalDirt} pontos de sujeira.`);
    return true;
  }

  randomPointOnMesh(mesh) {
    const geometry = mesh.geometry;
    const pos = geometry.attributes.position;
    const index = geometry.index;
    const count = index ? Math.floor(index.count / 3) : Math.floor(pos.count / 3);
    if (!count) return null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const tri = Math.floor(Math.random() * count);
      const ia = index ? index.getX(tri * 3) : tri * 3;
      const ib = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
      const ic = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
      const a = new THREE.Vector3().fromBufferAttribute(pos, ia);
      const b = new THREE.Vector3().fromBufferAttribute(pos, ib);
      const c = new THREE.Vector3().fromBufferAttribute(pos, ic);
      let u = Math.random(), v = Math.random();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      const point = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
      if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 0.0001) return { point };
    }
    return null;
  }

  getLocalHit(hit) {
    if (!hit?.object?.isMesh || !hit.point || !this.model) return null;
    const mesh = hit.object;
    if (!this.surfaces.has(mesh.uuid)) return null;
    return { mesh, point: this.model.worldToLocal(hit.point.clone()) };
  }

  applyTool(hit, tool) {
    if (this.disposed) return false;
    const target = this.getLocalHit(hit);
    if (!target) {
      this.resetBrushPath();
      this.onMessage("Passe a ferramenta diretamente sobre a lataria.");
      return false;
    }

    const { mesh, point } = target;
    const baseRadius = tool === "water"
      ? WATER_RADIUS * this.rinseRadiusMultiplier
      : RADIUS * (tool === "sponge" ? this.cleaningRadiusMultiplier : 1);
    const previous = this.lastBrushHit;
    const canBridge = previous && previous.tool === tool;
    const distance = canBridge ? previous.point.distanceTo(point) : 0;
    const spacing = Math.max(baseRadius * 0.32, 0.035);
    const steps = canBridge ? Math.min(64, Math.max(1, Math.ceil(distance / spacing))) : 1;
    let changed = false;

    for (let i = 1; i <= steps; i++) {
      const sample = canBridge
        ? previous.point.clone().lerp(point, i / steps)
        : point.clone();
      changed = this.applyToolAtPoint(mesh, sample, tool) || changed;
    }

    this.lastBrushHit = { mesh, point: point.clone(), tool };
    if (changed) {
      this.cleanedDirt = this.dirtMarks.filter((mark) => mark.removed).length;
      this.onProgress(this.getProgress());
    }
    return changed;
  }

  resetBrushPath() {
    this.lastBrushHit = null;
  }

  applyToolAtPoint(mesh, point, tool) {
    const brushRadius = tool === "water"
      ? WATER_RADIUS * this.rinseRadiusMultiplier
      : RADIUS * (tool === "sponge" ? this.cleaningRadiusMultiplier : 1);
    const radiusSquared = brushRadius * brushRadius;

    // Estados de lavagem são registrados por região, independentemente da
    // existência de uma mancha de sujeira naquele ponto.
    const nearbyWetZones = this.wetZones.filter((zone) =>
      zone.position.distanceToSquared(point) <= radiusSquared
    );
    const nearbySoapZones = this.soapZones.filter((zone) =>
      zone.position.distanceToSquared(point) <= radiusSquared
    );
    const nearbyMarks = this.dirtMarks.filter((mark) =>
      !mark.removed && mark.position.distanceToSquared(point) <= radiusSquared
    );
    const affectedMeshes = new Set([
      mesh,
      ...nearbyMarks.map((mark) => mark.mesh),
      ...nearbyWetZones.map((zone) => zone.mesh),
      ...nearbySoapZones.map((zone) => zone.mesh),
    ]);

    if (tool === "water") {
      const rinsesExistingLayer = nearbySoapZones.length > 0 ||
        nearbyMarks.some((mark) => mark.soapy || mark.scrubbed);

      for (const targetMesh of affectedMeshes) {
        const shader = this.materials.get(targetMesh.uuid);
        if (!shader) continue;
        shader.addStamp(point, brushRadius, 2);
        if (rinsesExistingLayer) shader.addStamp(point, brushRadius * 1.08, 3);
      }

      // Keep distributed samples along the whole brush path. A wider merge
      // radius caused consecutive samples to overwrite one another, leaving
      // only the last part of a long stroke marked as wet.
      const hasNearbyWetZone = this.wetZones.some((zone) =>
        zone.mesh === mesh &&
        zone.position.distanceToSquared(point) <= brushRadius * brushRadius * 0.04
      );
      if (!hasNearbyWetZone) this.wetZones.push({ mesh, position: point.clone() });

      for (const mark of nearbyMarks) {
        mark.wet = true;
        if (mark.scrubbed) mark.removed = true;
        else if (rinsesExistingLayer) mark.soapy = false;
      }

      if (rinsesExistingLayer) {
        this.soapZones = this.soapZones.filter((zone) =>
          zone.position.distanceToSquared(point) > radiusSquared
        );
      }

      if (this.wetZones.length > 256) this.wetZones.splice(0, this.wetZones.length - 256);
      this.onMessage(rinsesExistingLayer
        ? "Enxágue aplicado: espuma removida e pintura limpa/molhada."
        : "Área molhada. Agora aplique o sabão.");
      return true;
    }

    if (tool === "soap") {
      if (!nearbyWetZones.length) return false;

      for (const targetMesh of new Set([mesh, ...nearbyWetZones.map((zone) => zone.mesh)])) {
        this.materials.get(targetMesh.uuid)?.addStamp(point, brushRadius, 1);
        const duplicateZone = this.soapZones.some((zone) =>
          zone.mesh === targetMesh &&
          zone.position.distanceToSquared(point) <= brushRadius * brushRadius * 0.0324
        );
        if (!duplicateZone) this.soapZones.push({ mesh: targetMesh, position: point.clone() });
      }
      if (this.soapZones.length > 256) this.soapZones.splice(0, this.soapZones.length - 256);
      for (const mark of nearbyMarks) {
        if (mark.wet && !mark.removed) mark.soapy = true;
      }
      this.onMessage("Sabão aplicado na região. Passe a bucha para esfregar.");
      return true;
    }

    if (tool === "sponge") {
      if (!nearbySoapZones.length) return false;

      const eligibleMarks = nearbyMarks.filter((mark) =>
        mark.wet && mark.soapy && !mark.removed
      );
      // Inclui explicitamente as malhas que possuem sujeira elegível. Em GLBs,
      // a lataria costuma estar dividida em várias peças; limpar só a malha
      // atingida pelo raycast atual fazia o progresso avançar sem limpar a
      // textura das peças vizinhas.
      const foamMeshes = new Set([
        mesh,
        ...nearbySoapZones.map((zone) => zone.mesh),
        ...eligibleMarks.map((mark) => mark.mesh),
      ]);

      for (const targetMesh of foamMeshes) {
        const shader = this.materials.get(targetMesh.uuid);
        if (!shader) continue;

        shader.addCleanStamp(point, brushRadius * 1.18);
        shader.addStamp(point, brushRadius, 4);
      }

      for (const mark of eligibleMarks) mark.scrubbed = true;
      this.onMessage("Bucha em ação! Sujeira removida e espuma pronta para o enxágue.");
      return true;
    }
    return false;
  }

  getFoamCount() { return this.soapZones.length; }

  setDirtProfile(profile) {
    this.dirtProfile = ["mud", "soot", "tar", "debris"].includes(profile) ? profile : "mud";
    for (const shader of this.materials.values()) shader.setDirtProfile(this.dirtProfile);
  }

  getPreparationProgress(property) {
    const prepared = this.dirtMarks.filter((mark) => mark[property]).length;
    const total = this.dirtMarks.length;
    return { total, prepared, percent: total ? Math.round(prepared / total * 100) : 100, complete: total > 0 && prepared === total };
  }

  getRinseProgress() {
    const rinsed = this.dirtMarks.filter((mark) => mark.removed).length;
    const total = this.dirtMarks.length;
    return { total, rinsed, percent: total ? Math.round(rinsed / total * 100) : 100, complete: total > 0 && rinsed === total };
  }

  beginRinse() { this.onMessage("Enxágue as regiões esfregadas para finalizar."); }

  update() {
    const time = this.clock.getElapsedTime();
    for (const shader of this.materials.values()) shader.update(time);
  }

  getProgress() {
    const total = this.totalDirt;
    const cleaned = this.dirtMarks.filter((mark) => mark.removed).length;
    this.cleanedDirt = cleaned;
    return { percent: total ? Math.round(cleaned / total * 100) : 0, cleaned, total, remaining: Math.max(0, total - cleaned) };
  }

  dispose() {
    for (const shader of this.materials?.values?.() || []) shader.dispose();
    this.materials?.clear();
    this.surfaces?.clear();
    this.dirtMarks = [];
    this.soapZones = [];
    this.wetZones = [];
    this.lastBrushHit = null;
    this.model = null;
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.disposed = true;
  }
}
