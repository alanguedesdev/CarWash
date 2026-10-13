import * as THREE from "three";

const MAX_SURFACES = 100;
const MARKS_PER_SURFACE = 5;

// Alcance da aplicação de água, sabão e bucha em coordenadas locais.
const PREPARATION_RADIUS = 0.55;
const CLEANING_RADIUS = 0.42;

export default class SurfaceEffects {
  constructor({ onProgress = () => {}, onMessage = () => {} } = {}) {
    this.onProgress = onProgress;
    this.onMessage = onMessage;

    this.surfaces = new Map();
    this.dirtMarks = [];
    this.effects = new Set();

    this.totalDirt = 0;
    this.cleanedDirt = 0;
    this.disposed = false;

    this.sphereGeometry = new THREE.SphereGeometry(1, 8, 6);
  }

  attachModel(model) {
    this.dispose();

    this.disposed = false;
    this.surfaces = new Map();
    this.dirtMarks = [];
    this.effects = new Set();
    this.totalDirt = 0;
    this.cleanedDirt = 0;

    const candidates = [];

    model.traverse((mesh) => {
      if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;

      const geometry = mesh.geometry;

      if (!geometry.boundingBox) {
        geometry.computeBoundingBox();
      }

      const size = new THREE.Vector3();
      geometry.boundingBox.getSize(size);

      if (size.length() > 0.001) {
        candidates.push({
          mesh,
          size,
          area: size.x * size.y + size.x * size.z + size.y * size.z,
        });
      }
    });

    candidates.sort((a, b) => b.area - a.area);

    for (const { mesh, size } of candidates.slice(0, MAX_SURFACES)) {
      this.surfaces.set(mesh.uuid, { mesh, size });
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

      return { point, normal };
    }

    return null;
  }

