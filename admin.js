// ============================================================
// قصر عابدين — لوحة التحكم
// ============================================================

const OWNER_KEY  = "abdeen_admin_owner";
const REPO_KEY   = "abdeen_admin_repo";
const FOLDER_KEY = "abdeen_admin_folder";

let GITHUB_OWNER  = localStorage.getItem(OWNER_KEY) || "";
let GITHUB_REPO   = localStorage.getItem(REPO_KEY) || "";
let FOLDER_PATH   = localStorage.getItem(FOLDER_KEY) || "";
let GITHUB_BRANCH = "main";

let DATA_PATH   = "";
let IMAGES_PATH = "";
let DATA_API    = "";

function recomputeGithubPaths() {
  DATA_PATH   = FOLDER_PATH ? `${FOLDER_PATH}/site-data.json` : "site-data.json";
  IMAGES_PATH = FOLDER_PATH ? `${FOLDER_PATH}/assets/uploads` : "assets/uploads";
  DATA_API    = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${DATA_PATH}`;
}
recomputeGithubPaths();

function pagesBaseUrl() {
  const ownerLower = GITHUB_OWNER.toLowerCase();
  const repoLower  = GITHUB_REPO.toLowerCase();
  if (repoLower === `${ownerLower}.github.io`) return `https://${ownerLower}.github.io`;
  return `https://${ownerLower}.github.io/${GITHUB_REPO}`;
}

const TOKEN_KEY = "abdeen_admin_token";
let TOKEN = localStorage.getItem(TOKEN_KEY) || "";
let storeData = null;
let currentSha = null;
let pendingImages = {};
let pendingFeatured = [];
let pendingOffers = {};   // {offerId: File}

const $ = (id) => document.getElementById(id);

// ============================================================
// أدوات
// ============================================================
function ghHeaders() {
  return {
    "Authorization": `Bearer ${TOKEN}`,
    "Accept": "application/vnd.github+json"
  };
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function compressImage(file, maxSize = 1400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (maxSize / w) * h; w = maxSize; }
          else { w = (maxSize / h) * w; h = maxSize; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          const reader2 = new FileReader();
          reader2.onload = () => resolve(reader2.result.split(",")[1]);
          reader2.onerror = reject;
          reader2.readAsDataURL(blob);
        }, "image/jpeg", quality);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showStatus(msg, type = "ok") {
  const el = $("statusMsg");
  el.textContent = msg;
  el.className = "show " + type;
  setTimeout(() => { el.className = ""; }, 4500);
}

function showLoading(text = "جاري التحميل...") {
  $("loadingText").textContent = text;
  $("loadingOverlay").classList.add("show");
}

function hideLoading() {
  $("loadingOverlay").classList.remove("show");
}

function uid(prefix = "id") {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
}

// ============================================================
// GitHub API
// ============================================================
async function fetchFromGitHub() {
  const res = await fetch(`${DATA_API}?ref=${GITHUB_BRANCH}&t=${Date.now()}`, {
    headers: ghHeaders()
  });
  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error("GitHub error " + res.status);
  const info = await res.json();
  currentSha = info.sha;
  return JSON.parse(base64ToUtf8(info.content));
}

async function saveDataToGitHub() {
  const newContent = JSON.stringify(storeData, null, 2);
  const res = await fetch(DATA_API, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "تحديث بيانات قصر عابدين",
      content: utf8ToBase64(newContent),
      sha: currentSha,
      branch: GITHUB_BRANCH
    })
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.message || ("Save error " + res.status));
  currentSha = out.content.sha;
}

async function uploadImageToGitHub(base64Content, fileName) {
  const path = `${IMAGES_PATH}/${fileName}`;
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;
  let sha = null;
  try {
    const check = await fetch(`${url}?ref=${GITHUB_BRANCH}`, { headers: ghHeaders() });
    if (check.ok) {
      const info = await check.json();
      sha = info.sha;
    }
  } catch (e) {}
  const body = {
    message: "رفع صورة: " + fileName,
    content: base64Content,
    branch: GITHUB_BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Upload failed");
  }
  return `${pagesBaseUrl()}/${IMAGES_PATH}/${fileName}`;
}

// ============================================================
// تسجيل الدخول
// ============================================================
$("loginBtn").onclick = login;
$("pwInput").addEventListener("keydown", (e) => { if (e.key === "Enter") login(); });

const togglePw = $("togglePw");
if (togglePw) {
  togglePw.onclick = () => {
    const inp = $("pwInput");
    if (inp.type === "password") { inp.type = "text"; togglePw.textContent = "🙈"; }
    else { inp.type = "password"; togglePw.textContent = "👁️"; }
  };
}

