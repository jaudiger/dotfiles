{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home.packages = with pkgs; [
        # 'glab config -g set check_update false' needs to be run after installation
        glab
      ];
    };
  };
}
