{ config, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.bash = {
      enable = true;

      historyFile = "${host.homeDirectory}/.cache/bash_history";
      historySize = 8192;
      historyFileSize = 8192;
    };
  };
}
