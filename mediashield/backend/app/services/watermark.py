"""
DCT-based watermark embedding and extraction for attribution.

Payload format:
- 16-bit payload length (bytes)
- UTF-8 payload bytes
"""

from __future__ import annotations

import numpy as np
from PIL import Image
import cv2
import os
import shutil

BLOCK_SIZE = 8
COEFF_A = (4, 3)
COEFF_B = (3, 4)
DEFAULT_STRENGTH = 12.0
DEFAULT_REPEAT = 5
MAX_PAYLOAD_BYTES = 64


def _build_dct_matrix(n: int = BLOCK_SIZE) -> np.ndarray:
    c = np.zeros((n, n), dtype=np.float32)
    factor = np.pi / (2.0 * n)
    scale0 = np.sqrt(1.0 / n)
    scale = np.sqrt(2.0 / n)
    for u in range(n):
        alpha = scale0 if u == 0 else scale
        for x in range(n):
            c[u, x] = alpha * np.cos((2 * x + 1) * u * factor)
    return c


_C = _build_dct_matrix()
_CT = _C.T


def _dct2(block: np.ndarray) -> np.ndarray:
    return _C @ block @ _CT


def _idct2(coeff: np.ndarray) -> np.ndarray:
    return _CT @ coeff @ _C


def _bytes_to_bits(data: bytes) -> list[int]:
    out: list[int] = []
    for b in data:
        for i in range(7, -1, -1):
            out.append((b >> i) & 1)
    return out


def _bits_to_bytes(bits: list[int]) -> bytes:
    out = bytearray()
    for i in range(0, len(bits), 8):
        chunk = bits[i : i + 8]
        if len(chunk) < 8:
            break
        value = 0
        for bit in chunk:
            value = (value << 1) | (1 if bit else 0)
        out.append(value)
    return bytes(out)


def _majority(bits: list[int]) -> int:
    return 1 if sum(bits) >= (len(bits) / 2.0) else 0


def _iter_block_positions(width: int, height: int):
    for y in range(0, height - BLOCK_SIZE + 1, BLOCK_SIZE):
        for x in range(0, width - BLOCK_SIZE + 1, BLOCK_SIZE):
            yield y, x


def _payload_bits(payload: str) -> list[int]:
    data = payload.encode("utf-8")[:MAX_PAYLOAD_BYTES]
    header = len(data).to_bytes(2, byteorder="big", signed=False)
    return _bytes_to_bits(header + data)


def _capacity_bits(width: int, height: int, repeat: int) -> int:
    blocks = (width // BLOCK_SIZE) * (height // BLOCK_SIZE)
    return blocks // max(repeat, 1)


def embed_watermark(
    image: Image.Image,
    payload: str,
    strength: float = DEFAULT_STRENGTH,
    repeat: int = DEFAULT_REPEAT,
) -> Image.Image:
    """Embed payload into the blue channel using block-DCT coefficient ordering."""
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)
    h, w, _ = arr.shape

    bits = _payload_bits(payload)
    if _capacity_bits(w, h, repeat) < len(bits):
        raise ValueError("Image too small for watermark payload")

    ch = arr[:, :, 2]
    positions = list(_iter_block_positions(w, h))

    idx = 0
    for bit in bits:
        for _ in range(repeat):
            y, x = positions[idx]
            idx += 1

            block = ch[y : y + BLOCK_SIZE, x : x + BLOCK_SIZE] - 128.0
            coeff = _dct2(block)

            a = coeff[COEFF_A]
            b = coeff[COEFF_B]
            gap = abs(a - b)

            target_gap = max(strength, gap)
            mid = (a + b) / 2.0
            if bit == 1:
                coeff[COEFF_A] = mid + target_gap / 2.0
                coeff[COEFF_B] = mid - target_gap / 2.0
            else:
                coeff[COEFF_A] = mid - target_gap / 2.0
                coeff[COEFF_B] = mid + target_gap / 2.0

            out_block = _idct2(coeff) + 128.0
            ch[y : y + BLOCK_SIZE, x : x + BLOCK_SIZE] = out_block

    arr[:, :, 2] = np.clip(ch, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), mode="RGB")


