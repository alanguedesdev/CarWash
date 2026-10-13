
import Phaser from "phaser";
import CleaningSystem from "./systems/CleaningSystem.js";
import CarView from "./vehicles/CarView.js";
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

    // Desenho do carro.
    this.carView = new CarView(this);
    this.carView.drawSideView();

    // Sistema de lavagem.
    this.cleaningSystem = new CleaningSystem(this);

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
