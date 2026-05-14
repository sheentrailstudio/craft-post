# Slice 5 — 社群帳號連結 + 發文串接收斂

> 將現有身份管理、社群 OAuth、加密 token、發布 adapter 收斂成可上線驗收的端到端流程。
> 使用者以 Craftpost 帳號登入後，為某個 Identity 連結社群平台帳號，並在發布流程使用該 Identity 的社群帳號發文。
> 本 slice 先完成 Instagram / Threads，但平台層必須維持模組化，讓 Facebook、X、LinkedIn 等平台可用 adapter 方式新增。
> **不實作社群平台帳號密碼登入或密碼保存。社群平台連結必須走 OAuth / 官方 token 授權。**

---

## 架構依據

已讀取：

1. `frontend/AGENTS.md`：Next.js 版本有破壞性變更，寫前端程式前需以本專案實際檔案與 `node_modules/next/dist/docs/` 為準。
2. `CLAUDE.md` / `SDD.md`：Monorepo 分為 `frontend/` Next.js App Router 與 `backend/` FastAPI；身份模型為 `User -> Identity -> SocialAccount[]`；發布透過 `services/publish` adapter。
3. `slice4-account.md`：身份與社群帳號管理已定義；本 slice 接續把「連結帳號到發文」補完整。
4. 現有程式：
   - `backend/app/api/social.py`
   - `backend/app/api/publish.py`
   - `backend/schema.sql`
   - `frontend/src/lib/api.ts`
   - `frontend/src/components/settings/IdentitiesSettings.tsx`
   - `frontend/src/components/publish/PublishControl.tsx`

---

## 現況

### 已存在

1. Supabase Auth 使用者驗證。
2. `profiles`、`identities`、`social_accounts` schema。
3. `social_accounts.access_token_encrypted` 加密保存。
4. `/api/social/connect/{platform}` 建立 Meta OAuth URL。
5. `/api/social/callback/{platform}` 換 token 並 upsert social account。
6. `/api/publish` 已要求 `identity_id`，並依 identity + platform 取 token 發文。
7. 前端身份管理頁可新增身份、連結/斷開帳號。
8. 發布頁可選 identity，呼叫 publish API。

### 需要收斂

1. Instagram OAuth 與發布需要釐清實際帳號模型：Instagram 發布通常不是單純 `/me/media`，需要保存可發布的 Instagram user id / business account id，且帳號需符合 Meta 支援條件。
2. Threads 與 Instagram 的 token、user id、permission scope 應分開處理，不假設同一個 token 能跨平台使用。
3. OAuth callback 錯誤、state 過期、重複連結、重新連結需要明確 UX。
4. 發布前缺少帳號、token 過期、平台限制、媒體不合規，需要在後端驗證並回傳平台層級錯誤。
5. 發布結果目前未持久化；若要追蹤歷史與排程，需要新增 publish job / publish result 資料表。

---

## 產品決策

### 帳密連結

使用者文案可以稱為「連結社群帳號」，但技術上不接受 Instagram / Threads 的帳號密碼。

理由：

1. 第三方平台發布應使用 OAuth 授權，不保存使用者社群密碼。
2. 保存社群密碼會擴大資安風險，且不利於平台審核。
3. OAuth token 可撤銷、可加密、可限制 scope，符合目前 `social_accounts` 設計。

### 支援平台策略

本 slice 的 MVP 驗收平台：

1. Instagram
2. Threads

平台架構必須允許後續擴充：

1. X
2. LinkedIn
3. Facebook Page
4. TikTok
5. YouTube Community / Shorts
6. 其他提供官方 OAuth + 發布 API 的平台

本 slice 不實作上述未來平台的真實 adapter，但必須避免把資料模型、API response、前端 UI 寫死成只有 Instagram / Threads。

仍不支援：

1. 密碼登入式平台連結
2. 瀏覽器自動化發文
3. 爬蟲或非官方 API

---

## 完成標準

使用者可以：

1. 登入 Craftpost。
2. 建立至少一個 Identity。
3. 對該 Identity 連結 Instagram 或 Threads。
4. 看到平台帳號 username、連線狀態、token 到期狀態。
5. 在發布頁選擇 Identity。
6. 只對已連結的平台送出發文。
7. 發布成功時看到平台貼文 URL。
8. 任一平台失敗時，不影響其他平台發布結果。
9. token 過期或帳號未連結時，UI 提供重新連結入口。

---

## 後端規格

### 資料模型調整

