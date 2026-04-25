# 2D Groove Party Disco Multiplayer

A browser-based 16x16 music grid with live multiplayer cursors and shared tile triggers.

## Local

Open `index.html` directly, or serve with any static server.

For multiplayer host config:

1. Copy `.env.example` to `.env.local`
2. Set `PARTYKIT_HOST`
3. Run `./setup-env.sh` to regenerate `env.js`

## Deploy

This repo is configured for GitHub Pages via `.github/workflows/deploy.yml`.

Set repository variable `PARTYKIT_HOST` in GitHub Actions variables.
