{ pkgs, ... }:

{
  modules.home-manager.home = {
    packages = with pkgs; [
      pandoc
      mermaid-cli
      texliveSmall

      markdownlint-cli2
    ];
  };
}
