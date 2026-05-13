# Slice 3 — 發布 + 排程

> 實作 Instagram + Threads 真實發布，以及排程功能（APScheduler）。
> 前端 UI + 後端完整實作。
> **禁止：JWT 驗證、DB 寫入、Paddle、X/LinkedIn adapter。**

---

## 前提

Slice 2 已完成。`/app/drafts/new` 可修稿，點「前往發布」導向 `/app/publish/mock-post-id`。

## 完成標準

1. 點「前往發布」進入發布控制頁，可各平台微調文字
2. 選立即發布 → 文章真的出現在 Threads / Instagram
3. 選排程 → 指定時間後自動發布
4. AI 建議最佳發布時間

---

## 後端規格

### Meta OAuth（連結帳號）

```
GET /api/social/connect/{platform}   → redirect 到 Meta OAuth
GET /api/social/callback/{platform}  → 換 token，存記憶體（Slice 5 後改 DB）
```

Token 暫存（記憶體，重啟即失效）：
```python
# backend/app/core/token_store.py
_store: dict[str, str] = {}  # key: "demo_user:{platform}", value: token

def save_token(platform: str, token: str): ...
def get_token(platform: str) -> str | None: ...
```

### 平台 Adapter 架構

```python
# base.py
@dataclass
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    url: str | None = None
    error: str | None = None

class BasePlatformAdapter(ABC):
    @property
    @abstractmethod
    def meta(self) -> PlatformMeta: ...

    @abstractmethod
    async def validate(self, text: str, token: str) -> list[str]: ...

    @abstractmethod
    async def publish(self, text: str, media_urls: list[str], token: str) -> PublishResult: ...
```

**Threads Adapter：**
```python
# platforms/threads.py
async def publish(self, text, media_urls, token) -> PublishResult:
    async with httpx.AsyncClient() as client:
        # Step 1: 建立 container
        res = await client.post(
            "https://graph.threads.net/v1.0/me/threads",
            params={"media_type": "TEXT", "text": text, "access_token": token}
        )
        container_id = res.json()["id"]
        # Step 2: 發布
        res2 = await client.post(
            "https://graph.threads.net/v1.0/me/threads_publish",
            params={"creation_id": container_id, "access_token": token}
        )
        post_id = res2.json()["id"]
        return PublishResult(success=True, platform_post_id=post_id,
                            url=f"https://www.threads.net/t/{post_id}")
```

### APScheduler 初始化

```python
# backend/app/core/scheduler.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from zoneinfo import ZoneInfo

scheduler = AsyncIOScheduler(timezone=ZoneInfo("Asia/Taipei"))

# backend/app/main.py
@app.on_event("startup")
async def startup():
    scheduler.add_job(
        dispatch_scheduled_posts,
        "interval",
        minutes=1,
        id="check_scheduled_posts",
    )
    scheduler.start()

@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
```

**排程掃描任務（Slice 5 DB 完成後才真正運作，現在先建 skeleton）：**
```python
async def dispatch_scheduled_posts():
    """每分鐘掃描到期排程，Slice 5 DB 完成後補上查詢邏輯"""
    pass
```

### `POST /api/publish`

```python
class PublishRequest(BaseModel):
    platforms: list[str]
    platform_texts: dict[str, str]   # { "instagram": "...", "threads": "..." }
    media_urls: list[str] = []
    scheduled_at: datetime | None = None

@router.post("/publish", status_code=202)
async def publish(body: PublishRequest):
    if body.scheduled_at is None:
        # 立即發布（同步執行）
        results = await asyncio.gather(*[
            PlatformRegistry.get(p).publish(
                text=body.platform_texts.get(p, ""),
                media_urls=body.media_urls,
                token=get_token(p) or "",
            )
            for p in body.platforms
        ], return_exceptions=True)

        return {
            "mode": "immediate",
            "results": [
                {
                    "platform": p,
                    "success": not isinstance(r, Exception) and r.success,
                    "url": r.url if not isinstance(r, Exception) else None,
                    "error": str(r) if isinstance(r, Exception) else r.error,
                }
                for p, r in zip(body.platforms, results)
            ]
        }
    else:
        # 排程（Slice 5 DB 完成後補上儲存邏輯）
        if body.scheduled_at <= datetime.now(timezone.utc):
            raise HTTPException(422, {"code": "SCHEDULED_TIME_IN_PAST"})
        return { "mode": "scheduled", "scheduled_at": body.scheduled_at }
```

### `GET /api/publish/best-time`

```python
BEST_TIMES = {
    "instagram": [{"time": "12:00", "reason": "午休瀏覽高峰"},
                  {"time": "19:00", "reason": "下班後高峰"}],
    "threads":   [{"time": "08:00", "reason": "通勤早晨"},
                  {"time": "21:00", "reason": "夜間活躍"}],
    "x":         [{"time": "09:00", "reason": "早晨開機"},
                  {"time": "18:00", "reason": "收工時段"}],
    "linkedin":  [{"time": "10:00", "reason": "週二週三上午互動率最高"}],
}

@router.get("/publish/best-time")
async def best_time(platforms: str):   # comma-separated
    # 計算各平台最近的建議時間（台北時間），回傳 UTC
    ...
```

