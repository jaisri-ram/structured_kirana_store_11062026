// ─────────────────────────────────────────────
// admin.js  —  all logic for the admin panel
// Requires: config.js, api.js loaded first
// ─────────────────────────────────────────────

let adminProducts      = [];
let adminOrders        = [];
let allOrders          = [];
let editingId          = null;
let uploadedImageBase64 = "";

// ── Init ─────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  if (SCRIPT_URL && SCRIPT_URL !== APPS_SCRIPT_PLACEHOLDER) {
    localStorage.setItem("kiranaAdminUrl", SCRIPT_URL);
  }
  if (sessionStorage.getItem("kiranaLoggedIn") === "yes") {
    document.getElementById("loginScreen").style.display = "none";
    loadItems();
  } else {
    setTimeout(() => {
      const p = document.getElementById("passwordInput");
      if (p) p.focus();
    }, 300);
  }
});

// ── Login / Logout ───────────────────────────
async function verifyPasswordWithSheet(inputPwd) {
  if (!isConfigured()) return inputPwd === DEFAULT_PASSWORD;
  try {
    const data = await securePost({ action: "verifyPassword", password: inputPwd });
    if (data.error === "not_configured" || data.error === "network") {
      return inputPwd === DEFAULT_PASSWORD;
    }
    return data.valid === true;
  } catch (e) {
    return inputPwd === DEFAULT_PASSWORD;
  }
}

async function checkLogin() {
  const input = document.getElementById("passwordInput").value;
  const errEl = document.getElementById("loginError");
  const btn   = document.querySelector(".login-btn");
  if (!input) { errEl.classList.add("show"); setTimeout(() => errEl.classList.remove("show"), 2000); return; }
  btn.textContent = "Checking...";
  btn.disabled    = true;
  const isValid   = await verifyPasswordWithSheet(input);
  btn.textContent = "🔓 Login";
  btn.disabled    = false;
  if (isValid) {
    sessionStorage.setItem("kiranaLoggedIn", "yes");
    sessionStorage.setItem("kiranaSessionPwd", input);
    document.getElementById("loginScreen").style.display = "none";
    loadItems();
  } else {
    errEl.classList.add("show");
    document.getElementById("passwordInput").value = "";
    document.getElementById("passwordInput").focus();
    setTimeout(() => errEl.classList.remove("show"), 3000);
  }
}

function logout() {
  if (confirm("Logout from admin panel?")) {
    sessionStorage.removeItem("kiranaLoggedIn");
    sessionStorage.removeItem("kiranaSessionPwd");
    location.reload();
  }
}

// ── Settings ─────────────────────────────────
function openSettings() {
  ["currentPwdInput","newPwdInput","confirmPwdInput"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  ["pwdMsg","bannerMsg"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.className = "settings-msg"; el.textContent = ""; }
  });
  document.getElementById("settingsOverlay").classList.add("open");
  loadBannerIntoSettings();
}

function closeSettings() {
  document.getElementById("settingsOverlay").classList.remove("open");
}

function showSettingsMsg(elId, text, type) {
  const el = document.getElementById(elId);
  el.textContent = text;
  el.className   = "settings-msg " + type;
  if (type === "success") setTimeout(() => { el.className = "settings-msg"; el.textContent = ""; }, 4000);
}

async function saveBanner() {
  const banner = document.getElementById("bannerTextInput").value.trim();
  const active = document.getElementById("bannerActiveCheck").checked;
  showSettingsMsg("bannerMsg", "⏳ Saving banner...", "success");
  if (!isConfigured()) {
    localStorage.setItem("kiranaBanner", JSON.stringify({ banner, active }));
    showSettingsMsg("bannerMsg", "✅ Banner saved (demo mode)!", "success");
    return;
  }
  try {
    const result = await adminCall({ action: "setBanner", banner, active });
    if (result.success) {
      showSettingsMsg("bannerMsg", "✅ Banner saved! Customers will see it on the shop page.", "success");
    } else {
      showSettingsMsg("bannerMsg", "❌ Could not save: " + (result.error || "unknown"), "error");
    }
  } catch (e) {
    showSettingsMsg("bannerMsg", "❌ Network error: " + e.message, "error");
  }
}

