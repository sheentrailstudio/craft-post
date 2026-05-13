# Slice 1 — Landing Page

> 訪客免登入試用 AI 修稿，點發布才要求登入。
> **純前端，不需要後端（除了 POST /api/draft/refine 開放呼叫）。**
> **禁止：JWT、DB、Supabase Auth、Paddle 任何相關程式碼。**

---

## 完成標準

訪客進入 `/`，可以：
1. 上傳圖片 → AI 生成 caption
2. 輸入草稿 → AI 修稿，結果直接取代輸入
3. 點「Publish」→ 彈出 Google 登入 Modal
4. 登入後帶著修稿結果進入 `/app/drafts/new`

---

## 技術初始化

```bash
cd frontend
npx create-next-app@latest . \
  --typescript --tailwind --app --src-dir --import-alias "@/*" --no-git

npm install framer-motion @tiptap/react @tiptap/pm @tiptap/starter-kit
```

`next.config.ts` 必須加入：
```typescript
const nextConfig = { output: 'standalone' }
export default nextConfig
```

---

## 設計系統

```css
:root {
  --bg:        #0f0f0f;
  --surface:   #1a1a1a;
  --elevated:  #222222;
  --border:    #2a2a2a;
  --text:      #f0ede8;
  --secondary: #888888;
  --tertiary:  #555555;
  --accent:    #6366f1;
  --accent-h:  #4f46e5;
  --accent-m:  rgba(99,102,241,0.12);
  --green:     #10b981;
  --red:       #ef4444;
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;
}
```

字型載入（`layout.tsx`）：
```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

---

## 頁面結構

```
Nav
Hero（headline + sub）
試用框（上下排列）
  上：圖片區塊
  下：文字區塊
How it works（三步驟）
Pricing（三方案）
Footer
```

---

## Nav

```
Craftpost                    [Pricing]  [Sign in →]
```

- sticky top，`backdrop-filter: blur(12px)`，`bg: rgba(15,15,15,0.8)`
- Logo：font-mono，`Craft` 白色 + `post` accent 色
- Sign in → 導向 `/login`（Slice 5 建立，目前可先是空頁）

---

## Hero

```
Your AI writing
co-pilot for social.

Draft smarter. Refine with AI. Publish everywhere.
```

- Headline：`clamp(40px, 6vw, 72px)`，font-weight 600，letter-spacing -0.04em
- Sub：16px，color var(--secondary)
- 置中，padding-top: 80px

---

## 試用框

### 上：圖片區塊

```
┌──────────────────────────────────────────────────┐
│  🖼 Image                                         │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Drop image here or click to upload         │ │
│  │  JPG / PNG / WebP · Max 10MB                │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  （上傳後）                                      │
│  ┌──────────────┐  Generated caption:           │
│  │   圖片預覽   │  ┌──────────────────────────┐ │
│  │              │  │  AI 生成的文字...         │ │
│  └──────────────┘  └──────────────────────────┘ │
│                    [Use this caption ↓]          │
└──────────────────────────────────────────────────┘
```

**規格：**
- 上傳：點擊或拖曳，accept: `image/jpeg,image/png,image/webp`，max 10MB
- 上傳後：左側縮圖預覽，右側呼叫 Claude API（vision）生成 caption
- 「Use this caption ↓」：把 caption 填入下方文字區塊的輸入框
- 錯誤：格式不符或超過 10MB 顯示 inline 提示

**Caption 生成 API 呼叫：**
```typescript
// 圖片轉 base64，送給 Claude API（vision）
// prompt: "Generate a compelling social media caption for this image. Be concise and engaging."
// 回傳純文字 caption
```

```gherkin
Scenario: 上傳圖片生成 caption
  When 訪客上傳一張圖片
  Then 顯示圖片預覽
  And 呼叫 Claude vision API
  And 生成的 caption 顯示在右側

Scenario: 使用 caption
  When 訪客點擊「Use this caption ↓」
  Then 下方文字區塊的輸入框填入 caption
  And 頁面滾動到文字區塊
```

---

### 下：文字區塊

```
┌──────────────────────────────────────────────────┐
│  ✍ Write                                         │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Paste your draft here...                   │ │
│  │                                             │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  AI prompt（optional）                           │
│  ┌─────────────────────────────────────────────┐ │
│  │  e.g. Add a CTA, keep it under 150 words... │ │
│  │                                   xx / 300  │ │
│  └─────────────────────────────────────────────┘ │
│                                  [✦ Refine →]   │
│                                                  │
│  （修稿後顯示）                                  │
│  ─────────────────────────────────────────────  │
│  ✦ Refined                  [Copy] [Publish →]  │
│  ┌─────────────────────────────────────────────┐ │
│  │  修稿結果（可繼續編輯）                     │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**規格：**
- 草稿輸入：TipTap，placeholder「Paste your draft here...」
- AI prompt：textarea，300 字上限，計數右下角
- Refine 按鈕：草稿空白時 disabled
- 修稿後：結果顯示在下方獨立區塊（取代按鈕區域），可繼續編輯
- [Copy]：複製結果到剪貼簿，顯示「Copied ✓」短暫提示
- [Publish →]：觸發 Google 登入 Modal

