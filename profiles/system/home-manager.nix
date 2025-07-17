{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    home = {
      username = host.username;

      shellAliases = host.shell.aliases;
      sessionVariables = host.shell.sessionVariables;

      # Default package to always install
      packages = with pkgs; [
        gnupatch
        jq
      ];

      stateVersion = "25.05";
    };

    programs = {
      home-manager.enable = true;

      bash.shellAliases = host.shell.nonPortableAliases;
      zsh.shellAliases = host.shell.nonPortableAliases;
    };
  };
}
