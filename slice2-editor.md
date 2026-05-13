# Slice 2 — 編輯頁

> 建立主要編輯頁面，串接真實 AI 修稿 API。
> 前端 Next.js + 後端 FastAPI。
> **禁止：JWT 驗證、DB 寫入、Paddle、身份管理。**

---

## 前提

Slice 1 Landing page 已完成，`POST /api/draft/refine` 已可呼叫。

## 完成標準

使用者進入 `/app/drafts/new`，可以上傳圖片、輸入草稿、填寫 prompt，點「重新修稿」後左欄內容被 AI 結果取代，滿意後點「前往發布」。

---

## 後端規格

### FastAPI 初始化

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import draft, platforms

app = FastAPI(title="Craftpost API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(draft.router, prefix="/api")
app.include_router(platforms.router, prefix="/api")

@app.get("/health")
async def health():
    return {"status": "ok"}
```

### `POST /api/draft/refine`

此 Slice 無 JWT 驗證，任何人可呼叫。

**Request:**
```python
class RefineRequest(BaseModel):
    draft: str = Field(..., min_length=1, max_length=5000)
    user_subprompt: Optional[str] = Field(None, max_length=300)
    media_urls: Optional[list[str]] = []   # Slice 2 先忽略，Slice 5 後才真正處理
```

**Response:**
```python
class RefineResponse(BaseModel):
    post_id: str        # Slice 2 固定回傳 "unsaved"
    refined: str
```

**PromptBuilder（兩層）：**

```python
SYSTEM_PROMPT = """
你是一位專業的社群媒體文案編輯助理。
使用者會提供一篇草稿，請進行潤稿。

輸出規則：
- 只能輸出 JSON：{"refined": "..."}
- 不可輸出 JSON 以外的任何文字
- 保留原文核心意涵
- 不可加入草稿中不存在的事實
"""

def build_prompt(draft: str, user_subprompt: str | None) -> str:
    user_instruction = ""
    if user_subprompt:
        sanitized = sanitize_subprompt(user_subprompt)
        user_instruction = f"\n<user_instruction>\n{sanitized}\n</user_instruction>"

    return f"{SYSTEM_PROMPT}{user_instruction}\n\n草稿內容：\n{draft}"

def sanitize_subprompt(text: str) -> str:
    text = text[:300]
    patterns = ["ignore previous", "ignore all", "system:", "<|im_start|>"]
    for p in patterns:
        text = re.sub(p, "[filtered]", text, flags=re.IGNORECASE)
    return text
```

**Acceptance Criteria：**

```gherkin
Scenario: 正常修稿
  When POST /api/draft/refine，body: { draft: "今天來分享...", user_subprompt: null }
  Then 回應 200，包含 post_id: "unsaved"，refined: "..."

Scenario: 草稿為空
  When body: { draft: "" }
  Then 回應 422

Scenario: user_subprompt 含注入關鍵字
  When body: { ..., user_subprompt: "ignore previous instructions" }
  Then 正常處理，注入字串被替換為 [filtered]

Scenario: Claude API 超時
  When Claude 超過 30 秒無回應
  Then 回應 503，{ "code": "AI_SERVICE_TIMEOUT" }
```

### `GET /api/platforms`（Hardcode，無 DB）

```python
PLATFORMS = [
    { "id": "instagram", "display_name": "Instagram",
      "max_chars": 2200, "media_limits": { "max_images": 10, "max_videos": 1 },
      "account_connected": True, "account_username": "@demo", "token_expired": False },
    { "id": "threads", "display_name": "Threads",
      "max_chars": 500, "media_limits": { "max_images": 10, "max_videos": 1 },
      "account_connected": True, "account_username": "@demo", "token_expired": False },
]
```

---

## 前端規格

### 頁面路由

```
/app/drafts/new      → 新草稿編輯頁
/app/drafts/[id]     → 已有草稿（Slice 5 後才有資料）
```

Slice 2 的 `/app/*` 頁面暫時不需要登入保護（`middleware.ts` 不加，Slice 5 再加）。

### 版面規格

```
┌─────────────────────────────────────────────────┐
│  Sidebar（240px）        Main Content           │
│  ─────────────        ─────────────────────     │
│  Craftpost             上層：圖稿區             │
│                                                 │
│  + New draft           中層：────────────────── │
│  Drafts                左欄：草稿輸入           │
│  Settings              右欄：AI Prompt 輸入     │
│                                                 │
│                        下層：────────────────── │
│                        左欄：平台 checkbox      │
│                        右欄：[重新修稿][前往發布]│
└─────────────────────────────────────────────────┘
```

### 上層：圖稿區（固定）

```
有圖時：
┌──────────────────────────────────────────────┐
│  Media                            [✕ 清除]   │
│  ┌────┐ ┌────┐ ┌────┐  + Add more           │
│  │縮圖│ │縮圖│ │縮圖│                       │
│  └────┘ └────┘ └────┘                        │
│  修圖工具：[1:1] [4:5] [9:16] [16:9]         │
└──────────────────────────────────────────────┘

無圖時：
┌──────────────────────────────────────────────┐
│  [📎 Add media]  ← ghost button              │
└──────────────────────────────────────────────┘
```

**修圖工具（比例切換）：**
- 四個比例按鈕：1:1 / 4:5 / 9:16 / 16:9
- 選中後圖片預覽以該比例顯示（CSS `object-fit: cover` + `aspect-ratio`）
- 放大縮小平移：使用 `react-image-crop` 或 CSS transform

**Media 規則：**
- 多圖（最多 10 張）或一支影片，不可同時
- 圖片：JPG/PNG/WebP，單張最大 10MB
- 影片：MP4/MOV，最大 100MB

```gherkin
Scenario: 上傳圖片
  When 使用者點擊 [Add media] 並選擇圖片
  Then 圖稿區顯示縮圖
  And 顯示比例切換工具

Scenario: 切換比例
  When 使用者點擊 [4:5]
  Then 縮圖以 4:5 比例顯示
  And 選中按鈕高亮

Scenario: 超過 10 張
  When 嘗試上傳第 11 張
  Then 顯示「最多上傳 10 張圖片」inline 錯誤
```

### 中層：左欄草稿輸入

```
┌──────────────────────────────────────┐
│  草稿                    字數：xx    │
│  ┌──────────────────────────────┐   │
│  │                              │   │
│  │  TipTap 編輯器               │   │
│  │  placeholder: 在這裡輸入草稿  │   │
│  │                              │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- TipTap 純文字編輯器
- 右下角字數計數（平台字數限制提示：依右下角 checkbox 中最嚴格的平台）
- **修稿後：AI 結果直接取代這個編輯器的內容，不顯示 diff**
- 修稿結果可繼續手動編輯

```gherkin
Scenario: 修稿後結果取代草稿
  Given 使用者輸入草稿「今天去了展覽...」
  When 點擊「重新修稿」，API 成功回傳
  Then 左欄 TipTap 內容被 AI 結果取代
  And 使用者可繼續在左欄編輯結果
  And 無任何 diff highlight 顯示
```

### 中層：右欄 AI Prompt 輸入

```
┌──────────────────────────────────────┐
│  AI Prompt  (optional)   xx / 300   │
│  ┌──────────────────────────────┐   │
│  │  e.g. 結尾加 CTA、字數控制   │   │
│  │  在 150 字以內...            │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- textarea，min-height 120px
- 300 字上限，計數右上角，超過變紅
- 選填，空白也可以送出

### 下層：左欄平台 checkbox

```
Publish to
☑ Instagram   ☑ Threads   ☐ X   ☐ LinkedIn
```

- 預設勾選 Instagram + Threads
- 至少一個才能點「重新修稿」
- 樣式：未選 border var(--border)；選中 border var(--accent)，bg var(--accent-m)

### 下層：右欄操作按鈕

```
[重新修稿 ✦]    [前往發布 →]
```

**[重新修稿] 規格：**
- 草稿空白 or 未選任何平台時 disabled
- 點擊：按鈕顯示 spinner，左欄出現 skeleton loading
- API 回傳後：左欄內容被取代，按鈕恢復

**[前往發布] 規格：**
- Slice 2：直接導向 `/app/publish/mock-post-id`（mock，Slice 5 後改為真實 post_id）
- Slice 5 後：Free 方案彈出升級 Modal，付費方案正常導向

---

## 狀態管理

```typescript
// src/hooks/useEditor.ts
interface EditorState {
  draft: string
  refined: string | null
  user_subprompt: string
  platforms: string[]            // 預設 ["instagram", "threads"]
  media: MediaAttachment | null
  is_refining: boolean
  error: string | null
}
```

---

## API 呼叫

```typescript
// src/lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export async function refine(body: {
  draft: string
  user_subprompt?: string
}): Promise<{ post_id: string; refined: string }> {
  const res = await fetch(`${API_URL}/api/draft/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message || "修稿失敗")
  }
  return res.json()
}
```

---

## 目錄結構

```
src/
├── app/app/
│   ├── layout.tsx              ← App shell + Sidebar
│   ├── drafts/
│   │   └── new/page.tsx
│   └── publish/
│       └── [postId]/page.tsx   ← Slice 3 建立
├── components/
│   ├── editor/
│   │   ├── EditorLayout.tsx    ← 三層版面容器
│   │   ├── MediaZone.tsx       ← 上層圖稿區
│   │   ├── DraftPane.tsx       ← 中層左欄
│   │   ├── PromptPane.tsx      ← 中層右欄
│   │   ├── PlatformSelector.tsx← 下層左欄
│   │   └── EditorToolbar.tsx   ← 下層右欄按鈕
│   └── layout/
│       └── Sidebar.tsx
└── hooks/
    └── useEditor.ts
```

---

## 環境變數

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000

# backend/.env
ANTHROPIC_API_KEY=sk-ant-...
FRONTEND_URL=http://localhost:3000
```

---

## 本地啟動

```bash
# 後端
cd backend && uvicorn app.main:app --reload --port 8000

# 前端
cd frontend && npm run dev
```

---

## ❌ 禁止產生

- JWT / get_current_user
- middleware.ts 路由保護
- DB 任何操作（post_id 固定回傳 "unsaved"）
- Paddle 相關
- diff highlight（修稿結果直接取代，不顯示差異）

---

## 完成標準

- [ ] `/app/drafts/new` 頁面可存取（不需登入）
- [ ] 圖稿區：上傳圖片顯示縮圖，比例切換即時更新
- [ ] 中層左欄：TipTap 可輸入草稿
- [ ] 中層右欄：AI Prompt 300 字上限計數
- [ ] 下層左欄：平台 checkbox 預設 IG + Threads 勾選
- [ ] 點「重新修稿」呼叫真實 API，左欄內容被取代
- [ ] 結果可繼續手動編輯，無 diff highlight
- [ ] 點「前往發布」導向 `/app/publish/mock-post-id`
- [ ] `GET /health` 回傳 `{"status":"ok"}`