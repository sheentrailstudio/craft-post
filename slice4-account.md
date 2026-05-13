# Slice 4 — 身份管理 + 帳號管理

> 實作身份管理功能與社群帳號管理功能。
> 前端 UI + 後端完整實作。
> 使用 Supabase Auth 驗證使用者，Supabase PostgreSQL 儲存身份與帳號資料，社群 OAuth token 必須加密後保存。
> **禁止：Paddle 計費、X/LinkedIn adapter、多人團隊權限、管理後台。**

---

## 前提

Slice 3 已完成：
1. `/app/drafts/new` 可修稿並前往發布頁
2. `/app/publish/[postId]` 可立即發布或排程發布
3. Instagram / Threads adapter 與 Meta OAuth skeleton 已存在

本 Slice 將前面使用的 demo user、記憶體 token、mock connected state 改成真實登入使用者與資料庫資料。

---

## 完成標準

使用者登入後可以：
1. 進入 `/app/settings/identities` 建立、編輯、刪除品牌身份
2. 在每個身份底下連結 Instagram / Threads 社群帳號
3. 查看已連結帳號的平台、handle、連線狀態、token 到期狀態
4. 斷開社群帳號連結
5. 在發布流程選擇身份，並使用該身份底下的社群帳號 token 發布
6. Basic / Pro 身份數與每身份帳號數限制由後端強制檢查

---

## 資料模型

### 關聯

```
Supabase auth.users
  └── identities
        └── social_accounts
```

### `profiles`

用來記錄使用者方案與基礎資料。本 Slice 先建立方案欄位並以既有資料判斷限制；Slice 5 實作 Paddle 後，方案狀態改由 Paddle webhook 更新。

```sql
create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'free' check (plan in ('free', 'basic', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### `identities`

```sql
create table identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  avatar_color text not null default '#6366f1',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index identities_user_id_idx on identities(user_id);
create unique index identities_one_default_per_user
  on identities(user_id)
  where is_default = true;
```

### `social_accounts`

```sql
create table social_accounts (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references identities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'threads')),
  platform_account_id text not null,
  username text not null,
  display_name text,
  avatar_url text,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(identity_id, platform, platform_account_id)
);

create index social_accounts_user_id_idx on social_accounts(user_id);
create index social_accounts_identity_id_idx on social_accounts(identity_id);
```

### RLS

後端使用 service key 存取資料庫。仍需建立 RLS policy，避免未來前端直接查詢時越權。

```sql
alter table profiles enable row level security;
alter table identities enable row level security;
alter table social_accounts enable row level security;

create policy "profiles owner read"
  on profiles for select
  using (auth.uid() = user_id);

create policy "identities owner read"
  on identities for select
  using (auth.uid() = user_id);

create policy "social accounts owner read"
  on social_accounts for select
  using (auth.uid() = user_id);
