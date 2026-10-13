
export default class CarView {
  constructor(scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
  }

  drawSideView() {
    const graphics = this.graphics;

    graphics.clear();

    // Sombra do carro.
    graphics.fillStyle(0x35536a, 0.18);
    graphics.fillEllipse(485, 458, 410, 45);

    // Carroceria.
    graphics.fillStyle(0xff806b, 1);
    graphics.fillRoundedRect(300, 350, 375, 90, 28);

    // Frente inclinada.
    graphics.fillTriangle(
      620, 350,
      710, 390,
      675, 425
    );

    // Para-choque.
    graphics.fillStyle(0xe85f58, 1);
    graphics.fillRoundedRect(640, 408, 57, 22, 8);

    // Janelas.
    graphics.fillStyle(0xb9efff, 1);
    graphics.fillRoundedRect(390, 295, 165, 75, 18);

    graphics.fillTriangle(
      555, 300,
      615, 350,
      555, 350
    );

    // Divisória das janelas.
    graphics.lineStyle(6, 0xff806b, 1);
    graphics.lineBetween(478, 301, 478, 366);

    // Farol.
    graphics.fillStyle(0xfff5b0, 1);
    graphics.fillRoundedRect(680, 385, 22, 16, 6);

    // Rodas.
    graphics.fillStyle(0x34465d, 1);
    graphics.fillCircle(385, 430, 39);
    graphics.fillCircle(610, 430, 39);

    graphics.fillStyle(0xf2f5fa, 1);
    graphics.fillCircle(385, 430, 21);
    graphics.fillCircle(610, 430, 21);

    graphics.fillStyle(0x8da2b5, 1);
    graphics.fillCircle(385, 430, 9);
    graphics.fillCircle(610, 430, 9);
  }

  destroy() {
    this.graphics.destroy();
  }
}
