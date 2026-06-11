// ─────────────────────────────────────────────
// shop.js  —  all logic for the shop / index page
// Requires: config.js, api.js loaded first
// ─────────────────────────────────────────────

let allProducts   = [];
let cart          = {};   // { productId: { ...product, qty } }
let activeCategory = "All";

// ── Init ─────────────────────────────────────
window.addEventListener("DOMContentLoaded", () => {
  fetchProducts();
  fetchBanner();
});

// ── Product Fetching ─────────────────────────
async function fetchProducts() {
  if (!isConfigured()) {
    allProducts = DEMO_PRODUCTS;
    showConfigBanner();
    renderCategories();
    renderProducts(allProducts);
    return;
  }
  try {
    const res  = await fetch(`${getAdminUrl()}?action=getProducts`);
    const data = await res.json();
    allProducts = data.products || [];
    renderCategories();
    renderProducts(allProducts);
  } catch (e) {
    document.getElementById("productsGrid").innerHTML =
      `<div class="no-items">⚠️ Could not load items. Please check your connection.<br><br>
       <span class="telugu">వస్తువులు లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించండి.</span></div>`;
  }
}

function showConfigBanner() {
  const sec    = document.querySelector('.products-section');
  const banner = document.createElement('div');
  banner.className = 'config-banner';
  banner.innerHTML = `⚙️ <strong>Demo Mode:</strong> Connect your Google Sheets to show real products.
    <span class="telugu"> డెమో మోడ్ లో ఉంది. అసలు వస్తువులు చూపించడానికి Google Sheets జోడించండి.</span>`;
  sec.insertBefore(banner, sec.firstChild);
}

// ── Categories ───────────────────────────────
function renderCategories() {
  const bar = document.getElementById("categoriesBar");
  const cats = ["All", ...new Set(allProducts.map(p => p.category).filter(Boolean))];
  bar.innerHTML = cats.map(c =>
    `<button class="cat-chip ${c === activeCategory ? 'active' : ''}" onclick="selectCategory('${c}')">${c}</button>`
  ).join('');
}

function selectCategory(cat) {
  activeCategory = cat;
  renderCategories();
  filterProducts();
}

// ── Filter ───────────────────────────────────
function filterProducts() {
  const q = document.getElementById("searchInput").value.toLowerCase();
  let items = allProducts;
  if (activeCategory !== "All") items = items.filter(p => p.category === activeCategory);
  if (q) items = items.filter(p =>
    p.name.toLowerCase().includes(q) || (p.nameTel || "").includes(q)
  );
  renderProducts(items);
}

// ── Render Products ──────────────────────────
function renderProducts(items) {
  const grid = document.getElementById("productsGrid");
  if (!items.length) {
    grid.innerHTML = `<div class="no-items" style="grid-column:1/-1">😔 No items found.<br>
      <span class="telugu">వస్తువులు కనుగొనబడలేదు.</span></div>`;
    return;
  }

  grid.innerHTML = items.map((p, i) => {
    const inCart     = cart[p.id];
    const qty        = inCart ? inCart.qty : 0;
    const imgContent = p.imageUrl
      ? `<img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='🛒'">`
      : (p.emoji || '🛒');

    const hasMrp     = p.mrp && parseFloat(p.mrp) > parseFloat(p.price);
    const discountPct = hasMrp ? Math.round((1 - parseFloat(p.price) / parseFloat(p.mrp)) * 100) : 0;
    const priceHtml  = hasMrp
      ? `<div class="product-price" id="price-display-${p.id}">
           ₹${p.price}
           <span class="price-mrp">₹${p.mrp}</span>
           <span class="price-discount">↓${discountPct}% OFF</span>
         </div>`
      : `<div class="product-price" id="price-display-${p.id}">₹${p.price} <span>/ ${p.unit || 'unit'}</span></div>`;

    const variants    = p.qtyOptions ? p.qtyOptions.split(',').map(v => v.trim()).filter(Boolean) : [];
    const variantsHtml = variants.length > 1
      ? `<div class="qty-variants" id="variants-${p.id}"
             data-variant-price="${p.price}" data-variant-mrp="${p.mrp || ''}" data-variant-label="${variants[0]}">
           ${variants.map((v, vi) =>
             `<button class="qty-chip${vi === 0 ? ' selected' : ''}" onclick="selectVariant('${p.id}', ${vi})">${v}</button>`
           ).join('')}
         </div>`
      : '';

    return `
    <div class="product-card" style="animation-delay:${i * 0.05}s">
      <div class="product-img">${imgContent}</div>
      <div class="product-body">
        <div class="product-name">${p.name}</div>
        ${p.nameTel ? `<div class="product-name-tel">${p.nameTel}</div>` : ''}
        <div class="product-unit">${p.price + '/' + p.unit || ''}</div>
        ${priceHtml}
        ${variantsHtml}
        <div class="qty-controls">
          <button class="qty-btn qty-minus" onclick="changeLocalQty('${p.id}', -1)">−</button>
          <span class="qty-num" id="qty-${p.id}">${qty}</span>
          <button class="qty-btn qty-plus" onclick="changeLocalQty('${p.id}', 1)">+</button>
        </div>
        <button class="add-btn ${qty > 0 ? 'added' : ''}" id="addbtn-${p.id}" onclick="addToCart('${p.id}')">
          ${qty > 0 ? '✅ Added / జోడించబడింది' : '+ Add to Cart / కార్ట్ కు జోడించు'}
        </button>
      </div>
    </div>`;
  }).join('');

  // Trigger first-variant price calculation for each product with variants
  items.forEach(p => {
    if (p.qtyOptions && p.qtyOptions.split(',').filter(Boolean).length > 1) {
      selectVariant(String(p.id), 0);
    }
  });
}

