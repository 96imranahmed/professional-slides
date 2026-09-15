"""Compatibility entrypoint; implementation ships with the portable skill."""
from pathlib import Path
_owner = Path(__file__).resolve().parents[2] / "skills/professional-slides/runtime/read_copy_sources.py"
__file__ = str(_owner)
exec(compile(_owner.read_text(), str(_owner), "exec"), globals())
