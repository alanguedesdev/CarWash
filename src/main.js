import Phaser from "phaser";
import CleaningSystem from "./systems/CleaningSystem.js";
import "./../style.css";

class GarageScene extends Phaser.Scene {
  constructor() {
    super("GarageScene");
  }

  create() {
    const { width, height } = this.scale;

    // Céu e fundo.
    this.cameras.main.setBackgroundColor("#9ce5fa");

    const graphics = this.add.graphics();

    // Nuvens.
    graphics.fillStyle(0xffffff, 0.85);
    graphics.fillCircle(125, 85, 23);
    graphics.fillCircle(151, 73, 30);
    graphics.fillCircle(181, 87, 22);

    graphics.fillCircle(740, 105, 25);
    graphics.fillCircle(768, 91, 32);
    graphics.fillCircle(799, 106, 23);

    // Parede da garagem.
    graphics.fillStyle(0xffdf9e, 1);
    graphics.fillRect(70, 145, 820, 300);

    // Telhado.
    graphics.fillStyle(0xff806b, 1);
    graphics.fillTriangle(45, 155, 480, 65, 915, 155);

    // Fachada e abertura da área de lavagem.
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRoundedRect(105, 170, 750, 255, 16);

    graphics.fillStyle(0x9bdcf0, 1);
    graphics.fillRoundedRect(125, 190, 710, 220, 10);

    // Piso.
    graphics.fillStyle(0x7ccf9a, 1);
    graphics.fillRect(0, 445, width, height - 445);

    graphics.fillStyle(0x63b77f, 1);
    graphics.fillRect(0, 505, width, height - 505);

    // Faixa do piso.
    graphics.fillStyle(0xfff0b0, 1);
    graphics.fillRect(0, 445, width, 7);

    // Placa do lava-jato.
    graphics.fillStyle(0xffd34e, 1);
    graphics.fillRoundedRect(325, 145, 310, 58, 15);

    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeRoundedRect(325, 145, 310, 58, 15);

    this.add.text(480, 174, "CAR WASH", {
      fontFamily: "Trebuchet MS, Arial, sans-serif",
      fontSize: "30px",
      fontStyle: "bold",
      color: "#38516b",
      stroke: "#ffffff",
      strokeThickness: 2,
    }).setOrigin(0.5);

    // Sombra do carro.
    graphics.fillStyle(0x35536a, 0.18);
    graphics.fillEllipse(485, 458, 410, 45);

    // Carroceria principal: vista lateral estilizada.
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
    
    this.cleaningSystem = new CleaningSystem(this);
    // Pequenos detalhes decorativos.
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(338, 377, 5);
    graphics.fillCircle(350, 387, 3);
    graphics.fillCircle(650, 370, 4);

    // Interface provisória.
    this.add.text(24, 22, "MEU LAVA-JATO", {
      fontFamily: "Trebuchet MS, Arial, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#29445b",
      stroke: "#ffffff",
      strokeThickness: 4,
    });

    this.add.text(24, 54, "Todo grande negócio começa pequeno!", {
      fontFamily: "Trebuchet MS, Arial, sans-serif",
      fontSize: "15px",
      color: "#29445b",
    });

    // Aviso temporário: ainda não há interação.
    this.add.text(480, 545, "Sua jornada começa aqui!", {
      fontFamily: "Trebuchet MS, Arial, sans-serif",
      fontSize: "21px",
      fontStyle: "bold",
      color: "#ffffff",
      stroke: "#315b49",
      strokeThickness: 5,
    }).setOrigin(0.5);
  }
}

const config = {
  type: Phaser.AUTO,
  parent: "game",
  width: 960,
  height: 600,
  backgroundColor: "#9ce5fa",
  scene: [GarageScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    pixelArt: false,
  },
};

new Phaser.Game(config);