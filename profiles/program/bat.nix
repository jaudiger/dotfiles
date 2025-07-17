{ ... }:

{
  modules = {
    home-manager = {
      programs.bat = {
        enable = true;

        config = {
          pager = "less -RF";
          style = "numbers,changes,header";
        };
      };
    };

    host.shell.aliases = {
      cat = "bat";
    };
  };
}
