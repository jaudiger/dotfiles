{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      nodePackages.nodejs
      pnpm
      bun

      nodePackages.prettier
    ];
  };
}
