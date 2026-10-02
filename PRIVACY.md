# Privacy Policy — Copy Azure DevOps PR Comments for LLM

_Last updated: 2 October 2026_

This extension does not collect, store, sell or transmit any personal data.

## What the extension accesses

When you click the extension on an Azure DevOps pull request page, it reads:

- the pull request's comment threads and title, from the Azure DevOps REST API
- your Azure DevOps display name and user ID (`_apis/connectionData`), so it can tell your comments apart from reviewers' comments

These requests are made from the Azure DevOps tab you are viewing, using your existing Azure DevOps session. They go only to the Azure DevOps organization you are already signed in to.

## What happens to that data

- It is processed entirely inside your browser to build the summary shown in the popup.
- It is copied to your clipboard only when you click **Copy**.
- It is never sent to the developer or to any third party, and there are no analytics or tracking.
- It is discarded when the popup closes.

## What is stored

Only your preferences, saved in your browser's extension storage (`chrome.storage.local`): the state of the "Hide reviewer names" and "Hide my comments" toggles, and a display name, if you enter one by hand. This data never leaves your device. Removing the extension deletes it.

## Permissions

- `activeTab`: read the pull request you are viewing, only when you click the extension.
- `scripting`: run the comment request inside that tab so it uses your existing sign-in.
- `storage`: remember your preferences.

## Contact

Questions: <YOUR CONTACT EMAIL>
