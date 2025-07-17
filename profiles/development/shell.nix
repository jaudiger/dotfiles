{ pkgs, ... }:

{
  modules.home-manager = {
    home.packages = with pkgs; [
      shellcheck

      # Language server
      bash-language-server
    ];

    # Helix configuration
    programs.helix.languages = {
      language-server = {
        bash-lsp = {
          command = "bash-language-server";
          args = [ "start" ];
        };
      };

      language = [
        {
          name = "bash";
          language-servers = [ "bash-lsp" ];
        }
      ];
    };
  };
}
