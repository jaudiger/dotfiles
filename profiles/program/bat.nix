{ ... }:

{
  modules = {
    home-manager = {
      programs.bat = {
        enable = true;

        config = {
          pager = "less -RFX";
          style = "numbers,changes,header";
        };
      };
    };

    host.shell.aliases = {
      cat = "bat";
    };
  };
}
