const STORAGE_KEY = "one-task-priority-undo-v1";

function nowIso() {
  return new Date().toISOString();
}

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export const taskStore = {
  async list() {
    return read();
  },

  async create(text, priority = 0) {
    const tasks = read();

    const task = {
      id: crypto.randomUUID(),
      text,
      status: "open",
      priority: Number(priority),
      completedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    write([...tasks, task]);
    return task;
  },

  async update(id, patch) {
    const tasks = read();
    const next = tasks.map((task) =>
      task.id === id
        ? { ...task, ...patch, updatedAt: nowIso() }
        : task
    );

    write(next);
    return next.find((task) => task.id === id) ?? null;
  },

  async remove(id) {
    const tasks = read();
    write(tasks.filter((task) => task.id !== id));
    return true;
  }
};
