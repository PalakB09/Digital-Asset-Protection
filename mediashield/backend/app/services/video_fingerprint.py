"""
Video fingerprint service — extract frames and compute CLIP embeddings.
"""
import cv2
from PIL import Image

from app.services.fingerprint import compute_embedding, compute_phash
from app.config import VIDEO_FRAMES, VIDEO_SCAN_SHORT_MAX_FRAMES


def uniform_stratified_frame_indices(total_frames: int, n_samples: int) -> list[int]:
    """
    Stratified uniform sampling over the frame index range [0, total_frames - 1].

    Splits the video into n_samples equal *time* segments (under constant FPS this
    equals equal frame-count segments), and returns the midpoint frame index of
    each segment: index i = floor((k + 0.5) * total_frames / n_samples).

    This is the standard "uniformly spaced frames" rule for fixed n_samples.
    """
    n = min(n_samples, total_frames)
    if n <= 0:
        return []
    return [min(total_frames - 1, int((k + 0.5) * total_frames / n)) for k in range(n)]


def probe_video_metadata(video_path: str) -> tuple[int, float, float]:
    """
    Returns (total_frames, fps, duration_sec).
    duration_sec uses frame_count / fps when fps > 0; otherwise 0.
    """
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
    cap.release()
    if total_frames <= 0:
        return 0, fps, 0.0
    if fps <= 0:
        # Some files report 0 FPS; assume 25 Hz so duration/short-clip logic still works
        fps = 25.0
    return total_frames, fps, total_frames / fps


def choose_scan_frame_count(
    total_frames: int,
    duration_sec: float,
    base: int = VIDEO_FRAMES,
) -> int:
    """
    Registration uses a fixed `base` count. For *scanning* short suspect clips,
    take more uniformly spaced frames (up to ~4 per second) so more queries hit
    the indexed frames from a long original.
    """
    if total_frames <= 0:
        return base
    # Long videos: same density as registration expectations
    if duration_sec >= 12.0:
        return min(base, total_frames)
    # Short clips: denser sampling, capped for CPU
    dense = max(base, int(duration_sec * 4))
    return max(1, min(dense, VIDEO_SCAN_SHORT_MAX_FRAMES, total_frames))


def extract_frames(video_path: str, n_frames: int = VIDEO_FRAMES) -> list:
    """
    Extract n_frames from a video using stratified uniform sampling.

    Sample positions are uniform along the timeline: with constant FPS, each sample
    lies at the midpoint of an equal-duration slice of the clip (same as uniform
    spacing in frame-number space). Frame indices are computed once and read with
    CAP_PROP_POS_FRAMES so registration and scan use the same rule.

    Returns list of PIL Images.
    """
    cap = cv2.VideoCapture(video_path)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        raise ValueError("Could not read video or video has no frames")

    indices = uniform_stratified_frame_indices(total_frames, n_frames)

    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, float(idx))
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, float(idx))
            ret, frame = cap.read()
        if ret:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(frame_rgb))
    cap.release()

    if not frames:
        raise ValueError("No frames could be extracted from video")
    return frames


def compute_video_fingerprint(video_path: str, n_frames: int = VIDEO_FRAMES) -> tuple:
    """
    Extract frames, compute CLIP embeddings for each, and pHash of middle frame.
    Returns (embeddings: list[list[float]], phash: str, frame_count: int)
    """
    frames = extract_frames(video_path, n_frames)
    embeddings = [compute_embedding(f) for f in frames]
    middle = frames[len(frames) // 2]
    phash = compute_phash(middle)
    return embeddings, phash, len(frames)
