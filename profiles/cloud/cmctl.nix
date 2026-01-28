{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Manage certificates of Kubernetes clusters
      cmctl
    ];
  };
}
