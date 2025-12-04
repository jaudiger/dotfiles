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
        export PATH=$HOME/Development/git-repositories/jaudiger/personal-scripts:$HOME/Development/work-scripts:$HOME/Development/work-scripts/alaska:$HOME/Development/git-repositories/jaudiger/vscode-dev-containers:$PATH

        # Required for GitHub MCP server
        export GITHUB_PERSONAL_ACCESS_TOKEN="$(cat ${config.sops.secrets.github_personal_access_token.path})"
      '';
    };
  };
}
