{ inputs, pkgs, ... }:

{
  nixpkgs.overlays = [
    inputs.zig-overlay.overlays.default

    (_final: prev: {
      superhtml = prev.callPackage ../../pkgs/superhtml.nix { };
      supermd = prev.callPackage ../../pkgs/supermd.nix { };
      ziggy = prev.callPackage ../../pkgs/ziggy.nix { };
      zine = prev.callPackage ../../pkgs/zine.nix { };
    })
  ];

  modules.home-manager.home = {
    packages = with pkgs; [
      zig # Or 'zigpkgs.master' to use nightly builds, 'zigpkgs."X.Y.Z"' to use a specific version
      # TODO: re-enable once upstream issue is resolved
      # zls

      superhtml
      supermd
      ziggy
      zine
    ];
  };
}
