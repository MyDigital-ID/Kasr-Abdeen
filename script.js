// ============================================================
// قصر عابدين — منطق الموقع الرئيسي
// ============================================================

// ============================================================
// الحالة العامة
// ============================================================
let STORE_DATA = loadStoreData();
let cart = [];
let cartLineId = 0;
let currentCategory = null;
let selectedBranch = null;

const $ = (id) => document.getElementById(id);

// ============================================================
// تحميل البيانات
// ============================================================
function loadStoreData() {
  const saved = localStorage.getItem("abdeenStoreData");
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.warn("فشل تحميل البيانات:", e);
    }
  }
  return {
    config: {},
    social: {},
    branches: [],
    featured: [],
    offers: [],
    categories: []
  };
}

// ============================================================
// Toast
// ============================================================
function showToast(text, duration = 2200) {
  let t = document.getElementById("navToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "navToast";
    t.className = "nav-toast";
    document.body.appendChild(t);
  }
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), duration);
}

// ============================================================
// Splash Screen
// ============================================================
(function initSplash() {
  const splash = document.getElementById("splashScreen");
  if (!splash) return;

  let closed = false;

  function openDoors() {
    if (closed) return;
    closed = true;
    splash.classList.add("opening");
    // بعد فتح الأبواب بـ 2.5 ثانية → نغلق الصفحة
    setTimeout(() => {
      splash.classList.add("fade-out");
      setTimeout(() => splash.remove(), 900);
    }, 3200);
  }

  // الضغط على الشاشة يفتح الأبواب فوراً
  splash.addEventListener("click", openDoors);

  // تلقائياً بعد 2.5 ثانية (وقت قراءة العلامة)
  setTimeout(openDoors, 2500);
})();

// ============================================================
// إشارة جاهزية البيانات
// ============================================================
window.addEventListener("storeDataReady", () => {
  console.log("🔔 بيانات قصر عابدين جاهزة");
  STORE_DATA = loadStoreData();
  applyConfig();
  applySocialLinks();
  renderCategories();
  renderFeatured();
  renderOffers();
});

// ============================================================
// تطبيق الإعدادات
// ============================================================
function applyConfig() {
  const cfg = STORE_DATA.config || {};

  const aboutText = $("aboutText");
  if (aboutText) aboutText.textContent = cfg.about_ar || "";

  const footTag = $("footTagline");
  if (footTag && cfg.tagline_ar) footTag.textContent = cfg.tagline_ar;

  const footAddr = $("footAddress");
  if (footAddr) footAddr.textContent = cfg.address_ar || "";

  const footPhones = $("footPhones");
  if (footPhones) {
    const phones = Array.isArray(cfg.phones) ? cfg.phones : [];
    footPhones.innerHTML = phones.map(p => `<a href="tel:${p}" dir="ltr">${p}</a>`).join(" &nbsp;|&nbsp; ");
  }
}

// ============================================================
// تطبيق روابط التواصل
// ============================================================
function applySocialLinks() {
  const social = STORE_DATA.social || {};
  const cfg = STORE_DATA.config || {};

  const fbUrl = social.facebook || "#";
  const waUrl = social.whatsapp || (cfg.whatsappNumber ? `https://wa.me/${cfg.whatsappNumber}` : "#");
  const igUrl = social.instagram || "#";
  const ttUrl = social.tiktok || "#";

  const setHref = (id, url) => {
    const el = $(id);
    if (el) el.href = url;
  };

  setHref("facebookLink", fbUrl);
  setHref("whatsappLink", waUrl);
  setHref("instagramLink", igUrl);
  setHref("tiktokLink", ttUrl);

  ["facebookLink", "instagramLink", "tiktokLink", "whatsappLink"].forEach(id => {
    const el = $(id);
    if (el) el.style.display = (el.getAttribute("href") || "#") === "#" ? "none" : "";
  });

  setHref("contactFacebook", fbUrl);
  setHref("contactWhatsapp", waUrl);
}