def extract_watermark(
    image: Image.Image,
    repeat: int = DEFAULT_REPEAT,
    max_payload_bytes: int = MAX_PAYLOAD_BYTES,
) -> str | None:
    """Extract payload from blue-channel DCT coefficients; returns None on failure."""
    rgb = image.convert("RGB")
    arr = np.array(rgb, dtype=np.float32)
    h, w, _ = arr.shape
    ch = arr[:, :, 2]

    positions = list(_iter_block_positions(w, h))
    if len(positions) < (16 * repeat):
        return None

    def decode_bit_group(start_index: int) -> int:
        group: list[int] = []
        for i in range(repeat):
            y, x = positions[start_index + i]
            block = ch[y : y + BLOCK_SIZE, x : x + BLOCK_SIZE] - 128.0
            coeff = _dct2(block)
            group.append(1 if coeff[COEFF_A] > coeff[COEFF_B] else 0)
        return _majority(group)

    decoded_bits: list[int] = []
    cursor = 0

    for _ in range(16):
        decoded_bits.append(decode_bit_group(cursor))
        cursor += repeat

    header_bytes = _bits_to_bytes(decoded_bits)
    if len(header_bytes) < 2:
        return None

    payload_len = int.from_bytes(header_bytes[:2], byteorder="big", signed=False)
    if payload_len < 0 or payload_len > max_payload_bytes:
        return None

    needed_payload_bits = payload_len * 8
    needed_groups = needed_payload_bits
    if cursor + (needed_groups * repeat) > len(positions):
        return None

    payload_bits: list[int] = []
    for _ in range(needed_payload_bits):
        payload_bits.append(decode_bit_group(cursor))
        cursor += repeat

    payload_bytes = _bits_to_bytes(payload_bits)
    if len(payload_bytes) < payload_len:
        return None

    try:
        return payload_bytes[:payload_len].decode("utf-8")
    except Exception:
        return None

def embed_watermark_video(
    input_video_path: str,
    output_video_path: str,
    payload: str,
    strength: float = DEFAULT_STRENGTH,
    repeat: int = DEFAULT_REPEAT,
) -> bool:
    """
    Extracts frames from input video, watermarks them using embed_watermark logic, 
    and writes to output_video_path without relying on complex ffmpeg chains.
    Returns True on success.
    """
    cap = cv2.VideoCapture(input_video_path)
    if not cap.isOpened():
        return False

    fps = cap.get(cv2.CAP_PROP_FPS)
    if fps <= 0:
        fps = 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # type: ignore
    out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
    
    if not out.isOpened():
        cap.release()
        return False

    try:
        # Precompute the payload bits once
        bits = _payload_bits(payload)
        cap_bits = _capacity_bits(width, height, repeat)
        if cap_bits < len(bits):
            # Not enough capacity, write unmodified
            while True:
                ret, frame = cap.read()
                if not ret: break
                out.write(frame)
            return True

        positions = list(_iter_block_positions(width, height))
        
        while True:
            ret, frame_bgr = cap.read()
            if not ret:
                break
            
            # The original embed_watermark modifies blue channel of RGB via PIL. 
            # CV2 is BGR. So blue channel is arr[:, :, 0]
            arr = frame_bgr.astype(np.float32)
            ch = arr[:, :, 0] # blue channel

            idx = 0
            for bit in bits:
                for _ in range(repeat):
                    y, x = positions[idx]
                    idx += 1

                    block = ch[y : y + BLOCK_SIZE, x : x + BLOCK_SIZE] - 128.0
                    coeff = _dct2(block)

                    a = coeff[COEFF_A]
                    b = coeff[COEFF_B]
                    gap = abs(a - b)

                    target_gap = max(strength, gap)
                    mid = (a + b) / 2.0
                    if bit == 1:
                        coeff[COEFF_A] = mid + target_gap / 2.0
                        coeff[COEFF_B] = mid - target_gap / 2.0
                    else:
                        coeff[COEFF_A] = mid - target_gap / 2.0
                        coeff[COEFF_B] = mid + target_gap / 2.0

                    out_block = _idct2(coeff) + 128.0
                    ch[y : y + BLOCK_SIZE, x : x + BLOCK_SIZE] = out_block

            arr[:, :, 0] = np.clip(ch, 0, 255)
            out.write(arr.astype(np.uint8))
            
    finally:
        cap.release()
        out.release()

    return True

def extract_watermark_video(video_path: str, max_frames: int = 15) -> str | None:
    """Attempt to extract watermark payload from the first few frames of a video."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None
    try:
        for _ in range(max_frames):
            ret, frame = cap.read()
            if not ret: break
            
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
            payload = extract_watermark(pil_img)
            if payload:
                return payload
        return None
    finally:
        cap.release()
