# CLAUDE.md — Craftpost

> 此文件供 Claude Code 使用，描述專案背景、技術棧與開發慣例。

---

## 專案簡介

**Craftpost** 是一個 AI 社群發布工具。
使用者輸入草稿（可附圖片或影片）→ AI 潤稿 → 確認後發布至多個社群平台。

**核心主張：** 草稿是你的，AI 是助理，不是代筆者。
**目標用戶：** 個人創作者、KOL、小型品牌行銷人員。

---

## 技術棧

| 層級 | 技術 |
|---|---|
| 前端 | Next.js 15 (App Router) + TypeScript + Tailwind CSS + Framer Motion |
| 後端 | FastAPI + Python 3.12 + Pydantic v2 |
| 排程 | APScheduler（內嵌 FastAPI，不用 Celery）|
| 資料庫 | Supabase（PostgreSQL + Auth + Storage）|
| 認證 | Supabase Auth（Google OAuth）|
| 計費 | Paddle（Merchant of Record，台灣可申請）|
| AI | Anthropic Claude API（claude-sonnet-4-20250514）|
| 部署 | Railway（前後端全部），domain: craftpost.app |

**不使用：** Redis、Celery、Vercel（全部部署在 Railway）

---

## Monorepo 目錄結構

```
craftpost/
├── frontend/                  → Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (marketing)/   → Landing page、定價、法律頁
│   │   │   └── app/           → 主應用（需登入）
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── Dockerfile
│   └── next.config.ts         → output: 'standalone' 必須設定
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py      → Pydantic Settings
│   │   │   ├── database.py    → Supabase client
│   │   │   ├── security.py    → JWT 驗證、token 加解密
│   │   │   └── scheduler.py   → APScheduler 初始化
│   │   ├── api/
│   │   │   ├── deps.py        → get_current_user, check_publish_access
│   │   │   ├── draft.py
│   │   │   ├── publish.py
│   │   │   ├── platforms.py
│   │   │   ├── media.py
│   │   │   ├── social.py
│   │   │   └── billing.py
│   │   └── services/
│   │       ├── ai/
│   │       │   └── refine.py  → PromptBuilder + Claude API
│   │       └── publish/
│   │           ├── base.py    → BasePlatformAdapter
│   │           ├── registry.py
│   │           └── platforms/
│   │               ├── instagram.py
│   │               ├── threads.py
│   │               ├── x.py
│   │               └── linkedin.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml         → Railway 部署 + 本地開發
├── docker-compose.override.yml → 本地 hot reload（不 commit）
├── CLAUDE.md                  → 本文件
├── AGENTS.md                  → 同 CLAUDE.md（symlink）
└── SDD.md
```

---

## 頁面路由

```
/                    Landing page（公開，含試用框）
/pricing             定價
/terms               服務條款
/privacy             隱私政策
/refund-policy       退款政策

/app/drafts          草稿清單（需登入）
/app/drafts/new      編輯頁
/app/drafts/[id]     編輯頁（已有草稿）
/app/publish/[id]    發布控制頁
/app/settings/identities  身份管理
```

---

## 編輯頁版面

```
上層：圖稿區（固定，無圖時顯示上傳提示）

中層：左欄 草稿輸入 / 修稿結果（同一個 TipTap 編輯器）
      右欄 AI Prompt 輸入（選填，最多 300 字）

下層：左欄 平台多選 checkbox
      右欄 [重新修稿]  [前往發布]
```

修稿後：左欄內容直接被 AI 結果取代，不顯示 diff，使用者可繼續編輯。

---

## AI Prompt 設計

兩層：

| 層 | 名稱 | 說明 |
|---|---|---|
| L1 | System prompt | 鎖定在後端，使用者看不到 |
| L4 | User subprompt | 使用者自由填寫，選填，300 字上限 |

L2（Style preset）和 L3（Platform adapter）已移除。