// ── Variant Selection ────────────────────────
function parseBaseUnit(unitStr) {
  const u = unitStr.toLowerCase().trim();
  if (u.includes("per kg"))                                    return { qty: 1000, unit: "g" };
  if (u.includes("per litre") || u.includes("per liter"))     return { qty: 1000, unit: "ml" };
  const match = u.match(/per\s*(\d+)\s*(g|ml)/);
  if (match) return { qty: parseFloat(match[1]), unit: match[2] };
  return null;
}

function selectVariant(productId, vi) {
  const wrap = document.getElementById(`variants-${productId}`);
  if (!wrap) return;

  const chips = wrap.querySelectorAll('.qty-chip');
  chips.forEach((c, idx) => c.classList.toggle('selected', idx === vi));

  const product      = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  const variantLabel = chips[vi]?.textContent.trim() || "";
  const basePrice    = parseFloat(product.price);
  let variantPrice   = basePrice;
  let variantMrp     = product.mrp ? parseFloat(product.mrp) : 0;
  const baseUnit     = parseBaseUnit(product.unit);

  if (baseUnit) {
    const m = variantLabel.toLowerCase().match(/([\d.]+)\s*(g|kg|ml|l)/);
    if (m) {
      let qty  = parseFloat(m[1]);
      const unit = m[2];
      if (unit === "kg") qty *= 1000;
      if (unit === "l")  qty *= 1000;
      variantPrice = (qty / baseUnit.qty) * basePrice;
      if (variantMrp) variantMrp = (qty / baseUnit.qty) * variantMrp;
    }
  }

  variantPrice = Math.round(variantPrice * 100) / 100;
  variantMrp   = Math.round(variantMrp   * 100) / 100;

  const priceEl = document.getElementById(`price-display-${productId}`);
  if (priceEl) {
    const hasMrp = variantMrp > variantPrice;
    const disc   = hasMrp ? Math.round((1 - variantPrice / variantMrp) * 100) : 0;
    priceEl.innerHTML = hasMrp
      ? `₹${variantPrice} <span class="price-mrp">₹${variantMrp}</span>
         <span class="price-discount">↓${disc}% OFF</span>`
      : `₹${variantPrice} <span>/ ${variantLabel}</span>`;
  }

  wrap.dataset.variantPrice = variantPrice;
  wrap.dataset.variantMrp   = variantMrp;
  wrap.dataset.variantLabel = variantLabel;
}

// ── Local Qty & Add to Cart ──────────────────
function changeLocalQty(id, delta) {
  const el  = document.getElementById(`qty-${id}`);
  let val   = parseInt(el.textContent) + delta;
  if (val < 0) val = 0;
  el.textContent = val;
}

