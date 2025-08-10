const state = {
  products: [],
  filtered: [],
  selectedProductIds: new Set(),
  selectedBrands: new Set(),
  selectedTags: new Set(),
  searchQuery: "",
  sort: "relevance"
};

const elements = {
  search: document.getElementById("search"),
  sort: document.getElementById("sort"),
  grid: document.getElementById("grid"),
  empty: document.getElementById("empty"),
  filters: document.getElementById("filters"),
  clearFilters: document.getElementById("clearFilters"),
  compareBtn: document.getElementById("compareBtn"),
  compareDialog: document.getElementById("compareDialog"),
  closeDialog: document.getElementById("closeDialog"),
  compareTableWrap: document.getElementById("compareTableWrap")
};

const FALLBACK_PRODUCTS = [
  { id: "fallback-1", name: "Sample A", brand: "BrandA", price: 100, rating: 4.1, tags: ["basic"], features: {"Battery life (hrs)": 10, "Weight (g)": 200, "Warranty (years)": 1} },
  { id: "fallback-2", name: "Sample B", brand: "BrandB", price: 120, rating: 4.2, tags: ["plus"], features: {"Battery life (hrs)": 12, "Weight (g)": 180, "Warranty (years)": 2} },
  { id: "fallback-3", name: "Sample C", brand: "BrandA", price: 110, rating: 4.0, tags: ["basic"], features: {"Battery life (hrs)": 11, "Weight (g)": 190, "Warranty (years)": 1} }
];

async function loadProducts() {
  if (Array.isArray(window.__PRODUCTS__)) {
    return window.__PRODUCTS__;
  }
  try {
    const res = await fetch("./data/products.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch products");
    const products = await res.json();
    return products;
  } catch (err) {
    console.warn("Using fallback data:", err);
    return FALLBACK_PRODUCTS;
  }
}

function buildFacetOptions(products) {
  const brands = new Set();
  const tags = new Set();
  for (const p of products) {
    if (p.brand) brands.add(p.brand);
    for (const t of p.tags || []) tags.add(t);
  }
  return { brands: [...brands].sort(), tags: [...tags].sort() };
}

function renderFilters(facets) {
  elements.filters.innerHTML = "";
  const groups = [
    { key: "brand", title: "Brand", options: facets.brands, selected: state.selectedBrands },
    { key: "tag", title: "Tags", options: facets.tags, selected: state.selectedTags }
  ];

  for (const group of groups) {
    const wrap = document.createElement("div");
    wrap.className = "filter-group";
    const title = document.createElement("div");
    title.className = "filter-title";
    title.textContent = group.title;
    wrap.appendChild(title);

    for (const opt of group.options) {
      const row = document.createElement("label");
      row.className = "checkbox";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = opt;
      input.checked = group.selected.has(opt);
      input.addEventListener("change", () => {
        if (group.key === "brand") {
          toggleSet(state.selectedBrands, opt, input.checked);
        } else {
          toggleSet(state.selectedTags, opt, input.checked);
        }
        update();
      });
      const span = document.createElement("span");
      span.textContent = opt;
      row.append(input, span);
      wrap.appendChild(row);
    }

    elements.filters.appendChild(wrap);
  }
}

function toggleSet(set, value, isChecked) {
  if (isChecked) set.add(value); else set.delete(value);
}