  createBall(mesh, position, color, radius, opacity = 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });

    const ball = new THREE.Mesh(this.sphereGeometry, material);

    ball.position.copy(position);
    ball.scale.setScalar(radius);
    ball.renderOrder = 20;
    ball.frustumCulled = false;

    mesh.add(ball);

    return ball;
  }

  createPersistentEffect(mesh, position, color, radius, opacity = 1, type = "water") {
    const ball = this.createBall(mesh, position, color, radius, opacity);

    const effect = {
      ball,
      mesh,
      position: position.clone(),
      type,
    };

    this.effects.add(effect);

    return effect;
  }

  removeEffect(effect) {
    if (!effect) return;

    if (effect.ball) {
      effect.ball.parent?.remove(effect.ball);
      effect.ball.material?.dispose();
    }

    this.effects.delete(effect);
  }

  generateDirt() {
    for (const { mesh, size } of this.surfaces.values()) {
      const radius = Math.max(
        0.012,
        Math.min(Math.max(size.x, size.y, size.z) * 0.025, 0.055)
      );

      for (let i = 0; i < MARKS_PER_SURFACE; i++) {
        const sample = this.randomPointOnMesh(mesh);

        if (!sample) continue;

        const offset = sample.normal.clone().multiplyScalar(radius * 0.65);
        const position = sample.point.clone().add(offset);

        const colors = [
          0x49301f,
          0x785139,
          0x9b7957,
          0xc2ad84,
        ];

        const color = colors[Math.floor(Math.random() * colors.length)];
        const markRadius = radius * (0.65 + Math.random() * 0.65);

        const object = this.createBall(
          mesh,
          position,
          color,
          markRadius,
          1
        );

        this.dirtMarks.push({
          mesh,
          object,
          position: position.clone(),
          type: i % 4 === 3
            ? "grease"
            : i % 3 === 0
              ? "dust"
              : "mud",
          wet: false,
          soapy: false,
          removed: false,
          radius: markRadius,
        });
      }
    }

    this.totalDirt = this.dirtMarks.length;
  }

  applyTool(hit, tool) {
    if (this.disposed || !hit?.object?.isMesh || !hit.point) {
      return false;
    }

    const mesh = hit.object;

    if (!this.surfaces.has(mesh.uuid)) {
      this.onMessage("Passe a ferramenta diretamente sobre o carro.");
      return false;
    }

    const localPoint = mesh.worldToLocal(hit.point.clone());

    const normal = hit.face?.normal
      ? hit.face.normal.clone()
      : new THREE.Vector3(0, 1, 0);

    const worldNormal = normal.transformDirection(mesh.matrixWorld);

    const localNormal = worldNormal
      .clone()
      .transformDirection(mesh.matrixWorld.clone().invert());

    const effectPosition = localPoint.clone().add(
      localNormal.clone().multiplyScalar(0.035)
    );

    if (tool === "water") {
      this.applyWater(mesh, localPoint, effectPosition);
    } else if (tool === "soap") {
      this.applySoap(mesh, localPoint, effectPosition);
    } else if (tool === "sponge") {
      this.applySponge(mesh, localPoint);
    } else {
      return false;
    }

    this.onProgress(this.getProgress());

    return true;
  }

  applyWater(mesh, localPoint, effectPosition) {
    // Água persistente: não desaparece por tempo.
    this.createPersistentEffect(
      mesh,
      effectPosition,
      0x55d7ff,
      0.085,
      0.55,
      "water"
    );

    this.createPersistentEffect(
      mesh,
      effectPosition.clone().add(new THREE.Vector3(0.05, 0.025, 0)),
      0xe7fbff,
      0.022,
      0.8,
      "water"
    );

    for (const mark of this.dirtMarks) {
      if (
        mark.mesh === mesh &&
        !mark.removed &&
        mark.position.distanceTo(localPoint) <= PREPARATION_RADIUS
      ) {
        mark.wet = true;
      }
    }

    this.onMessage("Carro molhado! Agora aplique sabão ou passe a bucha.");
  }

  applySoap(mesh, localPoint, effectPosition) {
    // Espuma persistente até a bucha limpar essa região.
    const bubbles = [
      [-0.08, 0.00, 0.00],
      [0.04, 0.05, 0.015],
      [0.09, -0.025, 0.01],
      [-0.02, -0.06, 0.02],
      [0.12, 0.04, -0.01],
      [-0.11, 0.05, 0.015],
      [0.00, 0.09, -0.015],
    ];

    for (let i = 0; i < bubbles.length; i++) {
      const [dx, dy, dz] = bubbles[i];

      const position = effectPosition.clone().add(
        new THREE.Vector3(dx, dy, dz)
      );

      const radius = 0.025 + Math.random() * 0.025;
      const color = i % 3 === 0 ? 0xffffff : 0xdff6ff;

      this.createPersistentEffect(
        mesh,
        position,
        color,
        radius,
        0.92,
        "soap"
      );
    }

    for (const mark of this.dirtMarks) {
      if (
        mark.mesh === mesh &&
        !mark.removed &&
        mark.position.distanceTo(localPoint) <= PREPARATION_RADIUS
      ) {
        mark.soapy = true;
      }
    }

    this.onMessage("Carro ensaboado! Passe a bucha para remover a sujeira.");
  }

  applySponge(mesh, localPoint) {
    let removedAny = false;

    // Remove manchas preparadas dentro do alcance da bucha.
    for (const mark of this.dirtMarks) {
      if (
        mark.mesh !== mesh ||
        mark.removed ||
        mark.position.distanceTo(localPoint) > CLEANING_RADIUS
      ) {
        continue;
      }

      const canClean =
        mark.wet ||
        mark.soapy;

      if (!canClean) continue;

      mark.removed = true;
      mark.object.parent?.remove(mark.object);
      mark.object.material?.dispose();

      this.cleanedDirt++;
      removedAny = true;
    }

    // Limpa a espuma e os efeitos de água da região esfregada.
    // O estado das manchas já foi verificado acima.
    for (const effect of [...this.effects]) {
      if (
        effect.mesh === mesh &&
        effect.position.distanceTo(localPoint) <= CLEANING_RADIUS
      ) {
        this.removeEffect(effect);
      }
    }

    if (removedAny) {
      this.onMessage("Sujeira removida! Continue esfregando o carro.");
    } else {
      const nearby = this.dirtMarks.some(
        (mark) =>
          mark.mesh === mesh &&
          !mark.removed &&
          mark.position.distanceTo(localPoint) <= CLEANING_RADIUS
      );

      this.onMessage(
        nearby
          ? "Aplique água ou sabão nessa região antes de esfregar."
          : "Esfregue mais perto das manchas para removê-las."
      );
    }
  }

  getProgress() {
    const total = this.totalDirt;
    const cleaned = this.cleanedDirt;

    return {
      percent: total
        ? Math.round((cleaned / total) * 100)
        : 0,
      cleaned,
      total,
      remaining: Math.max(0, total - cleaned),
    };
  }

  dispose() {
    for (const effect of [...(this.effects || [])]) {
      this.removeEffect(effect);
    }

    for (const mark of this.dirtMarks || []) {
      if (mark.object) {
        mark.object.parent?.remove(mark.object);
        mark.object.material?.dispose();
      }
    }

    this.effects?.clear();
    this.dirtMarks = [];
    this.surfaces?.clear();

    this.sphereGeometry?.dispose();

    this.disposed = true;
  }
}