# Design System — Craftpost

> 此文件定義 Craftpost 的完整視覺規範。
> 所有前端元件必須遵守此規範，不得自行決定色彩、字型或間距。
> Codex 實作前請先讀此文件。

---

## 1. 設計原則

**Calm but alive** — 介面安靜，但強調色有張力。
**作者優先** — 內容永遠是主角，UI 退到背景。
**社群感** — 活潑、有溫度，不冷硬。
**一致性** — 同樣的元素在所有頁面長得一樣。

**禁止出現的設計：**
- 紫色、藍色、綠色作為主要強調色
- AI 菱形圖示（如 ✦ 以外的 AI 符號）
- 社群媒體平台的 icon 色彩複製（不用 IG 漸層、Twitter 藍等）
- Heavy gradients 作為背景
- 過多的 drop shadow

---

## 2. 色彩系統

### 2.1 CSS Variables（全域定義）

```css
:root {
  /* ── 背景 ── */
  --bg-base:      #0a0a0a;   /* 全頁主背景 */
  --bg-surface:   #141414;   /* 卡片、Panel */
  --bg-elevated:  #1e1e1e;   /* Input、hover 狀態 */
  --bg-border:    #272727;   /* 分隔線、邊框 */
  --bg-border-2:  #333333;   /* 次要邊框 */

  /* ── 文字 ── */
  --text-primary:   #F0EDE8;
  --text-secondary: #888888;
  --text-tertiary:  #555555;
  --text-inverse:   #0a0a0a;  /* 用於強調色背景上的文字 */

  /* ── 強調色（珊瑚橙紅）── */
  --accent:         #FF5C3A;
  --accent-hover:   #E84D2D;
  --accent-active:  #D04020;
  --accent-muted:   rgba(255, 92, 58, 0.12);
  --accent-border:  rgba(255, 92, 58, 0.35);

  /* ── 狀態色 ── */
  --success:        #10B981;
  --success-muted:  rgba(16, 185, 129, 0.12);
  --warning:        #F59E0B;
  --warning-muted:  rgba(245, 158, 11, 0.12);
  --error:          #EF4444;
  --error-muted:    rgba(239, 68, 68, 0.10);

  /* ── 草稿狀態色 ── */
  --status-draft:      #555555;
  --status-refined:    #F59E0B;
  --status-confirmed:  #FF5C3A;
  --status-scheduled:  #C084FC;
  --status-publishing: #60A5FA;
  --status-published:  #10B981;
  --status-failed:     #EF4444;

  /* ── 間距 ── */
  --radius-sm:  6px;
  --radius-md:  10px;
  --radius-lg:  14px;
  --radius-xl:  20px;

  /* ── 字型 ── */
  --font-sans: 'Geist', 'Inter', system-ui, sans-serif;
  --font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
}
```

### 2.2 字型載入

```html
<!-- _document.tsx 或 layout.tsx 的 <head> -->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet"/>
```

### 2.3 色彩使用規則

```
強調色用途（var(--accent)）：
  ✅ 主要 CTA 按鈕背景
  ✅ 選中狀態的 checkbox、radio border
  ✅ Active tab indicator
  ✅ Link hover 顏色
  ✅ Badge（重要狀態）
  ✅ Focus ring

  ❌ 不用於背景大面積填色
  ❌ 不用於文字（除非在深色背景上的連結）
  ❌ 不用於 icon（用 text-secondary 或 text-primary）
```

---

## 3. 字型規範

### 3.1 字級比例

```css
/* Display — Hero headline */
.text-display {
  font-family: var(--font-sans);
  font-size: clamp(36px, 5.5vw, 64px);
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1.05;
}

/* H1 — 頁面標題 */
.text-h1 {
  font-size: 28px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

/* H2 — 區塊標題 */
.text-h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.2;
}

/* H3 — 元件標題 */
.text-h3 {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

/* Body — 主要內文 */
.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--text-secondary);
}

/* Small — 輔助文字 */
.text-sm {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-tertiary);
}

/* Mono — 程式碼、計數 */
.text-mono {
  font-family: var(--font-mono);
  font-size: 13px;
}

/* Label — 表單 label、上方小標 */
.text-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
```

---

## 4. 間距規範

```
4px   極小間距（icon 與文字）
8px   元件內部 gap（icon + label）
12px  小型元件 padding
16px  標準元件 padding
20px  卡片內部 padding
24px  區塊間距
32px  大區塊間距
48px  頁面 section 間距
80px  Hero 上下 padding
```

