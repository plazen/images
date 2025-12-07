import { ScheduleItem } from "@lib/schedule";
import { escapeXml, hmToMinutes } from "@lib/utils";

export function renderScheduleSvg(opts: {
  user: string;
  userName?: string;
  dateYMD: string;
  items: ScheduleItem[];
  tz: string;
  dayStart: number;
  dayEnd: number;
  showTimeNeedle?: boolean;
  currentTimeMinutes?: number;
}): string {
  const { user, userName, dateYMD, items, tz, dayStart, dayEnd } = opts;
  const totalMinutes = Math.max(1, dayEnd - dayStart);

  const width = 1000;
  const height = 900;
  const padding = 24;
  const trackTop = padding;
  const trackHeight = height - trackTop - padding - 40;

  const panel = "#0a0f1a";
  const text = "#e5e7eb";
  const subtext = "#64748b";
  const gridColor = "#1e293b";

  const fontStack =
    "Instrument Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto";

  const timeMargin = 56;
  const laneX = padding + timeMargin;
  const laneW = width - laneX - padding;

  // Generate hour lines and labels
  const hourLines: string[] = [];
  const labels: string[] = [];

  for (let t = roundDownToHour(dayStart); t <= dayEnd; t += 60) {
    const y = trackTop + (trackHeight * (t - dayStart)) / totalMinutes;
    // Dotted line
    hourLines.push(
      `<line x1="${laneX}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="${gridColor}" stroke-width="1" stroke-dasharray="4,4"/>`,
    );
    const hh = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const mm = (t % 60).toString().padStart(2, "0");
    labels.push(
      `<text x="${padding + timeMargin - 12}" y="${y + 4}" font-size="13" fill="${subtext}" text-anchor="end" font-family="${fontStack}">${hh}:${mm}</text>`,
    );
  }

  // Sort items by start time
  const sorted = [...items].sort(
    (a, b) => hmToMinutes(a.start) - hmToMinutes(b.start),
  );

  // Generate item elements
  const itemEls: string[] = [];
  let gradientDefs: string[] = [];
  let gradientIndex = 0;

  for (const it of sorted) {
    const startMin = hmToMinutes(it.start);
    const endMin = hmToMinutes(it.end);
    const clampedStart = Math.max(startMin, dayStart);
    const clampedEnd = Math.min(endMin, dayEnd);
    if (clampedEnd <= clampedStart) continue;

    const y =
      trackTop + (trackHeight * (clampedStart - dayStart)) / totalMinutes;
    const h = Math.max(
      24,
      (trackHeight * (clampedEnd - clampedStart)) / totalMinutes,
    );
    const x = laneX;
    const w = laneW;

    const isExternalEvent = (it as any).isExternal ?? false;
    const isCompleted = it.isCompleted ?? false;

    // Colors
    let baseColor = it.color ?? (isExternalEvent ? "#3b82f6" : "#0d9488");
    let gradientId = `grad${gradientIndex++}`;

    // Create gradient for the task block
    if (isCompleted) {
      gradientDefs.push(`
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${baseColor}" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="${baseColor}" stop-opacity="0.05"/>
        </linearGradient>
      `);
    } else {
      gradientDefs.push(`
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${baseColor}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${baseColor}" stop-opacity="0.15"/>
        </linearGradient>
      `);
    }

    const title = escapeXml(it.title);
    const timeLabel = `${it.start} – ${it.end}`;

    const textOpacity = isCompleted ? "0.5" : "1";
    const textY = y + 22;

    // Left border accent
    const accentWidth = 4;

    // Checkmark for completed tasks
    const checkmark = isCompleted
      ? `<g transform="translate(${x + w - 36}, ${y + h / 2 - 10})">
          <circle cx="10" cy="10" r="10" fill="${baseColor}" fill-opacity="0.3"/>
          <path d="M6 10 L9 13 L14 7" stroke="${text}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>`
      : "";

    itemEls.push(`
      <g>
        <rect x="${x}" y="${y}" rx="8" ry="8" width="${w}" height="${h}"
          fill="url(#${gradientId})"/>
        <rect x="${x}" y="${y}" rx="8" ry="8" width="${accentWidth}" height="${h}"
          fill="${baseColor}" fill-opacity="${isCompleted ? 0.4 : 0.8}"/>
        <text x="${x + 16}" y="${textY}" font-size="15" fill="${text}" fill-opacity="${textOpacity}" font-weight="600"
          font-family="${fontStack}">${title}</text>
        <text x="${x + 16}" y="${textY + 20}" font-size="13" fill="${subtext}" fill-opacity="${textOpacity}"
          font-family="${fontStack}">${timeLabel}</text>
        ${checkmark}
      </g>
    `);
  }

  // Time needle (current time indicator)
  let timeNeedle = "";
  if (opts.showTimeNeedle && opts.currentTimeMinutes !== undefined) {
    const needleTime = opts.currentTimeMinutes;
    if (needleTime >= dayStart && needleTime <= dayEnd) {
      const needleY =
        trackTop + (trackHeight * (needleTime - dayStart)) / totalMinutes;
      timeNeedle = `
        <circle cx="${laneX}" cy="${needleY}" r="5" fill="#ef4444"/>
        <line x1="${laneX}" y1="${needleY}" x2="${width - padding}" y2="${needleY}" stroke="#ef4444" stroke-width="2" stroke-opacity="0.6"/>
      `;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:ital,wght@0,400..700;1,400..700&amp;display=swap');
    </style>
    ${gradientDefs.join("\n")}
  </defs>

  <rect width="${width}" height="${height}" fill="${panel}"/>

  <g>
    ${hourLines.join("\n")}
    ${labels.join("\n")}
  </g>

  <g>
    ${itemEls.join("\n")}
  </g>

  ${timeNeedle}

</svg>`;
}

function roundDownToHour(mins: number): number {
  return Math.floor(mins / 60) * 60;
}
