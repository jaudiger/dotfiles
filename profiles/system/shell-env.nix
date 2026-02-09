{ config, ... }:

{
  modules.home-manager = {
    programs.bash.bashrcExtra = ''
      # Required for GitLab API integration with third parties
      export GITLAB_TOKEN="$(cat ${config.sops.secrets.gitlab_personal_access_token.path})"
    '';

    programs.zsh.envExtra = ''
      # Required for GitLab API integration with third parties
      export GITLAB_TOKEN="$(cat ${config.sops.secrets.gitlab_personal_access_token.path})"
    '';

    programs.nushell.envFile.text = ''
      # Required for GitLab API integration with third parties
      $env.GITLAB_TOKEN = "${config.sops.secrets.gitlab_personal_access_token.path}" | open
    '';
  };
}
