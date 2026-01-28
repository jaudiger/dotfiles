{ config, pkgs, ... }:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  host = config.modules.host;
in
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
          settings = {
            nixpkgs.expr = "import <nixpkgs> {}";
            options =
              if isDarwin then
                {
                  darwin.expr = ''(builtins.getFlake "${host.dotfilesDirectory}").darwinConfigurations.darwin-aarch64.options'';
                  home-manager.expr = ''(builtins.getFlake "${host.dotfilesDirectory}").darwinConfigurations.darwin-aarch64.options.home-manager'';
                }
              else
                {
                  nixos.expr = ''(builtins.getFlake "${host.dotfilesDirectory}").nixosConfigurations.nixos-aarch64.options'';
                  home-manager.expr = ''(builtins.getFlake "${host.dotfilesDirectory}").nixosConfigurations.nixos-aarch64.options.home-manager'';
                };
          };
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
