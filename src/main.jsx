import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Settings, ArrowLeft, Plus, Trash2, ChevronUp, Check, RotateCcw } from "lucide-react";
import { taskStore } from "./storage";
import "./styles.css";

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status === "open" ? -1 : 1;
    return b.priority - a.priority || new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function recentDoneTasks(tasks) {
  return tasks
    .filter((task) => task.status === "done")
    .sort((a, b) => new Date(b.completedAt ?? b.updatedAt) - new Date(a.completedAt ?? a.updatedAt))
    .slice(0, 3);
}

function App() {
  const [screen, setScreen] = useState("main");
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState(0);

  async function refresh() {
    const next = await taskStore.list();
    setTasks(sortTasks(next));
  }

  useEffect(() => {
    refresh();
  }, []);

  const topTask = useMemo(
    () => sortTasks(tasks).find((task) => task.status === "open") ?? null,
    [tasks]
  );

  const undoTargets = useMemo(() => recentDoneTasks(tasks), [tasks]);

  async function addTask(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await taskStore.create(text, priority);
    setDraft("");
    setPriority(0);
    await refresh();
  }

  async function completeTask(id) {
    await taskStore.update(id, {
      status: "done",
      completedAt: new Date().toISOString()
    });
    await refresh();
  }

  async function restoreTask(id) {
    await taskStore.update(id, {
      status: "open",
      completedAt: null
    });
    await refresh();
  }

  async function prioritizeTask(id) {
    const target = tasks.find((task) => task.id === id);
    if (!target) return;
    await taskStore.update(id, { priority: target.priority + 1 });
    await refresh();
  }

  async function deleteTask(id) {
    await taskStore.remove(id);
    await refresh();
  }

  return (
    <div className="app">
      {screen === "main" ? (
        <main className="main-screen">
          {topTask ? (
            <button
              className="task-only"
              onClick={() => completeTask(topTask.id)}
              aria-label="タスクを完了する"
              title="クリックで完了"
            >
              {topTask.text}
            </button>
          ) : (
            <div className="empty">タスクなし</div>
          )}

          <button className="corner-button" onClick={() => setScreen("manage")} aria-label="管理画面を開く">
            <Settings size={22} />
          </button>
        </main>
      ) : (
        <main className="manage-screen">
          <header className="manage-header">
            <button className="icon-button" onClick={() => setScreen("main")} aria-label="メイン画面に戻る">
              <ArrowLeft size={22} />
            </button>
            <h1>管理</h1>
          </header>

          <form className="add-form" onSubmit={addTask}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="タスク"
              rows={4}
            />

            <label className="priority-control">
              <span>優先度</span>
              <strong>{priority}</strong>
              <input
                type="range"
                min="-10"
                max="10"
                value={priority}
                onChange={(event) => setPriority(Number(event.target.value))}
              />
            </label>

            <button className="primary-button" disabled={!draft.trim()}>
              <Plus size={18} />
              追加
            </button>
          </form>

          {undoTargets.length > 0 && (
            <section className="undo-section" aria-label="直近完了タスク">
              <h2>直近完了</h2>
              <div className="task-list">
                {undoTargets.map((task) => (
                  <article className="task-card done" key={task.id}>
                    <p>{task.text}</p>
                    <div className="task-meta">
                      <span>完了済み</span>
                      <span>優先度 {task.priority}</span>
                    </div>
                    <div className="task-actions">
                      <button onClick={() => restoreTask(task.id)} aria-label="未完了へリバース">
                        <RotateCcw size={17} />
                      </button>
                      <button onClick={() => deleteTask(task.id)} aria-label="削除">
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section className="task-list-section" aria-label="未完了タスク">
            <h2>未完了</h2>
            <div className="task-list">
              {tasks.filter((task) => task.status === "open").length === 0 ? (
                <p className="muted">未完了タスクはありません。</p>
              ) : (
                tasks
                  .filter((task) => task.status === "open")
                  .map((task) => (
                    <article className="task-card" key={task.id}>
                      <p>{task.text}</p>
                      <div className="task-meta">
                        <span>優先度 {task.priority}</span>
                      </div>
                      <div className="task-actions">
                        <button onClick={() => completeTask(task.id)} aria-label="完了">
                          <Check size={17} />
                        </button>
                        <button onClick={() => prioritizeTask(task.id)} aria-label="優先度を上げる">
                          <ChevronUp size={17} />
                        </button>
                        <button onClick={() => deleteTask(task.id)} aria-label="削除">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </article>
                  ))
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
