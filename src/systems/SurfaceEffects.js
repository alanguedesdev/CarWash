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
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.cleaningRadiusMultiplier = 1;
    this.rinseRadiusMultiplier = 1;
    this.disposed = false;
    this.clock = new THREE.Clock();
    this.dirtProfile = "mud";
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

    for (const { mesh, area } of candidates.slice(0, 100)) {
      this.surfaces.set(mesh.uuid, { mesh, area });
      const meshToModel = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
      this.materials.set(mesh.uuid, new ProceduralWashMaterial(mesh, { dirtProfile: this.dirtProfile, meshToModel }));
    }
    if (!this.surfaces.size) {
      this.onMessage("Não foi possível preparar as superfícies do carro.");
      return false;
    }

    const totalArea = candidates.reduce((sum, item) => sum + item.area, 0);
    for (const { mesh, area } of candidates.slice(0, 100)) {
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
      this.onMessage("Passe a ferramenta diretamente sobre a lataria.");
      return false;
    }
    const { mesh, point } = target;
    const shader = this.materials.get(mesh.uuid);
    const radius = RADIUS * (tool === "sponge" ? this.cleaningRadiusMultiplier : 1);

    if (tool === "water") {
      const waterRadius = WATER_RADIUS * this.rinseRadiusMultiplier;
      const waterRadiusSquared = waterRadius * waterRadius;
      const rinsesExistingLayer = this.dirtMarks.some((mark) =>
        mark.mesh === mesh &&
        (mark.soapy || mark.scrubbed) &&
        mark.position.distanceToSquared(point) <= waterRadiusSquared
      );
      // G recebe umidade em qualquer aplicação; B/A só são limpos no enxágue.
      shader.addStamp(point, waterRadius, 2);
      if (rinsesExistingLayer) shader.addStamp(point, waterRadius * 1.08, 3);

      for (const mark of this.dirtMarks) {
        if (mark.mesh !== mesh || mark.position.distanceToSquared(point) > waterRadiusSquared) continue;
        mark.wet = true;
        if (mark.scrubbed) mark.removed = true;
        else if (rinsesExistingLayer) mark.soapy = false;
      }
      this.soapZones = this.soapZones.filter((zone) =>
        zone.mesh !== mesh || zone.position.distanceToSquared(point) > waterRadiusSquared
      );
      this.onMessage(rinsesExistingLayer
        ? "Enxágue aplicado: espuma removida e pintura limpa/molhada."
        : "Área molhada. Agora aplique o sabão.");
    } else if (tool === "soap") {
      const eligible = this.dirtMarks.some((mark) => mark.mesh === mesh && mark.position.distanceToSquared(point) <= radius * radius && mark.wet && !mark.removed);
      if (!eligible) {
        this.onMessage("Molhe essa região antes de aplicar o sabão.");
        return false;
      }
      shader.addStamp(point, radius * 1.7, 1);
      this.soapZones.push({ mesh, position: point.clone() });
      if (this.soapZones.length > 48) this.soapZones.shift();
      for (const mark of this.dirtMarks) {
        if (mark.mesh === mesh && mark.position.distanceToSquared(point) <= radius * radius) mark.soapy = true;
      }
      this.onMessage("Espuma aderida à lataria. Espalhe com a bucha.");
    } else if (tool === "sponge") {
      const scrubbed = this.dirtMarks.some((mark) => mark.mesh === mesh && mark.position.distanceToSquared(point) <= radius * radius && mark.wet && mark.soapy && !mark.removed);
      if (!scrubbed) {
        this.onMessage("Molhe e ensaboe essa região antes de esfregar.");
        return false;
      }
      shader.addStamp(point, radius * 1.6, 0);
      for (const mark of this.dirtMarks) {
        if (mark.mesh === mesh && mark.position.distanceToSquared(point) <= radius * radius && mark.wet && mark.soapy) mark.scrubbed = true;
      }
      this.onMessage("Bucha em movimento: sujeira dissolvida e espuma espalhada.");
    } else return false;

    this.cleanedDirt = this.dirtMarks.filter((mark) => mark.removed).length;
    this.onProgress(this.getProgress());
    return true;
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
    this.model = null;
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.disposed = true;
  }
}
