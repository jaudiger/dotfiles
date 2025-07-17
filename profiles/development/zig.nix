{ pkgs, ... }:

{
  nixpkgs.overlays = [
    (final: prev: {
      superhtml = prev.callPackage ../../pkgs/superhtml.nix { };
      supermd = prev.callPackage ../../pkgs/supermd.nix { };
      ziggy = prev.callPackage ../../pkgs/ziggy.nix { };
    })
  ];

  modules.home-manager.home = {
    packages = with pkgs; [
      zig
      zls

      superhtml
      supermd
      ziggy
    ];
  };
}
