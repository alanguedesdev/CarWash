import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import SurfaceEffects from "./systems/SurfaceEffects.js";
import "./../style.css";

const root = document.querySelector("#game");

if (!root) {
  throw new Error('Elemento "#game" não encontrado no index.html.');
}

root.innerHTML = "";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#b6dce6");

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 1.8, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: "low-power",
  alpha: false,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.domElement.style.touchAction = "none";
root.appendChild(renderer.domElement);

// Iluminação
scene.add(new THREE.HemisphereLight("#fff4dc", "#62564a", 2));

const sun = new THREE.DirectionalLight("#fff0cf", 2.4);
sun.position.set(-4, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(512, 512);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
scene.add(sun);

const fillLight = new THREE.DirectionalLight("#a5dcff", 1.1);
fillLight.position.set(5, 4, -4);
scene.add(fillLight);

function mat(color, roughness = 0.85, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

const M = {
  yellow: mat("#d8a43f"),
  floor: mat("#9d9c83"),
  coral: mat("#e87c64"),
  dark: mat("#354b51"),
  steel: mat("#657579", 0.7, 0.2),
  wood: mat("#78583b"),
  white: mat("#e6e1ce"),
};

function addBox(name, size, pos, material, shadows = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    material
  );

  mesh.name = name;
  mesh.position.set(...pos);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  scene.add(mesh);

  return mesh;
}

// Garagem
addBox("Piso", [16, 0.2, 16], [0, -0.13, 0], M.floor);
addBox("Parede do fundo", [14, 5.3, 0.25], [0, 2.5, -4.3], M.yellow);
addBox("Parede esquerda", [0.25, 5.3, 12], [-7, 2.5, -0.1], M.yellow);
addBox("Parede direita", [0.25, 5.3, 12], [7, 2.5, -0.1], M.yellow);
addBox("Rodapé", [13.8, 0.23, 0.12], [0, 0.12, -4.12], M.dark);
addBox("Faixa coral", [13.8, 0.12, 0.12], [0, 1.6, -4.12], M.coral);

// Portão lateral
addBox("Moldura do portão", [0.16, 4.1, 4.2], [6.75, 2.05, 1.2], M.dark);
addBox("Portão", [0.1, 3.9, 3.95], [6.66, 2.05, 1.2], M.steel);

for (let y = 0.3; y <= 3.8; y += 0.32) {
  addBox(
    "Lâmina do portão",
    [0.07, 0.045, 3.9],
    [6.59, y, 1.2],
    M.dark,
    false
  );
}

// Prateleiras e produtos
addBox("Prateleira superior", [2.2, 0.12, 0.48], [-5.65, 2.15, -2.65], M.wood);
addBox("Prateleira inferior", [2.2, 0.12, 0.48], [-5.65, 1.05, -2.65], M.wood);

for (const x of [-6.55, -4.75]) {
  addBox("Suporte", [0.09, 2.2, 0.09], [x, 1.05, -2.65], M.dark);
}

function bottle(x, y, z, color) {
  addBox("Produto de limpeza", [0.19, 0.34, 0.15], [x, y, z], mat(color));
  addBox("Tampa", [0.08, 0.08, 0.08], [x, y + 0.21, z], M.white);
}

bottle(-6.35, 2.42, -2.65, "#477da4");
bottle(-5.8, 2.42, -2.65, "#6b9b59");
bottle(-5.25, 1.32, -2.65, "#bd5340");
bottle(-4.95, 1.32, -2.65, "#e0bd62");

// Plataforma circular
const platform = new THREE.Group();
scene.add(platform);

const turntable = new THREE.Mesh(
  new THREE.CylinderGeometry(3.15, 3.15, 0.16, 32),
  mat("#d6d7c8", 0.7)
);

turntable.position.y = 0.025;
turntable.receiveShadow = true;
turntable.castShadow = true;
platform.add(turntable);

const ring = new THREE.Mesh(
  new THREE.TorusGeometry(3.02, 0.045, 6, 32),
  M.coral
);

ring.rotation.x = Math.PI / 2;
ring.position.y = 0.115;
platform.add(ring);

for (let i = 0; i < 24; i++) {
  const angle = (i / 24) * Math.PI * 2;

  const marker = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.018, 0.18),
    M.steel
  );

  marker.position.set(
    Math.cos(angle) * 2.8,
    0.115,
    Math.sin(angle) * 2.8
  );

  marker.rotation.y = -angle;
  platform.add(marker);
}

// Grupo do veículo
const carPivot = new THREE.Group();
scene.add(carPivot);

const carMeshes = [];

