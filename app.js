import {
  initialProperties,
  curadoriaTestimonials,
  propertyMetricsSeed,
  consultantAnalyticsData
} from "./js/data.js";

const STORAGE_KEY = "casa-clara-high-end-v2";
const FAVORITES_KEY = "casa-clara-favorites-v2";
const METRICS_KEY = "casa-clara-metrics-v2";

// DOM Elements
const grid = document.querySelector("#property-grid");
const emptyState = document.querySelector("#empty-state");
const form = document.querySelector("#property-form");
const modal = document.querySelector("#property-modal");
const detailModal = document.querySelector("#detail-modal");
const toast = document.querySelector("#toast");
const searchInput = document.querySelector("#search-input");
const typeFilter = document.querySelector("#type-filter");
const priceFilter = document.querySelector("#price-filter");
const sortFilter = document.querySelector("#sort-filter");
const clearFiltersBtn = document.querySelector("#clear-filters");
const favoritesToggleBtn = document.querySelector("#favorites-toggle");
const favCountBadge = document.querySelector("#fav-count");
const statusTabs = [...document.querySelectorAll(".filter-tab")];

// State
let currentRole = "client"; // "client" | "consultant"
let activeAnalyticsPeriod = "month"; // "day" | "week" | "month" | "year"
let activeStatus = "all";
let onlyFavorites = false;
let onlyFeatured = false;
let editingId = null;
let currentDetailId = null;
let toastTimeout;

function loadMetricsMap() {
  try {
    const stored = localStorage.getItem(METRICS_KEY);
    if (!stored) {
      localStorage.setItem(METRICS_KEY, JSON.stringify(propertyMetricsSeed));
      return { ...propertyMetricsSeed };
    }
    return { ...propertyMetricsSeed, ...JSON.parse(stored) };
  } catch {
    return { ...propertyMetricsSeed };
  }
}

let metricsMap = loadMetricsMap();

function saveMetricsMap() {
  try {
    localStorage.setItem(METRICS_KEY, JSON.stringify(metricsMap));
  } catch (err) {
    console.error("Erro ao salvar métricas:", err);
  }
}

function getPropertyMetrics(propertyId) {
  if (!metricsMap[propertyId]) {
    metricsMap[propertyId] = {
      daysListed: 1,
      listedDate: new Date().toISOString().slice(0, 10),
      clientViews: 12,
      uniqueClients: 9,
      leadsCount: 1,
      scheduledVisits: 0,
      lastAccess: "Agora mesmo"
    };
  }
  return metricsMap[propertyId];
}

function recordClientAccess(propertyId, type = "view") {
  const m = getPropertyMetrics(propertyId);
  m.clientViews = (Number(m.clientViews) || 0) + 1;
  m.uniqueClients = (Number(m.uniqueClients) || 0) + (Math.random() > 0.4 ? 1 : 0);
  if (type === "lead") {
    m.leadsCount = (Number(m.leadsCount) || 0) + 1;
  }
  if (type === "visit") {
    m.scheduledVisits = (Number(m.scheduledVisits) || 0) + 1;
    m.leadsCount = (Number(m.leadsCount) || 0) + 1;
  }
  m.lastAccess = "Agora mesmo";
  saveMetricsMap();
}

function setRole(role) {
  currentRole = role === "consultant" ? "consultant" : "client";
  const isConsultant = currentRole === "consultant";

  document.querySelectorAll("[data-consultant-only]").forEach((el) => {
    el.hidden = !isConsultant;
  });
  document.querySelectorAll("[data-client-only]").forEach((el) => {
    el.hidden = isConsultant;
  });

  document.querySelector("#role-client-btn")?.classList.toggle("active", !isConsultant);
  document.querySelector("#role-consultant-btn")?.classList.toggle("active", isConsultant);

  render();
  if (isConsultant) {
    renderConsultantDashboard();
  }
  showToast(
    isConsultant
      ? "Área do Consultor ativada: BI, gráficos de vendas e exportação Excel liberados."
      : "Visão do Cliente ativada: navegação, visitas e propostas."
  );
}

function selectPropertyForContact(property, intentType = "Agendar Visita Privativa") {
  const banner = document.querySelector("#selected-property-banner");
  const nameEl = document.querySelector("#selected-property-name");
  const hiddenInput = document.querySelector("#selected-property-input");
  const interestSelect = document.querySelector("#client-interest-select");

  if (banner && nameEl && hiddenInput) {
    banner.hidden = false;
    nameEl.textContent = `${property.name} (${formatFullCurrency(property.price)})`;
    hiddenInput.value = property.name;
  }
  if (interestSelect) {
    interestSelect.value = intentType;
  }

  document.querySelector("#concierge")?.scrollIntoView({ behavior: "smooth" });
  setTimeout(() => {
    document.querySelector('#concierge-form input[name="clientName"]')?.focus();
  }, 450);
}

function loadProperties() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialProperties));
      return initialProperties.map((item) => ({ ...item }));
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length < 12) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialProperties));
      return initialProperties.map((item) => ({ ...item }));
    }
    return parsed;
  } catch (err) {
    console.error("Erro ao carregar imóveis:", err);
    return initialProperties.map((item) => ({ ...item }));
  }
}

function loadFavorites() {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

let properties = loadProperties();
let favorites = loadFavorites();

function saveProperties() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(properties));
    return true;
  } catch (err) {
    console.error("Erro ao salvar imóveis:", err);
    showToast("Não foi possível salvar as alterações no navegador.");
    return false;
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
    favCountBadge.textContent = favorites.size;
  } catch (err) {
    console.error("Erro ao salvar favoritos:", err);
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatCompactCurrency(price) {
  const num = Number(price) || 0;
  if (num >= 1000000) {
    return `R$ ${(num / 1000000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} mi`;
  }
  if (num >= 1000) {
    return `R$ ${Math.round(num / 1000).toLocaleString("pt-BR")} mil`;
  }
  return `R$ ${num.toLocaleString("pt-BR")}`;
}

function formatFullCurrency(price) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(Number(price) || 0);
}

function getStatusBadgeStyle(status) {
  if (status === "Vendido") {
    return "bg-slate-900/90 text-slate-200 border-slate-700";
  }
  if (status === "Alugado") {
    return "bg-amber text-white border-amber-light/40";
  }
  return "bg-white/95 text-graphite border-white";
}