async function login() {
  const owner  = $("ownerInput").value.trim().replace(/^\/+|\/+$/g, "");
  const repo   = $("repoInput").value.trim().replace(/^\/+|\/+$/g, "");
  const folder = $("folderInput").value.trim().replace(/^\/+|\/+$/g, "");
  const tok    = $("pwInput").value.trim();

  if (!owner || !repo) {
    $("loginErr").textContent = "لازم تكتب اسم المستخدم واسم الريبو";
    return;
  }
  if (!tok) return;

  $("loginErr").textContent = "";
  $("loginBtn").textContent = "جاري التحقق...";
  $("loginBtn").disabled = true;

  const prevOwner = GITHUB_OWNER, prevRepo = GITHUB_REPO, prevFolder = FOLDER_PATH;
  GITHUB_OWNER = owner;
  GITHUB_REPO = repo;
  FOLDER_PATH = folder;
  recomputeGithubPaths();

  try {
    TOKEN = tok;
    storeData = await fetchFromGitHub();
    localStorage.setItem(TOKEN_KEY, TOKEN);
    localStorage.setItem(OWNER_KEY, GITHUB_OWNER);
    localStorage.setItem(REPO_KEY, GITHUB_REPO);
    localStorage.setItem(FOLDER_KEY, FOLDER_PATH);
    $("loginScreen").style.display = "none";
    $("dashboard").classList.add("active");
    renderAll();
    showStatus("تم الدخول بنجاح ✅", "ok");
  } catch (e) {
    GITHUB_OWNER = prevOwner;
    GITHUB_REPO = prevRepo;
    FOLDER_PATH = prevFolder;
    recomputeGithubPaths();

    if (e.message === "UNAUTHORIZED") {
      $("loginErr").textContent = "التوكن غير صحيح أو منتهي الصلاحية";
    } else if (e.message && e.message.includes("404")) {
      $("loginErr").textContent = "مفيش ملف site-data.json في الريبو/الفولدر ده";
    } else {
      $("loginErr").textContent = "خطأ: " + e.message;
    }
    $("loginBtn").textContent = "🔓 دخول";
    $("loginBtn").disabled = false;
    TOKEN = "";
  }
}

if (GITHUB_OWNER) $("ownerInput").value = GITHUB_OWNER;
if (GITHUB_REPO) $("repoInput").value = GITHUB_REPO;
if (FOLDER_PATH) $("folderInput").value = FOLDER_PATH;

if (TOKEN && GITHUB_OWNER && GITHUB_REPO) {
  $("pwInput").value = TOKEN;
  login();
}

// ============================================================
// الخروج
// ============================================================
$("logoutBtn").onclick = () => {
  if (!confirm("هيتم مسح التوكن المحفوظ. متأكد؟")) return;
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
};

// ============================================================
// تحديث
// ============================================================
$("reloadBtn").onclick = async () => {
  if (!confirm("هيتم تجاهل التعديلات غير المحفوظة. متأكد؟")) return;
  showLoading("جاري التحديث...");
  try {
    storeData = await fetchFromGitHub();
    pendingImages = {};
    pendingFeatured = [];
    pendingOffers = {};
    renderAll();
    showStatus("تم التحديث ✅", "ok");
  } catch (e) {
    showStatus("فشل التحديث: " + e.message, "err");
  }
  hideLoading();
};

// ============================================================
// الحفظ
// ============================================================
async function saveAll() {
  showLoading("جاري حفظ التعديلات...");
  try {
    // 1) الصور المميزة
    if (pendingFeatured.length > 0) {
      showLoading(`جاري رفع ${pendingFeatured.length} صورة مميزة...`);
      if (!storeData.featured) storeData.featured = [];
      for (const file of pendingFeatured) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const fileName = `featured_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const b64 = await compressImage(file);
        const url = await uploadImageToGitHub(b64, fileName);
        storeData.featured.push(url);
      }
      pendingFeatured = [];
    }

    // 2) صور العروض
    const offersKeys = Object.keys(pendingOffers);
    if (offersKeys.length > 0) {
      showLoading(`جاري رفع ${offersKeys.length} صورة عرض...`);
      for (const offerId of offersKeys) {
        const file = pendingOffers[offerId];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const fileName = `offer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const b64 = await compressImage(file);
        const url = await uploadImageToGitHub(b64, fileName);
        const offer = (storeData.offers || []).find(o => o.id === offerId);
        if (offer) offer.image = url;
      }
      pendingOffers = {};
    }

    // 3) صور المنتجات
    const pendingCount = Object.values(pendingImages).reduce((a, arr) => a + arr.length, 0);
    if (pendingCount > 0) {
      showLoading(`جاري رفع ${pendingCount} صورة منتج...`);
      await uploadAllPendingImages();
    }

    // 4) حفظ JSON
    showLoading("جاري حفظ البيانات على GitHub...");
    await saveDataToGitHub();
    showStatus("✅ تم الحفظ — التحديث يظهر خلال دقيقة", "ok");
    pendingImages = {};
  } catch (e) {
    showStatus("فشل الحفظ: " + e.message, "err");
  }
  hideLoading();
}

$("saveBtn").onclick = saveAll;
$("saveBtnBottom").onclick = saveAll;