let carModel = null;
let surfaceEffects = null;
let selectedTool = null;
let missionCompleted = false;
let rewardClaimed = false;
let dragging = false;
let lastX = 0;
let lastToolAction = 0;
let animationFrame = 0;
let disposed = false;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Interface
const hud = document.createElement("div");
hud.className = "game-hud";

hud.innerHTML = `
  <header class="game-brand">
    <strong>MEU LAVA-JATO</strong>
    <span>Todo grande negócio começa pequeno!</span>
  </header>

  <section class="mission-card">
    <div class="mission-person">
      <div class="customer-avatar">
        <div class="avatar-hair"></div>
        <div class="avatar-face"><i></i><i></i><span></span></div>
        <div class="avatar-body"></div>
      </div>

      <div class="customer-details">
        <small>CLIENTE · MISSÃO 01</small>
        <strong>Rafael Martins</strong>
        <span>Primeiro cliente</span>
      </div>
    </div>

    <div class="mission-car">
      <span class="car-symbol">🚘</span>
      <div>
        <strong>Nissan GT-R</strong>
        <span>Azul · Lavagem completa</span>
      </div>
    </div>

    <p class="customer-request">
      “Quero meu carro sem lama nem gordura e com a lataria brilhando!”
    </p>

    <div class="mission-goal">
      <span>OBJETIVO</span>
      <strong id="mission-goal-text">Remover sujeira e enxaguar</strong>
    </div>

    <div class="mission-reward">
      <span>RECOMPENSA</span>
      <strong>R$ 80,00</strong>
    </div>
  </section>

  <section class="wash-status">
    <div class="status-top">
      <span>LIMPEZA DO VEÍCULO</span>
      <strong id="progress-label">0%</strong>
    </div>

    <div class="progress-track">
      <div id="wash-progress"></div>
    </div>

    <div id="wash-step">Carregando o veículo...</div>
  </section>

  <div class="game-message" id="game-message">
    Sem ferramenta: arraste para girar o carro.
  </div>

  <nav class="tool-dock">
    <button class="tool-button" data-tool="water" type="button">
      <span class="tool-icon">🪣</span>
      <span class="tool-name">Água</span>
      <span class="tool-cost">Balde</span>
    </button>

    <button class="tool-button" data-tool="soap" type="button">
      <span class="tool-icon">🧴</span>
      <span class="tool-name">Sabão</span>
      <span class="tool-cost">Manual</span>
    </button>

    <button class="tool-button" data-tool="sponge" type="button">
      <span class="tool-icon">🧽</span>
      <span class="tool-name">Bucha</span>
      <span class="tool-cost">Básica</span>
    </button>

    <button class="tool-button locked" data-tool="brush" type="button">
      <span class="tool-icon">🪥</span>
      <span class="tool-name">Escova</span>
      <span class="tool-cost">Bloqueada</span>
    </button>

    <button class="tool-button locked" data-tool="pressure" type="button">
      <span class="tool-icon">🚿</span>
      <span class="tool-name">Pressão</span>
      <span class="tool-cost">Bloqueada</span>
    </button>
  </nav>

  <div class="game-footer">
    <span>BOX 01 · EQUIPAMENTOS SIMPLES</span>
    <button id="reset-car" type="button">⟳ Centralizar carro</button>
  </div>

  <div id="mission-complete" class="mission-complete" role="dialog" aria-modal="true" aria-labelledby="mission-complete-title" hidden>
    <div class="completion-card">
      <div class="completion-sparkle" aria-hidden="true">✨</div>
      <p class="completion-eyebrow">LAVA-JATO · MISSÃO 01</p>
      <h2 id="mission-complete-title">Carro impecável!</h2>
      <p class="completion-copy">Rafael vai receber o Nissan GT-R limpo, sem espuma e brilhando.</p>
      <div class="completion-rating"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div>
      <div class="completion-reward"><span>Recompensa da missão</span><strong>R$ 80,00</strong></div>
      <button id="claim-reward" type="button">Concluir missão</button>
      <p id="completion-note" class="completion-note">Lavagem completa finalizada.</p>
    </div>
  </div>
  <div id="tool-cursor" aria-hidden="true"></div>
  <div id="load-error" role="alert" style="display:none"></div>
`;

root.appendChild(hud);

const progressLabel = hud.querySelector("#progress-label");
const progressElement = hud.querySelector("#wash-progress");
const stepLabel = hud.querySelector("#wash-step");
const goalLabel = hud.querySelector("#mission-goal-text");
const message = hud.querySelector("#game-message");
const toolCursor = hud.querySelector("#tool-cursor");
const loadError = hud.querySelector("#load-error");
const completionPanel = hud.querySelector("#mission-complete");
const claimRewardButton = hud.querySelector("#claim-reward");
const completionNote = hud.querySelector("#completion-note");
const toolButtons = [...hud.querySelectorAll("[data-tool]")];

