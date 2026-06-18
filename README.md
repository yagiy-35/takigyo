# One Task

「目の前の1件だけ」を表示するタスク管理アプリです。

最初はゲスト状態で動作し、タスクはブラウザのlocalStorageに保存されます。管理画面からアカウント画面へ移動してサインイン/サインアップすると、Supabase Authのユーザーごとのタスク保存に切り替わります。

## 起動

```bash
npm install
npm run dev
```

表示された `http://localhost:5173/` などをブラウザで開いてください。

PowerShellの実行ポリシーで `npm` が止まる場合は、次のように実行できます。

```bash
npm.cmd run dev
```

## Supabase設定

`.env.example` を参考に `.env` を作成します。

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

SupabaseのSQL Editorで次を実行してください。

```sql
create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  status text not null default 'open',
  priority integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Users can read own tasks"
on tasks for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own tasks"
on tasks for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own tasks"
on tasks for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own tasks"
on tasks for delete
to authenticated
using (auth.uid() = user_id);
```

## 仕様

- メイン画面には未完了タスクの最優先1件だけを表示
- 管理画面にはタスク追加、完了、削除、優先度アップを表示
- 管理画面のアカウントボタンからアカウント画面へ移動
- ゲスト状態ではlocalStorageに保存
- サインイン/サインアップ後はSupabaseにユーザーごと保存
- サインアウトするとゲスト状態に戻り、localStorageのタスクを表示
- 完了済みタスクは直近3件を管理画面から未完了へ戻せる

## 実装メモ

保存処理は `src/storage.js` に集約しています。

- `authStore`: Supabase Authのセッション取得、サインイン、サインアップ、サインアウト
- `createTaskStore(session)`: セッションがあればSupabase、なければlocalStorageを使うタスク保存APIを返す
