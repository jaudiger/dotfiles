# NOTE: Claude desktop app is only available on macOS
{
  config,
  lib,
  ...
}:

let
  host = config.modules.host;
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "claude" ];
  };

  nixpkgs.config.allowUnfreePackages = [ "claude-code" ];

  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        skills = {
          code-audit = ../../config/claude-code/skills/code-audit;
          code-review = ../../config/claude-code/skills/code-review;
          code-security = ../../config/claude-code/skills/code-security;
          code-test = ../../config/claude-code/skills/code-test;
          deep-resolve = ../../config/claude-code/skills/deep-resolve;
          deep-review = ../../config/claude-code/skills/deep-review;
          lang-zig = ../../config/claude-code/skills/lang-zig;
          meta-learn = ''
            ---
            name: meta-learn
            description: Review the current session for skill/project-config gaps and stale patterns, then update the relevant files.
            allowed-tools: Read, Grep, Glob, Edit, Write
            ---

            # Self-Improve

            Review what was accomplished in this session. Identify any patterns, methodologies, or language-specific knowledge that were used but are not currently captured in:

            **Global skills** live under `${host.dotfilesDirectory}/config/claude-code/skills/`. Glob that directory to enumerate the currently installed skills, then read each `SKILL.md` to understand its scope before identifying gaps.

            **Project-level Claude files** (in the current working repository):

            - `CLAUDE.md` at the repo root
            - `.claude/settings.json`
            - `.claude/commands/`
            - `.claude/rules/`
            - `.claude/agents/`

            ## Phase 1: Gap detection

            For each gap found:

            1. State which file should be updated and why
            2. Show the proposed addition
            3. Apply the edit after confirmation

            When adding a new concern/aspect/domain to a skill, update both the SKILL.md coverage matrix and create the corresponding sub-file.

            ## Phase 2: Staleness detection

            Read through all skill files and project Claude files that were relevant to this session. Flag any content that is out of date:

            - Deprecated API patterns, removed functions, renamed tools
            - Language version assumptions that no longer hold
            - References to files, modules, or dependencies absent from the repo
            - Checklist items now redundant with modern compiler/linter defaults

            For each stale item:

            1. Quote the outdated content
            2. Explain why it is stale
            3. Propose the updated replacement
            4. Apply the edit after confirmation

            If any out-of-date content is detected, suggest concrete modifications to update it, even if the current task did not require that knowledge. Do not silently ignore stale guidance.

            If no gaps or stale content are found, say so explicitly.
          '';
        };

        rules = {
          ascii-only = ''
            # ASCII-only output

            Use only ASCII characters in all generated text.

            ## Banned characters

            Never produce any of these Unicode characters:

            - Em dash (U+2014), en dash (U+2013)
            - Curly/smart quotes (U+2018, U+2019, U+201C, U+201D)
            - Horizontal ellipsis (U+2026)
            - Unicode arrows (U+2190 through U+2194)
            - Bullet (U+2022)
            - Non-breaking space (U+00A0)

            ## Style guidance

            Do not use `--` or `->` in prose. Reserve `--` for CLI flags and `->` for code and type signatures. Rephrase with commas, parentheses, or separate sentences.

            ## Exceptions

            Permitted when preserving existing non-ASCII content, in string literals that require Unicode, or in names that naturally contain non-ASCII characters.
          '';
          comment-banned-patterns = ''
            # Banned patterns in code comments

            NEVER use any of the following in code comments.

            ## No numbered sequences

            Do not use `1.`, `2.`, `Step 1`, `Phase 1`, or any numbered/lettered enumeration.

            ## No section banners

            Do not use `// -- SECTION --`, `// === SECTION ===`, `// --- SECTION ---`, `/* ======= */`, or any decorative separator line.

            ## No lists

            Do not use bullet, numbered, or dash-separated lists. Fold the information into flowing prose sentences instead.

            ## No concrete examples

            Do not illustrate with concrete values. Avoid "e.g.", "for example", "such as", "like", and bare parenthetical values. Describe behavior abstractly. If a concrete value is essential for understanding, put it in a test.
          '';
          comment-style = ''
            # Human-sounding code comments

            Write comments that read like a human developer wrote them.

            ## Brevity

            - Inside function bodies, keep comments to one short sentence or a few words.
            - Doc comments may be longer, but still concise and direct.
            - Never restate what the code already says.

            ## Tone

            - Write plain, direct English as if leaving a note for a colleague.
            - Avoid formal phrasing ("It should be noted that...", "This function is responsible for...").
            - Avoid hedging ("This might be needed because..."). State the fact or remove the comment.
          '';
          test-style = ''
            # Testing practices

            ## Extend before create

            Add assertions to an existing test when the setup and action match. Only create a new test for a genuinely different scenario.

            ## One concept per test

            Each test verifies one logical behavior. Multiple assertions are fine when they all check facets of the same behavior.

            ## Keep tests minimal

            - Only arrange what the test actually needs.
            - No logic in tests: no conditionals or branching. Loops are acceptable for table-driven / parameterized tests.
            - No helper abstractions for a single test. Inline the setup.
            - Prefer literal values over computed ones so expected results are obvious at a glance.
          '';
        };

        settings = {
          alwaysThinkingEnabled = true;
          attribution = {
            commit = "";
            pr = "";
          };
          autoDreamEnabled = true;
          defaultMode = "acceptEdits";
          env = {
            CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY = 1;
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
            CLAUDE_CODE_ENABLE_AWAY_SUMMARY = 0;
            CLAUDE_CODE_HIDE_ACCOUNT_INFO = 1;
            FORCE_AUTOUPDATE_PLUGINS = 1;
          };
          hooks = {
            PreToolUse = [
              {
                matcher = "Bash";
                hooks = [
                  {
                    type = "command";
                    command = "nu --stdin ${host.homeDirectory}/.claude/hooks/auto-approve-readonly/mod.nu";
                  }
                ];
              }
            ];
          };
          permissions = {
            allow = [
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Edit(.env*)"
              "Read(.env*)"
              "Write(.env*)"
            ];
          };
          preferredNotifChannel = "terminal_bell";
          showTurnDuration = false;
          spinnerTipsEnabled = false;
          statusLine = {
            type = "command";
            command = "${host.homeDirectory}/.claude/scripts/status-line";
            padding = 0;
          };
        };
      };

      home = {
        file."claudeCodeHooks" = {
          source = ../../config/claude-code/hooks;
          target = ".claude/hooks";
        };
        file."claudeCodeStatusLine" = {
          source = ../../config/claude-code/status-line;
          target = ".claude/scripts/status-line";
        };
      };
    };
  };
}
