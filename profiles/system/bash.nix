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

      bashrcExtra = ''
        export PATH=$HOME/Development/git-repositories/jaudiger/personal-scripts:$HOME/Development/work-scripts:$HOME/Development/work-scripts/alaska:$HOME/Development/git-repositories/jaudiger/vscode-dev-containers:$PATH
      '';
    };
  };
}