// ============================================================
// القائمة الجانبية
// ============================================================
const sideMenu = $("sideMenu");
const sideOverlay = $("sideOverlay");

function openSide() {
  if (sideMenu) sideMenu.classList.add("open");
  if (sideOverlay) sideOverlay.classList.add("show");
}

function closeSide() {
  if (sideMenu) sideMenu.classList.remove("open");
  if (sideOverlay) sideOverlay.classList.remove("show");
}

if ($("menuBtn")) $("menuBtn").addEventListener("click", openSide);
if ($("closeMenu")) $("closeMenu").addEventListener("click", closeSide);
if (sideOverlay) {
  sideOverlay.addEventListener("click", () => {
    closeSide();
    closeCart();
  });
}

document.querySelectorAll(".side-link").forEach(link => {
  link.addEventListener("click", (e) => {
    const nav = link.dataset.nav;
    if (!nav) return;
    e.preventDefault();

    const aboutBox = $("aboutBox");
    const contactBox = $("contactBox");
    if (aboutBox) aboutBox.classList.add("hidden");
    if (contactBox) contactBox.classList.add("hidden");

    if (nav === "about" && aboutBox) aboutBox.classList.remove("hidden");
    if (nav === "contact" && contactBox) contactBox.classList.remove("hidden");
    if (nav === "branches") {
      closeSide();
      openBranchesModal();
    }
    if (nav === "home") {
      closeSide();
      showHome();
    }
  });
});

if ($("brandHome")) $("brandHome").addEventListener("click", showHome);

// ============================================================
// التنقل بين الشاشات
// ============================================================
const viewHome = $("view-home");
const viewCategory = $("view-category");

let currentView = "home";
let currentState = { view: "home" };
let currentUrl = location.pathname + location.search;

function isOverlayOpen() {
  return (sideMenu && sideMenu.classList.contains("open")) ||
         (cartDrawer && cartDrawer.classList.contains("open")) ||
         (document.getElementById("branchesModal") && document.getElementById("branchesModal").classList.contains("open"));
}

function setNav(state, url, mode) {
  currentState = state;
  currentUrl = url;
  if (mode === "push") history.pushState(state, "", url);
  else if (mode === "replace") history.replaceState(state, "", url);
}

function showHome(skipHistory) {
  closeSide();
  closeCart();
  closeBranchesModal();
  if (viewCategory) viewCategory.classList.add("hidden");
  if (viewHome) viewHome.classList.remove("hidden");
  const wasHome = currentView === "home";
  currentView = "home";
  currentCategory = null;
  window.scrollTo(0, 0);
  if (skipHistory === true) return;
  if (!wasHome) setNav({ view: "home" }, location.pathname + location.search, "push");
}

function goBack() {
  if (isOverlayOpen()) {
    closeSide();
    closeCart();
    closeBranchesModal();
    return;
  }
  if (currentView === "home") {
    showToast("أنت في الصفحة الرئيسية");
    return;
  }
  history.back();
}