function addToCart(id) {
  const product = allProducts.find(p => String(p.id) === String(id));
  const qty     = parseInt(document.getElementById(`qty-${id}`).textContent);

  if (qty === 0) { alert("Please select quantity first! / ముందుగా పరిమాణం ఎంచుకోండి!"); return; }
  if (!product)  { alert("Item not found. Please refresh the page. / పేజీని రిఫ్రెష్ చేయండి."); return; }

  const variantWrap    = document.getElementById(`variants-${id}`);
  let effectivePrice   = parseFloat(product.price);
  let variantLabel     = "";
  if (variantWrap) {
    const dp = parseFloat(variantWrap.dataset.variantPrice);
    if (!isNaN(dp) && dp > 0) effectivePrice = dp;
    variantLabel = variantWrap.dataset.variantLabel || "";
  }

  cart[String(id)] = { ...product, id: String(id), price: effectivePrice, qty, variantLabel };
  updateCartUI();
  const btn = document.getElementById(`addbtn-${id}`);
  btn.textContent = '✅ Added / జోడించబడింది';
  btn.classList.add('added');
}

function updateCartUI() {
  const total = Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0);
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);
  document.getElementById("cartCount").textContent = count;
  document.getElementById("cartFab").classList.toggle("visible", count > 0);
}

// ── Cart Drawer ──────────────────────────────
function openCart() {
  document.getElementById("overlay").classList.add("open");
  document.getElementById("cartDrawer").classList.add("open");
  renderCartDrawer();
}

function closeCart() {
  document.getElementById("overlay").classList.remove("open");
  document.getElementById("cartDrawer").classList.remove("open");
}

