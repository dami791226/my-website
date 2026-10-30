// SPDX-License-Identifier: AGPL-3.0-only. Material Lab adaptation, 2026-10-30.
import { EFFECTS, renderEffect, canvas, ctx, copy, resized, simpleCutout, blobOf, hasAlpha } from "./vendor/material-lab/effects.js";

const launch = document.createElement("button");
launch.type = "button";
launch.id = "open-material-studio";
launch.className = "material-launch";
launch.innerHTML = "<span>服装抠图与搭配</span><span aria-hidden='true'>↗</span>";
document.querySelector("#upload-garment").after(launch);
document.querySelector("#upload-garment").closest("section").id = "wardrobe";
const dialog = document.createElement("dialog");
dialog.className = "material-dialog";
dialog.setAttribute("aria-labelledby", "material-title");
dialog.innerHTML = `
  <header class="material-header"><h2 id="material-title">服装素材工作台</h2><span>照片在本设备处理</span><button class="material-close" aria-label="关闭素材工作台">×</button></header>
  <div class="material-tabs" role="tablist" aria-label="素材模式"><button role="tab" aria-selected="true" data-mode="material">服装素材</button><button role="tab" aria-selected="false" data-mode="composition">模特搭配</button></div>
  <div class="material-body">
    <aside class="material-controls">
      <div class="material-actions"><button class="material-command" id="material-upload">上传服装</button><button class="material-command" id="material-reload">导入当前服装</button></div>
      <input type="file" id="material-file" accept="image/png,image/jpeg,image/webp" hidden>
      <p class="material-status" id="material-status" role="status" aria-live="polite">请选择一张服装图</p>
      <div class="material-group" data-controls="material"><h3>背景与边缘</h3>
        <div class="material-actions"><button class="material-command" id="material-ai">智能抠图</button><button class="material-command" id="material-simple">纯色抠图</button><button class="material-command" id="material-cancel" hidden>取消</button></div>
        <label>底色容差 <input id="material-tolerance" type="range" min="5" max="100" value="35"></label>
        <label class="material-toggle"><input type="checkbox" id="material-cutout" checked>使用去背景素材</label>
        <label>边缘工具 <select id="material-brush"><option value="none">不编辑</option><option value="erase">擦除</option><option value="restore">恢复</option></select></label>
        <label>画笔大小 <input type="range" id="material-brush-size" min="5" max="90" value="25"></label>
        <div class="material-actions"><button class="material-command" id="material-undo">撤销上一笔</button><button class="material-command" id="material-reset">恢复原图</button></div>
      </div>
      <div class="material-group" data-controls="material"><h3>素材效果</h3>
        <label>效果强度 <input type="range" id="material-amount" min="5" max="100" value="65"></label>
        <label>纹理大小 <input type="range" id="material-detail" min="1" max="24" value="8"></label>
        <label>单色油墨 <input type="color" id="material-color" value="#253d37"></label>
        <label class="material-toggle"><input type="checkbox" id="material-compare">对比原图</label>
      </div>
      <div class="material-group" data-controls="composition" hidden><h3>服装位置</h3>
        <label>水平位置 <input type="range" id="fit-x" min="0" max="100" value="50"></label>
        <label>垂直位置 <input type="range" id="fit-y" min="0" max="100" value="42"></label>
        <label>服装宽度 <input type="range" id="fit-width" min="10" max="110" value="48"></label>
        <label>旋转 <input type="range" id="fit-rotation" min="-45" max="45" value="0"></label>
        <label>不透明度 <input type="range" id="fit-opacity" min="15" max="100" value="100"></label>
        <button class="material-command" id="fit-reset">重置位置</button>
      </div>
      <div class="material-actions"><button class="material-command" id="material-download">下载透明 PNG</button><button class="material-command" id="material-overview">导出效果总览</button></div>
    </aside>
    <section class="material-stage"><div class="material-canvas-wrap"><canvas id="material-canvas" aria-label="服装素材预览"></canvas></div>
      <div class="material-caption"><strong id="material-effect-name">原图</strong><span id="material-dimensions"></span></div>
      <div class="material-effect-list" aria-label="素材效果"></div>
    </section>
  </div>
  <footer class="material-footer"><span>搭配图为平面叠加，不代表真实上身或尺码效果。<br><a href="https://github.com/dami791226/my-website" target="_blank" rel="noreferrer">完整源码</a> · <a href="THIRD_PARTY_NOTICES.md" target="_blank">Material Lab / AGPL-3.0</a></span><button class="material-command material-primary" id="material-use">使用这件服装</button></footer>`;
