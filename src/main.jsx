import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  LogOut,
  Plus,
  RotateCcw,
  Settings,
  Trash2,
  User
} from "lucide-react";
import { authStore, createTaskStore, migrateGuestTasksToAccount } from "./storage";
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
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!authStore.isConfigured());
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState("");
  const [priority, setPriority] = useState(0);
  const [authMode, setAuthMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const taskStore = useMemo(() => createTaskStore(session), [session]);
  const isAccount = Boolean(session?.user);

  async function refresh(store = taskStore) {
    try {
      const next = await store.list();
      setTasks(sortTasks(next));
      setError("");
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  useEffect(() => {
    let active = true;

    authStore
      .getSession()
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setAuthReady(true);
      })
      .catch((nextError) => {
        if (!active) return;
        setError(nextError.message);
        setAuthReady(true);
      });

    const unsubscribe = authStore.onAuthStateChange((nextSession) => {
      setSession(nextSession);
      setScreen("main");
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authReady) refresh(taskStore);
  }, [authReady, taskStore]);

  useEffect(() => {
    if (!authReady || !session?.user) return;

    let active = true;
    const accountStore = createTaskStore(session);

    migrateGuestTasksToAccount(session)
      .then(() => {
        if (active) refresh(accountStore);
      })
      .catch((nextError) => {
        if (active) setError(nextError.message);
      });

    return () => {
      active = false;
    };
  }, [authReady, session?.user?.id]);

  const topTask = useMemo(
    () => sortTasks(tasks).find((task) => task.status === "open") ?? null,
    [tasks]
  );

  const openTasks = useMemo(() => tasks.filter((task) => task.status === "open"), [tasks]);
  const undoTargets = useMemo(() => recentDoneTasks(tasks), [tasks]);

  async function runTaskAction(action) {
    try {
      await action();
      await refresh();
    } catch (nextError) {
      setError(nextError.message);
    }
  }

  async function addTask(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;

    await runTaskAction(async () => {
      await taskStore.create(text, priority);
      setDraft("");
      setPriority(0);
    });
  }

  async function completeTask(id) {
    await runTaskAction(() =>
      taskStore.update(id, {
        status: "done",
        completedAt: new Date().toISOString()
      })
    );
  }

  async function restoreTask(id) {
    await runTaskAction(() =>
      taskStore.update(id, {
        status: "open",
        completedAt: null
      })
    );
  }

  async function prioritizeTask(id) {
    const target = tasks.find((task) => task.id === id);
    if (!target) return;
    await runTaskAction(() => taskStore.update(id, { priority: target.priority + 1 }));
  }

  async function deprioritizeTask(id) {
    const target = tasks.find((task) => task.id === id);
    if (!target) return;
    await runTaskAction(() => taskStore.update(id, { priority: target.priority - 1 }));
  }

  async function deleteTask(id) {
    await runTaskAction(() => taskStore.remove(id));
  }

  async function submitAuth(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    try {
      const nextSession =
        authMode === "signin"
          ? await authStore.signIn(email.trim(), password)
          : await authStore.signUp(email.trim(), password);

      if (nextSession) {
        setSession(nextSession);
        setNotice("アカウントのタスク管理に切り替えました。");
        setScreen("manage");
      } else {
        setNotice("確認メールを送信しました。メール内のリンクから登録を完了してください。");
      }

      setPassword("");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");

    try {
      await authStore.signOut();
      setSession(null);
      setNotice("ゲストのタスク管理に戻りました。");
      setScreen("manage");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return <div className="loading">読み込み中</div>;
  }

  return (
    <div className="app">
      {screen === "main" && (
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
            <div className="empty">右下からタスクを追加</div>
          )}

          <button
            className="corner-button"
            onClick={() => setScreen("manage")}
            aria-label="管理画面を開く"
          >
            <Settings size={22} />
          </button>
        </main>
      )}

      {screen === "manage" && (
        <main className="manage-screen">
          <header className="manage-header">
            <button className="icon-button" onClick={() => setScreen("main")} aria-label="戻る">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1>管理</h1>
              <p className="mode-label">{isAccount ? session.user.email : "ゲスト"}</p>
            </div>
            <button
              className="icon-button"
              onClick={() => setScreen("account")}
              aria-label="アカウント管理"
            >
              <User size={21} />
            </button>
          </header>

          {error && <p className="message error">{error}</p>}
          {notice && <p className="message">{notice}</p>}

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
                      <button onClick={() => restoreTask(task.id)} aria-label="未完了に戻す">
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
              {openTasks.length === 0 ? (
                <p className="muted">未完了タスクはありません。</p>
              ) : (
                openTasks.map((task) => (
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
                      <button onClick={() => deprioritizeTask(task.id)} aria-label="優先度を下げる">
                        <ChevronDown size={17} />
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

      {screen === "account" && (
        <main className="manage-screen">
          <header className="manage-header">
            <button className="icon-button" onClick={() => setScreen("manage")} aria-label="戻る">
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1>アカウント</h1>
              <p className="mode-label">{isAccount ? "Supabaseで保存中" : "ゲストで保存中"}</p>
            </div>
          </header>

          {error && <p className="message error">{error}</p>}
          {notice && <p className="message">{notice}</p>}

          {!authStore.isConfigured() ? (
            <section className="account-panel">
              <h2>Supabase未設定</h2>
              <p className="muted">
                .envにVITE_SUPABASE_URLとVITE_SUPABASE_ANON_KEYを設定すると認証を使えます。
              </p>
            </section>
          ) : isAccount ? (
            <section className="account-panel">
              <p className="account-email">{session.user.email}</p>
              <button className="secondary-button" onClick={signOut} disabled={busy}>
                <LogOut size={18} />
                サインアウト
              </button>
            </section>
          ) : (
            <section className="account-panel">
              <div className="segmented">
                <button
                  className={authMode === "signin" ? "active" : ""}
                  onClick={() => setAuthMode("signin")}
                  type="button"
                >
                  サインイン
                </button>
                <button
                  className={authMode === "signup" ? "active" : ""}
                  onClick={() => setAuthMode("signup")}
                  type="button"
                >
                  サインアップ
                </button>
              </div>

              <form className="auth-form" onSubmit={submitAuth}>
                <label>
                  <span>メールアドレス</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  <span>パスワード</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    minLength={6}
                    required
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {authMode === "signin" ? "サインイン" : "サインアップ"}
                </button>
              </form>
            </section>
          )}
        </main>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
