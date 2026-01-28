{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Cloudflare Pages deployment
      (pkgs.lib.setPrio 10 wrangler) # Lower priority to prevent collision with the `prettier` package.
    ];
  };
}