document.body.append(dialog);
const $ = (selector) => dialog.querySelector(selector);
const view = $("#material-canvas");
const state = { raw: null, mask: null, person: null, effect: "original", mode: "material", undo: [], busy: false, job: 0, painting: false, lastPoint: null, frame: 0, sourceLabel: "服装图片" };
let aiModule;

function announce(text, error = false) {
  $("#material-status").textContent = text;
  $("#material-status").dataset.error = String(error);
}
function setBusy(busy) {
  state.busy = busy;
  $("#material-cancel").hidden = !busy;
  updateControls();
}
function updateControls() {
  for (const id of ["material-ai", "material-simple", "material-reset", "material-download", "material-overview", "material-use"]) {
    $("#" + id).disabled = !state.raw || state.busy;
  }
  $("#material-undo").disabled = state.busy || !state.undo.length;
  $("#material-cutout").disabled = !state.mask || state.busy;
}
function options() {
  return { amount: Number($("#material-amount").value), detail: Number($("#material-detail").value), color: $("#material-color").value };
}
function source() { return $("#material-cutout").checked && state.mask ? state.mask : state.raw; }
function currentEffect() { return renderEffect(source(), state.effect, options()); }
function paintCanvas(output) {
  view.width = output.width;
  view.height = output.height;
  ctx(view).drawImage(output, 0, 0);
  $("#material-dimensions").textContent = `${output.width} × ${output.height} px`;
}
function render() {
  updateControls();
  if (!state.raw) { ctx(view).clearRect(0, 0, view.width, view.height); return; }
  if (state.mode === "composition") {
    if (!state.person) return;
    const out = copy(state.person), g = ctx(out), garment = currentEffect();
    const width = out.width * Number($("#fit-width").value) / 100;
    const height = width * garment.height / garment.width;
    g.save();
    g.translate(out.width * Number($("#fit-x").value) / 100, out.height * Number($("#fit-y").value) / 100);
    g.rotate(Number($("#fit-rotation").value) * Math.PI / 180);
    g.globalAlpha = Number($("#fit-opacity").value) / 100;
    g.drawImage(garment, -width / 2, -height / 2, width, height);
    g.restore();
    paintCanvas(out);
    $("#material-effect-name").textContent = "平面搭配预览";
  } else {
    const editing = $("#material-brush").value !== "none";
    paintCanvas($("#material-compare").checked ? state.raw : editing ? source() : currentEffect());
    $("#material-effect-name").textContent = editing ? "边缘修整" : $("#material-compare").checked ? "原图对比" : EFFECTS.find((item) => item[0] === state.effect)[1];
  }
  $(".material-canvas-wrap").classList.toggle("editing", state.mode === "material" && $("#material-brush").value !== "none");
}
function scheduleRender() {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(render);
}
async function decode(blob) {
  if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) throw new Error("请选择 PNG、JPG 或 WebP 图片");
  if (blob.size > 30 * 1024 * 1024) throw new Error("图片不能超过 30 MB");
  const image = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try { return resized(image, image.width, image.height); } finally { image.close(); }
}
async function loadGarment(blob) {
  const job = ++state.job;
  setBusy(true);
  try {
    const raw = await decode(blob);
    if (job !== state.job) return;
    state.raw = raw; state.mask = hasAlpha(raw) ? copy(raw) : null; state.undo = [];
    state.sourceLabel = blob.name || "当前服装";
    state.effect = "original";
    $("#material-cutout").checked = true;
    $("#material-brush").value = "none";
    $("#material-compare").checked = false;
    setEffect("original");
    announce(state.mask ? "透明素材已导入" : "服装已导入，可选择智能抠图或纯色抠图");
  } catch (error) { if (job === state.job) announce(error.message, true); }
  finally { if (job === state.job) { setBusy(false); render(); } }
}
function setEffect(id) {
  state.effect = id;
  for (const button of $(".material-effect-list").children) button.setAttribute("aria-pressed", String(button.dataset.effect === id));
  scheduleRender();
}
for (const [id, name] of EFFECTS) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.effect = id; button.textContent = name; button.setAttribute("aria-pressed", String(id === "original"));
  button.addEventListener("click", () => { $("#material-brush").value = "none"; $("#material-compare").checked = false; setEffect(id); });
  $(".material-effect-list").append(button);
}
function saveUndo() { state.undo.push(copy(state.mask || state.raw)); if (state.undo.length > 8) state.undo.shift(); }
function cancelJob() { state.job++; setBusy(false); announce("已取消处理，保留当前图片"); }
async function runAI() {
  if (!state.raw || state.busy) return;
  const job = ++state.job;
  setBusy(true); announce("首次智能抠图需下载约 56 MB 模型，请稍候…");
  const timer = setTimeout(() => { if (job === state.job) { cancelJob(); announce("模型加载超时，可重试或使用纯色抠图", true); } }, 180000);
  try {
    aiModule ||= import("https://esm.sh/@imgly/background-removal@1.7.0?bundle").catch((error) => { aiModule = null; throw error; });
    const { removeBackground } = await aiModule;
    if (job !== state.job) return;
    const result = await removeBackground(await blobOf(state.raw), {
      model: "small", device: "cpu", proxyToWorker: false,
      publicPath: "https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/",
      output: { format: "image/png", quality: 1 },
      progress(key, current, total) { if (job === state.job) announce(key.startsWith("fetch:") ? `正在下载抠图资源 ${total ? Math.round(current / total * 100) + "%" : ""}` : "正在识别服装主体…"); },
    });
    if (job !== state.job) return;
    const mask = await decode(result);
    if (job !== state.job) return;
    const alpha = ctx(mask).getImageData(0, 0, mask.width, mask.height).data;
    let kept = 0;
    for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 20) kept++;
    if (kept / (mask.width * mask.height) < .001) throw new Error("未识别到清晰服装，请重试或使用画笔修整");
    saveUndo(); state.mask = mask; $("#material-cutout").checked = true;
    announce("智能抠图完成，请检查服装边缘");
  } catch (error) { if (job === state.job) announce("智能抠图暂不可用，请检查网络或使用纯色抠图；原图已保留", true); }
  finally { clearTimeout(timer); if (job === state.job) { setBusy(false); render(); } }
}
async function setMode(mode) {
  if (mode === "composition") {
    const job = state.job;
    try { const person = await decode(await window.FittingStudio.personBlob()); if (job !== state.job || !dialog.open) return; state.person = person; }
    catch (error) { announce(error.message, true); return; }
  }
  state.mode = mode;
  for (const button of dialog.querySelectorAll("[data-mode]")) button.setAttribute("aria-selected", String(button.dataset.mode === mode));
  for (const group of dialog.querySelectorAll("[data-controls]")) group.hidden = group.dataset.controls !== mode;
  $(".material-effect-list").hidden = mode === "composition";
  $("#material-overview").hidden = mode === "composition";
  $("#material-download").textContent = mode === "composition" ? "下载搭配预览" : "下载透明 PNG";
  view.setAttribute("aria-label", mode === "composition" ? "平面搭配预览" : "服装素材预览");
  render();
}
async function download(output, name) {
  const blob = await blobOf(output), url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function guarded(task) { try { await task(); } catch (error) { announce(error.message || "操作失败，请重试", true); } }
async function importCurrent() {
  const job = ++state.job;
  await guarded(async () => {
    const blob = await window.FittingStudio.garmentBlob();
    if (job === state.job && dialog.open) await loadGarment(blob);
  });
}
launch.addEventListener("click", () => { dialog.showModal(); void setMode("material"); void importCurrent(); });
$(".material-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => { cancelJob(); state.painting = false; });
$("#material-upload").addEventListener("click", () => $("#material-file").click());
$("#material-file").addEventListener("change", (event) => { if (event.target.files[0]) void loadGarment(event.target.files[0]); event.target.value = ""; });
$("#material-reload").addEventListener("click", importCurrent);
$("#material-ai").addEventListener("click", runAI);
$("#material-cancel").addEventListener("click", cancelJob);
$("#material-simple").addEventListener("click", () => {
  if (!state.raw || state.busy) return;
  const result = simpleCutout(state.raw, Number($("#material-tolerance").value));
  if (result.removed < .01) return announce("背景不够统一，请调整容差或使用智能抠图", true);
  saveUndo(); state.mask = result.image; $("#material-cutout").checked = true;
  announce(`已移除 ${Math.round(result.removed * 100)}% 边缘底色，请检查浅色服装是否被误删`); render();
});
$("#material-reset").addEventListener("click", () => { state.mask = null; state.undo = []; $("#material-brush").value = "none"; setEffect("original"); announce("已恢复服装原图"); render(); });
$("#material-undo").addEventListener("click", () => { const mask = state.undo.pop(); if (mask) state.mask = mask; render(); });
for (const element of dialog.querySelectorAll("input:not([type=file]), select")) element.addEventListener("input", () => {
  if (element.id === "material-brush" && element.value !== "none") {
    if (!state.raw) { element.value = "none"; return; }
    state.mask ||= copy(state.raw); $("#material-cutout").checked = true; $("#material-compare").checked = false;
  }
  scheduleRender();
});
for (const button of dialog.querySelectorAll("[data-mode]")) button.addEventListener("click", () => void setMode(button.dataset.mode));
$("#fit-reset").addEventListener("click", () => { for (const [id, value] of Object.entries({ x: 50, y: 42, width: 48, rotation: 0, opacity: 100 })) $("#fit-" + id).value = value; render(); });
$("#material-download").addEventListener("click", () => void guarded(() => {
  if (state.mode !== "composition") return download(currentEffect(), "服装素材.png");
  const output = copy(view), g = ctx(output), size = Math.max(14, Math.round(output.width / 48));
  g.fillStyle = "rgba(255,255,255,.9)"; g.fillRect(0, output.height - size * 2.8, output.width, size * 2.8);
  g.fillStyle = "#283424"; g.font = `${size}px sans-serif`; g.fillText("平面搭配预览 · 非 AI 换衣", size, output.height - size);
  return download(output, "平面搭配预览.png");
}));
$("#material-overview").addEventListener("click", () => void guarded(async () => {
  const output = canvas(1600, 1600), g = ctx(output); g.fillStyle = "#f4f6ef"; g.fillRect(0, 0, 1600, 1600);
  EFFECTS.forEach(([id, name], index) => {
    const image = renderEffect(source(), id, options(), 360), scale = Math.min(340 / image.width, 320 / image.height), x = index % 4 * 400, y = Math.floor(index / 4) * 400;
    g.drawImage(image, x + (400 - image.width * scale) / 2, y + 12 + (320 - image.height * scale) / 2, image.width * scale, image.height * scale);
    g.fillStyle = "#283424"; g.font = "18px sans-serif"; g.textAlign = "center"; g.fillText(name, x + 200, y + 370);
  });
  await download(output, "服装效果总览.png");
}));
$("#material-use").addEventListener("click", () => void guarded(async () => { window.FittingStudio.useGarment(await blobOf(currentEffect())); dialog.close(); }));

function brushPoint(event) {
  const bounds = view.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * view.width / bounds.width, y: (event.clientY - bounds.top) * view.height / bounds.height };
}
function stroke(event) {
  if (!state.painting) return;
  const next = brushPoint(event), last = state.lastPoint || next, radius = Number($("#material-brush-size").value) * view.width / view.getBoundingClientRect().width / 2;
  const steps = Math.max(1, Math.ceil(Math.hypot(next.x - last.x, next.y - last.y) / Math.max(1, radius / 2))), g = ctx(state.mask);
  g.save(); g.beginPath();
  for (let i = 0; i <= steps; i++) { const x = last.x + (next.x - last.x) * i / steps, y = last.y + (next.y - last.y) * i / steps; g.moveTo(x + radius, y); g.arc(x, y, radius, 0, Math.PI * 2); }
  g.clip(); g.clearRect(0, 0, state.mask.width, state.mask.height);
  if ($("#material-brush").value === "restore") g.drawImage(state.raw, 0, 0);
  g.restore(); state.lastPoint = next; scheduleRender();
}
view.addEventListener("pointerdown", (event) => {
  if (!state.raw || state.busy || state.mode !== "material" || $("#material-brush").value === "none") return;
  saveUndo(); state.mask ||= copy(state.raw); state.painting = true; state.lastPoint = null; view.setPointerCapture(event.pointerId); stroke(event);
});
view.addEventListener("pointermove", stroke);
for (const name of ["pointerup", "pointercancel", "lostpointercapture"]) view.addEventListener(name, () => { state.painting = false; state.lastPoint = null; updateControls(); });
dialog.addEventListener("dragover", (event) => event.preventDefault());
dialog.addEventListener("drop", (event) => { event.preventDefault(); if (event.dataTransfer.files[0]) void loadGarment(event.dataTransfer.files[0]); });
dialog.addEventListener("paste", (event) => { const file = Array.from(event.clipboardData?.files || []).find((file) => file.type.startsWith("image/")); if (file) { event.preventDefault(); void loadGarment(file); } });
window.addEventListener("fitting-selection-changed", () => { state.person = null; });
updateControls();
