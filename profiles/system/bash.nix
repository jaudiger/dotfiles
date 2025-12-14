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
        # Required for GitHub API integration with third parties
        export GITHUB_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
        # Required for GitLab API integration with third parties
        export GITLAB_TOKEN="$(cat ${config.sops.secrets.gitlab_personal_access_token.path})"
        # Required for Jira CLI
        export JIRA_API_TOKEN="$(cat ${config.sops.secrets.jira_api_token.path})"
      '';
    };
  };
}
