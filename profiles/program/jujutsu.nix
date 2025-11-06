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
          i = [
            "git"
            "init"
            "--colocate"
          ];
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
          push = [
            "git"
            "push"
            "--allow-new"
          ];
          r = [ "rebase" ];
          s = [ "squash" ];
          si = [
            "squash"
            "--interactive"
          ];
        };

        core = {
          fsmonitor = "watchman";
        };

        git = {
          push-new-bookmarks = true;
          subprocess = true;
        };

        revset-aliases = {
          "recent()" = "committer_date(after:\"3 months ago\")";
        };

        signing = {
          backend = "gpg";
          "sign-on-push" = true;
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
