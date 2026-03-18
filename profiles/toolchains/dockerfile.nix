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

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        dockerls = {
          enable = true;
        };
      };
    };
  };
}