```gherkin
Scenario: 正常修稿
  Given 訪客輸入草稿
  When 點擊「✦ Refine」
  Then 呼叫 POST /api/draft/refine（無 JWT）
  And 按鈕顯示 loading
  And 成功後結果區塊展開（Framer Motion）
  And 顯示修稿結果，可繼續編輯

Scenario: 點擊 Publish
  When 訪客點擊「Publish →」
  Then 彈出 Google 登入 Modal

Scenario: 已登入訪客
  Given 使用者已登入
  When 進入 /
  Then Nav 顯示「Go to app →」
  And Publish 按鈕直接導向 /app/drafts/new
```

---

## Google 登入 Modal

```
┌──────────────────────────────────────┐
│                              [✕]     │
│  Craftpost                           │
│  Sign in to publish your post        │
│  Your draft will be saved.           │
│                                      │
│  [G  Continue with Google]           │
│                                      │
│  Free to start · Cancel anytime      │
│  Terms · Privacy                     │
└──────────────────────────────────────┘
```

- Overlay：`rgba(0,0,0,0.7)`
- Card：bg-surface，border-radius 16px，max-width 400px
- Framer Motion：scale 0.96 → 1，opacity 0 → 1，duration 0.2s
- 點擊 Google → 導向 `/login`（Slice 5 建立）

**登入後帶入修稿結果：**
```typescript
// 登入前存
localStorage.setItem("craftpost_landing", JSON.stringify({
  draft: string,
  refined: string,
  user_subprompt: string,
}))

// /app/drafts/new 讀取後清除
```

---

## How it Works

三欄等寬卡片：

```
01 Draft          02 Refine         03 Publish
Write or paste    AI refines your   One click to
your content      copy instantly    all platforms
```

- bg-surface，border: 1px solid var(--border)，border-radius: 12px，padding: 28px
- 步驟號：font-mono，color: accent，font-size: 12px

---

## Pricing 區塊

三個方案卡片，設計與 `/pricing` 頁面一致：

| Free | Basic | Pro |
|---|---|---|
| $0 | $8/mo | $12/mo |
| Unlimited AI refine | Unlimited | Unlimited |
| No publishing | 1 identity, 2 accounts | 5 identities, 10 accounts |
| — | Publish to all platforms | Publish to all platforms |
| Get started | Start with Basic | Start with Pro |

- Basic 為 featured（`Most Popular` badge）
- CTA 點擊 → Google 登入 Modal（未登入）或 Paddle checkout（已登入）

---

## Footer

```
Craftpost
AI writing co-pilot for social media.

Terms of Service · Privacy Policy · Refund Policy

© 2026 [Your Company Name]
```

---

## 目錄結構

```
src/
├── app/
│   ├── (marketing)/
│   │   └── page.tsx              ← Landing page
│   └── layout.tsx
├── components/
│   └── landing/
│       ├── LandingNav.tsx
│       ├── ImageUploadBlock.tsx   ← 圖片上傳 + caption 生成
│       ├── TextRefineBlock.tsx    ← 草稿輸入 + 修稿結果
│       ├── SignInModal.tsx
│       ├── HowItWorks.tsx
│       └── LandingPricing.tsx
└── lib/
    └── api.ts                     ← refine() 和 generateCaption()
```

---

## ❌ 禁止產生

- JWT / Authorization header
- Supabase client
- middleware.ts 路由保護
- Paddle 任何相關
- `/app/*` 頁面修改

---

## 完成標準

- [ ] `/` 未登入可正常存取
- [ ] 上傳圖片後顯示預覽，AI 生成 caption
- [ ] 「Use this caption」帶入文字框並滾動
- [ ] 輸入草稿點 Refine 呼叫真實 API，結果展開顯示
- [ ] [Publish →] 觸發 Google 登入 Modal
- [ ] localStorage 正確存入修稿結果
- [ ] How it Works 三步驟正確顯示
- [ ] Pricing 三方案正確顯示
- [ ] RWD：手機版可正常操作
- [ ] SEO metadata 設定正確