const staticPreview = window.SITE_CONFIG?.staticPreview === true;
const generateLabel = staticPreview ? "AI 生成尚未接通" : "一键生成试穿效果";

const models = [
  { id: "model-01", name: "模特 01", hint: "预设模特", image: "assets/models/model-01.jpg" },
  { id: "model-02", name: "模特 02", hint: "预设模特", image: "assets/models/model-02.jpg" },
  { id: "model-03", name: "模特 03", hint: "预设模特", image: "assets/models/model-03.jpg" },
  { id: "model-04", name: "模特 04", hint: "预设模特", image: "assets/models/model-04.jpg" },
  { id: "model-05", name: "模特 05", hint: "预设模特", image: "assets/models/model-05.jpg" },
];

const garments = {
  上装: [
    { id: "tee", name: "柔软棉质短袖", color: "奶白", price: "¥ 199", image: "photo-1521572163474-6864f9cf17ab" },
    { id: "shirt", name: "垂感通勤衬衫", color: "浅蓝", price: "¥ 329", image: "photo-1596755094514-f87e34085b2c" },
    { id: "knit", name: "轻薄圆领针织", color: "燕麦", price: "¥ 269", image: "photo-1576566588028-4147f3842f27" },
    { id: "vest", name: "简约针织背心", color: "浅灰", price: "¥ 229", image: "photo-1620799140408-edc6dcb6d633" },
  ],
  连衣裙: [
    { id: "dress-floral", name: "碎花收腰连衣裙", color: "米白花色", price: "¥ 459", image: "photo-1595777457583-95e059d581b8" },
    { id: "dress-midi", name: "垂感中长裙", color: "奶油白", price: "¥ 399", image: "photo-1566174053879-31528523f8ae" },
    { id: "dress-black", name: "小黑裙", color: "曜石黑", price: "¥ 529", image: "photo-1539008835657-9e8e9680c956" },
  ],
  外套: [
    { id: "blazer", name: "轻挺通勤西装", color: "燕麦灰", price: "¥ 699", image: "photo-1591047139829-d91aecb6caea" },
    { id: "jacket", name: "休闲短款夹克", color: "浅卡其", price: "¥ 599", image: "photo-1548126032-079a0fb0099d" },
    { id: "coat", name: "简约风衣外套", color: "浅驼色", price: "¥ 899", image: "photo-1548126032-079a0fb0099d" },
  ],
};

const state = {
  modelId: models[0].id, modelFile: null, modelUrl: null,
  category: "上装", garmentId: "tee", garmentFile: null, garmentUrl: null,
  style: "自然棚拍", generatedImage: null, zoom: 100,
};

const $ = (selector) => document.querySelector(selector);
const modelGrid = $("#model-grid");
const garmentGrid = $("#garment-grid");
const toast = $("#toast");
let toastTimer;

function photoUrl(id, width = 520) { return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=84`; }

function renderModels() {
  modelGrid.innerHTML = "";
  models.forEach((model) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `model-card${state.modelId === model.id ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(state.modelId === model.id));
    button.innerHTML = `<img src="${model.image}" alt="${model.name}" loading="lazy"><span class="model-check">✓</span><span class="model-copy"><strong>${model.name}</strong><small>${model.hint}</small></span>`;
    button.addEventListener("click", () => selectModel(model));
    modelGrid.append(button);
  });
}

