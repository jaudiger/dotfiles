{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home.packages = with pkgs; [ github-copilot-cli ];
    };

    host.shell.aliases = {
      copilot = "github-copilot-cli";
    };
  };
}
