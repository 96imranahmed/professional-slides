# Privacy Policy

Last updated 10 October 2026

Professional Slides runs inside your own AI coding agent. It has no server, account or tracking of its own, and we never receive the briefs, evidence or decks you work on. This page sets out what does leave your computer when you use it, and what the shiphappens.xyz website collects.

## Who we are

Professional Slides is a skill and plugin for Claude Code and Codex, published by Imran Ahmed at [github.com/96imranahmed/professional-slides](https://github.com/96imranahmed/professional-slides) and shown on [shiphappens.xyz/slides](https://shiphappens.xyz/slides). "We" means the project and that website.

## The skill runs on your computer

- It is a set of instructions and a local Node and Python runtime that your agent runs on your own machine.
- It has no server, account, login or API key of its own, and no analytics, crash reporting or usage tracking.
- Your briefs, evidence, reference decks and finished decks are never sent to us.

## What leaves your computer, and where it goes

- **Your AI agent.** The skill works inside Claude Code or Codex, so what you ask it to do, and the files and drafts involved, are processed by that agent's provider (Anthropic or OpenAI) under your account and their terms. For its independent reviews (the storyline critique, the deck review and copy checks) the skill also starts your signed-in `claude` or `codex` command-line tool, which sends the deck's content, your request and the rendered slide images to the same provider. If neither tool is available, it writes the review out as files for your agent to answer instead.
- **Logos, photographs and places.** When a deck needs a company logo, a photograph or a place, the build looks it up on Wikipedia and Wikimedia Commons, sending the company name, the picture's search words or the place name. It only fetches what is not already in your project folder. Build with `--no-fetch`, or set a deck's assets to fetch `"none"`, to stop these lookups.
- **Public statistics.** When your agent asks for them, the skill downloads data series from the World Bank or Our World in Data, sending the indicator, the countries or entities and the years.
- **Websites you choose.** If you ask it to take a house style from a website, it downloads that page and up to eight of its stylesheets, which may be hosted elsewhere. The proposed style is not saved unless you accept it.
- **Your agent's own research.** While gathering evidence, your agent may search the web or download sources with its own tools, under your agent's settings and provider's terms.

The skill's own requests identify themselves as `professional-slides/1.0` and send no keys or cookies. The services above receive standard request details, such as your IP address, and handle them under their own privacy policies.

## What the skill keeps on your computer

- **In your project folder:** the deck and its rendered pages and checks, downloaded logos and photographs with their sources and licences, review files, and working logs and caches that are safe to delete.
- **Your design answers** in `~/.professional-slides/preferences.json` (or under `$PROFESSIONAL_SLIDES_HOME` or `$XDG_CONFIG_HOME`). A reference deck is recorded only as a fingerprint of its file path, not its contents. Running `preferences.mjs clear` deletes these answers.
- **Temporary files** in your system's temporary folder, including a LibreOffice profile kept to speed up rendering.

The skill never writes inside the installed plugin, and keeps nothing anywhere else. Deleting these folders removes everything it stored.

## The shiphappens.xyz website

- shiphappens.xyz uses Google Analytics to count visits and see which pages are used. It sets cookies and records details such as the pages you view, your approximate location, your device and browser, and the site that sent you. We look at this only in aggregate. You can block it in your browser's cookie settings or with Google's [opt-out add-on](https://tools.google.com/dlpage/gaoptout).
- Fonts on these pages load from Google Fonts, which receives your IP address and browser details.
- The policy and terms pages load their text from this repository on GitHub, which receives your IP address and browser details.
- There are no accounts, forms or comments. "Copy prompt" uses your browser's clipboard and sends nothing to us, and the downloads are plain files.
- The site's hosting provider processes standard request data, such as IP addresses, to serve pages and keep the site secure.

## Children

The skill and the website are made for professional use and are not directed at children under 13.

## Changes

We will update this page, and the date at the top, when the skill or the website changes how data is handled.

## Contact

Questions or requests: open an issue at [github.com/96imranahmed/professional-slides/issues](https://github.com/96imranahmed/professional-slides/issues). Our [Terms of Use](https://shiphappens.xyz/slides/terms) cover how you may use the skill and the samples.