function setMessage(text) {
  message.textContent = text;
}

function showLoadError(text) {
  loadError.style.display = "block";
  loadError.textContent = text;
  stepLabel.textContent = "Não foi possível carregar o carro.";
  setMessage(text);
}

function updateMission(progress) {
  progressLabel.textContent = progress.percent + "%";
  progressElement.style.width = progress.percent + "%";

  if (missionCompleted) {
    stepLabel.textContent = "Missão concluída!";
    goalLabel.textContent = "Veículo limpo e enxaguado";
    return;
  }

  const foamCount = surfaceEffects ? surfaceEffects.getFoamCount() : 0;
  if (progress.remaining === 0 && foamCount === 0) {
    stepLabel.textContent = "Carro limpo e sem espuma";
    goalLabel.textContent = "Lavagem completa — pronto para entregar";
  } else {
    stepLabel.textContent = progress.remaining
      ? progress.remaining + " manchas restantes"
      : "Sujeira removida · retire a espuma";
    goalLabel.textContent = progress.remaining
      ? "Molhe, ensaboe, esfregue e enxágue cada região"
      : "Passe água nas áreas com espuma";
  }
}
function finishMission() {
  if (missionCompleted) return;
  missionCompleted = true;
  setTool(null);
  updateMission(surfaceEffects.getProgress());
  completionPanel.hidden = false;
  setMessage("Lavagem completa! Missão concluída.");
}

function setTool(tool) {
  selectedTool = tool;

  for (const button of toolButtons) {
    button.classList.toggle("selected", button.dataset.tool === tool);
  }

  const icons = {
    water: "💦",
    soap: "🫧",
    sponge: "🧽",
  };

  if (tool && icons[tool]) {
    toolCursor.textContent = icons[tool];
    toolCursor.style.display = "block";
    renderer.domElement.style.cursor = "none";

    const texts = {
      water: "Água: molhe e enxágue o veículo.",
      soap: "Sabão: aplique espuma na lataria.",
      sponge: "Bucha: esfregue a espuma; a água remove a sujeira.",
    };

    setMessage(texts[tool]);
  } else {
    toolCursor.style.display = "none";
    renderer.domElement.style.cursor = "grab";
    setMessage("Sem ferramenta: arraste para girar o carro.");
  }
}

function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();

  if (!rect.width || !rect.height) return;

  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
}

// Detecta a superfície real atingida no modelo.
function getCarHit(event) {
  if (!carModel || !surfaceEffects) return null;

  setPointer(event);

  const hits = raycaster.intersectObject(carModel, true);

  return hits.find(
    (hit) =>
      hit.object.isMesh &&
      hit.point &&
      hit.face &&
      surfaceEffects.surfaces.has(hit.object.uuid)
  ) || null;
}

function useTool(event) {
  if (!selectedTool || !surfaceEffects || missionCompleted) return;
  const hit = getCarHit(event);
  if (!hit) return;

  if (selectedTool === "water") {
    surfaceEffects.applyTool(hit, "water");
    const progress = surfaceEffects.getProgress();
    updateMission(progress);
    if (progress.remaining === 0 && surfaceEffects.getFoamCount() === 0) {
      finishMission();
    } else {
      setMessage(progress.remaining < progress.total
        ? "A água removeu a sujeira esfregada e o sabão desta região. Continue nas outras partes."
        : "Região molhada/enxaguada. Aplique sabão, esfregue com a bucha e enxágue para remover a sujeira.");
    }
    return;
  }

  if (selectedTool === "soap") {
    const applied = surfaceEffects.applyTool(hit, "soap");
    updateMission(surfaceEffects.getProgress());
    setMessage(applied
      ? "Espuma aplicada nesta região. Passe a bucha para esfregar e depois enxágue com água."
      : "Molhe essa região antes de aplicar o sabão.");
    return;
  }

  if (selectedTool === "sponge") {
    const scrubbed = surfaceEffects.applyTool(hit, "sponge");
    updateMission(surfaceEffects.getProgress());
    setMessage(scrubbed
      ? "Bucha em ação! A espuma ficou mais visível; jogue água nesta região para remover a sujeira."
      : "Molhe e ensaboe essa região antes de esfregar com a bucha.");
  }
}

