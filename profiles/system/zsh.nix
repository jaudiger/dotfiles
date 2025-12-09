{
  pkgs,
  config,
  lib,
  ...
}:

let
  isDarwin = pkgs.stdenv.isDarwin;
  host = config.modules.host;
in
{
  # This program comes from nix-darwin
  programs.zsh = lib.mkIf isDarwin {
    enable = true;
  };

  modules.home-manager = {
    programs.zsh = {
      enable = true;

      history = {
        path = "${host.homeDirectory}/.cache/zsh_history";
        size = 8192;
        save = 8192;
        extended = true; # Save timestamps

        # Ignore parameters
        ignorePatterns = [
          "ls*"
          "cd*"
          "pwd*"
          "rm*"
        ];
        ignoreDups = true;
        ignoreAllDups = true;
        saveNoDups = true;
        findNoDups = true;
        ignoreSpace = true;
      };

      autosuggestion = {
        enable = true;
      };

      syntaxHighlighting = {
        enable = true;
        package = pkgs.zsh-syntax-highlighting;
      };

      envExtra = ''
        export PATH=${host.homeDirectory}/Development/git-repositories/jaudiger/personal-scripts:${host.homeDirectory}/Development/work-scripts:${host.homeDirectory}/Development/work-scripts/alaska:${host.homeDirectory}/Development/git-repositories/jaudiger/vscode-dev-containers:$PATH

        # Required for GitHub MCP server
        export GITHUB_PERSONAL_ACCESS_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
        # Required for Jira CLI
        export JIRA_API_TOKEN="$(cat ${config.sops.secrets.jira_api_token.path})"
      '';
    };
  };
}