function renderCard(property) {
  const safeId = escapeHTML(property.id);
  const safeName = escapeHTML(property.name);
  const safeType = escapeHTML(property.type);
  const safeStatus = escapeHTML(property.status);
  const safeAddress = escapeHTML(property.address);
  const safeArchitect = escapeHTML(property.architect || "Curadoria Casa Clara");
  const imageURL = escapeHTML(
    property.image ||
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80"
  );
  const beds = Number(property.beds) || 0;
  const baths = Number(property.baths) || 0;
  const parking = Number(property.parking) || 0;
  const area = Number(property.area) || 0;
  const isFav = favorites.has(property.id);
  const isRental = property.status === "Alugado" || property.transaction === "Locação";
  const priceSuffix = isRental ? "/mês" : "";
  const pricePerSqm = area > 0 && !isRental ? Math.round((Number(property.price) || 0) / area) : null;

  return `
    <article
      class="property-card group bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-card flex flex-col justify-between"
      data-property-id="${safeId}"
    >
      <div>
        <!-- Card Media -->
        <div class="relative h-64 overflow-hidden bg-slate-200 cursor-pointer" data-action="view-details">
          <img
            src="${imageURL}"
            alt="${safeName}"
            loading="lazy"
            class="card-image w-full h-full object-cover"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-graphite/75 via-transparent to-graphite/20"></div>

          <!-- Top Badges -->
          <div class="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5">
            <span class="px-3 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-sm ${getStatusBadgeStyle(property.status)}">
              ${safeStatus}
            </span>
            ${
              property.featured
                ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-navy/90 text-amber-light border border-amber/30 backdrop-blur-md">
                    ★ Assinado
                  </span>`
                : ""
            }
          </div>

          <!-- Top Right Favorite & Menu -->
          <div class="absolute top-3.5 right-3.5 flex items-center gap-1.5" onclick="event.stopPropagation()">
            <button
              type="button"
              data-action="toggle-favorite"
              aria-label="${isFav ? "Remover dos favoritos" : "Salvar nos favoritos"}"
              class="w-9 h-9 rounded-full bg-white/90 hover:bg-white text-graphite flex items-center justify-center shadow-md transition-transform hover:scale-105"
            >
              <svg class="w-4 h-4 ${isFav ? "text-amber fill-amber" : "text-slate-700"}" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" />
              </svg>
            </button>

            ${
              currentRole === "consultant"
                ? `<div class="relative property-menu-wrap">
                    <button
                      type="button"
                      class="property-menu-button w-9 h-9 rounded-full bg-white/90 hover:bg-white text-graphite flex items-center justify-center shadow-md font-bold text-lg leading-none"
                      aria-label="Gestão de ${safeName}"
                      aria-expanded="false"
                    >
                      ···
                    </button>
                    <div
                      class="property-actions absolute right-0 top-11 w-40 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-20"
                      hidden
                    >
                      <button
                        type="button"
                        data-action="view-details"
                        class="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <span>✦</span> Ver Dossiê
                      </button>
                      <button
                        type="button"
                        data-action="edit"
                        class="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        <span>✎</span> Editar Imóvel
                      </button>
                      <button
                        type="button"
                        data-action="delete"
                        class="w-full px-3 py-2 rounded-xl text-left text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <span>×</span> Remover
                      </button>
                    </div>
                  </div>`
                : ""
            }
          </div>

          <!-- Bottom Image Overlay Info -->
          <div class="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
            <span class="font-semibold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-md bg-graphite/65 backdrop-blur-sm text-amber-light">
              ${safeType}
            </span>
            <span class="text-[11px] font-medium text-slate-200 truncate max-w-[65%]">
              ${safeArchitect}
            </span>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-5 sm:p-6">
          <div class="cursor-pointer" data-action="view-details">
            <h3 class="font-heading font-bold text-lg text-graphite group-hover:text-navy transition-colors line-clamp-1" title="${safeName}">
              ${safeName}
            </h3>
            <p class="text-xs text-slate-500 mt-1 flex items-center gap-1.5 line-clamp-1">
              <svg class="w-3.5 h-3.5 text-amber shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
              </svg>
              <span class="truncate">${safeAddress}</span>
            </p>
          </div>

          <!-- Key Specs Grid -->
          <div class="mt-4 py-3.5 px-3.5 rounded-2xl bg-surface border border-slate-200/70 grid grid-cols-4 gap-2 text-center">
            <div>
              <span class="block text-[10px] font-semibold uppercase text-slate-400">Área</span>
              <strong class="text-xs font-bold text-graphite">${area.toLocaleString("pt-BR")} m²</strong>
            </div>
            <div>
              <span class="block text-[10px] font-semibold uppercase text-slate-400">Quartos</span>
              <strong class="text-xs font-bold text-graphite">${beds}</strong>
            </div>
            <div>
              <span class="block text-[10px] font-semibold uppercase text-slate-400">Banhos</span>
              <strong class="text-xs font-bold text-graphite">${baths}</strong>
            </div>
            <div>
              <span class="block text-[10px] font-semibold uppercase text-slate-400">Vagas</span>
              <strong class="text-xs font-bold text-graphite">${parking}</strong>
            </div>
          </div>

          ${
            currentRole === "consultant"
              ? (() => {
                  const m = getPropertyMetrics(property.id);
                  return `
                  <!-- Consultant Telemetry Bar (Days Listed & Client Accesses) -->
                  <div class="mt-3 p-3 rounded-2xl bg-navy/5 border border-navy/15 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span class="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Anunciado há</span>
                      <strong class="text-xs font-extrabold text-navy">${m.daysListed} dias</strong>
                    </div>
                    <div>
                      <span class="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Acessos Clientes</span>
                      <strong class="text-xs font-extrabold text-graphite">${Number(m.clientViews).toLocaleString("pt-BR")}</strong>
                    </div>
                    <div>
                      <span class="block text-[9px] font-bold uppercase tracking-wider text-slate-400">Propostas / Visitas</span>
                      <strong class="text-xs font-extrabold text-amber-dark">${m.leadsCount} (${m.scheduledVisits} vis.)</strong>
                    </div>
                  </div>`;
                })()
              : ""
          }
        </div>
      </div>

      <!-- Card Footer Price & Action -->
      <div class="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 flex flex-col gap-3">
        <div class="flex items-end justify-between gap-3">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              ${isRental ? "Locação Mensal" : "Valor de Aquisição"}
            </span>
            <div class="font-heading font-extrabold text-xl text-navy leading-tight">
              ${formatFullCurrency(property.price)}<span class="text-xs font-normal text-slate-500">${priceSuffix}</span>
            </div>
            ${
              pricePerSqm
                ? `<span class="text-[11px] text-slate-400">${formatFullCurrency(pricePerSqm)} / m²</span>`
                : `<span class="text-[11px] text-amber font-medium">Contrato Prime</span>`
            }
          </div>

          <button
            type="button"
            data-action="view-details"
            class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-graphite text-xs font-semibold transition-all shrink-0"
          >
            Ver Detalhes
          </button>
        </div>

        ${
          currentRole === "client"
            ? `<div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  data-action="schedule-visit"
                  class="px-3 py-2 rounded-xl bg-navy hover:bg-navy-dark text-white text-xs font-semibold transition-all text-center"
                >
                  Agendar Visita
                </button>
                <button
                  type="button"
                  data-action="buy-property"
                  class="px-3 py-2 rounded-xl border border-amber/40 bg-amber/10 hover:bg-amber text-amber-dark hover:text-white text-xs font-bold transition-all text-center"
                >
                  ${isRental ? "Quero Alugar" : "Quero Comprar"}
                </button>
              </div>`
            : `<div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  data-action="edit"
                  class="px-3 py-2 rounded-xl border border-slate-200 hover:border-navy text-slate-700 hover:text-navy text-xs font-semibold transition-all text-center"
                >
                  ✎ Editar Imóvel
                </button>
                <button
                  type="button"
                  data-action="delete"
                  class="px-3 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold transition-all text-center"
                >
                  × Excluir
                </button>
              </div>`
        }
      </div>
    </article>
  `;
}

function matchesPriceRange(property, rangeValue) {
  if (rangeValue === "all") return true;
  const price = Number(property.price) || 0;
  const isRental = property.status === "Alugado" || property.transaction === "Locação";
  if (rangeValue === "rental") return isRental;
  if (isRental) return false;
  if (rangeValue === "up-to-10m") return price <= 10000000;
  if (rangeValue === "10m-to-20m") return price > 10000000 && price <= 20000000;
  if (rangeValue === "above-20m") return price > 20000000;
  return true;
}

function sortProperties(list, criterion) {
  const copy = [...list];
  if (criterion === "price-desc") {
    return copy.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
  }
  if (criterion === "price-asc") {
    return copy.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  }
  if (criterion === "area-desc") {
    return copy.sort((a, b) => (Number(b.area) || 0) - (Number(a.area) || 0));
  }
  // Default: featured first
  return copy.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
}

function render() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const type = typeFilter.value;
  const priceRange = priceFilter.value;
  const sortCriterion = sortFilter.value;

  const filtered = sortProperties(
    properties.filter((property) => {
      const matchesStatus = activeStatus === "all" || property.status === activeStatus;
      const matchesType = type === "all" || property.type === type;
      const matchesPrice = matchesPriceRange(property, priceRange);
      const matchesFav = !onlyFavorites || favorites.has(property.id);
      const matchesFeatured = !onlyFeatured || Boolean(property.featured);
      const searchable = `${property.name} ${property.type} ${property.address} ${property.neighborhood || ""} ${property.city || ""} ${property.architect || ""} ${property.status}`.toLocaleLowerCase("pt-BR");
      return (
        matchesStatus &&
        matchesType &&
        matchesPrice &&
        matchesFav &&
        matchesFeatured &&
        searchable.includes(query)
      );
    }),
    sortCriterion
  );

  grid.innerHTML = filtered.map(renderCard).join("");
  grid.hidden = filtered.length === 0;
  emptyState.hidden = filtered.length !== 0;

  // Counters & KPIs
  const availableCount = properties.filter((p) => p.status === "Disponível").length;
  const soldCount = properties.filter((p) => p.status === "Vendido").length;
  const rentedCount = properties.filter((p) => p.status === "Alugado").length;
  const completedCount = soldCount + rentedCount;
  const totalValue = properties.reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  document.querySelector("#stat-total").textContent = properties.length.toLocaleString("pt-BR");
  document.querySelector("#stat-available").textContent = availableCount.toLocaleString("pt-BR");
  document.querySelector("#stat-completed").textContent = completedCount.toLocaleString("pt-BR");
  document.querySelector("#stat-value").textContent = formatCompactCurrency(totalValue);
  document.querySelector("#heading-count").textContent = properties.length;

  document.querySelector("#tab-all").textContent = properties.length;
  document.querySelector("#tab-available").textContent = availableCount;
  document.querySelector("#tab-sold").textContent = soldCount;
  document.querySelector("#tab-rented").textContent = rentedCount;
  favCountBadge.textContent = favorites.size;

  // Results Label & Filter Reset Toggle
  const hasActiveFilters =
    activeStatus !== "all" ||
    type !== "all" ||
    priceRange !== "all" ||
    query !== "" ||
    onlyFavorites ||
    onlyFeatured;

  clearFiltersBtn.classList.toggle("hidden", !hasActiveFilters);

  const filterNote = onlyFavorites
    ? " (filtrando por Favoritos)"
    : onlyFeatured
      ? " (filtrando por Imóveis Assinados)"
      : "";
  document.querySelector("#results-label").textContent =
    `Exibindo ${filtered.length} de ${properties.length} propriedades no portfólio${filterNote}`;

  if (currentRole === "consultant") {
    renderConsultantDashboard();
  }
}

function renderConsultantDashboard() {
  const periodData = consultantAnalyticsData[activeAnalyticsPeriod] || consultantAnalyticsData.month;
  const periodLabels = { day: "Hoje", week: "Semana", month: "Mês", year: "Ano" };

  const badgeEl = document.querySelector("#bi-period-badge");
  if (badgeEl) badgeEl.textContent = periodLabels[activeAnalyticsPeriod] || "Mês";

  document.querySelector("#bi-vgv-sold").textContent = formatCompactCurrency(periodData.vgvSold);
  document.querySelector("#bi-deals-count").textContent = `${periodData.dealsCount} ${periodData.dealsCount === 1 ? "imóvel negociado" : "imóveis negociados"} (${periodData.label})`;
  document.querySelector("#bi-active-views").textContent = Number(periodData.activeViews).toLocaleString("pt-BR");
  document.querySelector("#bi-new-leads").textContent = `${Number(periodData.newLeads).toLocaleString("pt-BR")} leads e propostas geradas`;
  document.querySelector("#bi-avg-dom").textContent = `${periodData.avgDaysOnMarket} dias`;
  document.querySelector("#bi-conversion-rate").textContent = `Taxa de conversão: ${periodData.conversionRate}`;
  document.querySelector("#bi-visits-count").textContent = Number(periodData.visitsToday).toLocaleString("pt-BR");
  document.querySelector("#bi-avg-ticket").textContent = `Ticket médio: ${formatCompactCurrency(periodData.avgTicket)}`;
  document.querySelector("#bi-chart-title").textContent = periodData.seriesTitle;

  // Render Bar Chart (VGV & Views)
  const chartContainer = document.querySelector("#bi-sales-chart");
  if (chartContainer) {
    const maxVgv = Math.max(...periodData.series.map((s) => s.vgv), 1);
    const maxViews = Math.max(...periodData.series.map((s) => s.views), 1);

    chartContainer.innerHTML = periodData.series
      .map((item) => {
        const vgvHeightPct = Math.max(Math.round((item.vgv / maxVgv) * 100), item.vgv > 0 ? 15 : 4);
        const viewsHeightPct = Math.max(Math.round((item.views / maxViews) * 100), 12);
        return `
          <div class="flex-1 flex flex-col items-center justify-end h-full group">
            <div class="w-full flex items-end justify-center gap-1.5 h-44 px-1">
              <!-- VGV Bar -->
              <div class="flex-1 max-w-[26px] flex flex-col items-center justify-end h-full">
                <span class="text-[9px] font-bold text-navy mb-1 opacity-85 group-hover:opacity-100">
                  ${item.vgv > 0 ? `${item.vgv}M` : "-"}
                </span>
                <div
                  class="w-full rounded-t-lg bg-navy group-hover:bg-navy-dark transition-all"
                  style="height: ${vgvHeightPct}%"
                  title="VGV: R$ ${item.vgv} milhões"
                ></div>
              </div>
              <!-- Views Bar -->
              <div class="flex-1 max-w-[26px] flex flex-col items-center justify-end h-full">
                <span class="text-[9px] font-bold text-amber-dark mb-1 opacity-85 group-hover:opacity-100">
                  ${item.views.toLocaleString("pt-BR")}
                </span>
                <div
                  class="w-full rounded-t-lg bg-amber group-hover:bg-amber-dark transition-all"
                  style="height: ${viewsHeightPct}%"
                  title="Acessos: ${item.views.toLocaleString("pt-BR")} clientes (${item.leads} leads)"
                ></div>
              </div>
            </div>
            <span class="text-[11px] font-bold text-slate-600 mt-2">${escapeHTML(item.period)}</span>
          </div>
        `;
      })
      .join("");
  }

  // Render Top 5 Accessed Properties & Days on Market
  const topContainer = document.querySelector("#bi-top-properties");
  const sortedByViews = [...properties]
    .map((p) => ({ ...p, metrics: getPropertyMetrics(p.id) }))
    .sort((a, b) => b.metrics.clientViews - a.metrics.clientViews);

  const maxPropViews = Math.max(...sortedByViews.map((p) => p.metrics.clientViews), 1);

  if (topContainer) {
    topContainer.innerHTML = sortedByViews
      .slice(0, 5)
      .map((p) => {
        const pct = Math.max(Math.round((p.metrics.clientViews / maxPropViews) * 100), 10);
        return `
          <div class="space-y-1">
            <div class="flex items-center justify-between text-xs">
              <strong class="font-semibold text-graphite truncate max-w-[58%]" title="${escapeHTML(p.name)}">
                ${escapeHTML(p.name)}
              </strong>
              <div class="flex items-center gap-2 text-[11px] shrink-0">
                <span class="px-2 py-0.5 rounded bg-slate-200/75 text-slate-700 font-semibold">
                  ${p.metrics.daysListed} dias anunciado
                </span>
                <strong class="text-navy font-extrabold">
                  ${p.metrics.clientViews.toLocaleString("pt-BR")} acessos
                </strong>
              </div>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div class="h-full rounded-full bg-gradient-to-r from-navy to-amber" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  // Render Full Audit Table
  const tbody = document.querySelector("#bi-properties-tbody");
  if (tbody) {
    tbody.innerHTML = sortedByViews
      .map(
        (p) => `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-3 px-4 font-semibold text-graphite">
            ${escapeHTML(p.name)}
            <span class="block text-[10px] text-slate-400 font-normal">${escapeHTML(p.neighborhood || p.address)}</span>
          </td>
          <td class="py-3 px-3">
            <span class="font-semibold text-slate-700">${escapeHTML(p.type)}</span>
            <span class="block text-[10px] font-bold ${p.status === "Vendido" ? "text-emerald-700" : p.status === "Alugado" ? "text-amber-dark" : "text-navy"}">
              ${escapeHTML(p.status)}
            </span>
          </td>
          <td class="py-3 px-3 font-bold text-navy">${formatFullCurrency(p.price)}</td>
          <td class="py-3 px-3">
            <strong class="text-graphite">${p.metrics.daysListed} dias</strong>
            <span class="block text-[10px] text-slate-400">Desde ${escapeHTML(p.metrics.listedDate)}</span>
          </td>
          <td class="py-3 px-3">
            <strong class="text-graphite">${p.metrics.clientViews.toLocaleString("pt-BR")} views</strong>
            <span class="block text-[10px] text-slate-400">${p.metrics.uniqueClients.toLocaleString("pt-BR")} clientes únicos</span>
          </td>
          <td class="py-3 px-3">
            <strong class="text-amber-dark">${p.metrics.leadsCount} propostas</strong>
            <span class="block text-[10px] text-slate-500">${p.metrics.scheduledVisits} visitas agendadas</span>
          </td>
          <td class="py-3 px-4 text-slate-500 font-medium">${escapeHTML(p.metrics.lastAccess)}</td>
        </tr>
      `
      )
      .join("");
  }
}