---

## 5. 元件規格

### 5.1 Button

```css
/* Base */
.btn {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  border-radius: var(--radius-md);
  padding: 10px 18px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Primary — 主要 CTA */
.btn-primary {
  background: var(--accent);
  color: var(--text-inverse);
  border: none;
}
.btn-primary:hover   { background: var(--accent-hover); }
.btn-primary:active  { background: var(--accent-active); transform: scale(0.98); }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

/* Secondary — 次要動作 */
.btn-secondary {
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--bg-border-2);
}
.btn-secondary:hover { border-color: var(--text-tertiary); }

/* Ghost — 最輕量 */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
}
.btn-ghost:hover { background: var(--bg-elevated); color: var(--text-primary); }

/* Danger */
.btn-danger {
  background: var(--error-muted);
  color: var(--error);
  border: 1px solid rgba(239, 68, 68, 0.2);
}
.btn-danger:hover { background: var(--error); color: white; }

/* Size variants */
.btn-sm { font-size: 12px; padding: 7px 12px; border-radius: var(--radius-sm); }
.btn-lg { font-size: 15px; padding: 13px 24px; border-radius: var(--radius-lg); }
```

### 5.2 Input / Textarea

```css
.input {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  padding: 10px 14px;
  width: 100%;
  transition: border-color 0.15s;
  outline: none;
}
.input::placeholder { color: var(--text-tertiary); }
.input:hover        { border-color: var(--bg-border-2); }
.input:focus        { border-color: var(--accent-border); }

/* Textarea */
.textarea {
  /* 繼承 .input 所有樣式 */
  resize: none;
  min-height: 120px;
  line-height: 1.6;
}

/* 字數計數（右下角）*/
.input-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
  margin-top: 4px;
}
.input-count.over { color: var(--error); }
```

### 5.3 Card / Panel

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: 20px;
}

/* 可點擊卡片 */
.card-interactive {
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.card-interactive:hover {
  border-color: var(--bg-border-2);
  background: var(--bg-elevated);
}

/* 選中狀態 */
.card-selected {
  border-color: var(--accent-border);
  background: var(--accent-muted);
}
```

### 5.4 Checkbox（平台多選用）

```css
.checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;
}
.checkbox-item:hover {
  border-color: var(--accent-border);
  color: var(--text-primary);
}
.checkbox-item.checked {
  border-color: var(--accent);
  background: var(--accent-muted);
  color: var(--text-primary);
}
.checkbox-item.checked .checkbox-icon {
  background: var(--accent);
  border-color: var(--accent);
}

/* Custom checkbox box */
.checkbox-box {
  width: 16px;
  height: 16px;
  border: 1.5px solid var(--bg-border-2);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}
.checkbox-box.checked {
  background: var(--accent);
  border-color: var(--accent);
}
/* checkmark SVG inline */
```

### 5.5 Badge（狀態標籤）

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}

/* 使用方式：加上狀態 class */
.badge-draft      { background: rgba(85,85,85,0.15);  color: #888; }
.badge-refined    { background: rgba(245,158,11,0.12); color: #F59E0B; }
.badge-confirmed  { background: rgba(255,92,58,0.12);  color: #FF5C3A; }
.badge-scheduled  { background: rgba(192,132,252,0.12);color: #C084FC; }
.badge-publishing { background: rgba(96,165,250,0.12); color: #60A5FA; }
.badge-published  { background: rgba(16,185,129,0.12); color: #10B981; }
.badge-failed     { background: rgba(239,68,68,0.10);  color: #EF4444; }

/* 小圓點 */
.badge::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
```

### 5.6 Modal / Overlay

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 20px;
}

.modal-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-xl);
  padding: 36px 40px;
  width: 100%;
  max-width: 420px;
}
```

### 5.7 Sidebar

```css
.sidebar {
  width: 240px;
  height: 100vh;
  background: var(--bg-surface);
  border-right: 1px solid var(--bg-border);
  display: flex;
  flex-direction: column;
  padding: 20px 0;
  flex-shrink: 0;
}

.sidebar-logo {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 500;
  padding: 0 20px 24px;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}
