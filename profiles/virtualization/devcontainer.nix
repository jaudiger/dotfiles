{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home.packages = with pkgs; [ devcontainer ];
    };
  };
}
