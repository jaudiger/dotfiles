{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Manage certificates of Kubernetes clusters
      cmctl

      # Detect unused resources in Kubernetes clusters
      kor

      hadolint
      trivy
    ];
  };
}
