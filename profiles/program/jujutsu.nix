{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.jujutsu = {
      enable = true;

      settings = {
        aliases = {
          new-bookmark = [
            "bookmark"
            "create"
            "-r @-"
          ];
          move-bookmark = [
            "bookmark"
            "move"
            "--from"
            "\"heads(::@ & bookmarks())\""
            "--to"
            "\"closest_pushable(@)\""
          ];
          pull = [
            "git"
            "fetch"
          ];
        };

        diff = {
          git = {
            context = 4;
          };
        };

        fsmonitor = {
          backend = "watchman";
        };

        git = {
          auto-local-bookmark = true;
          push-new-bookmarks = true;
          sign-on-push = true;
        };

        merge = {
          hunk-level = "line";
        };

        merge-tools = {
          mergiraf = {
            program = "mergiraf";
            merge-conflict-exit-codes = [ 1 ];
            merge-args = [
              "merge"
              "$base"
              "$left"
              "$right"
              "-o"
              "$output"
            ];
          };
        };

        revset-aliases = {
          "closest_pushable(to)" =
            "heads(::to & mutable() & ~description(exact:\"\") & (~empty() | merges()))";
        };

        signing = {
          backend = "gpg";
          # Don't set the key, GnuPG will decide what signing key to use depending on the commit’s author
        };

        template-aliases = {
          "format_short_change_id(id)" = "id.shortest()";
          "format_timestamp(timestamp)" = "timestamp.ago()";
        };

        ui = {
          conflict-marker-style = "git";
          default-command = "status";
          editor = "hx";
          merge-editor = "mergiraf";
        };

        # Default user
        user = {
          email = "jeremy.audiger@icloud.com";
          name = "Jérémy Audiger";
        };

        "--scope" = [
          {
            "--when" = {
              repositories = [ "${host.homeDirectory}/Development/git-repositories/IoTerop" ];
            };
            user = {
              email = "jeremy.audiger@trasna.io";
            };
          }
        ];
      };
    };

    home = {
      packages = with pkgs; [
        # To monitor file changes
        watchman
      ];
    };
  };
}
