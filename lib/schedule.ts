import { createSupabaseServer } from "@lib/db";
import { toHMInTZ } from "@lib/utils";

export type ScheduleItem = {
  title: string;
  start: string; // "HH:MM" in tz
  end: string; // "HH:MM" in tz
  location?: string;
  color?: string;
  isCompleted?: boolean;
};

export async function fetchUserTimetableSettings(userId: string): Promise<{
  timetable_start: number;
  timetable_end: number;
  theme?: string | null;
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
        .select("timetable_start,timetable_end,theme,show_time_needle")
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
        .from("UserSettings")
        .select("timetable_start,timetable_end,theme,show_time_needle")
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
      const errorMessage =
        lastError instanceof Error
          ? lastError.message
          : (lastError as any)?.message || String(lastError);
      console.warn(
        `[WARNING] Could not fetch user settings for ${userId}: ${errorMessage}`
      );
      return null;
    }

    return data || null;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to fetch user timetable settings: ${String(error)}`
    );
  }
}

export async function fetchScheduleForUserDate(
  userId: string,
  dateYMD: string,
  tz: string
): Promise<ScheduleItem[]> {
  if (!userId || userId.trim() === "") {
    throw new Error("User ID is required and cannot be empty");
  }

  if (!dateYMD || !/^\d{4}-\d{2}-\d{2}$/.test(dateYMD)) {
    throw new Error("Date must be in YYYY-MM-DD format");
  }

  try {
    const supabase = createSupabaseServer();

    // Build UTC day window [start, nextStart)
    const from = new Date(`${dateYMD}T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCDate(from.getUTCDate() + 1);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new Error(`Invalid date format: ${dateYMD}`);
    }

    let data = null;
    let lastError = null;

    try {
      const result = await supabase
        .from("tasks")
        .select(
          "title, scheduled_time, duration_minutes, is_time_sensitive, is_completed"
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
        `Database query failed for schedule: ${
          lastError instanceof Error
            ? lastError.message
            : (lastError as any)?.message || String(lastError)
        } (Code: ${(lastError as any)?.code || "unknown"})`
      );
    }

    return (data || []).map((t: any) => {
      try {
        const startISO = t.scheduled_time as string;
        const duration = Number(t.duration_minutes ?? 0);
        const startDate = new Date(startISO);
        const endDate = new Date(startDate.getTime() + duration * 60_000);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error(`Invalid date in task: ${startISO}`);
        }

        return {
          title: t.title as string,
          start: toHMInTZ(startDate, "utc"),
          end: toHMInTZ(endDate, "utc"),
          location: t.location ?? undefined,
          color: t.color ?? undefined,
          isCompleted: t.is_completed ?? false,
        };
      } catch (error) {
        console.error("Error processing task:", t, error);
        throw new Error(
          `Failed to process task "${t.title}": ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to fetch schedule for user date: ${String(error)}`);
  }
}
