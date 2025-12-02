{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      nodePackages.nodejs
      pnpm
      bun

      # TODO: to re-enable once conflict with wrangler is resolved
      # nodePackages.prettier
    ];
  };
}