function renderTestimonials() {
  const container = document.querySelector("#testimonials-grid");
  if (!container) return;
  container.innerHTML = curadoriaTestimonials
    .map(
      (item) => `
      <blockquote class="p-6 rounded-2xl bg-surface border border-slate-200/80 flex flex-col justify-between">
        <p class="text-sm text-slate-700 italic leading-relaxed">“${escapeHTML(item.quote)}”</p>
        <footer class="mt-5 flex items-center gap-3">
          <span class="w-10 h-10 rounded-full bg-navy text-amber-light font-heading font-bold text-xs flex items-center justify-center shrink-0">
            ${escapeHTML(item.avatar)}
          </span>
          <div>
            <strong class="text-xs font-bold text-graphite block">${escapeHTML(item.author)}</strong>
            <span class="text-[11px] text-slate-500">${escapeHTML(item.role)}</span>
          </div>
        </footer>
      </blockquote>
    `
    )
    .join("");
}

function showToast(message) {
  toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber shrink-0"></span><span>${escapeHTML(message)}</span>`;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 3200);
}

// Property Dossier Modal (Quick View)
function openDetailModal(property) {
  currentDetailId = property.id;
  const isRental = property.status === "Alugado" || property.transaction === "Locação";

  document.querySelector("#detail-image").src =
    property.image ||
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85";
  document.querySelector("#detail-image").alt = property.name;
  document.querySelector("#detail-badge-status").textContent = property.status;
  document.querySelector("#detail-badge-type").textContent = property.type;
  document.querySelector("#detail-architect").textContent =
    property.architect ? `Arquitetura: ${property.architect}` : "Coleção Casa Clara Private";
  document.querySelector("#detail-title").textContent = property.name;
  document.querySelector("#detail-address").textContent = property.address;
  document.querySelector("#detail-price").textContent =
    `${formatFullCurrency(property.price)}${isRental ? "/mês" : ""}`;

  const condoText = property.condoFee
    ? `Condomínio: ${formatFullCurrency(property.condoFee)} · IPTU: ${formatFullCurrency(property.iptu || 0)}`
    : "Consulte taxas patrimoniais";
  document.querySelector("#detail-condo").textContent = condoText;

  document.querySelector("#detail-area").textContent = `${Number(property.area).toLocaleString("pt-BR")} m²`;
  document.querySelector("#detail-beds").textContent =
    property.suites ? `${property.beds} (${property.suites} suítes)` : `${property.beds || 0}`;
  document.querySelector("#detail-baths").textContent = `${property.baths || 0}`;
  document.querySelector("#detail-parking").textContent = `${property.parking || 0} vagas`;
  document.querySelector("#detail-description").textContent =
    property.description || "Propriedade selecionada pela curadoria Casa Clara Private Realty.";

  const amenitiesList =
    Array.isArray(property.amenities) && property.amenities.length
      ? property.amenities
      : ["Portaria Blindada 24h", "Acabamento em Mármore Importado", "Automação Residencial", "Lazer Completo"];

  document.querySelector("#detail-amenities").innerHTML = amenitiesList
    .map(
      (item) => `
      <span class="px-3.5 py-1.5 rounded-xl bg-navy/5 border border-navy/15 text-navy text-xs font-semibold flex items-center gap-1.5">
        <span class="text-amber">✦</span> ${escapeHTML(item)}
      </span>
    `
    )
    .join("");

  detailModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeDetailModal() {
  detailModal.hidden = true;
  document.body.style.overflow = "";
  currentDetailId = null;
}

// Add/Edit Modal
function openModal(property = null) {
  editingId = property?.id ?? null;
  form.reset();
  form.elements.status.value = "Disponível";
  form.elements.type.value = "Cobertura";
  form.elements.beds.value = 4;
  form.elements.baths.value = 5;
  form.elements.parking.value = 4;

  document.querySelector("#modal-title").textContent = property ? "Editar Propriedade" : "Anunciar Propriedade";
  document.querySelector("#save-property").textContent = property ? "Salvar Alterações" : "Publicar Imóvel";
  document.querySelector("#modal-error").hidden = true;

  if (property) {
    for (const field of form.elements) {
      if (field.name && Object.hasOwn(property, field.name)) {
        field.value = property[field.name] ?? "";
      }
    }
  }

  modal.hidden = false;
  document.body.style.overflow = "hidden";
  form.elements.name.focus();
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
  editingId = null;
}

function resetAllFilters() {
  activeStatus = "all";
  onlyFavorites = false;
  onlyFeatured = false;
  searchInput.value = "";
  typeFilter.value = "all";
  priceFilter.value = "all";
  sortFilter.value = "featured";
  favoritesToggleBtn.classList.remove("border-amber", "bg-amber/10");
  favoritesToggleBtn.setAttribute("aria-pressed", "false");
  statusTabs.forEach((tab) => {
    const isAll = tab.dataset.status === "all";
    tab.classList.toggle("active", isAll);
    tab.setAttribute("aria-selected", String(isAll));
  });
  render();
}

// Wealth Simulator Logic
const simPriceInput = document.querySelector("#sim-price");
const simDownInput = document.querySelector("#sim-down");
const simYearsInput = document.querySelector("#sim-years");

function updateSimulator() {
  const price = Number(simPriceInput.value) || 12000000;
  const downPct = Number(simDownInput.value) || 40;
  const years = Number(simYearsInput.value) || 20;

  const downAmount = price * (downPct / 100);
  const loanAmount = price - downAmount;
  const months = years * 12;
  const monthlyRate = 0.098 / 12; // 9.8% a.a. taxa referencial Prime
  const amortization = loanAmount / months;
  const firstInstallment = amortization + loanAmount * monthlyRate;

  document.querySelector("#sim-price-display").textContent = formatFullCurrency(price);
  document.querySelector("#sim-down-display").textContent = `${downPct}%`;
  document.querySelector("#sim-years-display").textContent = `${years} anos`;

  document.querySelector("#sim-result-down").textContent = formatFullCurrency(downAmount);
  document.querySelector("#sim-result-loan").textContent = formatFullCurrency(loanAmount);
  document.querySelector("#sim-result-monthly").textContent = `${formatFullCurrency(firstInstallment)}/mês`;
}

[simPriceInput, simDownInput, simYearsInput].forEach((input) => {
  input?.addEventListener("input", updateSimulator);
});

// Event Listeners
document.querySelector("#add-property").addEventListener("click", () => openModal());
document.querySelector("#empty-add").addEventListener("click", () => openModal());
document.querySelector("#empty-reset-filters").addEventListener("click", resetAllFilters);
clearFiltersBtn.addEventListener("click", resetAllFilters);

document.querySelector("#modal-close").addEventListener("click", closeModal);
document.querySelector("#cancel-modal").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

document.querySelector("#detail-close").addEventListener("click", closeDetailModal);
detailModal.addEventListener("click", (e) => {
  if (e.target === detailModal) closeDetailModal();
});

document.querySelector("#detail-edit-btn").addEventListener("click", () => {
  const prop = properties.find((p) => p.id === currentDetailId);
  closeDetailModal();
  if (prop) openModal(prop);
});

document.querySelector("#detail-simulate-btn").addEventListener("click", () => {
  const prop = properties.find((p) => p.id === currentDetailId);
  closeDetailModal();
  if (prop && prop.price >= 1500000) {
    simPriceInput.value = Math.min(35000000, Number(prop.price));
    updateSimulator();
  }
  document.querySelector("#simulador")?.scrollIntoView({ behavior: "smooth" });
  showToast("Valor carregado no Simulador Patrimonial.");
});

document.querySelector("#detail-schedule-btn").addEventListener("click", () => {
  const prop = properties.find((p) => p.id === currentDetailId);
  closeDetailModal();
  if (prop) {
    selectPropertyForContact(prop, "Agendar Visita Privativa");
  }
});

document.querySelector("#detail-buy-btn")?.addEventListener("click", () => {
  const prop = properties.find((p) => p.id === currentDetailId);
  closeDetailModal();
  if (prop) {
    selectPropertyForContact(prop, "Proposta de Compra / Aquisição");
  }
});

document.querySelector("#clear-selected-property")?.addEventListener("click", () => {
  const banner = document.querySelector("#selected-property-banner");
  const hiddenInput = document.querySelector("#selected-property-input");
  if (banner) banner.hidden = true;
  if (hiddenInput) hiddenInput.value = "";
});

// Role Switcher Buttons
document.querySelector("#role-client-btn")?.addEventListener("click", () => setRole("client"));
document.querySelector("#role-consultant-btn")?.addEventListener("click", () => setRole("consultant"));

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (!detailModal.hidden) closeDetailModal();
    if (!modal.hidden) closeModal();
  }
});

