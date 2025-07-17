{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      pandoc
      nodePackages.mermaid-cli
      texliveSmall
    ];
  };
}
