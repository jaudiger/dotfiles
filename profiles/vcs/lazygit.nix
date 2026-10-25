_:

{
  modules = {
    home-manager = {
      programs.lazygit = {
        enable = true;

        settings = {
          disableStartupPopups = true;

          gui = {
            showRandomTip = false;
            showCommandLog = false;
            nerdFontsVersion = 3;
          };

          git.diffRenderers = [
            {
              type = "stdinFilter";
              name = "delta";
              command = "delta --{{colorScheme}} --paging=never --line-numbers --hyperlinks --hyperlinks-file-link-format=\"lazygit-edit://{path}:{line}\" {{if gt .width 160}}--side-by-side{{end}}";
            }
            {
              type = "rawGit";
              name = "Git";
            }
          ];
        };
      };
    };

    host.shell.aliases = {
      lg = "lazygit";
    };
  };
}