**Sanitize 規則：** user subprompt 截斷至 300 字，過濾 injection 關鍵字，包在 `<user_instruction>` XML tag 內送給 後端AI。

---

## 計費方案

| 方案 | 月費 | 修稿 | 身份數 | 每身份帳號數 | 發布 |
|---|---|---|---|---|---|
| Free | $0 | 無限 | — | — | **不可發布** |
| Basic | $8 | 無限 | 1 | 2 組 | 可發布 |
| Pro | $12 | 無限 | 5 | 10 組 | 可發布 |

**轉換邏輯：** 免費無限修稿，點「前往發布」時才檢查方案，未付費則彈出升級 Modal。

---

## 身份（Identity）設計

```
User
  └── Identity（品牌身份）
        ├── name, description, avatar_color
        └── SocialAccount[]（各平台 OAuth token，加密儲存）
```

Basic：最多 1 個身份，每身份 2 個社群帳號
Pro：最多 5 個身份，每身份 10 個社群帳號

---

## Media 規格

- **多圖：** 最多 10 張（以 IG API 上限為準），JPG/PNG/WebP
- **影片：** 最多 1 支，MP4/MOV，100MB 上限
- **圖片與影片不可同時附加**
- **修圖操作：** 放大、縮小、平移、裁切、比例切換（符合各平台預覽）
- 各平台上限從後端 `PLATFORM_LIMITS` 動態讀取，不寫死前端

---

## 平台模組化

新增平台只需兩步：
1. 在 `platforms/` 新增實作 `BasePlatformAdapter` 的檔案
2. 在 `PlatformRegistry._adapters` 加一行

**Phase 1：** Instagram、Threads
**Phase 2：** X、LinkedIn

---

## 部署

```
Railway Project: craftpost
├── frontend   Next.js，自訂 domain: craftpost.app
└── web        FastAPI（含 APScheduler）
```

`docker-compose.yml` 拖曳到 Railway canvas 自動建立 services。

### 環境變數

```bash
# 後端
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ANTHROPIC_API_KEY=
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_BASIC_PRICE_ID=
PADDLE_PRO_PRICE_ID=
TOKEN_ENCRYPTION_KEY=       # 32 bytes hex
META_APP_ID=
META_APP_SECRET=
FRONTEND_URL=
BACKEND_URL=

# 前端
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENV=     # sandbox | production
```

---

## 開發慣例

### 後端

**所有需要登入的 API 掛 `get_current_user`：**
```python
@router.post("/draft/refine")
async def refine(body: RefineRequest, user=Depends(get_current_user)):
```

**發布 API 額外掛 `check_publish_access`（驗證方案）：**
```python
@router.post("/publish")
async def publish(body: PublishRequest, user=Depends(get_current_user), _=Depends(check_publish_access)):
```

**錯誤統一格式：**
```python
raise HTTPException(status_code=402, detail={
    "code": "PUBLISH_REQUIRES_PLAN",
    "message": "發布功能需要付費方案",
    "upgrade_url": "/pricing"
})
```

**環境變數透過 Pydantic Settings 讀取，不直接用 `os.environ`。**

### 前端

**API 呼叫統一透過 `lib/api.ts`，不在 component 裡直接 fetch。**

**未登入使用者可以使用修稿功能，點「前往發布」才要求登入。**

**`next.config.ts` 必須設定 `output: 'standalone'`（Docker 部署需要）。**

---

## 本地開發

```bash
# 啟動全部服務
docker compose up

# 或分開啟動
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```

---

## 安全紅線（絕對不可違反）

1. `SUPABASE_SERVICE_KEY` 不可出現在前端任何程式碼
2. 社群平台 access_token 必須 AES-256-GCM 加密後才存 DB
3. user_subprompt 必須 sanitize 後才送給 後端AI
4. Paddle Webhook 必須驗證簽名，`profiles.plan` 只能由 Webhook 更新
5. `output: 'standalone'` 不可移除（Docker build 會失敗）