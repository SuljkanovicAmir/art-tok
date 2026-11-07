# Instagram Poster

```bash
npm install                      # First time only
node post.mjs --dry-run          # Test post (renders card, prints caption)
node post.mjs --reel --dry-run   # Test reel (generates .mp4, needs ffmpeg)
```

- Requires `.env` with `IG_USER_ID`, `IG_ACCESS_TOKEN`, `META_APP_ID`, `META_APP_SECRET`
- GitHub Actions runs 4x/day — see `.github/workflows/instagram-post.yml`
- `alt_text_custom` is FORBIDDEN on Instagram Reels — causes API error
