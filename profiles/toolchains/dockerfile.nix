{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      packages = with pkgs; [
        # Dockerfile linter
        hadolint

        # Language server
        dockerfile-language-server
      ];
    };

    programs = {
      # Neovim configuration
      nixvim = {
        plugins.lsp.servers = {
          dockerls = {
            enable = true;
          };
        };
      };

      # Opencode configuration
      opencode = {
        settings = {
          lsp = {
            dockerfile = {
              command = [
                "docker-langserver"
                "--stdio"
              ];
            };
          };
        };
      };
    };
  };
}
