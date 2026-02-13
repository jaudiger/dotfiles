{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          vacuum-go
        ];
      };
    };
  };
}
