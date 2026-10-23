# Export the asset library

These tools use the existing pairing and need no browser session.

1. Call `list_library_categories` (`scope`: `public` by default, or `personal`) to
   find the category ID and its `asset_count`. Match the user's wording to a
   category name; if several match or none does, ask instead of guessing.
2. To inspect or count, call `list_library_assets` with the same filter and follow
   `next_cursor` until it is null. `total` is the server count for that filter.
3. To download, call `export_library_assets` with an authorized absolute
   `output_dir` (new or empty) and the same filter (`category_id`, `type`, `q`).
   The full list is fixed on the first call. Downloads continue in the plugin
   process; each call waits up to `wait_seconds` and returns progress. Keep calling
   with identical arguments while `running` is true.
4. When `complete` is true, check `listing_matches_server_total` and
   `all_downloaded`. If items failed, call again once to retry them; report any
   that still fail by ID and path. Never claim the export is complete otherwise.
5. Files land in one folder per category, original file names, never overwritten;
   `infinite-canvas-library-manifest.json` in the directory lists every asset ID,
   category, path, bytes and SHA-256. If the user wants an archive, zip the whole
   directory with local tools after completion and report the archive path and
   the downloaded count against `server_total`.

Each file uses the same transfer as `download_canvas_asset` (signed CDN/origin
links, Range resume, bounded retries). A different filter needs a different
`output_dir`. Assets uploaded after the first call are not included; start a new
export into a new directory to pick them up.
