{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "ghostty" ];
  };

  modules.home-manager = {
    programs.ghostty = {
      enable = true;
      systemd.enable = false;

      # NOTE: nixpkgs marks ghostty as broken on Darwin, using Homebrew instead
      package = lib.mkIf isDarwin null;

      settings = {
        font-family = "JetBrainsMono Nerd Font";
        font-size = 11.5;

        selection-foreground = "cell-background";
        selection-background = "cell-foreground";
        cursor-color = "cell-foreground";
        cursor-text = "cell-background";
        minimum-contrast = 1.05;
        mouse-hide-while-typing = true;

        background-opacity = 0.8;
        background-blur = true;

        resize-overlay = "never";

        quick-terminal-size = "25%,75%";
        quick-terminal-position = "center";

        auto-update = "off";
      };
    };
  };
}
