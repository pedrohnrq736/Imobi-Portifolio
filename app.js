import { initialProperties, curadoriaTestimonials } from "./js/data.js";

const STORAGE_KEY = "casa-clara-high-end-v2";
const FAVORITES_KEY = "casa-clara-favorites-v2";

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
let activeStatus = "all";
let onlyFavorites = false;
let onlyFeatured = false;
let editingId = null;
let currentDetailId = null;
let toastTimeout;

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

            <div class="relative property-menu-wrap">
              <button
                type="button"
                class="property-menu-button w-9 h-9 rounded-full bg-white/90 hover:bg-white text-graphite flex items-center justify-center shadow-md font-bold text-lg leading-none"
                aria-label="Opções para ${safeName}"
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
            </div>
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
        </div>
      </div>

      <!-- Card Footer Price & Action -->
      <div class="px-5 pb-5 sm:px-6 sm:pb-6 pt-1 flex items-end justify-between gap-3">
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
          class="px-4 py-2.5 rounded-xl bg-navy/5 hover:bg-navy text-navy hover:text-white text-xs font-semibold transition-all shrink-0"
        >
          Ver Dossiê ↗
        </button>
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
  closeDetailModal();
  document.querySelector("#concierge")?.scrollIntoView({ behavior: "smooth" });
  document.querySelector('#concierge-form input[name="clientName"]')?.focus();
});

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
    openDetailModal(property);
    return;
  }

  if (action === "edit") {
    openModal(property);
    return;
  }

  if (action === "delete") {
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

// CSV Export
document.querySelector("#export-button").addEventListener("click", () => {
  if (!properties.length) {
    showToast("Não há imóveis para exportar.");
    return;
  }
  const columns = ["name", "type", "status", "price", "area", "beds", "baths", "parking", "address", "architect"];
  const escapeCSV = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const csv = [
    columns.join(";"),
    ...properties.map((p) => columns.map((key) => escapeCSV(p[key])).join(";"))
  ].join("\r\n");

  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "colecao-casa-clara-private-realty.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Relatório CSV exportado com sucesso.");
});

// Concierge Lead Form
document.querySelector("#concierge-form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  e.target.reset();
  showToast(`Solicitação recebida, ${data.clientName}. Nosso Private Desk entrará em contato.`);
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