async function loadBannerIntoSettings() {
  if (!isConfigured()) {
    try {
      const local = JSON.parse(localStorage.getItem("kiranaBanner") || "{}");
      document.getElementById("bannerTextInput").value  = local.banner || "";
      document.getElementById("bannerActiveCheck").checked = local.active !== false;
    } catch (e) {}
    return;
  }
  try {
    const res  = await fetch(`${getAdminUrl()}?action=getBanner&t=${Date.now()}`, { redirect: "follow" });
    const data = await res.json();
    document.getElementById("bannerTextInput").value   = data.banner || "";
    document.getElementById("bannerActiveCheck").checked = data.active !== false;
  } catch (e) {}
}

async function changePassword() {
  const currentPwd = document.getElementById("currentPwdInput").value.trim();
  const newPwd     = document.getElementById("newPwdInput").value.trim();
  const confirmPwd = document.getElementById("confirmPwdInput").value.trim();

  if (!currentPwd)               { showSettingsMsg("pwdMsg", "❌ Enter your current password!", "error"); return; }
  if (!newPwd || newPwd.length < 4) { showSettingsMsg("pwdMsg", "❌ New password must be at least 4 characters!", "error"); return; }
  if (newPwd !== confirmPwd)     { showSettingsMsg("pwdMsg", "❌ New passwords do not match!", "error"); return; }
  if (currentPwd === newPwd)     { showSettingsMsg("pwdMsg", "❌ New password must be different from current!", "error"); return; }

  showSettingsMsg("pwdMsg", "⏳ Verifying current password...", "success");
  const isCurrentValid = await verifyPasswordWithSheet(currentPwd);
  if (!isCurrentValid) {
    showSettingsMsg("pwdMsg", "❌ Current password is wrong!", "error");
    document.getElementById("currentPwdInput").value = "";
    return;
  }
  if (!isConfigured()) {
    showSettingsMsg("pwdMsg", "⚠️ Apps Script URL not set. Cannot save to Sheet yet.", "error");
    return;
  }
  try {
    const result = await adminCall({ action: "updateAdminPassword", newPassword: newPwd });
    if (result.error === "Unauthorized") {
      showSettingsMsg("pwdMsg", "❌ Unauthorized. Please logout and login again.", "error");
      return;
    }
    sessionStorage.setItem("kiranaSessionPwd", newPwd);
    showSettingsMsg("pwdMsg", "✅ Password updated!", "success");
    ["currentPwdInput","newPwdInput","confirmPwdInput"].forEach(id => {
      document.getElementById(id).value = "";
    });
  } catch (e) {
    showSettingsMsg("pwdMsg", "⚠️ Network error: " + e.message, "error");
  }
}

// ── Tab Switching ────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['items','orders'][i] === tab);
  });
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'items')  loadItems();
  if (tab === 'orders') loadOrders();
}

// ── Items: Load, Filter, Render ──────────────
async function loadItems() {
  document.getElementById("itemsList").innerHTML = "<div class='loading-orders'>⏳ Loading items...</div>";
  if (!isConfigured()) {
    adminProducts = DEMO_PRODUCTS;
    renderItems();
    return;
  }
  try {
    const data = await publicGet('getProducts');
    adminProducts = data.products || [];
    renderItems();
  } catch (e) {
    document.getElementById("itemsList").innerHTML =
      "<div class='loading-orders'>⚠️ Connection failed. Check your Apps Script URL.</div>";
  }
}

