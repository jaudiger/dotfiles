{ pkgs, ... }:

{
  modules.home-manager = {
    home.packages = with pkgs; [
      shellcheck
      shfmt

      # Language server
      bash-language-server
    ];

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        bashls = {
          enable = true;
        };
      };
    };
  };
}
