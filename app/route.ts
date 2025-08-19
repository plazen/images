import { renderScheduleSvg } from "@lib/svg";
import {
  fetchScheduleForUserDate,
  fetchUserTimetableSettings,
} from "@lib/schedule";
import { fetchUserDisplayName } from "@lib/db";
import { parseDateParam, toYMDInTZ, parseHM } from "@lib/utils";
import { debugLog, debugError, validateEnvironment } from "@lib/debug";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: Request): Promise<Response> {
  try {
    // Validate environment variables first
    validateEnvironment();

    const url = new URL(req.url);
    const user = url.searchParams.get("user")?.trim() || "";
    const dateParam = (url.searchParams.get("date") || "").trim();
    const tz = (url.searchParams.get("tz") || "UTC").trim();
    const startQ = (url.searchParams.get("start") || "").trim();
    const endQ = (url.searchParams.get("end") || "").trim();

    debugLog("API Request received", { user, dateParam, tz, startQ, endQ });

    if (!user) return jsonError(400, "Missing required query parameter: user");
    if (!dateParam)
      return jsonError(400, "Missing required query parameter: date");

    // Resolve date string (YYYY-MM-DD)
    const dateYMD =
      dateParam.toLowerCase() === "today"
        ? toYMDInTZ(new Date(), tz)
        : parseDateParam(dateParam);
    if (!dateYMD)
      return jsonError(400, 'Invalid date. Use "today" or YYYY-MM-DD.');

    debugLog("Date resolved", { dateParam, dateYMD, tz });

    // Pull user timetable settings (fallback to defaults)
    let settings;
    try {
      settings = await fetchUserTimetableSettings(user);
      debugLog("User settings fetched", settings);
    } catch (error) {
      debugError("Failed to fetch user settings", error);
      // Continue with null settings to use defaults instead of failing the request
      settings = null;
      debugLog("Using default settings due to user settings fetch failure");
    }

    // Fetch user display name from Supabase Auth
    let userName: string | null = null;
    try {
      userName = await fetchUserDisplayName(user);
      debugLog("User display name fetched", { userName });
    } catch (error) {
      debugError("Failed to fetch user display name", error);
      // Continue without display name - will fallback to UUID
    }

    const defaultStart = settings?.timetable_start ?? 8;
    const defaultEnd = settings?.timetable_end ?? 18;

    // Parse optional start/end overrides
    const dayStart = startQ ? parseHM(startQ) : defaultStart * 60;
    const dayEnd = endQ ? parseHM(endQ) : defaultEnd * 60;
    if (dayStart === null || dayEnd === null) {
      return jsonError(400, "Invalid start or end. Use HH:MM (e.g., 07:00).");
    }
    if (dayEnd <= dayStart) return jsonError(400, "end must be after start.");

    // Fetch tasks from Supabase
    let items;
    try {
      items = await fetchScheduleForUserDate(user, dateYMD, tz);
      debugLog("Schedule items fetched", { count: items.length, items });
    } catch (error) {
      debugError("Failed to fetch schedule from database", error);
      return jsonError(
        502,
        `Failed to fetch schedule from database: ${
          error instanceof Error ? error.message : "Unknown database error"
        }`
      );
    }

    if (!items) {
      return jsonError(502, "No schedule data returned from database.");
    }

    // Render SVG
    let svg;
    try {
      svg = renderScheduleSvg({
        user,
        userName: userName || undefined,
        dateYMD,
        items,
        tz,
        dayStart,
        dayEnd,
      });
      debugLog("SVG rendered successfully", { length: svg.length });
    } catch (error) {
      debugError("Failed to render SVG", error);
      return jsonError(
        500,
        `Failed to render SVG: ${
          error instanceof Error ? error.message : "Unknown rendering error"
        }`
      );
    }

    const headers = new Headers({
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "CDN-Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      Vary: "Accept-Encoding, Origin",
    });

    return new Response(svg, { status: 200, headers });
  } catch (error) {
    debugError("Unexpected error in GET handler", error);
    return jsonError(
      500,
      `Internal server error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

export async function OPTIONS(req: Request): Promise<Response> {
  const headers = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });

  return new Response(null, { status: 200, headers });
}