function applyItemFilter() {
  const q = document.getElementById("itemSearchInput").value.toLowerCase().trim();
  const filtered = adminProducts.filter(p =>
    !q ||
    String(p.name).toLowerCase().includes(q) ||
    String(p.nameTel).toLowerCase().includes(q) ||
    String(p.category).toLowerCase().includes(q) ||
    String(p.price).includes(q) ||
    String(p.mrp || "").includes(q) ||
    String(p.unit).toLowerCase().includes(q) ||
    String(p.qtyOptions || "").toLowerCase().includes(q)
  );
  renderFilteredItems(filtered);
}

function renderItems() {
  const q = document.getElementById("itemSearchInput")?.value?.trim();
  if (q) { applyItemFilter(); return; }
  if (!adminProducts.length) {
    document.getElementById("itemsList").innerHTML =
      "<div class='no-orders'>No items yet. Add your first item! / వస్తువులు లేవు.</div>";
    return;
  }
  renderFilteredItems(adminProducts);
}

function renderFilteredItems(products) {
  const el = document.getElementById("itemsList");
  if (!products.length) {
    el.innerHTML = "<div class='no-orders'>No items match your search.</div>";
    return;
  }

  el.innerHTML = products.map(p => {
    const imgHtml = p.imageUrl
      ? `<img src="${p.imageUrl}" style="width:52px;height:52px;border-radius:10px;object-fit:cover;border:1px solid var(--border);" onerror="this.style.display='none'">`
      : `<div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,#FFF3E0,#FFE0B2);display:flex;align-items:center;justify-content:center;font-size:28px;">🛒</div>`;

    const mrpHtml = p.mrp && parseFloat(p.mrp) > parseFloat(p.price)
      ? `<span style="font-size:11px;text-decoration:line-through;color:var(--text-soft);margin-right:4px;">₹${p.mrp}</span>` : '';
    const discountHtml = p.mrp && parseFloat(p.mrp) > parseFloat(p.price)
      ? `<span style="font-size:10px;background:#E8F5E9;color:#2E7D32;padding:1px 6px;border-radius:50px;font-weight:700;">${Math.round((1 - p.price / p.mrp) * 100)}% OFF</span>` : '';
    const qtyHtml = p.qtyOptions
      ? `<div style="font-size:11px;color:var(--text-soft);margin-top:2px;">Options: ${p.qtyOptions}</div>` : '';

    return `
    <div class="item-card">
      ${imgHtml}
      <div class="item-info">
        <div class="item-name">${p.name}</div>
        ${p.nameTel ? `<div class="item-name-tel">${p.nameTel}</div>` : ''}
        <div class="item-meta">${p.unit || ''}</div>
        ${qtyHtml}
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
          ${mrpHtml}
          <span class="item-price">₹${p.price}</span>
          ${discountHtml}
        </div>
        <div><span class="item-cat">${p.category || 'General'}</span></div>
      </div>
      <div class="item-actions">
        <button class="edit-btn" onclick="openEditModal('${p.id}')">✏️ Edit</button>
        <button class="del-btn"  onclick="deleteItem('${p.id}')">🗑️ Del</button>
      </div>
    </div>`;
  }).join('');
}

// ── Image Handling ───────────────────────────
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 200;
      const ctx   = canvas.getContext("2d");
      const scale = Math.max(200 / img.width, 200 / img.height);
      const sw    = 200 / scale, sh = 200 / scale;
      const sx    = (img.width - sw) / 2, sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 200, 200);

      const TARGET_B64 = 20 * 1024 * 1.37;
      let quality = 0.90;
      let base64  = canvas.toDataURL("image/jpeg", quality);
      while (base64.length > TARGET_B64 && quality > 0.05) {
        quality = Math.round((quality - 0.05) * 100) / 100;
        base64  = canvas.toDataURL("image/jpeg", quality);
      }

      uploadedImageBase64 = base64;
      const sizeKB = Math.round(base64.length * 0.75 / 1024);
      document.getElementById("imgSizeHint").textContent =
        `✅ 200×200 — ~${sizeKB} KB (quality: ${Math.round(quality * 100)}%)`;
      document.getElementById("imagePreview").src          = base64;
      document.getElementById("imagePreviewWrap").style.display = "block";
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  uploadedImageBase64 = "";
  document.getElementById("imagePreview").src              = "";
  document.getElementById("imagePreviewWrap").style.display = "none";
  document.getElementById("imgSizeHint").textContent        = "";
  const fi = document.getElementById("fImageFile");
  if (fi) fi.value = "";
}