function renderCartDrawer() {
  const items   = Object.values(cart);
  const list    = document.getElementById("cartItemsList");
  const formSec = document.getElementById("orderFormSection");
  const totalDiv = document.getElementById("cartTotal");

  if (!items.length) {
    list.innerHTML = `<div class="empty-cart">
      <div class="emoji">🛒</div>
      <div>Your cart is empty<br><span class="telugu">మీ కార్ట్ ఖాళీగా ఉంది</span></div>
    </div>`;
    formSec.style.display  = "none";
    totalDiv.style.display = "none";
    return;
  }

  list.innerHTML = items.map(item => {
    const imgHtml    = item.imageUrl
      ? `<img src="${item.imageUrl}" style="width:38px;height:38px;border-radius:8px;object-fit:cover;border:1px solid var(--border);" onerror="this.outerHTML='<span style=font-size:24px>${item.emoji || '🛒'}</span>'">`
      : `<span style="font-size:26px;">${item.emoji || '🛒'}</span>`;
    const variantTag = item.variantLabel
      ? `<span style="font-size:11px;background:var(--saffron-glow);color:var(--saffron);padding:1px 7px;border-radius:50px;font-weight:600;">${item.variantLabel}</span>`
      : '';
    return `
    <div class="cart-item">
      <div class="cart-item-emoji">${imgHtml}</div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name} ${variantTag}</div>
        <div class="cart-item-price">₹${item.price} × ${item.qty} = ₹${item.price * item.qty}</div>
      </div>
      <div class="cart-item-controls">
        <button class="ci-btn ci-minus" onclick="changeCartQty('${item.id}', -1)">−</button>
        <span class="ci-qty">${item.qty}</span>
        <button class="ci-btn ci-plus" onclick="changeCartQty('${item.id}', 1)">+</button>
        <button class="ci-del" onclick="removeFromCart('${item.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  document.getElementById("totalAmount").textContent = `₹${total}`;
  totalDiv.style.display  = "flex";
  formSec.style.display   = "block";
}

function changeCartQty(id, delta) {
  const sid = String(id);
  if (!cart[sid]) return;
  cart[sid].qty += delta;
  if (cart[sid].qty <= 0) delete cart[sid];
  updateCartUI();
  renderCartDrawer();
  const qtyEl = document.getElementById(`qty-${sid}`);
  const btn   = document.getElementById(`addbtn-${sid}`);
  if (qtyEl) qtyEl.textContent = cart[sid] ? cart[sid].qty : 0;
  if (btn) {
    if (cart[sid]) { btn.textContent = '✅ Added / జోడించబడింది'; btn.classList.add('added'); }
    else           { btn.textContent = '+ Add to Cart / కార్ట్ కు జోడించు'; btn.classList.remove('added'); }
  }
}

function removeFromCart(id) {
  const sid = String(id);
  delete cart[sid];
  updateCartUI();
  renderCartDrawer();
  const qtyEl = document.getElementById(`qty-${sid}`);
  const btn   = document.getElementById(`addbtn-${sid}`);
  if (qtyEl) qtyEl.textContent = 0;
  if (btn)   { btn.textContent = '+ Add to Cart / కార్ట్ కు జోడించు'; btn.classList.remove('added'); }
}

// ── Place Order ──────────────────────────────
async function placeOrder() {
  const name    = document.getElementById("custName").value.trim();
  const phone   = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  const notes   = document.getElementById("custNotes").value.trim();

  if (!name)                        { alert("Please enter your name! / మీ పేరు నమోదు చేయండి!"); return; }
  if (!phone || phone.length !== 10){ alert("Please enter a valid 10-digit phone number! / సరైన 10-అంకెల ఫోన్ నంబర్ నమోదు చేయండి!"); return; }
  if (!address)                     { alert("Please enter delivery address! / డెలివరీ చిరునామా నమోదు చేయండి!"); return; }

  const btn = document.getElementById("placeOrderBtn");
  btn.disabled    = true;
  btn.textContent = "Placing order... ఆర్డర్ పెడుతున్నాం...";

  const orderData = {
    action:      "placeOrder",
    customer:    { name, phone, address, notes },
    items:       Object.values(cart).map(i => ({
      id:    i.id,
      name:  i.variantLabel ? `${i.name} - ${i.nameTel} (${i.variantLabel})` : `${i.name} - ${i.nameTel} (${i.unit})`,
      qty:   i.qty,
      price: i.price,
      total: i.price * i.qty
    })),
    totalAmount: Object.values(cart).reduce((s, i) => s + i.price * i.qty, 0),
    timestamp:   new Date().toISOString()
  };

  if (!isConfigured()) {
    setTimeout(() => showSuccess(), 1000);
    return;
  }

  try {
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(orderData))));
    let res;
    try {
      res = await fetch(getAdminUrl(), {
        method: "POST", redirect: "follow",
        headers: { "Content-Type": "text/plain" },
        body: JSON.stringify({ d: encoded })
      });
    } catch (_) {
      res = await fetch(`${getAdminUrl()}?d=${encodeURIComponent(encoded)}`, { redirect: "follow" });
    }
    const result = await res.json();
    if (result.success) {
      showSuccess();
    } else {
      throw new Error(result.error || "unknown");
    }
  } catch (e) {
    alert("Order failed. Please try again. / ఆర్డర్ విఫలమైంది. మళ్ళీ ప్రయత్నించండి.");
    btn.disabled    = false;
    btn.textContent = "✅ Place Order / ఆర్డర్ పెట్టండి";
  }
}

function showSuccess() {
  document.getElementById("cartContent").style.display = "none";
  document.getElementById("successScreen").classList.add("show");
}

function newOrder() {
  cart = {};
  updateCartUI();
  renderProducts(allProducts);
  document.getElementById("cartContent").style.display = "block";
  document.getElementById("successScreen").classList.remove("show");
  ["custName","custPhone","custAddress","custNotes"].forEach(id => {
    document.getElementById(id).value = "";
  });
  closeCart();
}

// ── Banner ───────────────────────────────────
async function fetchBanner() {
  try {
    let bannerData = null;
    if (!isConfigured()) {
      bannerData = JSON.parse(localStorage.getItem("kiranaBanner") || "{}");
    } else {
      const res  = await fetch(`${getAdminUrl()}?action=getBanner&t=${Date.now()}`, { redirect: "follow" });
      bannerData = await res.json();
    }
    if (bannerData && bannerData.banner && bannerData.active !== false) {
      document.getElementById("banner-content").textContent = bannerData.banner;
      document.getElementById("shopBanner").classList.add("visible");
    }
  } catch (e) {
    // Banner fetch failed silently — shop still works fine
  }
}
