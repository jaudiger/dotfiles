{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home.packages = with pkgs; [ gh-copilot ];
    };

    host.shell.aliases = {
      copilot = "gh-copilot";
    };
  };
}
