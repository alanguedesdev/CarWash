import * as THREE from "three";

function material(color, roughness = 0.82, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function addBox(parent, name, size, position, color, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    material(color, options.roughness ?? 0.82, options.metalness ?? 0)
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = options.castShadow ?? true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCylinder(parent, name, radius, height, position, color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 16),
    material(color)
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export default class SceneManager {
  constructor(scene, washEnvironment) {
    this.scene = scene;
    this.washEnvironment = washEnvironment;
    this.current = null;
    this.backgrounds = {
      reception: new THREE.Color("#ffd86b"),
      wash: new THREE.Color("#ffe08a"),
      delivery: new THREE.Color("#ffe3a0"),
    };

    this.reception = this.createReception();
    this.menuBackdrop = this.createMenuBackdrop();
    this.customer = this.createCustomer();
    this.reception.add(this.customer);
    this.delivery = this.createDelivery();
    this.scene.add(this.reception, this.delivery, this.menuBackdrop);
    this.show("reception");
  }

  createMenuBackdrop() {
    const root = new THREE.Group();
    root.name = "MainMenuShowcase";

    // Fachada mostarda e moldura azul-petróleo: volumes grandes e arestas duras.
    addBox(root, "MenuGarageWall", [15, 7.2, 0.48], [0, 2.65, -4.9], "#e9c978");
    addBox(root, "MenuGarageTopBeam", [15.5, 0.62, 1.15], [0, 5.85, -4.35], "#f0dba8");
    addBox(root, "MenuGarageLeftPier", [4.1, 4.35, 0.72], [-4.75, 2.05, -4.42], "#f4e5c4");
    addBox(root, "MenuGarageRightPier", [3.25, 4.35, 0.72], [5.85, 2.05, -4.42], "#f1dfb6");
    addBox(root, "MenuGarageHeader", [6.4, 0.58, 0.72], [1.0, 4.85, -4.28], "#d8b45f");
    addBox(root, "MenuGarageHeaderInset", [5.8, 0.16, 0.12], [1.0, 4.48, -3.88], "#47616a");
    // Box de lavagem escuro, com painéis em perspectiva de profundidade.
    addBox(root, "MenuBayShadow", [6.15, 3.95, 0.22], [1.0, 2.35, -4.48], "#253b43");
    addBox(root, "MenuBayBackWall", [5.55, 3.45, 0.16], [1.0, 2.35, -4.28], "#344b53");
    for (let i = 0; i < 5; i++) {
      addBox(root, "MenuBayWallPanel", [0.08, 3.2, 0.05], [-1.25 + i * 1.1, 2.35, -4.16], "#435b61", { castShadow: false });
    }
    addBox(root, "MenuBayLeftTrim", [0.34, 4.2, 0.62], [-2.25, 2.2, -4.0], "#d4b36f");
    addBox(root, "MenuBayRightTrim", [0.34, 4.2, 0.62], [4.25, 2.2, -4.0], "#d4b36f");
    addBox(root, "MenuGarageFloor", [17, 0.22, 12], [0, -0.16, 0], "#d9c18d");
    addBox(root, "MenuGarageRamp", [8.8, 0.12, 5.4], [1.0, -0.015, 0.1], "#b8a77d");
    addBox(root, "MenuGarageSideWall", [0.45, 3.1, 7], [6.9, 1.35, -1.1], "#e4c77e");
    addBox(root, "MenuGarageSidePanel", [0.12, 2.15, 2.8], [6.63, 1.9, -1.25], "#60777a");
    // Faixas e luminárias geométricas.
    for (const x of [-1.0, 1.0, 3.0]) {
      const lamp = addBox(root, "MenuGarageLight", [0.72, 0.09, 0.42], [x, 4.18, -3.72], "#fff0c6", { castShadow: false });
      lamp.material.emissive = new THREE.Color("#ffe5a4");
      lamp.material.emissiveIntensity = 0.65;
    }
    addBox(root, "MenuGarageYellowStripe", [15, 0.24, 0.12], [0, 0.45, -4.55], "#d9a943", { castShadow: false });

    // Carro compacto vermelho low-poly, inspirado no veículo da imagem de referência.
    const car = new THREE.Group();
    car.name = "MenuRedCompactCar";
    car.position.set(1.05, 0.02, -0.15);
    car.rotation.y = -0.22;
    const red = "#c94e4b", redLight = "#e66b61", redDark = "#8f3839";
    addBox(car, "CarUnderbody", [1.78, 0.34, 2.75], [0, 0.63, 0], "#39464b");
    addBox(car, "CarLowerBody", [1.94, 0.62, 2.85], [0, 0.91, 0], red);
    addBox(car, "CarHood", [1.86, 0.35, 0.92], [0, 1.24, 0.91], redLight);
    addBox(car, "CarFrontFace", [1.78, 0.42, 0.14], [0, 0.91, 1.47], redDark);
    addBox(car, "CarRoofCabin", [1.43, 0.76, 1.42], [0, 1.66, -0.18], red);
    addBox(car, "CarRoofTop", [1.3, 0.13, 1.18], [0, 2.08, -0.2], redLight);
    // Para-brisa e vidro traseiro inclinados.
    const windshield = addBox(car, "CarWindshield", [1.24, 0.57, 0.055], [0, 1.67, 0.57], "#a9b8b5", { metalness: 0.08, roughness: 0.34 });
    windshield.rotation.x = -0.34;
    const rearGlass = addBox(car, "CarRearGlass", [1.18, 0.52, 0.055], [0, 1.66, -0.91], "#70868a", { metalness: 0.08, roughness: 0.38 });
    rearGlass.rotation.x = 0.34;
    for (const side of [-1, 1]) {
      const sideGlass = addBox(car, "CarSideWindow", [0.055, 0.48, 1.0], [side * 0.73, 1.68, -0.18], "#849b9d", { metalness: 0.08, roughness: 0.35 });
      sideGlass.rotation.x = -0.02;
      addBox(car, "CarWindowDivider", [0.075, 0.55, 0.08], [side * 0.765, 1.68, -0.2], redDark);
    }
    addBox(car, "CarFrontBumper", [1.9, 0.2, 0.22], [0, 0.58, 1.48], "#e5d8b7");
    addBox(car, "CarRearBumper", [1.88, 0.18, 0.2], [0, 0.58, -1.47], "#d7c9a8");
    for (const x of [-0.72, 0.72]) {
      addBox(car, "CarHeadlight", [0.38, 0.2, 0.08], [x, 1.02, 1.54], "#fff0c4", { castShadow: false });
      addBox(car, "CarTailLight", [0.34, 0.18, 0.08], [x, 1.02, -1.49], "#f18a69");
    }
    for (const x of [-0.98, 0.98]) {
      for (const z of [-0.92, 0.92]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.39, 0.39, 0.2, 6), material("#26363d", 0.92));
        wheel.name = "CarLowPolyWheel";
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.48, z);
        wheel.castShadow = true;
        car.add(wheel);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.215, 6), material("#b8b6a6", 0.55, 0.15));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(x * 1.015, 0.48, z);
        car.add(hub);
      }
    }
    root.add(car);

    // Detalhes laterais da oficina para dar profundidade sem poluir a composição.
    addBox(root, "MenuToolCabinet", [0.9, 1.45, 0.65], [5.65, 0.78, 0.65], "#60777a");
    addBox(root, "MenuToolCabinetTop", [1.08, 0.16, 0.78], [5.65, 1.56, 0.65], "#344e57");
    addBox(root, "MenuToolCabinetDrawer", [0.72, 0.38, 0.06], [5.65, 1.13, 0.99], "#8b9a91");
    root.visible = false;
    return root;
  }

  createCustomer(){const g=new THREE.Group();g.name="ReceptionCustomer";g.position.set(-3.25,0,.35);const add=(geo,color,pos)=>{const o=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.9}));o.position.set(...pos);o.castShadow=true;g.add(o);return o;};add(new THREE.CapsuleGeometry(.34,.72,4,8),"#477b91",[0,1.18,0]);add(new THREE.SphereGeometry(.31,16,12),"#c98963",[0,2.02,0]);add(new THREE.SphereGeometry(.32,16,10,0,Math.PI*2,0,Math.PI*.48),"#49352d",[0,2.12,-.015]);add(new THREE.CapsuleGeometry(.105,.58,3,6),"#354c5b",[-.16,.43,0]);add(new THREE.CapsuleGeometry(.105,.58,3,6),"#354c5b",[.16,.43,0]);for(const side of [-1,1]){const arm=add(new THREE.CapsuleGeometry(.09,.48,3,6),"#477b91",[side*.39,1.25,0]);arm.rotation.z=side*-.18;add(new THREE.SphereGeometry(.1,10,8),"#c98963",[side*.43,.88,.02]);add(new THREE.SphereGeometry(.025,8,8),"#293b40",[side*.11,2.04,.285]);}return g;}

  createReception() {
    const root = new THREE.Group();
    root.name = "ReceptionEnvironment";

    addBox(root, "ReceptionGround", [18, 0.18, 18], [0, -0.22, 0], "#f2c85d");
    addBox(root, "ReceptionFacade", [13, 4.8, 0.35], [0, 2.15, -5.2], "#ffcf4d");
    addBox(root, "ReceptionRoof", [13.8, 0.42, 1.3], [0, 4.55, -4.9], "#f15e45");
    addBox(root, "ReceptionSign", [5.4, 0.85, 0.16], [0, 3.65, -4.94], "#174e5b");
    addBox(root, "ReceptionSignAccent", [4.8, 0.08, 0.08], [0, 3.28, -4.82], "#f3cc70", { castShadow: false });

    // Fachada com vitrines laterais e entrada central.
    addBox(root, "LeftWindowFrame", [2.5, 2.2, 0.12], [-4.1, 1.85, -4.94], "#174e5b");
    addBox(root, "LeftWindowGlass", [2.22, 1.92, 0.08], [-4.1, 1.85, -4.84], "#9dcbd1", { metalness: 0.12 });
    addBox(root, "RightWindowFrame", [2.5, 2.2, 0.12], [4.1, 1.85, -4.94], "#174e5b");
    addBox(root, "RightWindowGlass", [2.22, 1.92, 0.08], [4.1, 1.85, -4.84], "#9dcbd1", { metalness: 0.12 });
    addBox(root, "EntranceDoor", [1.6, 2.7, 0.14], [0, 1.35, -4.91], "#ef7652");
    addBox(root, "EntranceDoorGlass", [1.25, 2.1, 0.06], [0, 1.45, -4.8], "#b7dfe0", { metalness: 0.1 });

    // Marquise coral e pilares arredondados simulados com cilindros.
    addBox(root, "ReceptionCanopy", [8.4, 0.28, 1.8], [0, 3.05, -3.9], "#f15e45");
    for (const x of [-3.8, 3.8]) {
      addCylinder(root, "CanopyPost", 0.16, 2.9, [x, 1.55, -3.15], "#fff0c2");
    }

    // Caminho de entrada e jardineiras.
    addBox(root, "Driveway", [10, 0.04, 7], [0, -0.105, 1.3], "#9fd7d2", { castShadow: false });
    for (const x of [-5.4, 5.4]) {
      addBox(root, "Planter", [1.25, 0.48, 1.15], [x, 0.08, -1.7], "#f16b4f");
      addCylinder(root, "PlanterPlant", 0.48, 1.1, [x, 0.82, -1.7], "#5cae68");
      addCylinder(root, "PlanterTop", 0.32, 0.72, [x + 0.16, 1.15, -1.76], "#7dc65f");
    }

    for (const x of [-2.6, 2.6]) {
      addBox(root, "ParkingStripe", [0.12, 0.025, 3.6], [x, -0.08, 1.2], "#fff7d8", { castShadow: false });
    }


    // Identidade visual de lava-jato: letreiro, faixa de cores e luminárias.
    addBox(root, "ReceptionSignPlate", [4.7, 0.12, 0.08], [0, 3.28, -4.82], "#f5c94e", { castShadow: false });
    addBox(root, "YellowGarageStripe", [13.1, 0.28, 0.08], [0, 0.48, -4.78], "#f7b92f", { castShadow: false });
    for (const x of [-2.5, 0, 2.5]) {
      const lamp = addBox(root, "GarageLamp", [0.75, 0.07, 0.35], [x, 2.84, -3.45], "#fff5ce", { castShadow: false });
      lamp.material.emissive = new THREE.Color("#ffe18a");
      lamp.material.emissiveIntensity = 0.55;
    }
    // Painéis coloridos e suportes de mangueira reforçam a leitura de oficina.
    addBox(root, "ToolWallPanel", [1.2, 1.25, 0.1], [-5.5, 3.15, -4.7], "#16899a");
    addBox(root, "ToolWallPanelAccent", [0.18, 0.85, 0.08], [-5.5, 3.15, -4.61], "#ffdf63", { castShadow: false });
    addBox(root, "ToolWallPanelRight", [1.2, 1.25, 0.1], [5.5, 3.15, -4.7], "#16899a");
    addBox(root, "ToolWallPanelRightAccent", [0.18, 0.85, 0.08], [5.5, 3.15, -4.61], "#ffdf63", { castShadow: false });
    addCylinder(root, "HoseReelLeft", 0.32, 0.16, [-5.5, 2.35, -4.48], "#f15e45").rotation.x = Math.PI / 2;
    addCylinder(root, "HoseReelRight", 0.32, 0.16, [5.5, 2.35, -4.48], "#f15e45").rotation.x = Math.PI / 2;

    return root;
  }

  createDelivery() {
    const root = new THREE.Group();
    root.name = "DeliveryEnvironment";

    addBox(root, "DeliveryFloor", [18, 0.2, 18], [0, -0.22, 0], "#aeb9b8");
    addBox(root, "DeliveryBackWall", [14, 6, 0.3], [0, 2.7, -5.2], "#d9e5df");
    addBox(root, "DeliveryAccentWall", [14, 0.65, 0.18], [0, 4.7, -4.98], "#e98768");
    addBox(root, "DeliveryHeader", [5.8, 0.9, 0.18], [0, 3.85, -4.98], "#365865");
    addBox(root, "DeliveryHeaderLine", [4.8, 0.07, 0.08], [0, 3.48, -4.85], "#f4ce72", { castShadow: false });

    // Molduras e painéis laterais dão identidade de showroom sem trocar o carro.
    for (const x of [-5.9, 5.9]) {
      addBox(root, "DeliveryColumn", [0.55, 5.3, 0.55], [x, 2.45, -3.5], "#f2d9a5");
      addBox(root, "DeliveryColumnBase", [0.9, 0.3, 0.9], [x, 0.03, -3.5], "#e98768");
      addBox(root, "DeliveryLightPanel", [0.12, 3.6, 2.5], [x * 0.72, 2.5, -4.95], "#b5d9d8", { metalness: 0.08 });
    }

    // Pórtico superior com luminárias geométricas.
    addBox(root, "ShowroomBeam", [10.8, 0.28, 1.15], [0, 5.1, -2.6], "#526b70");
    for (const x of [-3.4, 0, 3.4]) {
      const light = addBox(root, "ShowroomLight", [1.5, 0.08, 0.42], [x, 4.88, -2.55], "#fff0c3", { castShadow: false });
      light.material.emissive = new THREE.Color("#f5d995");
      light.material.emissiveIntensity = 0.28;
    }

    // Plataforma de apresentação discreta.
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.45, 3.45, 0.12, 48),
      material("#d9ded3", 0.42, 0.08)
    );
    platform.name = "DeliveryDisplayPlatform";
    platform.position.set(0, -0.06, 0);
    platform.receiveShadow = true;
    root.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.28, 0.045, 8, 48),
      material("#e98768", 0.45, 0.1)
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.015;
    root.add(ring);

    for (const x of [-6.2, 6.2]) {
      addBox(root, "DeliveryBench", [1.5, 0.35, 0.65], [x, 0.02, 1.6], "#e8c98d");
      addBox(root, "DeliveryBenchLeg", [0.12, 0.65, 0.12], [x - 0.5, -0.28, 1.6], "#526b70");
      addBox(root, "DeliveryBenchLeg", [0.12, 0.65, 0.12], [x + 0.5, -0.28, 1.6], "#526b70");
    }

    return root;
  }

  show(name) {
    if (!["menu", "dialogue", "reception", "wash", "delivery"].includes(name)) {
      throw new Error(`Cena desconhecida: ${name}`);
    }

    this.menuBackdrop.visible = name === "menu";
    this.reception.visible = ["dialogue","reception"].includes(name);
    this.customer.visible = false;
    this.washEnvironment.visible = name === "wash";
    this.delivery.visible = name === "delivery";
    const backgroundKey=name==="menu"||name==="dialogue"?"reception":name;
    this.scene.background=this.backgrounds[backgroundKey].clone();
    this.current = name;
  }

  dispose() {
    for (const root of [this.reception, this.delivery, this.menuBackdrop]) {
      root.traverse((object) => {
        if (!object.isMesh) return;
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach((item) => item.dispose());
        } else {
          object.material.dispose();
        }
      });
      this.scene.remove(root);
    }
  }
}