// ============================================================
// Hero CTA
// ============================================================
if ($("heroCta")) {
  $("heroCta").addEventListener("click", () => {
    const target = $("catsSection");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ============================================================
// عرض الأقسام
// ============================================================
function renderCategories() {
  const grid = $("catsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const cats = (STORE_DATA.categories || []).filter(c => c.visible !== false);

  if (cats.length === 0) {
    grid.innerHTML = '<p class="empty-note">لا توجد أقسام حالياً</p>';
    return;
  }

  cats.forEach(cat => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "cat-card";

    const img = cat.homeImg || (cat.products && cat.products[0] && cat.products[0].images[0]) || "";

    card.innerHTML = `
      ${img ? `<img src="${img}" alt="${cat.name_ar}" loading="lazy" onerror="this.style.display='none'">` : ""}
      <span class="cat-card-shade"></span>
      <span class="cat-card-text">
        <span class="cat-card-ar">${cat.icon || ""} ${cat.name_ar}</span>
        <span class="cat-card-en">${cat.name_en || ""}</span>
      </span>
      <span class="cat-card-go" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg>
      </span>
    `;

    card.addEventListener("click", () => openCategory(cat.id));
    grid.appendChild(card);
  });
}

// ============================================================
// Featured Slider
// ============================================================
function renderFeatured() {
  const slider = $("featuredSlider");
  if (!slider) return;
  const wrap = slider.parentElement;
  destroySlider(wrap);
  if (!wrap.classList.contains("slider-wrap")) wrap.classList.add("slider-wrap");
  slider.innerHTML = "";

  const featured = STORE_DATA.featured || [];
  if (featured.length === 0) {
    slider.innerHTML = '<p class="empty-note">لا توجد صور مميزة</p>';
    return;
  }

  featured.forEach((imgUrl, idx) => {
    const item = document.createElement("div");
    item.className = "slider-item";
    item.innerHTML = `<img src="${imgUrl}" alt="صورة ${idx + 1}" loading="lazy" onerror="this.parentElement.style.display='none'">`;
    slider.appendChild(item);
  });

  addDots(wrap, featured.length);
  initCenterSlider(wrap, slider, featured.length, null);
}

// ============================================================
// Offers Slider
// ============================================================
function renderOffers() {
  const slider = $("offersSlider");
  if (!slider) return;
  const wrap = slider.parentElement;
  const section = $("offersSection");
  destroySlider(wrap);

  const offers = STORE_DATA.offers || [];

  // نخفي القسم لو مفيش عروض
  if (offers.length === 0) {
    if (section) section.style.display = "none";
    return;
  }
  if (section) section.style.display = "";

  if (!wrap.classList.contains("slider-wrap")) wrap.classList.add("slider-wrap");
  slider.innerHTML = "";

  offers.forEach((offer, idx) => {
    const item = document.createElement("div");
    item.className = "slider-item";
    item.innerHTML = `<img src="${offer.image}" alt="عرض ${idx + 1}" loading="lazy" onerror="this.parentElement.style.display='none'">`;
    slider.appendChild(item);
  });

  addDots(wrap, offers.length);
  initCenterSlider(wrap, slider, offers.length, null);
}

// ============================================================
// Slider Dots
// ============================================================
function addDots(wrap, total) {
  const oldDots = wrap.querySelector(".slider-dots");
  if (oldDots) oldDots.remove();

  const dotsWrap = document.createElement("div");
  dotsWrap.className = "slider-dots";

  for (let i = 0; i < total; i++) {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.dataset.idx = i;
    dotsWrap.appendChild(dot);
  }
  wrap.appendChild(dotsWrap);
}

// ============================================================
// Swiper Library
// ============================================================
const SWIPER_CSS = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
const SWIPER_JS  = "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
let swiperLoadPromise = null;

function loadSwiperLib() {
  if (window.Swiper) return Promise.resolve();
  if (swiperLoadPromise) return swiperLoadPromise;

  const cssReady = new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = SWIPER_CSS;
    link.onload = resolve;
    link.onerror = resolve;
    document.head.appendChild(link);
  });

  const jsReady = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SWIPER_JS;
    s.onload = resolve;
    s.onerror = () => reject(new Error("فشل تحميل Swiper"));
    document.head.appendChild(s);
  });

  swiperLoadPromise = Promise.all([cssReady, jsReady]).catch((err) => {
    swiperLoadPromise = null;
    throw err;
  });
  return swiperLoadPromise;
}

function destroySlider(wrap) {
  if (wrap && wrap._swiper) {
    try { wrap._swiper.destroy(true, true); } catch (e) {}
    wrap._swiper = null;
  }
}

