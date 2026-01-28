{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      # Security scanner
      trivy
    ];
  };
}