// ── Modal: Add / Edit ────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById("modalTitle").textContent = "➕ Add New Item";
  ["fName","fNameTel","fCat","fPrice","fMrp","fUnit","fQtyOptions"].forEach(id => {
    document.getElementById(id).value = "";
  });
  clearImage();
  document.getElementById("modalOverlay").classList.add("open");
}

function openEditModal(id) {
  editingId = id;
  const p   = adminProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById("modalTitle").textContent    = "✏️ Edit Item";
  document.getElementById("fName").value               = p.name       || "";
  document.getElementById("fNameTel").value            = p.nameTel    || "";
  document.getElementById("fCat").value                = p.category   || "";
  document.getElementById("fPrice").value              = p.price      || "";
  document.getElementById("fMrp").value                = p.mrp        || "";
  document.getElementById("fUnit").value               = p.unit       || "";
  document.getElementById("fQtyOptions").value         = p.qtyOptions || "";
  clearImage();
  if (p.imageUrl) {
    document.getElementById("imagePreview").src               = p.imageUrl;
    document.getElementById("imagePreviewWrap").style.display = "block";
    document.getElementById("imgSizeHint").textContent        = "Current image (upload new to replace)";
  }
  document.getElementById("modalOverlay").classList.add("open");
}

function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
  uploadedImageBase64 = "";
}

// ── Save Item ────────────────────────────────
async function saveItem() {
  const name  = document.getElementById("fName").value.trim();
  const price = document.getElementById("fPrice").value.trim();
  if (!name || !price) { alert("Name and price are required!"); return; }

  const saveBtn = document.querySelector(".save-btn");
  saveBtn.textContent = "⏳ Saving...";
  saveBtn.disabled    = true;

  const itemId = editingId || ("P" + Date.now());

  try {
    // Step 1: save image if a new one was chosen
    if (uploadedImageBase64) {
      saveBtn.textContent = "⏳ Saving image...";
      const imgResult = await adminCall({
        action:      editingId ? "updateProductImage" : "addProductImage",
        id:          itemId,
        imageBase64: uploadedImageBase64
      });
      if (!imgResult || !imgResult.success) {
        alert("❌ Image save failed: " + (imgResult?.error || "unknown"));
        saveBtn.textContent = "💾 Save Item";
        saveBtn.disabled    = false;
        return;
      }
    }

    // Step 2: save all other details (never touches imageUrl column)
    saveBtn.textContent = "⏳ Saving details...";
    let detailAction;
    if (editingId)              detailAction = "updateProductDetails";
    else if (uploadedImageBase64) detailAction = "addProductDetails";
    else                        detailAction = "addProductDetailsNew";

    const result = await adminCall({
      action:     detailAction,
      id:         itemId,
      name,
      nameTel:    document.getElementById("fNameTel").value.trim(),
      category:   document.getElementById("fCat").value.trim()        || "General",
      price:      parseFloat(price),
      mrp:        document.getElementById("fMrp").value.trim()        || "",
      unit:       document.getElementById("fUnit").value.trim()       || "per unit",
      qtyOptions: document.getElementById("fQtyOptions").value.trim() || ""
    });

    if (result && result.success) {
      alert("✅ Item saved successfully!");
      uploadedImageBase64 = "";
      clearImage();
      closeModal();
      loadItems();
    } else {
      alert("❌ Details save failed: " + (result?.error || "Unknown error"));
    }
  } catch (err) {
    alert("❌ Network error: " + err.message);
  }

  saveBtn.textContent = "💾 Save Item";
  saveBtn.disabled    = false;
}