/* "Craft" 白色，"post" 強調色 */
.sidebar-logo span { color: var(--accent); }

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 20px;
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 0;
}
.sidebar-nav-item:hover    { background: var(--bg-elevated); color: var(--text-primary); }
.sidebar-nav-item.active   { color: var(--text-primary); background: var(--accent-muted); }
.sidebar-nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
}
```

---

## 6. 動畫規範（Framer Motion）

```typescript
/* 頁面元素入場 */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: "easeOut" },
}

/* 卡片入場（清單用，stagger） */
export const cardVariants = {
  hidden:  { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}
export const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.06 } },
}

/* Modal 彈出 */
export const modalVariants = {
  hidden:  { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.18, ease: "easeOut" } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
}

/* 區塊展開（排程、圖稿區） */
export const expandVariants = {
  hidden:  { height: 0, opacity: 0, overflow: "hidden" },
  visible: { height: "auto", opacity: 1, transition: { duration: 0.25, ease: "easeOut" } },
  exit:    { height: 0, opacity: 0, transition: { duration: 0.18 } },
}

/* 按鈕 loading spinner */
/* 使用 Tailwind: animate-spin，20px SVG spinner */

/* Hover scale（卡片） */
const cardHover = {
  whileHover: { scale: 1.005 },
  transition: { duration: 0.12 },
}
```

**動畫原則：**
- duration 不超過 0.35s
- ease 用 `easeOut`（入場）或 `easeInOut`（切換）
- 不用 bounce 或彈性動畫（不符合專業感）
- Loading 狀態用 skeleton（pulse）不用 spinner，除非是按鈕內

---

## 7. 圖稿區修圖 UI 規範

比例切換按鈕：

```
[1:1]  [4:5]  [9:16]  [16:9]
```

```css
.ratio-btn {
  padding: 5px 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: all 0.12s;
}
.ratio-btn:hover  { border-color: var(--accent-border); color: var(--text-secondary); }
.ratio-btn.active { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }
```

圖片預覽容器：
```css
.image-preview {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
  position: relative;
}
/* 比例由 aspect-ratio CSS 控制 */
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}
```

---

## 8. 響應式規範

```css
/* Breakpoints */
--bp-mobile:  640px
--bp-tablet:  768px
--bp-desktop: 1024px
--bp-wide:    1280px

/* Sidebar 收合 */
@media (max-width: 768px) {
  .sidebar { display: none; }
  /* 改用 hamburger menu */
}

/* 編輯頁中下層：手機改為單欄 */
@media (max-width: 768px) {
  .editor-middle { flex-direction: column; }
  .editor-bottom { flex-direction: column; }
}

/* Landing page 試用框：手機上下排 */
@media (max-width: 640px) {
  .demo-frame { padding: 16px; }
  .platform-checkboxes { flex-wrap: wrap; gap: 8px; }
}
```

---

## 9. Logo 使用規範

**主要 logo（深色背景）：**
- 120×120px 正方形，`border-radius: 26px`
- 背景：`#FF5C3A`（珊瑚橙紅）
- 圖示：白色紙飛機 + 文件造型

**Logo 文字版（Sidebar、Nav）：**
```html
<span class="logo-text">
  Craft<span style="color: var(--accent)">post</span>
</span>
```
```css
.logo-text {
  font-family: var(--font-mono);
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}
```

**禁止：**
- 在亮色背景上直接使用 logo（會失去對比度）
- 改變 logo 比例或顏色
- 加 drop shadow 給 logo

---

## 10. 平台 Icon 規範

平台 icon 一律使用**單色 SVG**，顏色用 `currentColor`，不複製平台原始色彩（不用 IG 漸層、Twitter 藍等）。

```css
.platform-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}
.platform-icon.connected { color: var(--text-primary); }
```

---

## 11. 文件 Checklist（Codex 實作前確認）

在產生任何 UI 元件前，確認：

- [ ] 背景色是否使用 CSS variables（不 hardcode）
- [ ] 強調色只用 `var(--accent)` 及其衍生
- [ ] 邊框使用 `var(--bg-border)` 或 `var(--bg-border-2)`
- [ ] 文字色使用 `var(--text-primary/secondary/tertiary)`
- [ ] button、input、card 的 border-radius 使用 `var(--radius-*)`
- [ ] 動畫 duration ≤ 0.35s
- [ ] 深色模式下所有文字可讀（背景 #0a0a0a，文字需有足夠對比）
- [ ] 沒有任何 drop shadow（用 border 代替）
- [ ] 平台 icon 單色，不複製原始品牌色