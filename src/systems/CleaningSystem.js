export default class CleaningSystem {
  constructor(scene) {
    this.scene = scene;
    this.dirtSpots = [];
    this.isCleaning = false;

    this.totalDirt = 0;
    this.cleanedDirt = 0;

    this.createDirt();
    this.createProgressBar();

    scene.input.on("pointerdown", this.startCleaning, this);
    scene.input.on("pointermove", this.clean, this);
    scene.input.on("pointerup", this.stopCleaning, this);
    scene.input.on("pointerupoutside", this.stopCleaning, this);
  }

  createDirt() {
    const positions = [
      [325, 370], [350, 405], [375, 385],
      [405, 365], [430, 405], [455, 385],
      [490, 370], [520, 400], [550, 375],
      [580, 400], [610, 375], [635, 405],
      [660, 390], [395, 420], [480, 415],
      [560, 415], [625, 420], [345, 385],
      [450, 370], [590, 385], [515, 415],
      [370, 400], [540, 390], [645, 370]
    ];

    positions.forEach(([x, y], index) => {
      const radius = 5 + (index % 3) * 2;

      const spot = this.scene.add.circle(
        x,
        y,
        radius,
        index % 2 === 0 ? 0x806044 : 0x9b7957,
        0.9
      );

      spot.setDepth(10);
      this.dirtSpots.push(spot);
    });

    this.totalDirt = this.dirtSpots.length;
  }

  createProgressBar() {
    this.barBackground = this.scene.add.rectangle(
      480, 80, 260, 18, 0xffffff
    );

    this.barBackground.setStrokeStyle(2, 0x38516b);

    this.barFill = this.scene.add.rectangle(
      352, 80, 0, 10, 0x38bd78
    );

    this.barFill.setOrigin(0, 0.5);

    this.progressText = this.scene.add.text(
      480, 53, "Limpeza: 0%",
      {
        fontFamily: "Trebuchet MS, Arial, sans-serif",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#29445b",
        stroke: "#ffffff",
        strokeThickness: 3
      }
    ).setOrigin(0.5);
  }

  startCleaning(pointer) {
    if (this.isOnCar(pointer.x, pointer.y)) {
      this.isCleaning = true;
      this.clean(pointer);
    }
  }

  clean(pointer) {
    if (!this.isCleaning || !pointer.isDown) return;

    if (!this.isOnCar(pointer.x, pointer.y)) return;

    const brushRadius = 23;

    this.dirtSpots = this.dirtSpots.filter((spot) => {
      if (!spot.active) return false;

      const distance = Phaser.Math.Distance.Between(
        pointer.x, pointer.y, spot.x, spot.y
      );

      if (distance < brushRadius + spot.radius) {
        spot.destroy();
        this.cleanedDirt++;
        return false;
      }

      return true;
    });

    this.updateProgress();
  }

  isOnCar(x, y) {
    return x >= 300 && x <= 710 && y >= 350 && y <= 440;
  }

  updateProgress() {
    const percentage = Math.round(
      (this.cleanedDirt / this.totalDirt) * 100
    );

    this.barFill.width = 250 * (percentage / 100);
    this.progressText.setText(`Limpeza: ${percentage}%`);

    if (percentage === 100) {
      this.progressText.setText("Carro limpo! Lavagem concluída!");
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
  }
}