const STORAGE_KEY = "carwash-business-progress-v1";

export default class CareerSystem {
  constructor(hud) {
    this.hud = hud;
    this.currency = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    });

    this.stats = this.load();
    this.mount();
    this.render();
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
        };
      }
    } catch (error) {
      console.warn("[CarWash] Não foi possível ler o progresso salvo:", error);
    }

    return { balance: 0, completedJobs: 0, reputation: 5 };
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
    `;
    this.hud.appendChild(this.element);

    this.balanceElement = this.element.querySelector("[data-balance]");
    this.reputationElement = this.element.querySelector("[data-reputation]");
    this.jobsElement = this.element.querySelector("[data-jobs]");
    this.levelElement = this.element.querySelector("[data-level]");
    this.xpElement = this.element.querySelector("[data-xp]");
    this.levelProgressElement = this.element.querySelector("[data-level-progress]");
    this.nextUnlockElement = this.element.querySelector("[data-next-unlock]");
  }

  getLevel() {
    const milestones = [
      { level: 1, name: "Iniciante", xp: 0, next: 100, unlock: "Escova profissional" },
      { level: 2, name: "Aprendiz", xp: 100, next: 250, unlock: "Lavadora de pressão" },
      { level: 3, name: "Profissional", xp: 250, next: 450, unlock: "Segundo box de lavagem" },
      { level: 4, name: "Empresário", xp: 450, next: 700, unlock: "Equipe de apoio" },
      { level: 5, name: "Referência", xp: 700, next: 1000, unlock: "Expansão do lava-jato" },
      { level: 6, name: "Lenda", xp: 1000, next: 1000, unlock: "Todos os marcos alcançados" },
    ];
    const xp = this.stats.completedJobs * 80;
    const current = [...milestones].reverse().find((item) => xp >= item.xp) || milestones[0];
    const progress = current.level === 6
      ? 100
      : Math.min(100, ((xp - current.xp) / (current.next - current.xp)) * 100);
    return { ...current, xp, progress };
  }

  completeJob(reward, rating = 5) {
    if (!Number.isFinite(reward) || reward <= 0) return false;

    const previousJobs = this.stats.completedJobs;
    const safeRating = Math.min(5, Math.max(1, rating));
    this.stats.balance += reward;
    this.stats.completedJobs += 1;
    this.stats.reputation =
      (this.stats.reputation * previousJobs + safeRating) /
      this.stats.completedJobs;

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
    this.nextUnlockElement.textContent = level.unlock;
  }
}
