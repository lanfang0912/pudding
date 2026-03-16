# YouTube Video Finder

每天自動找 3 支 YouTube 有 CC 字幕的伴侶／親子關係訪談影片，並用 Claude API 生成臉書貼文。

## 功能

- 用 YouTube Data API v3 搜尋外文訪談影片（伴侶、親子關係主題）
- 篩選條件：有 CC 字幕、觀看數 > 10 萬、一年內發布
- 抓取 CC 字幕全文（支援英/日/韓/西班牙/法/德語）
- 呼叫 Claude API（claude-opus-4-6）生成符合風格的臉書貼文
- 輸出日報 `daily_report_YYYY-MM-DD.txt`

## 安裝

```bash
cd youtube_video_finder
pip install -r requirements.txt
cp .env.example .env
# 編輯 .env，填入兩組 API Key
```

## 設定 API Keys

### YouTube Data API v3
1. 前往 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 建立專案 → 啟用「YouTube Data API v3」
3. 建立「API 金鑰」→ 複製貼入 `YOUTUBE_API_KEY`

### Anthropic Claude API
1. 前往 [Anthropic Console](https://console.anthropic.com/)
2. 建立 API Key → 複製貼入 `ANTHROPIC_API_KEY`

## 執行

```bash
python main.py
```

## 每日自動執行（cron）

```bash
# 每天早上 9 點執行
0 9 * * * cd /path/to/youtube_video_finder && python main.py >> run.log 2>&1
```

## 輸出說明

- Console：即時顯示每支影片的資訊與貼文
- `daily_report_YYYY-MM-DD.txt`：完整日報（影片資訊 + 臉書貼文）

## 專案結構

```
youtube_video_finder/
├── main.py              # 主程式（入口）
├── config.py            # 設定（API Keys、搜尋參數、提示詞）
├── youtube_finder.py    # YouTube 影片搜尋與篩選
├── transcript_fetcher.py # CC 字幕抓取
├── report_generator.py  # Claude API 臉書貼文生成
├── requirements.txt     # Python 套件相依
├── .env.example         # 環境變數範本
└── README.md
```
