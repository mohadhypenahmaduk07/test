const STORAGE_KEY = "stockpilot-pro-state-v1";

const demoState = {
  products: [
    ["prd-1001", "RFID Hand Scanner", "INV-RFID-1001", "Hardware", "Northstar Supply", 42, 25, 145, 32, "Aisle A-01"],
    ["prd-1002", "Thermal Label Roll", "PKG-LBL-2040", "Packaging", "PackRight Co.", 18, 40, 8.5, 95, "Aisle B-08"],
    ["prd-1003", "Barcode Printer", "INV-PRN-3320", "Hardware", "Northstar Supply", 12, 8, 420, 6, "Aisle A-03"],
    ["prd-1004", "Protective Mailer XL", "PKG-MAIL-XL", "Packaging", "PackRight Co.", 220, 120, 1.15, 180, "Aisle C-02"],
    ["prd-1005", "Smart Shelf Sensor", "IOT-SENS-500", "IoT", "Veridian Systems", 9, 20, 69, 24, "Aisle D-04"],
    ["prd-1006", "Cold Chain Monitor", "IOT-COLD-221", "IoT", "Veridian Systems", 34, 14, 118, 10, "Aisle D-01"],
    ["prd-1007", "Pallet Wrap Film", "WH-FILM-908", "Warehouse", "Atlas Industrial", 16, 30, 18.75, 48, "Aisle E-06"],
    ["prd-1008", "Safety Cutter", "WH-CUT-115", "Warehouse", "Atlas Industrial", 88, 35, 6.25, 20, "Aisle E-02"],
  ].map(([id, name, sku, category, supplier, stock, reorder, cost, demand, location]) => ({
    id,
    name,
    sku,
    category,
    supplier,
    stock,
    reorder,
    cost,
    demand,
    location,
  })),
  orders: [
    ["PO-2401", "prd-1002", 150, "Submitted", "2026-05-14"],
    ["PO-2402", "prd-1005", 45, "In Transit", "2026-05-10"],
    ["PO-2403", "prd-1007", 80, "Draft", "2026-05-18"],
    ["PO-2399", "prd-1001", 20, "Received", "2026-05-04"],
  ].map(([id, productId, quantity, status, eta]) => ({ id, productId, quantity, status, eta })),
  activity: [
    "Created reorder recommendation for Smart Shelf Sensor.",
    "Received purchase order PO-2399 for RFID Hand Scanner.",
    "Thermal Label Roll dropped below reorder point.",
    "Updated demand forecast for Packaging category.",
  ],
};

