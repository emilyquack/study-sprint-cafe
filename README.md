# Study Sprint Cafe ☕🥭

A cozy, pastel, GitHub Pages-ready focus timer where every study sprint fills a cafe drink and earns tiny rewards.

## Features

- Focus, short break, and deep-work sprint modes
- Animated cafe drink progress cup
- Drink menu: Matcha Cloud, Mango Boba, Cozy Latte, Peach Tea
- Kiwi the Cat barista pep talks
- Sprint goal/order ticket
- Tiny study goal suggestions
- Local loyalty card stamps, stickers, minutes, and recent wins
- `localStorage` persistence per browser/device
- No build step and no app secrets — just static HTML/CSS/JS

## Run locally

From this folder:

```bash
python -m http.server 8088
```

Then open:

```text
http://127.0.0.1:8088/
```

## Publish with GitHub Pages later

1. Create a GitHub repo, for example `study-sprint-cafe`.
2. Push this folder to the repo's `main` branch.
3. In GitHub: **Settings → Pages → Build and deployment → Deploy from branch → main / root**.
4. Your site will become available at a URL like:

```text
https://emilyquack.github.io/study-sprint-cafe/
```

## Privacy note

This is designed to be public-safe: it stores goals and stats only in the visitor's browser via `localStorage`. If the repo is public, don't hard-code private school/lab details into the source.
