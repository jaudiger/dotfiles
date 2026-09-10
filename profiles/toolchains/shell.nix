{ pkgs, ... }:

{
  modules.home-manager = {
    home.packages = with pkgs; [
      shellcheck
      shfmt

      # Language server
      bash-language-server
    ];

    programs = {
      # Neovim configuration
      nixvim = {
        plugins.lsp.servers = {
          bashls = {
            enable = true;
          };
        };
      };
    };
  };
}
