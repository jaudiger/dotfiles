{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.git = {
      enable = true;

      signing = {
        format = "openpgp";
        signByDefault = true;
        key = null; # GnuPG will decide what signing key to use depending on the commit’s author
      };

      settings = {
        advice = {
          detachedHead = false;
          forceDeleteBranch = false;
          mergeConflict = false;
        };

        alias = {
          branch-conflict = "!f() { \
            local_branch=$(git branch --show-current) && \
            merge_base=$(git merge-base $local_branch $1) && \
            base_to_local_diff=$(git diff --name-only $merge_base $local_branch) && \
            base_to_remote_diff=$(git diff --name-only $merge_base $1) && \
            conflict_files=$(comm -12 <(echo \"$base_to_local_diff\" | sort) <(echo \"$base_to_remote_diff\" | sort)) && \
            if [ -n \"$conflict_files\" ]; then \
              echo \"$conflict_files\"; \
            fi; \
          }; f";
          branch-rename = "!git branch -m $(git rev-parse --abbrev-ref HEAD) $2";
          branch-sync = "!f() { \
            git fetch \
            git for-each-ref --format \"%(refname:short) %(upstream:short)\" refs/heads | \
              while read -r local upstream; do \
                if [ -n \"$upstream\" ]; then \
                  if ! git show-ref --quiet \"refs/remotes/$upstream\"; then \
                    git branch -D \"$local\" \
                  fi \
                fi \
              done \
          }; f";
          graph = "log --decorate --oneline --graph";
          rebase-absorb = "absorb --and-rebase";
          tag-sync = "!git fetch --tags --prune-tags --force";
        };

        color."status" = {
          added = "green bold";
          changed = "red bold";
          deleted = "red bold strike";
          untracked = "cyan";
          branch = "yellow bold";
        };

        core = {
          editor = "hx";

          # Enable file system monitor to improve performance of git commands
          # FIXME: Check integration with Helm, see https://github.com/helm/helm/issues/12125
          fsmonitor = true;
          untrackedcache = true;
        };

        diff = {
          colormoved = "default";
          colormovedws = "allow-indentation-change";
        };

        fetch = {
          prune = true;
        };

        init = {
          defaultBranch = "main";
        };

        merge = {
          autoStash = true;
          conflictstyle = "diff3";

          mergiraf = {
            name = "mergiraf";
            driver = "mergiraf merge --git %O %A %B -s %S -x %X -y %Y -p %P -l %L";
          };
        };

        protocol = {
          version = 2;
        };

        pull = {
          rebase = false;
        };

        push = {
          autoSetupRemote = true;
        };

        rebase = {
          autoSquash = true;
          autoStash = true;
          rebaseMerges = true;
          updateRefs = true;
        };

        rerere = {
          enabled = true;
          autoupdate = true;
        };

        submodule = {
          recurse = true;
        };

        trailer = {
          sign = {
            key = "Signed-off-by: ";
            ifmissing = "add";
            ifexists = "doNothing";
            cmd = "echo \"$(git config user.name) <$(git config user.email)>\"";
          };
        };

        # Default user
        user = {
          email = "jeremy.audiger@icloud.com";
          name = "Jérémy Audiger";
        };

        # Redirect HTTPS to SSH
        url = {
          "git@github.com:".insteadOf = [ "https://github.com/" ];

          "git@gitlab.com:".insteadOf = [ "https://gitlab.com/" ];

          # Work GitLab instance
          "git@gitlab.trasna.services:".insteadOf = [ "https://gitlab.trasna.services:31443/" ];
        };
      };

      ignores = [
        ".cache"
        ".claude"
        ".devcontainer"
        ".devenv"
        ".DS_Store"
        ".gemini"
        ".gradle"
        ".idea"
        ".venv"
        ".vscode"
        ".zed"
        "build"
        "CLAUDE.md"
        "node_modules"
        "target"
        "__pycache__"
      ];

      includes = [
        {
          condition = "gitdir:${host.homeDirectory}/Development/git-repositories/IoTerop/";
          path = "${host.homeDirectory}/.config/git/work.config";
        }
      ];

      hooks = {
        commit-msg = ../../config/git/commit-msg;
        pre-push = ../../config/git/pre-push;
        prepare-commit-msg = ../../config/git/prepare-commit-msg;
      };
    };

    programs.gh = {
      enable = true;

      gitCredentialHelper = {
        enable = false;
      };
    };

    home = {
      file."gitAttributes" = {
        # This file is generated almost manually with 'mergiraf languages --gitattributes'
        source = ../../config/git/attributes;
        target = ".config/git/attributes";
      };

      file."gitWorkConfig" = {
        source = ../../config/git/work.config;
        target = ".config/git/work.config";
      };

      packages = with pkgs; [
        # 'glab config -g set check_update false' needs to be run after installation
        glab

        # Git plugins
        git-absorb
      ];
    };
  };
}
