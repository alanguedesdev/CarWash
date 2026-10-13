
import Phaser from "phaser";

export default class CleaningSystem {
  constructor(scene) {
    this.scene = scene;
    this.currentView = "side";
    this.dirtSpots = [];
    this.isCleaning = false;

    this.cleanedByView = {
      side: new Set(),
      front: new Set(),
      rear: new Set(),
    };

    this.positionsByView = {
      side: [
        [325, 370], [350, 405], [375, 385],
        [405, 365], [430, 405], [455, 385],
        [490, 370], [520, 400], [550, 375],
        [580, 400], [610, 375], [635, 405],
        [660, 390], [395, 420], [480, 415],
        [560, 415], [625, 420], [345, 385],
        [450, 370], [590, 385], [515, 415],
        [370, 400], [540, 390], [645, 370],
      ],

      front: [
        [370, 355], [405, 365], [440, 355],
        [480, 365], [520, 355], [555, 365],
        [585, 355], [390, 390], [425, 390],
        [455, 395], [490, 390], [525, 395],
        [560, 390], [385, 420], [420, 425],
        [455, 420], [500, 425], [535, 420],
        [575, 420],
      ],

      rear: [
        [375, 355], [410, 360], [445, 355],
        [480, 360], [515, 355], [550, 360],
        [585, 355], [405, 385], [440, 385],
        [480, 390], [520, 385], [555, 385],
        [375, 415], [410, 420], [445, 415],
        [480, 420], [515, 415], [550, 420],
        [585, 415],
      ],
    };

    this.totalDirt = this.positionsByView.side.length;
    this.cleanedDirt = 0;

    this.createProgressBar();
    this.setView("side");

    scene.input.on("pointerdown", this.startCleaning, this);
    scene.input.on("pointermove", this.clean, this);
    scene.input.on("pointerup", this.stopCleaning, this);
    scene.input.on("pointerupoutside", this.stopCleaning, this);
  }

  createProgressBar() {
    this.barBackground = this.scene.add.rectangle(
      480, 80, 260, 18, 0xffffff
    );

    this.barBackground
      .setStrokeStyle(2, 0x38516b)
      .setDepth(30);

    this.barFill = this.scene.add.rectangle(
      355, 80, 0, 10, 0x38bd78
    );

    this.barFill
      .setOrigin(0, 0.5)
      .setDepth(31);

    this.progressText = this.scene.add.text(
      480, 53, "Lateral: 0%",
      {
        fontFamily: "Trebuchet MS, Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#29445b",
        stroke: "#ffffff",
        strokeThickness: 3,
      }
    ).setOrigin(0.5).setDepth(32);
  }

  setView(view) {
    this.isCleaning = false;
    this.currentView = view;

    // Remove somente os desenhos antigos das manchas.
    this.dirtSpots.forEach((spot) => spot.destroy());
    this.dirtSpots = [];

    const positions = this.positionsByView[view];
    const cleaned = this.cleanedByView[view];

    positions.forEach(([x, y], index) => {
      // Não recria manchas já limpas nessa vista.
      if (cleaned.has(index)) return;

      const radius = 5 + (index % 3) * 2;
      const color = index % 2 === 0 ? 0x806044 : 0x9b7957;

      const spot = this.scene.add.circle(
        x, y, radius, color, 0.9
      );

      spot.setDepth(10);
      spot.setStrokeStyle(1, 0x62452f, 0.45);

      // Guardamos o índice para preservar a limpeza.
      spot.dirtIndex = index;

      this.dirtSpots.push(spot);
    });

    this.totalDirt = positions.length;
    this.cleanedDirt = cleaned.size;

    this.updateProgress();
  }

  startCleaning(pointer) {
    if (!this.isOnCar(pointer.x, pointer.y)) return;

    this.isCleaning = true;
    this.clean(pointer);
  }

  clean(pointer) {
    if (!this.isCleaning || !pointer.isDown) return;
    if (!this.isOnCar(pointer.x, pointer.y)) return;

    const brushRadius = 23;
    const cleaned = this.cleanedByView[this.currentView];

    this.dirtSpots = this.dirtSpots.filter((spot) => {
      if (!spot.active) return false;

      const distance = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        spot.x,
        spot.y
      );

      if (distance <= brushRadius + spot.radius) {
        cleaned.add(spot.dirtIndex);
        spot.destroy();
        return false;
      }

      return true;
    });

    this.cleanedDirt = cleaned.size;
    this.updateProgress();
  }

  isOnCar(x, y) {
    if (this.currentView === "side") {
      return x >= 290 && x <= 720 && y >= 285 && y <= 470;
    }

    // Frente e traseira.
    return x >= 325 && x <= 635 && y >= 320 && y <= 455;
  }

  updateProgress() {
    const percentage = this.totalDirt === 0
      ? 0
      : Math.round((this.cleanedDirt / this.totalDirt) * 100);

    this.barFill.width = 250 * (percentage / 100);

    const labels = {
      side: "Lateral",
      front: "Frontal",
      rear: "Traseira",
    };

    if (percentage === 100) {
      this.progressText.setText(`${labels[this.currentView]}: 100% — Limpo!`);
    } else {
      this.progressText.setText(`${labels[this.currentView]}: ${percentage}%`);
    }
  }

  stopCleaning() {
    this.isCleaning = false;
  }

  destroy() {
    this.scene.input.off("pointerdown", this.startCleaning, this);
    this.scene.input.off("pointermove", this.clean, this);
    this.scene.input.off("pointerup", this.stopCleaning, this);
    this.scene.input.off("pointerupoutside", this.stopCleaning, this);

    this.dirtSpots.forEach((spot) => spot.destroy());

    this.barBackground.destroy();
    this.barFill.destroy();
    this.progressText.destroy();
  }
}