function productMatchesFilters(product) {
  if (state.selectedBrands.size > 0 && !state.selectedBrands.has(product.brand)) return false;
  if (state.selectedTags.size > 0) {
    const tags = new Set(product.tags || []);
    for (const t of state.selectedTags) {
      if (!tags.has(t)) return false;
    }
  }
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    const hay = [product.name, product.brand, ...(product.tags || [])].join(" ").toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function computeRelevanceScore(product, query) {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  if (product.name.toLowerCase().includes(q)) score += 3;
  if (product.brand.toLowerCase().includes(q)) score += 2;
  for (const t of product.tags || []) if (t.toLowerCase().includes(q)) score += 1;
  return score;
}

function sortProducts(products) {
  const arr = [...products];
  const sort = state.sort;
  if (sort === "price-asc") arr.sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") arr.sort((a, b) => b.price - a.price);
  else if (sort === "rating-desc") arr.sort((a, b) => b.rating - a.rating);
  else {
    arr.sort((a, b) => computeRelevanceScore(b, state.searchQuery) - computeRelevanceScore(a, state.searchQuery));
  }
  return arr;
}

function formatPrice(n) { return `$${n.toFixed(0)}`; }

function renderGrid(products) {
  elements.grid.innerHTML = "";
  if (products.length === 0) {
    elements.empty.hidden = false;
    return;
  }
  elements.empty.hidden = true;

  for (const p of products) {
    const card = document.createElement("article");
    card.className = "card";

    const title = document.createElement("h3");
    title.textContent = p.name;

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${p.brand} • ${p.rating.toFixed(1)}★`;

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = formatPrice(p.price);

    const tags = document.createElement("div");
    tags.className = "tag-group";
    for (const t of p.tags || []) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = t;
      tags.appendChild(tag);
    }

    const footer = document.createElement("footer");
    const add = document.createElement("button");
    const isSelected = state.selectedProductIds.has(p.id);
    add.className = isSelected ? "add" : "";
    add.textContent = isSelected ? "Added" : "Add to compare";
    add.addEventListener("click", () => {
      if (state.selectedProductIds.has(p.id)) state.selectedProductIds.delete(p.id);
      else state.selectedProductIds.add(p.id);
      update();
    });

    const details = document.createElement("button");
    details.textContent = "Details";
    details.addEventListener("click", () => showCompare([p.id]));

    footer.append(add, details);
    card.append(title, meta, price, tags, footer);
    elements.grid.appendChild(card);
  }
}

function updateCompareBtn() {
  const count = state.selectedProductIds.size;
  elements.compareBtn.disabled = count === 0;
  elements.compareBtn.textContent = `Compare (${count})`;
}

function update() {
  const filtered = state.products.filter(productMatchesFilters);
  state.filtered = sortProducts(filtered);
  renderGrid(state.filtered);
  renderFilters(buildFacetOptions(state.filtered.length ? state.filtered : state.products));
  updateCompareBtn();
}

function attachEvents() {
  const debounce = (fn, delay = 250) => {
    let t = null;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  };

  elements.search.addEventListener("input", debounce((e) => {
    state.searchQuery = e.target.value || "";
    update();
  }, 200));

  elements.sort.addEventListener("change", (e) => {
    state.sort = e.target.value;
    update();
  });

  elements.clearFilters.addEventListener("click", () => {
    state.selectedBrands.clear();
    state.selectedTags.clear();
    state.searchQuery = "";
    elements.search.value = "";
    update();
  });

  elements.compareBtn.addEventListener("click", () => {
    showCompare([...state.selectedProductIds]);
  });

  elements.closeDialog.addEventListener("click", () => {
    elements.compareDialog.close();
  });
}

function showCompare(ids) {
  const products = state.products.filter(p => ids.includes(p.id));
  if (products.length === 0) return;
  const table = buildCompareTable(products);
  elements.compareTableWrap.innerHTML = "";
  elements.compareTableWrap.appendChild(table);
  if (!elements.compareDialog.open) elements.compareDialog.showModal();
}

function buildCompareTable(products) {
  const table = document.createElement("table");
  table.className = "table";
  const thead = document.createElement("thead");
  const thr = document.createElement("tr");
  thr.appendChild(document.createElement("th"));
  for (const p of products) {
    const th = document.createElement("th");
    th.textContent = `${p.name}`;
    thr.appendChild(th);
  }
  thead.appendChild(thr);

  const tbody = document.createElement("tbody");

  // Basic rows
  addRow("Price", products.map(p => p.price), (v) => formatPrice(v), tbody, false);
  addRow("Rating", products.map(p => p.rating), (v) => `${v.toFixed(1)}★`, tbody, true);

  // Union of feature keys
  const featureKeys = new Set();
  for (const p of products) for (const k of Object.keys(p.features || {})) featureKeys.add(k);

  for (const key of [...featureKeys]) {
    const values = products.map(p => p.features?.[key]);
    const isNumeric = values.every(v => typeof v === "number");
    const format = (v) => typeof v === "boolean" ? (v ? "Yes" : "No") : (v ?? "—");
    const higherIsBetter = inferHigherIsBetter(key);
    addRow(key, values, format, tbody, isNumeric && higherIsBetter, isNumeric && !higherIsBetter);
  }

  table.append(thead, tbody);
  return table;
}

function inferHigherIsBetter(key) {
  const lowerIsBetterKeywords = ["weight", "latency", "cost"];
  const k = key.toLowerCase();
  for (const w of lowerIsBetterKeywords) if (k.includes(w)) return false;
  return true; // default
}

function addRow(label, values, formatter, tbody, markHigh = false, markLow = false) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.textContent = label;
  tr.appendChild(th);

  let maxV = -Infinity, minV = Infinity;
  for (const v of values) {
    if (typeof v === "number") {
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
  }

  tbody.appendChild(tr);

  values.forEach((v) => {
    const td = document.createElement("td");
    td.textContent = formatter(v);
    if (typeof v === "number") {
      if (markHigh && v === maxV) td.classList.add("good");
      if (markLow && v === minV) td.classList.add("good");
      if (markHigh && v === minV) td.classList.add("bad");
      if (markLow && v === maxV) td.classList.add("bad");
    }
    tr.appendChild(td);
  });
}

(async function init() {
  const products = await loadProducts();
  state.products = products;
  attachEvents();
  renderFilters(buildFacetOptions(products));
  update();
})();