function initCenterSlider(wrap, slider, total, onItemClick) {
  if (total === 0) return;
  const items = Array.from(slider.querySelectorAll(".slider-item"));
  if (items.length === 0) return;

  destroySlider(wrap);
  const token = (wrap._sliderToken = (wrap._sliderToken || 0) + 1);
  items.forEach((item, i) => { item.dataset.origIdx = i; });

  if (slider._clickHandler) slider.removeEventListener("click", slider._clickHandler);
  slider._clickHandler = (e) => {
    const slide = e.target.closest(".slider-item");
    if (!slide) return;
    const idx = parseInt(slide.dataset.origIdx, 10);
    const sw = wrap._swiper;
    if (sw && !slide.classList.contains("swiper-slide-active")) {
      if (sw.params.loop) sw.slideToLoop(idx); else sw.slideTo(idx);
      return;
    }
    if (onItemClick) onItemClick(idx);
  };
  slider.addEventListener("click", slider._clickHandler);

  loadSwiperLib().then(() => {
    if (wrap._sliderToken !== token || !slider.isConnected) return;

    wrap.classList.add("swiper");
    slider.classList.remove("slider-track");
    slider.classList.add("swiper-wrapper");
    items.forEach((item) => item.classList.add("swiper-slide"));

    const useLoop = total >= 3;
    const swiper = new Swiper(wrap, {
      effect: "coverflow",
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: "auto",
      loop: useLoop,
      loopAdditionalSlides: 2,
      initialSlide: 0,
      speed: 500,
      resistanceRatio: 0.6,
      coverflowEffect: {
        rotate: 15,
        stretch: "55%",
        depth: 120,
        scale: 0.82,
        modifier: 1,
        slideShadows: true
      }
    });
    wrap._swiper = swiper;

    const dots = wrap.querySelectorAll(".slider-dots .dot");
    function syncDots() {
      dots.forEach((dot, i) => dot.classList.toggle("active", i === swiper.realIndex));
    }
    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        if (useLoop) swiper.slideToLoop(i); else swiper.slideTo(i);
      });
    });
    swiper.on("slideChange", syncDots);
    syncDots();
  }).catch((err) => {
    console.warn("تعذر تحميل Swiper:", err);
    slider.classList.add("slider-fallback-track");
  });
}

// ============================================================
// فتح قسم
// ============================================================
function openCategory(catId, skipHistory) {
  const cat = (STORE_DATA.categories || []).find(c => c.id === catId);
  if (!cat) return;

  const wasView = currentView;
  const sameCat = wasView === "category" && currentCategory === catId;
  currentCategory = catId;
  currentView = "category";
  closeSide();
  closeCart();

  if (viewHome) viewHome.classList.add("hidden");
  if (viewCategory) viewCategory.classList.remove("hidden");
  window.scrollTo(0, 0);

  const titleEl = $("categoryTitle");
  if (titleEl) titleEl.textContent = `${cat.icon || ""} ${cat.name_ar}`;

  renderProducts(cat);

  if (!skipHistory && !sameCat) {
    setNav({ view: "category", id: catId }, "#category=" + catId, "push");
  } else if (skipHistory) {
    setNav({ view: "category", id: catId }, "#category=" + catId, null);
  }
}

// ============================================================
// عرض منتجات القسم
// ============================================================
function renderProducts(cat) {
  const list = $("productsList");
  if (!list) return;
  list.innerHTML = "";

  if (!cat.products || cat.products.length === 0) {
    list.innerHTML = '<p class="empty-note">قريباً .. منتجات جديدة في هذا القسم 🌾</p>';
    return;
  }

  cat.products.forEach(prod => {
    list.appendChild(buildProductCard(prod, cat));
  });
}

