{ pkgs, ... }:

{
  modules.home-manager = {
    programs.jujutsu = {
      enable = true;

      settings = {
        aliases = {
          c = [ "commit" ];
          ci = [
            "commit"
            "--interactive"
          ];
          e = [ "edit" ];
          log-recent = [
            "log"
            "-r"
            "default() & recent()"
          ];
          nb = [
            "bookmark"
            "create"
            "-r @-"
          ];
          pull = [
            "git"
            "fetch"
          ];
          r = [ "rebase" ];
          s = [ "squash" ];
          si = [
            "squash"
            "--interactive"
          ];
        };

        fsmonitor = {
          backend = "watchman";
        };

        git = {
          push-new-bookmarks = true;
          sign-on-push = true;
        };

        revset-aliases = {
          "recent()" = "committer_date(after:\"3 months ago\")";
        };

        signing = {
          backend = "gpg";
          # Don't set the key, GnuPG will decide what signing key to use depending on the commit’s author
        };

        template-aliases = {
          "format_short_change_id(id)" = "id.shortest()";
        };

        ui = {
          default-command = "log-recent";
          editor = "hx";
        };

        # Default user
        user = {
          email = "jeremy.audiger@icloud.com";
          name = "Jérémy Audiger";
        };
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
