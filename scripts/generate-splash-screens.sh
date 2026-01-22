#!/bin/bash

# Generate PWA splash screens with centered logo
# Uses ImageMagick to create splash screens from brand kit logo

set -e

LOGO="public/brand-kit/exports/icon-512-light.png"
OUTPUT_DIR="public/icons"
BG_COLOR="white"

# Splash screen dimensions (width x height)
SIZES=(
  "1080x2340"
  "1125x2436"
  "1170x2532"
  "1179x2556"
  "1206x2622"
  "1284x2778"
  "1290x2796"
  "1320x2868"
)

echo "Generating PWA splash screens..."

for size in "${SIZES[@]}"; do
  width=$(echo $size | cut -d'x' -f1)
  height=$(echo $size | cut -d'x' -f2)

  # Calculate logo size (20% of screen height)
  logo_size=$(echo "$height * 0.20" | bc | cut -d'.' -f1)

  output="$OUTPUT_DIR/splash-$size.png"

  echo "  → $size (logo: ${logo_size}px)"

  # Generate splash: white canvas + resized logo composite
  magick -size ${width}x${height} xc:$BG_COLOR \
    \( "$LOGO" -resize ${logo_size}x${logo_size} \) \
    -gravity center -composite \
    -define png:color-type=2 \
    "$output"
done

echo "✓ Generated ${#SIZES[@]} splash screens"