// ============================================================
// بناء كارت المنتج
// ============================================================
function buildProductCard(prod, cat) {
  const card = document.createElement("div");
  card.className = "product-card";

  const images = prod.images && prod.images.length ? prod.images : [];
  const firstImg = images[0] || "";
  const hasMultiple = images.length > 1;
  const hasVariants = Array.isArray(prod.variants) && prod.variants.length > 0;
  const sellType = cat.sellType || "count";
  const unit = cat.quantityUnit || (sellType === "weight" ? "كيلو" : "قطعة");
  const presets = cat.quantityPresets || (sellType === "weight" ? [0.25, 0.5, 1] : [10, 20, 30]);

  const dotsHtml = hasMultiple
    ? `<div class="pc-gallery-dots">${images.map((_, i) => `<span class="pc-g-dot${i === 0 ? " active" : ""}" data-idx="${i}"></span>`).join("")}</div>`
    : "";

  // ============ Variants (أحجام) ============
  const variantsHtml = hasVariants
    ? `<div class="pc-variants">${prod.variants.map((v, i) => 
        `<button type="button" class="pc-variant-btn${i === 0 ? " selected" : ""}" data-vidx="${i}">
          <span class="pc-variant-label">${v.label}</span>
          <span class="pc-variant-price">${v.price} ج.م</span>
        </button>`
      ).join("")}</div>`
    : "";

  // ============ Presets ============
  const presetsHtml = presets.map(p => {
    const label = sellType === "weight"
      ? (p === 0.25 ? "ربع كيلو" : p === 0.5 ? "نصف كيلو" : p === 1 ? "كيلو" : p + " كيلو")
      : p + " " + (p === 10 || p === 20 || p === 30 ? "قطعة" : unit);
    return `<button type="button" class="preset-chip" data-preset="${p}">${label}</button>`;
  }).join("");

  card.innerHTML = `
    <div class="pc-img-box">
      ${firstImg
        ? `<img class="pc-img" src="${firstImg}" alt="${prod.name_ar}" loading="lazy" onerror="this.style.opacity=0.3">`
        : '<div class="pc-img" style="background:#1a1a1a;display:flex;align-items:center;justify-content:center;font-size:3rem;">🍞</div>'}
      ${dotsHtml}
    </div>

    <h3 class="pc-name">${prod.name_ar}</h3>
    ${prod.desc_ar ? `<p class="pc-desc">${prod.desc_ar}</p>` : '<p class="pc-desc"></p>'}

    <div class="pc-bottom">
      ${variantsHtml}

      <div class="pc-custom-qty">
        <label>حدد الكمية:</label>
        <input type="number" class="pc-qty-input" placeholder="اكتب العدد" min="${sellType === "weight" ? "0.25" : "1"}" step="${sellType === "weight" ? "0.25" : "1"}">
        <span class="unit">${unit}</span>
      </div>

      <div class="pc-presets">
        ${presetsHtml}
      </div>

      <div class="pc-price-total">
        <span class="label">الإجمالي:</span>
        <span class="value" data-total="0">0 ج.م</span>
      </div>

      <button class="pc-add-btn" type="button" disabled>
        🛒 أضف إلى السلة
      </button>
    </div>
  `;

  // ============ الحالة الداخلية للكارت ============
  const state = {
    selectedVariantIdx: hasVariants ? 0 : -1,
    quantity: 0,
    selectedPreset: null
  };

  // ============ معرض الصور ============
  if (hasMultiple) {
    setupProductGallery(card, images);
  }

  // ============ Variants ============
  const variantBtns = card.querySelectorAll(".pc-variant-btn");
  variantBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      variantBtns.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedVariantIdx = Number(btn.dataset.vidx);
      updateTotal();
    });
  });

  // ============ Presets ============
  const presetChips = card.querySelectorAll(".preset-chip");
  presetChips.forEach(chip => {
    chip.addEventListener("click", () => {
      const val = parseFloat(chip.dataset.preset);
      const isSelected = chip.classList.contains("selected");

      presetChips.forEach(c => c.classList.remove("selected"));

      if (isSelected) {
        state.selectedPreset = null;
        state.quantity = 0;
      } else {
        chip.classList.add("selected");
        state.selectedPreset = val;
        state.quantity = val;
      }

      qtyInput.value = state.quantity > 0 ? state.quantity : "";
      updateTotal();
    });
  });

  // ============ Quantity Input ============
  const qtyInput = card.querySelector(".pc-qty-input");
  qtyInput.addEventListener("input", () => {
    const val = parseFloat(qtyInput.value);
    state.quantity = (!isNaN(val) && val > 0) ? val : 0;
    state.selectedPreset = null;
    presetChips.forEach(c => c.classList.remove("selected"));
    updateTotal();
  });

  // ============ Update Total ============
  const totalEl = card.querySelector(".pc-price-total .value");
  const addBtn = card.querySelector(".pc-add-btn");

  function updateTotal() {
    let unitPrice = 0;

    if (hasVariants) {
      const v = prod.variants[state.selectedVariantIdx];
      unitPrice = Number(v.price) || 0;
    } else {
      unitPrice = Number(prod.price) || 0;
    }

    const total = unitPrice * state.quantity;
    totalEl.textContent = total > 0 ? total.toFixed(2).replace(/\.00$/, "") + " ج.م" : "0 ج.م";

    // تفعيل الزر لو الكمية > 0
    const canAdd = state.quantity > 0;
    addBtn.disabled = !canAdd;
  }

  // ============ Add to Cart ============
  addBtn.addEventListener("click", () => {
    if (state.quantity <= 0) return;

    let unitPrice, variantLabel = "";

    if (hasVariants) {
      const v = prod.variants[state.selectedVariantIdx];
      unitPrice = Number(v.price) || 0;
      variantLabel = v.label || "";
    } else {
      unitPrice = Number(prod.price) || 0;
    }

    addToCart({
      productId: prod.id,
      name: prod.name_ar,
      variant: variantLabel,
      quantity: state.quantity,
      unit: unit,
      price: unitPrice,
      total: unitPrice * state.quantity,
      image: images[0] || "",
      categoryName: cat.name_ar
    });

    // Reset
    state.quantity = 0;
    state.selectedPreset = null;
    qtyInput.value = "";
    presetChips.forEach(c => c.classList.remove("selected"));
    updateTotal();

    showToast("✅ تمت الإضافة للسلة");
  });

  // Initial update
  updateTotal();

  return card;
}

