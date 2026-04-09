"""Quick test of the ddgs search pipeline."""
import time
from ddgs import DDGS

d = DDGS()

print("=== WEB SEARCH ===")
results = d.text("free sports photos download", max_results=5)
print(f"Results: {len(results)}")
for r in results:
    print(f"  {r['href']}")

time.sleep(3)

print()
print("=== IMAGE SEARCH ===")
imgs = d.images("sports action photography", max_results=5)
print(f"Results: {len(imgs)}")
for img in imgs:
    print(f"  {img['image'][:100]}")

print()
print("ALL GOOD!" if results and imgs else "PARTIAL (some searches rate-limited)")
