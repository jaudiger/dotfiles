{ pkgs, ... }:

{
  modules.home-manager = {
    programs = {
      npm = {
        enable = true;

        # List of default settings: 'npm config ls -l'
        settings = {
          fund = false;
          update-notifier = false;
        };
      };

      pnpm = {
        enable = true;
      };
    };

    home.packages = with pkgs; [
      prettier
      eslint
    ];
  };
}
