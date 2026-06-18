# One Task

「目の前の1件だけを表示する」タスク管理アプリの localStorage 版です。

## 起動

```bash
npm install
npm run dev
```

表示された `http://localhost:5173/` などをブラウザで開いてください。

## 仕様

- メイン画面には最優先タスクのみ表示
- 管理画面へは右下ボタンから遷移
- タスクは単一本文のみ
- タスク追加時に優先度をスライダーで指定
- 完了したタスクの直近3件を保持
- 完了済みタスクは管理画面から未完了へリバース可能
- 保存先は localStorage
- 保存処理は `src/storage.js` に集約

## Supabaseへ置換する場合

`src/storage.js` と同じ関数を持つSupabase版に差し替えてください。

必要な関数:

- `taskStore.list()`
- `taskStore.create(text, priority)`
- `taskStore.update(id, patch)`
- `taskStore.remove(id)`

DB最小構成例:

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  status text not null default 'open',
  priority integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