function renderGarments() {
  garmentGrid.innerHTML = "";
  if (state.garmentFile && state.garmentUrl) {
    const customButton = document.createElement("button");
    customButton.type = "button";
    customButton.className = "garment-card selected custom-garment";
    customButton.setAttribute("aria-pressed", "true");
    customButton.innerHTML = `<span class="garment-image"><img src="${state.garmentUrl}" alt="已上传的服装图片"><i class="garment-check">✓</i></span><span class="garment-info"><strong>我的服装图</strong><span><b>已上传</b><small>当前选择</small></span></span>`;
    garmentGrid.append(customButton);
  }
  garments[state.category].forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `garment-card${state.garmentId === item.id ? " selected" : ""}`;
    button.setAttribute("aria-pressed", String(state.garmentId === item.id));
    button.innerHTML = `<span class="garment-image"><img src="${photoUrl(item.image, 420)}" alt="${item.name}" loading="lazy"><i class="garment-check">✓</i></span><span class="garment-info"><strong>${item.name}</strong><span><b>${item.price}</b><small>${item.color}</small></span></span>`;
    button.addEventListener("click", () => selectGarment(item));
    garmentGrid.append(button);
  });
  $("#garment-count").textContent = `${state.garmentFile ? "已上传" : "1 / 1"}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2800);
}

function selectModel(model) {
  state.modelId = model.id;
  state.modelFile = null;
  if (state.modelUrl) URL.revokeObjectURL(state.modelUrl);
  state.modelUrl = null;
  $("#model-input").value = "";
  $("#model-image").src = model.image;
  $("#model-image").classList.remove("custom-model");
  $("#art-label-text").textContent = model.name;
  $("#preview-title").textContent = model.name;
  $("#model-image").alt = model.name;
  $("#status-text").textContent = "预设模特";
  invalidateResult();
  renderModels();
}

function selectGarment(item) {
  state.garmentId = item.id;
  state.garmentFile = null;
  if (state.garmentUrl) URL.revokeObjectURL(state.garmentUrl);
  state.garmentUrl = null;
  $("#garment-count").textContent = "1 / 1";
  invalidateResult();
  renderGarments();
}

function invalidateResult() {
  state.generatedImage = null;
  $("#model-image").src = state.modelUrl || models.find((model) => model.id === state.modelId).image;
  $("#model-image").classList.toggle("custom-model", Boolean(state.modelFile));
  $("#result-pill").hidden = true;
  $("#download-button").disabled = true;
  $("#preview-subtitle").textContent = `已选择 1 件服装 · ${state.style}风格`;
  $("#generate-label").textContent = generateLabel;
  $("#status-text").textContent = state.modelFile ? "已上传模特" : "预设模特";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("图片读取失败，请换一张试试")));
    reader.readAsDataURL(file);
  });
}

function setModelPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showToast("请选择图片文件");
  if (file.size > 10 * 1024 * 1024) return showToast("图片请压缩到 10 MB 以内");
  if (state.modelUrl) URL.revokeObjectURL(state.modelUrl);
  state.modelUrl = URL.createObjectURL(file);
  state.modelFile = file;
  state.modelId = "custom";
  $("#model-image").src = state.modelUrl;
  $("#model-image").classList.add("custom-model");
  $("#art-label-text").textContent = "我的模特照片";
  $("#preview-title").textContent = "我的模特照片";
  $("#status-text").textContent = "已上传模特";
  $("#empty-preview").hidden = true;
  invalidateResult();
  $("#status-text").textContent = "已上传模特";
  renderModels();
  showToast("人物照片已加载，选择服装后点生成");
}

function setGarmentPhoto(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return showToast("请选择图片文件");
  if (file.size > 10 * 1024 * 1024) return showToast("图片请压缩到 10 MB 以内");
  if (state.garmentUrl) URL.revokeObjectURL(state.garmentUrl);
  state.garmentUrl = URL.createObjectURL(file);
  state.garmentFile = file;
  state.garmentId = "custom";
  $("#garment-count").textContent = "已上传";
  invalidateResult();
  renderGarments();
  showToast("服装图片已添加，可以生成试穿图");
}

async function generateTryOn() {
  if (staticPreview) {
    showToast("这是静态预览网站，AI 换衣需要接入独立后端服务。当前上传的照片只在本设备预览。");
    return;
  }
  const button = $("#generate-button");
  button.disabled = true;
  $("#generate-label").textContent = "正在生成试穿效果…";
  $("#status-text").textContent = "AI 生成中";
  try {
    const garment = state.garmentFile
      ? await readFileAsDataUrl(state.garmentFile)
      : await readFileAsDataUrl(await (await fetch(photoUrl(garments[state.category].find((item) => item.id === state.garmentId)?.image ?? garments[state.category][0].image, 1000))).blob());
    const person = state.modelFile ? await readFileAsDataUrl(state.modelFile) : await readFileAsDataUrl(await (await fetch(models.find((item) => item.id === state.modelId).image)).blob());
    const response = await fetch("/api/try-on", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personImage: person, garmentImage: garment, style: state.style, details: $("#image-prompt").value.trim(), model: $("#image-model").value.trim(), size: $("#image-ratio").value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "生成失败，请稍后重试");
    state.generatedImage = payload.image;
    $("#model-image").src = payload.image;
    $("#model-image").classList.add("custom-model");
    $("#result-pill").hidden = false;
    $("#status-text").textContent = "AI 试穿已生成";
    $("#preview-subtitle").textContent = "AI 生成 · 可下载试穿效果图";
    $("#generate-label").textContent = "重新生成试穿效果";
    $("#download-button").disabled = false;
    showToast("AI 试穿效果图已生成");
  } catch (error) {
    $("#status-text").textContent = state.modelFile ? "已上传模特" : "预设模特";
    $("#generate-label").textContent = generateLabel;
    showToast(error.message || "暂时无法生成，请检查服务配置");
  } finally {
    button.disabled = false;
  }
}

document.querySelectorAll(".category-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.category = tab.dataset.category;
  state.garmentId = garments[state.category][0].id;
  state.garmentFile = null;
  document.querySelectorAll(".category-tab").forEach((item) => {
    const active = item === tab;
    item.classList.toggle("active", active);
    item.setAttribute("aria-selected", String(active));
  });
  renderGarments();
  invalidateResult();
}));

document.querySelectorAll(".style-chip").forEach((chip) => chip.addEventListener("click", () => {
  state.style = chip.dataset.style;
  document.querySelectorAll(".style-chip").forEach((item) => item.classList.toggle("active", item === chip));
  invalidateResult();
}));

$("#model-input").addEventListener("change", (event) => setModelPhoto(event.target.files?.[0]));
$("#garment-input").addEventListener("change", (event) => setGarmentPhoto(event.target.files?.[0]));
$("#upload-model").addEventListener("click", () => $("#model-input").click());
$("#change-model").addEventListener("click", () => $("#model-input").click());
$("#empty-upload").addEventListener("click", () => $("#model-input").click());
$("#upload-garment").addEventListener("click", () => $("#garment-input").click());
$("#generate-button").addEventListener("click", generateTryOn);
$("#advanced-toggle").addEventListener("click", (event) => {
  const open = event.currentTarget.getAttribute("aria-expanded") === "true";
  event.currentTarget.setAttribute("aria-expanded", String(!open));
  $("#advanced-content").hidden = open;
});

document.querySelectorAll(".preview-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelectorAll(".preview-tab").forEach((item) => item.classList.toggle("active", item === tab));
  $("#compare-divider").classList.toggle("visible", tab.dataset.view === "compare");
  if (tab.dataset.view === "compare") showToast("拖动预览分隔线，可比较换衣前后效果");
}));

let draggingDivider = false;
$("#compare-divider").addEventListener("pointerdown", (event) => { draggingDivider = true; event.currentTarget.setPointerCapture(event.pointerId); });
$("#compare-divider").addEventListener("pointermove", (event) => {
  if (!draggingDivider) return;
  const bounds = $("#preview-frame").getBoundingClientRect();
  const percent = Math.max(5, Math.min(95, ((event.clientX - bounds.left) / bounds.width) * 100));
  event.currentTarget.style.left = `${percent}%`;
});
$("#compare-divider").addEventListener("pointerup", () => { draggingDivider = false; });

function setZoom(delta) {
  state.zoom = Math.max(80, Math.min(120, state.zoom + delta));
  $("#zoom-level").textContent = `${state.zoom}%`;
  $("#model-image").style.transform = `scale(${state.zoom / 100})`;
}
$("#zoom-in").addEventListener("click", () => setZoom(10));
$("#zoom-out").addEventListener("click", () => setZoom(-10));
$("#download-button").addEventListener("click", () => {
  if (!state.generatedImage) return;
  const link = document.createElement("a");
  link.href = state.generatedImage;
  link.download = "试衣间-试穿效果.png";
  link.click();
});
$("#share-button").addEventListener("click", async () => {
  try {
    if (navigator.share) await navigator.share({ title: "我的试穿方案", text: "看看这套服装的试穿效果" });
    else if (navigator.clipboard) { await navigator.clipboard.writeText(location.href); showToast("页面链接已复制"); }
    else showToast("复制当前网址即可分享体验");
  } catch { showToast("已取消分享"); }
});
$("#reset-button").addEventListener("click", () => {
  if (state.modelUrl) URL.revokeObjectURL(state.modelUrl);
  if (state.garmentUrl) URL.revokeObjectURL(state.garmentUrl);
  state.modelUrl = state.garmentUrl = null;
  state.modelFile = state.garmentFile = null;
  state.modelId = models[0].id;
  state.category = "上装";
  state.garmentId = "tee";
  state.style = "自然棚拍";
  state.zoom = 100;
  state.generatedImage = null;
  $("#model-image").src = models[0].image;
  $("#model-image").alt = models[0].name;
  $("#model-image").classList.remove("custom-model");
  $("#model-image").style.transform = "scale(1)";
  $("#art-label-text").textContent = models[0].name;
  $("#preview-title").textContent = models[0].name;
  $("#preview-subtitle").textContent = "已选择 1 件服装 · 可开始生成";
  $("#result-pill").hidden = true;
  $("#download-button").disabled = true;
  $("#generate-label").textContent = generateLabel;
  $("#status-text").textContent = "预设模特";
  $("#zoom-level").textContent = "100%";
  $("#model-input").value = "";
  $("#garment-input").value = "";
  document.querySelectorAll(".category-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.category === state.category));
  document.querySelectorAll(".style-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.style === state.style));
  renderModels(); renderGarments();
  showToast("已恢复示例试穿方案");
});
$("#new-card").addEventListener("click", () => $("#reset-button").click());
$("#clear-history").addEventListener("click", () => showToast("当前体验版暂不保存历史记录"));
$("#help-button").addEventListener("click", () => showToast("选择模特 → 选择服装 → 点击一键生成试穿效果"));
$(".tip-card").addEventListener("click", () => showToast("正面站立、完整展示上身，效果通常更自然"));

renderModels();
renderGarments();

if (staticPreview) {
  $("#generate-label").textContent = generateLabel;
  $(".note-line span:last-child").textContent = "当前可选择模特、上传图片和预览；AI 换衣生成服务尚未上线。";
  $(".privacy-line").textContent = "当前上传照片仅在本设备预览，不会上传到服务器";
  $(".hero-copy").textContent = "选择模特，上传你的服装图片，准备专属试穿方案。";
  $(".credit-line strong").textContent = "AI 服务待接入";
  $(".art-note").textContent = "人物原图 · 尚未生成试穿效果";
}