let state = loadState();
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  viewTitle: $("#view-title"),
  navLinks: $$("[data-view-link]"),
  views: $$(".view"),
  totalSkus: $("#totalSkus"),
  activeCategories: $("#activeCategories"),
  inventoryValue: $("#inventoryValue"),
  lowStockCount: $("#lowStockCount"),
  openOrdersCount: $("#openOrdersCount"),
  healthScore: $("#healthScore"),
  healthScoreLabel: $("#healthScoreLabel"),
  healthDonut: $("#healthDonut"),
  healthList: $("#healthList"),
  reorderList: $("#reorderList"),
  activityList: $("#activityList"),
  inventoryTable: $("#inventoryTable"),
  categoryFilter: $("#categoryFilter"),
  statusFilter: $("#statusFilter"),
  searchInput: $("#searchInput"),
  productModal: $("#productModal"),
  productForm: $("#productForm"),
  modalTitle: $("#modalTitle"),
  orderModal: $("#orderModal"),
  orderForm: $("#orderForm"),
  orderProduct: $("#orderProduct"),
  orderBoard: $("#orderBoard"),
  supplierGrid: $("#supplierGrid"),
  categoryChart: $("#categoryChart"),
  forecastList: $("#forecastList"),
  toast: $("#toast"),
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || structuredClone(demoState);
  } catch {
    return structuredClone(demoState);
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function stockStatus(product) {
  const ratio = product.stock / Math.max(product.reorder, 1);
  if (product.stock <= Math.ceil(product.reorder * 0.4)) return "critical";
  if (product.stock < product.reorder) return "low";
  if (ratio >= 3) return "overstock";
  return "healthy";
}

function label(value) {
  return value.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function log(message) {
  state.activity.unshift(message);
  state.activity = state.activity.slice(0, 8);
  save();
}

function filteredProducts() {
  const query = els.searchInput.value.toLowerCase().trim();
  return state.products.filter((product) => {
    const haystack = [product.name, product.sku, product.category, product.supplier, product.location].join(" ").toLowerCase();
    const categoryOk = els.categoryFilter.value === "all" || product.category === els.categoryFilter.value;
    const statusOk = els.statusFilter.value === "all" || stockStatus(product) === els.statusFilter.value;
    return haystack.includes(query) && categoryOk && statusOk;
  });
}

function renderMetrics() {
  const categories = new Set(state.products.map((product) => product.category));
  const inventoryValue = state.products.reduce((sum, product) => sum + product.stock * product.cost, 0);
  const lowCount = state.products.filter((product) => ["low", "critical"].includes(stockStatus(product))).length;
  const healthyCount = state.products.filter((product) => stockStatus(product) === "healthy").length;
  const score = Math.round((healthyCount / Math.max(state.products.length, 1)) * 100);
  const angle = Math.round((score / 100) * 360);

  els.totalSkus.textContent = state.products.length;
  els.activeCategories.textContent = `${categories.size} categories tracked`;
  els.inventoryValue.textContent = money(inventoryValue);
  els.lowStockCount.textContent = lowCount;
  els.openOrdersCount.textContent = state.orders.filter((order) => order.status !== "Received").length;
  els.healthScore.textContent = `${score}%`;
  els.healthScoreLabel.textContent = `${score}% healthy`;
  els.healthDonut.style.background = `conic-gradient(var(--teal) 0deg, var(--teal) ${angle}deg, #e8eee8 ${angle}deg, #e8eee8 360deg)`;
}

function renderHealth() {
  const counts = { healthy: 0, low: 0, critical: 0, overstock: 0 };
  state.products.forEach((product) => counts[stockStatus(product)]++);
  const rows = [
    ["Healthy", "healthy", counts.healthy, "Ready for expected demand"],
    ["Low Stock", "low", counts.low, "Needs purchase planning"],
    ["Critical", "critical", counts.critical, "Immediate replenishment risk"],
    ["Overstock", "overstock", counts.overstock, "Potential carrying cost issue"],
  ];
  els.healthList.innerHTML = rows
    .map(
      ([title, key, count, meta]) => `
      <div class="health-row">
        <div><div class="row-title">${title}</div><p class="row-meta">${meta}</p></div>
        <span class="status-badge ${key}">${count}</span>
      </div>`,
    )
    .join("");
}

function renderReorders() {
  const products = state.products
    .filter((product) => ["low", "critical"].includes(stockStatus(product)))
    .sort((a, b) => a.stock / Math.max(a.reorder, 1) - b.stock / Math.max(b.reorder, 1));
  els.reorderList.innerHTML = products.length
    ? products
        .map((product) => {
          const quantity = Math.max(product.reorder * 2 - product.stock, product.demand);
          return `
          <div class="compact-row">
            <div><div class="row-title">${product.name}</div><p class="row-meta">${product.supplier} - ${product.stock} in stock</p></div>
            <button class="ghost-button" data-reorder="${product.id}" type="button">${quantity} units</button>
          </div>`;
        })
        .join("")
    : `<div class="empty-state">No low-stock items right now.</div>`;
}

function renderActivity() {
  els.activityList.innerHTML = state.activity
    .map(
      (item, index) => `
      <div class="activity-row">
        <div><div class="row-title">${item}</div><p class="row-meta">${index ? `${index + 1} updates ago` : "Just now"}</p></div>
        <span class="muted-pill">Log</span>
      </div>`,
    )
    .join("");
}

function renderFilters() {
  const current = els.categoryFilter.value;
  const categories = [...new Set(state.products.map((product) => product.category))].sort();
  els.categoryFilter.innerHTML = `<option value="all">All categories</option>${categories
    .map((category) => `<option value="${category}">${category}</option>`)
    .join("")}`;
  els.categoryFilter.value = categories.includes(current) ? current : "all";
}

function renderInventory() {
  const products = filteredProducts();
  els.inventoryTable.innerHTML = products.length
    ? products
        .map((product) => {
          const status = stockStatus(product);
          const fill = Math.min(Math.round((product.stock / Math.max(product.reorder * 2, 1)) * 100), 100);
          return `
          <tr>
            <td><strong>${product.sku}</strong></td>
            <td class="product-cell"><strong>${product.name}</strong><span>${product.location}</span></td>
            <td>${product.category}</td>
            <td><div class="stock-meter"><span>${product.stock} units</span><div class="meter-track"><div class="meter-fill" style="width:${fill}%"></div></div></div></td>
            <td>${product.reorder}</td>
            <td>${product.supplier}</td>
            <td>${money(product.stock * product.cost)}</td>
            <td><span class="status-badge ${status}">${label(status)}</span></td>
            <td>
              <div class="action-group">
                <button class="icon-button" data-edit="${product.id}" type="button" aria-label="Edit ${product.name}" title="Edit product"><i data-lucide="pencil"></i></button>
                <button class="icon-button" data-delete="${product.id}" type="button" aria-label="Delete ${product.name}" title="Delete product"><i data-lucide="trash-2"></i></button>
              </div>
            </td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="9"><div class="empty-state">No products match the current filters.</div></td></tr>`;
}

function renderOrders() {
  const statuses = ["Draft", "Submitted", "In Transit", "Received"];
  els.orderBoard.innerHTML = statuses
    .map((status) => {
      const orders = state.orders.filter((order) => order.status === status);
      const cards = orders.length
        ? orders
            .map((order) => {
              const product = state.products.find((item) => item.id === order.productId) || { name: "Deleted product", supplier: "Unknown", cost: 0 };
              return `
              <article class="order-card">
                <div><strong>${order.id}</strong><p>${product.name}</p></div>
                <p>${order.quantity} units - ${product.supplier}</p>
                <p>ETA ${order.eta}</p>
                <span class="status-badge ${status.toLowerCase().replace(" ", "-")}">${money(order.quantity * product.cost)}</span>
              </article>`;
            })
            .join("")
        : `<div class="empty-state">No ${status.toLowerCase()} orders.</div>`;
      return `<section class="order-column"><h3>${status}<span class="muted-pill">${orders.length}</span></h3>${cards}</section>`;
    })
    .join("");
}

function renderSuppliers() {
  const suppliers = {};
  state.products.forEach((product) => {
    suppliers[product.supplier] ||= { name: product.supplier, skus: 0, value: 0, low: 0, categories: new Set() };
    suppliers[product.supplier].skus++;
    suppliers[product.supplier].value += product.stock * product.cost;
    suppliers[product.supplier].categories.add(product.category);
    if (["low", "critical"].includes(stockStatus(product))) suppliers[product.supplier].low++;
  });
  els.supplierGrid.innerHTML = Object.values(suppliers)
    .map((supplier) => {
      const initials = supplier.name.split(" ").slice(0, 2).map((word) => word[0]).join("");
      return `
      <article class="supplier-card">
        <div class="supplier-card-header">
          <div class="supplier-logo">${initials}</div>
          <span class="status-badge ${supplier.low ? "low" : "healthy"}">${supplier.low ? "Watch" : "Stable"}</span>
        </div>
        <h2>${supplier.name}</h2>
        <dl>
          <div><dt>SKUs</dt><dd>${supplier.skus}</dd></div>
          <div><dt>Value</dt><dd>${money(supplier.value)}</dd></div>
          <div><dt>Categories</dt><dd>${supplier.categories.size}</dd></div>
          <div><dt>Low Items</dt><dd>${supplier.low}</dd></div>
        </dl>
      </article>`;
    })
    .join("");
}

function renderAnalytics() {
  const categoryValues = {};
  state.products.forEach((product) => {
    categoryValues[product.category] = (categoryValues[product.category] || 0) + product.stock * product.cost;
  });
  const max = Math.max(...Object.values(categoryValues), 1);
  els.categoryChart.innerHTML = Object.entries(categoryValues)
    .sort((a, b) => b[1] - a[1])
    .map(([category, value]) => `<div class="bar-row"><strong>${category}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.round((value / max) * 100)}%"></div></div><span>${money(value)}</span></div>`)
    .join("");

  els.forecastList.innerHTML = state.products
    .map((product) => ({ ...product, daysLeft: product.demand ? Math.round((product.stock / product.demand) * 30) : 999 }))
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 6)
    .map((product) => `<div class="forecast-row"><div><div class="row-title">${product.name}</div><p class="row-meta">${product.demand} units/month demand</p></div><span class="status-badge ${product.daysLeft < 15 ? "critical" : product.daysLeft < 35 ? "low" : "healthy"}">${product.daysLeft} days</span></div>`)
    .join("");
}

function renderOrderOptions() {
  els.orderProduct.innerHTML = state.products.map((product) => `<option value="${product.id}">${product.name} - ${product.sku}</option>`).join("");
}

function renderAll() {
  renderMetrics();
  renderHealth();
  renderReorders();
  renderActivity();
  renderFilters();
  renderInventory();
  renderOrders();
  renderSuppliers();
  renderAnalytics();
  renderOrderOptions();
  window.lucide?.createIcons();
}

function openProductModal(product = null) {
  els.productForm.reset();
  els.modalTitle.textContent = product ? "Edit Product" : "Add Product";
  $("#productId").value = product?.id || "";
  $("#productName").value = product?.name || "";
  $("#productSku").value = product?.sku || "";
  $("#productCategory").value = product?.category || "";
  $("#productSupplier").value = product?.supplier || "";
  $("#productStock").value = product?.stock ?? "";
  $("#productReorder").value = product?.reorder ?? "";
  $("#productCost").value = product?.cost ?? "";
  $("#productDemand").value = product?.demand ?? "";
  els.productModal.showModal();
}

function saveProduct(event) {
  event.preventDefault();
  const id = $("#productId").value || `prd-${Date.now().toString(36)}`;
  const existing = state.products.find((product) => product.id === id);
  const product = {
    id,
    name: $("#productName").value.trim(),
    sku: $("#productSku").value.trim().toUpperCase(),
    category: $("#productCategory").value.trim(),
    supplier: $("#productSupplier").value.trim(),
    stock: Number($("#productStock").value),
    reorder: Number($("#productReorder").value),
    cost: Number($("#productCost").value),
    demand: Number($("#productDemand").value),
    location: existing?.location || "Unassigned",
  };
  state.products = existing ? state.products.map((item) => (item.id === id ? product : item)) : [product, ...state.products];
  log(`${existing ? "Updated" : "Added"} product record for ${product.name}.`);
  els.productModal.close();
  toast(existing ? "Product updated." : "Product added.");
  renderAll();
}

function createOrder(productId, quantity, status = "Draft", etaDays = 10) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const order = {
    id: `PO-${Math.floor(2400 + Math.random() * 900)}`,
    productId,
    quantity,
    status,
    eta: new Date(Date.now() + etaDays * 86400000).toISOString().slice(0, 10),
  };
  state.orders.unshift(order);
  log(`Created purchase order ${order.id} for ${product.name}.`);
  toast("Purchase order created.");
}

function saveOrder(event) {
  event.preventDefault();
  createOrder(els.orderProduct.value, Number($("#orderQuantity").value), $("#orderStatus").value);
  state.orders[0].eta = $("#orderEta").value;
  save();
  els.orderModal.close();
  renderAll();
}

function createReorder(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  createOrder(product.id, Math.max(product.reorder * 2 - product.stock, product.demand));
  save();
  renderAll();
}

function exportCsv() {
  const rows = [
    ["SKU", "Product", "Category", "Supplier", "Stock", "Reorder Point", "Unit Cost", "Monthly Demand", "Status"],
    ...state.products.map((product) => [product.sku, product.name, product.category, product.supplier, product.stock, product.reorder, product.cost, product.demand, label(stockStatus(product))]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "stockpilot-inventory-export.csv";
  link.click();
  URL.revokeObjectURL(url);
  toast("Inventory CSV exported.");
}

function syncView() {
  const id = (location.hash || "#dashboard").slice(1);
  const target = $(`#${id}`);
  if (!target) return;
  els.views.forEach((view) => view.classList.toggle("active", view.id === id));
  els.navLinks.forEach((link) => link.classList.toggle("active", link.dataset.viewLink === id));
  els.viewTitle.textContent = target.dataset.title;
}

function bind() {
  addEventListener("hashchange", syncView);
  $("#addProductBtn").addEventListener("click", () => openProductModal());
  $("#closeModalBtn").addEventListener("click", () => els.productModal.close());
  $("#cancelProductBtn").addEventListener("click", () => els.productModal.close());
  els.productForm.addEventListener("submit", saveProduct);

  $("#newOrderBtn").addEventListener("click", () => {
    els.orderForm.reset();
    $("#orderEta").value = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    els.orderModal.showModal();
  });
  $("#closeOrderModalBtn").addEventListener("click", () => els.orderModal.close());
  $("#cancelOrderBtn").addEventListener("click", () => els.orderModal.close());
  els.orderForm.addEventListener("submit", saveOrder);

  $("#exportBtn").addEventListener("click", exportCsv);
  $("#resetDemoBtn").addEventListener("click", () => {
    state = structuredClone(demoState);
    save();
    renderAll();
    toast("Demo data restored.");
  });
  $("#createReorderBtn").addEventListener("click", () => {
    state.products.filter((product) => ["low", "critical"].includes(stockStatus(product))).forEach((product) => createReorder(product.id));
  });
  [els.searchInput, els.categoryFilter, els.statusFilter].forEach((input) => input.addEventListener("input", renderInventory));

  document.body.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const remove = event.target.closest("[data-delete]");
    const reorder = event.target.closest("[data-reorder]");
    if (edit) openProductModal(state.products.find((product) => product.id === edit.dataset.edit));
    if (reorder) createReorder(reorder.dataset.reorder);
    if (remove) {
      const product = state.products.find((item) => item.id === remove.dataset.delete);
      state.products = state.products.filter((item) => item.id !== remove.dataset.delete);
      log(`Removed ${product.name} from inventory.`);
      toast("Product deleted.");
      renderAll();
    }
  });
}

bind();
syncView();
renderAll();
