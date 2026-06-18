import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "one-task-priority-undo-v1";
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

function nowIso() {
  return new Date().toISOString();
}

function readGuestTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeGuestTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function toRow(task, userId) {
  const timestamp = nowIso();

  return {
    id: task.id,
    user_id: userId,
    text: task.text,
    status: task.status ?? "open",
    priority: Number(task.priority ?? 0),
    completed_at: task.completedAt ?? null,
    created_at: task.createdAt ?? timestamp,
    updated_at: task.updatedAt ?? timestamp
  };
}

function fromRow(row) {
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    priority: row.priority,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function assertSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

export const authStore = {
  isConfigured() {
    return Boolean(supabase);
  },

  async getSession() {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  onAuthStateChange(callback) {
    if (!supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  },

  async signIn(email, password) {
    assertSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.session;
  },

  async signUp(email, password) {
    assertSupabase();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data.session;
  },

  async signOut() {
    assertSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
};

export async function migrateGuestTasksToAccount(session) {
  const userId = session?.user?.id ?? null;
  if (!userId) return { inserted: 0, skipped: 0 };

  assertSupabase();

  const guestTasks = readGuestTasks().filter((task) => task?.id && task?.text);
  if (guestTasks.length === 0) return { inserted: 0, skipped: 0 };

  const guestIds = guestTasks.map((task) => task.id);
  const { data: existingRows, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", userId)
    .in("id", guestIds);

  if (existingError) throw existingError;

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));
  const rowsToInsert = guestTasks
    .filter((task) => !existingIds.has(task.id))
    .map((task) => toRow(task, userId));

  if (rowsToInsert.length === 0) {
    return { inserted: 0, skipped: guestTasks.length };
  }

  const { error: insertError } = await supabase.from("tasks").insert(rowsToInsert);
  if (insertError) throw insertError;

  return {
    inserted: rowsToInsert.length,
    skipped: guestTasks.length - rowsToInsert.length
  };
}

export function createTaskStore(session) {
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return {
      mode: "guest",

      async list() {
        return readGuestTasks();
      },

      async create(text, priority = 0) {
        const tasks = readGuestTasks();
        const task = {
          id: crypto.randomUUID(),
          text,
          status: "open",
          priority: Number(priority),
          completedAt: null,
          createdAt: nowIso(),
          updatedAt: nowIso()
        };

        writeGuestTasks([...tasks, task]);
        return task;
      },

      async update(id, patch) {
        const tasks = readGuestTasks();
        const next = tasks.map((task) =>
          task.id === id ? { ...task, ...patch, updatedAt: nowIso() } : task
        );

        writeGuestTasks(next);
        return next.find((task) => task.id === id) ?? null;
      },

      async remove(id) {
        const tasks = readGuestTasks();
        writeGuestTasks(tasks.filter((task) => task.id !== id));
        return true;
      }
    };
  }

  assertSupabase();

  return {
    mode: "account",

    async list() {
      const { data, error } = await supabase
        .from("tasks")
        .select("id,text,status,priority,completed_at,created_at,updated_at")
        .eq("user_id", userId);

      if (error) throw error;
      return data.map(fromRow);
    },

    async create(text, priority = 0) {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ user_id: userId, text, priority: Number(priority) })
        .select("id,text,status,priority,completed_at,created_at,updated_at")
        .single();

      if (error) throw error;
      return fromRow(data);
    },

    async update(id, patch) {
      const rowPatch = {
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
        ...(patch.completedAt !== undefined ? { completed_at: patch.completedAt } : {}),
        updated_at: nowIso()
      };

      const { data, error } = await supabase
        .from("tasks")
        .update(rowPatch)
        .eq("id", id)
        .eq("user_id", userId)
        .select("id,text,status,priority,completed_at,created_at,updated_at")
        .single();

      if (error) throw error;
      return fromRow(data);
    },

    async remove(id) {
      const { error } = await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
      if (error) throw error;
      return true;
    }
  };
}
