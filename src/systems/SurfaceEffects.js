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
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.cleaningRadiusMultiplier = 1;
    this.rinseRadiusMultiplier = 1;
    this.disposed = false;
    this.clock = new THREE.Clock();
    this.dirtProfile = "mud";
    this.lastBrushHit = null;
    this.modelBounds = new THREE.Box3();
  }

  setUpgradeBonuses({ cleaningRadiusMultiplier = 1, rinseRadiusMultiplier = 1 } = {}) {
    this.cleaningRadiusMultiplier = Math.max(1, cleaningRadiusMultiplier);
    this.rinseRadiusMultiplier = Math.max(1, rinseRadiusMultiplier);
  }

  calculateModelBounds(model, meshes) {
    const bounds = new THREE.Box3();
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const meshToModel = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
      const box = geometry.boundingBox;
      for (let x = 0; x <= 1; x++) {
        for (let y = 0; y <= 1; y++) {
          for (let z = 0; z <= 1; z++) {
            const point = new THREE.Vector3(
              x ? box.max.x : box.min.x,
              y ? box.max.y : box.min.y,
              z ? box.max.z : box.min.z
            ).applyMatrix4(meshToModel);
            bounds.expandByPoint(point);
          }
        }
      }
    }
    return bounds;
  }

  attachModel(model, { dirtProfile = this.dirtProfile } = {}) {
    this.dispose();
    this.dirtProfile = ["mud", "soot", "tar", "debris"].includes(dirtProfile) ? dirtProfile : "mud";
    this.disposed = false;
    this.model = model;
    this.surfaces = new Map();
    this.materials = new Map();
    this.dirtMarks = [];
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
    if (!candidates.length) {
      this.onMessage("Não foi possível preparar as superfícies do carro.");
      return false;
    }

    this.modelBounds = this.calculateModelBounds(model, candidates.map((item) => item.mesh));
    if (this.modelBounds.isEmpty()) {
      this.onMessage("Não foi possível calcular a área de lavagem do veículo.");
      return false;
    }

    for (const { mesh, area } of candidates) {
      const meshToModel = new THREE.Matrix4().copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
      this.surfaces.set(mesh.uuid, { mesh, area, meshToModel });
      this.materials.set(mesh.uuid, new ProceduralWashMaterial(mesh, {
        dirtProfile: this.dirtProfile,
        meshToModel,
        bounds: this.modelBounds,
      }));
    }

    const totalArea = candidates.reduce((sum, item) => sum + item.area, 0);
    for (const { mesh, area } of candidates) {
      const count = Math.max(1, Math.round((area / Math.max(totalArea, 0.001)) * DIRT_COUNT));
      for (let i = 0; i < count; i++) {
        const sample = this.randomPointOnMesh(mesh);
        if (!sample) continue;
        const worldPoint = mesh.localToWorld(sample.point.clone());
        const modelPoint = model.worldToLocal(worldPoint);
        const surface = this.surfaces.get(mesh.uuid);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.meshToModel);
        const modelNormal = sample.normal.clone().applyMatrix3(normalMatrix).normalize();
        this.dirtMarks.push({
          mesh,
          position: modelPoint,
          normal: modelNormal,
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
    console.info(`[SurfaceEffects] Máscaras triplanares persistentes aplicadas em ${this.surfaces.size} malhas; ${this.totalDirt} pontos de sujeira.`);
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
      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (normal.lengthSq() > 0.5) return { point, normal };
    }
    return null;
  }

  getLocalHit(hit) {
    if (!hit?.object?.isMesh || !hit.point || !this.model || !hit.face?.normal) return null;
    const mesh = hit.object;
    const surface = this.surfaces.get(mesh.uuid);
    if (!surface) return null;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(surface.meshToModel);
    const normal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
    return { mesh, point: this.model.worldToLocal(hit.point.clone()), normal };
  }

  applyTool(hit, tool) {
    if (this.disposed) return false;
    const target = this.getLocalHit(hit);
    if (!target) {
      this.resetBrushPath();
      this.onMessage("Passe a ferramenta diretamente sobre a lataria.");
      return false;
    }

    const { mesh, point, normal } = target;
    const baseRadius = tool === "water"
      ? WATER_RADIUS * this.rinseRadiusMultiplier
      : RADIUS * (tool === "sponge" ? this.cleaningRadiusMultiplier : 1);
    const previous = this.lastBrushHit;
    const canBridge = previous && previous.tool === tool && previous.mesh === mesh;
    const distance = canBridge ? previous.point.distanceTo(point) : 0;
    const spacing = Math.max(baseRadius * 0.24, 0.03);
    const steps = canBridge ? Math.min(128, Math.max(1, Math.ceil(distance / spacing))) : 1;
    let changed = false;

    for (let i = 1; i <= steps; i++) {
      const sample = canBridge ? previous.point.clone().lerp(point, i / steps) : point.clone();
      const sampleNormal = canBridge ? previous.normal.clone().lerp(normal, i / steps).normalize() : normal;
      changed = this.applyToolAtPoint(mesh, sample, sampleNormal, tool, baseRadius) || changed;
    }

    this.lastBrushHit = { mesh, point: point.clone(), normal: normal.clone(), tool };
    if (changed) {
      this.cleanedDirt = this.dirtMarks.filter((mark) => mark.removed).length;
      this.onProgress(this.getProgress());
    }
    return changed;
  }

  resetBrushPath() {
    this.lastBrushHit = null;
  }

  applyToolAtPoint(mesh, point, normal, tool, brushRadius) {
    const shader = this.materials.get(mesh.uuid);
    if (!shader) return false;
    const result = shader.paint(point, brushRadius, tool, this.clock.getElapsedTime(), normal);
    const radiusSquared = brushRadius * brushRadius;
    const nearbyMarks = this.dirtMarks.filter((mark) =>
      mark.mesh === mesh && mark.position.distanceToSquared(point) <= radiusSquared * 1.25
    );
    let marksChanged = false;

    if (tool === "water") {
      for (const mark of nearbyMarks) {
        const mask = shader.sample(mark.position, mark.normal);
        if (mask.wet > 0.05 && !mark.wet) { mark.wet = true; marksChanged = true; }
        if (result.rinsed && mark.scrubbed && (this.demoWashPreset || shader.isCleanAt(mark.position, mark.normal)) && !mark.removed) {
          mark.removed = true;
          mark.soapy = false;
          marksChanged = true;
        } else if (result.rinsed && mark.soapy) {
          mark.soapy = false;
          marksChanged = true;
        }
      }
      if (result.changed || marksChanged) {
        this.onMessage(result.rinsed
          ? "Enxágue aplicado: espuma removida e sujeira finalizada nesta região."
          : "Área molhada. Agora aplique o sabão.");
      }
    } else if (tool === "soap") {
      for (const mark of nearbyMarks) {
        const mask = shader.sample(mark.position, mark.normal);
        if (mask.wet > 0.05 && mask.soap > 0.05 && !mark.soapy && !mark.removed) {
          mark.soapy = true;
          mark.wet = true;
          marksChanged = true;
        }
      }
      if (result.changed || marksChanged) this.onMessage("Sabão aplicado na região. Passe a bucha para esfregar.");
    } else if (tool === "sponge") {
      for (const mark of nearbyMarks) {
        const mask = shader.sample(mark.position, mark.normal);
        if (mask.wet > 0.05 && mask.soap > 0.05 && mask.foam > 0.05 &&
            shader.isCleanAt(mark.position, mark.normal) && !mark.scrubbed && !mark.removed) {
          mark.scrubbed = true;
          marksChanged = true;
        }
      }
      if (result.changed || marksChanged) this.onMessage("Bucha em ação! Sujeira removida e espuma pronta para o enxágue.");
    }

    shader.flush();
    return result.changed || marksChanged;
  }

  getFoamCount() {
    let count = 0;
    for (const shader of this.materials.values()) count += shader.getFoamCount();
    return count;
  }

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
    this.lastBrushHit = null;
    this.model = null;
    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.modelBounds?.makeEmpty();
    this.disposed = true;
  }
}
