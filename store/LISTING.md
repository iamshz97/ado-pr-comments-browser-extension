# Store listing — copy/paste source

Used for both the Chrome Web Store and Microsoft Edge Add-ons.

## Name

Copy Azure DevOps PR Comments for LLM

## Short description / summary (≤ 132 chars)

Copy the unresolved review comments from an Azure DevOps pull request as clean, AI-ready Markdown. Runs locally.

## Detailed description

Turn Azure DevOps pull request feedback into a ready-to-paste prompt for ChatGPT, Claude, GitHub Copilot or any other AI coding agent, in one click.

Open a pull request, click the extension, and you get:

• A quick summary: unresolved threads, comments and reviewers
• A preview of every unresolved comment, grouped by file and line. Click one to jump to it.
• One button to copy everything as clean Markdown, with a short instruction asking the AI to fix the code based on the reviewers' comments

Built for privacy:

• Hide reviewer names: reviewers become "Reviewer #1", "Reviewer #2", and you become "Me". @mentions and names inside comments are replaced too.
• Hide my comments: copy only what reviewers said
• Click a reviewer to leave their comments out
• Everything runs in your browser using your existing Azure DevOps sign-in. No accounts, no servers, no analytics, nothing sent anywhere.

Works with dev.azure.com, *.visualstudio.com and Azure DevOps Server.

Keyboard: Alt+Shift+C opens the popup, and C copies.

Not affiliated with or endorsed by Microsoft.

## Category

Developer Tools

## Search terms / keywords (Edge)

Azure DevOps, pull request, code review, PR comments, LLM, AI, ChatGPT, Copilot

## Single purpose (Chrome)

Copies the unresolved review comments from the Azure DevOps pull request the user is viewing to the clipboard, formatted as Markdown for use with an AI assistant.

## Permission justifications (Chrome)

- **activeTab:** Lets the extension read the URL of the Azure DevOps pull request the user is viewing, only when they click the extension icon. It needs this to know which pull request's comments to load.
- **scripting:** Runs a single request inside the user's Azure DevOps tab to fetch the pull request's comment threads, so the request uses the user's existing Azure DevOps session. No other code is injected, and nothing runs on any other page.
- **storage:** Saves the user's toggle preferences ("Hide reviewer names", "Hide my comments") and an optional display-name override, locally in the browser.
- **Remote code:** No. All code ships in the package.

## Data usage (Chrome privacy tab)

Data types handled: **Personally identifiable information** (reviewer display names) and **Personal communications** (comment text). Both are processed locally only and never transmitted. Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

## Privacy policy URL

https://iamshz97.github.io/ado-pr-comments-browser-extension/privacy.html

## Notes for reviewers (Edge "Notes for certification")

To test: sign in to any Azure DevOps organization, open a pull request that has review comments (https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}), then click the extension icon. The popup lists unresolved comments, and Copy places Markdown on the clipboard. On any other page the popup shows an "Open a pull request" message. No test account is needed beyond any Azure DevOps account.
