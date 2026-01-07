{ config, ... }:

{
  modules.home-manager = {
    programs.bash.bashrcExtra = ''
      # Required for GitHub API integration with third parties
      export GITHUB_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
      # Required for GitLab API integration with third parties
      export GITLAB_TOKEN="$(cat ${config.sops.secrets.gitlab_personal_access_token.path})"
      # Required for Jira CLI
      export JIRA_API_TOKEN="$(cat ${config.sops.secrets.jira_api_token.path})"
    '';

    programs.zsh.envExtra = ''
      # Required for GitHub API integration with third parties
      export GITHUB_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
      # Required for GitLab API integration with third parties
      export GITLAB_TOKEN="$(cat ${config.sops.secrets.gitlab_personal_access_token.path})"
      # Required for Jira CLI
      export JIRA_API_TOKEN="$(cat ${config.sops.secrets.jira_api_token.path})"
    '';

    programs.nushell.envFile.text = ''
      # Required for GitHub API integration with third parties
      $env.GITHUB_TOKEN = "${config.sops.secrets.github_personal_access_token.path}" | open
      # Required for GitLab API integration with third parties
      $env.GITLAB_TOKEN = "${config.sops.secrets.gitlab_personal_access_token.path}" | open
      # Required for Jira CLI
      $env.JIRA_API_TOKEN = "${config.sops.secrets.jira_api_token.path}" | open
    '';
  };
}