在 `social_accounts` 補足 OAuth 與發布需要的欄位：

```sql
alter table social_accounts
  add column if not exists provider_user_id text,
  add column if not exists provider_account_id text,
  add column if not exists token_type text,
  add column if not exists last_connected_at timestamptz,
  add column if not exists last_error_code text,
  add column if not exists last_error_message text;
```

欄位語意：

1. `platform_account_id`：Craftpost 對外顯示與唯一識別用的平台帳號 id。
2. `provider_user_id`：OAuth token 主體 user id。
3. `provider_account_id`：實際發布 endpoint 使用的帳號 id，例如 Instagram publish target id。
4. `token_expires_at`：token 過期時間；未知時可為 null，但 UI 需顯示「未提供到期資訊」。
5. `status`：`connected | expired | revoked`。

### OAuth state

`state` payload 必須包含：

```json
{
  "user_id": "uuid",
  "identity_id": "uuid",
  "platform": "instagram",
  "nonce": "random",
  "exp": 1770000000
}
```

規則：

1. 使用後端簽章。
2. 15 分鐘過期。
3. callback 驗證 `platform`、`user_id`、`identity_id`。
4. state 無效回傳 `OAUTH_STATE_INVALID`。

### `GET /api/social/connect/{platform}`

輸入：

```http
GET /api/social/connect/instagram?identity_id=<uuid>
Authorization: Bearer <supabase_access_token>
```

規則：

1. `platform` 必須存在於 `PlatformRegistry`。
2. 驗證 identity 屬於使用者。
3. 檢查方案帳號數限制。
4. 建立 OAuth URL。
5. 回傳 `{ "url": "https://..." }`。

### `GET /api/social/callback/{platform}`

規則：

1. 驗證 `state`。
2. 使用 `code` 換取 short-lived token。
3. 若平台支援 long-lived token，交換並保存 long-lived token。
4. 取得平台帳號 profile。
5. 保存：
   - `platform_account_id`
   - `provider_user_id`
   - `provider_account_id`
   - `username`
   - `display_name`
   - `avatar_url`
   - encrypted access token
   - refresh token，如平台提供
   - scopes
   - token expiry
6. redirect 回前端：

```http
/app/identities?connected=instagram
```

錯誤 redirect：

```http
/app/identities?connect_error=TOKEN_EXCHANGE_FAILED
```

### `GET /api/social/accounts`

新增帳號列表 API，方便前端發布頁與設定頁重用。

Query：

```http
GET /api/social/accounts?identity_id=<uuid>
```

Response：

```json
{
  "items": [
    {
      "id": "uuid",
      "platform": "instagram",
      "username": "@craftpost",
      "display_name": "Craftpost",
      "avatar_url": null,
      "status": "connected",
      "token_expires_at": "2026-06-01T00:00:00Z",
      "can_publish": true,
      "reconnect_required": false
    }
  ]
}
```

### `POST /api/publish`

Request：

```json
{
  "identity_id": "uuid",
  "platforms": ["instagram", "threads"],
  "platform_texts": {
    "instagram": "caption",
    "threads": "thread text"
  },
  "media_urls": ["https://..."],
  "scheduled_at": null
}
```

規則：

1. 驗證使用者已登入。
2. 驗證方案可發布。
3. 驗證 identity 屬於使用者。
4. 每個 platform 各自查詢 social account。
5. 缺少帳號時該平台回傳 `ACCOUNT_NOT_CONNECTED`。
6. token 過期時該平台回傳 `TOKEN_EXPIRED`。
7. 解密 token 後交給 platform adapter。
8. 平台 adapter 必須先 `validate()` 再 `publish()`。
9. 平台間隔離錯誤，部分失敗不 rollback 其他成功。

Response：

```json
{
  "mode": "immediate",
  "results": [
    {
      "platform": "instagram",
      "success": true,
      "url": "https://www.instagram.com/p/...",
      "error": null,
      "error_code": null
    },
    {
      "platform": "threads",
      "success": false,
      "url": null,
      "error": "Threads 尚未連結帳號",
      "error_code": "ACCOUNT_NOT_CONNECTED"
    }
  ]
}
```

### Platform Adapter 架構

所有平台必須透過 adapter 註冊，不允許在 API handler 裡寫平台分支。

