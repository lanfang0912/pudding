"""Configuration for YouTube Video Finder."""
import os
from dotenv import load_dotenv

load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

# Search settings
VIDEOS_PER_RUN = 3
MIN_VIEW_COUNT = 100_000
MAX_AGE_DAYS = 365

# Search queries for partner/parenting relationship interview shows (foreign language focus)
SEARCH_QUERIES = [
    "couples therapy interview relationship advice",
    "parenting expert interview child development",
    "marriage counseling relationship podcast interview",
    "parent child relationship psychology interview",
    "couple conflict resolution expert talk",
    "family therapist interview parenting tips",
    "relationship coach interview marriage advice",
    "attachment parenting expert interview",
]

# Preferred languages (non-Chinese, targeting foreign content)
PREFERRED_LANGUAGES = ["en", "ja", "ko", "es", "fr", "de"]

# Facebook post generation prompt
FACEBOOK_POST_PROMPT = """根據以下影片的字幕內容，請完成以下任務：

(1) 根據來源資訊，把內容寫成一篇通俗易懂的臉書貼文，口語化、節奏快、煽情、幽默、但不說教。
(2) 不要杜撰，根據事實，用「第三者」的視角說故事。開頭要有爆點，引言不要太長，趕快進入重點，結尾要總結本文重點，並且有金句，讓人讀得津津有味！
(3) 不要有表情符號、分隔線、#主題標籤

影片標題：{title}
影片頻道：{channel}
影片連結：{url}

字幕內容（節錄）：
{transcript}

請直接輸出臉書貼文內容，不需要額外說明。"""
