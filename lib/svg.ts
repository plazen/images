import { ScheduleItem } from "@lib/schedule";
import { escapeXml, hmToMinutes } from "@lib/utils";

export function renderScheduleSvg(opts: {
  user: string;
  userName?: string; // Display name for the user
  dateYMD: string; // YYYY-MM-DD
  items: ScheduleItem[];
  tz: string;
  dayStart: number; // minutes from 00:00
  dayEnd: number; // minutes from 00:00
}): string {
  const { user, userName, dateYMD, items, tz, dayStart, dayEnd } = opts;
  const totalMinutes = Math.max(1, dayEnd - dayStart);

  const width = 1000;
  const height = 600;
  const padding = 24;
  const headerHeight = 72;
  const trackTop = padding + headerHeight;
  const trackHeight = height - trackTop - padding;

  const bg = "#0b1220";
  const panel = "#0f172a";
  const text = "#e5e7eb";
  const subtext = "#94a3b8";
  const grid = "#1e293b";
  const border = "#334155";

  const hourLines: string[] = [];
  const labels: string[] = [];

  // Increased left margin for time labels to prevent cutoff
  const timeMargin = 64; // Increased from 36 to 64

  for (let t = roundDownToHour(dayStart); t <= dayEnd; t += 60) {
    const y = trackTop + (trackHeight * (t - dayStart)) / totalMinutes;
    hourLines.push(
      `<line x1="${padding + timeMargin}" y1="${y}" x2="${
        width - padding
      }" y2="${y}" stroke="${grid}" stroke-width="1"/>`
    );
    const hh = Math.floor(t / 60)
      .toString()
      .padStart(2, "0");
    const mm = (t % 60).toString().padStart(2, "0");
    labels.push(
      `<text x="${padding + timeMargin - 8}" y="${
        y + 4
      }" font-size="12" fill="${subtext}" text-anchor="end" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${hh}:${mm}</text>`
    );
  }

  // Adjusted lane position to account for larger time margin
  const laneX = padding + timeMargin + 20;
  const laneW = width - laneX - padding;

  const sorted = [...items].sort(
    (a, b) => hmToMinutes(a.start) - hmToMinutes(b.start)
  );

  const itemEls: string[] = [];
  for (const it of sorted) {
    const startMin = hmToMinutes(it.start);
    const endMin = hmToMinutes(it.end);
    const clampedStart = Math.max(startMin, dayStart);
    const clampedEnd = Math.min(endMin, dayEnd);
    if (clampedEnd <= clampedStart) continue;

    const y =
      trackTop + (trackHeight * (clampedStart - dayStart)) / totalMinutes;
    const h = Math.max(
      8,
      (trackHeight * (clampedEnd - clampedStart)) / totalMinutes
    );
    const x = laneX;
    const w = laneW;

    const color = it.color ?? "#0ea5e9";
    const title = escapeXml(it.title);
    const loc = it.location ? escapeXml(it.location) : "";
    const timeLabel = `${it.start}–${it.end}`;

    // Combine title and time on the same line
    const titleWithTime = `${title} • ${timeLabel}`;

    // Adjust styling based on completion status
    const isCompleted = it.isCompleted ?? false;
    const fillOpacity = isCompleted ? "0.08" : "0.18";
    const strokeOpacity = isCompleted ? "0.4" : "0.8";
    const textOpacity = isCompleted ? "0.6" : "1";
    const textDecoration = isCompleted ? "line-through" : "none";

    // Calculate center positions for text
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    itemEls.push(`
      <g>
        <rect x="${x}" y="${y}" rx="8" ry="8" width="${w}" height="${h}"
          fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-opacity="${strokeOpacity}" stroke-width="1.5"${
      isCompleted ? ' stroke-dasharray="4,4"' : ""
    }/>
        <text x="${centerX}" y="${
      loc ? centerY - 6 : centerY + 2
    }" font-size="14" fill="${text}" fill-opacity="${textOpacity}" font-weight="600" text-anchor="middle" dominant-baseline="middle"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" text-decoration="${textDecoration}">${titleWithTime}</text>${
      loc
        ? `
        <text x="${centerX}" y="${
            centerY + 12
          }" font-size="12" fill="${subtext}" fill-opacity="${textOpacity}" text-anchor="middle" dominant-baseline="middle"
          font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" text-decoration="${textDecoration}">${loc}</text>`
        : ""
    }
      </g>
    `);
  }

  const prettyDate = prettyDateFromYMD(dateYMD);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#22c55e" stop-opacity="0.2"/>
    </linearGradient>
  </defs>

  <rect x="${padding / 2}" y="${padding / 2}" width="${
    width - padding
  }" height="${height - padding}" rx="16" fill="${panel}" stroke="${border}"/>

  <g>
    <text x="${padding}" y="${
    padding + 28
  }" font-size="22" fill="${text}" font-weight="700"
      font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${escapeXml(
        userName || user
      )}'s Schedule</text>
    <text x="${padding}" y="${padding + 52}" font-size="14" fill="${subtext}"
      font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto">${prettyDate} (${dateYMD}) · ${escapeXml(
    tz
  )}</text>
  </g>

  <g>
    ${hourLines.join("\n")}
    ${labels.join("\n")}
  </g>

  <g>
    ${itemEls.join("\n")}
  </g>

  <rect x="${padding + timeMargin}" y="${trackTop}" width="${
    width - padding - timeMargin - padding
  }" height="${trackHeight}" fill="url(#g1)" opacity="0.12"/>
</svg>`;
}

function roundDownToHour(mins: number): number {
  return Math.floor(mins / 60) * 60;
}

function prettyDateFromYMD(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