async function uploadAllPendingImages() {
  for (const productId of Object.keys(pendingImages)) {
    const files = pendingImages[productId];
    if (!files || files.length === 0) continue;

    let product = null;
    for (const cat of storeData.categories) {
      const p = (cat.products || []).find(pp => pp.id === productId);
      if (p) { product = p; break; }
    }
    if (!product) continue;

    if (!product.images) product.images = [];

    for (const file of files) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const b64 = await compressImage(file);
      const url = await uploadImageToGitHub(b64, fileName);
      product.images.push(url);
    }
  }
}

// ============================================================
// renderAll
// ============================================================
function renderAll() {
  renderConfig();
  renderBranches();
  renderFeaturedSection();
  renderOffersSection();
  renderZones();
}

// ============================================================
// الإعدادات العامة
// ============================================================
const CONFIG_FIELDS = [
  ["brand_ar", "اسم المتجر (عربي)"],
  ["brand_en", "اسم المتجر (English)"],
  ["tagline_ar", "الشعار (عربي)"],
  ["about_ar", "نبذة عن المتجر", true],
  ["whatsappNumber", "رقم واتساب عام (اختياري)"],
  ["address_ar", "العنوان الرئيسي"],
  ["mapUrl", "رابط الخريطة"]
];

const SOCIAL_FIELDS = [
  ["facebook", "فيسبوك"],
  ["instagram", "إنستجرام"],
  ["tiktok", "تيك توك"],
  ["whatsapp", "واتساب (رابط كامل)"],
  ["telegram", "تليجرام"]
];

function renderConfig() {
  const wrap = $("configFields");
  wrap.innerHTML = "";
  const cfg = storeData.config || (storeData.config = {});

  CONFIG_FIELDS.forEach(([key, label, isArea]) => {
    const lbl = document.createElement("label");
    lbl.textContent = label;
    wrap.appendChild(lbl);

    const input = document.createElement(isArea ? "textarea" : "input");
    if (!isArea) input.type = "text";
    input.value = cfg[key] || "";
    input.oninput = () => { cfg[key] = input.value; };
    wrap.appendChild(input);
  });

  const socialTitle = document.createElement("p");
  socialTitle.style.cssText = "margin-top:24px;padding-top:16px;border-top:2px solid var(--black-line);font-family:'Amiri',serif;font-weight:700;font-size:1.15rem;color:var(--gold)";
  socialTitle.textContent = "🔗 روابط التواصل";
  wrap.appendChild(socialTitle);

  if (!storeData.social) storeData.social = {};

  SOCIAL_FIELDS.forEach(([key, label]) => {
    const lbl = document.createElement("label");
    lbl.textContent = label;
    wrap.appendChild(lbl);
    const input = document.createElement("input");
    input.type = "text";
    input.value = storeData.social[key] || "";
    input.placeholder = "https://...";
    input.oninput = () => { storeData.social[key] = input.value; };
    wrap.appendChild(input);
  });
}

