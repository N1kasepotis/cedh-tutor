# Project delivery workflow

The owner has requested that completed, validated changes also be pushed to GitHub. Carry this preference forward unless the owner explicitly requests local-only work.

- The WeChat DevTools project on the owner's current Windows device is `C:\Users\Yukai\OneDrive - University of Maryland\Documents\xcx`. Import the repository root containing `project.config.json`, not `miniprogram/`.
- An isolated worktree and a browser preview do not update that DevTools project. Before calling delivery complete, inspect both working trees, integrate the validated changes into the DevTools checkout without overwriting unrelated edits, and push `origin/main`. Prefer a fast-forward; inspect and resolve divergence without force-pushing.
- Run the relevant checks documented in README.md. Verify the actual remote commit after pushing and inspect the GitHub checks. Report failures explicitly.
- When asked to update the developer demo or upload a development version, use the official WeChat DevTools upload command against the synchronized project root. Record its version, source commit, and success response separately from the GitHub push. A local compile, browser screenshot, or Git push is not proof of a WeChat upload.
- Do not infer authorization to submit WeChat review or publish a production release from a development upload request.
- Update README.md for workflow or product changes. End with the source commit, synchronization/upload results, validation, and any remaining device checks. Keep login credentials, upload keys, and local CLI output out of Git.