// ============================================================
// معرض صور المنتج
// ============================================================
function setupProductGallery(card, images) {
  const box = card.querySelector(".pc-img-box");
  const img = card.querySelector(".pc-img");
  const dots = card.querySelectorAll(".pc-g-dot");
  if (!box || !img) return;

  let idx = 0;

  function show(i) {
    if (i < 0) i = images.length - 1;
    if (i >= images.length) i = 0;
    idx = i;
    img.src = images[idx];
    dots.forEach((d, di) => d.classList.toggle("active", di === idx));
  }

  dots.forEach((d, di) => {
    d.addEventListener("click", (e) => { e.stopPropagation(); show(di); });
  });

  let touchStartX = 0;
  box.addEventListener("touchstart", (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });
  box.addEventListener("touchend", (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) show(idx + 1); else show(idx - 1);
  }, { passive: true });

  let mouseStartX = 0, mouseDown = false;
  box.addEventListener("mousedown", (e) => { mouseStartX = e.screenX; mouseDown = true; });
  box.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    const diff = mouseStartX - e.screenX;
    if (Math.abs(diff) < 40) return;
    if (diff > 0) show(idx + 1); else show(idx - 1);
  });
  box.addEventListener("mouseleave", () => { mouseDown = false; });
}

// ============================================================
// السلة
// ============================================================
const cartDrawer = $("cartDrawer");
const cartOverlay = $("cartOverlay");

function openCart() {
  if (cartDrawer) cartDrawer.classList.add("open");
  if (cartOverlay) cartOverlay.classList.add("show");
}