```python
class BasePlatformAdapter(ABC):
    @property
    @abstractmethod
    def meta(self) -> PlatformMeta: ...

    @abstractmethod
    async def build_oauth_url(self, state: str, redirect_uri: str) -> str: ...

    @abstractmethod
    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> OAuthToken: ...

    @abstractmethod
    async def fetch_account_profile(self, token: OAuthToken) -> SocialAccountProfile: ...

    @abstractmethod
    async def validate(self, text: str, media_urls: list[str], account: SocialAccount) -> list[PlatformError]: ...

    @abstractmethod
    async def publish(self, text: str, media_urls: list[str], account: SocialAccount) -> PublishResult: ...
```

`PlatformMeta`：

```python
@dataclass
class PlatformMeta:
    id: str
    display_name: str
    max_chars: int
    media_limits: dict
    oauth_required: bool = True
    supports_images: bool = True
    supports_video: bool = True
    supports_scheduling: bool = False
```

新增平台流程：

1. 在 `backend/app/services/publish/platforms/{platform}.py` 實作 adapter。
2. 在 `PlatformRegistry` 註冊 adapter。
3. 若平台需要特殊 env，放進 `app/core/config.py`。
4. 前端不新增平台分支，只吃 `GET /api/platforms` 回傳的 metadata。
5. 若平台需要特殊微調欄位，透過 metadata 宣告，不在發布頁硬寫。

### Publish Result

`PublishResult` 補 `error_code`：

```python
@dataclass
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    url: str | None = None
    error: str | None = None
    error_code: str | None = None
```

各 adapter 必須處理：

1. 文字長度限制。
2. 媒體數量限制。
3. 媒體類型限制。
4. 平台 API 錯誤轉成穩定 `error_code`。
5. 發布 target id 不可硬寫 `/me`，必須使用 `social_accounts.provider_account_id` 或等價欄位。
6. OAuth scope、token exchange、profile fetch 必須封裝在 adapter，不放進 `api/social.py`。

---

## 前端規格

### 身份管理頁

路由：

```text
/app/identities
```

需要顯示：

1. Identity list。
2. 每個 Identity 下的平台帳號狀態，平台清單由 `GET /api/platforms` 提供。
3. 未連結：`連結`。
4. 已連結：username + `重新連結` + `斷開`。
5. 過期：`需要重新連結`。
6. OAuth callback 成功 toast。
7. OAuth callback 失敗 inline error。

### 連結帳號 Modal

```text
連結社群帳號

Instagram    已連結 @craftpost     [重新連結] [斷開]
Threads      未連結               [連結]
```

互動：

1. 點 `連結` 呼叫 `connectSocialAccount(platform, identityId)`。
2. API 回傳 URL 後 `window.location.href = url`。
3. 回來後重新載入 identities。

### 發布頁

路由：

```text
/app/publish/[postId]
```

需要補強：

1. Identity selector 預設選 default identity。
2. 切換 identity 後重新讀平台連線狀態。
3. 平台清單由 `GET /api/platforms` 決定，不硬寫 Instagram / Threads。
4. 已選平台但未連結時，在平台文字區顯示 blocking state。
5. 發布按鈕 disabled 條件：
   - 沒有 identity
   - 沒有選平台
   - 所有選取平台都未連結
   - 任一平台文字超過限制
   - 排程時間無效
6. 若部分平台未連結，允許發布已連結平台，但送出前顯示摘要：

```text
Instagram 將發布
Threads 尚未連結，會略過
```

7. 發布結果依平台顯示成功 URL 或錯誤原因。

### API client

`frontend/src/lib/api.ts` 需要保留：

1. 自動帶 Supabase bearer token。
2. 401 導向 `/login?next=...`。
3. 402 回傳升級資訊。
4. `connectSocialAccount` 只負責取得 URL 與跳轉，不在前端處理 OAuth code。

---

## Acceptance Criteria

