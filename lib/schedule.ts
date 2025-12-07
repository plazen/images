import { createSupabaseServer } from "@lib/db";
import { toHMInTZ } from "@lib/utils";
import { decrypt } from "@lib/encryption";

export type ScheduleItem = {
  title: string;
  start: string;
  end: string;
  isCompleted?: boolean;
  location?: string;
  color?: string;
  isExternal?: boolean;
};

export async function fetchUserTimetableSettings(userId: string): Promise<{
  timetable_start?: number | null;
  timetable_end?: number | null;
  show_time_needle?: boolean | null;
} | null> {
  if (!userId || userId.trim() === "") {
    throw new Error("User ID is required and cannot be empty");
  }

  try {
    const supabase = createSupabaseServer();
    let data = null;
    let lastError = null;
    try {
      const { data: row, error } = await supabase
        .from("UserSettings")
        .select("timetable_start, timetable_end, show_time_needle")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error) {
        data = row;
      } else {
        lastError = error;
      }
    } catch (err) {
      lastError = err;
    }
    try {
      const result = await supabase
        .from("user_settings")
        .select("timetable_start, timetable_end, show_time_needle")
        .eq("user_id", userId)
        .maybeSingle();

      if (!result.error) {
        data = result.data;
      }
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }

    if (lastError && !data) {
      const errorMessage = (lastError as any)?.message || String(lastError);
      console.warn(
        `Failed to fetch from UserSettings or user_settings: ${errorMessage}`,
      );
      return null;
    }
    return data || null;
  } catch (error) {
    if (error instanceof Error) {
    }
    throw new Error(
      `Failed to fetch user timetable settings: ${String(error)}`,
    );
  }
}

export async function fetchScheduleForUserDate(
  userId: string,
  dateYMD: string,
  tz: string,
): Promise<ScheduleItem[]> {
  if (!userId || userId.trim() === "") {
    throw new Error("User ID is required and cannot be empty");
  }
  if (!dateYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  try {
    const from = new Date(`${dateYMD}T00:00:00.000Z`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new Error(`Invalid date format: ${dateYMD}`);
    }

    let data = null;
    let lastError = null;
    try {
      const supabase = createSupabaseServer();
      const result = await supabase
        .from("tasks")
        .select(
          "title, scheduled_time, duration_minutes, is_completed, is_time_sensitive",
        )
        .eq("user_id", userId)
        .gte("scheduled_time", from.toISOString())
        .lt("scheduled_time", to.toISOString())
        .order("scheduled_time", { ascending: true });

      if (!result.error) {
        data = result.data;
      }
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }

    if (lastError && !data) {
      throw new Error(
        `Failed to fetch schedule: ${
          (lastError as any)?.message || String(lastError)
        } (Code: ${(lastError as any)?.code || "unknown"})`,
      );
    }

    return (data || []).map((t: any) => {
      try {
        const startISO = t.scheduled_time as string;
        const duration = Number(t.duration_minutes ?? 0);
        const startDate = new Date(startISO);
        const endDate = new Date(startDate.getTime() + duration * 60000);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(`Invalid date in task: ${startISO}`);
        }

        return {
          title: decrypt(t.title as string),
          start: toHMInTZ(startDate, "utc"),
          end: toHMInTZ(endDate, "utc"),
          isCompleted: t.is_completed ?? false,
        };
      } catch (error) {
        console.error("Error processing task:", t, error);
        throw new Error(
          `Failed to process task "${t.title}": ${(error as Error).message}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof Error) {
    }
    throw new Error(`Failed to fetch schedule for user date: ${String(error)}`);
  }
}

export async function fetchExternalEventsForUserDate(
  userId: string,
  dateYMD: string,
  tz: string,
): Promise<ScheduleItem[]> {
  if (!userId || userId.trim() === "") {
    throw new Error("User ID is required and cannot be empty");
  }
  if (!dateYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  try {
    // Calculate the start and end of the day in UTC
    const dayStart = new Date(`${dateYMD}T00:00:00.000Z`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    console.log("[DEBUG] fetchExternalEventsForUserDate called with:", {
      userId,
      dateYMD,
      tz,
      dayStart: dayStart.toISOString(),
      dayEnd: dayEnd.toISOString(),
    });

    if (isNaN(dayStart.getTime()) || isNaN(dayEnd.getTime())) {
      throw new Error(`Invalid date format: ${dateYMD}`);
    }

    const supabase = createSupabaseServer();

    // Fetch external events that overlap with the requested day
    // Join through calendar_sources to filter by user_id
    // An event overlaps if: start_time < dayEnd AND end_time > dayStart
    const { data, error } = await supabase
      .from("external_events")
      .select(
        "title, start_time, end_time, all_day, location, url, calendar_sources!inner(user_id)",
      )
      .eq("calendar_sources.user_id", userId)
      .lt("start_time", dayEnd.toISOString())
      .gt("end_time", dayStart.toISOString())
      .order("start_time", { ascending: true });

    console.log("[DEBUG] External events query result:", {
      data,
      error,
      dataLength: data?.length ?? 0,
    });

    if (error) {
      throw new Error(
        `Failed to fetch external events: ${error.message} (Code: ${error.code || "unknown"})`,
      );
    }

    return (data || []).map((event: any) => {
      try {
        const startDate = new Date(event.start_time);
        const endDate = new Date(event.end_time);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(
            `Invalid date in external event: ${event.start_time}`,
          );
        }

        // For all-day events, use the full day
        if (event.all_day) {
          return {
            title: event.title || "Untitled Event",
            start: "00:00",
            end: "23:59",
            isCompleted: false,
            location: event.location || undefined,
            color: "#8b5cf6", // Purple color for external events
            isExternal: true,
          };
        }

        return {
          title: event.title || "Untitled Event",
          start: toHMInTZ(startDate, tz),
          end: toHMInTZ(endDate, tz),
          isCompleted: false,
          location: event.location || undefined,
          color: "#8b5cf6", // Purple color for external events
          isExternal: true,
        };
      } catch (error) {
        console.error("Error processing external event:", event, error);
        throw new Error(
          `Failed to process external event "${event.title}": ${(error as Error).message}`,
        );
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      console.error("fetchExternalEventsForUserDate error:", error.message);
    }
    throw new Error(
      `Failed to fetch external events for user date: ${String(error)}`,
    );
  }
}
