"""
Video fingerprint service — extract frames and compute CLIP embeddings.
"""
import cv2
from PIL import Image

from app.services.fingerprint import compute_embedding, compute_phash
from app.config import VIDEO_FRAMES


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