---

## 前端規格

### 發布控制頁 `/app/publish/[postId]`

```
┌─────────────────────────────────────────────────┐
│  ← 返回編輯                                     │
│                                                 │
│  圖稿預覽（若有）                               │
│                                                 │
│  各平台文字微調                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Instagram ▼（點擊展開）                │   │
│  │  ┌─────────────────────────────────┐   │   │
│  │  │  可編輯文字，預填修稿結果       │   │   │
│  │  │                     字數：xx/2200│   │   │
│  │  └─────────────────────────────────┘   │   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │  Threads ▼                              │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  發布時間                                       │
│  ● 立即發布   ○ 排程發布                        │
│                                                 │
│  （排程時展開）                                 │
│  ✦ 建議：今天 19:00（下班後高峰）               │
│     [套用]                                      │
│  📅 [2026/05/15]  🕐 [19:00]                   │
│                                                 │
│                    [發布 →]                     │
└─────────────────────────────────────────────────┘
```

**各平台微調規格：**

```gherkin
Scenario: 展開平台微調
  When 使用者點擊 Instagram 展開
  Then 顯示可編輯文字框，預填修稿結果
  And 右下角顯示字數 / 2200

Scenario: 各平台文字獨立
  Given Instagram 文字已修改
  When 展開 Threads
  Then Threads 仍顯示原始修稿結果，不受影響
```

**排程規格：**

```gherkin
Scenario: 切換到排程模式
  When 點擊「排程發布」radio
  Then 展開日期時間 picker（Framer Motion）
  And 呼叫 GET /api/publish/best-time
  And 顯示建議時間與原因

Scenario: 套用建議時間
  When 點擊「套用」
  Then picker 填入建議時間

Scenario: 選擇過去時間
  When picker 選到已過去的時間
  Then 顯示 inline 錯誤「請選擇未來的時間」
  And 發布按鈕 disabled

Scenario: 確認排程
  When 選好未來時間，點擊「發布」
  Then POST /api/publish（帶 scheduled_at UTC）
  And 顯示成功提示「已排程：05/15 19:00 發布」
```

**立即發布結果顯示：**

```gherkin
Scenario: 立即發布成功
  When POST /api/publish 回傳所有平台 success
  Then 各平台顯示 ✓ success 和貼文連結

Scenario: 部分失敗
  When Instagram success，Threads failed
  Then Instagram 顯示 ✓，連結可點
  And Threads 顯示 ✗ + 錯誤原因
  And 顯示「重試 Threads」按鈕
```

### 設定頁（連結社群帳號）

```
/app/settings

[Connect Instagram]
[Connect Threads]

完成後顯示：
Instagram  @handle  ✓  [Disconnect]
Threads    @handle  ✓  [Disconnect]
```

點擊 Connect → 呼叫 `/api/social/connect/{platform}` → Meta OAuth 流程。

---

## 時區處理

```typescript
import { formatInTimeZone, zonedTimeToUtc } from 'date-fns-tz'
const TZ = "Asia/Taipei"

// picker 值 → UTC（送 API）
function toUTC(localDate: Date): string {
  return zonedTimeToUtc(localDate, TZ).toISOString()
}
// UTC → 顯示（台北時間）
function toDisplay(utcStr: string): string {
  return formatInTimeZone(new Date(utcStr), TZ, "MM/dd HH:mm")
}
```

```bash
npm install date-fns date-fns-tz
pip install httpx apscheduler
```

---

## 目錄結構（新增）

```
src/components/
└── publish/
    ├── PlatformTextEditor.tsx   ← 各平台微調
    ├── PublishTimeSelector.tsx  ← 立即 / 排程 radio
    └── BestTimeHint.tsx         ← AI 建議時間卡片

backend/app/services/publish/
├── base.py
├── registry.py
├── dispatcher.py
└── platforms/
    ├── instagram.py
    └── threads.py
```

---

## ❌ 禁止產生

- JWT 驗證
- DB 寫入（publish_logs）
- Token 加密（明文存記憶體即可）
- Celery / Redis
- X、LinkedIn adapter

---

## 完成標準

**發布控制頁：**
- [ ] 各平台文字框獨立，可各自編輯
- [ ] 字數計數依平台上限
- [ ] 「立即發布」呼叫 API，顯示各平台結果
- [ ] 部分失敗顯示錯誤 + 重試按鈕

**排程：**
- [ ] 切換排程展開 datetime picker
- [ ] 呼叫 best-time API，顯示建議
- [ ] 「套用」一鍵填入時間
- [ ] 過去時間顯示 inline 錯誤
- [ ] 確認排程顯示成功提示

**發布真實：**
- [ ] `/app/settings` 可走 Meta OAuth 連結帳號
- [ ] Threads 上看到真實發出的貼文
- [ ] APScheduler 隨後端啟動（skeleton，Slice 5 補完整邏輯）