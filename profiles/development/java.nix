{ pkgs, ... }:

{
  modules = {
    home-manager = {
      programs.java = {
        enable = true;
        package = pkgs.jdk21_headless;
      };

      home.packages = with pkgs; [ maven ];
    };
  };
}