// Favorites Toggle Filter
favoritesToggleBtn.addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  favoritesToggleBtn.classList.toggle("border-amber", onlyFavorites);
  favoritesToggleBtn.classList.toggle("bg-amber/10", onlyFavorites);
  favoritesToggleBtn.setAttribute("aria-pressed", String(onlyFavorites));
  render();
  document.querySelector("#colecao")?.scrollIntoView({ behavior: "smooth" });
});

// Quick Featured Link & Hero Search Tags
document.querySelectorAll('[data-quick-filter="featured"]').forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    onlyFeatured = !onlyFeatured;
    render();
    document.querySelector("#colecao")?.scrollIntoView({ behavior: "smooth" });
    showToast(onlyFeatured ? "Exibindo apenas imóveis assinados." : "Exibindo toda a coleção.");
  });
});

document.querySelectorAll("[data-search-tag]").forEach((btn) => {
  btn.addEventListener("click", () => {
    searchInput.value = btn.dataset.searchTag;
    render();
    document.querySelector("#colecao")?.scrollIntoView({ behavior: "smooth" });
  });
});

// Reset Mock Catalog
document.querySelector("#reset-catalog").addEventListener("click", () => {
  properties = initialProperties.map((item) => ({ ...item }));
  saveProperties();
  resetAllFilters();
  showToast("Acervo original de 14 imóveis restaurado.");
});

