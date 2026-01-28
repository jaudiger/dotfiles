{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Detect unused resources in Kubernetes clusters
      kor
    ];
  };
}
