{ ... }:

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

          git = {
            paging = {
              pager = "less -RFX";
            };
          };
        };
      };
    };

    host.shell.aliases = {
      lg = "lazygit";
    };
  };
}
