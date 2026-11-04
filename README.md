# FlowPilot: Smart Workflow Automation

A web app UX project where business teams build automated workflows with visual steps, connect their apps, and monitor every run. It is a clickable front-end prototype with a playful, storefront-inspired design.

**Live demo:** https://claude.ai/artifact/V6HcvuKYV4r1huGFr7hQ5E

> Tagline: *Automate the busywork. Keep control.*

---

## Overview

Teams lose hours on repetitive tasks like following up on leads, approving invoices, and routing support tickets. FlowPilot turns these into workflows that run on their own. Each workflow is made of three kinds of steps:

| Step | What it does | Example |
|---|---|---|
| **Trigger** | Starts the workflow | New CRM lead |
| **Condition** | Checks something | Score is 70 or more |
| **Action** | Does something | Email the account owner |

The project was designed around the needs of a Software Developer role on a workflow and automation platform: dashboards, workflow logic, enterprise integrations, and monitoring.

## Screens

| Screen | Purpose |
|---|---|
| **Home (Dashboard)** | Hero banner, promo tiles, weekly stats, run chart, and failed runs that need attention |
| **Workflow Library** | Browse workflows as cards, filter by team, sort by runs or success rate, and preview with Quick view |
| **Workflow Builder** | Add, edit, and remove Trigger, Condition, and Action nodes on a visual canvas |
| **Integration Hub** | Connect or disconnect business apps such as Salesforce, Slack, Gmail, and Stripe |
| **Execution Monitor** | Run history with a step-by-step timeline, error messages, and a Retry button |
| **Analytics** | Success-rate line chart and runs-by-workflow bars |
| **Settings** | Profile, alert preferences, and API key |

## Features

- Visual workflow builder with colored nodes and connectors
- Workflow cards with status badges (Popular, New, Needs attention) and on/off toggles
- Quick view popup and a slide-out **test queue** (add several workflows, then run them together)
- Live search in the header and filters in the library
- Failure alerts with clear, plain-language error messages
- Charts built with inline SVG, with no chart library needed
- Responsive layout for desktop, tablet, and mobile
- Keyboard focus states and reduced-motion support

## Design

- **Inspiration:** the Crescendo preset of the Cello Shopify theme (cheerful layout, promo banners and tiles, product-style cards, quick view, slide-out cart, sticky header)
- **Palette:** navy and violet accents on white and light-grey backgrounds, with pastel tiles (lavender, sky, sun, coral, mint)
- **Typography:** Inter
- **Components:** large rounded cards, pill buttons, clean tables, line icons, simple charts, and visual workflow nodes
- **Writing:** plain language, sentence case, and error messages that say what went wrong and what to do next

## Tech

- HTML, CSS, and vanilla JavaScript in a single file
- Inline SVG icons and charts
- Google Fonts (Inter)
- Sample data only, so there is no backend in this version

## Run it locally

1. Download or clone this repository.
2. Open `index.html` in any modern browser.

No install or build step is needed.

## Publish it with GitHub Pages

1. Make sure the file is named `index.html` in the root of the repository.
2. Go to **Settings → Pages**.
3. Under **Branch**, choose `main` and `/ (root)`, then click **Save**.
4. Your site will be live at `https://<your-username>.github.io/<repository-name>/` after a minute or two.

## Roadmap

- [ ] Rebuild the front end in React with Tailwind CSS
- [ ] Node.js and Express REST API with a database
- [ ] Sign-in with JWT or OAuth2
- [ ] Message queue for running workflows in the background
- [ ] Real integrations through webhooks and OAuth
- [ ] Drag-and-drop for the workflow canvas

## Project structure

```
flowpilot/
├── index.html    the whole app: layout, styles, and scripts
└── README.md
```

## Author

**Mithra**, B.Sc. Computer Science with Artificial Intelligence, SDNB Vaishnav College for Women, Chennai.

## Note

All names, numbers, and workflows in the app are sample data made for this project. App names such as Salesforce, Slack, Gmail, and Stripe belong to their owners, and FlowPilot is not connected to or affiliated with them.
