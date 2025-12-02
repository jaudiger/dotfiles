{ ... }:

{
  modules = {
    home-manager = {
      programs.claude-code = {
        enable = true;

        settings = {
          defaultMode = "acceptEdits";
          includeCoAuthoredBy = false;

          permissions = {
            allow = [
              "Bash(cat:*)"
              "Bash(cd:*)"
              "Bash(find:*)"
              "Bash(gh pr view:*)"
              "Bash(gh issue view:*)"
              "Bash(gh repo view:*)"
              "Bash(gh run view:*)"
              "Bash(git diff:*)"
              "Bash(git log:*)"
              "Bash(git show:*)"
              "Bash(git status:*)"
              "Bash(glab mr view:*)"
              "Bash(glab issue view:*)"
              "Bash(glab repo view:*)"
              "Bash(glab ci view:*)"
              "Bash(grep:*)"
              "Bash(head:*)"
              "Bash(ls:*)"
              "Bash(pwd:*)"
              "Bash(sort:*)"
              "Bash(tail:*)"
              "Bash(uniq:*)"
              "Glob"
              "Grep"
              "Read"
              "WebFetch"
              "WebSearch"
            ];
            deny = [
              "Read(.env)"
              "Read(.env.*)"
              "Read(.envrc)"
              "Read(secrets/**)"
            ];
          };
        };
      };
    };
  };
}
