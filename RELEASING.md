# Releasing

Nothing publishes automatically: no workflow runs `npm publish` or holds an npm token. Merging to `main` doesn't publish. Publishing is a manual command that needs the maintainer's explicit approval in step 6.

## v0.1.0 status

Manual results are as reported by the maintainer. Browser, NVDA and Windows versions and test dates weren't recorded.

| Gate                                           | Status                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Repository public                              | Done                                                                                                   |
| GitHub Pages deployment                        | Done: [live demo](https://ahlgren1234.github.io/stepr/), deployed from `6a7cdb8` before this candidate |
| Interactive demo on the live site              | Passed (maintainer-reported)                                                                           |
| [Manual smoke test](#manual-smoke-test)        | Passed (maintainer-reported)                                                                           |
| [NVDA test on Windows](#nvda-test-on-windows)  | Passed (maintainer-reported)                                                                           |
| USPTO and EUIPO trademark searches             | Open                                                                                                   |
| `npm view stepr` immediately before publishing | Open                                                                                                   |
| npm login                                      | Open                                                                                                   |
| Publication approval                           | Open                                                                                                   |
| Publish, tag and redeploy the demo             | Open                                                                                                   |

## Checklist

Work through these steps in order.

1. **Name.** The package is named `stepr`. Immediately before publishing, run `npm view stepr`; a 404 means it is still unclaimed. Nothing reserves the name until it is published. Also run `npm search stepr`, and search for `STEPR` in the [USPTO](https://tmsearch.uspto.gov/) and [EUIPO](https://euipo.europa.eu/eSearch/) trademark registers.

2. **Version.** Follow semantic versioning. The first release is `0.1.0`. While on `0.x`, breaking changes bump the minor version; features and fixes bump the patch version. Move to `1.0.0` once the API is considered stable. Set the same version in `package.json` and `VERSION` in `src/index.ts`; a unit test checks that they match.

3. **Repository.** The repository must stay public, because the package metadata, README and demo link to it.

4. **Build and package.** Run these on the release candidate:

   ```bash
   pnpm install --frozen-lockfile
   pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:package
   npm pack --dry-run
   ```

   The tarball must contain only `LICENSE`, `README.md`, `package.json` and `dist/` (`.js` and `.d.ts`), with the expected name and version. Then install the real artifact outside the repository:

   ```bash
   pnpm pack --pack-destination "$(mktemp -d)" # note the printed path
   cd "$(mktemp -d)" && npm init -y && npm install <path-to-tgz>
   node --input-type=module -e "import('stepr').then((m) => console.log(m.VERSION, Object.keys(m)))"
   ```

5. **Manual tests.** Complete the [smoke test](#manual-smoke-test) and the [NVDA test](#nvda-test-on-windows), which automated checks don't cover. Copy the [results](#results-to-record) into the release pull request.

6. **Publication approval.** The maintainer must explicitly approve the exact package name and version in the release pull request. Green checks are not approval.

7. **Release commit.** CI and GitGuardian must both be green on the release pull request. The README ships in the tarball, so it must be correct before publishing. Merge the pull request only when you are ready to publish straight away, because `main` then tells people to run `npm install stepr`.

8. **Publish.** Publish from a clean checkout of that commit on `main`. Tag only after publishing succeeds, so that a failed publish leaves no tag.

   ```bash
   git switch main && git pull --ff-only && git status
   pnpm install --frozen-lockfile
   npm login
   npm whoami
   npm view stepr # first release only: must still return a 404
   npm publish --dry-run
   npm publish
   git tag v0.1.0 && git push origin v0.1.0
   ```

   npm doesn't allow a published version number to be reused, so a mistake needs a new version.

9. **After publishing.** Install the package from npm in a new project and run the [quick start](README.md#quick-start). The live demo shows the version it was last deployed with, so [deploy it again](#deploying-the-demo) to show the install command. That needs its own approval.

## Deploying the demo

`.github/workflows/pages.yml` deploys `demo/index.html` and the library to GitHub Pages. `pnpm build:pages` assembles the site in `_site/`, moving the page to the site root and pointing its import at `./dist/index.js`, so it works under any subpath. The workflow only runs when started by hand, so merging to `main` never deploys. Each deployment needs its own approval.

The site is public, whoever can see the repository. On GitHub Free, Pages isn't available for private repositories, so complete step 3 first. The URL is `https://ahlgren1234.github.io/stepr/`.

1. Set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**, or run:

   ```bash
   gh api -X POST repos/ahlgren1234/stepr/pages -f build_type=workflow
   ```

   GitHub creates the `github-pages` environment, which by default only accepts deployments from the default branch. The workflow requests the `pages: write` and `id-token: write` permissions itself, so no secrets are needed.

2. Start the deployment and wait for it:

   ```bash
   gh workflow run pages.yml --ref main
   gh run watch # choose the "Deploy demo" run
   ```

3. Open the URL and check that the tour, spotlight, tooltip, keyboard controls and theme switcher work, with no errors in the browser console.

To take the site down, run `gh api -X DELETE repos/ahlgren1234/stepr/pages`.

To preview the site locally under a subpath:

```bash
pnpm build:pages
mkdir -p .preview && rm -rf .preview/stepr && cp -r _site .preview/stepr
pnpm dlx serve .preview # open /stepr/
rm -rf .preview
```

## Manual smoke test

Run `pnpm build && pnpm dlx serve .` and open `/demo/smoke.html` in one current browser. Use only the keyboard from step 1 to 6.

1. Tab to **Start tour** and press Enter. The first step appears and Next has a focus ring.
2. Press Shift+Tab repeatedly until focus reaches a page button, then Tab back to Next. Focus leaves the tooltip and returns, the tour stays open, and Back is skipped on the first step.
3. Press Enter on Next until the nested card. Each target is highlighted, the tooltip is readable, and focus stays on Next. The last step reads Done.
4. Press Shift+Tab to Back and press Enter until the first step. When Back becomes disabled, focus moves to Next.
5. Press Escape. The tour disappears, the page shows `onExit called`, and focus is back on **Start tour**.
6. Start again and press Enter through to Done. The page shows `onComplete called`, and focus is back on **Start tour**.
7. Emulate reduced motion (in Chrome DevTools: Rendering > Emulate CSS media feature `prefers-reduced-motion`), reload and start the tour. Moving between steps jumps instantly instead of scrolling smoothly.

## NVDA test on Windows

This test is required before release, and needs a real Windows machine with NVDA. Automated checks can't confirm what a screen reader says.

**Setup**

1. Install the current [NVDA](https://www.nvaccess.org/download/) and use a current version of Chrome, Edge or Firefox.
2. Run `pnpm build && pnpm dlx serve .` and open the printed local address with `/demo/smoke.html` added, in the Windows browser. If you build in WSL, run the command there; the Windows browser can normally reach it through `localhost`.
3. Start NVDA and open **NVDA menu > Tools > Speech Viewer**, which shows everything NVDA says as text you can copy.
4. Close other tabs that might speak, and use only the keyboard.

**Steps**

The wording and order of NVDA's speech vary by browser and version. A step passes if the listed information is spoken, and fails if any of it is missing, wrong or spoken for a step that isn't showing.

| #   | Do this                                     | NVDA must convey                                                                                   |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Tab to **Start tour** and press Enter       | A dialog named "First card: Step 1 of 3", the description "Selector target.", and the Next button  |
| 2   | Press Enter on Next                         | "Second card: Step 2 of 3. Element target, scrolled into view." Focus stays on Next                |
| 3   | Press Enter on Next                         | "Nested card: Step 3 of 3. Inside a nested scroller." "Never shown" is never spoken                |
| 4   | Press NVDA+Tab to read the focused button   | The button is named "Done"                                                                         |
| 5   | Press Shift+Tab, then Enter on Back         | The "Back" button on the way, then "Second card: Step 2 of 3. Element target, scrolled into view." |
| 6   | Press Tab twice                             | The "Next" button, then the "Close" button                                                         |
| 7   | Press Escape                                | Focus returns to the "Start tour" button, which is spoken. The page shows `onExit called`          |
| 8   | Start again and press Enter through to Done | Each step is spoken as above. Focus returns to "Start tour". The page shows `onComplete called`    |

NVDA may switch between browse and focus mode when the dialog opens. If a key is swallowed, press NVDA+Space to change mode, and record that it happened.

## Results to record

Copy this into the release pull request and fill it in with what actually happened. A failure blocks the release until it is fixed or the maintainer accepts it as a known limitation in the README.

```markdown
**Smoke test** (date, browser and version, OS):

- [ ] Steps 1–7 passed. Notes:

**NVDA test** (date, NVDA version, browser and version, Windows version):

- [ ] Steps 1–8 passed. Notes:
- Speech Viewer output for steps 1–3:
```
