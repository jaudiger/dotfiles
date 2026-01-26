{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      packages = with pkgs; [
        # Tools
        nix-init

        # Formatter
        nixfmt
        nixfmt-tree

        # Language server
        nixd
      ];
    };

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        nixd = {
          enable = true;
        };
      };
    };

    # Zed configuration
    programs.zed-editor.userSettings = {
      languages = {
        Nix = {
          language_servers = [
            "nixd"
            "!nil"
            "..."
          ];
        };
      };
    };
  };
}
