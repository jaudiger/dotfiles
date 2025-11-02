{ ... }:

{
  modules.home-manager = {
    programs.jujutsu = {
      enable = true;

      settings = {
        user = {
          name = "Jérémy Audiger";
          email = "jeremy.audiger@icloud.com"; # Default email
        };

        signing = {
          "sign-on-push" = true;
          backend = "gpg";
          # Don't set the key, GnuPG will decide what signing key to use depending on the commit’s author
        };

        git = {
          push-new-bookmarks = true;
          subprocess = true;
        };

        ui = {
          default-command = "log-recent";
          editor = "hx";
        };

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

        revset-aliases = {
          "recent()" = "committer_date(after:\"3 months ago\")";
        };

        template-aliases = {
          "format_short_change_id(id)" = "id.shortest()";
        };

        core = {
          fsmonitor = "watchman";
        };
      };
    };
  };
}