// Form Submit (Create / Update Property)
form.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!form.reportValidity()) return;

  const formData = Object.fromEntries(new FormData(form).entries());
  for (const key of ["price", "area", "beds", "baths", "parking"]) {
    formData[key] = Number(formData[key]) || 0;
  }
  if (!formData.image) {
    formData.image =
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85";
  }

  const isUpdate = Boolean(editingId);
  if (isUpdate) {
    properties = properties.map((item) => (item.id === editingId ? { ...item, ...formData } : item));
  } else {
    const newProperty = {
      id: `cc-${Date.now()}`,
      featured: true,
      suites: formData.beds,
      ...formData
    };
    properties = [newProperty, ...properties];
  }

  saveProperties();
  render();
  closeModal();
  showToast(isUpdate ? "Imóvel atualizado com sucesso." : "Novo imóvel publicado na coleção.");
});

// Card Grid Interactions
grid.addEventListener("click", (e) => {
  const card = e.target.closest(".property-card");
  if (!card) return;
  const property = properties.find((item) => item.id === card.dataset.propertyId);
  if (!property) return;

  const menuBtn = e.target.closest(".property-menu-button");
  if (menuBtn) {
    const menu = card.querySelector(".property-actions");
    const shouldOpen = menu.hidden;
    document.querySelectorAll(".property-actions").forEach((m) => {
      m.hidden = true;
    });
    menu.hidden = !shouldOpen;
    menuBtn.setAttribute("aria-expanded", String(shouldOpen));
    return;
  }

  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  if (action === "toggle-favorite") {
    if (favorites.has(property.id)) {
      favorites.delete(property.id);
      showToast("Removido dos seus favoritos.");
    } else {
      favorites.add(property.id);
      showToast("Imóvel salvo nos favoritos.");
    }
    saveFavorites();
    render();
    return;
  }

  if (action === "view-details") {
    recordClientAccess(property.id, "view");
    openDetailModal(property);
    render();
    return;
  }

  if (action === "schedule-visit") {
    recordClientAccess(property.id, "visit");
    selectPropertyForContact(property, "Agendar Visita Privativa");
    render();
    showToast(`Agende sua visita para "${property.name}".`);
    return;
  }

  if (action === "buy-property") {
    recordClientAccess(property.id, "lead");
    selectPropertyForContact(property, "Proposta de Compra / Aquisição");
    render();
    showToast(`Inicie sua proposta para "${property.name}".`);
    return;
  }

  if (action === "edit" && currentRole === "consultant") {
    openModal(property);
    return;
  }

  if (action === "delete" && currentRole === "consultant") {
    properties = properties.filter((item) => item.id !== property.id);
    saveProperties();
    render();
    showToast(`"${property.name}" removido do portfólio.`);
  }
});