// ============================================================
// الفروع
// ============================================================
function renderBranches() {
  const wrap = $("branchesFields");
  wrap.innerHTML = "";

  if (!Array.isArray(storeData.branches)) storeData.branches = [];

  const hint = document.createElement("p");
  hint.style.cssText = "color:var(--muted);font-size:0.88rem;margin-bottom:14px;line-height:1.6;font-weight:700";
  hint.textContent = "عدّل أسماء الفروع + العنوان + رقم واتساب كل فرع. العميل هيختار الفرع الأقرب ويتبعت الطلب على واتساب الفرع ده.";
  wrap.appendChild(hint);

  storeData.branches.forEach((branch, idx) => {
    wrap.appendChild(buildBranchCard(branch, idx));
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ إضافة فرع جديد";
  addBtn.onclick = () => {
    storeData.branches.push({
      id: uid("br"),
      name: "فرع جديد",
      address: "",
      whatsapp: "",
      visible: true
    });
    renderBranches();
  };
  wrap.appendChild(addBtn);

  $("branchesBadge").textContent = storeData.branches.length + " فرع";
}

function buildBranchCard(branch, idx) {
  const box = document.createElement("div");
  box.className = "branch-edit-box";

  const num = document.createElement("div");
  num.className = "branch-num";
  num.textContent = "#" + (idx + 1);
  box.appendChild(num);

  const actions = document.createElement("div");
  actions.className = "branch-actions";

  const visToggle = document.createElement("div");
  visToggle.className = "vis-toggle " + (branch.visible !== false ? "on" : "off");
  visToggle.textContent = branch.visible !== false ? "👁️ ظاهر" : "🚫 مخفي";
  visToggle.onclick = () => {
    branch.visible = branch.visible === false ? true : false;
    visToggle.className = "vis-toggle " + (branch.visible !== false ? "on" : "off");
    visToggle.textContent = branch.visible !== false ? "👁️ ظاهر" : "🚫 مخفي";
  };

  const delBtn = document.createElement("button");
  delBtn.className = "btn-danger";
  delBtn.textContent = "🗑️";
  delBtn.onclick = () => {
    if (!confirm(`حذف "${branch.name}"؟`)) return;
    storeData.branches.splice(idx, 1);
    renderBranches();
  };

  actions.appendChild(visToggle);
  actions.appendChild(delBtn);
  box.appendChild(actions);

  box.appendChild(fieldRow("اسم الفرع", branch.name, v => { branch.name = v; }));
  box.appendChild(fieldRow("العنوان", branch.address, v => { branch.address = v; }));
  box.appendChild(fieldRow("رقم واتساب (بالصيغة الدولية بدون +)", branch.whatsapp, v => { branch.whatsapp = v; }));

  return box;
}

// ============================================================
// الصور المميزة
// ============================================================
function renderFeaturedSection() {
  const wrap = $("featuredFields");
  wrap.innerHTML = "";

  const hint = document.createElement("p");
  hint.style.cssText = "color:var(--muted);font-size:0.9rem;margin-bottom:14px;line-height:1.6;font-weight:700";
  hint.textContent = "صور السلايدر الأول (تشكيلاتنا المميزة) في الصفحة الرئيسية";
  wrap.appendChild(hint);

  if (!storeData.featured) storeData.featured = [];

  const grid = document.createElement("div");
  grid.className = "images-grid";

  storeData.featured.forEach((imgUrl, i) => {
    const thumb = document.createElement("div");
    thumb.className = "img-thumb";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.onerror = () => { img.style.opacity = "0.3"; };
    const del = document.createElement("button");
    del.className = "img-del";
    del.textContent = "✕";
    del.onclick = () => {
      if (!confirm("حذف هذه الصورة؟")) return;
      storeData.featured.splice(i, 1);
      renderFeaturedSection();
    };
    thumb.appendChild(img);
    thumb.appendChild(del);
    grid.appendChild(thumb);
  });

  pendingFeatured.forEach((file, i) => {
    const thumb = document.createElement("div");
    thumb.className = "img-thumb";
    thumb.style.borderColor = "var(--gold)";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    const del = document.createElement("button");
    del.className = "img-del";
    del.textContent = "✕";
    del.onclick = () => { pendingFeatured.splice(i, 1); renderFeaturedSection(); };
    const badge = document.createElement("div");
    badge.style.cssText = "position:absolute;bottom:4px;left:4px;background:var(--gold);color:var(--black);font-size:0.7rem;padding:3px 8px;border-radius:6px;font-weight:900";
    badge.textContent = "قيد الرفع";
    thumb.appendChild(img);
    thumb.appendChild(del);
    thumb.appendChild(badge);
    grid.appendChild(thumb);
  });

  const addBtn = document.createElement("div");
  addBtn.className = "img-add-btn";
  addBtn.innerHTML = `📷<small>إضافة صورة</small>`;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  addBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    files.forEach(f => pendingFeatured.push(f));
    renderFeaturedSection();
  };
  grid.appendChild(addBtn);
  wrap.appendChild(grid);
  wrap.appendChild(fileInput);
}

// ============================================================
// العروض
// ============================================================
function renderOffersSection() {
  const wrap = $("offersFields");
  wrap.innerHTML = "";

  const hint = document.createElement("p");
  hint.style.cssText = "color:var(--muted);font-size:0.9rem;margin-bottom:14px;line-height:1.6;font-weight:700";
  hint.textContent = "كل عرض = صورة + نص. العميل يشوفهم في قسم 'عروض وخصومات' بالصفحة الرئيسية.";
  wrap.appendChild(hint);

  if (!Array.isArray(storeData.offers)) storeData.offers = [];

  storeData.offers.forEach((offer, idx) => {
    wrap.appendChild(buildOfferCard(offer, idx));
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-add";
  addBtn.textContent = "+ إضافة عرض جديد";
  addBtn.onclick = () => {
    storeData.offers.push({
      id: uid("offer"),
      image: "",
      text: ""
    });
    renderOffersSection();
  };
  wrap.appendChild(addBtn);

  $("offersBadge").textContent = storeData.offers.length + " عرض";
}

function buildOfferCard(offer, idx) {
  const box = document.createElement("div");
  box.className = "item-box";

  const num = document.createElement("div");
  num.className = "item-num";
  num.textContent = "#" + (idx + 1);
  box.appendChild(num);

  const actions = document.createElement("div");
  actions.className = "item-actions";
  const delBtn = document.createElement("button");
  delBtn.className = "btn-danger";
  delBtn.textContent = "🗑️ حذف العرض";
  delBtn.onclick = () => {
    if (!confirm("حذف هذا العرض؟")) return;
    storeData.offers.splice(idx, 1);
    renderOffersSection();
  };
  actions.appendChild(delBtn);
  box.appendChild(actions);

  // معاينة الصورة
  const imgWrap = document.createElement("div");
  imgWrap.style.cssText = "margin-top:14px";

  const pendingFile = pendingOffers[offer.id];
  const currentImg = offer.image;

  const thumb = document.createElement("div");
  thumb.className = "img-thumb";
  thumb.style.cssText = "max-width:180px;border-color:var(--gold)";

  if (pendingFile) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(pendingFile);
    thumb.appendChild(img);
    const badge = document.createElement("div");
    badge.style.cssText = "position:absolute;bottom:4px;left:4px;background:var(--gold);color:var(--black);font-size:0.7rem;padding:3px 8px;border-radius:6px;font-weight:900";
    badge.textContent = "قيد الرفع";
    thumb.appendChild(badge);
  } else if (currentImg) {
    const img = document.createElement("img");
    img.src = currentImg;
    img.onerror = () => { img.style.opacity = "0.3"; };
    thumb.appendChild(img);
  } else {
    thumb.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:2rem;">🍞</div>`;
  }

  imgWrap.appendChild(thumb);

  const uploadBtn = document.createElement("button");
  uploadBtn.className = "btn-secondary";
  uploadBtn.style.cssText = "font-size:0.85rem;margin-top:8px";
  uploadBtn.textContent = "📷 " + (currentImg || pendingFile ? "تغيير الصورة" : "رفع صورة");

  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";

  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    pendingOffers[offer.id] = f;
    renderOffersSection();
  };

  imgWrap.appendChild(uploadBtn);
  imgWrap.appendChild(fileInput);
  box.appendChild(imgWrap);

  // نص العرض
  const lbl = document.createElement("label");
  lbl.textContent = "📝 نص العرض";
  box.appendChild(lbl);
  const textarea = document.createElement("textarea");
  textarea.value = offer.text || "";
  textarea.placeholder = "مثال: خصم ٢٥% على قسم الحلويات طوال الأسبوع";
  textarea.oninput = () => { offer.text = textarea.value; };
  box.appendChild(textarea);

  return box;
}

// ============================================================
// الأقسام
// ============================================================
function renderZones() {
  const wrap = $("zonesWrap");
  wrap.innerHTML = "";
  if (!Array.isArray(storeData.categories)) storeData.categories = [];
  storeData.categories.forEach((cat, idx) => {
    wrap.appendChild(buildZoneCard(cat, idx));
  });
}

function buildZoneCard(cat, idx) {
  const card = document.createElement("div");
  card.className = "card";

  const isWeight = cat.sellType === "weight";
  const sellTypeLabel = isWeight ? "بالكيلو" : "بالعدد";

  const title = document.createElement("div");
  title.className = "card-title";

  const info = document.createElement("div");
  info.className = "title-info";
  info.innerHTML = `
    <span class="zone-icon">${cat.icon || "🍞"}</span>
    <span>${cat.name_ar || "(قسم بدون اسم)"}</span>
    <span class="type-badge ${isWeight ? 'weight' : 'count'}">${sellTypeLabel}</span>
    <span class="type-badge">${(cat.products || []).length} منتج</span>
    <span class="toggle-chev">▼</span>
  `;

  const actions = document.createElement("div");
  actions.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap";

  const visToggle = document.createElement("div");
  visToggle.className = "vis-toggle " + (cat.visible !== false ? "on" : "off");
  visToggle.textContent = cat.visible !== false ? "👁️ ظاهر" : "🚫 مخفي";
  visToggle.onclick = (e) => {
    e.stopPropagation();
    cat.visible = cat.visible === false ? true : false;
    visToggle.className = "vis-toggle " + (cat.visible !== false ? "on" : "off");
    visToggle.textContent = cat.visible !== false ? "👁️ ظاهر" : "🚫 مخفي";
  };

  const delBtn = document.createElement("button");
  delBtn.className = "btn-danger";
  delBtn.textContent = "🗑️ حذف";
  delBtn.onclick = (e) => {
    e.stopPropagation();
    if (!confirm(`متأكد من حذف قسم "${cat.name_ar}"؟`)) return;
    storeData.categories.splice(idx, 1);
    renderZones();
  };

  actions.appendChild(visToggle);
  actions.appendChild(delBtn);
  title.appendChild(info);
  title.appendChild(actions);
  card.appendChild(title);

  const body = document.createElement("div");
  body.className = "zone-body";

  info.onclick = () => {
    body.classList.toggle("open");
    title.querySelector(".toggle-chev").classList.toggle("open");
  };

  // ===== الحقول الأساسية =====
  body.appendChild(fieldRow("اسم القسم (عربي)", cat.name_ar, (v) => {
    cat.name_ar = v;
    info.querySelector("span:nth-child(2)").textContent = v;
  }));
  body.appendChild(fieldRow("اسم القسم (English)", cat.name_en, (v) => { cat.name_en = v; }));
  body.appendChild(fieldRow("أيقونة (إيموجي)", cat.icon, (v) => {
    cat.icon = v;
    info.querySelector(".zone-icon").textContent = v;
  }));
  body.appendChild(fieldRow("رابط صورة القسم", cat.homeImg, (v) => { cat.homeImg = v; }));

  // ===== رفع صورة القسم =====
  const homeImgActions = document.createElement("div");
  homeImgActions.style.cssText = "display:flex;gap:8px;margin-top:10px";
  const uploadHomeBtn = document.createElement("button");
  uploadHomeBtn.className = "btn-secondary";
  uploadHomeBtn.style.fontSize = "0.9rem";
  uploadHomeBtn.textContent = "📤 رفع صورة القسم";
  const homeFile = document.createElement("input");
  homeFile.type = "file";
  homeFile.accept = "image/*";
  homeFile.style.display = "none";
  uploadHomeBtn.onclick = () => homeFile.click();
  homeFile.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    showLoading("جاري رفع صورة القسم...");
    try {
      const b64 = await compressImage(f);
      const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
      const fileName = `cat_${cat.id}_${Date.now()}.${ext}`;
      const url = await uploadImageToGitHub(b64, fileName);
      cat.homeImg = url;
      renderZones();
      showStatus("تم رفع الصورة ✅ لا تنسَ الحفظ", "ok");
    } catch (err) {
      showStatus("فشل الرفع: " + err.message, "err");
    }
    hideLoading();
  };
  homeImgActions.appendChild(uploadHomeBtn);
  homeImgActions.appendChild(homeFile);
  body.appendChild(homeImgActions);

  // ============================================================
  // نوع البيع (عدد / كيلو)
  // ============================================================
  const typeLbl = document.createElement("label");
  typeLbl.style.cssText = "margin-top:22px;font-size:1.05rem;color:var(--gold);font-family:'Amiri',serif";
  typeLbl.textContent = "⚖️ نوع البيع";
  body.appendChild(typeLbl);

  const typeHint = document.createElement("p");
  typeHint.style.cssText = "font-size:0.82rem;color:var(--muted);margin-bottom:10px;font-weight:700";
  typeHint.textContent = "بالعدد (زي الفينو والكرواسون) أو بالكيلو (زي الكوكيز والبقلاوة)";
  body.appendChild(typeHint);

  const typeSelector = document.createElement("div");
  typeSelector.className = "qty-type-selector";

  const countBtn = document.createElement("button");
  countBtn.className = "qty-type-btn" + (cat.sellType !== "weight" ? " selected" : "");
  countBtn.innerHTML = `<span class="icon">🔢</span><span class="label">بالعدد</span>`;
  countBtn.onclick = () => {
    cat.sellType = "count";
    cat.quantityUnit = "قطعة";
    if (!Array.isArray(cat.quantityPresets) || cat.quantityPresets.length === 0) {
      cat.quantityPresets = [10, 20, 30];
    }
    renderZones();
  };

  const weightBtn = document.createElement("button");
  weightBtn.className = "qty-type-btn" + (cat.sellType === "weight" ? " selected" : "");
  weightBtn.innerHTML = `<span class="icon">⚖️</span><span class="label">بالكيلو</span>`;
  weightBtn.onclick = () => {
    cat.sellType = "weight";
    cat.quantityUnit = "كيلو";
    if (!Array.isArray(cat.quantityPresets) || cat.quantityPresets.length === 0) {
      cat.quantityPresets = [0.25, 0.5, 1];
    }
    renderZones();
  };

  typeSelector.appendChild(countBtn);
  typeSelector.appendChild(weightBtn);
  body.appendChild(typeSelector);

  // ============================================================
  // خيارات الكمية السريعة
  // ============================================================
  const presetsLbl = document.createElement("label");
  presetsLbl.style.cssText = "margin-top:20px";
  presetsLbl.textContent = "📊 خيارات الكمية السريعة (العميل يضغط عليها)";
  body.appendChild(presetsLbl);

  const presetsHint = document.createElement("p");
  presetsHint.style.cssText = "font-size:0.8rem;color:var(--muted);margin-bottom:10px;font-weight:700";
  presetsHint.textContent = isWeight
    ? "مثال: 0.25 (ربع كيلو) — 0.5 (نصف كيلو) — 1 (كيلو)"
    : "مثال: 10 — 20 — 30";
  body.appendChild(presetsHint);

  if (!Array.isArray(cat.quantityPresets)) cat.quantityPresets = [];

  const presetsWrap = document.createElement("div");
  presetsWrap.className = "presets-wrap";

  cat.quantityPresets.forEach((preset, pIdx) => {
    const chip = document.createElement("div");
    chip.className = "preset-chip-editable";

    const input = document.createElement("input");
    input.type = "number";
    input.value = preset;
    input.step = isWeight ? "0.25" : "1";
    input.min = isWeight ? "0.25" : "1";
    input.oninput = () => {
      cat.quantityPresets[pIdx] = parseFloat(input.value) || 0;
    };

    const del = document.createElement("button");
    del.className = "chip-del";
    del.textContent = "✕";
    del.onclick = () => {
      cat.quantityPresets.splice(pIdx, 1);
      renderZones();
    };

    chip.appendChild(input);
    chip.appendChild(del);
    presetsWrap.appendChild(chip);
  });

  const addPresetBtn = document.createElement("button");
  addPresetBtn.className = "btn-secondary";
  addPresetBtn.style.cssText = "font-size:0.85rem;padding:8px 14px";
  addPresetBtn.textContent = "+ إضافة خيار";
  addPresetBtn.onclick = () => {
    cat.quantityPresets.push(isWeight ? 0.25 : 10);
    renderZones();
  };
  presetsWrap.appendChild(addPresetBtn);

  body.appendChild(presetsWrap);

  // ============================================================
  // المنتجات
  // ============================================================
  const prodsLabel = document.createElement("label");
  prodsLabel.style.cssText = "margin-top:24px;font-size:1.1rem;color:var(--gold);font-family:'Amiri',serif";
  prodsLabel.textContent = "🛍️ المنتجات:";
  body.appendChild(prodsLabel);

  const prodsWrap = document.createElement("div");
  body.appendChild(prodsWrap);

  function rerender() {
    renderProductsAdmin(prodsWrap, cat, rerender);
    info.querySelector(".type-badge:not(.weight):not(.count)").textContent = (cat.products || []).length + " منتج";
  }
  rerender();

  const addProdBtn = document.createElement("button");
  addProdBtn.className = "btn-add";
  addProdBtn.textContent = "+ إضافة منتج جديد";
  addProdBtn.onclick = () => {
    if (!cat.products) cat.products = [];
    cat.products.push({
      id: uid("p"),
      name_ar: "",
      name_en: "",
      desc_ar: "",
      desc_en: "",
      images: [],
      price: 0,
      priceUnit: cat.sellType === "weight" ? "كيلو" : "قطعة"
    });
    rerender();
  };
  body.appendChild(addProdBtn);

  card.appendChild(body);
  return card;
}

