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

        # Required for GitHub MCP server
        export GITHUB_PERSONAL_ACCESS_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
        # Required for Jira CLI
        export JIRA_API_TOKEN="$(cat ${config.sops.secrets.jira_api_token.path})"
      '';
    };
  };
}