// Fallback for Broken Images
grid.addEventListener(
  "error",
  (e) => {
    if (!(e.target instanceof HTMLImageElement)) return;
    e.target.src =
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80";
  },
  true
);

// Close Dropdown Menus on Outside Click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".property-menu-wrap")) {
    document.querySelectorAll(".property-actions").forEach((m) => {
      m.hidden = true;
    });
  }
});

// Status Filter Tabs
statusTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeStatus = tab.dataset.status;
    statusTabs.forEach((item) => {
      const selected = item === tab;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-selected", String(selected));
    });
    render();
  });
});

searchInput.addEventListener("input", render);
typeFilter.addEventListener("change", render);
priceFilter.addEventListener("change", render);
sortFilter.addEventListener("change", render);

// Analytics Period Switcher (Dia, Semana, Mês, Ano)
document.querySelectorAll("[data-analytics-period]").forEach((btn) => {
  btn.addEventListener("click", () => {
    activeAnalyticsPeriod = btn.dataset.analyticsPeriod;
    document.querySelectorAll("[data-analytics-period]").forEach((tab) => {
      tab.classList.toggle("active", tab === btn);
    });
    renderConsultantDashboard();
  });
});

// Toggle Full Analytics Table
document.querySelector("#toggle-full-analytics-table")?.addEventListener("click", (e) => {
  const wrap = document.querySelector("#bi-full-table-wrap");
  if (!wrap) return;
  wrap.hidden = !wrap.hidden;
  e.currentTarget.textContent = wrap.hidden ? "Ver Tabela Completa ↓" : "Ocultar Tabela Completa ↑";
});

