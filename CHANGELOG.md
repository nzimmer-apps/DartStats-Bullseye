# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed
- Pinned `actions/checkout` in `.github/workflows/daily-scrape.yml` to `ref: main` so scheduled `Daily scrape` runs continue committing `data.json` to `main` after making `dev` the default branch.