// ── Delete Item ──────────────────────────────
async function deleteItem(id) {
  if (!confirm("Delete this item? / ఈ వస్తువు తొలగించాలా?")) return;
  if (!isConfigured()) {
    adminProducts = adminProducts.filter(p => p.id !== id);
    renderItems();
    return;
  }
  try {
    const result = await adminCall({ action: "deleteProduct", id });
    if (result && result.error === "Unauthorized") {
      alert("❌ Unauthorized. Please logout and login again.");
      return;
    }
    loadItems();
  } catch (e) { alert("Delete failed: " + e.message); }
}

// ── Orders: Load, Filter, Render ─────────────
function parseOrderDate(ts) {
  if (!ts) return null;
  const parts = ts.split(",")[0].split("/").map(Number);
  const [d, m, y] = parts[0] > 12 ? parts : [parts[1], parts[0], parts[2]];
  return new Date(y, m - 1, d);
}

function startOfWeek(date) {
  const d   = new Date(date);
  const day = d.getDay() || 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day + 1);
  return d;
}
function endOfWeek(date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return d;
}

async function loadOrders() {
  if (!isConfigured()) {
    adminOrders = allOrders = DEMO_ORDERS;
    renderOrders();
    return;
  }
  document.getElementById("ordersList").innerHTML = "<div class='loading-orders'>⏳ Loading orders...</div>";
  try {
    const data = await adminCall({ action: "getOrders" });
    if (data.error === "Unauthorized") {
      document.getElementById("ordersList").innerHTML =
        "<div class='loading-orders'>🔒 Unauthorized. Please logout and login again.</div>";
      return;
    }
    adminOrders = (data.orders || []).map(o => ({
      orderId:      o.orderId      || o.orderid      || o["Order ID"] || "",
      timestamp:    o.timestamp    || o.Timestamp    || o.time        || "",
      customerName: o.customerName || o.CustomerName || o.name        || "",
      phone:        o.phone        || o.Phone        || o.mobile      || "",
      address:      o.address      || o.Address      || "",
      notes:        o.notes        || o.Notes        || "",
      items:        o.items        || o.Items        || "",
      totalAmount:  o.totalAmount  || o.TotalAmount  || o.total       || 0,
      status:       o.status       || o.Status       || "New",
    }));
    allOrders = adminOrders;
    renderOrders();
  } catch (e) {
    document.getElementById("ordersList").innerHTML =
      `<div class='loading-orders'>⚠️ Could not load orders.<br><small>${e.message}</small></div>`;
  }
}

function applyOrderFilters() {
  const q         = document.getElementById("searchInput").value.toLowerCase();
  const dateType  = document.getElementById("dateFilter").value;
  const fromInput = document.getElementById("fromDate");
  const toInput   = document.getElementById("toDate");

  fromInput.style.display = dateType === "custom" ? "inline-block" : "none";
  toInput.style.display   = dateType === "custom" ? "inline-block" : "none";

  const today = new Date();
  today.setHours(0,0,0,0);
  let fromDate = null, toDate = null;

  switch (dateType) {
    case "today":        fromDate = toDate = new Date(today); break;
    case "yesterday":    { const y = new Date(today); y.setDate(y.getDate() - 1); fromDate = toDate = y; break; }
    case "currentWeek":  fromDate = startOfWeek(new Date()); toDate = endOfWeek(new Date()); break;
    case "lastWeek":     { const lw = new Date(); lw.setDate(lw.getDate() - 7); fromDate = startOfWeek(lw); toDate = endOfWeek(lw); break; }
    case "currentMonth": fromDate = new Date(today.getFullYear(), today.getMonth(), 1);    toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
    case "lastMonth":    fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1); toDate = new Date(today.getFullYear(), today.getMonth(), 0);     break;
    case "custom":
      if (fromInput.value) fromDate = new Date(fromInput.value);
      if (toInput.value)   toDate   = new Date(toInput.value);
      break;
  }

  adminOrders = allOrders.filter(o => {
    const matchesText =
      !q ||
      String(o.orderId).toLowerCase().includes(q) ||
      String(o.customerName).toLowerCase().includes(q) ||
      String(o.address).toLowerCase().includes(q) ||
      String(o.phone).includes(q) ||
      String(o.totalAmount).includes(q) ||
      String(o.status).toLowerCase().includes(q);

    const orderDate  = parseOrderDate(o.timestamp);
    let matchesDate  = true;
    if (fromDate && orderDate) matchesDate = matchesDate && orderDate >= fromDate;
    if (toDate   && orderDate) matchesDate = matchesDate && orderDate <= toDate;
    return matchesText && matchesDate;
  });
  renderOrders();
}

