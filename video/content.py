"""Shared content + timing for the AI Engineer Field Guide promo video.

Everything the video says lives here, so the copy can be swapped without
touching the renderer or the soundtrack.
"""

# ---- timing -----------------------------------------------------------------
BPM = 128
BEAT = 60.0 / BPM          # 0.46875 s
BAR = BEAT * 4             # 1.875 s
BARS = 16
DURATION = BAR * BARS      # 30.0 s exactly
FPS = 30
W, H = 1920, 1080

# Section boundaries, in bars.
INTRO = (0, 2)       # terminal boot
TITLE = (2, 4)       # title slam
TOPICS = (4, 12)     # one topic per bar
CHANT = (12, 14)     # BUILD / SHIP / EVAL / REPEAT
OUTRO = (14, 16)     # lockup + URL

# ---- copy -------------------------------------------------------------------
TITLE_TOP = "AI ENGINEER"
TITLE_BOTTOM = "FIELD GUIDE"
TAGLINE = "FROM PROMPT  >>  PRODUCTION"
URL = "ai-engineer-field-guide-production.up.railway.app"
CTA = "READ THE GUIDE"

BOOT_LINES = [
    "> boot field_guide.exe --mode=LOUD",
    "> loading weights ........... ok",
    "> mounting vector store ..... ok",
    "> spawning agents ........... ok",
    "> running evals ............. 100%",
]

# (title, subtitle, visual kind)
TOPICS_LIST = [
    ("LLM FUNDAMENTALS", "tokens · context windows · sampling", "neural"),
    ("PROMPT ENGINEERING", "system prompts · few-shot · structured output", "tokens"),
    ("RAG", "embed · retrieve · ground every answer", "vectors"),
    ("AGENTS & TOOLS", "think · act · observe · repeat", "agent"),
    ("EVALS", "if you can't measure it, you can't ship it", "bars"),
    ("FINE-TUNING", "adapt the model to your domain", "loss"),
    ("PRODUCTION & OPS", "latency · cost · observability", "ops"),
    ("SAFETY & GUARDRAILS", "red-team · filter · defend", "shield"),
]

CHANT_WORDS = ["BUILD", "SHIP", "EVAL", "REPEAT"]

# ---- palette ----------------------------------------------------------------
BG = (7, 6, 16)
MAGENTA = (255, 43, 214)
CYAN = (0, 240, 255)
ACID = (230, 255, 0)
ORANGE = (255, 90, 31)
WHITE = (255, 255, 255)
ACCENTS = [MAGENTA, CYAN, ACID, ORANGE]
