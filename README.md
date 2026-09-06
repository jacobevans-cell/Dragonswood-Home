# Dragonswood Home

This repository is the family edition of Dragonswood. It preserves the existing
fantasy portal and learning systems while using a completely separate Firebase
project, account list, progress store, functions deployment, and website.

## Home setup status

The source snapshot and the separate Dragonswood Home Firebase Web configuration
are installed. Automatic publishing remains paused until Authentication,
Firestore, and the visual-login Cloud Functions are enabled and verified. The
isolation audit prevents this repository from pointing at the school project.

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

## Child-friendly picture sign-in

The Home portal includes a three-tap child flow:

1. Tap the child's profile picture.
2. Tap the child's secret color.
3. Tap the child's secret animal.

The color and animal are verified by a Firebase Cloud Function. Their raw values
are never stored in the public source code or sent back when profiles are listed.
Only a salted `scrypt` hash is stored in the locked `homeVisualLogins`
collection. Five unsuccessful attempts trigger a ten-minute pause. The parent
keeps a normal Google sign-in and can create or reset both child profiles at
`home-parent-setup.html`.

After installing the Home Firebase configuration:

1. In Firebase Authentication, enable the Google provider.
2. Deploy only the Home rules with
   `firebase deploy --config firebase.v33-release.json --only firestore:rules`.
3. Deploy only the three visual-login functions with
   `firebase deploy --config firebase.academic-ai.json --only functions:academic-ai:listHomeVisualProfiles,functions:academic-ai:homeVisualSignIn,functions:academic-ai:configureHomeVisualProfile`.
4. Open `home-parent-setup.html` from the Home website and sign in with
   `jacobicusjax@gmail.com`.
5. Set each preferred name, profile picture, school grade, secret color, and
   secret animal. The function creates the child-only Firebase accounts and the
   required `familyMembers` records automatically.

Run `npm run home:visual-auth:test` to verify the visual-secret hashing contract.

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