```

---

## 方案限制

| 方案 | 身份數 | 每身份社群帳號數 | 發布 |
|---|---:|---:|---|
| Free | 0 | 0 | 不可 |
| Basic | 1 | 2 | 可 |
| Pro | 5 | 10 | 可 |

後端必須強制檢查：
1. Free 不可建立身份，也不可連結社群帳號
2. Basic 最多 1 個身份，每身份最多 2 個社群帳號
3. Pro 最多 5 個身份，每身份最多 10 個社群帳號
4. 刪除身份會 cascade 刪除該身份底下的社群帳號

錯誤格式：

```json
{
  "code": "IDENTITY_LIMIT_REACHED",
  "message": "目前方案已達身份數上限",
  "upgrade_url": "/pricing"
}
```

---

## 後端規格

### 新增核心模組

```
backend/app/core/database.py      # Supabase service client
backend/app/core/security.py      # JWT 驗證、token 加解密
backend/app/api/deps.py           # get_current_user, check_publish_access
backend/app/api/identities.py     # 身份 CRUD
```

### JWT 驗證

所有 `/api/identities/*`、`/api/social/*`、`/api/publish` 需要登入。

```python
@router.get("/identities")
async def list_identities(user=Depends(get_current_user)):
    ...
```

`get_current_user`：
1. 從 `Authorization: Bearer <access_token>` 讀取 Supabase JWT
2. 驗證 token 有效
3. 回傳 `{ "id": user_id, "email": email }`
4. 無 token 或 token 無效回傳 401

### Token 加密

使用 `TOKEN_ENCRYPTION_KEY` 加密 OAuth token。

規格：
1. 使用 AES-256-GCM 或 Fernet 等 authenticated encryption
2. 不可明文儲存 access token / refresh token
3. 只有發布或刷新 token 時才解密
4. `TOKEN_ENCRYPTION_KEY` 由 `app.core.config.settings` 讀取

### `GET /api/identities`

回傳登入使用者的身份列表，包含每個身份底下的社群帳號摘要。

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Craftpost",
      "description": "AI social publishing",
      "avatar_color": "#6366f1",
      "is_default": true,
      "social_accounts": [
        {
          "id": "uuid",
          "platform": "instagram",
          "username": "@craftpost",
          "display_name": "Craftpost",
          "avatar_url": null,
          "status": "connected",
          "token_expires_at": "2026-06-01T00:00:00Z"
        }
      ]
    }
  ],
  "limits": {
    "plan": "basic",
    "max_identities": 1,
    "max_accounts_per_identity": 2
  }
}
```

### `POST /api/identities`

**Request:**

```json
{
  "name": "Personal Brand",
  "description": "Creator account",
  "avatar_color": "#10b981"
}
```

規則：
1. `name` 必填，最多 60 字
2. `description` 選填，最多 300 字
3. `avatar_color` 必須是 hex color
4. 檢查方案身份數上限
5. 第一個身份自動設為 `is_default = true`

### `PATCH /api/identities/{identity_id}`

可修改：
1. `name`
2. `description`
3. `avatar_color`
4. `is_default`

規則：
1. 只能修改自己的身份
2. 若設定某身份為 default，必須清掉同使用者其他 default
3. 不可把唯一身份的 `is_default` 設成 false

### `DELETE /api/identities/{identity_id}`

規則：
1. 只能刪除自己的身份
2. 刪除後該身份底下社群帳號 cascade 刪除
3. 若刪除 default identity，且仍有其他身份，最早建立的身份自動成為 default

### `GET /api/social/connect/{platform}`

建立 OAuth 授權 URL。

Query：
1. `identity_id` 必填
2. `platform` 只允許 `instagram` / `threads`

規則：
1. 驗證身份屬於目前使用者
2. 檢查每身份帳號數上限
3. OAuth `state` 必須包含 `user_id`、`identity_id`、`platform`，並簽章防竄改
4. 回傳 redirect 或 `{ "url": "..." }`，依前端呼叫方式決定

### `GET /api/social/callback/{platform}`

OAuth callback。

規則：
1. 驗證 `state` 簽章與平台一致
2. 使用 code 換取 access token
3. 查詢平台帳號 id、username、display_name、avatar_url
4. 加密 token 後 upsert `social_accounts`
5. 導回 `/app/settings/identities?connected={platform}`

### `DELETE /api/social/accounts/{account_id}`

斷開社群帳號。

規則：
1. 只能刪除自己的帳號
2. 刪除 DB token
3. 若平台支援 revoke，呼叫 revoke API；失敗不阻擋本地刪除，但需記錄 warning

### `GET /api/platforms`

從資料庫狀態回傳目前使用者可用平台與連線狀態。未登入時仍可回傳平台限制，但 `account_connected = false`。

Query：
1. `identity_id` 選填

```json
[
  {
    "id": "instagram",
    "display_name": "Instagram",
    "max_chars": 2200,
    "media_limits": { "max_images": 10, "max_videos": 1 },
    "account_connected": true,
    "account_username": "@craftpost",
    "token_expired": false
  }
]
```

### `POST /api/publish`

發布時必須新增 `identity_id`。

```json
{
  "identity_id": "uuid",
  "platforms": ["instagram", "threads"],
  "platform_texts": {
    "instagram": "caption",
    "threads": "thread text"
  },
  "media_urls": [],
  "scheduled_at": null
}
```

規則：
1. 驗證身份屬於目前使用者
2. 驗證方案可發布
3. 依 `identity_id + platform` 取得該身份的社群帳號 token
4. token 過期回傳平台層級錯誤 `TOKEN_EXPIRED`
5. 不再使用 `backend/app/core/token_store.py` 的記憶體 token

---

## 前端規格

### 路由

```
/login
/app/settings/identities
```

`/app/*` 頁面需要登入保護。未登入導向 `/login?next=<current_path>`。

### API 呼叫

所有 API 呼叫統一放在 `frontend/src/lib/api.ts`。

規格：
1. 自動從 Supabase session 取得 access token
2. 登入狀態下加上 `Authorization: Bearer <token>`
3. 401 時導向 `/login`
4. 402 時回傳升級資訊給 UI 顯示

### 設定頁 `/app/settings/identities`

版面：

```
┌─────────────────────────────────────────────────┐
│  Sidebar              Main                      │
│                       身份管理                  │
│                       [新增身份]                │
│                                                 │
│                       ┌─────────────────────┐   │
│                       │ Craftpost   Default │   │
│                       │ AI social tool      │   │
│                       │                     │   │
│                       │ Instagram @craftpost│   │
│                       │ Threads   未連結    │   │
│                       │                     │   │
│                       │ [連結帳號] [編輯]   │   │
│                       └─────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 身份列表

每張身份卡顯示：
1. avatar color swatch
2. name
3. description
4. default badge
5. 已連結帳號列表
6. `連結帳號`、`設為預設`、`編輯`、`刪除` 操作

空狀態：
1. Free：顯示「發布功能需要付費方案」與前往 pricing 按鈕
2. Basic / Pro：顯示建立第一個身份的按鈕

### 建立 / 編輯身份 Modal

欄位：
1. 名稱，必填，最多 60 字
2. 描述，選填，最多 300 字
3. 顏色 swatch，提供 8 個固定顏色
4. 設為預設 checkbox

驗證：
1. 名稱空白時儲存 disabled
2. 超過方案身份數上限時新增 disabled，顯示 inline 訊息
3. API 失敗顯示錯誤訊息

### 連結帳號 Modal

```
連結社群帳號

Instagram    已連結 @craftpost     [重新連結]
Threads      未連結               [連結]
```

規格：
1. 點擊連結 Instagram / Threads 呼叫 `/api/social/connect/{platform}?identity_id=...`
2. 若回傳 `url`，前端 `window.location.href = url`
3. callback 回到設定頁後顯示成功 toast
4. token 過期時顯示 `需要重新連結`

### 刪除確認

刪除身份前顯示確認 Modal：

```
刪除「Craftpost」？
這會移除此身份底下已連結的社群帳號，但不會刪除已發布的貼文。
[取消] [刪除]
```

### 發布流程整合

`/app/drafts/new` 與 `/app/publish/[postId]` 需要加入身份選擇。

規格：
1. 預設選取 default identity
2. 平台 checkbox 只顯示該身份已連結或可連結的平台狀態
3. 若平台未連結，顯示 `連結帳號` link 到 `/app/settings/identities`
4. 發布 API body 必須帶 `identity_id`
5. 若沒有身份，前往發布時導向 `/app/settings/identities`

---

## Acceptance Criteria

```gherkin
Scenario: 未登入進入身份管理
  Given 使用者未登入
  When 進入 /app/settings/identities
  Then 導向 /login?next=/app/settings/identities

Scenario: 建立第一個身份
  Given Basic 使用者已登入且尚無身份
  When 在身份管理頁建立身份「Personal」
  Then POST /api/identities 成功
  And 列表顯示「Personal」
  And 此身份被標記為 Default

Scenario: Basic 身份數達上限
  Given Basic 使用者已有 1 個身份
  When 嘗試建立第 2 個身份
  Then API 回應 402
  And detail.code 為 IDENTITY_LIMIT_REACHED
  And UI 顯示升級提示

Scenario: 編輯身份
  Given 使用者已有身份「Personal」
  When 將名稱改為「Studio」
  Then PATCH /api/identities/{id} 成功
  And 列表立即顯示「Studio」

Scenario: 刪除身份
  Given 使用者已有身份與已連結帳號
  When 確認刪除該身份
  Then DELETE /api/identities/{id} 成功
  And 該身份與底下帳號從列表移除

Scenario: 連結 Instagram 帳號
  Given 使用者已建立身份
  When 點擊 Instagram 連結
  Then 前端導向 Meta OAuth
  When OAuth callback 成功
  Then social_accounts 寫入 encrypted token
  And UI 顯示 Instagram username 與 connected 狀態

Scenario: 斷開帳號
  Given 身份底下已連結 Threads
  When 使用者點擊 Disconnect
  Then DELETE /api/social/accounts/{account_id} 成功
  And Threads 顯示未連結

Scenario: 發布使用身份 token
  Given 使用者選擇身份「Studio」
  And Studio 已連結 Instagram
  When POST /api/publish 帶 identity_id 與 instagram
  Then 後端讀取 Studio 的 Instagram encrypted token
  And 解密後交給 Instagram adapter 發布

Scenario: 發布缺少平台帳號
  Given 使用者選擇身份「Studio」
  And Studio 未連結 Threads
  When POST /api/publish 帶 threads
  Then 該平台結果為 failed
  And error code 為 ACCOUNT_NOT_CONNECTED
```

---

## 實作清單

### 後端

1. 新增 Supabase client 與 settings 欄位
2. 新增 JWT 驗證 dependency
3. 新增 token 加解密工具
4. 新增 identities API
5. 改寫 social OAuth callback，將 token 存入 `social_accounts`
6. 改寫 platforms API，依 identity 回傳連線狀態
7. 改寫 publish API，使用 identity token 發布
8. 移除或停止依賴 memory token store

### 前端

1. 完成 Supabase session hook 與登入保護
2. 更新 `lib/api.ts` 加入 Bearer token
3. 新增 `/app/settings/identities` 頁面
4. 新增身份卡、身份表單 Modal、連結帳號 Modal、刪除確認 Modal
5. 更新 Sidebar 設定入口
6. 在編輯頁與發布頁加入 identity selector
7. 補上未連結帳號、token 過期、方案上限等 UI state

### 驗證

1. `npm run lint`
2. `npm run build`
3. `python -m pytest` 或至少啟動 FastAPI 後手動驗證主要 API
4. 手動走一次：登入 → 建身份 → 連結帳號 → 發布 → 斷開帳號
