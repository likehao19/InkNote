import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const repositoryName = process.env.GITHUB_REPOSITORY || "likehao19/InkNote";
const outputPath = process.argv[3] || "docs/assets/star-history.svg";

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function fetchGitHubData() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is required when no fixture file is provided");
  }

  const [owner, repo] = repositoryName.split("/");
  const headers = {
    Accept: "application/vnd.github.star+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "InkNote-star-history",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const repositoryResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!repositoryResponse.ok) {
    throw new Error(`GitHub repository request failed: ${repositoryResponse.status}`);
  }
  const repository = await repositoryResponse.json();
  const stargazers = [];

  for (let page = 1; ; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=100&page=${page}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub stargazers request failed: ${response.status}`);
    }
    const pageItems = await response.json();
    stargazers.push(...pageItems);
    if (pageItems.length < 100) break;
  }

  if (stargazers.some((item) => !item.starred_at)) {
    throw new Error("GitHub response did not include Stargazer timestamps");
  }
  return { repository, stargazers };
}

function niceScale(maxValue) {
  const targetTicks = 5;
  const rawStep = Math.max(1, maxValue) / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = factor * magnitude;
  return { step, maximum: Math.max(step, Math.ceil(maxValue / step) * step) };
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function renderChart({ repository, stargazers }) {
  const width = 960;
  const height = 420;
  const plot = { left: 72, right: 72, top: 48, bottom: 58 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const createdAt = new Date(repository.created_at).getTime();
  const now = Date.now();
  const endAt = Math.max(now, createdAt + 86_400_000);
  const stars = stargazers
    .map((item) => new Date(item.starred_at).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const { step, maximum } = niceScale(stars.length);
  const x = (timestamp) => plot.left + ((timestamp - createdAt) / (endAt - createdAt)) * plotWidth;
  const y = (count) => plot.top + plotHeight - (count / maximum) * plotHeight;

  let linePath = `M ${x(createdAt).toFixed(2)} ${y(0).toFixed(2)}`;
  stars.forEach((timestamp, index) => {
    linePath += ` H ${x(timestamp).toFixed(2)} V ${y(index + 1).toFixed(2)}`;
  });
  linePath += ` H ${x(endAt).toFixed(2)}`;
  const areaPath = `${linePath} V ${y(0).toFixed(2)} H ${x(createdAt).toFixed(2)} Z`;

  const yTicks = [];
  for (let value = 0; value <= maximum; value += step) {
    const position = y(value).toFixed(2);
    yTicks.push(
      `<line class="grid" x1="${plot.left}" y1="${position}" x2="${width - plot.right}" y2="${position}" />`,
      `<text class="label" x="${plot.left - 14}" y="${position}" text-anchor="end" dominant-baseline="middle">${value}</text>`,
    );
  }

  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const timestamp = createdAt + ratio * (endAt - createdAt);
    const position = plot.left + ratio * plotWidth;
    return `<text class="label" x="${position.toFixed(2)}" y="${height - 24}" text-anchor="middle">${formatDate(timestamp)}</text>`;
  });

  const currentCount = stars.length;
  const title = `${repositoryName} Star history`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="420" viewBox="0 0 960 420" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${escapeXml(`${currentCount} GitHub Stars since ${formatDate(createdAt)}`)}</desc>
  <style>
    .background { fill: #ffffff; }
    .grid { stroke: #d8dee4; stroke-width: 1; }
    .label { fill: #57606a; font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .heading { fill: #1f2328; font: 600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .count { fill: #1f2328; font: 600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .area { fill: #2da44e; opacity: 0.12; }
    .line { fill: none; stroke: #1a7f37; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    .point { fill: #1a7f37; stroke: #ffffff; stroke-width: 2; }
    @media (prefers-color-scheme: dark) {
      .background { fill: #0d1117; }
      .grid { stroke: #30363d; }
      .label { fill: #8b949e; }
      .heading, .count { fill: #e6edf3; }
      .area { fill: #3fb950; opacity: 0.14; }
      .line { stroke: #3fb950; }
      .point { fill: #3fb950; stroke: #0d1117; }
    }
  </style>
  <rect class="background" width="960" height="420" />
  <text class="heading" x="${plot.left}" y="28">${escapeXml(title)}</text>
  <text class="count" x="${width - plot.right}" y="28" text-anchor="end">${currentCount} Stars</text>
  ${yTicks.join("\n  ")}
  ${xTicks.join("\n  ")}
  <path class="area" d="${areaPath}" />
  <path class="line" d="${linePath}" />
  <circle class="point" cx="${x(endAt).toFixed(2)}" cy="${y(currentCount).toFixed(2)}" r="5" />
</svg>
`;
}

const fixturePath = process.argv[2];
const data = fixturePath
  ? JSON.parse(await readFile(fixturePath, "utf8"))
  : await fetchGitHubData();
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, renderChart(data), "utf8");
console.log(`Wrote ${outputPath} with ${data.stargazers.length} Stars`);