function renderOrders() {
  const el        = document.getElementById("ordersList");
  const newOrders = adminOrders.filter(o => String(o.status).trim() === "New");
  const revenue   = adminOrders.reduce((s, o) => s + (parseFloat(o.totalAmount) || 0), 0);

  document.getElementById("statTotal").textContent   = adminOrders.length;
  document.getElementById("statNew").textContent     = newOrders.length;
  document.getElementById("statRevenue").textContent = `₹${revenue.toFixed(0)}`;

  if (!adminOrders.length) {
    el.innerHTML = "<div class='no-orders'>No orders yet!</div>";
    return;
  }

  el.innerHTML = [...adminOrders].reverse().map((o, idx) => `
    <div class="order-card" id="order-card-${idx}">
      <div class="order-header">
        <div>
          <div class="order-id">#${o.orderId}</div>
          <div class="order-time">${o.timestamp}</div>
        </div>
        <span class="order-status ${o.status === 'New' ? 'status-new' : 'status-done'}">${o.status}</span>
      </div>
      <div class="customer-info">
        <div class="customer-name">👤 ${o.customerName}</div>
        <div class="customer-phone">📞 ${o.phone}</div>
        <div class="customer-address">📍 ${o.address}</div>
        ${o.notes ? `<div style="font-size:12px;color:var(--text-soft);margin-top:3px">💬 ${o.notes}</div>` : ''}
      </div>
      <div class="order-items-list">
        <div style="font-size:12px;font-weight:600;color:var(--text-soft);margin-bottom:6px">ITEMS</div>
        ${(o.items || "").split(", ").map(i =>
          `<div class="order-line">
            <span>${i.split("=")[0]}</span>
            <span style="font-weight:600">${i.split("=")[1] || ""}</span>
          </div>`
        ).join('')}
        <div class="order-total">
          <span>Total</span>
          <span class="order-total-amount">₹${o.totalAmount}</span>
        </div>
      </div>
      ${o.status === "New"
        ? `<button class="mark-done-btn" onclick="markDelivered('${o.orderId}',${idx})">✅ Mark as Delivered</button>`
        : ''}
    </div>
  `).join('');
}

async function markDelivered(orderId, idx) {
  const btn = document.querySelector(`#order-card-${idx} .mark-done-btn`);
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Saving..."; }

  if (!isConfigured()) {
    adminOrders.forEach(o => { if (o.orderId === orderId) o.status = "Delivered"; });
    allOrders.forEach(o => { if (o.orderId === orderId) o.status = "Delivered"; });
    renderOrders();
    return;
  }
  try {
    const result = await adminCall({ action: "markDelivered", orderId });
    if (result.success) {
      adminOrders.forEach(o => { if (o.orderId === orderId) o.status = "Delivered"; });
      allOrders.forEach(o => { if (o.orderId === orderId) o.status = "Delivered"; });
      renderOrders();
    } else {
      alert("Could not update order: " + (result.error || "unknown error"));
      if (btn) { btn.disabled = false; btn.textContent = "✅ Mark as Delivered"; }
    }
  } catch (e) {
    alert("Network error. Please try again.");
    if (btn) { btn.disabled = false; btn.textContent = "✅ Mark as Delivered"; }
  }
}
