# /release - Release Workflow

Manage releases for Echo PDK packages.

## Usage

```
/release patch     # Bump patch version (0.1.0 -> 0.1.1)
/release minor     # Bump minor version (0.1.0 -> 0.2.0)
/release major     # Bump major version (0.1.0 -> 1.0.0)
/release --dry-run # Preview without making changes
```

## Implementation

### Pre-Release Checks

1. **Ensure clean working directory**:
   ```bash
   git status --porcelain
   ```

2. **Run tests**:
   ```bash
   pnpm test
   ```

3. **Run linting and type check**:
   ```bash
   pnpm lint && pnpm typecheck
   ```

4. **Build all packages**:
   ```bash
   pnpm build
   ```

### Version Bump

1. **Update version in all package.json files**:
   - `package.json` (root)
   - `packages/core/package.json`
   - `packages/cli/package.json`
   - `packages/language/package.json`

2. **Keep versions in sync** across all packages.

### Changelog

1. **Generate changelog entry** based on commits since last release:
   ```bash
   git log $(git describe --tags --abbrev=0)..HEAD --oneline
   ```

2. **Group changes** by type:
   - Features (feat)
   - Bug Fixes (fix)
   - Documentation (docs)
   - Other

3. **Update CHANGELOG.md** with new section.

### Git Operations

1. **Stage changes**:
   ```bash
   git add .
   ```

2. **Create release commit**:
   ```bash
   git commit -m "chore: release v{VERSION}"
   ```

3. **Create git tag**:
   ```bash
   git tag v{VERSION}
   ```

### Publish (Optional)

Only if user confirms:

1. **Push to remote**:
   ```bash
   git push && git push --tags
   ```

2. **Publish to npm**:
   ```bash
   pnpm publish --access public --filter "@echo-pdk/*"
   ```

## Dry Run

With `--dry-run`, show what would happen without making changes:
- List files that would be modified
- Show new version numbers
- Preview changelog entry
- Show git commands that would run

## Rollback

If release fails, provide rollback instructions:
```bash
git tag -d v{VERSION}
git reset --hard HEAD~1
```
