const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const GENERATIONS_URL = "https://xjjuhe.site/v1/images/generations";
const EDITS_URL = "https://xjjuhe.site/v1/images/edits";
const MAX_BODY_BYTES = 28 * 1024 * 1024;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function readLocalEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

readLocalEnv();

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("图片总大小过大，请分别压缩人物照和服装图后重试"), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("请求格式无效"), { status: 400 })); }
    });
    request.on("error", reject);
  });
}

function imagePart(dataUrl, fieldName = "image") {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw Object.assign(new Error(`请提供 PNG、JPG 或 WebP 格式的${fieldName}`), { status: 400 });
  return { mime: match[1], bytes: Buffer.from(match[2], "base64") };
}

function buildPrompt(input) {
  const items = Array.isArray(input.furniture)
    ? input.furniture.map((item) => String(item?.name || "").slice(0, 80)).filter(Boolean).slice(0, 8)
    : [];
  const roomType = String(input.roomType || "客厅").slice(0, 20);
  const style = String(input.style || "自然原木").slice(0, 30);
  const details = String(input.details || "").slice(0, 500);
  return [
    `Create a photorealistic ${style} ${roomType} interior visualization for a home furnishing customer.`,
    items.length ? `Include these selected furniture products: ${items.join(", ")}.` : "Include tasteful contemporary furniture appropriate for the room.",
    "Use a realistic residential scale, coherent perspective, natural daylight, accurate shadows, and refined but livable styling.",
    "Do not add text, labels, logos, watermarks, people, or collages.",
    details ? `Additional customer direction: ${details}` : "",
  ].filter(Boolean).join(" ");
}

async function generateImage(input, apiKey) {
  if (/[^\x21-\x7e]/.test(apiKey)) {
    throw Object.assign(new Error("生图密钥格式无效。请在 .env.local 中填入服务商后台的原始密钥。"), { status: 503 });
  }
  const prompt = buildPrompt(input);
  const model = String(input.model || "gpt-image-1").slice(0, 100);
  const size = ["1024x1024", "1536x1024", "1024x1536"].includes(input.size) ? input.size : "1024x1024";
  const hasTryOnImages = Boolean(input.personImage && input.garmentImage);
  const hasImage = hasTryOnImages || Boolean(input.imageDataUrl);
  let body;
  let headers = { Authorization: `Bearer ${apiKey}` };
  let url = GENERATIONS_URL;

  if (hasImage) {
    const form = new FormData();
    form.set("model", model);
    if (hasTryOnImages) {
      const person = imagePart(input.personImage, "人物照片");
      const garment = imagePart(input.garmentImage, "服装图片");
      const personExtension = person.mime === "image/jpeg" ? "jpg" : person.mime.split("/")[1];
      const garmentExtension = garment.mime === "image/jpeg" ? "jpg" : garment.mime.split("/")[1];
      form.set("prompt", [
        "Create one photorealistic virtual try-on image. The first input image is the person and is the identity, face, hair, body shape, pose, and background reference. The second input image is the exact garment to wear.",
        "Dress the person in the garment from the second image. Preserve the garment's actual design, color, material, neckline, sleeves, pattern, buttons, logos, and fit details as closely as possible. Adapt it naturally to the person's pose and body, with realistic fabric folds and shadows.",
        "Keep the same person, face, hairstyle, body proportions, pose, camera angle, and scene. Do not copy a mannequin or background from the garment reference. Do not add accessories or change the garment design.",
        `Visual direction: ${String(input.style || "自然棚拍").slice(0, 30)}.`,
        "No text, captions, watermarks, borders, collage, or extra people.",
        String(input.details || "").slice(0, 500),
      ].filter(Boolean).join(" "));
      form.set("image[]", new Blob([person.bytes], { type: person.mime }), `person.${personExtension}`);
      form.append("image[]", new Blob([garment.bytes], { type: garment.mime }), `garment.${garmentExtension}`);
    } else {
      const { mime, bytes } = imagePart(input.imageDataUrl, "参考照片");
      form.set("prompt", `${prompt} Edit the provided room photo. Preserve its original room architecture, walls, windows, doors, camera angle, floor, and lighting. Add or replace only the selected furniture, integrating it at a believable scale and perspective.`);
      form.set("image", new Blob([bytes], { type: mime }), `room.${mime === "image/jpeg" ? "jpg" : mime.split("/")[1]}`);
    }
    form.set("size", size);
    form.set("response_format", "b64_json");
    body = form;
    url = EDITS_URL;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ model, prompt, size, n: 1, response_format: "b64_json" });
  }

  const upstream = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(180000) });
  const raw = await upstream.text();
  let result;
  try { result = JSON.parse(raw); }
  catch { throw new Error(`图片服务返回了无法识别的结果（HTTP ${upstream.status}）`); }
  if (!upstream.ok) {
    const message = result?.error?.message || result?.message || `图片服务请求失败（HTTP ${upstream.status}）`;
    throw new Error(String(message).replaceAll(apiKey, "[已隐藏]"));
  }
  const first = result?.data?.[0] || result?.images?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  if (first?.image_url) return first.image_url;
  throw new Error("服务请求成功，但响应中没有图片。请检查模型是否支持图片生成。");
}

async function handleGenerate(request, response, requireTryOn = false) {
  const apiKey = process.env.XJ_IMAGE_API_KEY;
  if (!apiKey) {
    return sendJson(response, 503, { error: "尚未配置生图密钥。请将密钥放进项目根目录的 .env.local 文件。" });
  }
  try {
    const input = await readJson(request);
    if (requireTryOn && (!input.personImage || !input.garmentImage)) {
      return sendJson(response, 400, { error: "请先提供模特照片和服装图片" });
    }
    if (input.imageDataUrl && input.imageDataUrl.length > MAX_BODY_BYTES) {
      return sendJson(response, 413, { error: "图片总大小过大，请压缩人物照和服装图后重试" });
    }
    const image = await generateImage(input, apiKey);
    sendJson(response, 200, { image });
  } catch (error) {
    const status = error.status || (error.name === "TimeoutError" ? 504 : 502);
    sendJson(response, status, { error: error.message || "图片生成失败，请检查服务状态" });
  }
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname === "/api/try-on" && request.method === "POST") return void handleGenerate(request, response, true);
  if (url.pathname === "/api/generate" && request.method === "POST") return void handleGenerate(request, response);
  if (url.pathname.startsWith("/api/")) return sendJson(response, 404, { error: "找不到这个 API" });

  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  if (relative.split(/[\\/]+/).some((segment) => segment.startsWith("."))) {
    response.writeHead(404).end("Not found");
    return;
  }
  const filePath = path.resolve(ROOT, `.${relative}`);
  if (!filePath.startsWith(ROOT + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    response.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`试衣间本地预览已启动：http://127.0.0.1:${PORT}`);
});
