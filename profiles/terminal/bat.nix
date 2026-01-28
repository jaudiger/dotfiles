{ ... }:

{
  modules = {
    home-manager = {
      programs.bat = {
        enable = true;

        config = {
          pager = "less -RFX";
          style = "plain";
        };
      };
    };

    host.shell.aliases = {
      cat = "bat";
    };
  };
}
