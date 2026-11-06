const STORAGE_KEY = "carwash-business-progress-v1";

const UPGRADES = [
  {
    id: "professional-brush",
    name: "Escova profissional",
    icon: "🪥",
    price: 120,
    requiredXp: 100,
    description: "Aumenta em 30% a área alcançada pela bucha.",
    effect: "Alcance da limpeza +30%",
  },
  {
    id: "pressure-washer",
    name: "Lavadora de pressão",
    icon: "🚿",
    price: 250,
    requiredXp: 250,
    description: "Aumenta em 30% a área alcançada pelo enxágue.",
    effect: "Alcance do enxágue +30%",
  },
  {
    id: "second-bay",
    name: "Segundo box de lavagem",
    icon: "🏗️",
    price: 450,
    requiredXp: 450,
    description: "Melhora a estrutura e aumenta em 15% a recompensa dos serviços.",
    effect: "Recompensa por serviço +15%",
  },
  {
    id: "support-team",
    name: "Equipe de apoio",
    icon: "👥",
    price: 700,
    requiredXp: 700,
    description: "Uma equipe mais preparada aumenta em 25% a receita dos serviços.",
    effect: "Recompensa por serviço +25%",
  },
  {
    id: "business-expansion",
    name: "Expansão do lava-jato",
    icon: "🏆",
    price: 1000,
    requiredXp: 1000,
    description: "Consolida o negócio e aumenta em 35% a receita dos serviços.",
    effect: "Recompensa por serviço +35%",
  },
];

const LEVELS = [
  { level: 1, name: "Iniciante", xp: 0, next: 100 },
  { level: 2, name: "Aprendiz", xp: 100, next: 250 },
  { level: 3, name: "Profissional", xp: 250, next: 450 },
  { level: 4, name: "Empresário", xp: 450, next: 700 },
  { level: 5, name: "Referência", xp: 700, next: 1000 },
  { level: 6, name: "Lenda", xp: 1000, next: 1000 },
];

