{ pkgs, ... }:

{
  modules.home-manager = {
    home = {
      file."telepresenceConfig" = {
        source = ../../config/telepresence;
        target = ".config/telepresence";
      };

      packages = with pkgs; [ telepresence2 ];
    };
  };
}