function closeCart() {
  if (cartDrawer) cartDrawer.classList.remove("open");
  if (cartOverlay) cartOverlay.classList.remove("show");
}

if ($("cartBtn")) $("cartBtn").addEventListener("click", openCart);
if (cartOverlay) cartOverlay.addEventListener("click", closeCart);
if ($("addMoreBtn")) $("addMoreBtn").addEventListener("click", closeCart);

function addToCart(line) {
  line.id = "c" + (cartLineId++);
  cart.push(line);
  renderCart();
  openCart();
}

function removeFromCart(id) {
  cart = cart.filter(l => l.id !== id);
  renderCart();
}

function renderCart() {
  const box = $("cartItems");
  if (!box) return;
  box.innerHTML = "";

  if (cart.length === 0) {
    box.innerHTML = '<p class="empty-cart">السلة فارغة</p>';
  } else {
    cart.forEach(line => {
      const row = document.createElement("div");
      row.className = "cart-line";

      const variantText = line.variant ? ` - ${line.variant}` : "";
      const qtyText = `${line.quantity} ${line.unit}`;

      row.innerHTML = `
        <div class="cart-line-info">
          <strong>${line.name}${variantText}</strong>
          <span class="line-price">${qtyText} × ${line.price} ج.م = ${line.total} ج.م</span>
        </div>
        <button class="remove-line" aria-label="remove">✕</button>
      `;

      row.querySelector(".remove-line").onclick = () => removeFromCart(line.id);
      box.appendChild(row);
    });
  }

  const countEl = $("cartCount");
  if (countEl) countEl.textContent = cart.length;

  const totalEl = $("cartTotal");
  if (totalEl) totalEl.textContent = cart.reduce((a, l) => a + l.total, 0);

  const confirmBtn = $("confirmOrderBtn");
  if (confirmBtn) confirmBtn.disabled = cart.length === 0;
}

// ============================================================
// Branches Modal
// ============================================================
const branchesModal = $("branchesModal");

function openBranchesModal() {
  if (cart.length === 0) {
    showToast("السلة فارغة");
    return;
  }
  closeCart();
  renderBranches();
  if (branchesModal) branchesModal.classList.add("open");
}

function closeBranchesModal() {
  if (branchesModal) branchesModal.classList.remove("open");
}

if ($("closeBranchesModal")) $("closeBranchesModal").addEventListener("click", closeBranchesModal);
if ($("branchesBackBtn")) {
  $("branchesBackBtn").addEventListener("click", () => {
    closeBranchesModal();
    openCart();
  });
}

function renderBranches() {
  const list = $("branchesList");
  if (!list) return;
  list.innerHTML = "";

  const branches = (STORE_DATA.branches || []).filter(b => b.visible !== false);

  if (branches.length === 0) {
    list.innerHTML = '<p class="empty-note">لا توجد فروع متاحة حالياً</p>';
    return;
  }

  branches.forEach(branch => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "branch-card";

    const addr = (branch.address || "").trim();
    const hasAddr = addr.length > 0;

    card.innerHTML = `
      <span class="branch-icon">🏬</span>
      <span class="branch-name">${branch.name}</span>
      <span class="branch-address ${hasAddr ? "" : "empty"}">${hasAddr ? addr : "&nbsp;"}</span>
      <span class="branch-cta">اطلب من هنا</span>
    `;

    card.addEventListener("click", () => selectBranch(branch));
    list.appendChild(card);
  });
}

function selectBranch(branch) {
  const waNum = (branch.whatsapp || "").replace(/[^\d]/g, "");

  if (!waNum) {
    showToast("رقم الواتساب غير مسجل لهذا الفرع");
    return;
  }

  const orderText = buildOrderText(branch);
  const url = `https://wa.me/${waNum}?text=${encodeURIComponent(orderText)}`;
  window.open(url, "_blank");

  // تفريغ السلة بعد الطلب
  cart = [];
  renderCart();
  closeBranchesModal();
  showToast("✅ تم إرسال الطلب");
}

