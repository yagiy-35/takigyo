import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

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

export const taskStore = {
  async list() {
    const { data, error } = await supabase
      .from("tasks")
      .select("id,text,status,priority,completed_at,created_at,updated_at");

    if (error) throw error;
    return data.map(fromRow);
  },

  async create(text, priority = 0) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({ text, priority })
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
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("tasks")
      .update(rowPatch)
      .eq("id", id)
      .select("id,text,status,priority,completed_at,created_at,updated_at")
      .single();

    if (error) throw error;
    return fromRow(data);
  },

  async remove(id) {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) throw error;
    return true;
  }
};