```gherkin
Scenario: 連結 Instagram 帳號
  Given 使用者已登入且已有 Identity
  When 點擊 Instagram 連結
  Then 前端呼叫 GET /api/social/connect/instagram?identity_id=<id>
  And 瀏覽器導向 Meta OAuth
  When OAuth callback 成功
  Then social_accounts 寫入 encrypted token
  And UI 顯示 Instagram username 與 connected 狀態

Scenario: OAuth state 過期
  Given 使用者取得 OAuth URL 超過 15 分鐘
  When OAuth callback 回到後端
  Then 後端不保存 token
  And 導回 /app/identities?connect_error=OAUTH_STATE_INVALID

Scenario: 重新連結已存在帳號
  Given Identity 已連結 Instagram @craftpost
  When 使用者再次完成 Instagram OAuth
  Then social_accounts 更新 token 與 connected_at
  And 不建立重複帳號

Scenario: 發布到已連結平台
  Given Identity 已連結 Instagram
  And 使用者在發布頁選擇 Instagram
  When 點擊發布
  Then POST /api/publish 帶 identity_id
  And 後端解密 Instagram token
  And Instagram adapter 使用 provider_account_id 發布
  And UI 顯示成功貼文 URL

Scenario: 發布包含未連結平台
  Given Identity 已連結 Instagram 但未連結 Threads
  And 使用者選擇 Instagram 與 Threads
  When 點擊發布
  Then Instagram 可成功發布
  And Threads 結果為 failed
  And error_code 為 ACCOUNT_NOT_CONNECTED

Scenario: token 過期
  Given Identity 的 Threads token_expires_at 已過期
  When 使用者發布到 Threads
  Then Threads 結果為 failed
  And error_code 為 TOKEN_EXPIRED
  And UI 顯示重新連結入口

Scenario: 使用者嘗試輸入社群帳密
  Given 使用者在連結帳號流程
  Then Craftpost 不提供社群帳號密碼欄位
  And 只能透過官方 OAuth 授權

Scenario: 新增平台不需改發布 API
  Given 後端新增 Facebook adapter 並註冊到 PlatformRegistry
  When 前端呼叫 GET /api/platforms
  Then response 包含 Facebook metadata
  And 身份管理頁顯示 Facebook 連結入口
  And 發布頁可依 metadata 顯示 Facebook 文字限制與狀態
```

---

## 實作清單

### Backend

1. 更新 `backend/schema.sql`，補 `provider_user_id`、`provider_account_id`、token metadata、last error 欄位。
2. 在 OAuth state 加入 `nonce` 與 `exp`。
3. 拆分各平台的 profile fetch 與 token exchange，移入對應 adapter。
4. OAuth callback 失敗改為 redirect 前端錯誤 query，不直接顯示 FastAPI JSON。
5. `social_accounts` upsert key 檢查是否符合「同 identity + platform + platform account」。
6. `PublishResult` 加 `error_code`。
7. `POST /api/publish` 回傳穩定平台錯誤碼。
8. adapter 改用平台帳號 publish target id，不假設 `/me`。
9. 將 OAuth URL、code exchange、account profile fetch 移入 adapter 層。
10. `GET /api/platforms` 回傳完整平台 metadata，供前端動態渲染。
11. 加入單元測試：
   - OAuth state valid / expired / tampered
   - publish missing account
   - publish expired token
   - partial platform failure
   - registry 新增 mock platform 後 API 可自動出現在 platforms response

### Frontend

1. 移除身份管理頁與發布頁中的固定 `PLATFORMS = instagram/threads` 清單，改由 API metadata 產生。
2. 身份管理頁讀取 callback query：
   - `connected`
   - `connect_error`
3. 連結 Modal 顯示重新連結、斷開、過期狀態。
4. 發布頁切換 identity 時同步更新平台狀態與可發布平台。
5. 發布前 summary 顯示哪些平台會發布、哪些會略過。
6. 發布結果支援 `error_code` 並映射成中文訊息。
7. 補 Playwright 或 component-level smoke test：
   - 未連結平台不可無聲失敗
   - token expired 顯示重新連結
   - partial success 正確顯示
   - mock 新平台 metadata 可在 UI 顯示，不需改 JSX 平台分支

---

## 風險與待確認

1. Meta App Review：Instagram / Threads 發布權限需要平台審核，測試模式與正式模式行為可能不同。
2. Instagram 帳號條件：發布 API 需符合 Meta 對專業帳號、頁面連結、權限 scope 的要求。
3. 媒體 URL：平台 API 需要公開可抓取的媒體 URL，Supabase Storage 權限與 signed URL 時效需要另行設計。
4. 排程持久化：目前 `/api/publish` 的排程回傳尚未保存 job；若本 slice 要驗收排程，需要新增 DB-backed scheduled posts。
5. Token refresh：若平台提供 refresh flow，需決定是否由登入時、發布前、或背景任務刷新。

---

## 本 Slice 不做

1. 社群平台密碼登入。
2. 儲存 Instagram / Threads 密碼。
3. 非官方 API、自動化瀏覽器發文。
4. Facebook / X / LinkedIn / TikTok 等未來平台的真實發布串接。
5. Paddle 訂閱。
6. 團隊、多使用者共同管理同一 identity。
7. 已發布貼文的 analytics。
