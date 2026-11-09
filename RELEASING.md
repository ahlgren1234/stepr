# Releasing

`"private": true` in `package.json` makes `npm publish` fail. It stays there until the publication approval in step 7.

## Checklist

1. **Name.** Choose the final name, then run `npm view <name>`; a 404 means it is unclaimed. Also run `npm search <name>` and do a basic trademark search.

   As of 2026-11-09 `guidely` is unclaimed, but two publishers use the name for similar products: `@guidelytech/*` (a product-tour and adoption platform) and `@sendsay-ru/guidely*` (a framework-agnostic onboarding library). Decide whether to keep the name or rename. A rename touches `package.json`, the docs, `demo/`, `scripts/verify-package.mjs` and the `--guidely-*` and `data-guidely-*` names in `src/`.

2. **Version.** Follow semantic versioning, and start at `0.1.0`. While on `0.x`, breaking changes bump the minor version; features and fixes bump the patch version. Move to `1.0.0` once the API is considered stable. Set the same version in `package.json` and `VERSION` in `src/index.ts`; a unit test checks that they match.

3. **Docs and repository.** Remove the pre-release notes from `README.md` and `demo/index.html`, and the local-build instructions from `README.md`. Make the repository public, because the package metadata, README and demo link to it.

4. **Build and package.** Run these on the release commit:

   ```bash
   pnpm install --frozen-lockfile
   pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:package
   npm pack --dry-run
   ```

   The tarball must contain only `LICENSE`, `README.md`, `package.json` and `dist/` (`.js` and `.d.ts`), with the expected name and version. Then install the real artifact outside the repository:

   ```bash
   pnpm pack --pack-destination "$(mktemp -d)" # note the printed path
   cd "$(mktemp -d)" && npm init -y && npm install <path-to-tgz>
   node --input-type=module -e "import('guidely').then((m) => console.log(m.VERSION, Object.keys(m)))"
   ```

5. **CI and GitGuardian.** Both checks must be green on the release commit on `main`.

6. **Manual tests.** Complete the [smoke test](#manual-smoke-test), including the NVDA test, which automated checks don't cover. Record the NVDA, browser and Windows versions in the release pull request.

7. **Publication approval.** The maintainer must explicitly approve the exact package name and version in the release pull request. Green checks are not approval. Only after approval:

   ```bash
   # After removing "private": true in the approved release commit:
   npm login
   npm publish --dry-run
   npm publish
   git tag vX.Y.Z && git push origin vX.Y.Z
   ```

8. **After publishing.** Install the package from npm in a new project and run the [quick start](README.md#quick-start). Deploying the demo site needs its own approval.

## Manual smoke test

Run `pnpm build && pnpm dlx serve .` and open `/demo/smoke.html` in one current browser. Use only the keyboard from step 1 to 6.

1. Tab to **Start tour** and press Enter. The first step appears and Next has a focus ring.
2. Press Shift+Tab repeatedly until focus reaches a page button, then Tab back to Next. Focus leaves the tooltip and returns, the tour stays open, and Back is skipped on the first step.
3. Press Enter on Next until the nested card. Each target is highlighted, the tooltip is readable, and focus stays on Next. The last step reads Done.
4. Press Shift+Tab to Back and press Enter until the first step. When Back becomes disabled, focus moves to Next.
5. Press Escape. The tour disappears, the page shows `onExit called`, and focus is back on **Start tour**.
6. Start again and press Enter through to Done. The page shows `onComplete called`, and focus is back on **Start tour**.
7. Emulate reduced motion (in Chrome DevTools: Rendering > Emulate CSS media feature `prefers-reduced-motion`), reload and start the tour. Moving between steps jumps instantly instead of scrolling smoothly.
8. **Required before release:** with NVDA, start the tour. It announces the dialog with the title, step position and description, and each button by name. Pressing Next announces the new step.