// ============================================================
// حقل مساعد
// ============================================================
function fieldRow(label, value, onChange) {
  const wrap = document.createElement("div");
  const lbl = document.createElement("label");
  lbl.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value || "";
  input.oninput = () => onChange(input.value);
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return wrap;
}

// ============================================================
// عرض المنتجات
// ============================================================
function renderProductsAdmin(container, cat, rerender) {
  container.innerHTML = "";
  if (!cat.products || cat.products.length === 0) {
    const empty = document.createElement("p");
    empty.style.cssText = "text-align:center;color:var(--muted);padding:24px;font-size:0.95rem;font-weight:700";
    empty.textContent = "لا توجد منتجات - اضغط على + لإضافة منتج";
    container.appendChild(empty);
    return;
  }
  cat.products.forEach((prod, pIdx) => {
    container.appendChild(buildProductCard(prod, pIdx, cat, rerender));
  });
}

function buildProductCard(prod, pIdx, cat, rerender) {
  const box = document.createElement("div");
  box.className = "item-box";

  const num = document.createElement("div");
  num.className = "item-num";
  num.textContent = "#" + (pIdx + 1);
  box.appendChild(num);

  const acts = document.createElement("div");
  acts.className = "item-actions";
  const delBtn = document.createElement("button");
  delBtn.className = "btn-danger";
  delBtn.textContent = "🗑️ حذف المنتج";
  delBtn.onclick = () => {
    if (!confirm(`حذف "${prod.name_ar || 'المنتج'}"؟`)) return;
    cat.products.splice(pIdx, 1);
    rerender();
  };
  acts.appendChild(delBtn);
  box.appendChild(acts);

  box.appendChild(fieldRow("الاسم (عربي)", prod.name_ar, (v) => { prod.name_ar = v; }));
  box.appendChild(fieldRow("الاسم (English)", prod.name_en, (v) => { prod.name_en = v; }));
  box.appendChild(fieldRow("وصف مختصر (اختياري)", prod.desc_ar, (v) => { prod.desc_ar = v; }));

  // السعر الأساسي
  const priceLbl = document.createElement("label");
  priceLbl.textContent = cat.sellType === "weight" ? "💰 السعر (للكيلو)" : "💰 السعر (للقطعة)";
  box.appendChild(priceLbl);
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.value = prod.price || 0;
  priceInput.oninput = () => { prod.price = parseFloat(priceInput.value) || 0; };
  box.appendChild(priceInput);

  box.appendChild(buildImagesSection(prod, rerender));
  box.appendChild(buildVariantsSection(prod, cat, rerender));

  return box;
}

