# FlowPilot – Smart Workflow Automation

Tagline: Automate the busywork. Keep control.

## Overview

FlowPilot is a web-based workflow automation platform that helps business teams manage workflows, automate repetitive tasks, connect applications, and monitor business processes from one centralized dashboard.

Businesses often spend valuable time on repetitive activities such as following up with leads, approving invoices, and routing customer support tickets. FlowPilot provides a simple way to organize these activities into workflows and monitor their execution.

Each workflow consists of three main components:

| Component | Description          | Example                            |
| --------- | -------------------- | ---------------------------------- |
| Trigger   | Starts a workflow    | A new CRM lead is created          |
| Condition | Checks a requirement | Lead score is 70 or higher         |
| Action    | Performs a task      | Send an email to the account owner |

## Screens and Modules

| Screen            | Purpose                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Home Dashboard    | Displays workflow statistics, weekly activity, performance charts, and failed executions.                      |
| Workflow Library  | Allows users to browse, search, filter, and manage workflows.                                                  |
| Workflow Builder  | Allows users to create workflows using Trigger, Condition, and Action steps.                                   |
| Integration Hub   | Provides options to connect and disconnect business applications such as Salesforce, Slack, Gmail, and Stripe. |
| Execution Monitor | Displays workflow execution history, step-by-step timelines, error messages, and retry options.                |
| Analytics         | Shows workflow success rates, execution trends, and performance comparisons.                                   |
| Settings          | Provides profile details, notification preferences, and account settings.                                      |

## Key Features

- Visual workflow builder with connected workflow steps.
- Create, edit, and manage workflows.
- Enable or disable workflows.
- Search and filter workflows.
- Preview workflow details.
- Add multiple workflows to a test queue.
- Monitor workflow execution history.
- View error messages and retry failed executions.
- Connect and disconnect sample business integrations.
- View charts and workflow performance statistics.
- Responsive layout for desktop, tablet, and mobile screens.
- Keyboard focus states and reduced-motion support.

## Design

- Style: Clean, modern business dashboard.
- Colour palette: Navy and violet accents on white and light-grey backgrounds, with pastel highlights.
- Typography: Inter.
- Components: Rounded cards, pill-shaped buttons, clean tables, line icons, charts, and visual workflow nodes.
- User experience: Simple navigation, clear labels, and helpful error messages.

## Technologies Used

- HTML5
- CSS3
- JavaScript
- Inline SVG icons and charts
- Google Fonts – Inter

## Run Locally

1. Clone or download this repository.
2. Open the project folder.
3. Open `index.html` in a modern web browser.

No installation or build process is required.

## Deploy with GitHub Pages

1. Push the project files to a GitHub repository.
2. Open the repository's Settings page.
3. Select Pages from the sidebar.
4. Under Build and deployment, choose Deploy from a branch.
5. Select the `main` branch and `/ (root)` folder.
6. Click Save.

## Project Structure

```
FlowPilot/
├── index.html
└── README.md
```

## Future Improvements

- Add a backend API and database.
- Implement user authentication and role-based access.
- Connect real business applications through APIs and webhooks.
- Add drag-and-drop workflow editing.
- Support background workflow execution.
- Add detailed user and system activity logs.

## Note

This project is a frontend prototype that uses sample data. Integration connections and workflow executions are simulated for demonstration purposes. It is not connected to the external applications listed in the project.