// Multi-Sheet Excel (.XLS SpreadsheetML) Generator with Visual Bar Charts
function exportCompleteExcelWorkbook() {
  if (!properties.length) {
    showToast("Não há imóveis para exportar.");
    return;
  }

  const escapeXML = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  const makeVisualBar = (value, max, length = 20) => {
    const filled = Math.max(1, Math.round((Number(value) / Math.max(Number(max), 1)) * length));
    return "█".repeat(filled) + "░".repeat(Math.max(0, length - filled));
  };

  const enrichedProps = properties.map((p) => ({
    ...p,
    metrics: getPropertyMetrics(p.id)
  }));

  const maxViews = Math.max(...enrichedProps.map((p) => p.metrics.clientViews), 1);
  const maxDays = Math.max(...enrichedProps.map((p) => p.metrics.daysListed), 1);

  // Sheet 1 Rows: Resumo Vendas (Dia, Semana, Mês, Ano) + Gráfico de Barras
  const periods = [
    consultantAnalyticsData.day,
    consultantAnalyticsData.week,
    consultantAnalyticsData.month,
    consultantAnalyticsData.year
  ];
  const maxPeriodVgv = Math.max(...periods.map((p) => p.vgvSold), 1);

  const periodRowsXML = periods
    .map(
      (p) => `
      <Row ss:Height="22">
        <Cell ss:StyleID="sDataBold"><Data ss:Type="String">${escapeXML(p.label)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${Number(p.vgvSold)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.dealsCount)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.activeViews)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.newLeads)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.visitsToday)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="String">${escapeXML(p.conversionRate)}</Data></Cell>
        <Cell ss:StyleID="sChartBar"><Data ss:Type="String">${makeVisualBar(p.vgvSold, maxPeriodVgv, 18)} R$ ${(p.vgvSold / 1000000).toFixed(1)}M</Data></Cell>
      </Row>`
    )
    .join("");

  // Detailed Time-Series Rows for current selected period
  const currentSeries = consultantAnalyticsData[activeAnalyticsPeriod] || consultantAnalyticsData.month;
  const maxSeriesViews = Math.max(...currentSeries.series.map((s) => s.views), 1);
  const seriesRowsXML = currentSeries.series
    .map(
      (s) => `
      <Row ss:Height="20">
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(s.period)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${Number(s.vgv * 1000000)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(s.views)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(s.leads)}</Data></Cell>
        <Cell ss:StyleID="sChartAmber"><Data ss:Type="String">${makeVisualBar(s.views, maxSeriesViews, 16)} (${s.views} views)</Data></Cell>
      </Row>`
    )
    .join("");

  // Sheet 2 Rows: Acessos por Imóvel & Tempo de Anúncio
  const sortedByViews = [...enrichedProps].sort((a, b) => b.metrics.clientViews - a.metrics.clientViews);
  const analyticsRowsXML = sortedByViews
    .map(
      (p) => `
      <Row ss:Height="21">
        <Cell ss:StyleID="sDataBold"><Data ss:Type="String">${escapeXML(p.name)}</Data></Cell>
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(p.type)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="String">${escapeXML(p.status)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${Number(p.price)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.metrics.daysListed)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="String">${escapeXML(p.metrics.listedDate)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.metrics.clientViews)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.metrics.uniqueClients)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.metrics.leadsCount)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.metrics.scheduledVisits)}</Data></Cell>
        <Cell ss:StyleID="sChartBar"><Data ss:Type="String">${makeVisualBar(p.metrics.clientViews, maxViews, 16)} ${p.metrics.clientViews}</Data></Cell>
        <Cell ss:StyleID="sChartAmber"><Data ss:Type="String">${makeVisualBar(p.metrics.daysListed, maxDays, 12)} ${p.metrics.daysListed}d</Data></Cell>
      </Row>`
    )
    .join("");

  // Sheet 3 Rows: Catálogo Completo
  const catalogRowsXML = enrichedProps
    .map(
      (p) => `
      <Row ss:Height="20">
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(p.id)}</Data></Cell>
        <Cell ss:StyleID="sDataBold"><Data ss:Type="String">${escapeXML(p.name)}</Data></Cell>
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(p.type)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="String">${escapeXML(p.status)}</Data></Cell>
        <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${Number(p.price)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.area)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.beds)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.baths)}</Data></Cell>
        <Cell ss:StyleID="sCenter"><Data ss:Type="Number">${Number(p.parking)}</Data></Cell>
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(p.address)}</Data></Cell>
        <Cell ss:StyleID="sData"><Data ss:Type="String">${escapeXML(p.architect || "Curadoria Casa Clara")}</Data></Cell>
      </Row>`
    )
    .join("");

  const workbookXML = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Center"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#0F172A"/>
    </Style>
    <Style ss:ID="sTitle">
      <Font ss:FontName="Calibri" ss:Size="15" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#1E3A8A" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
    </Style>
    <Style ss:ID="sSubtitle">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A8A"/>
      <Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sHeader">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="sData">
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="sDataBold">
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="sCenter">
      <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="sCurrency">
      <NumberFormat ss:Format="&quot;R$&quot;\ #,##0"/>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#1E3A8A"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="sChartBar">
      <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#1E3A8A"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
    <Style ss:ID="sChartAmber">
      <Font ss:FontName="Consolas" ss:Size="10" ss:Bold="1" ss:Color="#D97706"/>
      <Interior ss:Color="#FFFBEB" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0"/>
      </Borders>
    </Style>
  </Styles>

  <!-- ABA 1: RESUMO EXECUTIVO & GRÁFICOS DE VENDAS -->
  <Worksheet ss:Name="1. Vendas e Gráficos">
    <Table>
      <Column ss:Width="170"/>
      <Column ss:Width="135"/>
      <Column ss:Width="110"/>
      <Column ss:Width="120"/>
      <Column ss:Width="115"/>
      <Column ss:Width="115"/>
      <Column ss:Width="110"/>
      <Column ss:Width="260"/>
      <Row ss:Height="30">
        <Cell ss:MergeAcross="7" ss:StyleID="sTitle">
          <Data ss:Type="String">CASA CLARA PRIVATE REALTY — RELATÓRIO GERENCIAL DE VENDAS (DIA, SEMANA, MÊS E ANO)</Data>
        </Cell>
      </Row>
      <Row ss:Height="24">
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Período Analisado</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">VGV Fechado (R$)</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Imóveis Vendidos</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Acessos Clientes</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Novos Leads</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Visitas Realizadas</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Conversão</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Gráfico Comparativo de VGV</Data></Cell>
      </Row>
      ${periodRowsXML}
      <Row ss:Height="18"/>
      <Row ss:Height="24">
        <Cell ss:MergeAcross="4" ss:StyleID="sSubtitle">
          <Data ss:Type="String">DETALHAMENTO E GRÁFICO DE TRÁFEGO — ${escapeXML(currentSeries.seriesTitle.toUpperCase())}</Data>
        </Cell>
      </Row>
      <Row ss:Height="22">
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Faixa / Período</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">VGV Fechado (R$)</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Acessos Clientes</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Propostas / Leads</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Gráfico de Acessos por Período</Data></Cell>
      </Row>
      ${seriesRowsXML}
    </Table>
  </Worksheet>

  <!-- ABA 2: TEMPO DE ANÚNCIO & ACESSOS POR IMÓVEL -->
  <Worksheet ss:Name="2. Acessos e Tempo Anúncio">
    <Table>
      <Column ss:Width="230"/>
      <Column ss:Width="105"/>
      <Column ss:Width="95"/>
      <Column ss:Width="130"/>
      <Column ss:Width="115"/>
      <Column ss:Width="105"/>
      <Column ss:Width="115"/>
      <Column ss:Width="115"/>
      <Column ss:Width="100"/>
      <Column ss:Width="105"/>
      <Column ss:Width="235"/>
      <Column ss:Width="195"/>
      <Row ss:Height="30">
        <Cell ss:MergeAcross="11" ss:StyleID="sTitle">
          <Data ss:Type="String">AUDITORIA DE TRÁFEGO DE CLIENTES E TEMPO DE ANÚNCIO POR IMÓVEL</Data>
        </Cell>
      </Row>
      <Row ss:Height="24">
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Imóvel</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tipologia</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Valor (R$)</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Dias Anunciado</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Data Cadastro</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Acessos Totais</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Clientes Únicos</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Propostas</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Visitas Agend.</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Gráfico de Acessos Clientes</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Gráfico Tempo de Anúncio</Data></Cell>
      </Row>
      ${analyticsRowsXML}
    </Table>
  </Worksheet>

  <!-- ABA 3: CATÁLOGO TÉCNICO COMPLETO -->
  <Worksheet ss:Name="3. Catálogo de Imóveis">
    <Table>
      <Column ss:Width="75"/>
      <Column ss:Width="230"/>
      <Column ss:Width="105"/>
      <Column ss:Width="95"/>
      <Column ss:Width="135"/>
      <Column ss:Width="90"/>
      <Column ss:Width="80"/>
      <Column ss:Width="85"/>
      <Column ss:Width="80"/>
      <Column ss:Width="250"/>
      <Column ss:Width="175"/>
      <Row ss:Height="30">
        <Cell ss:MergeAcross="10" ss:StyleID="sTitle">
          <Data ss:Type="String">ACERVO COMPLETO DE PROPRIEDADES — CASA CLARA PRIVATE REALTY</Data>
        </Cell>
      </Row>
      <Row ss:Height="24">
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Código</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Propriedade</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Tipologia</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Status</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Preço (R$)</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Área (m²)</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Quartos</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Banheiros</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Vagas</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Endereço</Data></Cell>
        <Cell ss:StyleID="sHeader"><Data ss:Type="String">Arquiteto</Data></Cell>
      </Row>
      ${catalogRowsXML}
    </Table>
  </Worksheet>
</Workbook>`;

  const blob = new Blob(["\ufeff", workbookXML], {
    type: "application/vnd.ms-excel;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-gerencial-casa-clara-${activeAnalyticsPeriod}.xls`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Planilha Excel (.XLS) exportada com 3 abas e gráficos prontos!");
}

