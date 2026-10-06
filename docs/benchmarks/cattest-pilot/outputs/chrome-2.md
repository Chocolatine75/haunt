I found two possible bugs. Neither is clear-cut.

- **Lightbox navigation with zoom on:** Arrow keys and the next button do nothing while zoom is on. The arrows are dimmed in that state, so this may be intentional.
- **Thumbnail highlight:** I saw the strip highlight lag by one step after wrapping from 12 to 1. That was a single screenshot taken mid-transition, so I'm not counting it as a bug.

I opened the lightbox, used the arrow keys and buttons, toggled zoom, clicked thumbnails, closed with Escape, and checked wrap-around from 12 to 1 and back. I didn't test other viewport sizes or touch input. The photos don't match their titles. The "Lioness at Dawn" image shows a skyscraper and "Wild Dog Pack at Rest" shows a person at a laptop, but those are placeholder images from picsum.photos, so I'm not counting that as an app bug.

```json
[
  {
    "description": "In the lightbox, ArrowRight/ArrowLeft keys and the next/previous buttons do nothing while zoom is toggled on. The arrow buttons are dimmed in that state, so this may be intentional, but there is no way to navigate without un-zooming first.",
    "steps": "1. Open http://localhost:4102/. 2. Click the first photo to open the lightbox. 3. Click the zoom toggle at the top right. 4. Press ArrowRight, or click the next arrow.",
    "expected_vs_actual": "Expected: the lightbox moves to image 2/12 (or the arrows are clearly disabled with the reason shown). Actual: it stays on 1/12 with no feedback."
  }
]
```
