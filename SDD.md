# Software Design Document
## Craftpost — AI 社群發布工具

**版本：** v1.0
**日期：** 2026-05-13
**格式：** Spec-Driven Development

---

## 目錄

1. [專案概述](#1-專案概述)
2. [技術選型](#2-技術選型)
3. [系統架構](#3-系統架構)
4. [開發範圍](#4-開發範圍)
5. [功能規格](#5-功能規格)
6. [資料庫 Schema](#6-資料庫-schema)
7. [API 契約](#7-api-契約)
8. [非功能規格](#8-非功能規格)
9. [部署設定](#9-部署設定)

---

## 1. 專案概述

### 1.1 產品定位

Craftpost 是以作者為中心的 AI 社群發布工具。核心主張：**草稿是你的，AI 是助理，不是代筆者。**

### 1.2 核心流程

```
輸入草稿 + 上傳圖片／影片（選填）
  → 填寫 AI prompt（選填）
  → AI 修稿 → 結果取代草稿
  → 確認 / 繼續調整
  → 選擇平台（多選）→ 各平台微調
  → 立即發布 or 排程
  → 發布
```

### 1.3 計費模型

免費無限修稿，發布時才要求付費。

| 方案 | 月費 | 修稿 | 身份數 | 每身份帳號數 | 發布 |
|---|---|---|---|---|---|
| Free | $0 | 無限 | — | — | 不可 |
| Basic | $7 | 無限 | 1 | 2 | 可 |
| Pro | $12 | 無限 | 5 | 10 | 可 |

---

## 2. 技術選型

| 層級 | 技術 | 版本 |
|---|---|---|
| 前端框架 | Next.js App Router | 15.x |
| 前端語言 | TypeScript | 5.x |
| 前端樣式 | Tailwind CSS | 3.x |
| 前端動畫 | Framer Motion | 11.x |
| 富文字編輯 | TipTap | 2.x |
| 後端框架 | FastAPI | 0.115.x |
| 後端語言 | Python | 3.12 |
| 排程 | APScheduler | 3.x（內嵌 FastAPI）|
| 資料庫 | PostgreSQL 15 | via Supabase |
| 認證 | Supabase Auth | — |
| 儲存 | Supabase Storage | — |
| 計費 | Paddle | — |
| AI | Claude API | claude-sonnet-4-20250514 |
| 部署 | Railway | — |

---

## 3. 系統架構

### 3.1 Monorepo 結構

```
craftpost/
├── frontend/          → Railway service: frontend（craftpost.app）
├── backend/           → Railway service: web（FastAPI + APScheduler）
├── docker-compose.yml
└── CLAUDE.md / AGENTS.md / SDD.md
```

### 3.2 後端模組

```
backend/app/
├── core/
│   ├── config.py       # Pydantic Settings
│   ├── database.py     # Supabase client（service_key）
│   ├── security.py     # JWT 驗證、AES-256-GCM token 加解密
│   └── scheduler.py    # APScheduler 初始化
├── api/
│   ├── deps.py         # get_current_user, check_publish_access
│   ├── draft.py        # POST /api/draft/refine
│   ├── publish.py      # POST /api/publish, DELETE /api/publish/schedule/{id}
│   ├── platforms.py    # GET /api/platforms
│   ├── media.py        # POST /api/media/upload
│   ├── social.py       # GET/DELETE /api/social/*
│   └── billing.py      # POST /api/billing/*
└── services/
    ├── ai/refine.py    # PromptBuilder + Claude API
    └── publish/
        ├── base.py     # BasePlatformAdapter
        ├── registry.py # PlatformRegistry
        └── platforms/  # instagram.py, threads.py, x.py, linkedin.py
```

---

## 4. 開發範圍

### Vertical Slice 順序

```
Slice 1   Landing page（試用框，無需登入）
Slice 2   編輯頁（版面 + AI 修稿串接）
Slice 3   發布（IG + Threads，立即發布）
Slice 4   排程（APScheduler + AI 建議時間）
Slice 5   登入 + DB（Supabase Auth + Schema）
Slice 6   身份管理（多品牌帳號）
Slice 7   計費（Paddle 訂閱）
Slice 8   Docker + Railway 部署
Slice 9   X、LinkedIn + 各平台微調
```

### Slice 1–4 範圍外（禁止實作）

- Supabase Auth / JWT 驗證
- DB 寫入（結果存 localStorage）
- Paddle 計費
- X、LinkedIn adapter
- Redis、Celery

---

## 5. 功能規格

### 5.1 Landing Page

#### Requirements

- REQ-LAND-01：訪客不需登入即可試用 AI 修稿
- REQ-LAND-02：試用框包含圖片區塊（上下）和文字區塊，上下排列，不用 Tab
- REQ-LAND-03：圖片區塊支援上傳圖片後 AI 生成 caption
- REQ-LAND-04：文字區塊支援輸入草稿後 AI 修稿
- REQ-LAND-05：點「發布」時才彈出 Google 登入 Modal
- REQ-LAND-06：登入後修稿結果透過 localStorage 帶入 `/app/drafts/new`

#### Acceptance Criteria

```gherkin
Scenario: 訪客文字試用
  Given 訪客進入 /，未登入
  When 在文字區塊輸入草稿並點擊「Refine」
  Then 呼叫 POST /api/draft/refine（無 JWT）
  And 結果直接取代輸入框內容
  And 顯示「Publish →」按鈕

Scenario: 訪客圖片試用
  Given 訪客上傳一張圖片
  When 點擊「Generate caption」
  Then 呼叫 Claude API（vision），回傳適合的 caption
  And caption 顯示在圖片下方文字框

Scenario: 點擊發布觸發登入
  When 訪客點擊「Publish →」
  Then 彈出 Google 登入 Modal（overlay，不跳頁）
  And Modal 說明「登入後即可發布」

Scenario: 登入後帶入結果
  When Google 登入完成
  Then 導向 /app/drafts/new
  And 試用的草稿和修稿結果已帶入編輯器
```

---

### 5.2 編輯頁

#### Requirements

- REQ-EDIT-01：頁面分三層，版面如下：
  - 上層：圖稿區（固定，無圖時顯示上傳提示）
  - 中層：左欄草稿輸入/修稿結果（同一個 TipTap 編輯器）；右欄 AI Prompt 輸入（選填，300 字）
  - 下層：左欄平台多選 checkbox；右欄 [重新修稿] [前往發布]
- REQ-EDIT-02：點「重新修稿」後，左欄內容直接被 AI 結果取代，不顯示 diff
- REQ-EDIT-03：修稿結果可繼續手動編輯
- REQ-EDIT-04：圖稿區支援上傳多圖（最多 10 張）或一支影片，不可同時
- REQ-EDIT-05：修圖操作支援放大、縮小、平移、裁切、比例切換
- REQ-EDIT-06：AI Prompt 最多 300 字，超過截斷，顯示計數
- REQ-EDIT-07：平台 checkbox 預設勾選 Instagram 和 Threads
- REQ-EDIT-08：草稿為空時「重新修稿」按鈕 disabled

#### Acceptance Criteria

```gherkin
Scenario: 正常修稿
  Given 使用者輸入草稿文字
  When 點擊「重新修稿」
  Then 按鈕顯示 loading spinner
  And 呼叫 POST /api/draft/refine
  And 成功後左欄內容被 AI 結果取代
  And 使用者可繼續在左欄編輯

Scenario: 有圖有文一起修稿
  Given 使用者上傳圖片並輸入草稿
  When 點擊「重新修稿」
  Then 圖片送給 Claude（vision），草稿文字一起送
  And AI 回傳同時參考圖片內容的修稿結果

Scenario: 自訂 prompt
  Given 使用者在右欄填入「結尾加一句 CTA」
  When 點擊「重新修稿」
  Then user_subprompt 帶入 API
  And 修稿結果符合指示

Scenario: prompt 超過 300 字
  When 使用者輸入超過 300 字
  Then 無法繼續輸入
  And 計數顯示 300/300，紅色

Scenario: 前往發布（未付費）
  Given 使用者方案為 Free
  When 點擊「前往發布」
  Then 彈出升級 Modal
  And 顯示 Basic $7/月 和 Pro $12/月 選項

Scenario: 前往發布（已付費）
  Given 使用者方案為 Basic 或 Pro
  When 點擊「前往發布」
  Then 導向 /app/publish/[postId]
```

---

### 5.3 發布控制頁

#### Requirements

- REQ-PUB-01：顯示最終文字與圖稿預覽
- REQ-PUB-02：各平台可個別微調文字（各自獨立編輯）
- REQ-PUB-03：發布方式：立即 or 排程（指定時間 + AI 建議）
- REQ-PUB-04：各平台發布狀態即時回饋（pending → success / failed）
- REQ-PUB-05：部分平台失敗不影響其他平台

#### Acceptance Criteria

```gherkin
Scenario: 各平台微調文字
  Given 使用者在發布控制頁
  When 點擊 Instagram 展開微調
  Then 顯示可編輯的文字框，預填修稿結果
  And 修改只影響 Instagram，不影響其他平台

Scenario: 立即發布
  When 選擇「立即發布」並點擊「發布」
  Then POST /api/publish（scheduled_at: null）
  And 各平台顯示 pending → success / failed

Scenario: 排程發布
  When 選擇「排程」並設定未來時間
  Then POST /api/publish（帶 scheduled_at UTC）
  And 導向草稿清單，顯示「排程中 · 時間」

Scenario: 選擇過去時間
  When 使用者輸入已過去的時間
  Then 顯示「請選擇未來的時間」inline 錯誤
  And 發布按鈕 disabled

Scenario: 部分平台失敗
  Given Instagram 發布成功，Threads 失敗
  Then Instagram 顯示 success
  And Threads 顯示 failed + 錯誤原因
  And 提供「重試 Threads」按鈕
```

---

### 5.4 排程功能

#### Requirements

- REQ-SCHED-01：APScheduler 每 60 秒掃描 `publish_logs` 中 `scheduled_at <= now()` 的排程
- REQ-SCHED-02：`GET /api/publish/best-time` 回傳各平台建議發布時間
- REQ-SCHED-03：排程時間以 UTC 儲存，前端顯示台灣時間（UTC+8）
- REQ-SCHED-04：可取消排程（狀態回到 confirmed）

#### 最佳時間規則（固定，非歷史資料）

```python
BEST_TIMES = {
    "instagram": [
        {"time": "12:00", "reason": "午休瀏覽高峰"},
        {"time": "19:00", "reason": "下班後高峰"},
    ],
    "threads": [
        {"time": "08:00", "reason": "通勤早晨"},
        {"time": "21:00", "reason": "夜間活躍"},
    ],
}
```

---

### 5.5 登入

#### Requirements

- REQ-AUTH-01：支援 Google OAuth（唯一登入方式）
- REQ-AUTH-02：所有 `/app/*` 路由需登入
- REQ-AUTH-03：`/api/*` 除 `/health`、`/webhooks/paddle` 外需帶 JWT
- REQ-AUTH-04：登入成功自動建立 `profiles` 資料列

#### Acceptance Criteria

```gherkin
Scenario: 未登入進入 /app
  Given 使用者未登入
  When 訪問 /app/drafts
  Then 導向 /login?redirectTo=/app/drafts

Scenario: 登入後回到原頁
  When Google OAuth 完成
  Then 導向 redirectTo 的路徑（預設 /app/drafts）
  And profiles 表自動建立，plan = "free"

Scenario: JWT 過期
  Given JWT 已過期
  When 呼叫任何受保護 API
  Then 回傳 401 { "code": "INVALID_TOKEN" }
  And 前端自動導向 /login
```

---

### 5.6 身份管理

#### Requirements

- REQ-IDENT-01：使用者可建立多個品牌身份（Identity）
- REQ-IDENT-02：每個身份下可連結多個社群帳號（OAuth）
- REQ-IDENT-03：Basic：1 個身份，每身份 2 個帳號；Pro：5 個身份，每身份 10 個帳號
- REQ-IDENT-04：發布時先選身份，再選該身份下的平台
- REQ-IDENT-05：社群帳號 OAuth token 以 AES-256-GCM 加密儲存

---

### 5.7 計費

#### Requirements

- REQ-BILL-01：修稿完全免費，點「前往發布」時才檢查方案
- REQ-BILL-02：未付費使用者點「前往發布」彈出升級 Modal
- REQ-BILL-03：方案升降級透過 Stripe/Paddle Webhook 更新，前端不可直接改
- REQ-BILL-04：Paddle Webhook 必須驗證 HMAC 簽名

#### Acceptance Criteria

```gherkin
Scenario: Free 使用者點前往發布
  Given plan = "free"
  When 點擊「前往發布」
  Then 彈出升級 Modal（不跳頁）
  And 顯示 Basic $7 和 Pro $12 選項
  And 點升級開啟 Paddle overlay

Scenario: 付款完成
  When Paddle 送出 subscription.created webhook
  Then profiles.plan 更新為 "basic" 或 "pro"
  And 使用者可正常進入發布控制頁

Scenario: Webhook 簽名錯誤
  Given 錯誤的 paddle-signature
  When POST /api/webhooks/paddle
  Then 回傳 400，profiles 不變
```

---

## 6. 資料庫 Schema

```sql
-- 使用者方案
CREATE TABLE public.profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan                    TEXT NOT NULL DEFAULT 'free',  -- free | basic | pro
  paddle_subscription_id  TEXT UNIQUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 品牌身份
CREATE TABLE public.identities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  is_default   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 社群帳號（掛在身份下）
CREATE TABLE public.social_accounts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id            UUID NOT NULL REFERENCES public.identities(id) ON DELETE CASCADE,
  platform               TEXT NOT NULL,  -- instagram | threads | x | linkedin
  platform_user_id       TEXT NOT NULL,
  platform_username      TEXT,
  access_token_encrypted TEXT NOT NULL,  -- AES-256-GCM
  token_expires_at       TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (identity_id, platform)
);

-- 草稿
CREATE TABLE public.posts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  identity_id    UUID REFERENCES public.identities(id),
  draft          TEXT NOT NULL,
  refined        TEXT,
  final_text     TEXT,
  user_subprompt TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',
  -- draft | refined | confirmed | scheduled | publishing | published
  scheduled_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 媒體檔案
CREATE TABLE public.media (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  storage_url TEXT NOT NULL,
  media_type  TEXT NOT NULL,  -- image | video
  mime_type   TEXT NOT NULL,
  file_size   INT,
  width       INT,
  height      INT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 發布紀錄
CREATE TABLE public.publish_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id          UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  platform_text    TEXT,           -- 各平台微調後的文字
  status           TEXT NOT NULL DEFAULT 'pending',
  -- pending | scheduled | publishing | success | failed | cancelled
  scheduled_at     TIMESTAMPTZ,
  platform_post_id TEXT,
  platform_url     TEXT,
  error_msg        TEXT,
  attempt_count    INT NOT NULL DEFAULT 0,
  published_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS 政策

```sql
-- 所有表啟用 RLS，使用者只能存取自己的資料
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles USING (auth.uid() = id);

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own identities" ON public.identities USING (auth.uid() = user_id);

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own social accounts" ON public.social_accounts
  USING (EXISTS (SELECT 1 FROM public.identities WHERE id = identity_id AND user_id = auth.uid()));

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own posts" ON public.posts USING (auth.uid() = user_id);

ALTER TABLE public.publish_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own publish logs" ON public.publish_logs
  USING (EXISTS (SELECT 1 FROM public.posts WHERE id = post_id AND user_id = auth.uid()));
```

---

## 7. API 契約

### 共用規則

- Base URL（開發）：`http://localhost:8000`
- 所有 API 帶 `Authorization: Bearer <jwt>`（除 `/health`、`/api/webhooks/paddle`）
- 錯誤格式：`{ "code": "ERROR_CODE", "message": "說明", "detail": {} }`

### 端點清單

```
GET  /health                         → { "status": "ok" }

POST /api/draft/refine               → AI 修稿
GET  /api/platforms                  → 所有平台 + 使用者帳號狀態

POST /api/publish                    → 立即 or 排程發布
DELETE /api/publish/schedule/{id}    → 取消排程
GET  /api/publish/best-time          → AI 建議發布時間

POST /api/media/upload               → 上傳媒體至 Supabase Storage

GET  /api/social/connect/{platform}  → OAuth 連結（redirect）
GET  /api/social/callback/{platform} → OAuth callback

GET  /api/user/profile               → 使用者方案與身份
GET  /api/identities                 → 身份列表
POST /api/identities                 → 新增身份
DELETE /api/identities/{id}          → 刪除身份

POST /api/billing/create-checkout    → Paddle Checkout
POST /api/billing/management-url     → Paddle 管理連結
POST /api/webhooks/paddle            → Paddle Webhook（無需 JWT）
```

### 關鍵 Request/Response

**POST /api/draft/refine**
```json
Request:  { "draft": "...", "user_subprompt": "...", "media_urls": ["..."] }
Response: { "post_id": "uuid|unsaved", "refined": "..." }
```

**POST /api/publish**
```json
Request: {
  "post_id": "uuid",
  "identity_id": "uuid",
  "platforms": ["instagram", "threads"],
  "platform_texts": { "instagram": "...", "threads": "..." },
  "scheduled_at": "2026-05-15T11:00:00Z | null"
}
Response 202: { "mode": "immediate|scheduled", "scheduled_at": "..." }
```

**GET /api/platforms**
```json
Response: {
  "platforms": [{
    "id": "instagram",
    "display_name": "Instagram",
    "max_chars": 2200,
    "media_limits": { "max_images": 10, "max_videos": 1 },
    "account_connected": true,
    "account_username": "@handle",
    "token_expired": false
  }]
}
```

---

## 8. 非功能規格

| 指標 | 目標 |
|---|---|
| AI 修稿回應時間 | P95 < 8 秒 |
| 發布 API 回應 | P95 < 1 秒（立即回 202）|
| 系統可用性 | 99.5% |
| Rate limit | refine: 10/min，publish: 5/min（記憶體實作）|

### 安全性

- JWT 兩層驗證（Next.js middleware + FastAPI deps）
- Social token AES-256-GCM 加密存 DB
- User subprompt sanitize + XML tag 隔離
- Paddle Webhook HMAC 簽名驗證
- 所有表 RLS 啟用

---

## 9. 部署設定

### Railway 架構

```
craftpost/
├── frontend   Next.js，domain: craftpost.app
└── web        FastAPI + APScheduler
```

### docker-compose.yml

```yaml
version: '3.9'
services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
        NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: ${NEXT_PUBLIC_PADDLE_CLIENT_TOKEN}
        NEXT_PUBLIC_PADDLE_ENV: ${NEXT_PUBLIC_PADDLE_ENV}
    ports:
      - "${FRONTEND_PORT:-3000}:3000"
    depends_on:
      - web

  web:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "${PORT:-8000}:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - PADDLE_API_KEY=${PADDLE_API_KEY}
      - PADDLE_WEBHOOK_SECRET=${PADDLE_WEBHOOK_SECRET}
      - PADDLE_BASIC_PRICE_ID=${PADDLE_BASIC_PRICE_ID}
      - PADDLE_PRO_PRICE_ID=${PADDLE_PRO_PRICE_ID}
      - TOKEN_ENCRYPTION_KEY=${TOKEN_ENCRYPTION_KEY}
      - META_APP_ID=${META_APP_ID}
      - META_APP_SECRET=${META_APP_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - BACKEND_URL=${BACKEND_URL}
```

### 部署步驟

```
1. 把 docker-compose.yml 拖曳到 Railway project canvas
2. Railway 自動建立 frontend 和 web 兩個 services
3. 填入所有環境變數
4. frontend service → Settings → Custom Domain → craftpost.app
5. Push to main → 自動重新部署
```