document.querySelector("#export-button")?.addEventListener("click", exportCompleteExcelWorkbook);
document.querySelector("#export-excel-report")?.addEventListener("click", exportCompleteExcelWorkbook);
document.querySelector("#export-excel-table-btn")?.addEventListener("click", exportCompleteExcelWorkbook);

// Concierge Lead Form
document.querySelector("#concierge-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  const propNote = data.selectedProperty ? ` referente a "${data.selectedProperty}"` : "";
  e.target.reset();
  const banner = document.querySelector("#selected-property-banner");
  if (banner) banner.hidden = true;
  showToast(`Solicitação (${data.clientInterest})${propNote} enviada! Nosso consultor entrará em contato, ${data.clientName}.`);
});

// Mobile Navigation Toggle
const mobileMenuBtn = document.querySelector("#mobile-menu-btn");
const mobileDrawer = document.querySelector("#mobile-drawer");
mobileMenuBtn?.addEventListener("click", () => {
  const isHidden = mobileDrawer.hidden;
  mobileDrawer.hidden = !isHidden;
  mobileMenuBtn.setAttribute("aria-expanded", String(isHidden));
});
mobileDrawer?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mobileDrawer.hidden = true;
    mobileMenuBtn.setAttribute("aria-expanded", "false");
  });
});

// Current Date Display
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric"
}).format(new Date());

// Initialize
renderTestimonials();
updateSimulator();
render();
