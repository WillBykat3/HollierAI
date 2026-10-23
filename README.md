# HollierAI

A pixel-faithful ChatGPT look-alike (fresh account, no chat history) for pranking friends.
Ask it anything: it shows **Thinking** for a random 5–15 seconds, then answers **"Jackass"**.

## Run it

It's plain HTML/CSS/JS with no build step or dependencies. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Works on GitHub Pages / Netlify / any static host.

## Personalise

- Profile name (bottom-left of the sidebar): add `?name=Jane%20Doe` to the URL. Defaults to "User".
- Reply text and think time: edit `REPLY`, `MIN_THINK_MS`, `MAX_THINK_MS` at the top of `app.js`.

## What works

- Light/dark mode follows the system setting, same as ChatGPT
- Desktop layout with a collapsible sidebar; mobile layout with a slide-out drawer
- Shimmering "Thinking" → "Thought for Ns" (click to expand), then the reply fades in
- The stop button ends the "thinking" early (the answer is still "Jackass")
- Copy, thumbs up/down, **Read aloud** (says it out loud), share, and Try again (thinks again, same answer)
- New chat, chat titles appearing in the sidebar, switching between chats, model menu, Enter to send / Shift+Enter for newline
