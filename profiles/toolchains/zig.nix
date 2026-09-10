{ inputs, pkgs, ... }:

{
  nixpkgs.overlays = [
    inputs.zig-overlay.overlays.default

    (_final: prev: {
      superhtml = prev.callPackage ../../pkgs/superhtml.nix {
        zig_master = prev.zigpkgs.master-2026-06-13;
      };
      supermd = prev.callPackage ../../pkgs/supermd.nix { zig_master = prev.zigpkgs.master-2026-06-13; };
      ziggy = prev.callPackage ../../pkgs/ziggy.nix { zig_master = prev.zigpkgs.master-2026-06-13; };
      zine = prev.callPackage ../../pkgs/zine.nix { zig_master = prev.zigpkgs.master-2026-06-13; };
    })
  ];

  modules.home-manager = {
    home = {
      packages = with pkgs; [
        zigpkgs.default # Or 'zigpkgs.master' to use nightly builds, 'zigpkgs."X.Y.Z"' to use a specific version
        zls

        superhtml
        supermd
        ziggy
        zine
      ];
    };

    programs = {
      # Neovim configuration
      nixvim = {
        plugins.lsp.servers = {
          zls = {
            enable = true;
          };
        };
      };
    };
  };
}
