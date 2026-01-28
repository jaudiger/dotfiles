{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home.packages = with pkgs; [ devspace ];
    };
  };
}
