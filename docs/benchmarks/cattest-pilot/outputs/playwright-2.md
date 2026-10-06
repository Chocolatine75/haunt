I found two problems, both with the photos. I only ran a short pass on the lightbox (open, next/previous, wrap-around, zoom, Escape, thumbnails), so other features may have issues I didn't reach.

What worked: opening from both grids, next/previous buttons and arrow keys, wrap-around from 12 to 1, zoom toggle, and Escape to close. The only console error was a missing favicon (404).

```json
[
  {
    "description": "Gallery photos don't match their titles and captions. For example, \"Cheetah in Full Stride\" shows an overhead shot of spice bowls and a cutting board. \"Lioness at Dawn\" shows a sky with a building spire, and \"Elephant Herd Crossing\" shows a coin-operated binocular viewer. None of the images look like the wildlife the app describes.",
    "steps": "1. Open http://localhost:4102/. 2. Click \"Lioness at Dawn\" and then press Next to reach \"Elephant Herd Crossing\" and \"Cheetah in Full Stride\". 3. Compare each image with its title and caption.",
    "expected_vs_actual": "Expected: each image shows the animal named in its title and caption. Actual: the images are unrelated stock photos (a sky, a binocular viewer, a food flat-lay)."
  },
  {
    "description": "The lightbox image is cropped heavily. Large photos fill a wide, short frame, so most of the subject is cut off. For example, the Lioness image shows only the top of a spire.",
    "steps": "1. Open http://localhost:4102/. 2. Click any photo to open the lightbox. 3. Look at the main image without zooming.",
    "expected_vs_actual": "Expected: the full photo is visible, scaled to fit. Actual: the photo is cropped into a wide frame, and subjects are cut off until zoom is toggled."
  }
]
```

I'm less sure of the second one. The cropping may be intended as the \"unzoomed\" state, and I didn't compare it against the full image.
