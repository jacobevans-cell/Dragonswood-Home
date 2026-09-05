# Dragonswood Home

This repository is the family edition of Dragonswood. It preserves the existing
fantasy portal and learning systems while using a completely separate Firebase
project, account list, progress store, functions deployment, and website.

## Home setup status

The source snapshot has been copied successfully. Automatic publishing is paused
until the new Firebase Web app configuration is installed and the isolation audit
passes. Do not enable GitHub Pages or deploy Firebase while `.firebaserc` contains
`dragonswood-home-not-configured`.

After registering the new Firebase Web app, copy
`config/home-firebase.example.json` outside the repository, fill in the Web app
values, and run:

```text
npm run home:configure:firebase -- C:\path\to\home-firebase.json
npm run home:isolation:audit
```

The configuration command refuses to use the school Firebase project. Each child
must also have a Firebase Authentication account and a Firestore document at
`familyMembers/{uid}` containing `{"role":"child","active":true}`. Firestore
rules and Cloud Functions use that record to authorize child access.

The original school repository and Firebase project are not deployment targets
for this repository.

**Current build: v50.0 — Scribe Arena**

## New in v50
Dragonswood now includes a first working Scribe Arena / Quickwrite system.

### Student
- New **SCRIBE ARENA** navigation tab.
- Active teacher-launched Quickwrite prompt.
- Configurable timer, minimum word goal, and target writing skill.
- Autosaving drafts to Firestore.
- Permanent submitted writing.
- Local mechanics data: word count, sentence count, paragraph count, capitalization starts, ending punctuation.
- Optional AI feedback after submission.
- AI rubric: Ideas, Organization, Language/Style, Conventions, Target Skill.
- Grammar, punctuation, capitalization, and spelling percentages.
- Strength + one concrete next step.
- Writing Portfolio with average score and mechanics growth indicators.

### Teacher
- New **WRITING** command tab.
- Launch Quickwrite, Scribe Battle, or Writing Workshop sessions.
- Select writing type, target skill, timer, minimum words, prompt, and up to four hints.
- Live drafting/submission counts.
- View every saved response.
- View AI rubric feedback.
- Enter/override the official teacher score and teacher feedback.
- Close the active mission.

### AI architecture
Student browser never receives the OpenAI API key.

Student -> Firestore -> Firebase callable Cloud Function -> OpenAI -> structured rubric result -> Firestore.

The Cloud Function uses the OpenAI Responses API with Structured Outputs and the `OPENAI_API_KEY` Firebase secret.

### Firebase files included
- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `functions/package.json`
- `functions/index.js`

### Required deployment
This build **does require a Firebase update** because it adds writing collections and a Cloud Function.

From the project folder:
1. `firebase login`
2. `firebase functions:secrets:set OPENAI_API_KEY`
3. Paste the secret API key when prompted.
4. `firebase deploy --only firestore:rules,functions`

Do not put the OpenAI secret in GitHub or any HTML file.

### New Firestore collections
- `writingSessions`
- `writingResponses`
- `writingVotes` (reserved for the Scribe Battle voting phase)

## Current Scribe Arena scope
v50 establishes the complete Quickwrite storage, teacher workflow, AI grading, portfolio, and growth foundation. Anonymous peer duels/finalist voting can now be layered onto the `writingVotes` collection without changing the core response model.