// Carregamento do modelo
function loadCar() {
  stepLabel.textContent = "Carregando Nissan GT-R...";

  const loader = new GLTFLoader();

  loader.load(
  `${import.meta.env.BASE_URL}models/Nissan-gtr.glb`,

    (gltf) => {
      if (disposed) return;

      carModel = gltf.scene;
      carMeshes.length = 0;

      let shadowCount = 0;

      carModel.traverse((object) => {
        if (!object.isMesh) return;

        object.castShadow = shadowCount < 12;
        object.receiveShadow = false;
        shadowCount++;

        carMeshes.push(object);
      });

      const bounds = new THREE.Box3().setFromObject(carModel);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const maxDimension = Math.max(size.x, size.y, size.z);

      if (!Number.isFinite(maxDimension) || maxDimension <= 0) {
        showLoadError("O arquivo GLB não contém um modelo 3D válido.");
        return;
      }

      carModel.position.sub(center);
      carModel.scale.setScalar(5.5 / maxDimension);

      carPivot.add(carModel);
      carModel.updateMatrixWorld(true);

      const scaledBounds = new THREE.Box3().setFromObject(carModel);
      carModel.position.y += -scaledBounds.min.y + 0.2;
      carModel.updateMatrixWorld(true);

      surfaceEffects = new SurfaceEffects({
        onProgress: updateMission,
        onMessage: setMessage,
      });

      const attached = surfaceEffects.attachModel(carModel);

      if (!attached) {
        showLoadError(
          "O carro carregou, mas não foi possível preparar as texturas de limpeza."
        );
        return;
      }

      loadError.style.display = "none";
      updateMission(surfaceEffects.getProgress());
      setMessage("Selecione uma ferramenta para começar a lavagem.");

      console.info(
        `[CarWash] ${carMeshes.length} peças encontradas no modelo.`
      );
    },

    undefined,

    (error) => {
      console.error("Falha ao carregar /models/Nissan-gtr.glb:", error);

      showLoadError(
        "Não foi possível abrir Nissan-gtr.glb. Confira se o arquivo está em public/models/."
      );
    }
  );
}

loadCar();

// Interação com mouse e toque
window.addEventListener("wheel", (event) => {
  if (!carModel || event.deltaY === 0) return;
  // A rotação é independente da ferramenta selecionada e funciona mesmo
  // quando o cursor está sobre a interface do jogo.
  event.preventDefault();
  const rotation = Math.sign(event.deltaY) * 0.22;
  carPivot.rotation.y += rotation;
  platform.rotation.y = carPivot.rotation.y;
}, { passive: false, capture: true });

renderer.domElement.addEventListener("pointerdown", (event) => {
  if (!carModel) return;

  dragging = true;
  lastX = event.clientX;
  lastToolAction = 0;

  try {
    renderer.domElement.setPointerCapture(event.pointerId);
  } catch {
    // A captura pode não estar disponível em alguns dispositivos.
  }

  if (selectedTool) {
    useTool(event);
  }
});

renderer.domElement.addEventListener("pointermove", (event) => {
  if (selectedTool) {
    toolCursor.style.left = `${event.clientX}px`;
    toolCursor.style.top = `${event.clientY}px`;
  }

  if (!dragging || !carModel) return;

  const dx = event.clientX - lastX;

  if (!selectedTool) {
    carPivot.rotation.y += dx * 0.008;
    platform.rotation.y = carPivot.rotation.y;
  } else if (performance.now() - lastToolAction > 90) {
    useTool(event);
    lastToolAction = performance.now();
  }

  lastX = event.clientX;
});

function stopDragging() {
  dragging = false;
}

renderer.domElement.addEventListener("pointerup", stopDragging);
renderer.domElement.addEventListener("pointercancel", stopDragging);
renderer.domElement.addEventListener("lostpointercapture", stopDragging);

// Ferramentas
toolButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("locked")) {
      setMessage("Essa ferramenta será desbloqueada posteriormente.");
      return;
    }

    const tool = button.dataset.tool;
    setTool(selectedTool === tool ? null : tool);
  });
});

claimRewardButton.addEventListener("click", () => {
  if (rewardClaimed) return;
  rewardClaimed = true;
  claimRewardButton.disabled = true;
  claimRewardButton.textContent = "Recompensa recebida ✓";
  completionNote.textContent = "R$ 80,00 registrados como recompensa desta missão.";
});

// Centralizar o carro
hud.querySelector("#reset-car").addEventListener("click", () => {
  carPivot.rotation.set(0, 0, 0);
  platform.rotation.y = 0;
});

// Redimensionamento
function resize() {
  const width = root.clientWidth;
  const height = root.clientHeight;

  if (!width || !height) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(root);
window.addEventListener("resize", resize);
resize();

function animate() {
  if (disposed) return;

  animationFrame = requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

setTool(null);
animate();

// Limpeza de recursos ao sair da página
window.addEventListener("pagehide", () => {
  disposed = true;

  cancelAnimationFrame(animationFrame);
  resizeObserver.disconnect();
  window.removeEventListener("resize", resize);

  surfaceEffects?.dispose();
  renderer.dispose();

  for (const material of Object.values(M)) {
    material.dispose();
  }
});