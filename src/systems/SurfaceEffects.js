import * as THREE from "three";

const MAX_SURFACES = 100;
const TARGET_DIRT_MARKS = 90;
const PREPARATION_RADIUS = 0.62;
const CLEANING_RADIUS = 0.48;
const MAX_PERSISTENT_EFFECTS = 180;
const SURFACE_OFFSET = 0.012;

const DIRT_COLORS = [0x49301f, 0x785139, 0x9b7957, 0xc2ad84];

export default class SurfaceEffects {
  constructor({ onProgress = () => {}, onMessage = () => {} } = {}) {
    this.onProgress = onProgress;
    this.onMessage = onMessage;

    this.model = null;
    this.surfaces = new Map();
    this.dirtMarks = [];
    this.effects = new Set();

    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.disposed = false;

    this.initializeResources();
  }

  initializeResources() {
    // Geometria plana compartilhada: evita centenas de esferas e geometrias.
    this.blobGeometry = this.createBlobGeometry();
    this.waterGeometry = new THREE.CircleGeometry(1, 16);
    this.foamGeometry = this.createFoamGeometry();

    this.dirtMaterials = DIRT_COLORS.map(
      (color) =>
        new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          toneMapped: false,
        })
    );

    this.waterMaterial = new THREE.MeshBasicMaterial({
      color: 0x55d7ff,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      toneMapped: false,
    });

    this.waterHighlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xe7fbff,
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      toneMapped: false,
    });

    this.foamMaterial = new THREE.MeshBasicMaterial({
      color: 0xeafaff,
      transparent: true,
      opacity: 0.84,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      toneMapped: false,
    });
  }

  createBlobGeometry() {
    const segments = 10;
    const positions = [0, 0, 0];
    const indices = [];

    // Pequenas variações fixas deixam a mancha orgânica, não circular perfeita.
    const variations = [0.82, 1.08, 0.94, 1.12, 0.78, 1.02, 1.15, 0.88, 1.05, 0.9];

    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const radius = variations[i];
      positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    }

    for (let i = 0; i < segments; i++) {
      const current = i + 1;
      const next = ((i + 1) % segments) + 1;
      indices.push(0, current, next);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  createFoamGeometry() {
    const geometry = new THREE.CircleGeometry(1, 18);
    const position = geometry.attributes.position;

    // Achata e deforma levemente a borda para parecer uma camada de espuma.
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const y = position.getY(i);
      if (i > 0) {
        const factor = 0.9 + 0.1 * Math.sin(i * 2.4);
        position.setXY(i, x * factor, y * factor);
      }
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  attachModel(model) {
    this.dispose();

    this.disposed = false;
    this.initializeResources();
    this.model = model;
    this.surfaces = new Map();
    this.dirtMarks = [];
    this.effects = new Set();
    this.totalDirt = 0;
    this.cleanedDirt = 0;

    model.updateMatrixWorld(true);
    const candidates = [];

    model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;

      const geometry = mesh.geometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();

      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);

      // Descarta peças sem área útil, como alguns objetos auxiliares do GLB.
      const area = size.x * size.y + size.x * size.z + size.y * size.z;
      if (size.length() > 0.001 && area > 0.002) {
        candidates.push({ mesh, size, area });
      }
    });

    candidates.sort((a, b) => b.area - a.area);

    for (const candidate of candidates.slice(0, MAX_SURFACES)) {
      this.surfaces.set(candidate.mesh.uuid, candidate);
    }

    if (!this.surfaces.size) {
      this.onMessage("Não foi possível preparar as superfícies do carro.");
      return false;
    }

    this.generateDirt();

    this.onProgress(this.getProgress());
    this.onMessage("Carro sujo! Comece aplicando água ou sabão.");

    console.info(
      `[SurfaceEffects] ${this.surfaces.size} peças preparadas; ${this.totalDirt} manchas.`
    );

    return true;
  }

  randomPointOnMesh(mesh) {
    const geometry = mesh.geometry;
    const positions = geometry.attributes.position;
    const index = geometry.index;
    const triangleCount = index
      ? Math.floor(index.count / 3)
      : Math.floor(positions.count / 3);

    if (!triangleCount) return null;

    for (let attempt = 0; attempt < 30; attempt++) {
      const triangle = Math.floor(Math.random() * triangleCount);
      const ia = index ? index.getX(triangle * 3) : triangle * 3;
      const ib = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
      const ic = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;

      const a = new THREE.Vector3().fromBufferAttribute(positions, ia);
      const b = new THREE.Vector3().fromBufferAttribute(positions, ib);
      const c = new THREE.Vector3().fromBufferAttribute(positions, ic);

      let r1 = Math.random();
      let r2 = Math.random();
      if (r1 + r2 > 1) {
        r1 = 1 - r1;
        r2 = 1 - r2;
      }

      const point = a.clone()
        .addScaledVector(b.clone().sub(a), r1)
        .addScaledVector(c.clone().sub(a), r2);

      const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      if (normal.lengthSq() < 0.1) continue;

      // Normais de triângulos degenerados não são úteis para orientar decalques.
      return { point, normal };
    }

    return null;
  }

  orientToNormal(object, normal) {
    object.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      normal.clone().normalize()
    );
  }

  toModelPosition(mesh, localPosition) {
    const worldPosition = mesh.localToWorld(localPosition.clone());
    // Converte para unidades aproximadas da cena, compensando a escala do GLB.
    return this.model.worldToLocal(worldPosition).multiplyScalar(this.model.scale.x);
  }

  createSurfaceMesh(mesh, geometry, material, position, normal, scale, renderOrder = 20) {
    const object = new THREE.Mesh(geometry, material);
    object.position.copy(position);
    this.orientToNormal(object, normal);
    object.scale.set(scale.x, scale.y, 1);
    object.renderOrder = renderOrder;
    object.frustumCulled = true;
    object.userData.surfaceEffect = true;
    mesh.add(object);
    return object;
  }

  generateDirt() {
    const candidates = [...this.surfaces.values()];
    const totalArea = candidates.reduce((sum, item) => sum + item.area, 0);

    for (const candidate of candidates) {
      // Distribui as manchas pela área estimada, evitando cinco manchas em cada
      // peça minúscula e concentrando-as nas partes maiores da lataria.
      const count = Math.max(
        candidate.area > 0.16 ? 1 : 0,
        Math.round((candidate.area / Math.max(totalArea, 0.001)) * TARGET_DIRT_MARKS)
      );

      for (let i = 0; i < count; i++) {
        const sample = this.randomPointOnMesh(candidate.mesh);
        if (!sample) continue;

        const position = sample.point.clone().addScaledVector(
          sample.normal,
          SURFACE_OFFSET
        );

        const sizeFactor = 0.035 + Math.random() * 0.028;
        const scale = new THREE.Vector2(
          sizeFactor * (0.75 + Math.random() * 0.8),
          sizeFactor * (0.55 + Math.random() * 0.55)
        );
        const materialIndex = Math.floor(Math.random() * this.dirtMaterials.length);
        const object = this.createSurfaceMesh(
          candidate.mesh,
          this.blobGeometry,
          this.dirtMaterials[materialIndex],
          position,
          sample.normal,
          scale,
          21
        );

        const mark = {
          mesh: candidate.mesh,
          object,
          position: position.clone(),
          modelPosition: this.toModelPosition(candidate.mesh, position),
          normal: sample.normal.clone(),
          wet: false,
          soapy: false,
          scrubbed: false,
          removed: false,
          rinsed: false,
          radius: Math.max(scale.x, scale.y) * 1.5,
        };

        this.dirtMarks.push(mark);
      }
    }

    this.totalDirt = this.dirtMarks.length;
  }

  getPreparationProgress(property) {
    const total = this.dirtMarks.length;
    const prepared = this.dirtMarks.reduce((count, mark) => count + (mark[property] ? 1 : 0), 0);
    return {
      total,
      prepared,
      percent: total ? Math.round((prepared / total) * 100) : 100,
      complete: total > 0 && prepared === total,
    };
  }

  beginRinse() {
    // Mantido como compatibilidade para futuras etapas; o enxágue agora é local.
    this.onMessage("Enxágue a região esfregada para retirar a espuma e a sujeira.");
  }

  rinseAt(hit) {
    if (!hit?.object?.isMesh || !hit.point || !hit.face || !this.model) return false;

    this.model.updateMatrixWorld(true);
    const modelPoint = this.model.worldToLocal(hit.point.clone()).multiplyScalar(this.model.scale.x);
    const radiusSquared = PREPARATION_RADIUS * PREPARATION_RADIUS;

    for (const mark of this.dirtMarks) {
      if (mark.removed || mark.modelPosition.distanceToSquared(modelPoint) > radiusSquared) continue;
      mark.rinsed = true;
      if (mark.scrubbed) this.removeDirtMark(mark);
      // O enxágue tira o sabão da região. Se a sujeira não foi esfregada,
      // ela permanece e o jogador pode repetir o processo localmente.
      mark.soapy = false;
    }

    for (const effect of [...this.effects]) {
      if (
        (effect.type === "soap" || effect.type === "scrub-foam") &&
        effect.modelPosition.distanceToSquared(modelPoint) <= radiusSquared
      ) {
        this.removeEffect(effect);
      }
    }

    return true;
  }

  getRinseProgress() {
    const total = this.dirtMarks.length;
    const rinsed = this.dirtMarks.reduce((count, mark) => count + (mark.rinsed ? 1 : 0), 0);
    return {
      total,
      rinsed,
      percent: total ? Math.round((rinsed / total) * 100) : 100,
      complete: total > 0 && rinsed === total,
    };
  }

  getFoamCount() {
    let count = 0;
    for (const effect of this.effects) {
      if (effect.type === "soap" || effect.type === "scrub-foam") count++;
    }
    return count;
  }

  applyTool(hit, tool) {
    if (this.disposed || !hit?.object?.isMesh || !hit.point || !hit.face) {
      return false;
    }

    const mesh = hit.object;
    if (!this.surfaces.has(mesh.uuid)) {
      this.onMessage("Passe a ferramenta diretamente sobre o carro.");
      return false;
    }

    this.model.updateMatrixWorld(true);
    const localPoint = mesh.worldToLocal(hit.point.clone());
    const normal = hit.face.normal.clone().normalize();
    const effectPosition = localPoint.clone().addScaledVector(normal, SURFACE_OFFSET);
    const modelPoint = this.model
      .worldToLocal(hit.point.clone())
      .multiplyScalar(this.model.scale.x);

    let changed = false;
    if (tool === "water") {
      this.applyWater(mesh, localPoint, effectPosition, normal, modelPoint);
      changed = true;
    } else if (tool === "soap") {
      changed = this.applySoap(mesh, localPoint, effectPosition, normal, modelPoint);
    } else if (tool === "sponge") {
      changed = this.applySponge(mesh, localPoint, normal, modelPoint);
    } else {
      return false;
    }

    this.onProgress(this.getProgress());
    return changed;
  }

  prepareNearbyDirt(modelPoint, property) {
    let changed = false;

    for (const mark of this.dirtMarks) {
      if (
        mark.removed ||
        mark.modelPosition.distanceToSquared(modelPoint) > PREPARATION_RADIUS * PREPARATION_RADIUS
      ) {
        continue;
      }

      mark[property] = true;
      changed = true;
    }

    return changed;
  }

  addEffect({ mesh, position, normal, modelPoint, type, scale, geometry, material }) {
    // Cada marca de água tem material próprio para desaparecer isoladamente.
    const effectMaterial =
      type === "water" || type === "water-highlight" ? material.clone() : material;
    const object = this.createSurfaceMesh(
      mesh,
      geometry,
      effectMaterial,
      position,
      normal,
      scale,
      22
    );

    const effect = {
      object,
      mesh,
      position: position.clone(),
      modelPosition: modelPoint.clone(),
      type,
      createdAt: Date.now(),
      initialOpacity: effectMaterial.opacity ?? 1,
      radius: Math.max(scale.x, scale.y) * 1.6,
    };

    this.effects.add(effect);

    // Limite de segurança para sessões longas, evitando crescimento ilimitado.
    while (this.effects.size > MAX_PERSISTENT_EFFECTS) {
      this.removeEffect(this.effects.values().next().value);
    }

    return effect;
  }

  applyWater(mesh, localPoint, effectPosition, normal, modelPoint) {
    this.addEffect({
      mesh,
      position: effectPosition,
      normal,
      modelPoint,
      type: "water",
      scale: new THREE.Vector2(0.16, 0.095),
      geometry: this.waterGeometry,
      material: this.waterMaterial,
    });

    this.addEffect({
      mesh,
      position: effectPosition.clone().addScaledVector(normal, 0.002),
      normal,
      modelPoint,
      type: "water-highlight",
      scale: new THREE.Vector2(0.065, 0.018),
      geometry: this.waterGeometry,
      material: this.waterHighlightMaterial,
    });

    this.prepareNearbyDirt(modelPoint, "wet");
    // Jogar água novamente enxágua somente a área atingida.
    this.rinseAt({ object: mesh, point: mesh.localToWorld(effectPosition.clone()), face: { normal } });
    this.onMessage("Área enxaguada. A água remove a sujeira que já foi esfregada.");
  }

  applySoap(mesh, localPoint, effectPosition, normal, modelPoint) {
    this.addEffect({
      mesh,
      position: effectPosition,
      normal,
      modelPoint,
      type: "soap",
      scale: new THREE.Vector2(0.19, 0.13),
      geometry: this.foamGeometry,
      material: this.foamMaterial,
    });

    this.prepareNearbyDirt(modelPoint, "soapy");
    this.onMessage("Espuma aplicada nesta região. Esfregue com a bucha e enxágue.");
    return true;
  }

  removeDirtMark(mark) {
    if (!mark || mark.removed) return false;

    mark.removed = true;
    mark.object.parent?.remove(mark.object);
    this.cleanedDirt++;
    return true;
  }

  update(now = Date.now()) {
    const WATER_HOLD_MS = 1800;
    const WATER_FADE_MS = 2200;

    for (const effect of [...this.effects]) {
      if (effect.type !== "water" && effect.type !== "water-highlight") continue;
      const elapsed = now - effect.createdAt;
      if (elapsed <= WATER_HOLD_MS) continue;

      const fade = Math.min(1, (elapsed - WATER_HOLD_MS) / WATER_FADE_MS);
      effect.object.material.opacity = effect.initialOpacity * (1 - fade);
      if (fade >= 1) this.removeEffect(effect);
    }
  }

  removeEffect(effect) {
    if (!effect) return;
    effect.object?.parent?.remove(effect.object);
    if (effect.type === "water" || effect.type === "water-highlight") {
      effect.object?.material?.dispose();
    }
    this.effects.delete(effect);
  }

  applySponge(mesh, localPoint, normal, modelPoint) {
    const radiusSquared = CLEANING_RADIUS * CLEANING_RADIUS;
    let scrubbedAny = false;

    for (const mark of this.dirtMarks) {
      if (
        mark.removed ||
        mark.modelPosition.distanceToSquared(modelPoint) > radiusSquared
      ) continue;

      mark.scrubbed = true;
      scrubbedAny = true;
    }

    if (!scrubbedAny) {
      this.onMessage("Molhe e aplique sabão nesta região antes de esfregar.");
      return false;
    }

    // A bucha espalha uma camada de espuma mais evidente, mas não remove
    // a sujeira: ela só sai quando a água enxágua esta mesma região.
    this.addEffect({
      mesh,
      position: localPoint.clone().addScaledVector(normal, SURFACE_OFFSET * 1.4),
      normal,
      modelPoint,
      type: "scrub-foam",
      scale: new THREE.Vector2(0.24, 0.17),
      geometry: this.foamGeometry,
      material: this.foamMaterial,
    });

    this.onMessage("Espuma esfregada! Jogue água aqui para remover a sujeira.");
    return true;
  }

  getProgress() {
    const total = this.totalDirt;
    const cleaned = this.cleanedDirt;

    return {
      percent: total ? Math.round((cleaned / total) * 100) : 0,
      cleaned,
      total,
      remaining: Math.max(0, total - cleaned),
    };
  }

  dispose() {
    for (const effect of this.effects || []) {
      effect.object?.parent?.remove(effect.object);
    }

    for (const mark of this.dirtMarks || []) {
      mark.object?.parent?.remove(mark.object);
    }

    this.effects?.clear();
    this.dirtMarks = [];
    this.surfaces?.clear();
    this.model = null;

    this.blobGeometry?.dispose();
    this.waterGeometry?.dispose();
    this.foamGeometry?.dispose();

    for (const material of this.dirtMaterials || []) material.dispose();
    this.waterMaterial?.dispose();
    this.waterHighlightMaterial?.dispose();
    this.foamMaterial?.dispose();

    this.disposed = true;
  }
}