// ============================================================
// بناء نص الطلب
// ============================================================
function buildOrderText(branch) {
  const cfg = STORE_DATA.config || {};
  const brand = cfg.brand_ar || "قصر عابدين";

  let msg = `👑 *طلب جديد من ${brand}*\n`;
  msg += `📍 *الفرع:* ${branch.name}\n`;
  msg += `━━━━━━━━━━━━━━━━\n\n`;

  cart.forEach(l => {
    const variantText = l.variant ? ` - ${l.variant}` : "";
    msg += `▪️ ${l.name}${variantText}\n`;
    msg += `   ${l.quantity} ${l.unit} × ${l.price} ج.م = ${l.total} ج.م\n\n`;
  });

  const total = cart.reduce((a, l) => a + l.total, 0);
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `💰 *الإجمالي:* ${total} ج.م\n\n`;
  msg += `🕐 ${new Date().toLocaleString("ar-EG")}`;

  return msg;
}

if ($("confirmOrderBtn")) {
  $("confirmOrderBtn").addEventListener("click", openBranchesModal);
}

// ============================================================
// History / Back
// ============================================================
function applyState(state) {
  if (!state || state.view === "home") {
    showHome(true);
  } else if (state.view === "category" && state.id) {
    openCategory(state.id, true);
  }
}

window.addEventListener("popstate", (event) => {
  if (isOverlayOpen()) {
    closeSide();
    closeCart();
    closeBranchesModal();
    history.pushState(currentState, "", currentUrl);
    return;
  }

  const state = event.state;
  if (!state || state.view === "root") {
    showHome(true);
    setNav({ view: "home" }, location.pathname + location.search, "push");
    return;
  }

  currentState = state;
  currentUrl = location.pathname + location.search + (state.view === "category" ? "#category=" + state.id : "");
  applyState(state);
});

let pendingDeepLink = (location.hash.match(/^#category=(.+)$/) || [])[1] || null;

history.replaceState({ view: "root" }, "", location.pathname + location.search);
setNav({ view: "home" }, location.pathname + location.search, "push");

function tryDeepLink() {
  if (!pendingDeepLink) return;
  const id = decodeURIComponent(pendingDeepLink);
  if ((STORE_DATA.categories || []).some(c => c.id === id)) {
    pendingDeepLink = null;
    openCategory(id);
  }
}
window.addEventListener("storeDataReady", tryDeepLink);

// ============================================================
// أزرار الرجوع والرئيسية
// ============================================================
if ($("backBtnCategory")) $("backBtnCategory").addEventListener("click", goBack);
["navBackTop", "navBackBottom"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("click", goBack);
});
["navHomeTop", "navHomeBottom"].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener("click", () => showHome());
});

// ============================================================
// Install Prompt (PWA)
// ============================================================
let deferredPrompt;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const lastDismiss = sessionStorage.getItem("abdeenInstallDismissed");
  if (!lastDismiss) {
    const prompt = $("installPrompt");
    if (prompt) prompt.classList.remove("hidden");
  }
});

if ($("installNowBtn")) {
  $("installNowBtn").addEventListener("click", async () => {
    const prompt = $("installPrompt");
    if (prompt) prompt.classList.add("hidden");
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
}

if ($("installLaterBtn")) {
  $("installLaterBtn").addEventListener("click", () => {
    const prompt = $("installPrompt");
    if (prompt) prompt.classList.add("hidden");
    sessionStorage.setItem("abdeenInstallDismissed", "1");
  });
}

// ============================================================
// التشغيل الأولي
// ============================================================
applyConfig();
applySocialLinks();
renderCategories();
renderFeatured();
renderOffers();
renderCart();

console.log("🏛️ Abdeen Palace bakery loaded");