Insurer logos (optional). Until a logo is added here, each insurer shows a
small coloured badge with its initials.

To add a real logo:
1. Put the official file in this folder, named by the insurer's code,
   e.g. star_health.png or hdfc_ergo.svg (square, transparent, ~128x128).
   Codes are in backend app/services/insurers.py.
2. Add one line to logos.json, e.g.
   { "star_health": "star_health.png", "hdfc_ergo": "hdfc_ergo.svg" }
3. Rebuild/deploy the frontend. No code change needed.

Use only logos you have permission to use (e.g. from the insurer's tie-up kit).