// ============================================================
// صور المنتج
// ============================================================
function buildImagesSection(prod, rerender) {
  const wrap = document.createElement("div");

  const lbl = document.createElement("label");
  lbl.textContent = "📷 صور المنتج";
  wrap.appendChild(lbl);

  const grid = document.createElement("div");
  grid.className = "images-grid";

  if (!prod.images) prod.images = [];

  prod.images.forEach((imgUrl, i) => {
    const cell = document.createElement("div");
    cell.className = "img-cell";
    const thumb = document.createElement("div");
    thumb.className = "img-thumb";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.onerror = () => { img.style.opacity = "0.3"; };
    const del = document.createElement("button");
    del.className = "img-del";
    del.textContent = "✕";
    del.onclick = () => {
      if (!confirm("حذف هذه الصورة؟")) return;
      prod.images.splice(i, 1);
      rerender();
    };
    thumb.appendChild(img);
    thumb.appendChild(del);
    cell.appendChild(thumb);
    grid.appendChild(cell);
  });

  const pending = pendingImages[prod.id] || [];
  pending.forEach((file, i) => {
    const cell = document.createElement("div");
    cell.className = "img-cell";
    const thumb = document.createElement("div");
    thumb.className = "img-thumb";
    thumb.style.borderColor = "var(--gold)";
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    const del = document.createElement("button");
    del.className = "img-del";
    del.textContent = "✕";
    del.onclick = () => {
      pendingImages[prod.id].splice(i, 1);
      if (!pendingImages[prod.id].length) delete pendingImages[prod.id];
      rerender();
    };
    const badge = document.createElement("div");
    badge.style.cssText = "position:absolute;bottom:4px;left:4px;background:var(--gold);color:var(--black);font-size:0.7rem;padding:3px 8px;border-radius:6px;font-weight:900";
    badge.textContent = "قيد الرفع";
    thumb.appendChild(img);
    thumb.appendChild(del);
    thumb.appendChild(badge);
    cell.appendChild(thumb);
    grid.appendChild(cell);
  });

  const addBtn = document.createElement("div");
  addBtn.className = "img-add-btn";
  addBtn.innerHTML = `📷<small>إضافة صورة</small>`;
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.multiple = true;
  addBtn.onclick = () => fileInput.click();
  fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (!pendingImages[prod.id]) pendingImages[prod.id] = [];
    files.forEach(f => pendingImages[prod.id].push(f));
    rerender();
  };
  grid.appendChild(addBtn);
  wrap.appendChild(grid);
  wrap.appendChild(fileInput);

  return wrap;
}

