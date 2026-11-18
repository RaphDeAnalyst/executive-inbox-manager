# Executive Inbox & Follow-up Manager

[**View the live application →**](https://raphdeanalyst.github.io/executive-inbox-manager/)

## Project Overview

Executive Inbox & Follow-up Manager is a local-first workspace for organising executive communications and making follow-through visible. It addresses a common executive-assistant workflow problem: important requests arrive alongside routine messages, and the response, owner, or due date can otherwise be overlooked.

This repository contains a functional MVP with fictional sample emails. It does not connect to a real mailbox.

## Core Capabilities

- **Executive inbox management:** Review messages, open message details, mark messages read or unread, flag whether a response is required, archive messages, and delete messages with confirmation.
- **Email categorisation and prioritisation:** Assign one of eight categories and Critical, High, Medium, or Low priority. Overview metrics are calculated from workspace data.
- **Message search and filtering:** Search sender, address, subject, preview, body, or category; filter messages by category, priority, and read/response status.
- **Follow-up tracking:** Create or edit follow-ups linked to an email, record an owner, deadline, status, priority, and notes, open the source email, and mark follow-ups complete. Overdue status is derived from the due date and current date.
- **Commitment detection:** Local text rules suggest possible actions and simple relative deadlines in message text. Suggestions show the source text and are not treated as confirmed commitments.
- **Reply drafting:** Start a reply from a message using editable Professional, Friendly, Formal, or Concise templates. Copy, save, reopen, edit, or discard drafts.
- **Needs Attention dashboard:** Review messages with critical/high priority or a response request, alongside overdue follow-ups. Overview metrics, upcoming tasks, and recent activity reflect the local workspace.
- **Local data persistence:** Messages, follow-ups, drafts, and activity are saved to browser `localStorage`. Restore Sample Workspace replaces local data with the original fictional data.
- **Email import and follow-up export:** Add a message manually, paste plain-text email headers for review, or import a `.txt` email file. Export follow-ups as CSV or use the browser print dialog for a follow-up report.

## How It Works

1. Start with the fictional sample workspace, add a message manually, paste an email, or import a `.txt` file. Imported content is reviewed in the message form before it is saved.
2. Search the inbox and inspect sender details, subject, message body, category, priority, and whether a reply is needed.
3. Open a message to review rule-based commitment suggestions. A detected action can prefill a follow-up, but the owner and due date should be confirmed by a person.
4. Track the action in Follow-ups, update its status or deadline, and mark it complete when the work is done. Overdue status is calculated rather than manually assigned.
5. Draft a reply from the original message. The local tone template supplies a greeting and acknowledgement based on the sender and subject; the user edits and saves or copies the draft.

## Technology Stack

- **React 18** — interactive single-page user interface.
- **TypeScript 5** — typed application data and UI code.
- **Vite 6** — local development server and static production build.
- **Tailwind CSS 3 and PostCSS** — styling toolchain; the current interface uses its own responsive CSS conventions.
- **Lucide React** — interface icons.
- **Browser `localStorage`** — MVP persistence on the current device and browser.
- **GitHub Actions and GitHub Pages** — automated static build and hosting.

## Current Implementation and Limitations

This MVP processes fictional or user-entered messages locally. Data is stored in the browser and is not synchronised to a server or another device. Clearing browser site data removes the saved workspace.

There is no Gmail or Microsoft Outlook connection, email sending, account synchronisation, cloud database, authentication, or multi-user access. Reply drafts use deterministic local templates; no live AI model or Claude API is connected. Commitment detection uses simple rules and should be reviewed for accuracy. Relative deadline phrases are interpreted locally; ambiguous or unsupported dates are left unspecified.

The app has no client-side URL router. Its navigation is managed within the single-page interface, so GitHub Pages serves the application from its repository path and does not need a history fallback for nested routes.

## Future Development Roadmap

All capabilities below are planned or potential enhancements; they are not currently implemented.

### 1. AI-Powered Email Intelligence

A future Claude or other suitable LLM integration could:

- Understand email context, intent, and conversation history.
- Generate more accurate summaries.
- Identify implicit requests and commitments.
- Detect urgency and business implications.
- Extract actions, owners, and deadlines with reviewable evidence.
- Draft contextual email replies.
- Recommend responses based on previous conversations.

### 2. Direct Email Account Integration

Potential Gmail and Microsoft Outlook integrations could allow users to:

- Connect email accounts through secure, provider-supported authentication.
- Retrieve and synchronise incoming messages.
- Read and organise messages in the application.
- Create and save reply drafts.
- Send explicitly approved responses.
- Archive and manage messages.
- Synchronise supported changes with the original mailbox.

### 3. Workflow Automation

Potential workflow enhancements include:

- Automatically identify messages that may need responses.
- Create reviewable follow-up tasks from incoming emails.
- Schedule follow-up reminders.
- Alert users about overdue commitments.
- Escalate high-priority communications.
- Generate daily executive inbox briefs.
- Track unresolved communication threads.

### 4. Advanced Executive Productivity

The platform could expand to include:

- Calendar integration.
- Meeting scheduling from email conversations.
- Contact and relationship management.
- Team assignment and delegation.
- Communication analytics.
- Multi-user accounts and role-based access.
- A cloud database and cross-device synchronisation.

## Installation and Local Development

Requirements: Node.js 20 or later and npm.

```bash
git clone https://github.com/<YOUR-USERNAME>/Inbox_manager.git
cd Inbox_manager
npm ci
npm run dev
```

Open the local URL printed by Vite. To type-check and create a production build:

```bash
npm run build
```

To preview the production build locally, run `npm run preview`.

## Deployment

The workflow at [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) builds the app and deploys the `dist` artifact to GitHub Pages when code is pushed to `main` or `master`. It can also be started manually from the repository’s **Actions** tab.

The workflow sets `VITE_BASE_PATH` from the GitHub repository name before building. Vite uses that base path to prefix compiled JavaScript and CSS assets, so a project repository named `Inbox_manager` is built for `/Inbox_manager/`. Local development and ordinary local builds default to `/`.

To enable deployment:

1. Create a GitHub repository and push the project to its `main` or `master` branch.
2. In the repository, open **Settings → Pages** and select **GitHub Actions** as the build and deployment source.
3. Open **Actions** and confirm that the deployment workflow completes successfully.

For a project repository, the expected URL is `https://<YOUR-USERNAME>.github.io/<REPOSITORY-NAME>/` (or the corresponding organization Pages domain). The workflow derives the asset base from the actual repository name. No deployment is implied until the GitHub Actions run succeeds.

## Project Status

Functional MVP under development. The application is intended for demonstration and local workflow organisation; it is not a live email client or a substitute for confirming business commitments.

## License

No license has been specified for this project. All rights are reserved by default unless a license is added.
