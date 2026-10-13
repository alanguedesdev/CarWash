
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export default class CarView {
  constructor(scene) {
    this.scene = scene;
    this.currentView = "side";
    this.destroyed = false;

    this.container = document.createElement("div");
    this.container.style.position = "absolute";
    this.container.style.left = "0";
    this.container.style.top = "0";
    this.container.style.width = "100%";
    this.container.style.height = "100%";
    this.container.style.pointerEvents = "none";
    this.container.style.overflow = "hidden";
    this.container.style.zIndex = "2";

    const gameElement = scene.game.canvas.parentElement;
    const computedPosition = getComputedStyle(gameElement).position;

    if (computedPosition === "static") {
      gameElement.style.position = "relative";
    }

    gameElement.appendChild(this.container);

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(gameElement.clientWidth, gameElement.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";

    this.camera = new THREE.PerspectiveCamera(35, 960 / 600, 0.1, 100);
    this.camera.position.set(5, 3, 7);
    this.camera.lookAt(0, 0.6, 0);

    this.world = new THREE.Scene();

    this.world.add(new THREE.HemisphereLight(0xffffff, 0x617080, 2));

    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(4, 8, 5);
    this.world.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xb9dcff, 1.5);
    fillLight.position.set(-5, 3, -4);
    this.world.add(fillLight);

    this.car = null;

    this.loader = new GLTFLoader();
    this.loader.load(
      "/models/nissan-gtr.glb",
      (gltf) => {
        if (this.destroyed) {
          gltf.scene.traverse((object) => {
            if (object.isMesh) {
              object.geometry.dispose();
            }
          });
          return;
        }

        this.car = gltf.scene;

        const box = new THREE.Box3().setFromObject(this.car);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        this.car.position.sub(center);

        const maxDimension = Math.max(size.x, size.y, size.z);
        const scale = 3.6 / maxDimension;

        this.car.scale.setScalar(scale);
        this.car.position.y += 0.65;

        this.car.traverse((object) => {
          if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });

        this.world.add(this.car);
        this.setView("side");
      },
      undefined,
      (error) => {
        console.error("Não foi possível carregar o Nissan GT-R:", error);
      }
    );

    this.resize = () => {
      if (this.destroyed) return;

      const width = gameElement.clientWidth;
      const height = gameElement.clientHeight;

      if (!width || !height) return;

      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    };

    window.addEventListener("resize", this.resize);

    this.scene.events.once("shutdown", () => this.destroy());
    this.scene.events.once("destroy", () => this.destroy());

    this.resize();
    this.render();
  }

  render() {
    if (this.destroyed) return;

    this.renderer.render(this.world, this.camera);
    this.frameId = requestAnimationFrame(() => this.render());
  }

  setView(view) {
    this.currentView = view;

    if (!this.car) return;

    const rotations = {
      side: 0,
      front: Math.PI / 2,
      rear: Math.PI,
    };

    this.car.rotation.y = rotations[view] ?? 0;
  }

  drawSideView() {
    this.setView("side");
  }

  drawFrontView() {
    this.setView("front");
  }

  drawRearView() {
    this.setView("rear");
  }

  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    window.removeEventListener("resize", this.resize);

    if (this.car) {
      this.car.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();

          if (Array.isArray(object.material)) {
            object.material.forEach((material) => material.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
    }

    this.renderer.dispose();
    this.container.remove();
  }
}
