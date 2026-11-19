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

    const addPanel = (name, size, position, color, z = 0) => {
      const mesh = addBox(root, name, size, position, color, { roughness: 0.9 });
      mesh.position.z += z;
      return mesh;
    };

    // Fachada de fundo: grandes blocos creme, amarelo-mel e azul acinzentado.
    addPanel("MenuFacadeMain", [16.5, 8.2, 0.55], [0, 2.45, -5.55], "#ead7ad");
    addPanel("MenuFacadeLeftWing", [5.0, 5.4, 0.62], [-5.6, 2.0, -4.95], "#f4e7ca");
    addPanel("MenuFacadeRightWing", [3.5, 5.4, 0.62], [6.45, 2.0, -4.95], "#f0dfb9");
    addPanel("MenuFacadeUpperCornice", [16.9, 0.68, 1.35], [0, 5.75, -4.9], "#f5e7c9");
    addPanel("MenuFacadeUpperShadow", [16.1, 0.2, 0.8], [0, 5.25, -4.48], "#566b70");
    addPanel("MenuFacadeTopDarkInset", [8.4, 0.22, 0.85], [1.6, 6.12, -4.48], "#52656a");
    addPanel("MenuFacadeLeftBlueBand", [5.2, 0.72, 0.2], [-5.5, 1.3, -4.58], "#60767a");

    // Moldura arquitetônica do box, com volumes sobrepostos como na referência.
    addPanel("MenuBayOuterHeader", [7.4, 0.68, 1.15], [2.0, 4.65, -4.12], "#e6d2a8");
    addPanel("MenuBayHeaderShadow", [6.85, 0.18, 0.78], [2.0, 4.18, -3.68], "#8d8a76");
    addPanel("MenuBayLeftColumn", [0.72, 4.65, 1.0], [-1.72, 2.05, -3.82], "#f5e8ca");
    addPanel("MenuBayLeftColumnInset", [0.28, 3.9, 0.22], [-1.2, 2.0, -3.25], "#b4a88b");
    addPanel("MenuBayRightColumn", [0.7, 4.75, 1.0], [5.72, 2.0, -3.8], "#f3e4c3");
    addPanel("MenuBayRightColumnBlueInset", [0.18, 3.55, 0.2], [5.3, 2.05, -3.18], "#637a7d");
    // Interior escuro e painéis de alvenaria no fundo do box.
    addPanel("MenuBayOpening", [6.55, 4.05, 0.18], [2.0, 2.05, -4.35], "#26343d");
    addPanel("MenuBayBackWall", [5.9, 3.52, 0.12], [2.0, 2.02, -4.22], "#38434a");
    for (let i = 0; i < 7; i++) {
      addPanel("MenuBayBackWallBlock", [0.78, 0.42, 0.06], [-0.72 + (i % 4) * 1.6, 0.72 + Math.floor(i / 4) * 2.35, -4.1], i % 2 ? "#3f4549" : "#514c47");
    }
    addPanel("MenuBayCeiling", [6.5, 0.22, 1.1], [2.0, 4.12, -3.65], "#d5c5a4");
    addPanel("MenuBayFloor", [7.6, 0.18, 5.2], [2.0, -0.02, -1.0], "#cbbd9e");

    // Piso externo e rampa facetada.
    addPanel("MenuGarageFloor", [18, 0.24, 15], [0, -0.2, 0.3], "#d6c7a7");
    addPanel("MenuGarageFrontApron", [9.2, 0.14, 4.4], [2.0, -0.04, 1.1], "#b6a98e");
    addPanel("MenuGarageApronHighlight", [7.8, 0.08, 3.5], [2.0, 0.04, 0.95], "#e8d8b6");
    addPanel("MenuGarageSideConsole", [1.45, 1.75, 1.05], [6.2, 0.7, 0.1], "#65777a");
    addPanel("MenuGarageSideConsoleTop", [1.72, 0.2, 1.2], [6.2, 1.67, 0.1], "#40575d");
    addPanel("MenuGarageSideConsoleScreen", [1.08, 0.64, 0.08], [6.2, 1.23, 0.67], "#87918a");

    // Carro compacto vermelho: silhueta de hatchback facetada, sem personagem.
    const car = new THREE.Group();
    car.name = "MenuReferenceRedHatchback";
    car.position.set(2.25, 0.0, -0.72);
    car.scale.setScalar(0.74);
    // Frente voltada para a câmera, em três-quartos como na referência.
    car.rotation.y = Math.PI - 0.36;

    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.48, 0.34);
    bodyShape.lineTo(-1.48, 0.86);
    bodyShape.lineTo(-0.98, 0.94);
    bodyShape.lineTo(-0.58, 1.48);
    bodyShape.lineTo(-0.18, 1.72);
    bodyShape.lineTo(0.64, 1.68);
    bodyShape.lineTo(1.08, 1.12);
    bodyShape.lineTo(1.48, 0.94);
    bodyShape.lineTo(1.48, 0.34);
    bodyShape.closePath();
    const bodyGeometry = new THREE.ExtrudeGeometry(bodyShape, { depth: 1.78, bevelEnabled: false, curveSegments: 1 });
    bodyGeometry.rotateY(-Math.PI / 2);
    bodyGeometry.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeometry, material("#c94c49", 0.88));
    body.name = "MenuCarFacetedRedBody";
    body.position.set(0.89, 0.12, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    car.add(body);

    // Capô e frente em planos triangulados para a leitura low-poly.
    addBox(car, "MenuCarHood", [1.64, 0.25, 0.86], [0, 1.12, 1.08], "#df5b53");
    addBox(car, "MenuCarHoodFacet", [1.5, 0.08, 0.62], [0, 1.27, 0.98], "#e97868");
    addBox(car, "MenuCarFrontGrille", [1.25, 0.34, 0.12], [0, 0.83, 1.54], "#493f3b");
    addBox(car, "MenuCarFrontBumper", [1.85, 0.2, 0.18], [0, 0.53, 1.56], "#e6d9bb");
    addBox(car, "MenuCarLowerGrille", [0.72, 0.13, 0.06], [0, 0.67, 1.65], "#27383c");
    for (const x of [-0.69, 0.69]) {
      addBox(car, "MenuCarHeadlight", [0.34, 0.18, 0.08], [x, 0.96, 1.62], "#f5e7bd");
      addBox(car, "MenuCarIndicator", [0.12, 0.09, 0.04], [x * 1.18, 0.78, 1.64], "#e6a95d");
    }

    // Cabine com para-brisa amplo e janelas laterais escuras.
    const cabinShape = new THREE.Shape();
    cabinShape.moveTo(-0.78, 1.34);
    cabinShape.lineTo(-0.42, 1.83);
    cabinShape.lineTo(0.38, 1.84);
    cabinShape.lineTo(0.83, 1.36);
    cabinShape.closePath();
    const cabinGeometry = new THREE.ExtrudeGeometry(cabinShape, { depth: 1.48, bevelEnabled: false, curveSegments: 1 });
    cabinGeometry.rotateY(-Math.PI / 2);
    cabinGeometry.computeVertexNormals();
    const cabin = new THREE.Mesh(cabinGeometry, material("#b94343", 0.84));
    cabin.name = "MenuCarCabin";
    cabin.position.set(0.74, 0.1, 0);
    cabin.castShadow = true;
    car.add(cabin);

    const windshield = addBox(car, "MenuCarWindshield", [1.22, 0.56, 0.055], [0, 1.72, 0.91], "#9aa9a7", { roughness: 0.38, metalness: 0.05 });
    windshield.rotation.x = -0.48;
    const rearWindow = addBox(car, "MenuCarRearWindow", [1.15, 0.42, 0.055], [0, 1.72, -1.0], "#52656b", { roughness: 0.4 });
    rearWindow.rotation.x = 0.42;
    for (const side of [-1, 1]) {
      const glass = addBox(car, "MenuCarSideGlass", [0.055, 0.43, 0.93], [side * 0.755, 1.63, -0.13], "#52666b", { roughness: 0.38, metalness: 0.04 });
      glass.rotation.x = -0.06;
      addBox(car, "MenuCarWindowPillar", [0.085, 0.56, 0.09], [side * 0.79, 1.64, -0.15], "#8f3938");
    }
    addBox(car, "MenuCarRoof", [1.28, 0.12, 0.9], [0, 1.99, -0.12], "#dc5a52");
    addBox(car, "MenuCarRearBumper", [1.82, 0.16, 0.18], [0, 0.55, -1.54], "#d5c8a9");

    for (const x of [-0.91, 0.91]) {
      for (const z of [-0.98, 0.98]) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.2, 6), material("#30383b", 0.96));
        tire.name = "MenuCarLowPolyTire";
        tire.rotation.z = Math.PI / 2;
        tire.position.set(x, 0.43, z);
        tire.castShadow = true;
        car.add(tire);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.215, 6), material("#b8b5a7", 0.6, 0.12));
        hub.rotation.z = Math.PI / 2;
        hub.position.set(x * 1.015, 0.43, z);
        car.add(hub);
      }
    }
    car.traverse((object) => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    root.add(car);

    // Luminárias e pequenos volumes de serviço no entorno do box.
    for (const x of [0.0, 2.0, 4.0]) {
      const lamp = addPanel("MenuGarageCeilingLight", [0.9, 0.09, 0.48], [x, 3.96, -3.32], "#fff0c8");
      lamp.material.emissive = new THREE.Color("#ffe3a5");
      lamp.material.emissiveIntensity = 0.48;
    }
    addPanel("MenuGarageRightShelf", [2.15, 0.16, 0.72], [6.1, 2.45, -1.1], "#e6d1a8");
    addPanel("MenuGarageRightCabinet", [1.0, 1.2, 0.72], [6.25, 1.75, -1.02], "#667b7d");
    addPanel("MenuGarageRightCabinetTop", [1.2, 0.16, 0.86], [6.25, 2.43, -1.02], "#465d63");

    const warmKey = new THREE.DirectionalLight("#fff0d1", 1.05);
    warmKey.position.set(-4, 7, 5);
    warmKey.castShadow = true;
    warmKey.shadow.mapSize.set(512, 512);
    root.add(warmKey);
    const ambient = new THREE.HemisphereLight("#fff3d6", "#58626a", 0.48);
    root.add(ambient);

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

    this.menuBackdrop.visible = false;
    // A recepção 3D é preservada para outras cenas; o diálogo usa cenário estático em CSS.
    // A recepção 3D antiga não deve ser reativada ao exibir o menu atual.
    this.reception.visible = ["menu", "reception"].includes(name);
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
