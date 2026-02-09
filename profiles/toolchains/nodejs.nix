{ pkgs, ... }:

{
  modules.home-manager = {
    programs.npm = {
      enable = true;

      # List of default settings: 'npm config ls -l'
      settings = {
        fund = false;
        update-notifier = false;
      };
    };

    home = {
      packages = with pkgs; [
        pnpm

        nodePackages.prettier
        nodePackages.eslint
      ];
    };
  };
}