// ============================================================
// الأحجام (variants) — للمنتجات اللي ليها أحجام (وسط/كبير)
// ============================================================
function buildVariantsSection(prod, cat, rerender) {
  const wrap = document.createElement("div");

  const lbl = document.createElement("label");
  lbl.style.marginTop = "20px";
  lbl.textContent = "📏 أحجام مختلفة (اختياري)";
  wrap.appendChild(lbl);

  const hint = document.createElement("p");
  hint.style.cssText = "font-size:0.8rem;color:var(--muted);margin-bottom:10px;font-weight:700";
  hint.textContent = "مثال: فطيرة وسط / كبير — كل حجم بسعر مختلف";
  wrap.appendChild(hint);

  if (!Array.isArray(prod.variants)) prod.variants = [];

  prod.variants.forEach((v, i) => {
    const row = document.createElement("div");
    row.className = "variant-row";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "الحجم (مثال: وسط)";
    labelInput.value = v.label || "";
    labelInput.style.width = "140px";
    labelInput.oninput = () => { prod.variants[i].label = labelInput.value; };

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.placeholder = "السعر";
    priceInput.value = v.price || 0;
    priceInput.oninput = () => { prod.variants[i].price = parseFloat(priceInput.value) || 0; };

    const currency = document.createElement("span");
    currency.style.cssText = "font-weight:900;color:var(--muted)";
    currency.textContent = "ج.م";

    const del = document.createElement("button");
    del.className = "var-del";
    del.textContent = "✕";
    del.onclick = () => {
      prod.variants.splice(i, 1);
      rerender();
    };

    row.appendChild(labelInput);
    row.appendChild(priceInput);
    row.appendChild(currency);
    row.appendChild(del);
    wrap.appendChild(row);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "btn-secondary";
  addBtn.style.cssText = "font-size:0.9rem;margin-top:6px";
  addBtn.textContent = "+ إضافة حجم";
  addBtn.onclick = () => {
    prod.variants.push({ label: "", price: 0 });
    rerender();
  };
  wrap.appendChild(addBtn);

  return wrap;
}

// ============================================================
// إضافة قسم جديد
// ============================================================
$("addZoneBtn").onclick = () => {
  const name = prompt("اسم القسم بالعربي:");
  if (!name) return;
  const nameEn = prompt("اسم القسم بالإنجليزي (اختياري):") || "";
  const icon = prompt("أيقونة (إيموجي):", "🍞") || "🍞";

  if (!storeData.categories) storeData.categories = [];
  storeData.categories.push({
    id: uid("cat"),
    icon: icon,
    name_ar: name,
    name_en: nameEn,
    homeImg: "",
    visible: true,
    sellType: "count",
    quantityUnit: "قطعة",
    quantityPresets: [10, 20, 30],
    products: []
  });

  renderZones();
  showStatus("تم إضافة القسم — لا تنسَ الحفظ 💾", "ok");
};

// ============================================================
// معالجات
// ============================================================
window.addEventListener("online", () => {
  if ($("loadingOverlay").classList.contains("show")) hideLoading();
});

window.addEventListener("beforeunload", (e) => {
  const hasPending = Object.keys(pendingImages).length > 0 ||
                     pendingFeatured.length > 0 ||
                     Object.keys(pendingOffers).length > 0;
  if (hasPending) { e.preventDefault(); e.returnValue = ""; }
});

console.log("👑 Abdeen Palace Admin loaded");