export default class CareerSystem {
  constructor(hud, { onUpgradeChange = () => {} } = {}) {
    this.hud = hud;
    this.onUpgradeChange = onUpgradeChange;
    this.currency = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    });
    this.stats = this.load();
    this.mount();
    this.render();
    this.onUpgradeChange(this.getUpgradeBonuses());
  }

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (
        saved &&
        Number.isFinite(saved.balance) &&
        Number.isFinite(saved.completedJobs) &&
        Number.isFinite(saved.reputation)
      ) {
        return {
          balance: Math.max(0, saved.balance),
          completedJobs: Math.max(0, Math.floor(saved.completedJobs)),
          reputation: Math.min(5, Math.max(0, saved.reputation)),
          purchasedUpgrades: Array.isArray(saved.purchasedUpgrades)
            ? saved.purchasedUpgrades.filter((id) => UPGRADES.some((item) => item.id === id))
            : [],
        };
      }
    } catch (error) {
      console.warn("[CarWash] Não foi possível ler o progresso salvo:", error);
    }
    return { balance: 0, completedJobs: 0, reputation: 5, purchasedUpgrades: [] };
  }

  mount() {
    this.element = document.createElement("section");
    this.element.className = "business-dashboard";
    this.element.setAttribute("aria-label", "Indicadores do lava-jato");
    this.element.innerHTML = `
      <div class="business-stat">
        <span class="business-stat-icon" aria-hidden="true">💰</span>
        <div><small>CAIXA</small><strong data-balance>R$ 0,00</strong></div>
      </div>
      <div class="business-stat">
        <span class="business-stat-icon" aria-hidden="true">⭐</span>
        <div><small>REPUTAÇÃO</small><strong data-reputation>5,0 / 5</strong></div>
      </div>
      <div class="business-stat">
        <span class="business-stat-icon" aria-hidden="true">🚘</span>
        <div><small>SERVIÇOS</small><strong data-jobs>0</strong></div>
      </div>
      <div class="business-level" aria-label="Nível do lava-jato">
        <div class="business-level-top">
          <strong data-level>⭐ Nível 1 · Iniciante</strong>
          <span data-xp>0 / 100 XP</span>
        </div>
        <div class="business-level-track"><span data-level-progress></span></div>
        <small data-next-unlock>Próximo marco: Escova profissional</small>
      </div>
      <button class="shop-open-button" type="button" data-shop-open>🛒 Loja de melhorias</button>
    `;
    this.hud.appendChild(this.element);

    this.balanceElement = this.element.querySelector("[data-balance]");
    this.reputationElement = this.element.querySelector("[data-reputation]");
    this.jobsElement = this.element.querySelector("[data-jobs]");
    this.levelElement = this.element.querySelector("[data-level]");
    this.xpElement = this.element.querySelector("[data-xp]");
    this.levelProgressElement = this.element.querySelector("[data-level-progress]");
    this.nextUnlockElement = this.element.querySelector("[data-next-unlock]");
    this.element.querySelector("[data-shop-open]").addEventListener("click", () => this.openShop());
    this.mountShop();
  }

  mountShop() {
    this.shop = document.createElement("section");
    this.shop.className = "shop-overlay";
    this.shop.hidden = true;
    this.shop.setAttribute("aria-label", "Loja de melhorias");
    this.shop.innerHTML = `
      <div class="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shop-title">
        <header class="shop-header">
          <div><small>INVISTA NO SEU NEGÓCIO</small><h2 id="shop-title">Loja de melhorias</h2></div>
          <button type="button" class="shop-close" data-shop-close aria-label="Fechar loja">×</button>
        </header>
        <div class="shop-summary"><span>Seu caixa</span><strong data-shop-balance>R$ 0,00</strong></div>
        <p class="shop-rule">As melhorias são compradas em sequência. Para adquirir um item, compre o anterior e alcance o XP exigido.</p>
        <div class="shop-items" data-shop-items></div>
        <p class="shop-feedback" data-shop-feedback aria-live="polite"></p>
      </div>
    `;
    this.hud.appendChild(this.shop);
    this.shopBalance = this.shop.querySelector("[data-shop-balance]");
    this.shopItems = this.shop.querySelector("[data-shop-items]");
    this.shopFeedback = this.shop.querySelector("[data-shop-feedback]");
    this.shop.querySelector("[data-shop-close]").addEventListener("click", () => this.closeShop());
    this.shop.addEventListener("click", (event) => {
      if (event.target === this.shop) this.closeShop();
    });
    this.shopItems.addEventListener("click", (event) => {
      const button = event.target.closest("[data-buy-upgrade]");
      if (!button) return;
      const result = this.purchaseUpgrade(button.dataset.buyUpgrade);
      this.shopFeedback.textContent = result.message;
      this.shopFeedback.dataset.state = result.ok ? "success" : "error";
    });
  }

  openShop() {
    this.shop.hidden = false;
    this.renderShop();
  }

  closeShop() {
    this.shop.hidden = true;
  }

  getLevel() {
    const xp = this.stats.completedJobs * 80;
    const current = [...LEVELS].reverse().find((item) => xp >= item.xp) || LEVELS[0];
    const progress = current.level === 6
      ? 100
      : Math.min(100, ((xp - current.xp) / (current.next - current.xp)) * 100);
    return { ...current, xp, progress };
  }

  getNextUpgradeIndex() {
    return UPGRADES.findIndex((item) => !this.stats.purchasedUpgrades.includes(item.id));
  }

  getUpgradeBonuses() {
    const purchased = this.stats.purchasedUpgrades;
    return {
      cleaningRadiusMultiplier: purchased.includes("professional-brush") ? 1.3 : 1,
      rinseRadiusMultiplier: purchased.includes("pressure-washer") ? 1.3 : 1,
      rewardMultiplier:
        (purchased.includes("second-bay") ? 1.15 : 1) *
        (purchased.includes("support-team") ? 1.25 : 1) *
        (purchased.includes("business-expansion") ? 1.35 : 1),
    };
  }

  purchaseUpgrade(id) {
    const index = UPGRADES.findIndex((item) => item.id === id);
    if (index < 0) return { ok: false, message: "Melhoria não encontrada." };
    const nextIndex = this.getNextUpgradeIndex();
    if (index !== nextIndex) {
      return { ok: false, message: "Siga a sequência: compre a melhoria anterior primeiro." };
    }

    const item = UPGRADES[index];
    const level = this.getLevel();
    if (level.xp < item.requiredXp) {
      return { ok: false, message: `Você precisa de ${item.requiredXp} XP para liberar esta melhoria.` };
    }
    if (this.stats.balance < item.price) {
      return { ok: false, message: `Saldo insuficiente. Faltam ${this.currency.format(item.price - this.stats.balance)}.` };
    }

    this.stats.balance -= item.price;
    this.stats.purchasedUpgrades.push(item.id);
    this.save();
    this.render();
    this.renderShop();
    this.onUpgradeChange(this.getUpgradeBonuses());
    return { ok: true, message: `${item.name} adquirida! ${item.effect}.` };
  }

  completeJob(reward, rating = 5) {
    if (!Number.isFinite(reward) || reward <= 0) return false;
    const previousJobs = this.stats.completedJobs;
    const safeRating = Math.min(5, Math.max(1, rating));
    const adjustedReward = reward * this.getUpgradeBonuses().rewardMultiplier;
    this.stats.balance += adjustedReward;
    this.stats.completedJobs += 1;
    this.stats.reputation =
      (this.stats.reputation * previousJobs + safeRating) / this.stats.completedJobs;
    this.save();
    this.render();
    return true;
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
    } catch (error) {
      console.warn("[CarWash] Não foi possível salvar o progresso:", error);
    }
  }

  renderShop() {
    if (!this.shop) return;
    this.shopBalance.textContent = this.currency.format(this.stats.balance);
    const nextIndex = this.getNextUpgradeIndex();
    const level = this.getLevel();
    this.shopItems.innerHTML = UPGRADES.map((item, index) => {
      const owned = this.stats.purchasedUpgrades.includes(item.id);
      const isNext = index === nextIndex;
      const previousPending = index > nextIndex;
      const xpReady = level.xp >= item.requiredXp;
      const moneyReady = this.stats.balance >= item.price;
      const canBuy = isNext && xpReady && moneyReady;
      let status = "Bloqueado pela sequência";
      if (owned) status = "Adquirido";
      else if (isNext && !xpReady) status = `Requer ${item.requiredXp} XP`;
      else if (isNext && !moneyReady) status = "Saldo insuficiente";
      else if (canBuy) status = "Disponível para compra";
      else if (previousPending) status = "Aguarde os itens anteriores";
      return `
        <article class="shop-item ${owned ? "is-owned" : ""} ${canBuy ? "is-available" : "is-locked"}">
          <div class="shop-item-icon">${item.icon}</div>
          <div class="shop-item-info">
            <div class="shop-item-title"><strong>${index + 1}. ${item.name}</strong><span>${this.currency.format(item.price)}</span></div>
            <p>${item.description}</p>
            <small>${item.effect} · Exige ${item.requiredXp} XP</small>
            <em>${status}</em>
          </div>
          <button type="button" data-buy-upgrade="${item.id}" ${canBuy ? "" : "disabled"}>
            ${owned ? "Comprado ✓" : canBuy ? "Comprar" : "Bloqueado"}
          </button>
        </article>
      `;
    }).join("");
  }

  render() {
    this.balanceElement.textContent = this.currency.format(this.stats.balance);
    this.reputationElement.textContent =
      `${this.stats.reputation.toFixed(1).replace(".", ",")} / 5`;
    this.jobsElement.textContent = String(this.stats.completedJobs);
    const level = this.getLevel();
    this.levelElement.textContent = `⭐ Nível ${level.level} · ${level.name}`;
    this.xpElement.textContent = level.level === 6
      ? `${level.xp} XP · Máximo`
      : `${level.xp} / ${level.next} XP`;
    this.levelProgressElement.style.width = `${level.progress}%`;
    const nextIndex = this.getNextUpgradeIndex();
    this.nextUnlockElement.textContent = nextIndex < 0
      ? "Todos os equipamentos adquiridos!"
      : `Próximo marco: ${UPGRADES[nextIndex].name}`;
    if (this.shop && !this.shop.hidden) this.renderShop();
  }
}
