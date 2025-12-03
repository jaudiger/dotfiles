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

        # Required for MCP servers setup
        export GITHUB_PERSONAL_ACCESS_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
      '';
    };
  };

  sops = {
    # To edit the secret: "nix-shell -p sops --run 'sops secrets/github/credentials.yaml'"
    secrets = {
      github_personal_access_token = {
        sopsFile = ../../secrets/github/credentials.yaml;

        owner = host.username;
        mode = "0400";
      };
    };
  };
}
