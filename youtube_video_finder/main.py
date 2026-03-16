"""
YouTube Video Finder — Daily Runner

Finds 3 YouTube relationship/parenting interview videos with CC subtitles,
fetches their transcripts, and generates Facebook posts via Claude API.

Usage:
    python main.py

Output:
    Console output + daily_report_YYYY-MM-DD.txt in the current directory.

Schedule (cron example, runs every day at 09:00):
    0 9 * * * cd /path/to/youtube_video_finder && python main.py >> run.log 2>&1
"""
import sys
from datetime import date
from pathlib import Path

from config import YOUTUBE_API_KEY, ANTHROPIC_API_KEY, VIDEOS_PER_RUN
from youtube_finder import find_videos
from transcript_fetcher import fetch_transcript
from report_generator import generate_facebook_post


DIVIDER = "=" * 70


def check_env() -> None:
    missing = []
    if not YOUTUBE_API_KEY:
        missing.append("YOUTUBE_API_KEY")
    if not ANTHROPIC_API_KEY:
        missing.append("ANTHROPIC_API_KEY")
    if missing:
        print(f"[ERROR] Missing environment variables: {', '.join(missing)}")
        print("        Copy .env.example to .env and fill in your API keys.")
        sys.exit(1)


def run() -> None:
    check_env()

    today = date.today().isoformat()
    report_path = Path(f"daily_report_{today}.txt")

    print(f"\n{DIVIDER}")
    print(f"  YouTube Video Finder — {today}")
    print(DIVIDER)
    print(f"  目標：找 {VIDEOS_PER_RUN} 支有 CC 字幕的伴侶／親子關係訪談影片")
    print(f"  篩選：觀看數 > 10 萬 | 一年內發布 | 以外文為主")
    print(DIVIDER + "\n")

    # ── Step 1: Search YouTube ──────────────────────────────────────────────
    print("▶ 搜尋 YouTube 影片中...")
    try:
        videos = find_videos()
    except Exception as e:
        print(f"[ERROR] YouTube 搜尋失敗：{e}")
        sys.exit(1)

    if not videos:
        print("[WARN] 未找到符合條件的影片，請稍後再試。")
        sys.exit(0)

    print(f"  找到 {len(videos)} 支符合條件的影片\n")

    # ── Step 2 & 3: Fetch transcripts + generate posts ──────────────────────
    report_sections: list[str] = []

    for idx, video in enumerate(videos, start=1):
        print(f"{DIVIDER}")
        print(f"  影片 {idx}/{len(videos)}")
        print(f"  標題：{video['title']}")
        print(f"  頻道：{video['channel']}")
        print(f"  網址：{video['url']}")
        print(f"  觀看數：{video['view_count']:,}  |  發布：{video['published_at'][:10]}")
        print(DIVIDER)

        # Fetch CC transcript
        print("  ▷ 抓取字幕...")
        transcript, lang = fetch_transcript(video["id"])

        if not transcript:
            print("  [SKIP] 找不到可用的 CC 字幕，跳過此影片。\n")
            continue

        print(f"  ▷ 字幕語言：{lang}  |  字幕長度：{len(transcript)} 字元")

        # Generate Facebook post
        print("  ▷ 呼叫 Claude 生成臉書貼文...")
        try:
            post = generate_facebook_post(video, transcript)
        except Exception as e:
            print(f"  [ERROR] Claude API 呼叫失敗：{e}\n")
            continue

        print("\n  ─── 生成的臉書貼文 ───────────────────────────────────────────")
        print(post)
        print("  ──────────────────────────────────────────────────────────────\n")

        # Collect for file output
        section = (
            f"【影片 {idx}】{video['title']}\n"
            f"頻道：{video['channel']}\n"
            f"網址：{video['url']}\n"
            f"觀看數：{video['view_count']:,}　發布：{video['published_at'][:10]}\n"
            f"字幕語言：{lang}\n\n"
            f"── 臉書貼文 ──\n{post}\n"
        )
        report_sections.append(section)

    # ── Step 4: Write report file ───────────────────────────────────────────
    if report_sections:
        full_report = (
            f"YouTube 每日影片報告 — {today}\n"
            + DIVIDER + "\n\n"
            + ("\n" + DIVIDER + "\n\n").join(report_sections)
        )
        report_path.write_text(full_report, encoding="utf-8")
        print(f"\n✓ 報告已儲存至：{report_path.resolve()}")
    else:
        print("\n[WARN] 沒有成功處理任何影片，未產生報告檔案。")

    print("\n完成！\n")


if __name__ == "__main__":
    run()
